use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub notes_dir: Mutex<Option<PathBuf>>,
    #[allow(dead_code)] // transient: read by set_notes_dir in Task 6
    pub config_path: PathBuf,
}

impl AppState {
    pub fn current_dir(&self) -> Option<PathBuf> {
        self.notes_dir.lock().ok().and_then(|g| g.clone())
    }

    #[allow(dead_code)] // transient: called by set_notes_dir in Task 6
    pub fn set_dir(&self, dir: PathBuf) {
        if let Ok(mut g) = self.notes_dir.lock() {
            *g = Some(dir);
        }
    }
}
