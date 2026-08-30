import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { TaskList } from "@tiptap/extension-list/task-list";
import { TaskItem } from "@tiptap/extension-list/task-item";
import { Markdown } from "tiptap-markdown";
import { cn } from "../../lib/cn";
import { SlashCommand } from "./SlashCommand";
import { SelectionToolbar } from "./SelectionBubble";

/** tiptap-markdown adds this at runtime but doesn't augment the type. */
function markdownOf(editor: Editor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
}

export interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * WYSIWYG Markdown editor. Renders real formatting (headings, checkboxes,
 * quotes) with no visible marks, and serializes back to Markdown on every
 * change (via tiptap-markdown), so notes stay plain `.md` on disk. Controls are
 * the slash menu (`/`) and the selection BubbleMenu — no toolbar.
 */
export function TiptapEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  ariaLabel = "Note body",
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ transformPastedText: true, transformCopiedText: true }),
      SlashCommand,
    ],
    content: value,
    editorProps: { attributes: { class: "naan-prose", "aria-label": ariaLabel } },
    onUpdate: ({ editor }) => onChange(markdownOf(editor)),
  });

  // Reconcile external value changes (e.g. the file watcher) without a loop:
  // only reset content when the incoming Markdown differs from what's shown.
  useEffect(() => {
    if (!editor) return;
    const current = markdownOf(editor);
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className={cn("naan-editor", className)}>
      <EditorContent editor={editor} />
      {editor && (
        <BubbleMenu editor={editor}>
          <SelectionToolbar editor={editor} />
        </BubbleMenu>
      )}
    </div>
  );
}
