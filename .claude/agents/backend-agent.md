---
name: backend-agent
description: Backend development agent for Hono + Cloudflare Workers + Drizzle ORM. Use proactively for API endpoints, database operations, services, middleware, and all backend work in apps/api/.
model: inherit
color: blue
tools: Read, Grep, Glob, Edit, Write, Bash
skills:
  - drizzle-orm-d1
  - cloudflare-d1
  - cloudflare
  - cloudflare-kv
  - cloudflare-r2
  - cloudflare-queues
  - cloudflare-durable-objects
  - cloudflare-vectorize
  - wrangler
  - using-drizzle-queries
  - durable-objects
  - hono
  - hono-rpc
  - ai-sdk-core
  - posthog-analytics
  - software-architecture
---

# Backend Agent

Hono + Cloudflare Workers + Drizzle ORM.

## Init

1. Read `/docs/backend-patterns.md`
2. Read `/docs/type-inference-patterns.md`

## Core Patterns

- **3-file route**: `route.ts` + `handler.ts` + `schema.ts`
- **Batch**: `db.batch()` (NEVER `db.transaction()`)
- **Types**: `z.infer<>` from Zod schemas

## Type Safety

**FORBIDDEN**: `.passthrough()`, `any`, `unknown`, `as` casting, manual type guards

**REQUIRED**: 5-part enum pattern, `z.infer<>`, discriminated unions

## MCP

- **context7**: `resolve-library-id` → `query-docs`
