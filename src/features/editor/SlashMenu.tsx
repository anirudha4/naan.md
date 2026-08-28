import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { cn } from "../../lib/cn";
import { filterSlashCommands } from "./slash";
import type { SlashCommand } from "./commands";
import type { SlashMenuState } from "./useEditorBubbles";

export interface SlashMenuProps {
  /** Open menu state (query + caret coordinates). */
  state: SlashMenuState;
  /** Index of the highlighted command in the filtered list. */
  activeIndex: number;
  /** Highlight a command (on hover). */
  onActiveIndexChange: (index: number) => void;
  /** Run a command (deletes the `/query` text, then applies it). */
  onRun: (command: SlashCommand) => void;
}

/**
 * The slash-command bubble: a small menu anchored at the caret, listing the
 * commands whose title matches the current query.
 *
 * Rendered through a portal to `document.body` and positioned `fixed` at the
 * caret's viewport coordinates (`coordsAtPos` returns viewport-relative rects,
 * which is exactly what `position: fixed` expects — no scroll math, no magic
 * offsets). `onMouseDown` is prevented so clicking an item does not blur the
 * editor before the click runs.
 */
export function SlashMenu({ state, activeIndex, onActiveIndexChange, onRun }: SlashMenuProps) {
  const commands = filterSlashCommands(state.query);

  return createPortal(
    <motion.div
      role="listbox"
      aria-label="Slash commands"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left: state.coords.left,
        top: state.coords.bottom + 4,
      }}
      className={cn(
        "z-50 max-h-64 w-56 overflow-y-auto rounded-md border p-1 shadow-lg",
        "border-gray-200 bg-white text-gray-900",
        "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
      )}
    >
      {commands.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">No matching commands</p>
      ) : (
        commands.map((command, index) => (
          <button
            key={command.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onRun(command)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm",
              index === activeIndex
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-700",
            )}
          >
            <span className="truncate">{command.title}</span>
            {command.group && (
              <span
                className={cn(
                  "shrink-0 text-xs",
                  index === activeIndex ? "text-blue-100" : "text-gray-400 dark:text-gray-500",
                )}
              >
                {command.group}
              </span>
            )}
          </button>
        ))
      )}
    </motion.div>,
    document.body,
  );
}
