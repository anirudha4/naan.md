import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { insertBlockSpec, toggleLinePrefixSpec, wrapSelectionSpec } from "./transforms";

/**
 * Headless tests: build an `EditorState` (no DOM, no `EditorView`), apply a
 * `*Spec` via `state.update(spec)`, and assert the resulting doc + selection.
 * This is what makes the transforms in transforms.ts unit-testable without a
 * browser.
 */
describe("wrapSelectionSpec", () => {
  it("wraps a non-empty selection", () => {
    const state = EditorState.create({
      doc: "hi",
      selection: EditorSelection.range(0, 2),
    });
    const tr = state.update(wrapSelectionSpec(state, "**", "**"));
    expect(tr.state.doc.toString()).toBe("**hi**");
    expect(tr.state.selection.main.from).toBe(2);
    expect(tr.state.selection.main.to).toBe(4);
  });

  it("wraps an empty selection and places the cursor between the marks", () => {
    const state = EditorState.create({
      doc: "",
      selection: EditorSelection.cursor(0),
    });
    const tr = state.update(wrapSelectionSpec(state, "**", "**"));
    expect(tr.state.doc.toString()).toBe("****");
    expect(tr.state.selection.main.empty).toBe(true);
    expect(tr.state.selection.main.from).toBe(2);
  });

  it("wraps a selection in the middle of a larger document", () => {
    const state = EditorState.create({
      doc: "hello world",
      selection: EditorSelection.range(6, 11),
    });
    const tr = state.update(wrapSelectionSpec(state, "*", "*"));
    expect(tr.state.doc.toString()).toBe("hello *world*");
  });
});

describe("toggleLinePrefixSpec", () => {
  it("adds the prefix to a line that doesn't have it", () => {
    const state = EditorState.create({
      doc: "hello",
      selection: EditorSelection.cursor(0),
    });
    const tr = state.update(toggleLinePrefixSpec(state, "# "));
    expect(tr.state.doc.toString()).toBe("# hello");
  });

  it("removes the prefix when applied again", () => {
    const state = EditorState.create({
      doc: "# hello",
      selection: EditorSelection.cursor(0),
    });
    const tr = state.update(toggleLinePrefixSpec(state, "# "));
    expect(tr.state.doc.toString()).toBe("hello");
  });

  it("toggles every line touched by a multi-line selection", () => {
    const state = EditorState.create({
      doc: "one\ntwo\nthree",
      selection: EditorSelection.range(0, 13),
    });
    const tr = state.update(toggleLinePrefixSpec(state, "> "));
    expect(tr.state.doc.toString()).toBe("> one\n> two\n> three");
  });
});

describe("insertBlockSpec", () => {
  it("inserts a divider on its own line after existing content", () => {
    const state = EditorState.create({
      doc: "hello",
      selection: EditorSelection.cursor(5),
    });
    const tr = state.update(insertBlockSpec(state, "---"));
    expect(tr.state.doc.toString()).toBe("hello\n---");
  });

  it("inserts directly into an empty document without extra newlines", () => {
    const state = EditorState.create({
      doc: "",
      selection: EditorSelection.cursor(0),
    });
    const tr = state.update(insertBlockSpec(state, "---"));
    expect(tr.state.doc.toString()).toBe("---");
  });

  it("splits a line when the cursor sits inside existing content", () => {
    const state = EditorState.create({
      doc: "hello world",
      selection: EditorSelection.cursor(5),
    });
    const tr = state.update(insertBlockSpec(state, "---"));
    expect(tr.state.doc.toString()).toBe("hello\n---\n world");
  });
});
