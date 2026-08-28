// Temporary: `notes` is a pure adapter exercised only by its own tests until
// Task 2 wires it into the real MCP server entrypoint.
#![allow(dead_code)]

mod notes;

fn main() {
    // Real entrypoint arrives in Task 2.
    eprintln!("naan-mcp: server entrypoint added in Task 2");
}
