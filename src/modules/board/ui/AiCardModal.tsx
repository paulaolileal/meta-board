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

const STACK_STYLES: { translateY: string; scale: string; opacity: number }[] = [
  { translateY: "0px", scale: "1", opacity: 1 },
  { translateY: "10px", scale: "0.96", opacity: 0.55 },
  { translateY: "20px", scale: "0.92", opacity: 0.3 },
];

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setStep("input");
      setText("");
      setCards([]);
      setCardValues([]);
      setCardStatuses([]);
      setCurrentIndex(0);
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
      setCardStatuses(results.map(() => "pending"));
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

      if (succeeded > 0) toast.success(`${succeeded} card${succeeded > 1 ? "s" : ""} criado${succeeded > 1 ? "s" : ""} com IA`);
      if (failed > 0) toast.error(`${failed} card${failed > 1 ? "s" : ""} não pôde${failed > 1 ? "ram" : ""} ser criado${failed > 1 ? "s" : ""}`);

      onClose();
    } catch {
      toast.error("Erro ao criar cards");
    } finally {
      setCreating(false);
    }
  }

  function navigate(dir: "prev" | "next") {
    setCurrentIndex((prev) =>
      dir === "next"
        ? (prev + 1) % cards.length
        : (prev - 1 + cards.length) % cards.length,
    );
  }

  function setField(cardIndex: number, fieldId: string, value: unknown) {
    setCardValues((prev) =>
      prev.map((cv, i) =>
        i === cardIndex ? { ...cv, [fieldId]: value as never } : cv,
      ),
    );
  }

  function setStatus(cardIndex: number, status: CardStatus) {
    setCardStatuses((prev) => prev.map((s, i) => (i === cardIndex ? status : s)));
  }

  const approvedCount = cardStatuses.filter((s) => s === "approved").length;
  const currentStatus = cardStatuses[currentIndex] ?? "pending";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {step === "input"
              ? "Criar card com IA"
              : cards.length > 1
                ? `Revisar ${cards.length} cards extraídos`
                : "Revisar card extraído"}
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Cole qualquer texto e a IA irá preencher os campos do card automaticamente."
              : cards.length > 1
                ? "Navegue pelos cards, aprove os que deseja criar e rejeite os demais."
                : "Verifique e ajuste os campos antes de criar o card."}
          </DialogDescription>
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
            {/* Stack carousel */}
            <div className="relative mt-2" style={{ height: "320px" }}>
              {cards.map((_, i) => {
                const distance = (i - currentIndex + cards.length) % cards.length;
                const isVisible = distance < STACK_STYLES.length;
                const style = isVisible ? STACK_STYLES[distance] : null;

                const statusBorder =
                  cardStatuses[i] === "approved"
                    ? "border-green-500"
                    : cardStatuses[i] === "rejected"
                      ? "border-red-400/60"
                      : "border-border";

                return (
                  <div
                    key={i}
                    className={`absolute inset-x-0 top-0 rounded-xl border-2 bg-card overflow-hidden transition-all duration-300 ${statusBorder}`}
                    style={{
                      zIndex: isVisible ? 10 - distance : 0,
                      opacity: style?.opacity ?? 0,
                      transform: `translateY(${style?.translateY ?? "24px"}) scale(${style?.scale ?? "0.88"})`,
                      pointerEvents: distance === 0 ? "auto" : "none",
                    }}
                  >
                    <div className="h-[316px] overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
                      {editableFields.map((f) => (
                        <div key={f.id} className="space-y-1">
                          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            {f.label}
                            {f.required && <span className="text-danger">*</span>}
                            {cardValues[i]?.[f.id as keyof typeof cardValues[0]] !== undefined && (
                              <>
                                {cards[i]?.sources[f.id] === "searched" && (
                                  <span className="ml-auto text-[10px] text-blue-500 font-semibold inline-flex items-center gap-0.5">
                                    <Globe className="h-2.5 w-2.5" />
                                    buscado
                                  </span>
                                )}
                                {cards[i]?.sources[f.id] === "extracted" && (
                                  <span className="ml-auto text-[10px] text-primary font-semibold">
                                    extraído
                                  </span>
                                )}
                              </>
                            )}
                          </label>
                          <FieldEditor
                            field={f}
                            value={cardValues[i]?.[f.id as keyof typeof cardValues[0]] as never}
                            onChange={(v) => setField(i, f.id, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation row */}
            <div className="flex items-center justify-between px-1 mt-1">
              <button
                onClick={() => navigate("prev")}
                disabled={cards.length <= 1}
                className="p-1.5 rounded-lg border border-border hover:bg-accent transition disabled:opacity-30"
                aria-label="Card anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs text-muted-foreground font-medium">
                {currentIndex + 1} / {cards.length}
              </span>

              <button
                onClick={() => navigate("next")}
                disabled={cards.length <= 1}
                className="p-1.5 rounded-lg border border-border hover:bg-accent transition disabled:opacity-30"
                aria-label="Próximo card"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Approve / Reject row */}
            <div className="flex gap-2 justify-center mt-1">
              <button
                onClick={() => setStatus(currentIndex, currentStatus === "rejected" ? "pending" : "rejected")}
                className={`flex-1 py-2 text-sm rounded-lg border transition inline-flex items-center justify-center gap-1.5 font-medium ${
                  currentStatus === "rejected"
                    ? "bg-red-500/10 border-red-400 text-red-500"
                    : "border-border hover:bg-accent"
                }`}
              >
                <X className="h-4 w-4" />
                Rejeitar
              </button>
              <button
                onClick={() => setStatus(currentIndex, currentStatus === "approved" ? "pending" : "approved")}
                className={`flex-1 py-2 text-sm rounded-lg border transition inline-flex items-center justify-center gap-1.5 font-medium ${
                  currentStatus === "approved"
                    ? "bg-green-500/10 border-green-500 text-green-500"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Check className="h-4 w-4" />
                Aprovar
              </button>
            </div>

            {/* Progress dots + actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
              {/* Dot indicators */}
              <div className="flex items-center gap-1.5">
                {cardStatuses.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className="transition-all"
                    aria-label={`Ir para card ${i + 1}`}
                  >
                    {s === "approved" ? (
                      <span className={`inline-flex items-center justify-center rounded-full bg-green-500 text-white ${i === currentIndex ? "w-5 h-5" : "w-3.5 h-3.5"} transition-all`}>
                        <Check className={i === currentIndex ? "h-3 w-3" : "h-2 w-2"} />
                      </span>
                    ) : s === "rejected" ? (
                      <span className={`inline-flex items-center justify-center rounded-full bg-red-400 text-white ${i === currentIndex ? "w-5 h-5" : "w-3.5 h-3.5"} transition-all`}>
                        <X className={i === currentIndex ? "h-3 w-3" : "h-2 w-2"} />
                      </span>
                    ) : (
                      <span className={`rounded-full bg-muted-foreground/30 block transition-all ${i === currentIndex ? "w-2.5 h-2.5 bg-muted-foreground/70" : "w-2 h-2"}`} />
                    )}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("input")}
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent transition inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || approvedCount === 0}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar aprovados ({approvedCount})
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
