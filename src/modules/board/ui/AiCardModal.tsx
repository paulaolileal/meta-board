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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldEditor } from "./CardDrawer";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { useAiCardExtraction, type ExtractionResult } from "@/modules/board/useAiCardExtraction";
import { useBoardStore } from "@/modules/board/store";
import type { CardRecord } from "@/modules/project/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "input" | "review";
type CardStatus = "pending" | "approved" | "rejected";
type SlidePhase = "exit" | "enter-start" | "enter-end" | null;

export function AiCardModal({ open, onClose }: Props) {
  const fields = useBoardStore((s) => s.fields);
  const { createCard } = useCardMutations();
  const { extractCards } = useAiCardExtraction();

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);

  const [cards, setCards] = useState<ExtractionResult[]>([]);
  const [cardValues, setCardValues] = useState<Partial<CardRecord>[]>([]);
  const [cardStatuses, setCardStatuses] = useState<CardStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [slide, setSlide] = useState<{ phase: SlidePhase; dir: "left" | "right" }>({
    phase: null,
    dir: "left",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setStep("input");
      setText("");
      setCards([]);
      setCardValues([]);
      setCardStatuses([]);
      setCurrentIndex(0);
      setSlide({ phase: null, dir: "left" });
    }
  }, [open]);

  useEffect(() => {
    if (open && step === "input") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, step]);

  const editableFields = fields.filter(
    (f) => f.editable !== false && f.visible !== false,
  );

  async function handleExtract() {
    if (!text.trim()) return;
    setExtracting(true);
    try {
      const results = await extractCards(text);
      if (results.length === 0 || results.every((r) => Object.keys(r.values).length === 0)) {
        toast.error("Nenhum campo pôde ser extraído do texto.");
        return;
      }
      setCards(results);
      setCardValues(results.map((r) => ({ ...r.values })));
      setCardStatuses(results.map(() => "pending" as CardStatus));
      setCurrentIndex(0);
      setStep("review");
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao extrair campos");
    } finally {
      setExtracting(false);
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
        toast.success(`${succeeded} card${succeeded > 1 ? "s" : ""} criado${succeeded > 1 ? "s" : ""} com IA`);
      if (failed > 0)
        toast.error(`${failed} card${failed > 1 ? "s" : ""} não ${failed > 1 ? "puderam" : "pôde"} ser criado${failed > 1 ? "s" : ""}`);

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
      prev.map((cv, i) =>
        i === cardIndex ? { ...cv, [fieldId]: value as never } : cv,
      ),
    );
  }

  function runSlideAnimation(
    exitDir: "left" | "right",
    onSwap: () => void,
  ) {
    setSlide({ phase: "exit", dir: exitDir });

    setTimeout(() => {
      onSwap();
      const enterDir: "left" | "right" = exitDir === "left" ? "right" : "left";
      setSlide({ phase: "enter-start", dir: enterDir });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlide({ phase: "enter-end", dir: enterDir });
          setTimeout(() => setSlide({ phase: null, dir: "left" }), 310);
        });
      });
    }, 280);
  }

  function animateNavigate(dir: "next" | "prev", status?: CardStatus) {
    if (slide.phase !== null) return;
    if (status !== undefined) updateStatus(currentIndex, status);

    if (cards.length <= 1) return;

    const exitDir: "left" | "right" =
      status === "approved" ? "right" :
      status === "rejected" ? "left" :
      dir === "next" ? "left" : "right";

    runSlideAnimation(exitDir, () => {
      setCurrentIndex((prev) =>
        dir === "next"
          ? (prev + 1) % cards.length
          : (prev - 1 + cards.length) % cards.length,
      );
    });
  }

  function animateJumpTo(targetIndex: number) {
    if (targetIndex === currentIndex || slide.phase !== null) return;
    const exitDir: "left" | "right" = targetIndex > currentIndex ? "left" : "right";
    runSlideAnimation(exitDir, () => setCurrentIndex(targetIndex));
  }

  // Derive inline styles from slide state
  const cardTransform =
    slide.phase === "exit"
      ? slide.dir === "left"
        ? "translateX(-115%) rotate(-5deg)"
        : "translateX(115%) rotate(5deg)"
      : slide.phase === "enter-start"
        ? slide.dir === "left"
          ? "translateX(-50px)"
          : "translateX(50px)"
        : "translateX(0)";

  const cardTransition =
    slide.phase === "exit" || slide.phase === "enter-end"
      ? "transform 0.28s ease-in-out, opacity 0.22s ease-in-out"
      : "none";

  const cardOpacity = slide.phase === "exit" || slide.phase === "enter-start" ? 0 : 1;

  const approvedCount = cardStatuses.filter((s) => s === "approved").length;
  const currentStatus = cardStatuses[currentIndex] ?? "pending";

  const cardRingClass =
    currentStatus === "approved" ? "ring-2 ring-green-500" :
    currentStatus === "rejected" ? "ring-2 ring-red-400" : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                {step === "input"
                  ? "Criar card com IA"
                  : cards.length > 1
                    ? `Revisar ${cards.length} cards extraídos`
                    : "Revisar card extraído"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {step === "input"
                  ? "Cole qualquer texto e a IA irá preencher os campos do card automaticamente."
                  : cards.length > 1
                    ? "Aprove ou rejeite cada card. Somente os aprovados serão criados."
                    : "Verifique e ajuste os campos antes de criar o card."}
              </DialogDescription>
            </div>
            {step === "review" && (
              <span className="text-xs text-muted-foreground font-medium shrink-0 pt-1">
                {currentIndex + 1} / {cards.length}
              </span>
            )}
          </div>
        </DialogHeader>

        {step === "input" ? (
          <>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui um e-mail, anotação, conversa ou qualquer texto..."
              className="flex-1 min-h-[200px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring mt-2"
            />
            <div className="flex gap-2 justify-end pt-4 border-t border-border mt-4">
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
          </>
        ) : (
          <>
            {/* Card + flanking arrows */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => animateNavigate("prev")}
                disabled={cards.length <= 1 || slide.phase !== null}
                className="shrink-0 p-2 rounded-full border border-border hover:bg-accent transition disabled:opacity-25"
                aria-label="Card anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Overflow-hidden clips the flying card */}
              <div className="flex-1 overflow-hidden rounded-xl">
                <div
                  style={{
                    transform: cardTransform,
                    transition: cardTransition,
                    opacity: cardOpacity,
                  }}
                  className={`rounded-xl border bg-card ${cardRingClass}`}
                >
                  <div className="h-[300px] overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
                    {editableFields.map((f) => {
                      const val = cardValues[currentIndex]?.[f.id as keyof Partial<CardRecord>];
                      const source = cards[currentIndex]?.sources[f.id];
                      return (
                        <div key={f.id} className="space-y-1">
                          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            {f.label}
                            {f.required && <span className="text-danger">*</span>}
                            {val !== undefined && source === "searched" && (
                              <span className="ml-auto text-[10px] text-blue-500 font-semibold inline-flex items-center gap-0.5">
                                <Globe className="h-2.5 w-2.5" />
                                buscado
                              </span>
                            )}
                            {val !== undefined && source === "extracted" && (
                              <span className="ml-auto text-[10px] text-primary font-semibold">
                                extraído
                              </span>
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
              </div>

              <button
                onClick={() => animateNavigate("next")}
                disabled={cards.length <= 1 || slide.phase !== null}
                className="shrink-0 p-2 rounded-full border border-border hover:bg-accent transition disabled:opacity-25"
                aria-label="Próximo card"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Approve / Reject */}
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => animateNavigate("next", "rejected")}
                disabled={slide.phase !== null}
                className={`flex-1 py-3 text-sm rounded-xl border-2 transition font-medium inline-flex items-center justify-center gap-2 ${
                  currentStatus === "rejected"
                    ? "bg-red-500/10 border-red-400 text-red-500"
                    : "border-border hover:border-red-400 hover:text-red-500 hover:bg-red-500/5"
                }`}
              >
                <X className="h-4 w-4" />
                Rejeitar
              </button>
              <button
                onClick={() => animateNavigate("next", "approved")}
                disabled={slide.phase !== null}
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

            {/* Footer: back + dots + create */}
            <div className="flex items-center justify-between pt-3 border-t border-border mt-2 gap-3">
              <button
                onClick={() => setStep("input")}
                className="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>

              {/* Status dots — clickable to jump */}
              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {cardStatuses.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => animateJumpTo(i)}
                    aria-label={`Ir para card ${i + 1}`}
                    className="transition-all"
                  >
                    {s === "approved" ? (
                      <span className={`inline-flex items-center justify-center rounded-full bg-green-500 text-white transition-all ${i === currentIndex ? "w-5 h-5" : "w-4 h-4"}`}>
                        <Check className={i === currentIndex ? "h-3 w-3" : "h-2.5 w-2.5"} />
                      </span>
                    ) : s === "rejected" ? (
                      <span className={`inline-flex items-center justify-center rounded-full bg-red-400 text-white transition-all ${i === currentIndex ? "w-5 h-5" : "w-4 h-4"}`}>
                        <X className={i === currentIndex ? "h-3 w-3" : "h-2.5 w-2.5"} />
                      </span>
                    ) : (
                      <span className={`rounded-full block transition-all ${i === currentIndex ? "w-3 h-3 bg-muted-foreground/60" : "w-2 h-2 bg-muted-foreground/25"}`} />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
