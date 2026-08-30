import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SlashList, type SlashListHandle } from "./SlashList";
import { filterSlashItems, type SlashItem } from "./slashCommands";

const MARGIN = 10; // keep this far from the viewport edge

/**
 * Slash-command extension. Typing `/` opens a menu at the caret; picking an
 * item deletes the typed `/query` and runs a real Tiptap command.
 *
 * We render + position the popup ourselves (portal into <body>, fixed at the
 * caret) with direction/boundary awareness: it opens below the caret, flips
 * above when there isn't room, and clamps horizontally so it never spills off
 * screen. (Suggestion's managed `mount` didn't place reliably in the webview.)
 */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        allowedPrefixes: null,
        command: ({ editor, range, props }) => props.run(editor, range),
        items: ({ query }) => filterSlashItems(query),
        render: () => {
          let component: ReactRenderer<SlashListHandle> | null = null;

          const place = (getRect?: (() => DOMRect | null) | null) => {
            const el = component?.element as HTMLElement | undefined;
            const rect = getRect?.();
            if (!el || !rect) return;
            el.style.position = "fixed";
            el.style.zIndex = "1000";
            // First-frame guess so it never flashes at (0,0)…
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.bottom + 6}px`;

            // …then measure the *rendered* popup and become boundary aware.
            // ReactRenderer paints asynchronously, so retry until it has size,
            // otherwise the vertical flip decision runs against height 0.
            let tries = 0;
            const adjust = () => {
              if (!component) return;
              const m = el.getBoundingClientRect();
              if (m.height < 8 && tries++ < 10) {
                requestAnimationFrame(adjust);
                return;
              }
              const vw = window.innerWidth;
              const vh = window.innerHeight;

              const left = Math.max(MARGIN, Math.min(rect.left, vw - m.width - MARGIN));

              const spaceBelow = vh - rect.bottom - MARGIN;
              const spaceAbove = rect.top - MARGIN;
              const openAbove = m.height + 6 > spaceBelow && spaceAbove > spaceBelow;
              const top = openAbove ? Math.max(MARGIN, rect.top - m.height - 6) : rect.bottom + 6;

              el.style.left = `${left}px`;
              el.style.top = `${top}px`;
            };
            requestAnimationFrame(adjust);
          };

          const teardown = () => {
            component?.element.remove();
            component?.destroy();
            component = null;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashList, { props, editor: props.editor });
              document.body.appendChild(component.element);
              place(props.clientRect);
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              place(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                teardown();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: teardown,
          };
        },
      }),
    ];
  },
});
