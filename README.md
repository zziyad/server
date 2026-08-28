# index-search-server

A deterministic evidence server for agents.

The core product is intentionally small:

```text
question -> search/contextPack -> cited evidence pack or refusal
```

The server ingests curated text/file/project records, stores provenance, and returns small grounded context packs so agents do not need to read huge memory files, project folders, or vault mirrors.

## Current Simplify v1 boundary

Core:

- database migrations and repository layer;
- `search/query` and `search/contextPack`;
- source document provenance;
- refusal / low-confidence evidence assessment;
- minimal ingestion from curated directories;
- thin project switching / memory recall only while they support grounded evidence retrieval.

Frozen / archived for now:

- broad frontend product UI;
- generated activity logs and operator reports;
- live-chat/cache/DeepSeek generated memory lanes;
- Obsidian vault mirror ingestion output;
- experimental OpenClaw plugin surface;
- model/provider UI expansion.

See:

- `docs/simplification/index-search-server-simplify-v1.md`
- `docs/api.md`
- `docs/simplification/collected-data-cleanup-plan.md`

## Runtime

- Entry: `main.js` loads `.applications` and calls `Application.start()`.
- Sessions can be disabled with `SESSION_ENABLED=false` or `application/config/sessions.js` `enabled: false`.
- HTTP and WebSocket transports plus streams are kept.
