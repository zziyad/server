# Architecture

## Purpose

`index-search-server` is a small evidence kernel for agent memory and project context.

It should answer one question well:

> Given a user/agent query, what small set of grounded records should the agent see, and should it trust them enough to answer?

## Core flow

```text
curated source files
  -> ingestion scripts
  -> source_documents + search_records
  -> search/query for UI/human search
  -> search/contextPack for agents
  -> cited answer or refusal
```

## Runtime bootstrap

```text
main.js
  -> sandbox + signals
  -> Application.start()
     -> load application/{lib,domain,config,api}
     -> Server (HTTP + WS + streams)
     -> static + application.starts
```

Sessions are optional: `application/config/sessions.js` `enabled` or `SESSION_ENABLED`.
