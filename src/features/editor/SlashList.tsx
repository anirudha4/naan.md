import { forwardRef, Fragment, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import type { SlashItem } from "./slashCommands";

export interface SlashListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashListProps {
  items: SlashItem[];
  /** Provided by @tiptap/suggestion; selects an item. */
  command: (item: SlashItem) => void;
}

/** Mono glyph per command — the editorial "data layer" as a leading chip. */
const ICONS: Record<string, string> = {
  Text: "¶",
  "Heading 1": "H1",
  "Heading 2": "H2",
  "Heading 3": "H3",
  "Bullet list": "•",
  "Numbered list": "1.",
  "Task list": "☐",
  Quote: "❝",
  "Code block": "</>",
  Divider: "—",
};

/**
 * The slash menu list. Rendered into the popup the SlashCommand extension
 * portals to the caret. Keyboard nav (Arrow/Enter) is exposed via ref so the
 * editor can forward keys while focus stays in the document. Items arrive
 * pre-grouped by insertion order, so we emit a mono section header whenever the
 * group changes; the active index stays flat across groups.
 */
export const SlashList = forwardRef<SlashListHandle, SlashListProps>(function SlashList(
  { items, command },
  ref,
) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [items]);

  // Keep the highlighted option in view during keyboard nav.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        setActive((a) => (a + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((a) => (a - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[active];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  let lastGroup = "";
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slash commands"
      className={cn(
        "w-64 overflow-y-auto rounded-xl border border-line bg-raised p-1.5 text-ink",
        "shadow-[0_16px_50px_-16px_rgba(30,20,8,0.5)]",
        "max-h-[min(22rem,60vh)]",
        "animate-[naan-fade_150ms_var(--ease-out)_both]",
      )}
    >
      {items.length === 0 ? (
        <p className="px-2.5 py-3 text-[13px] text-ink-muted">
          <span className="eyebrow mr-1.5">No match</span>keep typing…
        </p>
      ) : (
        items.map((item, index) => {
          const showHeader = item.group !== lastGroup;
          lastGroup = item.group;
          const isActive = index === active;
          return (
            <Fragment key={item.title}>
              {showHeader && (
                <div className="eyebrow px-2 pb-1 pt-2 first:pt-0.5">{item.group}</div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(index)}
                onClick={() => command(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px]",
                  "transition-colors duration-100 ease-[var(--ease-out)]",
                  isActive ? "bg-gold-tint text-ink" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] leading-none",
                    isActive ? "border-gold/30 bg-paper text-gold" : "border-line bg-paper/60 text-ink-faint",
                  )}
                >
                  {ICONS[item.title] ?? "•"}
                </span>
                <span className="truncate font-medium">{item.title}</span>
              </button>
            </Fragment>
          );
        })
      )}
    </div>
  );
});
