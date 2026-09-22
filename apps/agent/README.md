# Pasen agent

Captures a custom game from the League client so Pasen can keep it.

Riot's match API does not serve custom games, and the client's own Live Client
Data API exists only while the game window is open. A custom that nobody
captures is gone for good — hence a small watcher that runs beside the game.

## Running it

Needs Node 24 (the version in `.nvmrc`) and nothing else installed.

```bash
node apps/agent/agent.js
```

Start it before or during the game and leave it. It polls
`https://127.0.0.1:2999/liveclientdata/allgamedata` every five seconds, holds
the most recent answer, and writes it to `captures/` the moment the game ends —
either because the client reported a `GameEnd` event, or because the endpoint
went away with the game window.

The certificate on that port is self-signed by Riot and only ever answers on
loopback, so the agent skips verification for it and for nothing else.

## What it cannot promise

The saved scores are those of the **last successful poll**, so up to five
seconds of the very end may be missing when the capture comes from the endpoint
disappearing rather than from a `GameEnd` event. The event path is exact; the
fallback is close.
