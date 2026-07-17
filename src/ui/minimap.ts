import { HALL, TOTAL_ROWS, zoneForRow, seatsInRow, ZONES } from '../cinema/layout'
import type { SeatSystem } from '../cinema/seats'

export type SeatMapHit = {
  idx: number
  x: number
  y: number
  w: number
  h: number
}

/** Layout cache so hit-testing matches the last draw. */
let lastHits: SeatMapHit[] = []

export function drawSeatMap(
  ctx: CanvasRenderingContext2D,
  seats: SeatSystem,
  selected: ReadonlySet<number> | number,
  opts?: { favourites?: ReadonlySet<number> },
): void {
  const selectedSet =
    typeof selected === 'number'
      ? new Set(selected >= 0 ? [selected] : [])
      : selected
  const favs = opts?.favourites

  const cv = ctx.canvas
  const W = cv.width
  const H = cv.height
  ctx.clearRect(0, 0, W, H)
  lastHits = []

  // Screen arc — wider / more curved for large-format halls
  const curve = Math.min(0.22, 0.08 + HALL.screenCurve * 0.04)
  ctx.fillStyle = '#f2ebe0'
  ctx.beginPath()
  ctx.moveTo(W * (0.18 - curve * 0.15), 18)
  ctx.quadraticCurveTo(W / 2, 4 - HALL.screenCurve * 0.8, W * (0.82 + curve * 0.15), 18)
  ctx.lineTo(W * 0.78, 28)
  ctx.quadraticCurveTo(W / 2, 16, W * 0.22, 28)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(12,10,11,0.7)'
  ctx.font = '700 9px Manrope, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(HALL.screenCurve > 1 ? 'IMAX SCREEN' : 'SCREEN', W / 2, 24)

  const padX = 22
  const padTop = 40
  const usableH = H - padTop - 18
  const rowH = usableH / TOTAL_ROWS

  // Index lookup: row+seat → idx (built once per draw)
  const indexOf = new Map<string, number>()
  for (let i = 0; i < seats.count; i++) {
    indexOf.set(`${seats.meta.row[i]}:${seats.meta.seatNum[i]}`, i)
  }

  for (let r = 0; r < TOTAL_ROWS; r++) {
    const n = seatsInRow(r)
    const zone = zoneForRow(r)
    const y = padTop + r * rowH + rowH * 0.15
    const half = Math.floor(n / 2)
    // Prefer touch-friendly seat chips; scale up on wider canvases
    const seatW = Math.min(Math.max(8, W >= 300 ? 12 : 9), (W / 2 - padX - 12) / half - 1.5)
    const seatH = Math.max(rowH * 0.55, 6)

    const drawBank = (count: number, startX: number, seatOffset: number) => {
      for (let q = 0; q < count; q++) {
        const seatNum = seatOffset + q + 1
        const idx = indexOf.get(`${r}:${seatNum}`) ?? -1
        const x = startX + q * (seatW + 2)

        if (idx >= 0 && selectedSet.has(idx)) ctx.fillStyle = '#e8a838'
        else if (idx >= 0 && !seats.meta.avail[idx]) ctx.fillStyle = '#2a1a1e'
        else if (idx >= 0 && favs?.has(idx)) ctx.fillStyle = '#c47828'
        else {
          const c = zone.color
          ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`
        }
        roundRect(ctx, x, y, seatW, seatH, 2)
        ctx.fill()

        // Hatch for unavailable (colour-blind friendly)
        if (idx >= 0 && !seats.meta.avail[idx]) {
          ctx.save()
          ctx.beginPath()
          roundRect(ctx, x, y, seatW, seatH, 2)
          ctx.clip()
          ctx.strokeStyle = 'rgba(242,235,224,0.35)'
          ctx.lineWidth = 1
          for (let s = -seatH; s < seatW + seatH; s += 3) {
            ctx.beginPath()
            ctx.moveTo(x + s, y)
            ctx.lineTo(x + s + seatH, y + seatH)
            ctx.stroke()
          }
          ctx.restore()
        }

        if (idx >= 0) lastHits.push({ idx, x, y, w: seatW, h: seatH })
      }
    }

    const leftStart = W / 2 - 10 - half * (seatW + 2)
    drawBank(half, leftStart, 0)
    const rightStart = W / 2 + 10
    drawBank(n - half, rightStart, half)
  }

  // Legend — compact for 3 zones
  ctx.textAlign = 'left'
  ctx.font = '600 8px Manrope, sans-serif'
  const legendGap = Math.min(100, (W - 24) / Math.max(1, ZONES.length))
  ZONES.forEach((z, i) => {
    ctx.fillStyle = `#${z.color.toString(16).padStart(6, '0')}`
    ctx.fillRect(12 + i * legendGap, H - 12, 8, 8)
    ctx.fillStyle = 'rgba(242,235,224,0.65)'
    const label = z.name.length > 12 ? z.name.slice(0, 11) + '…' : z.name
    ctx.fillText(label, 24 + i * legendGap, H - 5)
  })
}

/** Hit-test canvas-local coordinates (CSS → canvas pixel space handled by caller). */
export function hitTestSeatMap(
  canvasX: number,
  canvasY: number,
): number {
  for (const h of lastHits) {
    if (
      canvasX >= h.x &&
      canvasX <= h.x + h.w &&
      canvasY >= h.y &&
      canvasY <= h.y + h.h
    ) {
      return h.idx
    }
  }
  return -1
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  camZ: number,
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#1a1014'
  ctx.fillRect(0, 0, W, H)

  const sc = Math.min(W / (HALL.width + 6), H / (HALL.depth + 4))
  const cx = W / 2
  const cy = H / 2 + 8

  ctx.strokeStyle = 'rgba(232,168,56,0.35)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(
    cx - (HALL.width / 2) * sc,
    cy - (HALL.depth / 2) * sc,
    HALL.width * sc,
    HALL.depth * sc,
  )

  ctx.fillStyle = '#f2ebe0'
  ctx.fillRect(
    cx - (HALL.screenW / 2) * sc,
    cy + HALL.screenZ * sc - 3,
    HALL.screenW * sc,
    5,
  )

  ctx.fillStyle = '#e8a838'
  ctx.beginPath()
  ctx.arc(cx + camX * sc, cy + camZ * sc, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(232,168,56,0.6)'
  ctx.beginPath()
  ctx.moveTo(cx + camX * sc, cy + camZ * sc)
  ctx.lineTo(cx, cy + HALL.screenZ * sc)
  ctx.stroke()
  void camY
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
