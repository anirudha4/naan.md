import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { detectSlash, filterSlashCommands } from "./slash";
import type { SlashCommand } from "./commands";

/** Live state of the open slash menu; `null` when the menu is closed. */
export interface SlashMenuState {
  /** Current query typed after the `/`. */
  query: string;
  /** Document position of the `/`, so the query text can be deleted on run. */
  from: number;
  /** Viewport coordinates of the caret (from `coordsAtPos`), for positioning. */
  coords: { left: number; top: number; bottom: number };
}

/** What `useEditorBubbles` hands back to `CodeMirrorEditor`. */
export interface EditorBubbles {
  /** CodeMirror extensions: the slash detector + the menu-only keymap. */
  extensions: Extension[];
  /** Open menu state, or `null` when closed. */
  slash: SlashMenuState | null;
  /** Index of the highlighted command in the filtered list. */
  activeIndex: number;
  /** Highlight a command (e.g. on hover). */
  setActiveIndex: (index: number) => void;
  /** Delete the `/query` text, run the command, close, and refocus. */
  runCommand: (command: SlashCommand) => void;
  /** Close the menu without running anything. */
  closeMenu: () => void;
}

/**
 * Slash-command bubble wiring for the CodeMirror editor.
 *
 * Returns CM extensions plus the React state that drives `SlashMenu`:
 *
 * - An `updateListener` runs the pure `detectSlash` on every doc/selection
 *   change. When it fires, `view.coordsAtPos(cursor)` gives the caret's
 *   viewport coordinates and the menu opens there; otherwise it closes. It also
 *   closes when the editor loses focus.
 * - A `Prec.highest` `keymap` intercepts ArrowUp/ArrowDown/Enter/Escape — but
 *   ONLY while the menu is open. Each handler returns `true` (consuming the key)
 *   only when the menu is open; when it is closed every handler returns `false`,
 *   so normal editing, history, and cursor movement are untouched.
 *
 * The keymap is created once but stays in sync with React state via `stateRef`,
 * so its handlers always see the current menu/query/highlight.
 */
export function useEditorBubbles(viewRef: RefObject<EditorView | null>): EditorBubbles {
  const [slash, setSlash] = useState<SlashMenuState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // The commands the menu is currently showing; the keymap runs the highlighted
  // one and needs to know how many there are for wrap-around navigation.
  const filtered = useMemo(
    () => (slash ? filterSlashCommands(slash.query) : []),
    [slash],
  );

  // Mirror the current state for the create-once keymap handlers to read.
  const stateRef = useRef({ slash, activeIndex, filtered });
  stateRef.current = { slash, activeIndex, filtered };

  const closeMenu = useCallback(() => {
    setSlash(null);
    setActiveIndex(0);
  }, []);

  const runCommand = useCallback(
    (command: SlashCommand) => {
      const view = viewRef.current;
      const current = stateRef.current.slash;
      if (!view || !current) return;
      // First delete the "/query" range (from the slash up to the cursor)...
      const head = view.state.selection.main.head;
      view.dispatch({ changes: { from: current.from, to: head } });
      // ...then run the command against the now-clean state.
      command.run(view);
      closeMenu();
      view.focus();
    },
    [viewRef, closeMenu],
  );

  // Created once: every dependency below (setters, refs, stable callbacks) keeps
  // its identity across renders, so the extensions never need to be rebuilt.
  const extensions = useMemo<Extension[]>(() => {
    const detector = EditorView.updateListener.of((update) => {
      // Blur closes the menu (clicks inside the menu preventDefault the blur).
      if (update.focusChanged && !update.view.hasFocus) {
        closeMenu();
        return;
      }
      if (!update.docChanged && !update.selectionSet) return;

      const detected = detectSlash(update.state);
      if (!detected) {
        closeMenu();
        return;
      }
      const cursor = update.state.selection.main.head;
      const rect = update.view.coordsAtPos(cursor);
      if (!rect) {
        closeMenu();
        return;
      }
      setSlash({
        query: detected.query,
        from: detected.from,
        coords: { left: rect.left, top: rect.top, bottom: rect.bottom },
      });
      setActiveIndex(0);
    });

    const move = (delta: number): boolean => {
      const { slash: open, filtered: list } = stateRef.current;
      if (!open || list.length === 0) return false;
      setActiveIndex((i) => (i + delta + list.length) % list.length);
      return true;
    };

    const menuKeymap = Prec.highest(
      keymap.of([
        { key: "ArrowDown", run: () => move(1) },
        { key: "ArrowUp", run: () => move(-1) },
        {
          key: "Enter",
          run: () => {
            const { slash: open, activeIndex: idx, filtered: list } = stateRef.current;
            if (!open || list.length === 0) return false;
            runCommand(list[idx] ?? list[0]);
            return true;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (!stateRef.current.slash) return false;
            closeMenu();
            return true;
          },
        },
      ]),
    );

    return [detector, menuKeymap];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { extensions, slash, activeIndex, setActiveIndex, runCommand, closeMenu };
}
