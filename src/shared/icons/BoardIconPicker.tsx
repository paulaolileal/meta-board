import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ICON_LIST, getIcon } from "./iconRegistry";
import { cn } from "@/lib/utils";


interface Props {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
}

export function BoardIconPicker({ value, onChange, color }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const LucideComponent = getIcon(value);

  const filteredLucide = search
    ? ICON_LIST.filter(({ id }) => id.toLowerCase().includes(search.toLowerCase()))
    : ICON_LIST;

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-[var(--shadow-glow)] hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-ring/40",
            !color && "bg-gradient-to-br from-primary to-primary-glow",
          )}
          style={color ? { backgroundColor: color } : undefined}
        >
          {LucideComponent ? (
            <LucideComponent size={24} className="text-white" />
          ) : (
            <span className="text-lg">{value}</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-3" align="start">
        <div className="space-y-2">
          <input
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />

          <ScrollArea className="h-64">
            <div className="grid grid-cols-6 gap-1 pr-1">
              {filteredLucide.map(({ id, component: Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={id}
                  onClick={() => select(id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 h-14 w-full rounded-md transition hover:bg-accent",
                    value === id && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <Icon size={18} />
                  <span className="text-[8px] leading-none opacity-60 truncate w-full text-center px-0.5">
                    {id}
                  </span>
                </button>
              ))}
              {filteredLucide.length === 0 && (
                <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                  Nenhum ícone encontrado
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
