import { Button } from "../../components/Button";
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
 * Composes the search bar, tag filter, "New note" action, and note list into
 * the left-hand sidebar. Owns no state — every prop threads through to the
 * shell (Task 4), which owns state and data fetching.
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
    <aside className="flex h-full w-64 flex-col gap-3 border-r border-gray-200 p-3 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <SearchBar query={query} onQueryChange={onQueryChange} className="flex-1" />
        <Button onClick={onNewNote}>New note</Button>
      </div>
      <TagFilter notes={notes} activeTags={activeTags} onToggleTag={onToggleTag} />
      <NoteList notes={notes} selectedId={selectedId} onOpen={onOpen} onDelete={onDelete} />
    </aside>
  );
}
