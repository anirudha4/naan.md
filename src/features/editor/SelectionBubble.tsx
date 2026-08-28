import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { EditorView } from "@codemirror/view";
import { cn } from "../../lib/cn";
import { selectionCommands } from "./commands";
import type { SelectionBubbleState } from "./useEditorBubbles";

export interface SelectionBubbleProps {
  /** Bubble state (viewport coordinates of the selection start). */
  state: SelectionBubbleState;
  /** The live editor view each command runs against. */
  view: EditorView | null;
}

/**
 * The selection formatting bubble: a small toolbar floating just above a
 * non-empty selection, with the inline `selectionCommands` (bold/italic/
 * strike/code/link). Each button wraps the selection in the matching Markdown
 * via `wrapSelection`, which preserves the selection — so the bubble stays put
 * across the action and repositions from the next `updateListener` pass.
 *
 * Rendered through a portal to `document.body` and positioned `fixed` at the
 * selection's viewport coordinates (`coordsAtPos` is viewport-relative — no
 * scroll math). The outer div does the placement (lifted a full bubble-height
 * plus a gap ABOVE the anchor); the inner `motion.div` owns the entrance
 * animation, so their transforms never fight.
 *
 * `onMouseDown` is prevented so clicking a button does not blur the editor and
 * collapse the selection before the click handler runs. Dismissal is handled by
 * the hook: an empty selection clears the state, and Escape (caught by the
 * editor keymap, since focus never leaves it) hides the bubble too.
 */
export function SelectionBubble({ state, view }: SelectionBubbleProps) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: state.coords.left,
        top: state.coords.top,
        transform: "translateY(calc(-100% - 8px))",
      }}
    >
      <motion.div
        role="toolbar"
        aria-label="Format selection"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "z-50 flex items-center gap-0.5 rounded-md border p-1 shadow-lg",
          "border-gray-200 bg-white text-gray-900",
          "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
        )}
      >
        {selectionCommands.map((command) => (
          <button
            key={command.id}
            type="button"
            onClick={() => {
              if (!view) return;
              command.run(view);
              // Focus never left the editor (mousedown was prevented); this just
              // guards against any edge case that could steal it.
              view.focus();
            }}
            className={cn(
              "rounded px-2 py-1 text-sm",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
            )}
          >
            {command.title}
          </button>
        ))}
      </motion.div>
    </div>,
    document.body,
  );
}
