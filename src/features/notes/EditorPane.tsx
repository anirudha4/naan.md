import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { CodeMirrorEditor } from "../editor/CodeMirrorEditor";
import { cn } from "../../lib/cn";

export interface EditorPaneProps {
  title: string;
  body: string;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onSave: () => void;
  /** Whether a note is currently selected/open. When false, shows a placeholder. */
  selected: boolean;
  className?: string;
}

/**
 * Title input + CodeMirror live-markdown body + Save button. The slash and
 * selection bubbles get layered onto the editor later in Phase 5.
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
      <section className={cn("flex h-full flex-1 items-center justify-center", className)}>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a note, or create one.</p>
      </section>
    );
  }

  return (
    <section className={cn("flex h-full flex-1 flex-col gap-3 p-4", className)}>
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        aria-label="Note title"
        className="text-base font-medium"
      />
      <CodeMirrorEditor
        value={body}
        onChange={onBodyChange}
        placeholder="Start writing…"
        ariaLabel="Note body"
        className={cn(
          "flex-1 overflow-hidden rounded-md border border-gray-300 bg-white text-gray-900",
          "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30",
          "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
        )}
      />
      <div className="flex justify-end">
        <Button onClick={onSave}>Save</Button>
      </div>
    </section>
  );
}
