# Pasen Capture

The desktop app that catches League custom games and sends them to Pasen.
It replaces running `apps/agent/agent.mjs` from a terminal.

Riot's match API does not serve customs, and the League client only exposes a
game through its Live Client Data API (`https://127.0.0.1:2999`) while the game
window is open. Pasen Capture sits in the tray, watches that endpoint, keeps
every game the moment it ends, and lets you send the customs with one click.

## Installing

Download the installer from the repository's **Releases** (or from the
artifacts of the latest *Capture app* workflow run):

- **Windows**: `Pasen-Capture-Setup-x.y.z.exe`. The app is not signed, so the
  first launch shows *Windows protected your PC*: click **More info** then
  **Run anyway**.
- **macOS**: `Pasen-Capture-x.y.z-arm64.dmg` for Apple Silicon, `-x64` for an
  Intel Mac. Drag the app to Applications. On first launch macOS refuses it:
  open **System Settings → Privacy & Security** and click **Open Anyway**.

## Linking a PC

1. On Pasen, open **Admin → Capture app**, name the PC and click **Pair this PC**.
2. Copy the code shown (it is shown once).
3. Paste it into Pasen Capture and click **Link**.

The code can only send games to your group, nothing else, and it is stored
encrypted with the system keychain. Revoke it from the admin at any time.

## Using it

Leave it running (tick *Start with my computer* to forget about it). Every game
you play appears in the list when it ends, ranked ones included: the client
serves them all the same way and there is no telling them apart from inside a
game. Send the customs; ranked games are already on Pasen.

Every capture is written to disk before anything is sent, so a failed upload
never loses a game: it stays in the list with a button to try again.

## Developing

```bash
cd apps/capture
npm install
npm start        # runs the app
npm test         # watcher, storage and site client
npm run dist:mac # builds a .dmg locally
```

This folder keeps its own npm lockfile and is excluded from the pnpm
workspace: electron-builder packages `node_modules` as it finds them, and
pnpm's symlinked layout is what it handles worst.

Installers for both systems are built on GitHub (`.github/workflows/capture-app.yml`),
each on its own OS. Push a `capture-v*` tag to publish a release.
