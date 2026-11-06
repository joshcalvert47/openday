# AGENTS.md

Instructions for AI coding agents (Claude, ChatGPT/Codex, and others) working on this repository.

## About the project

**OpenDay** is a Google Calendar clone you can self-host.

- (Almost) the same UI, layout and workflow as Google Calendar.
- Open source (MIT license) and fully under the user's control.

When making product or UI decisions, the default answer is: **do what Google Calendar does**, unless the owner says otherwise. Do not copy Google's logos, brand names or proprietary assets.

## Project status

First working version: day/week/month/year views, events (create, edit, move, resize, color, delete), notifications, settings, light/dark theme.

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
- Settings (date format, time format, time zone, default duration, default notification, notification settings, theme) are stored in the database, so they follow the user across browsers.
- Notifications (`frontend/src/notifications.js`):
  - Each event has `reminders`: up to 5 times in minutes before the start (0 to 4 weeks). Stored as a JSON array in the `reminders` column (added by `migrate` in `store.go` for older databases).
  - New events get the "Default notification" from settings.
  - In the event form, each notification is a number field plus a unit drop-down (minutes, hours, days, weeks), like the classic calendar (`ReminderList.jsx`). The value is stored in minutes, so the unit is not saved: a reopened event shows the largest unit that fits ("60 minutes" comes back as "1 hour"). Numbers outside 0 to 4 weeks are marked red and not saved; leaving the field puts back the last good value. Changing the unit keeps the number (capped at 4 weeks).
  - The page checks every 10 seconds which reminders are due. There is no server push, so a calendar tab must be open. Reminders more than 10 minutes late are skipped.
  - "Notifications" setting: Off, Desktop notifications (browser `Notification` API), or Alerts (dialog in the page). If the browser blocks desktop notifications, alerts are used instead.
  - Desktop notifications are shown by a small service worker (`frontend/public/sw.js`) so they can have a Snooze button. A snoozed notification shows again "Show snoozed notifications" minutes before the event (or 5 minutes later if that time has passed).
  - "Play notification sounds": a short chime made with Web Audio (no sound file).
  - Shown reminders and snoozes are kept in `localStorage`, so a reminder shows once even with several tabs open or after a reload.
  - Desktop notifications need HTTPS or `localhost` (browser rule). Headless Chromium always denies them, so tests stub `Notification.permission` and `showNotification`.
- Small per-browser preferences (current view, sidebar open) are kept in `localStorage`.
- Drop-downs: no browser `<select>`. Use `Select.jsx` (styled list, keyboard and type-ahead). Long lists (time zones) use `SearchSelect.jsx`: type to search, the list scrolls to the best match in real time (nothing is hidden). Lists are drawn by `DropdownList.jsx` in `document.body` and follow their field (e.g. when the form is dragged).
- Event times use `TimeInput.jsx`: pick from the list or type any time ("9", "930", "9:30pm", "21:15"). While typing, the list scrolls to the closest option. Typed text is read by `parseTime` in `time.js`. In 12h format, a time without am/pm picks the one closest to the current start (start field) or the first one after the start (end field).
- The event form always opens floating. The user can dock it; it is never docked by default.
- Phones and touch (breakpoints: 900px and 600px in `styles.css`):
  - Sidebar floats over the calendar and starts closed.
  - Phones (≤600px): no Today or settings button in the header; Settings is at the bottom of the sidebar.
  - Phones (≤600px): the event form and details card are sheets stuck to the bottom of the screen. No dock button, no dragging the card. In the form sheet, Close is top left and Save top right (so the keyboard never hides Save). No Delete button in the form sheet: delete from the details card or the long-press menu.
  - Touch devices (`TOUCH` in `useMedia.js`): the event form does not focus the title on open, so the keyboard only opens when the user taps a field.
  - On-screen keyboard: Android Chrome resizes the page (`interactive-widget=resizes-content` in `index.html`). iOS Safari does not, so `keyboard.js` measures `window.visualViewport` and sets `--kb-inset` and `--vv-height`; the sheet uses them to stay above the keyboard. The focused field in a sheet is scrolled back into view.
  - Breakpoints are shared in `frontend/src/useMedia.js` (`NARROW`, `PHONE`); keep them in sync with `styles.css`.
  - Tap = click. Long press on an event = drag it, or open its menu if the finger does not move. Swipe left/right = next/previous period.
  - After a finger tap opens a card, the "ghost" click from the browser is cancelled (see `eatGhostClick` in `TimeGrid.jsx`).
  - Test with Playwright device emulation (e.g. `devices['Pixel 7']`) and touch events.
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

Keep branches up to date with `main`:

- Agent sessions often start from an old copy of the repository, so a new branch can be behind `main`.
- Before you start work, run `git fetch origin main`. Create new branches from `origin/main`, not from a local `main` that may be old.
- Check with `git rev-list --left-right --count origin/main...HEAD`. If the left number is not `0`, the branch is behind.
  - No commits of your own yet: `git checkout -B <branch> origin/main`.
  - Already has commits: `git merge origin/main` (this repo uses merge commits).
- Check again before every push and before opening a pull request, because `main` can move during the session.
- Exceptions: the owner says otherwise, or there is a good reason (for example, a branch that must build on another unmerged branch). If you do this, say so.

## Keeping this file up to date

This file is the single source of truth for agent instructions. `CLAUDE.md` points here.

When something important changes (stack chosen, new commands, new conventions), update this file in the same change.
