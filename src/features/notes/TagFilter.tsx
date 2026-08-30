import { useMemo } from "react";
import { cn } from "../../lib/cn";
import type { NoteMeta } from "../../lib/types";

export interface TagFilterProps {
  notes: NoteMeta[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  className?: string;
}

/**
 * Derives the unique, sorted tag set across `notes` and renders them as
 * selectable mono chips — the editorial "data" layer. Multi-select.
 */
export function TagFilter({ notes, activeTags, onToggleTag, className }: TagFilterProps) {
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) set.add(tag);
    }
    return Array.from(set).sort();
  }, [notes]);

  if (tags.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Filter notes by tag"
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {tags.map((tag) => {
        const active = activeTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            onClick={() => onToggleTag(tag)}
            className={cn(
              "h-6 rounded-full border px-2.5 font-mono text-[11px] tracking-tight",
              "transition-[transform,background-color,border-color,color] duration-150 ease-[var(--ease-out)]",
              "active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-gold/45",
              active
                ? "border-gold/40 bg-gold-tint text-gold"
                : "border-line bg-transparent text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            <span className={active ? "text-gold/60" : "text-ink-faint"}>#</span>
            {tag}
          </button>
        );
      })}
    </div>
  );
}
