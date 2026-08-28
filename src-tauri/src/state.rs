use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub notes_dir: Mutex<Option<PathBuf>>,
    pub config_path: PathBuf,
}

impl AppState {
    pub fn current_dir(&self) -> Option<PathBuf> {
        self.notes_dir.lock().ok().and_then(|g| g.clone())
    }

    pub fn set_dir(&self, dir: PathBuf) {
        if let Ok(mut g) = self.notes_dir.lock() {
            *g = Some(dir);
        }
    }
}
