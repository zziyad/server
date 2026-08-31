# TODO фаз платформы

Цель: шаблон, который не пишут заново — AAA session auth, user/role/permission, validator, notification, email.

## Фаза 0 — честный шаблон
- [x] 0.1 Boot SQL без helpdesk/gate-pass
- [x] 0.2 Секреты только из env
- [x] 0.3 Канон auth: signin / register / signout / me / activity
- [x] 0.4 Убрать тестовые auth, legacy provider, control-center

## Фаза 1 — слои user/auth
- [x] 1.1 auth/signin через JSON Schema + validateEndpoint
- [x] 1.2 user/* через schema-файлы
- [x] 1.3 SQL из domain/user в repository/user
- [x] 1.4 Domain user без db.pg

## Фаза 2 — runtime
- [x] 2.1 Session / Client из server.js
- [x] 2.2 Streams отдельным модулем
- [x] 2.3 Разрезать lib/common.js
- [x] 2.6 RPC без next(): restoreSession → authorize → invoke
- [x] 2.7 AbortScope на запрос, не на Redis-сессию

## Фаза 3 — эксплуатация
- [x] 3.1 npm test → test/*.test.js
- [x] 3.2 health проверяет Postgres + Redis
- [x] 3.3 docs/PLATFORM.md
