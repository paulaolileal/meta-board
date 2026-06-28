import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, Link as LinkIcon, Calendar, MapPin, Clock } from "lucide-react";
import type { ChecklistItem, DurationValue, FieldDef, FieldValue } from "@/modules/project/domain/types";
import { cn } from "@/lib/utils";

interface RenderProps {
  field: FieldDef;
  value: FieldValue;
  mode: "closed" | "open";
}

// Default color palettes (fallback when option has no explicit color)
const CHIP_PALETTE = [
  "bg-danger/15 text-danger ring-1 ring-danger/30",
  "bg-warning/20 text-warning-foreground ring-1 ring-warning/40",
  "bg-primary/15 text-primary ring-1 ring-primary/30",
  "bg-muted text-muted-foreground ring-1 ring-border",
  "bg-success/15 text-success ring-1 ring-success/30",
];

const SELECT_PALETTE = [
  "bg-muted text-muted-foreground",
  "bg-primary/15 text-primary",
  "bg-warning/20 text-warning-foreground",
  "bg-success/20 text-success",
  "bg-danger/15 text-danger",
];

function chipColor(value: string, options: string[]): string {
  const idx = options.indexOf(value);
  return CHIP_PALETTE[idx >= 0 ? idx % CHIP_PALETTE.length : 0];
}

function selectColor(value: string, options: string[]): string {
  const idx = options.indexOf(value);
  return SELECT_PALETTE[idx >= 0 ? idx % SELECT_PALETTE.length : 0];
}

function asString(v: FieldValue): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function FieldRenderer({ field, value, mode }: RenderProps) {
  switch (field.type) {
    case "text":
      return (
        <span className={cn(mode === "closed" ? "font-semibold text-foreground" : "text-foreground")}>
          {asString(value) || <span className="text-muted-foreground">—</span>}
        </span>
      );
    case "longtext":
      return (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
          {asString(value) || "—"}
        </p>
      );
    case "number":
    case "longnumber":
      return <span className="tabular-nums">{asString(value) || "—"}</span>;
    case "bool":
      return value ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      );
    case "date":
    case "datetime": {
      const s = asString(value);
      if (!s) return <span className="text-muted-foreground text-xs">Sem data</span>;
      const d = parseISO(s);
      if (!isValid(d)) return <span className="text-muted-foreground text-xs">{s}</span>;
      const fmt = field.type === "datetime" ? "dd MMM, HH:mm" : "dd MMM yyyy";
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(d, fmt, { locale: ptBR })}
        </span>
      );
    }
    case "url": {
      const s = asString(value);
      if (!s) return <span className="text-muted-foreground">—</span>;
      return (
        <a
          href={s}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          {s.replace(/^https?:\/\//, "").slice(0, 40)}
        </a>
      );
    }
    case "image": {
      const s = asString(value);
      if (!s) return null;
      if (mode === "closed") {
        return (
          <img
            src={s}
            alt=""
            className="w-full h-40 object-cover rounded-t-2xl bg-muted/30"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        );
      }
      return (
        <img
          src={s}
          alt=""
          className="w-full object-contain rounded-2xl max-h-[480px] bg-muted/30"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    }
    case "chip": {
      const s = asString(value);
      if (!s) return null;
      const color = chipColor(s, field.options ?? []);
      return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", color)}>
          {s}
        </span>
      );
    }
    case "select": {
      const s = asString(value);
      if (!s) return null;
      const color = selectColor(s, field.options ?? []);
      return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium", color)}>
          {s}
        </span>
      );
    }
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      if (!arr.length) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
            >
              #{t}
            </span>
          ))}
        </div>
      );
    }
    case "checklist": {
      const items = Array.isArray(value) ? (value as ChecklistItem[]) : [];
      if (!items.length) return null;
      const done = items.filter((i) => i.done).length;
      const pct = Math.round((done / items.length) * 100);
      if (mode === "closed") {
        return (
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {done}/{items.length}
            </span>
          </div>
        );
      }
      return (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              {it.done ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(it.done && "line-through text-muted-foreground")}>{it.text}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "color": {
      const s = asString(value);
      if (!s) return null;
      return <span className="inline-block w-4 h-4 rounded-full border" style={{ background: s }} />;
    }
    case "location": {
      const s = asString(value);
      if (!s) return <span className="text-muted-foreground">—</span>;
      const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(s)}`;
      return (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {s.slice(0, 50)}
        </a>
      );
    }
    case "duration": {
      if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
      let dur: DurationValue | null = null;
      if (typeof value === "object" && !Array.isArray(value)) {
        dur = value as DurationValue;
      } else if (typeof value === "string") {
        try { dur = JSON.parse(value) as DurationValue; } catch { return <span>{asString(value)}</span>; }
      }
      if (!dur) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {dur.value} ({dur.unit})
        </span>
      );
    }
    case "email":
    case "icon":
    default:
      return <span>{asString(value)}</span>;
  }
}
