import { Input } from "../../components/Input";
import { cn } from "../../lib/cn";

export interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
}

/**
 * Search input for filtering the note list. Presentational — the shell owns
 * the search logic. Runs immediately on every keystroke (local Tauri IPC is
 * fast enough that debouncing isn't needed).
 */
export function SearchBar({ query, onQueryChange, className }: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search"
        aria-label="Search notes"
        className="h-9 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  );
}
