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

/** Live state of the selection formatting bubble; `null` when hidden. */
export interface SelectionBubbleState {
  /**
   * Viewport coordinates of the selection's start (`coordsAtPos(from)`); the
   * bubble is drawn just above this point. Viewport-relative, so `position:
   * fixed` needs no scroll math.
   */
  coords: { left: number; top: number };
}

/** What `useEditorBubbles` hands back to `CodeMirrorEditor`. */
export interface EditorBubbles {
  /** CodeMirror extensions: the slash detector + the menu-only keymap. */
  extensions: Extension[];
  /** Open slash-menu state, or `null` when closed. */
  slash: SlashMenuState | null;
  /** Selection-bubble state, or `null` when hidden (empty selection / Escape). */
  selection: SelectionBubbleState | null;
  /** Index of the highlighted command in the filtered list. */
  activeIndex: number;
  /** Highlight a command (e.g. on hover). */
  setActiveIndex: (index: number) => void;
  /** Delete the `/query` text, run the command, close, and refocus. */
  runCommand: (command: SlashCommand) => void;
  /** Close the slash menu without running anything. */
  closeMenu: () => void;
}

/**
 * Slash-command + selection-bubble wiring for the CodeMirror editor.
 *
 * Returns CM extensions plus the React state that drives `SlashMenu` and
 * `SelectionBubble`:
 *
 * - An `updateListener` runs the pure `detectSlash` on every doc/selection
 *   change. When it matches AND the change was typing (`docChanged`),
 *   `view.coordsAtPos(cursor)` gives the caret's viewport coordinates and the
 *   menu opens/updates there; a selection-only match (e.g. clicking the caret
 *   behind `/etc`) leaves the menu as-is rather than opening it. When
 *   `detectSlash` returns null the menu closes. In the
 *   same pass, when there is a non-empty selection and no slash menu, it takes
 *   `coordsAtPos(selection.from)` and opens the selection bubble above that
 *   point; an empty selection (or an open slash menu) hides it. Both close when
 *   the editor loses focus. Slash always wins over the selection bubble.
 * - A `Prec.highest` `keymap` intercepts ArrowUp/ArrowDown/Enter/Escape — but
 *   ONLY while a bubble is open. Each handler returns `true` (consuming the key)
 *   only then; otherwise it returns `false`, so normal editing, history, and
 *   cursor movement are untouched. Escape dismisses whichever bubble is showing.
 *
 * The keymap is created once but stays in sync with React state via `stateRef`,
 * so its handlers always see the current menu/query/highlight.
 */
export function useEditorBubbles(viewRef: RefObject<EditorView | null>): EditorBubbles {
  const [slash, setSlash] = useState<SlashMenuState | null>(null);
  const [selection, setSelection] = useState<SelectionBubbleState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // The commands the menu is currently showing; the keymap runs the highlighted
  // one and needs to know how many there are for wrap-around navigation.
  const filtered = useMemo(
    () => (slash ? filterSlashCommands(slash.query) : []),
    [slash],
  );

  // Mirror the current state for the create-once keymap handlers to read.
  const stateRef = useRef({ slash, selection, activeIndex, filtered });
  stateRef.current = { slash, selection, activeIndex, filtered };

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
      // Blur closes both bubbles (clicks inside a bubble preventDefault the blur).
      if (update.focusChanged && !update.view.hasFocus) {
        closeMenu();
        setSelection(null);
        return;
      }
      if (!update.docChanged && !update.selectionSet) return;

      // Slash menu takes precedence: when it is showing, the selection bubble
      // stays hidden.
      const detected = detectSlash(update.state);
      if (detected) {
        // OPEN/update the menu only in response to typing (docChanged). A
        // selection-only change that happens to land after a `/word` — e.g.
        // clicking the caret behind "/etc" — must NOT open it fresh.
        if (update.docChanged) {
          const cursor = update.state.selection.main.head;
          const rect = update.view.coordsAtPos(cursor);
          if (rect) {
            setSlash({
              query: detected.query,
              from: detected.from,
              coords: { left: rect.left, top: rect.top, bottom: rect.bottom },
            });
            setActiveIndex(0);
            setSelection(null);
            return;
          }
        } else if (stateRef.current.slash) {
          // Selection-only change while the menu is already open (arrow key /
          // click within the query): leave the current slash state as-is. The
          // selection bubble stays hidden while slash is showing.
          return;
        }
        // Otherwise (selection-only with the menu closed, or docChanged with no
        // caret rect) fall through: the slash menu stays closed and we consider
        // the selection bubble instead.
      }
      // No live slash menu here — make sure it is closed, then consider the
      // selection bubble.
      closeMenu();

      const range = update.state.selection.main;
      if (range.empty) {
        setSelection(null);
        return;
      }
      // Anchor the bubble to the start of the selection; the component draws it
      // just above this point.
      const rect = update.view.coordsAtPos(range.from);
      if (!rect) {
        setSelection(null);
        return;
      }
      setSelection({ coords: { left: rect.left, top: rect.top } });
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
            // Escape dismisses whichever bubble is showing (slash first), and is
            // only consumed when one actually is — normal editing keeps Escape.
            if (stateRef.current.slash) {
              closeMenu();
              return true;
            }
            if (stateRef.current.selection) {
              setSelection(null);
              return true;
            }
            return false;
          },
        },
      ]),
    );

    return [detector, menuKeymap];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { extensions, slash, selection, activeIndex, setActiveIndex, runCommand, closeMenu };
}
