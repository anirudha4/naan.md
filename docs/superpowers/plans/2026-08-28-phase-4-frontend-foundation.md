# Phase 4: Frontend Foundation + Notes UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the disposable single-file UI with a real component-driven frontend: Tailwind v4 + Base UI (`@base-ui-components/react`) + `motion` configured, a small set of from-scratch primitive components, and a two-pane app shell (sidebar list + search + tag filter + editor pane) wired to `notesApi`, preserving all existing notes functionality and adding a tag filter.

**Architecture:** Heavy component-driven structure. `src/components/` holds from-scratch primitives wrapping Base UI's unstyled, accessible behavior with Tailwind classes. `src/features/notes/` holds notes-specific components. `src/app/` holds the shell. Components talk to Rust only via `src/lib/notesApi.ts` (the existing seam). Editor stays a plain textarea in this phase — the CodeMirror slash/selection-bubble editor is Phase 5.

**Tech Stack:** React 19 + TypeScript (strict), Tailwind v4 (`@tailwindcss/vite`), Base UI (`@base-ui-components/react`), `motion`, `clsx` + `tailwind-merge` (a `cn()` helper).

**Spec:** `docs/superpowers/specs/2026-08-28-naan-notes-design.md` (§8 frontend architecture)

## Global Constraints

- **Functional, cleanly-structured, NOT visually polished.** Deep visual polish is the user's own later pass — do not over-invest in aesthetics. Build correct structure, semantic/accessible components, sensible plain styling, and stop. (Per user: "we'll do the UI one by one and polish each and every part" later.)
- No UI component library other than Base UI. Build visible components from scratch on Base UI primitives + Tailwind. No Material/Chakra/etc.
- Components access the backend ONLY through `src/lib/notesApi.ts`. Never call `invoke` directly in components.
- Base UI's exact current API (package name, component import paths, Menu/Select/Dialog/Popover parts, positioning/anchor props) MUST be confirmed via the context7 docs tool before building primitives (Task 2) — adapt sample code to the real API; a doc-confirmed adaptation is expected.
- `motion` is `import { motion } from "motion/react"` (the framer-motion successor). Keep animations minimal in this phase.
- Preserve ALL existing functionality: first-launch folder pick (+ default), list, search, create, delete, view/edit (textarea) + Save, live refresh via `onNotesChanged`, error surfacing. ADD: a tag filter.
- Frontend is verified by `npm run build` (strict tsc + vite) + a launch smoke; no automated component tests this phase (deferred, per spec's testing section). Keep `noUnusedLocals`/`noUnusedParameters` clean.
- `cargo`/Rust is untouched this phase. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

---

## File Structure

```
package.json                      MODIFY  # add tailwind, @tailwindcss/vite, base-ui, motion, clsx, tailwind-merge
vite.config.ts                    MODIFY  # add @tailwindcss/vite plugin
src/styles/theme.css              CREATE  # @import "tailwindcss"; minimal tokens
src/main.tsx                      MODIFY  # import the styles entry
src/lib/cn.ts                     CREATE  # clsx + tailwind-merge helper
src/components/                    CREATE  # from-scratch primitives (Base UI + Tailwind)
  Button.tsx, IconButton.tsx, Input.tsx, Dropdown.tsx, Dialog.tsx
src/features/notes/               CREATE
  Sidebar.tsx, SearchBar.tsx, TagFilter.tsx, NoteList.tsx, NoteListItem.tsx, EditorPane.tsx
src/app/App.tsx                   CREATE  # the shell (moved from src/App.tsx)
src/App.tsx                       DELETE  # replaced by src/app/App.tsx (update main.tsx import)
src/App.css                       DELETE  # replaced by Tailwind
```

(If moving `App.tsx` into `src/app/` complicates imports, keeping it at `src/App.tsx` is acceptable — the key is the component decomposition, not the exact folder.)

---

## Task 1: Tooling foundation — Tailwind v4 + deps + `cn`

**Files:** `package.json`, `vite.config.ts`, `src/styles/theme.css`, `src/main.tsx`, `src/lib/cn.ts`

**REQUIRED:** confirm the current Tailwind v4 Vite-plugin setup and the Base UI package via context7 (`resolve-library-id` "tailwindcss" → query "v4 vite plugin install @import", and "@base-ui-components/react" → query "installation Menu Dialog"). Pin versions cargo/npm resolves.

- [ ] **Step 1: Install deps**

```bash
npm install -D tailwindcss @tailwindcss/vite
npm install @base-ui-components/react motion clsx tailwind-merge
```

- [ ] **Step 2: Wire the Tailwind Vite plugin** — `vite.config.ts`: import `tailwindcss from "@tailwindcss/vite"` and add it to `plugins` (alongside the existing react plugin). Do not disturb the tauri-related config (`clearScreen`, `server` port 1420, etc.).

- [ ] **Step 3: Styles entry** — `src/styles/theme.css`:

```css
@import "tailwindcss";

/* Minimal tokens; the user's polish pass refines these. */
:root { color-scheme: light dark; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: system-ui, sans-serif; }
```

`src/main.tsx`: replace the `import "./App.css"` (if present there) / add `import "./styles/theme.css";` before rendering.

- [ ] **Step 4: `cn` helper** — `src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Verify** — `npm run build` compiles clean; a Tailwind class (e.g. add `className="p-4"` to the existing App temporarily) takes effect. Revert any temporary change.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/styles src/lib/cn.ts src/main.tsx
git commit -m "feat(ui): tailwind v4 + base-ui + motion foundation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: From-scratch primitive components (Base UI + Tailwind)

**Files (create):** `src/components/{Button,IconButton,Input,Dropdown,Dialog}.tsx`

**REQUIRED:** confirm the Base UI API for `Menu` (parts: Root/Trigger/Positioner/Popup/Item) and `Dialog` (Root/Trigger/Portal/Backdrop/Popup/Close) via context7 before coding — component/part names and props evolve. Build ONLY these five primitives (YAGNI the rest until a consumer needs them).

- [ ] **Step 1: `Button.tsx` + `IconButton.tsx` + `Input.tsx`** — plain elements styled with Tailwind via `cn()`, forwarding refs + all native props. Small variant set on Button (`default`/`ghost`/`danger`), sizes as needed. No Base UI needed for these (native `<button>`/`<input>`).

- [ ] **Step 2: `Dropdown.tsx`** — a thin, styled wrapper over Base UI `Menu` (Trigger + Positioner + Popup + Items). Props: a trigger node + a list of `{ label, onSelect, icon? }` items. This is the semantic menu primitive the tag filter / note actions use. Accessibility (keyboard, focus, ARIA) comes from Base UI.

- [ ] **Step 3: `Dialog.tsx`** — a thin wrapper over Base UI `Dialog` (Backdrop + Popup + Close), props: `open`, `onOpenChange`, `title`, children, and confirm/cancel actions. Used for delete confirmation.

- [ ] **Step 4: Verify** — `npm run build` clean (no unused-export errors; note these are consumed in Tasks 3-4, so if `noUnusedLocals` complains about a truly unused local inside a file, fix it — exported components are fine unused across files).

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat(ui): from-scratch Button/IconButton/Input/Dropdown/Dialog on base-ui

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Notes feature components

**Files (create):** `src/features/notes/{SearchBar,TagFilter,NoteList,NoteListItem,Sidebar,EditorPane}.tsx`

- [ ] **Step 1: Presentational + wired components** (props-driven; the shell in Task 4 owns state and passes handlers):
  - `SearchBar` — an `Input` bound to a `query` prop + `onQueryChange`.
  - `TagFilter` — given the full note list, derives the unique tag set and renders selectable tag chips (multi-select → `activeTags` + `onToggleTag`). Uses `Button`/`ghost` chips or the `Dropdown`.
  - `NoteListItem` — one note row (title, tags, click to open, a delete `IconButton`); `motion` fade/slide on mount (minimal).
  - `NoteList` — maps metas → `NoteListItem`, empty state.
  - `Sidebar` — composes SearchBar + TagFilter + a "New note" `Button` + `NoteList`.
  - `EditorPane` — title `Input` + body `<textarea>` + Save `Button` (the CodeMirror editor replaces this in Phase 5); shows a placeholder when no note is selected.

- [ ] **Step 2: Verify** — `npm run build` clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/notes
git commit -m "feat(ui): notes feature components (sidebar, list, tag filter, editor pane)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: App shell — compose + wire to `notesApi`

**Files:** create `src/app/App.tsx`; update `src/main.tsx` import; delete old `src/App.tsx` + `src/App.css`.

- [ ] **Step 1: The shell** — a component that owns all state (dir, notes, selected, title, body, query, activeTags, error), calls `notesApi` for every operation, subscribes to `onNotesChanged` (cleanup on unmount), and composes the folder-pick screen (pick + "use default", per Phase 2's fixed behavior) and the two-pane layout (`Sidebar` | `EditorPane`) with Tailwind. Search + tag filter combine: when `query` or `activeTags` are set, call `notesApi.search({ text: query, tags: activeTags })`, else `list()`. Keep the Phase-2 error handling (try/catch → error banner) and the pick-cancel-stays behavior.

- [ ] **Step 2: main.tsx** — import `App` from `./app/App`.

- [ ] **Step 3: Delete** the old `src/App.tsx` and `src/App.css` (`git rm`).

- [ ] **Step 4: Verify** — `npm run build` clean; no leftover imports of the deleted files.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): component-driven app shell wired to notesApi

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Integration — build + launch smoke + polish-pass notes

**Files:** none required (verification); optionally a short note in `README.md`.

- [ ] **Step 1: Gates** — `npm run build` clean; `cargo build -p naan` clean (unchanged, sanity). Confirm `noUnusedLocals`/`noUnusedParameters` pass.

- [ ] **Step 2: Controller launch smoke** (the controller runs this, not a subagent — a headless agent can't click): `npm run tauri dev`, confirm the app builds + the window renders the new component shell without a blank screen / console error; pick a folder; verify list/search/tag-filter/create/delete/edit still work. (This is verified by the controller after the task; the subagent just ensures the build passes.)

- [ ] **Step 3: Commit any doc note; done.**

---

## Done when

- `npm run build` clean (strict tsc + vite); Tailwind + Base UI + motion configured and used.
- The disposable single-file UI is replaced by a component-driven shell: `components/` primitives on Base UI, `features/notes/` components, `app/` shell, all talking to `notesApi` only.
- All Phase-2 functionality preserved (folder pick/default, list, search, create, delete, view/edit, live refresh, error banner) PLUS a working tag filter.
- Styling is plain-but-clean and clearly a foundation for the user's polish pass — not over-designed.
