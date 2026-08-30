import { IconButton } from "../../components/IconButton";
import { cn } from "../../lib/cn";
import type { NoteMeta } from "../../lib/types";

export interface NoteListItemProps {
  note: NoteMeta;
  selected: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * One row in the note list. The open control and the delete control are
 * siblings (never nested), so delete never triggers open. No entrance
 * animation: the list re-renders on every search keystroke, and Emil's rule
 * is to not animate frequently-seen list changes.
 */
export function NoteListItem({ note, selected, onOpen, onDelete }: NoteListItemProps) {
  const title = note.title || "Untitled";

  return (
    <li
      className={cn(
        "group/item relative flex items-center rounded-md",
        "transition-colors duration-150 ease-[var(--ease-out)]",
        selected ? "bg-gold-tint" : "hover:bg-ink/[0.04]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-gold transition-opacity duration-150",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        onClick={() => onOpen(note.id)}
        className="min-w-0 flex-1 rounded-md px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <span className="block truncate text-[13.5px] font-medium leading-snug text-ink">
          {title}
        </span>
        {note.tags.length > 0 && (
          <span className="mt-0.5 block truncate font-mono text-[10.5px] tracking-tight text-ink-faint">
            {note.tags.map((t) => `#${t}`).join("  ")}
          </span>
        )}
      </button>
      <IconButton
        aria-label={`Delete "${title}"`}
        variant="danger"
        size="sm"
        onClick={() => onDelete(note.id)}
        className="mr-1.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-within/item:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </IconButton>
    </li>
  );
}
