# Project instructions (read first)

User language: Russian. Reply in Russian unless asked otherwise.

## Operating mode

1. Source of truth is the local platform tree, then this GitHub repo after push.
2. Folder artifacts/server is deleted. Do not recreate it.
3. After file uploads, re-read the local tree before editing.

## Product goal

Reusable platform template for many client apps. Not a gate-pass product.

Must already include, so it is not rewritten each time:

- AAA + session-based auth. Canon RPC: signin / register / signout / me / activity. logout is alias. refresh / keep-alive / restore exist but are not the public dictionary.
- standard user / role / permission (RBAC)
- validator (JSON Schema + validateEndpoint)
- notification pipeline
- email system
- sessions (Redis in this tree)

Gate-pass domain is removed. Do not add it back.

## Architecture to keep

Four layers:

- API application/api/{entity}/{action}.js
- Domain application/domain/{entity}/{action}.js
- Schema application/lib/schemas/{entity}/{action}Schema.js
- Repository application/lib/repository/{entity}/{action}.js

No module.exports in those layers. Validate in API first.

Runtime stays in src/ + main.js. Shared helpers in lib/ and application/lib/.

RPC runner (runRpc) owns abort + access log. Chain has no next():
restoreSession → authorize → invoke. Halt stops the tail. Do not pass req/res into domain.

## How to work

1. Inspect the tree first.
2. Smallest change that keeps the platform reusable.
3. Refactor later; do not invent a new product domain.

## Cheap vs expensive changes

Classify before editing.

Cheap (safe to do in one pass): four-layer internals, src/ splits, docs, additive columns/tables.

Expensive (ask or add compatibility — cannot just unpublish):

- Destructive migrations (DROP/RENAME/enum rewrite)
- Public RPC names. Auth canon is frozen: signin register signout me activity
- Cookie session_id and Redis session shape
- Stored status values (ACTIVE / IMPORTED)

Do not fix a heavy loop with await. Filter in SQL, paginate (user/list max 100), batch broadcasts.
