use crate::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Frontmatter as written to disk (managed notes have every field).
#[derive(Debug, Serialize)]
pub struct Frontmatter {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
}

/// Tolerant parse target: any field may be absent in a hand-written file.
#[derive(Debug, Default, Deserialize)]
pub struct RawFrontmatter {
    pub id: Option<String>,
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
}

/// Split file content into (optional frontmatter, body). Frontmatter must be
/// a leading fenced block: `---\n ... \n---\n`.
pub fn parse(content: &str) -> Result<(Option<RawFrontmatter>, String)> {
    // Detect the opening/closing `---` fence line-endings-agnostically so notes
    // saved with CRLF keep their frontmatter (and thus their ULID identity).
    let mut lines = content.split_inclusive('\n');
    let first = lines.next().unwrap_or("");
    if first.trim_end_matches(['\r', '\n']) == "---" {
        let mut yaml = String::new();
        let mut consumed = first.len();
        let mut closed = false;
        for line in lines {
            consumed += line.len();
            if line.trim_end_matches(['\r', '\n']) == "---" {
                closed = true;
                break;
            }
            yaml.push_str(line);
        }
        if closed {
            let raw: RawFrontmatter = serde_yaml_ng::from_str(&yaml)?;
            // Drop the single blank separator line that `serialize` writes
            // between the closing fence and the body.
            let body = &content[consumed..];
            let body = body
                .strip_prefix("\r\n")
                .or_else(|| body.strip_prefix('\n'))
                .unwrap_or(body);
            return Ok((Some(raw), body.to_string()));
        }
    }
    Ok((None, content.to_string()))
}

/// Serialize frontmatter + body into file content.
pub fn serialize(fm: &Frontmatter, body: &str) -> Result<String> {
    let yaml = serde_yaml_ng::to_string(fm)?;
    Ok(format!("---\n{yaml}---\n\n{body}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_and_body() {
        let content = "---\nid: 01ABC\ntitle: Hello\ntags: [a, b]\ncreated: 2026-08-28T10:00:00Z\nupdated: 2026-08-28T10:00:00Z\n---\n\nBody text\n";
        let (raw, body) = parse(content).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01ABC"));
        assert_eq!(raw.title.as_deref(), Some("Hello"));
        assert_eq!(raw.tags, vec!["a", "b"]);
        assert_eq!(body, "Body text\n");
    }

    #[test]
    fn no_frontmatter_returns_none_and_full_body() {
        let content = "# Just a heading\n\nsome text";
        let (raw, body) = parse(content).unwrap();
        assert!(raw.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn parses_crlf_frontmatter_preserving_identity() {
        let content = "---\r\nid: 01ABC\r\ntitle: Hi\r\ntags: []\r\ncreated: 2026-08-28T10:00:00Z\r\nupdated: 2026-08-28T10:00:00Z\r\n---\r\n\r\nbody";
        let (raw, body) = parse(content).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01ABC"));
        assert_eq!(body, "body");
    }

    #[test]
    fn serialize_then_parse_roundtrips() {
        use chrono::{TimeZone, Utc};
        let ts = Utc.with_ymd_and_hms(2026, 8, 28, 10, 0, 0).unwrap();
        let fm = Frontmatter {
            id: "01XYZ".into(),
            title: "Round Trip".into(),
            tags: vec!["x".into()],
            created: ts,
            updated: ts,
        };
        let text = serialize(&fm, "the body").unwrap();
        assert!(text.starts_with("---\n"));
        let (raw, body) = parse(&text).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01XYZ"));
        assert_eq!(raw.title.as_deref(), Some("Round Trip"));
        assert_eq!(body, "the body");
    }
}
