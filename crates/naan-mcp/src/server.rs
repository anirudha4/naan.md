//! rmcp stdio server exposing the six note tools over `Notes`.
//!
//! Each tool calls the pure `Notes` adapter, serializes the `Ok` value to JSON
//! text, and maps a `naan_core::Error` to a tool-level `CallToolResult::error`
//! carrying the message (rmcp's recommended shape for functional failures, so
//! the client renders the reason). Handlers never panic.

use crate::notes::Notes;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock, ErrorData, ServerCapabilities, ServerInfo};
use rmcp::{tool, tool_handler, tool_router, ServerHandler, ServiceExt};
use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Deserialize, JsonSchema)]
pub struct IdArg {
    /// The note id.
    pub id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SearchArg {
    /// Free-text query matched against title and body.
    pub text: String,
    /// Optional tags; a note must carry all of them to match.
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CreateArg {
    /// The note title.
    pub title: String,
    /// The note body (markdown). Defaults to empty.
    #[serde(default)]
    pub body: String,
    /// Optional tags.
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct UpdateArg {
    /// The id of the note to update.
    pub id: String,
    /// New title, if changing.
    pub title: Option<String>,
    /// New body, if changing.
    pub body: Option<String>,
    /// New tags, if changing (replaces the existing set).
    pub tags: Option<Vec<String>>,
}

/// The MCP server: owns the notes adapter and the generated tool router.
pub struct NaanServer {
    notes: Notes,
    tool_router: rmcp::handler::server::router::tool::ToolRouter<NaanServer>,
}

/// Serialize an `Ok` value to JSON text content, or a protocol-level internal
/// error if serialization itself fails (never happens for our plain structs).
fn json_ok<T: Serialize>(value: &T) -> Result<CallToolResult, ErrorData> {
    match serde_json::to_string(value) {
        Ok(s) => Ok(CallToolResult::success(vec![ContentBlock::text(s)])),
        Err(e) => Err(ErrorData::internal_error(e.to_string(), None)),
    }
}

/// Map a `naan_core::Error` to a tool-level error result carrying the message.
fn tool_err(e: &naan_core::Error) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(e.to_string())])
}

#[tool_router]
impl NaanServer {
    pub fn new(notes: Notes) -> Self {
        NaanServer {
            notes,
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "List all notes with their id, title, tags and timestamps.")]
    fn list_notes(&self) -> Result<CallToolResult, ErrorData> {
        match self.notes.list() {
            Ok(v) => json_ok(&v),
            Err(e) => Ok(tool_err(&e)),
        }
    }

    #[tool(description = "Read one note in full (including its body) by id.")]
    fn read_note(&self, Parameters(arg): Parameters<IdArg>) -> Result<CallToolResult, ErrorData> {
        match self.notes.read(&arg.id) {
            Ok(v) => json_ok(&v),
            Err(e) => Ok(tool_err(&e)),
        }
    }

    #[tool(description = "Search notes by free text and optional tags.")]
    fn search_notes(
        &self,
        Parameters(arg): Parameters<SearchArg>,
    ) -> Result<CallToolResult, ErrorData> {
        match self.notes.search(&arg.text, arg.tags) {
            Ok(v) => json_ok(&v),
            Err(e) => Ok(tool_err(&e)),
        }
    }

    #[tool(description = "Create a note from a title and optional body and tags.")]
    fn create_note(
        &self,
        Parameters(arg): Parameters<CreateArg>,
    ) -> Result<CallToolResult, ErrorData> {
        match self.notes.create(arg.title, arg.body, arg.tags) {
            Ok(v) => json_ok(&v),
            Err(e) => Ok(tool_err(&e)),
        }
    }

    #[tool(description = "Update a note's title, body and/or tags by id.")]
    fn update_note(
        &self,
        Parameters(arg): Parameters<UpdateArg>,
    ) -> Result<CallToolResult, ErrorData> {
        match self.notes.update(&arg.id, arg.title, arg.body, arg.tags) {
            Ok(v) => json_ok(&v),
            Err(e) => Ok(tool_err(&e)),
        }
    }

    #[tool(description = "Delete a note by id. Returns {\"ok\":true} on success.")]
    fn delete_note(&self, Parameters(arg): Parameters<IdArg>) -> Result<CallToolResult, ErrorData> {
        match self.notes.delete(&arg.id) {
            Ok(()) => json_ok(&serde_json::json!({ "ok": true })),
            Err(e) => Ok(tool_err(&e)),
        }
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for NaanServer {
    fn get_info(&self) -> ServerInfo {
        // `Implementation` is `#[non_exhaustive]`, so it can't be built with a
        // struct literal from this crate; mutate the fields of the instance
        // `ServerInfo::new` already gives us. Its default (`from_build_env()`)
        // reports rmcp's own crate name/version rather than ours, so override
        // both explicitly here.
        let mut info = ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(
                "naan notes server: list, read, search, create, update and delete notes.",
            );
        info.server_info.name = "naan-mcp".to_string();
        info.server_info.version = env!("CARGO_PKG_VERSION").to_string();
        info
    }
}

/// Serve the given server over stdio and block until the peer disconnects.
pub async fn run_stdio(server: NaanServer) -> Result<(), Box<dyn std::error::Error>> {
    let service = server.serve(rmcp::transport::stdio()).await?;
    service.waiting().await?;
    Ok(())
}
