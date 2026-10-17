# Ragnagrok: Lawn Care at the End of Days

A Catan-style hex game for one shared TV and up to 8 phones.

## Folders

| Folder / file | Job |
|---|---|
| `src/engine/` | Every game rule. Nothing else changes the game. |
| `src/data/cards.json` | Deities and Perk cards. Edit text and counts here. |
| `server/index.js` | Starts the web server. |
| `server/rooms.js` | Rooms, codes, timers, pause, rematch, saving. |
| `server/handlers.js` | Messages between the TV, phones and server. |
| `public/index.html` | TV page (temporary check screen). |
| `public/play.html` | Phone page (temporary check screen). |
| `test/` | Robot tests. |

## Run it on your computer

1. Install Node.js 18 or newer from nodejs.org.
2. Open a terminal in this folder and run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in a browser. That's the TV.
5. On a phone on the same Wi-Fi, open `http://<your-computer's-IP>:3000/play`, or scan the QR code.

## Run the tests

`npm test` runs both suites. A line starting with ✔ means it passed.

- `npm run test:engine`: robot games against the rules.
- `npm run test:server`: real sockets, full games, phone drop and rejoin, pause, server restart.

## Put it on Render (free)

1. Push this folder to a new GitHub repo.
2. In Render: New → Blueprint → pick the repo. `render.yaml` sets everything up.
3. Open the Render URL on the TV.

On the free plan games live in memory only, so a restart or redeploy ends games in progress.

## Put it on Oracle (always on, games survive restarts)

1. On the server: install Node.js 18+, copy this folder, run `npm install --omit=dev`.
2. Start it with saving switched on:
   `SAVE_DIR=/home/ubuntu/ragnagrok-saves PORT=3000 npm start`
3. Keep it running with a service manager (systemd or pm2), and put it behind HTTPS
   (Caddy is the simplest: it gets the certificate for you).

After a restart, games load from `SAVE_DIR`, wait paused, and carry on by themselves once every phone has reconnected.

## Settings (environment variables)

| Name | Default | What it does |
|---|---|---|
| `PORT` | 3000 | Render sets this for you |
| `SAVE_DIR` | off | Folder to save games in |
| `PUBLIC_URL` | auto | Force the address in the join link and QR code |
| `IDLE_MINUTES` | 30 | Delete rooms nobody has used for this long |
