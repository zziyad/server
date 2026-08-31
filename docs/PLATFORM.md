# Платформенный сервер

Шаблон бэкенда для клиентских приложений: не пишут AAA, сессии, RBAC и почту заново в каждом проекте.

Чеклист: `todo/PHASES.md`.

## Что умеет

### Транспорт
- HTTP `POST /api` и WebSocket, порт **8010**.
- JSON-RPC: `{ "type": "call", "id": "1", "method": "auth/signin", "args": { ... } }`.
- Cookie `session_id` (HttpOnly). Сессия в **Redis**.

### Аутентификация
Канон: `auth/signin`, `auth/register`, `auth/signout`, `auth/me`, `auth/activity`.
`auth/logout` — алиас. Служебные keep-alive/refresh/restore не расширять.

### Система
`health` проверяет Postgres (`SELECT 1`) и Redis (`PING`). Тесты: `npm test`.

## Runtime
Раннер `runRpc` держит AbortScope и access log.
Слои без `next()`: `restoreSession → authorize → invoke`.

Четыре слоя: API → JSON Schema → Domain → Repository.
