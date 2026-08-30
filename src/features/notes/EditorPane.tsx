import { Button } from "../../components/Button";
import { TiptapEditor } from "../editor/TiptapEditor";
import { cn } from "../../lib/cn";

export interface EditorPaneProps {
  title: string;
  body: string;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onSave: () => void;
  /** Whether a note is currently open. When false, shows a placeholder. */
  selected: boolean;
  className?: string;
}

/**
 * The writing page: a centered editorial column — big title, a hairline, the
 * CodeMirror body — with a quiet footer action bar.
 */
export function EditorPane({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSave,
  selected,
  className,
}: EditorPaneProps) {
  if (!selected) {
    return (
      <section
        className={cn("flex h-full flex-1 flex-col items-center justify-center gap-1.5", className)}
      >
        <p className="eyebrow">Nothing open</p>
        <p className="text-[13px] text-ink-muted">Select a note, or press + to write.</p>
      </section>
    );
  }

  return (
    <section className={cn("flex h-full flex-1 flex-col", className)}>
      <div className="mx-auto flex h-full w-full max-w-[44rem] flex-col px-8">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
          aria-label="Note title"
          className="w-full bg-transparent pb-3 pt-9 font-sans text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="h-px w-full shrink-0 bg-line" />
        <TiptapEditor
          value={body}
          onChange={onBodyChange}
          placeholder="Start writing…"
          ariaLabel="Note body"
          className="min-h-0 flex-1 overflow-y-auto"
        />
      </div>
      <footer className="flex items-center justify-between border-t border-line px-8 py-2.5">
        <span className="eyebrow">Markdown</span>
        <Button size="sm" variant="ghost" onClick={onSave}>
          Save
        </Button>
      </footer>
    </section>
  );
}
