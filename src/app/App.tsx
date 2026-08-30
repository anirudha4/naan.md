import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  // changes. Deliberately does NOT clear `error` on success: this refresh
  // can resolve after a concurrent user action's failure has already set
  // the banner, and wiping it would hide a real error. User-initiated
  // handlers (chooseFolder/useFolder/handleSave/handleNewNote/
  // handleConfirmDelete/handleOpen/handleToggleTag/handleQueryChange)
  // already call setError(null) up front, which covers clearing stale
  // errors when the user does something.
  useEffect(() => {
    if (!dir) return;
    refresh().catch((e) => {
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
    setError(null);
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleQueryChange(q: string) {
    setError(null);
    setQuery(q);
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
      <main className="flex h-screen items-center justify-center bg-paper px-8">
        <div className="w-full max-w-sm animate-[naan-rise_600ms_var(--ease-out)_both]">
          <p className="eyebrow mb-3">Local-first notes</p>
          <h1 className="font-sans text-6xl font-semibold leading-none tracking-tight text-ink">
            naan<span className="text-gold">.</span>
          </h1>
          <div className="mt-6 h-px w-full bg-line" />
          <p className="mt-6 text-[15px] leading-relaxed text-ink-muted">
            A quiet place for your words. Every note is a plain Markdown file in a
            folder you choose — yours to keep, sync, and read anywhere.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="mt-8 flex items-center gap-2.5">
            <Button onClick={handleChooseFolder}>Choose folder</Button>
            <Button variant="ghost" onClick={handleUseDefaultFolder}>
              Use ~/Documents/naan
            </Button>
          </div>
          <p className="eyebrow mt-12 text-ink-faint/80">
            Markdown · YAML frontmatter · yours forever
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-paper text-ink">
      <Sidebar
        notes={notes}
        selectedId={selectedId}
        query={query}
        onQueryChange={handleQueryChange}
        activeTags={activeTags}
        onToggleTag={handleToggleTag}
        onOpen={handleOpen}
        onDelete={requestDelete}
        onNewNote={handleNewNote}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="px-8 pt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <EditorPane
          // Remount the editor per note so each note gets a fresh document and
          // a fresh undo history. Without this, one reused EditorView keeps a
          // shared history and the reconcile dispatch that swaps note bodies is
          // undoable — Cmd+Z after switching notes would revert to the previous
          // note's text, fire onChange, and let Save write the wrong content.
          // `selectedId` is stable while editing one note, so typing never
          // remounts; it only changes when you switch notes.
          key={selectedId ?? "none"}
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

/** Editorial error note: a hairline rule, a mono label, the message. */
function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-l-2 border-red-500/60 bg-red-500/[0.05] py-2 pl-3 pr-3 text-[13px] leading-snug"
    >
      <span className="eyebrow mt-px shrink-0 text-red-600! dark:text-red-400!">Error</span>
      <span className="text-ink-muted">{children}</span>
    </div>
  );
}
