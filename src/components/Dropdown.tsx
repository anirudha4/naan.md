// Intentionally-staged primitive: an accessible menu foundation with no
// consumer yet. Kept for future note-actions/menus (e.g. per-note context
// menu) — not accidental dead code.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { cn } from "../lib/cn";

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  /**
   * The element that opens the menu (e.g. a `Button` or `IconButton`).
   * Base UI's `Menu.Trigger` clones this element via its `render` prop and
   * merges its own trigger behavior (aria-haspopup, aria-expanded, click
   * handling, ref) onto it — so only a single native `<button>` ends up in
   * the DOM (no nested buttons).
   */
  trigger: React.ReactElement;
  items: DropdownItem[];
  /** Extra classes applied to the menu popup (e.g. to widen it). */
  className?: string;
}

/**
 * Thin, styled wrapper over Base UI `Menu`. Keyboard nav, focus management,
 * and ARIA wiring all come from Base UI; this just supplies Tailwind
 * classes and a simplified `{ label, onSelect, icon? }` item API.
 */
export function Dropdown({ trigger, items, className }: DropdownProps) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start" className="z-50 outline-none">
          <Menu.Popup
            className={cn(
              "min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg outline-none",
              "dark:border-gray-700 dark:bg-gray-800",
              className,
            )}
          >
            {items.map((item, index) => (
              <Menu.Item
                key={index}
                disabled={item.disabled}
                onClick={item.onSelect}
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  "text-gray-900 outline-none dark:text-gray-100",
                  "data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                {item.icon}
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
