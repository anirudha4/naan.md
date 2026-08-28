# Phase 5: CodeMirror Editor — Slash + Selection Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the plain textarea with a CodeMirror 6 editor that renders Markdown with live inline styling and offers two bubble UIs — a **slash-command bubble** (`/` at the caret opens a filterable command menu that inserts block syntax) and a **selection bubble** (selecting text shows a floating menu that wraps it in inline markdown). No toolbar. Commands come from a plug-n-play registry (data + a `run` fn).

**Architecture:** A `features/editor/` module: a React wrapper around a raw CodeMirror 6 `EditorView` (`@codemirror/*`), a live-markdown theme, a command registry (`commands.ts`, with pure, testable transform helpers), and two bubble components positioned from CodeMirror caret/selection coordinates and rendered via portals. The editor exposes `value`/`onChange` and slots into the existing `EditorPane`. All backend access stays in the shell via `notesApi` — the editor is pure UI over a string.

**Tech Stack:** CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown`, `@lezer/highlight`), React 19 + TS, Tailwind, `motion` (subtle bubble transitions).

**Spec:** `docs/superpowers/specs/2026-08-28-naan-notes-design.md` (§9 the editor)

## Global Constraints

- **Functional, correct behavior over pixel polish.** The bubbles must WORK (open at the right place, filter, insert/format correctly, keyboard-navigable, dismiss on Esc/blur). Visual polish is the user's later pass — don't over-invest in styling, but DO get the interaction right (this is the spec's highest-effort area, §9).
- **No toolbar.** The only formatting affordances are the slash bubble and the selection bubble.
- Commands are a **registry**: an array/record of `{ id, title, group, icon?, run(view) }` — adding a command = adding a data entry (spec §7 plug-n-play; §9).
- CodeMirror is the source of truth for text; it stays valid Markdown (no lossy round-trip). Bubbles dispatch CM transactions.
- The editor is pure UI over a `value: string` + `onChange(value)`. NO `notesApi`/`invoke` in `features/editor/` — the shell still owns persistence.
- CodeMirror 6's exact current API (packages, `EditorView`/`EditorState`, `ViewPlugin`, `coordsAtPos`, `keymap`, `Decoration`, `syntaxHighlighting`/`HighlightStyle`, markdown language + `Tag`s) MUST be confirmed via the context7 docs tool before coding each CM-dependent task — adapt sample shapes to the real API.
- `npm run build` (strict tsc + vite) clean; Rust untouched. Command-transform helpers get real unit tests (headless `EditorState`); the DOM/bubble parts are verified by `npm run build` + a controller launch smoke.
- Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

---

## File Structure

```
package.json                          MODIFY  # add @codemirror/* + @lezer/highlight
src/features/editor/
  CodeMirrorEditor.tsx                CREATE  # React wrapper over EditorView (value/onChange)
  theme.ts                            CREATE  # live-markdown HighlightStyle + EditorView.theme
  transforms.ts                       CREATE  # pure transform helpers (testable): wrapSelection, insertBlock, toggleLinePrefix
  transforms.test.ts                  CREATE  # unit tests over headless EditorState
  commands.ts                         CREATE  # command registry (slash + selection groups) using transforms
  SlashMenu.tsx                       CREATE  # slash-command bubble (filter + keyboard nav)
  SelectionBubble.tsx                 CREATE  # selection floating format menu
  useEditorBubbles.ts                 CREATE  # CM ViewPlugin/update wiring → React state for both bubbles
src/features/notes/EditorPane.tsx     MODIFY  # swap <textarea> for <CodeMirrorEditor>
vitest.config.ts / package.json       MODIFY  # add vitest for the transforms unit test (dev-only)
```

(If adding vitest is heavier than warranted, the transforms test may instead be a tiny node script asserting with `assert` — but a real `*.test.ts` under vitest is preferred. Confirm the lightest setup.)

---

## Task 1: CodeMirror deps + editor component + live-markdown theme + wire into EditorPane

**REQUIRED:** confirm the current CodeMirror 6 setup via context7 (`resolve-library-id` "codemirror" / "@codemirror/view" → query "EditorView EditorState basicSetup markdown language HighlightStyle syntaxHighlighting React integration updateListener"). Pin versions cargo/npm resolves.

**Files:** `package.json`, `src/features/editor/{CodeMirrorEditor.tsx, theme.ts}`, `src/features/notes/EditorPane.tsx`

- [ ] **Step 1: Install** — `npm install @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/lang-markdown @lezer/highlight` (add the meta `codemirror` package too if the confirmed setup uses `basicSetup`).

- [ ] **Step 2: `theme.ts`** — a `HighlightStyle.define([...])` mapping markdown Lezer tags (headings, strong, emphasis, strikethrough, list, quote, code, link) to Tailwind-ish inline styles (bigger/bolder headings, bold/italic, monospace code), wrapped via `syntaxHighlighting(...)`, plus an `EditorView.theme({...})` for editor chrome (padding, font, focus outline off). This gives the "live markdown" feel (styled tokens, text stays markdown). NOTE: full syntax-hiding live-preview is out of scope — styled-markdown is the target; leave a comment saying so.

- [ ] **Step 3: `CodeMirrorEditor.tsx`** — a React component: `{ value: string; onChange: (v: string) => void; extensions?: Extension[] }`. Creates an `EditorView` in a `useEffect` (once), with markdown language + the theme + an `EditorView.updateListener` that calls `onChange` on doc changes + any `extensions` passed in (Tasks 3/4 pass the bubble extensions). Reconciles external `value` changes into the view (dispatch a replace transaction only when `value !== view.state.doc.toString()`, to avoid loops). Cleans up the view on unmount. Expose the `EditorView` via a ref/callback for the bubble layer.

- [ ] **Step 4: Wire into `EditorPane.tsx`** — replace the `<textarea>` with `<CodeMirrorEditor value={body} onChange={onBodyChange} />`. Keep the title `Input` + Save `Button` as-is.

- [ ] **Step 5: Verify** — `npm run build` clean. (Controller smoke later confirms typing/rendering.)

- [ ] **Step 6: Commit** — `feat(editor): CodeMirror 6 editor with live-markdown theme, wired into EditorPane`.

---

## Task 2: Command registry + pure transform helpers (TDD)

**Files:** `src/features/editor/{transforms.ts, transforms.test.ts, commands.ts}`; test tooling (vitest) in `package.json`.

**Interfaces:**
- `transforms.ts` (pure, take/return CM `EditorState`/`Transaction` specs so they're testable headlessly):
  - `wrapSelection(view, before, after)` — wrap the current selection with `before`/`after` (e.g. `**`/`**`); if empty selection, insert the pair and place cursor between. Provide a pure `wrapSelectionSpec(state, before, after) -> TransactionSpec` that the view fn dispatches, so the spec is unit-testable.
  - `toggleLinePrefix(view, prefix)` — add/remove a line prefix (e.g. `# `, `- `, `> `) on the selected lines. Pure `toggleLinePrefixSpec(state, prefix)`.
  - `insertBlock(view, text)` — insert a block at the cursor on its own line (e.g. a divider `---`, or a fenced code block). Pure spec variant.
- `commands.ts`:
  - `SlashCommand = { id, title, group?: string, run(view: EditorView): void }` and the slash registry (H1/H2/H3 via `toggleLinePrefix("# "/"## "/"### ")`, bullet `- `, numbered `1. `, task `- [ ] `, quote `> `, code block ```` ``` ````, divider `---`).
  - `SelectionCommand = { id, title, run(view): void }` and the selection registry (bold `**`, italic `*`, strikethrough `~~`, inline code `` ` ``, link `[..](url)` via wrapSelection).

- [ ] **Step 1: Add vitest** — `npm install -D vitest`; add a `"test": "vitest run"` script (and a minimal `vitest.config.ts` if needed). Confirm the lightest config via context7 if unsure.

- [ ] **Step 2: Write failing tests** — `transforms.test.ts` builds a headless `EditorState` (from `@codemirror/state`, `EditorState.create({ doc, selection })`), applies each spec via `state.update(spec)`, and asserts the resulting `doc.toString()` + selection:
  - wrap non-empty selection `"hi"` with `**` → `"**hi**"`.
  - wrap empty selection with `**` → `"****"` with cursor between the pairs.
  - toggleLinePrefix `"# "` on a line without it adds it; applying again removes it.
  - insertBlock a divider on its own line.

- [ ] **Step 3: Run tests → fail.** `npm test`.

- [ ] **Step 4: Implement `transforms.ts` + `commands.ts`** to pass. Keep the view-level fns thin wrappers over the pure spec fns (`view.dispatch(specFn(view.state, ...))`).

- [ ] **Step 5: Run tests → pass; `npm run build` clean.**

- [ ] **Step 6: Commit** — `feat(editor): command registry + tested markdown transform helpers`.

---

## Task 3: Slash-command bubble

**REQUIRED:** confirm via context7 the CM APIs for: an update/`ViewPlugin` to detect the trigger, `view.coordsAtPos(pos)` for caret pixel coords, and a `keymap` (high precedence) to intercept Arrow/Enter/Esc while the menu is open.

**Files:** `src/features/editor/{useEditorBubbles.ts (slash part), SlashMenu.tsx}`; `CodeMirrorEditor.tsx` (mount the menu + pass the extension).

- [ ] **Step 1: Trigger detection** — a pure helper `detectSlash(state) -> { from, query } | null`: cursor at line start OR preceded by whitespace, with a `/` then word chars up to the cursor. Unit-test this pure helper (add to `transforms.test.ts` or a sibling): `"/"` → query `""`; `"text /he"` → `"he"`; `"a/b"` (no leading space) → null. (This IS testable headlessly — do it.)

- [ ] **Step 2: Wiring** — a CM `updateListener`/`ViewPlugin` calls `detectSlash`; when non-null, compute `coordsAtPos(cursor)` and set React state `{ query, coords, from }`; when null, clear it. A high-precedence `keymap` (active only when the menu is open) handles ArrowUp/Down (move highlight), Enter (run highlighted command, first removing the `/query` text via a transaction from `from` to cursor), Esc (close).

- [ ] **Step 3: `SlashMenu.tsx`** — a portal-rendered, absolutely-positioned menu at `coords`, listing the slash registry filtered by `query` (case-insensitive `title` match), highlighting the active index, click-to-run. Subtle `motion` fade/scale. Running a command removes the `/query` text then calls `command.run(view)`.

- [ ] **Step 4: Verify** — `npm run build` clean; the trigger-detection unit tests pass.

- [ ] **Step 5: Commit** — `feat(editor): slash-command bubble`.

---

## Task 4: Selection bubble

**REQUIRED:** confirm via context7 CM APIs for detecting selection changes (`update.selectionSet`/`state.selection`) and getting selection pixel coords (`coordsAtPos` of the range head/anchor).

**Files:** `src/features/editor/{useEditorBubbles.ts (selection part), SelectionBubble.tsx}`; `CodeMirrorEditor.tsx`.

- [ ] **Step 1: Wiring** — on update, if the selection is non-empty, compute coords for the selection (e.g. midpoint above the range) and set React state `{ coords }`; if empty, clear. Hide while the slash menu is open.

- [ ] **Step 2: `SelectionBubble.tsx`** — a portal-rendered floating menu above the selection with the selection-command registry (bold/italic/strike/code/link), each `run(view)` wrapping the selection via the tested `wrapSelection`. Keep it open across the format action (selection is preserved by the transform). Subtle `motion`. Dismiss when selection clears or on Esc.

- [ ] **Step 3: Verify** — `npm run build` clean.

- [ ] **Step 4: Commit** — `feat(editor): selection formatting bubble`.

---

## Task 5: Integration — build, smoke, docs

- [ ] **Step 1: Gates** — `npm test` (transform + detect tests green); `npm run build` clean; `cargo build -p naan` sanity (unchanged).

- [ ] **Step 2: Controller launch smoke** (controller, not a subagent): `npm run tauri dev`; type in a note; confirm markdown styles inline; type `/` → slash menu opens, filters, inserting e.g. "Heading 1" adds `# `; select text → selection bubble appears, "Bold" wraps in `**`; Esc/click-away dismiss; body persists on Save. (Controller verifies after the task; the subagent ensures the build passes.)

- [ ] **Step 3: README** — one short line under a "Editor" note: slash `/` for block commands, select text for formatting. Commit.

---

## Done when

- `npm run build` clean; `npm test` green (transform + slash-detect unit tests).
- The editor is CodeMirror 6 with live-markdown styling; `/` opens a filterable command bubble that inserts block syntax; selecting text opens a bubble that wraps it in inline markdown; both are keyboard-navigable and dismiss cleanly; no toolbar.
- Commands live in a data registry (adding one = adding an entry). The editor is pure UI over `value`/`onChange`; persistence stays in the shell via `notesApi`.
- Interaction is correct and functional; fine visual polish is left to the user's pass.
