import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { detectSlash, filterSlashCommands } from "./slash";

/**
 * Headless tests for the pure slash-trigger detector: build an `EditorState`
 * (no DOM, no `EditorView`), place the cursor, and assert what `detectSlash`
 * reports. This is what makes the trigger logic unit-testable without a browser.
 */
function stateAt(doc: string, head: number): EditorState {
  return EditorState.create({ doc, selection: EditorSelection.cursor(head) });
}

describe("detectSlash", () => {
  it("fires on a bare slash at the start of the document", () => {
    const state = stateAt("/", 1);
    expect(detectSlash(state)).toEqual({ from: 0, query: "" });
  });

  it("captures the query after a slash that follows whitespace", () => {
    const state = stateAt("note /he", 8);
    expect(detectSlash(state)).toEqual({ from: 5, query: "he" });
  });

  it("does not fire when the slash is not preceded by whitespace", () => {
    const state = stateAt("a/b", 3);
    expect(detectSlash(state)).toBeNull();
  });

  it("does not fire when the query is broken by a space", () => {
    const state = stateAt("/a b", 4);
    expect(detectSlash(state)).toBeNull();
  });

  it("fires at the start of a line after a newline", () => {
    const state = stateAt("one\n/he", 7);
    expect(detectSlash(state)).toEqual({ from: 4, query: "he" });
  });
});

describe("filterSlashCommands", () => {
  it("returns every command for an empty query", () => {
    expect(filterSlashCommands("").length).toBeGreaterThan(0);
  });

  it("matches command titles case-insensitively", () => {
    const result = filterSlashCommands("HEAD");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.title.toLowerCase().includes("head"))).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterSlashCommands("zzzznope")).toEqual([]);
  });
});
