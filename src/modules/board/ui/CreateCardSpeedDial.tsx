import { useState, useEffect, useRef } from "react";
import { Plus, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  onCreateCard: () => void;
  onCreateAi: () => void;
}

export function CreateCardSpeedDial({ onCreateCard, onCreateAi }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleCreateCard = () => {
    setOpen(false);
    onCreateCard();
  };

  const handleCreateAi = () => {
    setOpen(false);
    onCreateAi();
  };

  const dialItem = "flex items-center gap-2 whitespace-nowrap cursor-pointer select-none";

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <>
            {/* Criar com IA — aparece acima */}
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 16, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.18, delay: 0.06, ease: "easeOut" }}
              className={dialItem}
              onClick={handleCreateAi}
            >
              <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm">
                Criar com IA
              </span>
              <button
                className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
                aria-label="Criar card com IA"
                tabIndex={open ? 0 : -1}
              >
                <Sparkles className="h-5 w-5" />
              </button>
            </motion.div>

            {/* Criar card — aparece abaixo do IA */}
            <motion.div
              key="card"
              initial={{ opacity: 0, y: 16, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.18, delay: 0, ease: "easeOut" }}
              className={dialItem}
              onClick={handleCreateCard}
            >
              <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm">
                Criar card
              </span>
              <button
                className="h-12 w-12 rounded-full bg-surface border border-border text-foreground shadow-sm flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
                aria-label="Criar card"
                tabIndex={open ? 0 : -1}
              >
                <Plus className="h-5 w-5" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Botão principal */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-14 w-14 rounded-full shadow-[var(--shadow-glow)] flex items-center justify-center active:scale-95 transition-all duration-200",
          open
            ? "bg-surface border border-border text-foreground hover:bg-accent"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
        aria-label={open ? "Fechar" : "Criar card"}
        aria-expanded={open}
      >
        <Plus className={cn("h-6 w-6 transition-transform duration-200", open && "rotate-45")} />
      </button>
    </div>
  );
}
