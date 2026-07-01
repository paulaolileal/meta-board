import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  { label: "Roxo", hex: "#7c3aed" },
  { label: "Índigo", hex: "#4f46e5" },
  { label: "Azul", hex: "#2563eb" },
  { label: "Ciano", hex: "#0891b2" },
  { label: "Verde", hex: "#16a34a" },
  { label: "Lima", hex: "#65a30d" },
  { label: "Âmbar", hex: "#d97706" },
  { label: "Laranja", hex: "#ea580c" },
  { label: "Vermelho", hex: "#dc2626" },
  { label: "Rosa", hex: "#db2777" },
  { label: "Cinza", hex: "#4b5563" },
];

const PRESET_HEXES = new Set(PRESET_COLORS.map((p) => p.hex));

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function BoardColorPicker({ value, onChange }: Props) {
  const isCustom = value !== "" && !PRESET_HEXES.has(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map(({ label, hex }) => {
        const selected = value === hex;
        return (
          <button
            key={hex}
            type="button"
            title={label}
            onClick={() => onChange(hex)}
            className={cn(
              "w-7 h-7 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring/40",
              selected && "ring-2 ring-offset-2 ring-foreground scale-110",
            )}
            style={{ backgroundColor: hex }}
            aria-label={label}
            aria-pressed={selected}
          />
        );
      })}

      {/* Custom color input */}
      <label
        title="Cor personalizada"
        className={cn(
          "w-7 h-7 rounded-full cursor-pointer relative overflow-hidden flex items-center justify-center",
          "border-2 border-dashed border-muted-foreground/50 hover:border-foreground transition-colors",
          isCustom && "ring-2 ring-offset-2 ring-foreground scale-110",
        )}
        style={isCustom ? { backgroundColor: value, border: "none" } : undefined}
        aria-label="Cor personalizada"
      >
        {!isCustom && (
          <span className="text-muted-foreground text-xs font-bold leading-none select-none">
            +
          </span>
        )}
        <input
          type="color"
          value={isCustom ? value : "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          aria-label="Selecionar cor personalizada"
        />
      </label>
    </div>
  );
}
