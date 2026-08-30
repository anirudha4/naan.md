import type { Editor, Range } from "@tiptap/core";

/**
 * The slash-command registry — data, not UI. Adding a command is one entry.
 * Each `run` deletes the typed `/query` range, then applies a Tiptap command,
 * so the result is real formatting (a heading, a task item, a divider) with no
 * visible Markdown marks.
 */
export interface SlashItem {
  title: string;
  group: "Text" | "List" | "Block";
  aliases?: string[];
  run: (editor: Editor, range: Range) => void;
}

export const slashItems: SlashItem[] = [
  {
    title: "Text",
    group: "Text",
    aliases: ["paragraph", "body"],
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: "Heading 1",
    group: "Text",
    aliases: ["h1", "title"],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    group: "Text",
    aliases: ["h2"],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    group: "Text",
    aliases: ["h3"],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    group: "List",
    aliases: ["ul", "unordered"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    group: "List",
    aliases: ["ol", "ordered"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "Task list",
    group: "List",
    aliases: ["todo", "checkbox", "check"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: "Quote",
    group: "Block",
    aliases: ["blockquote"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    group: "Block",
    aliases: ["code", "fence", "pre"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    group: "Block",
    aliases: ["hr", "rule", "separator"],
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return slashItems;
  return slashItems.filter(
    (i) =>
      i.title.toLowerCase().includes(q) || (i.aliases ?? []).some((a) => a.includes(q)),
  );
}
