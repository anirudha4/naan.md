import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

/**
 * Live-markdown highlight style.
 *
 * This is *styled markdown* (a "live preview" feel): the markdown source stays
 * fully visible — you still see and edit the `#`, `**`, `` ` `` and `>` marks —
 * but the tokens are styled, so headings look like headings, bold looks bold,
 * and code is monospace.
 *
 * It is NOT full syntax-hiding live preview (hiding the marks or swapping in
 * rendered widgets). That is intentionally out of scope for this task.
 *
 * Styling is plain/functional here; the polish pass tunes sizes and colours.
 */
const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.6em", fontWeight: "700", lineHeight: "1.3" },
  { tag: t.heading2, fontSize: "1.35em", fontWeight: "700", lineHeight: "1.3" },
  { tag: t.heading3, fontSize: "1.15em", fontWeight: "600", lineHeight: "1.3" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "600" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  {
    // Inline code and fenced code blocks both carry the `monospace` tag.
    tag: t.monospace,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.9em",
  },
  { tag: t.quote, fontStyle: "italic", color: "#6b7280" }, // gray-500
  { tag: t.link, color: "#2563eb", textDecoration: "underline" }, // blue-600
  { tag: t.url, color: "#2563eb" },
  { tag: t.list, color: "#6b7280" },
  // Dim the markdown punctuation/marks (`#`, `*`, `` ` ``, `>`), so styled text
  // stands out while the raw source stays editable.
  { tag: t.processingInstruction, color: "#9ca3af" }, // gray-400
]);

/**
 * Editor chrome: padding, fonts, height, and removing the focus outline (the
 * wrapper element owns the focus ring). Colours inherit from the surrounding
 * app so light/dark mode "just works".
 */
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "0.875rem", // matches text-sm
    color: "inherit",
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "0.75rem", // matches the old textarea's p-3
    caretColor: "currentColor",
  },
  // Remove CodeMirror's default focus outline; the wrapper draws focus styling.
  "&.cm-focused": {
    outline: "none",
  },
});

/** Combined live-markdown styling: chrome theme + syntax highlighting. */
export const markdownTheme: Extension = [editorTheme, syntaxHighlighting(highlightStyle)];
