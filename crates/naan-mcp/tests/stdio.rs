//! End-to-end stdio smoke test.
//!
//! Spawns the real `naan-mcp` binary, drives the MCP handshake
//! (`initialize` -> `notifications/initialized`) over newline-delimited
//! JSON-RPC on its stdin/stdout, then calls `tools/call create_note` and
//! `tools/call list_notes` and checks the created note round-trips through
//! both the tool responses and the filesystem.
//!
//! The exact JSON-RPC shapes below were confirmed by piping this JSON at the
//! built binary directly (see the Task 3 report for the transcript):
//! - `initialize` result carries `protocolVersion`, `capabilities`,
//!   `serverInfo`, `instructions` and is a single line of JSON.
//! - `tools/call` result is `{"content":[{"type":"text","text":"<json>"}],
//!   "isError":false}`, also a single line.

use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tempfile::TempDir;

/// Write one JSON-RPC message followed by a newline (rmcp's stdio transport
/// frames one message per line).
fn send(stdin: &mut impl Write, msg: &str) {
    stdin.write_all(msg.as_bytes()).unwrap();
    stdin.write_all(b"\n").unwrap();
    stdin.flush().unwrap();
}

/// Read lines until one contains `"id":<id>` (as a top-level response id),
/// skipping any notifications/log lines the server may interleave. Panics if
/// no such line shows up within the timeout, so a broken server fails loudly.
fn recv_response(stdout: &mut impl BufRead, id: u64) -> String {
    let needle = format!("\"id\":{id}");
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        assert!(
            Instant::now() < deadline,
            "timed out waiting for id {id} response"
        );
        let mut line = String::new();
        let n = stdout.read_line(&mut line).unwrap();
        assert_ne!(n, 0, "server stdout closed before id {id} response arrived");
        if line.contains(&needle) {
            return line;
        }
    }
}

#[test]
fn create_then_list_over_stdio() {
    let dir = TempDir::new().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_naan-mcp"))
        .arg("--notes-dir")
        .arg(dir.path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();

    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = BufReader::new(child.stdout.take().unwrap());

    // 1) initialize
    send(
        &mut stdin,
        r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}"#,
    );
    let init_line = recv_response(&mut stdout, 1);
    assert!(
        init_line.contains("\"result\""),
        "initialize response: {init_line}"
    );
    assert!(
        init_line.contains("\"naan-mcp\""),
        "initialize response should advertise the naan-mcp server name: {init_line}"
    );

    // 2) notifications/initialized (no response expected)
    send(
        &mut stdin,
        r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
    );

    // 3) tools/call create_note
    send(
        &mut stdin,
        r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_note","arguments":{"title":"Hello","body":"world"}}}"#,
    );
    let create_line = recv_response(&mut stdout, 2);
    assert!(
        create_line.contains("\"isError\":false"),
        "create_note response should not be an error: {create_line}"
    );
    assert!(
        create_line.contains("Hello"),
        "create_note response: {create_line}"
    );

    // 4) tools/call list_notes
    send(
        &mut stdin,
        r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_notes","arguments":{}}}"#,
    );
    let list_line = recv_response(&mut stdout, 3);
    assert!(
        list_line.contains("\"isError\":false"),
        "list_notes response should not be an error: {list_line}"
    );
    assert!(
        list_line.contains("Hello"),
        "list_notes response: {list_line}"
    );

    drop(stdin);
    let _ = child.wait();

    // The note the server reported must actually exist as a real .md file.
    let md_files: Vec<_> = std::fs::read_dir(dir.path())
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "md"))
        .collect();
    assert_eq!(
        md_files.len(),
        1,
        "expected exactly one .md note file in {:?}, found {:?}",
        dir.path(),
        md_files
    );
    let contents = std::fs::read_to_string(md_files[0].path()).unwrap();
    assert!(
        contents.contains("Hello") && contents.contains("world"),
        "note file should contain the title and body: {contents}"
    );
}
