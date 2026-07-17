export type ZoneId = 'front' | 'mid' | 'rear'

export type ZoneDef = {
  id: ZoneId
  name: string
  rowStart: number
  rowCount: number
  priceBase: number
  pricePerScore: number
  color: number
  benefits: [string, string, string]
}

/** Auditorium dimensions in metres. Screen faces +Z; seats look toward −Z. */
export const HALL = {
  width: 22,
  depth: 28,
  height: 9.5,
  screenW: 14.5,
  screenH: 8.15,
  screenZ: -12.4,
  screenY: 4.6,
  aisleHalf: 0.85,
  seatSpacing: 0.62,
  rowSpacing: 1.05,
  firstRowZ: -6.2,
  rake: 0.32,
  seatY0: 0.15,
} as const

export const ZONES: ZoneDef[] = [
  {
    id: 'front',
    name: 'Front Rows',
    rowStart: 0,
    rowCount: 4,
    priceBase: 9,
    pricePerScore: 0.18,
    color: 0xa83248,
    benefits: ['Immersive close-up', 'Standard recliner', 'Soft drink included'],
  },
  {
    id: 'mid',
    name: 'Centre House',
    rowStart: 4,
    rowCount: 5,
    priceBase: 14,
    pricePerScore: 0.28,
    color: 0xc44a5c,
    benefits: ['Sweet-spot rake', 'Padded recliner', 'Popcorn upgrade'],
  },
  {
    id: 'rear',
    name: 'Upper Rake',
    rowStart: 9,
    rowCount: 4,
    priceBase: 11,
    pricePerScore: 0.22,
    color: 0x8a3848,
    benefits: ['Full-screen frame', 'Quiet back rows', 'Easy aisle exit'],
  },
]

export const TOTAL_ROWS = ZONES.reduce((n, z) => n + z.rowCount, 0)

export const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function zoneForRow(rowIndex: number): ZoneDef {
  for (const z of ZONES) {
    if (rowIndex >= z.rowStart && rowIndex < z.rowStart + z.rowCount) return z
  }
  return ZONES[ZONES.length - 1]!
}

export function seatsInRow(rowIndex: number): number {
  // Slightly wider mid rows; aisle splits left/right banks
  const base = 16 + Math.min(2, Math.floor(rowIndex / 4))
  return base
}
