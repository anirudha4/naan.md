import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { EditorPane } from "../features/notes/EditorPane";
import { Sidebar } from "../features/notes/Sidebar";
import { notesApi } from "../lib/notesApi";
import type { NoteMeta } from "../lib/types";

/**
 * Stateful app shell. Owns all state and every call into `notesApi` (the
 * only sanctioned way to reach the Tauri backend), and composes the
 * presentational notes components (Sidebar, EditorPane, ...) built in Tasks
 * 1-3. Replaces the disposable Phase-2 `src/App.tsx`.
 */
export default function App() {
  const [dir, setDir] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoteMeta | null>(null);

  const refresh = useCallback(async () => {
    const list =
      query.trim() || activeTags.length > 0
        ? await notesApi.search({ text: query, tags: activeTags })
        : await notesApi.list();
    setNotes(list);
  }, [query, activeTags]);

  // Always-current ref so the `onNotesChanged` listener (subscribed once
  // per `dir`) refreshes with the latest query/tags without needing to
  // resubscribe on every keystroke.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // First launch: find out whether a notes folder is already configured.
  useEffect(() => {
    notesApi.getNotesDir().then(setDir).catch((e) => {
      console.error(e);
      setError(String(e));
    });
  }, []);

  // Load notes whenever the folder is (re)set or the search/tag filter
  // changes. Clear a stale error banner on success so a prior failure
  // doesn't linger after a subsequent successful load.
  useEffect(() => {
    if (!dir) return;
    refresh()
      .then(() => setError(null))
      .catch((e) => {
        console.error(e);
        setError(String(e));
      });
  }, [dir, refresh]);

  // Subscribe to backend-originated note changes once a folder is set.
  // Keep the promise itself (not a variable assigned inside `.then`) so
  // cleanup can always unlisten even if it runs before `listen()`
  // resolves (e.g. StrictMode mount -> cleanup -> remount), which would
  // otherwise leak a listener.
  useEffect(() => {
    if (!dir) return;
    const unlistenPromise = notesApi.onNotesChanged(() => {
      refreshRef.current().catch((e) => {
        console.error(e);
        setError(String(e));
      });
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [dir]);

  async function handleOpen(id: string) {
    setError(null);
    try {
      const note = await notesApi.get(id);
      setSelectedId(id);
      setTitle(note.title);
      setBody(note.body);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    setError(null);
    try {
      await notesApi.update(selectedId, { title, body });
      await refresh();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function handleNewNote() {
    setError(null);
    try {
      const meta = await notesApi.create({ title: "Untitled", body: "", tags: [] });
      await refresh();
      await handleOpen(meta.id);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  function requestDelete(id: string) {
    setError(null);
    const note = notes.find((n) => n.id === id) ?? null;
    setDeleteTarget(note);
  }

  async function handleConfirmDelete(id: string) {
    setError(null);
    try {
      await notesApi.remove(id);
      if (selectedId === id) {
        setSelectedId(null);
        setTitle("");
        setBody("");
      }
      await refresh();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  function handleToggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function useFolder(dirPath: string) {
    setError(null);
    try {
      await notesApi.setNotesDir(dirPath);
      setDir(dirPath);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function handleChooseFolder() {
    setError(null);
    try {
      const picked = await notesApi.pickNotesDir();
      if (!picked) return; // cancelled — stay on the setup screen
      await useFolder(picked);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function handleUseDefaultFolder() {
    setError(null);
    try {
      const dirPath = await notesApi.defaultNotesDir();
      await useFolder(dirPath);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  if (!dir) {
    return (
      <main className="flex h-screen flex-col items-start gap-3 p-12">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">naan</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose a folder to keep your notes in.
        </p>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleChooseFolder}>Choose folder</Button>
          <Button variant="ghost" onClick={handleUseDefaultFolder}>
            Use ~/Documents/naan
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen">
      <Sidebar
        notes={notes}
        selectedId={selectedId}
        query={query}
        onQueryChange={setQuery}
        activeTags={activeTags}
        onToggleTag={handleToggleTag}
        onOpen={handleOpen}
        onDelete={requestDelete}
        onNewNote={handleNewNote}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
        <EditorPane
          title={title}
          body={body}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          onSave={handleSave}
          selected={selectedId !== null}
          className="flex-1"
        />
      </div>
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete note"
        onConfirm={() => {
          if (deleteTarget) void handleConfirmDelete(deleteTarget.id);
        }}
        confirmLabel="Delete"
        danger
      >
        {deleteTarget ? `Delete "${deleteTarget.title || "Untitled"}"? This can't be undone.` : ""}
      </Dialog>
    </main>
  );
}
