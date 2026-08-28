use crate::dto::{NewNoteInput, NoteDto, NoteMetaDto, NotePatchInput, SearchInput};
use crate::service::NotesService;
use crate::state::AppState;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

fn service(state: &AppState) -> Result<NotesService, String> {
    state
        .current_dir()
        .map(NotesService::new)
        .ok_or_else(|| "no notes folder selected".to_string())
}

#[tauri::command]
pub fn get_notes_dir(state: State<'_, AppState>) -> Option<String> {
    state
        .current_dir()
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn default_notes_dir() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(home)
        .join("Documents")
        .join("naan")
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<NoteMetaDto>, String> {
    service(&state)?.list().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<NoteDto, String> {
    service(&state)?.get(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, input: NewNoteInput) -> Result<NoteMetaDto, String> {
    service(&state)?.create(input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(
    state: State<'_, AppState>,
    id: String,
    patch: NotePatchInput,
) -> Result<NoteMetaDto, String> {
    service(&state)?
        .update(&id, patch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    service(&state)?.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_notes(
    state: State<'_, AppState>,
    query: SearchInput,
) -> Result<Vec<NoteMetaDto>, String> {
    service(&state)?.search(query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pick_notes_dir(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|p| p.to_string())
}

#[tauri::command]
pub fn set_notes_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    dir: String,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(&dir);
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    crate::config::save_dir(&state.config_path, &path).map_err(|e| e.to_string())?;
    state.set_dir(path.clone());
    match crate::watcher::watch(app.clone(), &path) {
        Ok(w) => {
            if let Ok(mut g) = state.watcher.lock() {
                *g = Some(w); // dropping the old debouncer stops the old watch
            }
        }
        Err(e) => eprintln!(
            "failed to (re)start notes watcher for {}: {e}",
            path.display()
        ),
    }
    Ok(())
}
