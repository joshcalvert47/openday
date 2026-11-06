# AGENTS.md

Instructions for AI coding agents (Claude, ChatGPT/Codex, and others) working on this repository.

## About the project

**OpenDay** is a Google Calendar clone you can self-host.

- (Almost) the same UI, layout and workflow as Google Calendar.
- Open source (MIT license) and fully under the user's control.

When making product or UI decisions, the default answer is: **do what Google Calendar does**, unless the owner says otherwise. Do not copy Google's logos, brand names or proprietary assets.

## Project status

First working version: day/week/month/year views, events (create, edit, move, resize, color, delete), settings, light/dark theme.

Commands:

| What | Command |
| --- | --- |
| Run backend (dev) | `cd backend && go run .` (listens on `:8080`, database `openday.db`) |
| Run frontend (dev) | `cd frontend && npm install && npm run dev` (Vite on `:5173`, proxies `/api` to `:8080`) |
| Backend tests | `cd backend && go test ./...` |
| Frontend build | `cd frontend && npm run build` |
| Docker image | `docker build -t openday .` |
| Lint | none yet |

## Tech stack

| Part | Choice |
| --- | --- |
| Backend | Go |
| Frontend | React |
| Database | SQLite |
| Frontend build tool | Vite |
| Shipping | One Docker image |
| Frontend in the image | Built by Vite, then embedded into the Go binary (Go `embed`) |

Why: easy to self-host. One container, one binary, one database file, low memory use.

Smaller decisions (made in the first version; change them only after asking the owner):

| Part | Choice |
| --- | --- |
| Go HTTP routing | Standard library `net/http` (`ServeMux` with method patterns). No web framework. |
| SQLite driver | `modernc.org/sqlite` (pure Go, no CGO, so the Docker build stays simple). |
| Frontend language | JavaScript (JSX). No TypeScript yet. |
| Frontend libraries | Only `react` and `react-dom`. No router, state or date library. |
| Styling | One plain CSS file (`frontend/src/styles.css`) with CSS variables for light/dark themes. |
| Icons | Inline SVG paths in `frontend/src/icons.jsx` (Material Design icon shapes, Apache 2.0). |
| Time zones | Browser `Intl` API (`frontend/src/time.js`). Go embeds `time/tzdata`. |
| Final Docker image | `alpine`, runs as a non-root user, data in `/data`. |

How the app works:

- API lives under `/api` (`backend/api.go`): `GET/POST /api/events`, `PUT/DELETE /api/events/{id}`, `GET/PUT /api/settings`, `GET /api/health`.
- Events are stored as UTC Unix milliseconds. The frontend shows them in the time zone from settings.
- Settings (date format, time format, time zone, default duration, theme) are stored in the database, so they follow the user across browsers.
- Small per-browser preferences (current view, sidebar open, editor docked) are kept in `localStorage`.
- Environment variables: `OPENDAY_ADDR` (default `:8080`), `OPENDAY_DB` (default `openday.db`; `/data/openday.db` in Docker).

## Folder layout

One repository, two main folders:

```
openday/
├── backend/     # Go code (API + serves the embedded frontend)
│   └── web/dist # frontend build is copied here before `go build` (only .gitkeep in git)
├── frontend/    # React app (Vite)
│   └── public/logo.svg  # copy of assets/logo.svg (favicon + header logo)
├── assets/      # project images (e.g. logo.svg, used in README)
├── Dockerfile   # builds frontend, then backend, into one image
├── README.md
├── AGENTS.md
└── CLAUDE.md
```

- The Dockerfile builds the frontend first, then the Go binary that embeds it.
- The final image only needs the Go binary. No Node.js at runtime.

Rules:

- Keep it to **one Docker image**. Do not add services that need their own container (e.g. Postgres, Redis).
- The SQLite database file must live in a mounted volume, so data survives container updates.
- Anything not listed here (libraries, frameworks, folder layout, tools) is **not decided yet**. Ask before picking (see "How to ask" below), then add the decision here.

## How to talk

- **Keep it simple.** Short sentences, plain words. Easy to read.
- Use lists and short sections, not long paragraphs.
- Say what you did, what you did not do, and why.
- Be honest. If something failed or was skipped, say so.

## How to ask

When you are not sure about something, **stop and ask** instead of guessing.

If there are several ways to do it, give options in this format:

> **Question:** Which database should we use?
>
> **Option A — PostgreSQL**
> - Pros: ...
> - Cons: ...
>
> **Option B — SQLite**
> - Pros: ...
> - Cons: ...
>
> **My recommendation:** Option A, because ...

Always include a recommendation and a short reason.

## Git and GitHub

- **Never work on branches named `claude/*`** (or any other auto-generated agent branch name, like `codex/*`).
- Always create a branch with a clear, descriptive name. Use these prefixes:
  - `feature/` — new functionality (e.g. `feature/week-view`)
  - `fix/` — bug fixes (e.g. `fix/event-timezone-offset`)
  - `docs/` — documentation only (e.g. `docs/setup-guide`)
  - `refactor/` — code changes with no behavior change
  - `chore/` — tooling, dependencies, config
- Use lowercase and hyphens in branch names.
- Never push directly to `main`.
- Write clear commit messages: a short summary line, then details if needed.
- Do not open a pull request unless asked.

## Keeping this file up to date

This file is the single source of truth for agent instructions. `CLAUDE.md` points here.

When something important changes (stack chosen, new commands, new conventions), update this file in the same change.
