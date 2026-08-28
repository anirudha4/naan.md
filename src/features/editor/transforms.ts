import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * Pure Markdown transform helpers.
 *
 * Each `*Spec` function takes an `EditorState` and returns a `TransactionSpec`
 * — a plain description of a change, with no DOM and no `EditorView`. That
 * makes them unit-testable headlessly: `EditorState.create({ doc, selection
 * }).update(spec)` (see transforms.test.ts), no browser required.
 *
 * The `wrapSelection`/`toggleLinePrefix`/`insertBlock` wrappers below are the
 * only functions that touch a live `EditorView`, and they are one-liners:
 * `view.dispatch(specFn(view.state, ...))`. Tasks 3/4 (slash menu, selection
 * bubble) call the wrappers; commands.ts wires them into named commands.
 */

/**
 * Wrap each selection range with `before`/`after` (e.g. `**`/`**` for bold).
 *
 * A non-empty range becomes `before + content + after`, with the selection
 * left around `content` only — the inserted marks are not selected. An empty
 * range (a bare cursor) becomes `before + after` with the cursor placed
 * between the two, ready to type the wrapped content.
 */
export function wrapSelectionSpec(
  state: EditorState,
  before: string,
  after: string,
): TransactionSpec {
  return state.changeByRange((range) => {
    if (range.empty) {
      return {
        changes: { from: range.from, insert: before + after },
        range: EditorSelection.cursor(range.from + before.length),
      };
    }
    return {
      changes: [
        { from: range.from, insert: before },
        { from: range.to, insert: after },
      ],
      range: EditorSelection.range(range.from + before.length, range.to + before.length),
    };
  });
}

/** Dispatch `wrapSelectionSpec` against a live view. */
export function wrapSelection(view: EditorView, before: string, after: string): void {
  view.dispatch(wrapSelectionSpec(view.state, before, after));
}

/**
 * Toggle a line prefix (e.g. `# `, `- `, `> `) on every line touched by the
 * selection: a line that already starts with `prefix` has it stripped, a
 * line that doesn't gets it added. Multi-line selections toggle each line
 * independently.
 */
export function toggleLinePrefixSpec(state: EditorState, prefix: string): TransactionSpec {
  return state.changeByRange((range) => {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    const changes: { from: number; to?: number; insert?: string }[] = [];
    for (let n = startLine; n <= endLine; n++) {
      const line = state.doc.line(n);
      if (line.text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length });
      } else {
        changes.push({ from: line.from, insert: prefix });
      }
    }
    const changeSet = state.changes(changes);
    return {
      changes,
      range: EditorSelection.range(changeSet.mapPos(range.from), changeSet.mapPos(range.to)),
    };
  });
}

/** Dispatch `toggleLinePrefixSpec` against a live view. */
export function toggleLinePrefix(view: EditorView, prefix: string): void {
  view.dispatch(toggleLinePrefixSpec(view.state, prefix));
}

/**
 * Insert `text` as its own block at the cursor. A leading newline is added
 * when there's content before the cursor on the current line, and a
 * trailing newline is added when there's content after it — so the block
 * always lands on a fresh line without disturbing surrounding text.
 */
export function insertBlockSpec(state: EditorState, text: string): TransactionSpec {
  const pos = state.selection.main.from;
  const line = state.doc.lineAt(pos);
  const before = pos > line.from ? "\n" : "";
  const after = pos < line.to ? "\n" : "";
  const insert = before + text + after;
  return {
    changes: { from: pos, insert },
    selection: EditorSelection.cursor(pos + insert.length),
  };
}

/** Dispatch `insertBlockSpec` against a live view. */
export function insertBlock(view: EditorView, text: string): void {
  view.dispatch(insertBlockSpec(view.state, text));
}
