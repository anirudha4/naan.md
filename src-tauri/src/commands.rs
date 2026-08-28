use crate::dto::{NewNoteInput, NoteDto, NoteMetaDto, NotePatchInput, SearchInput};
use crate::service::NotesService;
use crate::state::AppState;
use tauri::State;

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
