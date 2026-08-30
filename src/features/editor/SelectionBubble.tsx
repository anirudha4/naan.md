import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { cn } from "../../lib/cn";

interface ToolbarItem {
  id: string;
  title: string;
  glyph: ReactNode;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
}

const linkGlyph = (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M10 13a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 1 0-5.66-5.66l-1 1" />
    <path d="M14 11a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66l1-1" />
  </svg>
);

function toggleLink(editor: Editor) {
  if (editor.isActive("link")) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  const url = window.prompt("Link URL");
  if (url) editor.chain().focus().setLink({ href: url }).run();
}

const items: ToolbarItem[] = [
  { id: "bold", title: "Bold", glyph: <span className="font-bold">B</span>, isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { id: "italic", title: "Italic", glyph: <span className="italic">I</span>, isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { id: "strike", title: "Strikethrough", glyph: <span className="line-through">S</span>, isActive: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
  { id: "code", title: "Code", glyph: <span className="font-mono text-[12px]">{"</>"}</span>, isActive: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
  { id: "link", title: "Link", glyph: linkGlyph, isActive: (e) => e.isActive("link"), run: toggleLink },
];

/**
 * Contents of the selection BubbleMenu — an editorial glyph toolbar. Tiptap's
 * BubbleMenu handles positioning + show-on-selection; this just renders the
 * inline-format controls and reflects their active state.
 */
export function SelectionToolbar({ editor }: { editor: Editor }) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-line bg-raised p-1 text-ink",
        "shadow-[0_12px_44px_-14px_rgba(30,20,8,0.45)]",
        "animate-[naan-fade_140ms_var(--ease-out)_both]",
      )}
    >
      {items.map((item) => {
        const active = item.isActive(editor);
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.title}
            title={item.title}
            onClick={() => item.run(editor)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-[13px]",
              "transition-[transform,background-color,color] duration-120 ease-[var(--ease-out)] active:scale-90",
              active ? "bg-gold-tint text-gold" : "text-ink-muted hover:bg-ink/[0.06] hover:text-ink",
            )}
          >
            {item.glyph}
          </button>
        );
      })}
    </div>
  );
}
