import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, ArrowLeft, Globe } from "lucide-react";
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
import { useAiCardExtraction, type FieldSource } from "@/modules/board/useAiCardExtraction";
import { useBoardStore } from "@/modules/board/store";
import type { CardRecord } from "@/modules/project/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "input" | "review";

export function AiCardModal({ open, onClose }: Props) {
  const fields = useBoardStore((s) => s.fields);
  const { createCard } = useCardMutations();
  const { extractCard } = useAiCardExtraction();

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [values, setValues] = useState<Partial<CardRecord>>({});
  const [sources, setSources] = useState<Record<string, FieldSource>>({});
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setStep("input");
      setText("");
      setValues({});
      setSources({});
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
      const result = await extractCard(text);
      setValues(result.values);
      setSources(result.sources);
      setStep("review");
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao extrair campos");
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await createCard(values);
      toast.success("Card criado com IA");
      onClose();
    } catch {
      toast.error("Erro ao criar card");
    } finally {
      setCreating(false);
    }
  }

  function setField(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value as never }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {step === "input" ? "Criar card com IA" : "Revisar campos extraídos"}
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Cole qualquer texto e a IA irá preencher os campos do card automaticamente."
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
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 mt-2 pr-1">
              {editableFields.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    {f.label}
                    {f.required && <span className="text-danger">*</span>}
                    {sources[f.id] === "searched" && (
                      <span className="ml-auto text-[10px] text-blue-500 font-semibold inline-flex items-center gap-0.5">
                        <Globe className="h-2.5 w-2.5" />
                        buscado
                      </span>
                    )}
                    {sources[f.id] === "extracted" && (
                      <span className="ml-auto text-[10px] text-primary font-semibold">
                        extraído
                      </span>
                    )}
                  </label>
                  <FieldEditor
                    field={f}
                    value={values[f.id as keyof typeof values] as never}
                    onChange={(v) => setField(f.id, v)}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-border mt-4">
              <button
                onClick={() => setStep("input")}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar card
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
