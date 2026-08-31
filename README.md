# Platform server

Повторяемый бэкенд: session auth, RBAC, validator, notification, email.

Полное описание — что умеет, как устроен, как поднять:

**[docs/PLATFORM.md](docs/PLATFORM.md)**

Зафиксированные решения: [docs/ADR-001-platform.md](docs/ADR-001-platform.md)  
Работы по фазам: [todo/PHASES.md](todo/PHASES.md)  
Правила агента: [AGENTS.project.md](AGENTS.project.md)

```
npm start
```

API: HTTP + WebSocket, порт `8010`, RPC `POST /api`.
