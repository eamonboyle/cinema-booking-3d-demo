import { HALL, TOTAL_ROWS, zoneForRow, seatsInRow, ZONES } from '../cinema/layout'
import type { SeatSystem } from '../cinema/seats'

export function drawSeatMap(
  ctx: CanvasRenderingContext2D,
  seats: SeatSystem,
  selectedIdx: number,
): void {
  const cv = ctx.canvas
  const W = cv.width
  const H = cv.height
  ctx.clearRect(0, 0, W, H)

  // Screen arc
  ctx.fillStyle = '#f2ebe0'
  ctx.beginPath()
  ctx.moveTo(W * 0.18, 18)
  ctx.quadraticCurveTo(W / 2, 4, W * 0.82, 18)
  ctx.lineTo(W * 0.78, 28)
  ctx.quadraticCurveTo(W / 2, 16, W * 0.22, 28)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(12,10,11,0.7)'
  ctx.font = '700 9px Manrope, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('SCREEN', W / 2, 24)

  const padX = 28
  const padTop = 42
  const usableH = H - padTop - 16
  const rowH = usableH / TOTAL_ROWS

  for (let r = 0; r < TOTAL_ROWS; r++) {
    const n = seatsInRow(r)
    const zone = zoneForRow(r)
    const y = padTop + r * rowH + rowH * 0.2
    const half = Math.floor(n / 2)
    const seatW = Math.min(10, (W / 2 - padX - 14) / half - 2)

    const drawBank = (count: number, startX: number, seatOffset: number) => {
      for (let q = 0; q < count; q++) {
        // Find index roughly
        let idx = -1
        const seatNum = seatOffset + q + 1
        for (let i = 0; i < seats.count; i++) {
          if (seats.meta.row[i] === r && seats.meta.seatNum[i] === seatNum) {
            idx = i
            break
          }
        }
        const x = startX + q * (seatW + 2)
        if (idx === selectedIdx) ctx.fillStyle = '#e8a838'
        else if (idx >= 0 && !seats.meta.avail[idx]) ctx.fillStyle = '#2a1a1e'
        else {
          const c = zone.color
          ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`
        }
        roundRect(ctx, x, y, seatW, rowH * 0.55, 2)
        ctx.fill()
      }
    }

    const leftStart = W / 2 - 10 - half * (seatW + 2)
    drawBank(half, leftStart, 0)
    const rightStart = W / 2 + 10
    drawBank(n - half, rightStart, half)
  }

  // Legend
  ctx.textAlign = 'left'
  ctx.font = '600 8px Manrope, sans-serif'
  ZONES.forEach((z, i) => {
    ctx.fillStyle = `#${z.color.toString(16).padStart(6, '0')}`
    ctx.fillRect(12 + i * 100, H - 12, 8, 8)
    ctx.fillStyle = 'rgba(242,235,224,0.65)'
    ctx.fillText(z.name, 24 + i * 100, H - 5)
  })
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

  // Hall outline
  ctx.strokeStyle = 'rgba(232,168,56,0.35)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(
    cx - (HALL.width / 2) * sc,
    cy - (HALL.depth / 2) * sc,
    HALL.width * sc,
    HALL.depth * sc,
  )

  // Screen
  ctx.fillStyle = '#f2ebe0'
  ctx.fillRect(
    cx - (HALL.screenW / 2) * sc,
    cy + HALL.screenZ * sc - 3,
    HALL.screenW * sc,
    5,
  )

  // Camera
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
