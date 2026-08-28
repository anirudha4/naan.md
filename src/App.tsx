import { useCallback, useEffect, useState } from "react";
import { notesApi } from "./lib/notesApi";
import type { NoteMeta } from "./lib/types";
import "./App.css";

export default function App() {
  const [dir, setDir] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (query: string) => {
    const list = query.trim()
      ? await notesApi.search({ text: query, tags: [] })
      : await notesApi.list();
    setNotes(list);
  }, []);

  // initial load
  useEffect(() => {
    notesApi.getNotesDir().then(setDir);
  }, []);

  // load notes + subscribe to external changes once a folder is set
  useEffect(() => {
    if (!dir) return;
    refresh(q);
    const un = notesApi.onNotesChanged(() => refresh(q));
    return () => {
      un.then((f) => f());
    };
  }, [dir, q, refresh]);

  async function openNote(id: string) {
    setError(null);
    try {
      const note = await notesApi.get(id);
      setSelected(id);
      setTitle(note.title);
      setBody(note.body);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function save() {
    if (!selected) return;
    setError(null);
    try {
      await notesApi.update(selected, { title, body });
      await refresh(q);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function newNote() {
    setError(null);
    try {
      const meta = await notesApi.create({ title: "Untitled", body: "", tags: [] });
      await refresh(q);
      await openNote(meta.id);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function del(id: string) {
    setError(null);
    try {
      await notesApi.remove(id);
      if (selected === id) {
        setSelected(null);
        setTitle("");
        setBody("");
      }
      await refresh(q);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
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

  async function chooseFolder() {
    setError(null);
    try {
      const picked = await notesApi.pickNotesDir();
      if (!picked) return; // cancelled — stay on setup
      await useFolder(picked);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function useDefaultFolder() {
    setError(null);
    try {
      await useFolder(await notesApi.defaultNotesDir());
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  if (!dir) {
    return (
      <main className="setup">
        <h1>naan</h1>
        <p>Choose a folder to keep your notes in.</p>
        {error && <div className="error">{error}</div>}
        <button onClick={chooseFolder}>Choose folder</button>
        <button onClick={useDefaultFolder}>Use ~/Documents/naan</button>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="toolbar">
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={newNote}>+ New</button>
        </div>
        {error && <div className="error">{error}</div>}
        <ul className="list">
          {notes.map((n) => (
            <li key={n.id} className={n.id === selected ? "active" : ""}>
              <button className="item" onClick={() => openNote(n.id)}>
                <span className="item-title">{n.title || "Untitled"}</span>
                {n.tags.length > 0 && <span className="item-tags">{n.tags.join(", ")}</span>}
              </button>
              <button className="del" title="Delete" onClick={() => del(n.id)}>
                ×
              </button>
            </li>
          ))}
          {notes.length === 0 && <li className="empty">No notes yet.</li>}
        </ul>
      </aside>

      <section className="editor">
        {selected ? (
          <>
            <input className="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="body" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="actions">
              <button onClick={save}>Save</button>
            </div>
          </>
        ) : (
          <p className="hint">Select a note, or create one.</p>
        )}
      </section>
    </main>
  );
}
