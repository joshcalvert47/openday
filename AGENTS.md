# AGENTS.md

Instructions for AI coding agents (Claude, ChatGPT/Codex, and others) working on this repository.

## About the project

**OpenDay** is a Google Calendar clone you can self-host.

- (Almost) the same UI, layout and workflow as Google Calendar.
- Open source (MIT license) and fully under the user's control.

When making product or UI decisions, the default answer is: **do what Google Calendar does**, unless the owner says otherwise. Do not copy Google's logos, brand names or proprietary assets.

## Project status

The project is at the very start. There is no code yet.

- Build, test and lint commands: **none yet.**

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

## Folder layout

One repository, two main folders:

```
openday/
├── backend/     # Go code (API + serves the embedded frontend)
├── frontend/    # React app (Vite)
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
