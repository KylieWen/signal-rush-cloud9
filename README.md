# Signal Rush

Signal Rush is an original 45-second reaction arcade game designed for quick, repeatable play at event booths. Catch cyan signals, collect blue bonuses, avoid red noise, and build a streak to increase the score multiplier.

## Play

- **Mouse / touch:** click or tap targets.
- **Keyboard:** focus the arena, use Left/Right to select a signal, then Space/Enter to lock it.
- **P / Escape:** pause or resume.
- **M:** toggle sound.
- **R / Enter:** replay from the results screen.

A round lasts 45 seconds. Signals award 100 points, bonuses 200, noise subtracts 75, and misses subtract 25. Streaks unlock 1.5×, 2×, 3×, and 4× multipliers. Results include score, grade, accuracy, best streak, and local rank.

## Demo video

A 52-second silent-captioned H.264 demo is included at [`media/signal-rush-demo.mp4`](media/signal-rush-demo.mp4). It shows the start screen, gameplay, results, local leaderboard, and separate booth display.

## Run locally

On Windows, double-click `run-windows.bat` to start the server and open the game. No package installation or network access is required.

```bash
python server.py --port 8010
```

Open `http://127.0.0.1:8010/`.

```bash
node --test
```

The test suite covers game rules, input boundaries, scoring, timing, pause/resume, target selection, leaderboard sorting, persistence, corrupt storage, storage-disabled fallback, and a 100-round booth stress test. Current result: **26/26 passed**.

Browser verification covered a complete round, score persistence after reload, the separate leaderboard display, offline reload with the server stopped, and booth auto-restart after the 15-second countdown.

## Booth mode

Open:

```text
http://127.0.0.1:8010/index.html?booth=1
```

Booth mode starts a 15-second countdown after each completed round and automatically resets for the next player. The countdown stops while the local leaderboard is open.

## Offline local leaderboard

Open a second tab or monitor on the same device and origin:

```text
http://127.0.0.1:8010/leaderboard.html
```

The display automatically reads the top ten runs from `localStorage` and updates when another tab saves a score. It requires no account, backend, or Wi-Fi after the first load. Use `?manage=1` to reveal the clear-scores control.

The game includes a service worker and web app manifest. After the first successful load, the app shell is cached for offline play. Browser storage policies can disable persistence; the game remains playable and keeps an in-memory leaderboard for the current page.

## Methodology

- Fixed 45-second rounds keep booth lines moving.
- A deterministic core module owns scoring, target lifetime, multiplier, accuracy, and round state.
- Rendering, audio, input, and storage are separated from the core.
- Audio is synthesized with Web Audio; artwork and icons are original SVG/CSS/Canvas geometry.
- The leaderboard is bounded to ten sanitized entries and sorted by score, accuracy, then timestamp.
- User-supplied callsigns are normalized and rendered with `textContent`.
- No third-party trademarks, copyrighted music, external assets, trackers, or network APIs are used.

## Accessibility and resilience

The game supports pointer, touch, and keyboard controls; visible focus; reduced motion; high contrast; live status announcements; clean pause/resume; and responsive desktop/mobile layouts. Canvas gameplay is not fully screen-reader operable, so keyboard selection and status announcements provide an alternative interaction path.

## JetBrains tooling

The project was opened and inspected with **IntelliJ IDEA 2025.3 (build IU-253.28294.334)**. The checked-in profile is `.idea/inspectionProfiles/Signal_Rush_Checks.xml`.

Headless inspection command:

```bash
idea64.exe inspect <project> .idea/inspectionProfiles/Signal_Rush_Checks.xml <output> -format json -v2
```

The inspection identified an undefined CSS custom property in the leaderboard display and two service-worker lifecycle promises that were not awaited. Both were fixed. Remaining CSS unused-symbol warnings were reviewed and correspond to classes assigned dynamically by JavaScript or static SVG controls; the `100vh`/`100dvh` pair is an intentional fallback.

## Project layout

- `game-core.js` — deterministic rules and state.
- `renderer.js` — Canvas rendering and particles.
- `audio.js` — synthesized sound.
- `game.js` — input, HUD, screens, persistence, and booth flow.
- `leaderboard.js` — sanitized local top-ten storage.
- `leaderboard.html` / `leaderboard-display.js` — separate booth display.
- `sw.js` / `manifest.webmanifest` — offline app shell.
- `server.py` — optional dependency-free local server.
- `test/` — Node built-in tests.

## License

MIT. See `LICENSE`.
