import { IconButton } from "../../components/IconButton";
import type { NoteMeta } from "../../lib/types";
import { SearchBar } from "./SearchBar";
import { TagFilter } from "./TagFilter";
import { NoteList } from "./NoteList";

export interface SidebarProps {
  notes: NoteMeta[];
  selectedId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNewNote: () => void;
}

/**
 * Left rail: wordmark + new-note action, search, tag filter, and the note
 * list under a labelled, counted header. Owns no state.
 */
export function Sidebar({
  notes,
  selectedId,
  query,
  onQueryChange,
  activeTags,
  onToggleTag,
  onOpen,
  onDelete,
  onNewNote,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface">
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <span className="font-sans text-[16px] font-semibold tracking-tight text-ink">
          naan<span className="text-gold">.</span>
        </span>
        <IconButton
          aria-label="New note"
          title="New note"
          onClick={onNewNote}
          className="text-ink-muted hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </IconButton>
      </header>

      <div className="px-3 pb-3">
        <SearchBar query={query} onQueryChange={onQueryChange} />
      </div>

      <TagFilter
        notes={notes}
        activeTags={activeTags}
        onToggleTag={onToggleTag}
        className="px-3 pb-3"
      />

      <div className="flex items-center justify-between px-4 pb-1.5 pt-1">
        <span className="eyebrow">Notes</span>
        <span className="eyebrow tabular-nums">{notes.length}</span>
      </div>

      <NoteList notes={notes} selectedId={selectedId} onOpen={onOpen} onDelete={onDelete} />
    </aside>
  );
}
