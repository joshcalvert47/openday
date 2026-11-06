<p align="center">
  <img src="assets/logo.svg" alt="OpenDay logo" width="128" height="128">
</p>

<h1 align="center">OpenDay</h1>

<p align="center">
  A self-hosted calendar that looks and works like Google Calendar.<br>
  Open source. Your data, on your server.
</p>

---

## Why OpenDay?

- **Familiar.** Almost the same layout, views and workflow as Google Calendar. Nothing new to learn.
- **Yours.** Self-host it. Your events stay on your own server.
- **Simple to run.** One Docker container, one binary, one SQLite database file.
- **Light.** Low memory use. Runs fine on a small server or a Raspberry Pi.
- **Open source.** MIT license.

## Status

🚧 **Early stage.** There is no code yet. The tech stack and layout are decided; building starts next.

## Tech stack

| Part | Choice |
| --- | --- |
| Backend | Go |
| Frontend | React (built with Vite) |
| Database | SQLite |
| Shipping | One Docker image (frontend embedded into the Go binary) |

## Contributing

Ideas and pull requests are welcome. AI coding agents should read [`AGENTS.md`](AGENTS.md) first.

## License

[MIT](LICENSE)
