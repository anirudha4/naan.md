import { useMemo } from "react";
import { Button } from "../../components/Button";
import { cn } from "../../lib/cn";
import type { NoteMeta } from "../../lib/types";

export interface TagFilterProps {
  notes: NoteMeta[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  className?: string;
}

/**
 * Derives the unique, sorted set of tags across `notes` and renders them as
 * selectable chips. Multi-select: `activeTags` lists which are currently on.
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
          <Button
            key={tag}
            variant={active ? "default" : "ghost"}
            size="sm"
            aria-pressed={active}
            onClick={() => onToggleTag(tag)}
            className="h-6 rounded-full px-2.5 text-xs"
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );
}
