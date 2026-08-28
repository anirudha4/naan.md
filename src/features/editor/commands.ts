import type { EditorView } from "@codemirror/view";
import { insertBlock, toggleLinePrefix, wrapSelection } from "./transforms";

/**
 * Data-driven command registry consumed by the slash menu (Task 3) and the
 * selection bubble (Task 4). Each command is just an id/title plus a `run`
 * that dispatches one of the pure transforms in transforms.ts against the
 * live view — no DOM/bubble UI lives here.
 */

/** A block-level command, triggered by typing `/` at the start of a line. */
export interface SlashCommand {
  id: string;
  title: string;
  /** Optional grouping label for rendering the slash menu in sections. */
  group?: string;
  run: (view: EditorView) => void;
}

/** An inline command, triggered from the bubble shown over a selection. */
export interface SelectionCommand {
  id: string;
  title: string;
  run: (view: EditorView) => void;
}

/** Placeholder fenced code block: cursor lands after the closing fence. */
const CODE_BLOCK = "```\n\n```";

export const slashCommands: SlashCommand[] = [
  {
    id: "heading-1",
    title: "Heading 1",
    group: "Text",
    run: (view) => toggleLinePrefix(view, "# "),
  },
  {
    id: "heading-2",
    title: "Heading 2",
    group: "Text",
    run: (view) => toggleLinePrefix(view, "## "),
  },
  {
    id: "heading-3",
    title: "Heading 3",
    group: "Text",
    run: (view) => toggleLinePrefix(view, "### "),
  },
  {
    id: "bullet-list",
    title: "Bullet list",
    group: "List",
    run: (view) => toggleLinePrefix(view, "- "),
  },
  {
    id: "numbered-list",
    title: "Numbered list",
    group: "List",
    run: (view) => toggleLinePrefix(view, "1. "),
  },
  {
    id: "task-list",
    title: "Task list",
    group: "List",
    run: (view) => toggleLinePrefix(view, "- [ ] "),
  },
  {
    id: "quote",
    title: "Quote",
    group: "Block",
    run: (view) => toggleLinePrefix(view, "> "),
  },
  {
    id: "code-block",
    title: "Code block",
    group: "Block",
    run: (view) => insertBlock(view, CODE_BLOCK),
  },
  {
    id: "divider",
    title: "Divider",
    group: "Block",
    run: (view) => insertBlock(view, "---"),
  },
];

export const selectionCommands: SelectionCommand[] = [
  {
    id: "bold",
    title: "Bold",
    run: (view) => wrapSelection(view, "**", "**"),
  },
  {
    id: "italic",
    title: "Italic",
    run: (view) => wrapSelection(view, "*", "*"),
  },
  {
    id: "strikethrough",
    title: "Strikethrough",
    run: (view) => wrapSelection(view, "~~", "~~"),
  },
  {
    id: "code",
    title: "Code",
    run: (view) => wrapSelection(view, "`", "`"),
  },
  {
    id: "link",
    title: "Link",
    run: (view) => wrapSelection(view, "[", "](url)"),
  },
];
