use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize)]
struct ConfigFile {
    notes_dir: String,
}

pub fn load_dir(config_path: &Path) -> Option<PathBuf> {
    let text = std::fs::read_to_string(config_path).ok()?;
    let cfg: ConfigFile = serde_json::from_str(&text).ok()?;
    Some(PathBuf::from(cfg.notes_dir))
}

pub fn save_dir(config_path: &Path, dir: &Path) -> std::io::Result<()> {
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let cfg = ConfigFile {
        notes_dir: dir.to_string_lossy().into_owned(),
    };
    let json = serde_json::to_string_pretty(&cfg).map_err(std::io::Error::other)?;
    std::fs::write(config_path, json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn save_then_load_roundtrips() {
        let tmp = TempDir::new().unwrap();
        let cfg = tmp.path().join("naan").join("config.json");
        let notes = tmp.path().join("my-notes");
        save_dir(&cfg, &notes).unwrap();
        assert_eq!(load_dir(&cfg), Some(notes));
    }

    #[test]
    fn load_missing_returns_none() {
        let tmp = TempDir::new().unwrap();
        assert_eq!(load_dir(&tmp.path().join("nope.json")), None);
    }
}
