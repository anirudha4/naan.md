import { motion } from "motion/react";
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
 * One row in the note list. Click anywhere on the row to open the note;
 * the delete icon button is a separate control so it doesn't trigger open.
 */
export function NoteListItem({ note, selected, onOpen, onDelete }: NoteListItemProps) {
  const title = note.title || "Untitled";

  return (
    <motion.li
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group flex items-center gap-1 rounded-md",
        selected && "bg-gray-100 dark:bg-gray-800",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(note.id)}
        className={cn(
          "min-w-0 flex-1 rounded-md px-2 py-1.5 text-left outline-none",
          "hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500",
          "dark:hover:bg-gray-800",
        )}
      >
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </span>
        {note.tags.length > 0 && (
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {note.tags.join(", ")}
          </span>
        )}
      </button>
      <IconButton
        aria-label={`Delete "${title}"`}
        variant="danger"
        size="sm"
        className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={() => onDelete(note.id)}
      >
        &times;
      </IconButton>
    </motion.li>
  );
}
