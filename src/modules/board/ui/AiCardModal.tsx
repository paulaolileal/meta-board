import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Sparkles,
  ArrowLeft,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldEditor } from "./CardDrawer";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { useAiCardExtraction, type ExtractionResult } from "@/modules/board/useAiCardExtraction";
import { transcribeVideo } from "@/shared/api/OpenAiClient";
import type { CardRecord } from "@/modules/project/domain/types";

const MAX_STACK = 2;
const STACK_X_OFFSET = 30;
const STACK_SCALE = 0.03;

interface Props {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  initialVideoUrl?: string;
}

type Step = "input" | "review";
type CardStatus = "pending" | "approved" | "rejected";

export function AiCardModal({ open, onClose, initialText, initialVideoUrl }: Props) {
  const { createCard } = useCardMutations();
  const {
    extractFromText,
    enrichMissingFields,
    extractableFields: editableFields,
  } = useAiCardExtraction();

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [extracting, setExtracting] = useState(false);
  const [enrichingIndex, setEnrichingIndex] = useState<number | null>(null);
  const [enrichedFlags, setEnrichedFlags] = useState<boolean[]>([]);
  const [creating, setCreating] = useState(false);

  const [cards, setCards] = useState<ExtractionResult[]>([]);
  const [cardValues, setCardValues] = useState<Partial<CardRecord>[]>([]);
  const [cardStatuses, setCardStatuses] = useState<CardStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setStep("input");
      setText(initialText ?? "");
      setVideoUrl(initialVideoUrl);
      setCards([]);
      setCardValues([]);
      setCardStatuses([]);
      setCurrentIndex(0);
      setEnrichingIndex(null);
      setEnrichedFlags([]);
    }
  }, [open, initialText, initialVideoUrl]);

  useEffect(() => {
    if (open && step === "input") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, step]);

  async function handleExtract() {
    if (!text.trim()) return;
    setExtracting(true);
    try {
      const results = await extractFromText(text);
      if (results.length === 0 || results.every((r) => Object.keys(r.values).length === 0)) {
        toast.error("Nenhum campo pôde ser extraído do texto.");
        return;
      }
      setCards(results);
      setCardValues(results.map((r) => ({ ...r.values })));
      setCardStatuses(results.map(() => "pending" as CardStatus));
      setCurrentIndex(0);
      setEnrichedFlags(results.map(() => false));
      setStep("review");
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao extrair campos");
    } finally {
      setExtracting(false);
    }
  }

  async function handleEnrich(index: number) {
    setEnrichingIndex(index);
    try {
      let transcript: string | undefined;
      if (videoUrl) {
        try {
          transcript = await transcribeVideo(videoUrl);
        } catch {
          toast.error("Não foi possível transcrever o vídeo — continuando sem ele.");
        }
      }

      const [result] = await enrichMissingFields(
        [{ ...cards[index], values: cardValues[index] }],
        transcript,
      );

      setCards((prev) => prev.map((c, i) => (i === index ? result : c)));
      setCardValues((prev) => prev.map((cv, i) => (i === index ? { ...result.values } : cv)));
      setEnrichedFlags((prev) => prev.map((f, i) => (i === index ? true : f)));
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao completar campos");
    } finally {
      setEnrichingIndex(null);
    }
  }

  async function handleCreate() {
    const approvedIndices = cardStatuses
      .map((s, i) => (s === "approved" ? i : -1))
      .filter((i) => i >= 0);

    if (approvedIndices.length === 0) return;

    setCreating(true);
    try {
      const results = await Promise.allSettled(
        approvedIndices.map((i) => createCard(cardValues[i])),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (succeeded > 0)
        toast.success(
          `${succeeded} card${succeeded > 1 ? "s" : ""} criado${succeeded > 1 ? "s" : ""} com IA`,
        );
      if (failed > 0)
        toast.error(
          `${failed} card${failed > 1 ? "s" : ""} não ${failed > 1 ? "puderam" : "pôde"} ser criado${failed > 1 ? "s" : ""}`,
        );

      onClose();
    } catch {
      toast.error("Erro ao criar cards");
    } finally {
      setCreating(false);
    }
  }

  function updateStatus(index: number, status: CardStatus) {
    setCardStatuses((prev) => prev.map((s, i) => (i === index ? status : s)));
  }

  function setField(cardIndex: number, fieldId: string, value: unknown) {
    setCardValues((prev) =>
      prev.map((cv, i) => (i === cardIndex ? { ...cv, [fieldId]: value as never } : cv)),
    );
  }

  function navigate(dir: "next" | "prev", status?: CardStatus) {
    if (status !== undefined) updateStatus(currentIndex, status);
    if (cards.length <= 1) return;
    setCurrentIndex((prev) =>
      dir === "next" ? (prev + 1) % cards.length : (prev - 1 + cards.length) % cards.length,
    );
  }

  function jumpTo(targetIndex: number) {
    if (targetIndex !== currentIndex) setCurrentIndex(targetIndex);
  }

  const approvedCount = cardStatuses.filter((s) => s === "approved").length;
  const currentStatus = cardStatuses[currentIndex] ?? "pending";

  const cardRingClass =
    currentStatus === "approved"
      ? "ring-2 ring-green-500"
      : currentStatus === "rejected"
        ? "ring-2 ring-red-400"
        : "";

  const currentCard = cards[currentIndex];
  const currentCardHasMissingFields = editableFields.some(
    (f) => !(f.id in (cardValues[currentIndex] ?? {})),
  );
  const currentCardCanEnrich = currentCardHasMissingFields && !enrichedFlags[currentIndex];

  if (!open) return null;

  if (step === "input") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">
          <div className="flex items-center gap-2 px-6 pt-6 pb-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-semibold text-base">Criar card com IA</h2>
          </div>
          <p className="text-sm text-muted-foreground px-6 pb-4">
            Cole qualquer texto e a IA irá preencher os campos do card automaticamente.
          </p>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui um e-mail, anotação, conversa ou qualquer texto..."
            className="mx-6 min-h-[200px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2 justify-end px-6 py-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleExtract}
              disabled={!text.trim() || extracting}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {extracting ? "Extraindo…" : "Extrair campos"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-border flex items-center px-4 gap-3">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold text-base">
          {cards.length > 1 ? `Revisar ${cards.length} cards extraídos` : "Revisar card extraído"}
        </span>
        {cards.length > 1 && (
          <span className="ml-auto text-sm text-muted-foreground font-medium">
            {currentIndex + 1} / {cards.length}
          </span>
        )}
      </header>

      {/* Card stack + arrows + approve/reject */}
      <TooltipProvider delayDuration={400}>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-4 py-4">
          <div
            className={`flex items-center gap-3 w-full max-w-2xl ${cards.length > 1 ? "" : "justify-center"}`}
          >
            {cards.length > 1 && (
              <button
                onClick={() => navigate("prev")}
                className="shrink-0 p-2 rounded-full border border-border hover:bg-accent transition relative z-20"
                aria-label="Card anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {/* Stack container — sizes to front card's natural height */}
            <div className="relative flex-1">
              {Array.from({ length: Math.min(MAX_STACK + 1, cards.length) }, (_, pos) => ({
                cardIndex: (currentIndex + pos) % cards.length,
                relIdx: pos,
              }))
                .reverse()
                .map(({ cardIndex, relIdx }) => {
                  const transform = `translateX(${relIdx * STACK_X_OFFSET}px) scale(${1 - relIdx * STACK_SCALE})`;

                  if (relIdx > 0) {
                    return (
                      <div
                        key={cardIndex}
                        className="absolute inset-0 rounded-xl border bg-card transition-all duration-300 ease-out"
                        style={{ transform, zIndex: 10 - relIdx }}
                      />
                    );
                  }

                  return (
                    <div
                      key={cardIndex}
                      className={`relative z-10 rounded-xl border bg-card transition-all duration-300 ease-out overflow-y-auto scrollbar-thin ${cardRingClass}`}
                      style={{ transform, maxHeight: "calc(100vh - 220px)" }}
                    >
                      <div className="px-4 py-3 space-y-3">
                        {editableFields.map((f) => {
                          const val = cardValues[currentIndex]?.[f.id as keyof Partial<CardRecord>];
                          const source = currentCard?.sources[f.id];
                          const reason = currentCard?.reasons[f.id];
                          return (
                            <div key={f.id} className="space-y-1">
                              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                {f.label}
                                {f.required && <span className="text-danger">*</span>}

                                {val !== undefined && source === "searched" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="ml-auto text-[10px] text-blue-500 font-semibold inline-flex items-center gap-0.5 cursor-help">
                                        <Globe className="h-2.5 w-2.5" />
                                        buscado
                                      </span>
                                    </TooltipTrigger>
                                    {reason && (
                                      <TooltipContent
                                        side="bottom"
                                        className="max-w-[240px] text-left whitespace-pre-wrap bg-popover text-foreground border border-border shadow-md font-normal text-[11px] leading-relaxed"
                                      >
                                        {reason}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                )}

                                {val !== undefined && source === "extracted" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="ml-auto text-[10px] text-primary font-semibold cursor-help">
                                        extraído
                                      </span>
                                    </TooltipTrigger>
                                    {reason && (
                                      <TooltipContent
                                        side="bottom"
                                        className="max-w-[240px] text-left whitespace-pre-wrap bg-popover text-foreground border border-border shadow-md font-normal text-[11px] leading-relaxed"
                                      >
                                        {reason}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                )}
                              </label>
                              <FieldEditor
                                field={f}
                                value={val as never}
                                onChange={(v) => setField(currentIndex, f.id, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            {cards.length > 1 && (
              <div className="flex items-center">
                <button
                  onClick={() => navigate("next")}
                  className="shrink-0 p-2 rounded-full border border-border hover:bg-accent transition relative z-20"
                  aria-label="Próximo card"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Approve / Reject — directly below the stack */}
          <div
            className={`flex gap-3 pt-3 pb-3 w-full max-w-2xl mx-auto ${cards.length > 1 ? "px-12" : ""}`}
          >
            <button
              onClick={() => navigate("next", "rejected")}
              className={`flex-1 py-3 text-sm rounded-xl border-2 transition font-medium inline-flex items-center justify-center gap-2 ${
                currentStatus === "rejected"
                  ? "bg-red-500/10 border-red-400 text-red-500"
                  : "border-border hover:border-red-400 hover:text-red-500 hover:bg-red-500/5"
              }`}
            >
              <X className="h-4 w-4" />
              Rejeitar
            </button>

            {currentCardCanEnrich && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleEnrich(currentIndex)}
                    disabled={enrichingIndex === currentIndex}
                    aria-label="Tentar completar com busca na web"
                    className="shrink-0 w-12 py-3 rounded-xl border-2 border-border hover:border-blue-400 hover:text-blue-500 hover:bg-blue-500/5 transition inline-flex items-center justify-center disabled:opacity-50"
                  >
                    {enrichingIndex === currentIndex ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-popover text-foreground border border-border shadow-md font-normal text-[11px]"
                >
                  {`Tentar completar com busca na web${videoUrl ? " e vídeo" : ""}`}
                </TooltipContent>
              </Tooltip>
            )}

            <button
              onClick={() => navigate("next", "approved")}
              className={`flex-1 py-3 text-sm rounded-xl border-2 transition font-medium inline-flex items-center justify-center gap-2 ${
                currentStatus === "approved"
                  ? "bg-green-500/10 border-green-500 text-green-600"
                  : "border-border hover:border-green-500 hover:text-green-600 hover:bg-green-500/5"
              }`}
            >
              <Check className="h-4 w-4" />
              Aprovar
            </button>
          </div>
        </div>

        {/* Footer: back + dots + create */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border gap-3">
          <button
            onClick={() => setStep("input")}
            className="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {cardStatuses.map((s, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                aria-label={`Ir para card ${i + 1}`}
                className="transition-all"
              >
                {s === "approved" ? (
                  <span
                    className={`inline-flex items-center justify-center rounded-full bg-green-500 text-white transition-all ${i === currentIndex ? "w-5 h-5" : "w-4 h-4"}`}
                  >
                    <Check className={i === currentIndex ? "h-3 w-3" : "h-2.5 w-2.5"} />
                  </span>
                ) : s === "rejected" ? (
                  <span
                    className={`inline-flex items-center justify-center rounded-full bg-red-400 text-white transition-all ${i === currentIndex ? "w-5 h-5" : "w-4 h-4"}`}
                  >
                    <X className={i === currentIndex ? "h-3 w-3" : "h-2.5 w-2.5"} />
                  </span>
                ) : (
                  <span
                    className={`rounded-full block transition-all ${i === currentIndex ? "w-3 h-3 bg-muted-foreground/60" : "w-2 h-2 bg-muted-foreground/25"}`}
                  />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || approvedCount === 0}
            className="shrink-0 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar ({approvedCount})
          </button>
        </div>
      </TooltipProvider>
    </div>
  );
}
