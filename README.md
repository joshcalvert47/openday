<p align="center">
  <img src="assets/logo.svg" alt="OpenDay logo" width="128" height="128">
</p>

<h1 align="center">OpenDay</h1>

<p align="center">
  A self-hosted calendar that looks and works like Google Calendar.<br>
  Open source. Your data, on your server.
</p>

---

## Run

You need [Docker](https://docs.docker.com/get-docker/).

```bash
git clone https://github.com/nikolozlortki/openday.git
cd openday
docker build -t openday .
docker run -d --name openday -p 8080:8080 -v openday-data:/data --restart unless-stopped openday
```

Open **http://localhost:8080**.

Your events are saved in the `openday-data` volume.

## Commands

| What | Command |
| --- | --- |
| Stop | `docker stop openday` |
| Start again | `docker start openday` |
| See logs | `docker logs openday` |
| Delete the app (keeps your data) | `docker rm -f openday` |
| Delete your data too | `docker volume rm openday-data` |

## Update

```bash
git pull
docker build -t openday .
docker rm -f openday
docker run -d --name openday -p 8080:8080 -v openday-data:/data --restart unless-stopped openday
```

Your data stays in the volume.

## Features

- Day, week, month and year views.
- Click the calendar to add an event. Drag to pick a time range.
- Drag events to move them. Drag the bottom edge to resize.
- Events have a title, description and color. Events can overlap.
- Right-click an event to change its color or delete it.
- The event form can float or be docked to the side.
- Settings: date format, time format, time zone, default event length.
- Light, dark or device theme.
- Works on phones: tap to add or open, hold an event to drag it or open its menu, swipe to change the day/week/month.
- Keyboard shortcuts: `D` `W` `M` `Y` (views), `T` (today), `J`/`K` (next/previous), `C` (create).

## For developers

Run the backend (Go) and the frontend (Vite) in two terminals:

```bash
cd backend && go run .
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. Run the backend tests with `cd backend && go test ./...`.

AI coding agents should read [`AGENTS.md`](AGENTS.md) first.

## License

[MIT](LICENSE)
