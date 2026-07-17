# FrameSight

A quick 3D cinema seating demo. Orbit the auditorium, click a seat, and preview the screen from that row before you "book."

Built with Three.js, GSAP, TypeScript, and Vite.

## What it does

- Interactive 3D house with GPU seat picking
- Fly-to-seat camera path and first-person screen preview
- Seat map, pricing zones, favourites, and group select (Shift+click)
- Four switchable auditorium layouts:
  - **Standard** classic multiplex stadium rake
  - **IMAX** tall curved screen, steep rake, larger capacity
  - **Grand XL** deep large-format house (~480 seats)
  - **Boutique** intimate VIP room with wider spacing

Checkout is not wired. This is a visual / UX prototype, not a booking backend.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build to dist/
npm run preview  # serve the built app
```

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the house |
| Scroll | Zoom |
| Click seat | Fly in and preview the view |
| Shift+click | Add/remove seats in a group |
| `[` / `]` | Move to previous / next available seat |
| `B` | Jump to best available seat |
| Esc | Leave seat preview |

Use the **Auditorium** buttons on the show card to rebuild the hall (Standard, IMAX, Grand XL, Boutique). The last choice is saved in `localStorage`.

## Stack notes

- Demand-driven render loop (idle when nothing moves)
- Instanced seats + GPU colour-id picking
- Soft bloom and house-light dimming in seat mode
- Layouts live in `src/cinema/layout.ts` (dimensions, themes, zones, seat counts)

## License

Demo / portfolio piece. No license file included yet.
