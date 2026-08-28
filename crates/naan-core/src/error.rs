use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("yaml error: {0}")]
    Yaml(#[from] serde_yaml_ng::Error),
    #[error("note not found: {0}")]
    NotFound(String),
    #[error("invalid note: {0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;
