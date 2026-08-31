# ADR-001 — Платформа, не продукт

Статус: принято
Дата: 2026-08-30

## Решение

Шаблон бэкенда для многих клиентских приложений.

В шаблоне: session auth, user/role/permission, JSON Schema validator, notification, email.

Нет и не возвращать: gate-pass, helpdesk, control-center, index-search.

## Контракт

RPC: `auth/signin`, `auth/register`, `auth/signout`, `auth/me`, `auth/activity`.
Cookie: `session_id`. Сессия: Redis.

## Runtime

Слои без `next()`: `restoreSession → authorize → invoke`.
AbortSignal = жизнь RPC, не logout.
