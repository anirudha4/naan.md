import { forwardRef, useEffect, useRef, type ForwardedRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { markdownTheme } from "./theme";

export interface CodeMirrorEditorProps {
  /** Current document text. External changes are reconciled into the view. */
  value: string;
  /** Called with the new document text on every user edit. */
  onChange: (value: string) => void;
  /**
   * Extra CodeMirror extensions, read once when the view is created. Phase 5
   * Tasks 3/4 pass the slash-menu and selection-bubble extensions here. (If a
   * later task needs to swap extensions live, reach for a Compartment.)
   */
  extensions?: Extension[];
  /** Placeholder shown when the document is empty. */
  placeholder?: string;
  /** Accessible label wired onto CodeMirror's editable content element. */
  ariaLabel?: string;
  /** Classes for the wrapper element (border/sizing) — styling stays in Tailwind. */
  className?: string;
}

/** Assign a value to a forwarded ref, whether it is a callback or object ref. */
function setRef<T>(ref: ForwardedRef<T>, value: T): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * CodeMirror 6 editor as a controlled React component over `value`/`onChange`.
 *
 * Pure UI: no `notesApi`/`invoke` here — the parent owns persistence.
 *
 * The classic CM-in-React update loop (onChange -> setState -> value prop ->
 * dispatch -> onChange -> ...) is broken by the `value !== doc` guard in the
 * reconcile effect below: a dispatch only happens when the incoming `value`
 * actually differs from what the view already holds.
 *
 * The underlying `EditorView` is exposed via a forwarded ref so later tasks can
 * anchor the slash/selection bubbles to it.
 */
export const CodeMirrorEditor = forwardRef<EditorView | null, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    { value, onChange, extensions, placeholder, ariaLabel, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Keep the latest onChange without re-creating the view every render.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Mount-time-only inputs: the view is created once, so capture these on
    // first render and read them from refs inside the create-once effect.
    const extensionsRef = useRef(extensions);
    const placeholderRef = useRef(placeholder);
    const ariaLabelRef = useRef(ariaLabel);

    // Create the EditorView once, on mount; destroy it on unmount.
    useEffect(() => {
      const parent = containerRef.current;
      if (!parent) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      });

      const state = EditorState.create({
        // `value` is the *initial* document only; later changes flow through the
        // reconcile effect below, never by re-creating the view.
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          markdown(),
          markdownTheme,
          updateListener,
          ...(placeholderRef.current ? [cmPlaceholder(placeholderRef.current)] : []),
          ...(ariaLabelRef.current
            ? [EditorView.contentAttributes.of({ "aria-label": ariaLabelRef.current })]
            : []),
          ...(extensionsRef.current ?? []),
        ],
      });

      const view = new EditorView({ state, parent });
      viewRef.current = view;
      setRef(ref, view);

      return () => {
        view.destroy();
        viewRef.current = null;
        setRef(ref, null);
      };
      // Create-once: `value` is the initial doc; `ref` identity is stable.
      // Subsequent `value` changes are handled by the reconcile effect below.
    }, []);

    // Reconcile external `value` changes into the view. The `value !== current`
    // guard is what prevents the update loop.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (value === current) return;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }, [value]);

    return <div ref={containerRef} className={className} />;
  },
);

CodeMirrorEditor.displayName = "CodeMirrorEditor";
