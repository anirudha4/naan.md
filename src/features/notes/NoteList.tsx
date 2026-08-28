import type { NoteMeta } from "../../lib/types";
import { NoteListItem } from "./NoteListItem";

export interface NoteListProps {
  notes: NoteMeta[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Renders `notes` as a list of `NoteListItem`s, highlighting `selectedId`.
 * Shows an empty-state message when there are no notes.
 */
export function NoteList({ notes, selectedId, onOpen, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="px-2 py-4 text-sm text-gray-500 dark:text-gray-400">No notes yet.</p>;
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {notes.map((note) => (
        <NoteListItem
          key={note.id}
          note={note}
          selected={note.id === selectedId}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
