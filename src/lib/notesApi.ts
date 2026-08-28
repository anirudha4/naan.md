import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Note, NoteMeta, NewNoteInput, NotePatchInput, SearchInput } from "./types";

export const notesApi = {
  getNotesDir: () => invoke<string | null>("get_notes_dir"),
  defaultNotesDir: () => invoke<string>("default_notes_dir"),
  pickNotesDir: () => invoke<string | null>("pick_notes_dir"),
  setNotesDir: (dir: string) => invoke<void>("set_notes_dir", { dir }),

  list: () => invoke<NoteMeta[]>("list_notes"),
  get: (id: string) => invoke<Note>("get_note", { id }),
  create: (input: NewNoteInput) => invoke<NoteMeta>("create_note", { input }),
  update: (id: string, patch: NotePatchInput) => invoke<NoteMeta>("update_note", { id, patch }),
  remove: (id: string) => invoke<void>("delete_note", { id }),
  search: (query: SearchInput) => invoke<NoteMeta[]>("search_notes", { query }),

  onNotesChanged: (cb: () => void): Promise<UnlistenFn> =>
    listen("notes-changed", () => cb()),
};
