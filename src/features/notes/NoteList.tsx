import type { NoteMeta } from "../../lib/types";
import { NoteListItem } from "./NoteListItem";

export interface NoteListProps {
  notes: NoteMeta[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Renders `notes` as rows, highlighting `selectedId`; editorial empty state. */
export function NoteList({ notes, selectedId, onOpen, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="px-4 py-10">
        <p className="eyebrow mb-1.5">Empty</p>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          No notes yet.
          <br />
          Press + to write your first.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
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
