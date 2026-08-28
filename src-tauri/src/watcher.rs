use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Type alias hiding the concrete generic debouncer type so it can be stored in `AppState`.
pub type NotesWatcher =
    Debouncer<notify::RecommendedWatcher, notify_debouncer_full::RecommendedCache>;

/// Starts a debounced watcher on `dir` that emits `"notes-changed"` (no payload)
/// to all windows on any successfully-debounced filesystem event.
pub fn watch(app: AppHandle, dir: &Path) -> Result<NotesWatcher, String> {
    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        None,
        move |res: DebounceEventResult| {
            if res.is_ok() {
                // ignore emit errors (e.g. no window yet)
                let _ = app.emit("notes-changed", ());
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    Ok(debouncer)
}
