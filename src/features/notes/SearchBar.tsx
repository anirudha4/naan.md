import { Input } from "../../components/Input";
import { cn } from "../../lib/cn";

export interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
}

/**
 * Search input for filtering the note list. Presentational — the shell owns
 * the search logic and passes `query` down. Search runs immediately on every
 * keystroke (no debounce); the backend call is local Tauri IPC, fast enough
 * that debouncing isn't needed.
 */
export function SearchBar({ query, onQueryChange, className }: SearchBarProps) {
  return (
    <Input
      type="search"
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      placeholder="Search notes…"
      aria-label="Search notes"
      className={cn(className)}
    />
  );
}
