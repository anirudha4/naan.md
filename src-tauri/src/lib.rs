mod commands;
mod config;
mod dto;
mod service;
mod state;
mod watcher;

use state::AppState;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // config lives in the OS app-config dir
            let config_dir: PathBuf = app.path().app_config_dir()?;
            let config_path = config_dir.join("config.json");
            let saved = config::load_dir(&config_path);

            app.manage(AppState {
                notes_dir: std::sync::Mutex::new(saved),
                config_path,
                watcher: std::sync::Mutex::new(None),
            });

            if let Some(dir) = app.state::<AppState>().current_dir() {
                if let Ok(w) = watcher::watch(app.handle().clone(), &dir) {
                    if let Ok(mut g) = app.state::<AppState>().watcher.lock() {
                        *g = Some(w);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_notes_dir,
            commands::default_notes_dir,
            commands::list_notes,
            commands::get_note,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::search_notes,
            commands::pick_notes_dir,
            commands::set_notes_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
