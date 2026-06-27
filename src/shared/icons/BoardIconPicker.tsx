import { useState } from "react";
import { Smile, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ICON_LIST, getIcon } from "./iconRegistry";
import { cn } from "@/lib/utils";

const EMOJI_LIST = [
  "📋", "🚀", "✨", "📣", "🎯", "🛠️", "📊", "🔥", "💡", "🌟",
  "⚡", "🏆", "🎨", "🧩", "📌", "🔖", "💎", "🌈", "🎉", "🔔",
  "📱", "💻", "🖥️", "⌨️", "🖱️", "📷", "🎥", "🎵", "🎮", "🎲",
  "🏠", "🏢", "🌍", "🗺️", "✈️", "🚗", "🚢", "🚂", "🚲", "🏍️",
  "💰", "💳", "📈", "📉", "💹", "🏦", "🛒", "🎁", "🛍️", "🏪",
  "❤️", "💙", "💚", "💛", "💜", "🧡", "🖤", "🤍", "💪", "🧠",
  "⭐", "🌙", "☀️", "🌸", "🍀", "🌿", "🌻", "🍎", "☕", "🍕",
  "📚", "🎓", "🔬", "🧪", "🏥", "💊", "🤝", "👥", "👤", "📞",
  "✅", "❌", "⚠️", "ℹ️", "🔒", "🔓", "🔑", "🛡️", "⚙️", "🔧",
  "🎯", "🏁", "🚩", "📍", "🗓️", "⏰", "⌚", "⏳", "🔄", "♻️",
];

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export function BoardIconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"emoji" | "lucide">("emoji");

  const LucideComponent = getIcon(value);
  const isEmoji = !LucideComponent;

  const filteredLucide = search
    ? ICON_LIST.filter(({ id }) => id.toLowerCase().includes(search.toLowerCase()))
    : ICON_LIST;

  const filteredEmoji = search
    ? EMOJI_LIST.filter((e) => e.includes(search))
    : EMOJI_LIST;

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
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-xl shadow-[var(--shadow-glow)] hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          {LucideComponent ? (
            <LucideComponent size={20} className="text-white" />
          ) : (
            <span>{value || "📋"}</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[380px] p-3" align="start">
        <div className="space-y-2">
          <input
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />

          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setTab("emoji")}
              className={cn(
                "flex-1 py-1 text-xs rounded-md transition font-medium",
                tab === "emoji" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Emojis
            </button>
            <button
              type="button"
              onClick={() => setTab("lucide")}
              className={cn(
                "flex-1 py-1 text-xs rounded-md transition font-medium",
                tab === "lucide" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Ícones
            </button>
          </div>

          <ScrollArea className="h-64">
            {tab === "emoji" ? (
              <div className="grid grid-cols-8 gap-1 pr-1">
                {filteredEmoji.map((e) => (
                  <button
                    key={e}
                    type="button"
                    title={e}
                    onClick={() => select(e)}
                    className={cn(
                      "h-9 w-full rounded-md text-lg flex items-center justify-center transition hover:bg-accent",
                      isEmoji && value === e && "bg-primary/20 ring-2 ring-primary"
                    )}
                  >
                    {e}
                  </button>
                ))}
                {filteredEmoji.length === 0 && (
                  <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
                    Nenhum emoji encontrado
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1 pr-1">
                {filteredLucide.map(({ id, component: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    title={id}
                    onClick={() => select(id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 h-14 w-full rounded-md transition hover:bg-accent",
                      !isEmoji && value === id && "bg-primary text-primary-foreground hover:bg-primary/90"
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
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
