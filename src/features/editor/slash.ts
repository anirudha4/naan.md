import type { EditorState } from "@codemirror/state";
import { slashCommands, type SlashCommand } from "./commands";

/** Where the slash trigger starts and what has been typed after it. */
export interface SlashDetection {
  /** Document position of the `/` character. */
  from: number;
  /** Word characters typed after the `/`, up to the cursor. */
  query: string;
}

/**
 * Detect a slash-command trigger immediately before the cursor.
 *
 * Fires only when the text before the cursor (on the current line) ends with a
 * `/` that sits at the start of the line or right after whitespace, followed by
 * zero or more word characters — the "query". Returns the document position of
 * the `/` and that query, or `null` when there is no live trigger (e.g. the
 * slash is glued to a word like `a/b`, or a space has broken the query).
 *
 * Pure: reads only the given `EditorState`, no DOM or `EditorView`.
 */
export function detectSlash(state: EditorState): SlashDetection | null {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const before = line.text.slice(0, head - line.from);
  // (start-of-line | whitespace) + "/" + word chars, anchored at the cursor.
  const match = /(?:^|\s)\/(\w*)$/.exec(before);
  if (!match) return null;
  const query = match[1];
  // Offset of the "/" within the match = leading (empty|whitespace) length.
  const slashOffset = match[0].length - query.length - 1;
  return { from: line.from + match.index + slashOffset, query };
}

/** Slash commands whose title contains `query` (case-insensitive). */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return slashCommands.filter((c) => c.title.toLowerCase().includes(q));
}
