#![cfg_attr(
    not(test),
    warn(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

mod notes;
mod server;

use std::path::PathBuf;

/// Resolve the notes directory: `--notes-dir <path>`, then `$NAAN_NOTES_DIR`,
/// then `~/Documents/naan`.
fn notes_dir() -> PathBuf {
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        if a == "--notes-dir" {
            if let Some(p) = args.next() {
                return PathBuf::from(p);
            }
        }
    }
    if let Ok(p) = std::env::var("NAAN_NOTES_DIR") {
        return PathBuf::from(p);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join("Documents").join("naan")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = notes_dir();
    std::fs::create_dir_all(&dir)?;
    let server = server::NaanServer::new(notes::Notes::new(dir));
    server::run_stdio(server).await?;
    Ok(())
}
