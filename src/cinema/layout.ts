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
export type HallDims = {
  width: number
  depth: number
  height: number
  screenW: number
  screenH: number
  screenZ: number
  screenY: number
  /** Horizontal curve amount in metres (0 = flat). IMAX-style wrap. */
  screenCurve: number
  aisleHalf: number
  seatSpacing: number
  rowSpacing: number
  firstRowZ: number
  rake: number
  seatY0: number
  /** Ideal viewing distance used by the seat score heuristic. */
  sweetSpotDist: number
  orbitRadius: number
  orbitRadiusMax: number
}

export type HallTheme = {
  carpet: string
  carpetAlt: string
  carpetSpeck: string
  wall: number
  apron: number
  aisle: number
  ceiling: string
  ceilingLine: string
  sconce: number
  frame: number
  curtainA: string
  curtainB: string
  curtainC: string
}

export type CinemaLayoutId = 'standard' | 'imax' | 'grand' | 'boutique'

export type CinemaLayout = {
  id: CinemaLayoutId
  name: string
  shortName: string
  tagline: string
  formatTag: string
  capacityHint: string
  hall: HallDims
  theme: HallTheme
  zones: ZoneDef[]
  /** Seats per row — widens toward the back for stadium houses. */
  seatsInRow: (rowIndex: number) => number
  /** Mid-zone row used for the “featured / best” seed. */
  featuredRow: number
  featuredSeatApprox: number
}

const STANDARD: CinemaLayout = {
  id: 'standard',
  name: 'Screen 3',
  shortName: 'Standard',
  tagline: 'Classic multiplex · stadium rake',
  formatTag: 'Dolby Atmos',
  capacityHint: '~220 seats',
  hall: {
    width: 22,
    depth: 28,
    height: 9.5,
    screenW: 14.5,
    screenH: 8.15,
    screenZ: -12.4,
    screenY: 4.6,
    screenCurve: 0,
    aisleHalf: 0.85,
    seatSpacing: 0.62,
    rowSpacing: 1.05,
    firstRowZ: -6.2,
    rake: 0.32,
    seatY0: 0.15,
    sweetSpotDist: 14,
    orbitRadius: 28,
    orbitRadiusMax: 48,
  },
  theme: {
    carpet: '#6a3040',
    carpetAlt: '#5a2836',
    carpetSpeck: '#8a4a58',
    wall: 0x4a3038,
    apron: 0x3a2a30,
    aisle: 0x7a4050,
    ceiling: '#3a3034',
    ceilingLine: '#4a4044',
    sconce: 0xffc858,
    frame: 0x3a2a30,
    curtainA: '#8a2840',
    curtainB: '#b03850',
    curtainC: '#6a2034',
  },
  zones: [
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
  ],
  seatsInRow: (rowIndex) => 16 + Math.min(2, Math.floor(rowIndex / 4)),
  featuredRow: 6,
  featuredSeatApprox: 9,
}

/**
 * Purpose-built IMAX-style house: near wall-to-wall / floor-to-ceiling screen,
 * steep stadium rake, seats kept within ~1 screen-height of the picture.
 * Aspect ~1.43–1.90 (taller than a flat multiplex screen).
 */
const IMAX: CinemaLayout = {
  id: 'imax',
  name: 'IMAX Laser',
  shortName: 'IMAX',
  tagline: 'Floor-to-ceiling · steep stadium',
  formatTag: 'IMAX with Laser',
  capacityHint: '~380 seats',
  hall: {
    width: 30,
    depth: 34,
    height: 14.5,
    screenW: 24,
    screenH: 13.2,
    screenZ: -14.8,
    screenY: 7.1,
    screenCurve: 2.4,
    aisleHalf: 1.05,
    seatSpacing: 0.68,
    rowSpacing: 1.12,
    firstRowZ: -7.4,
    rake: 0.48,
    seatY0: 0.2,
    sweetSpotDist: 16,
    orbitRadius: 36,
    orbitRadiusMax: 62,
  },
  theme: {
    carpet: '#1e2838',
    carpetAlt: '#162030',
    carpetSpeck: '#3a4a62',
    wall: 0x1a2434,
    apron: 0x121820,
    aisle: 0x2a3850,
    ceiling: '#141a24',
    ceilingLine: '#243044',
    sconce: 0x88b8ff,
    frame: 0x0e141c,
    curtainA: '#102030',
    curtainB: '#1a3048',
    curtainC: '#0a1828',
  },
  zones: [
    {
      id: 'front',
      name: 'Immersion Zone',
      rowStart: 0,
      rowCount: 5,
      priceBase: 16,
      pricePerScore: 0.26,
      color: 0x2a5a8a,
      benefits: ['Giant FOV', 'High-back IMAX seat', 'Laser-aimed audio'],
    },
    {
      id: 'mid',
      name: 'Reference Row',
      rowStart: 5,
      rowCount: 6,
      priceBase: 22,
      pricePerScore: 0.34,
      color: 0x3a78b0,
      benefits: ['CTO sweet spot', 'Centre frame', 'Full surround bloom'],
    },
    {
      id: 'rear',
      name: 'Upper Stadium',
      rowStart: 11,
      rowCount: 5,
      priceBase: 18,
      pricePerScore: 0.28,
      color: 0x244868,
      benefits: ['Whole-screen read', 'Steep clear sightlines', 'Quick exit'],
    },
  ],
  seatsInRow: (rowIndex) => 20 + Math.min(4, Math.floor(rowIndex / 3)),
  featuredRow: 10,
  featuredSeatApprox: 12,
}

/** Large-format multiplex “grand” / XL auditorium — deeper house, wider banks. */
const GRAND: CinemaLayout = {
  id: 'grand',
  name: 'Grand XL',
  shortName: 'Grand XL',
  tagline: 'Premium large-format · 20 rows',
  formatTag: '4K Laser · Atmos',
  capacityHint: '~480 seats',
  hall: {
    width: 28,
    depth: 40,
    height: 11.5,
    screenW: 20,
    screenH: 10.5,
    screenZ: -17.2,
    screenY: 5.8,
    screenCurve: 0.9,
    aisleHalf: 1.0,
    seatSpacing: 0.64,
    rowSpacing: 1.08,
    firstRowZ: -8.5,
    rake: 0.38,
    seatY0: 0.18,
    sweetSpotDist: 18,
    orbitRadius: 40,
    orbitRadiusMax: 70,
  },
  theme: {
    carpet: '#4a2838',
    carpetAlt: '#3a1e2c',
    carpetSpeck: '#6a4050',
    wall: 0x3a2834,
    apron: 0x2a1e28,
    aisle: 0x5a3848,
    ceiling: '#2a2428',
    ceilingLine: '#3a3438',
    sconce: 0xffb060,
    frame: 0x2a1e28,
    curtainA: '#6a2038',
    curtainB: '#8a3050',
    curtainC: '#4a1828',
  },
  zones: [
    {
      id: 'front',
      name: 'Orchestra',
      rowStart: 0,
      rowCount: 6,
      priceBase: 11,
      pricePerScore: 0.2,
      color: 0xb03858,
      benefits: ['Big-screen punch', 'Recliner pitch', 'Snack deal'],
    },
    {
      id: 'mid',
      name: 'Premier Circle',
      rowStart: 6,
      rowCount: 8,
      priceBase: 17,
      pricePerScore: 0.3,
      color: 0xd05068,
      benefits: ['THX-style sweet spot', 'Extra legroom', 'Reserved mid-house'],
    },
    {
      id: 'rear',
      name: 'Gallery',
      rowStart: 14,
      rowCount: 6,
      priceBase: 13,
      pricePerScore: 0.24,
      color: 0x803848,
      benefits: ['Full tableau view', 'Quieter rake', 'Fast exit corridors'],
    },
  ],
  seatsInRow: (rowIndex) => 18 + Math.min(6, Math.floor(rowIndex / 3)),
  featuredRow: 12,
  featuredSeatApprox: 12,
}

/** Intimate boutique / VIP lounge — fewer wider seats, shallow rake. */
const BOUTIQUE: CinemaLayout = {
  id: 'boutique',
  name: 'Boutique Lounge',
  shortName: 'Boutique',
  tagline: 'VIP recliners · intimate room',
  formatTag: 'Dolby Vision',
  capacityHint: '~64 seats',
  hall: {
    width: 16,
    depth: 18,
    height: 7.2,
    screenW: 11,
    screenH: 5.8,
    screenZ: -7.6,
    screenY: 3.5,
    screenCurve: 0,
    aisleHalf: 0.95,
    seatSpacing: 0.85,
    rowSpacing: 1.35,
    firstRowZ: -3.4,
    rake: 0.22,
    seatY0: 0.12,
    sweetSpotDist: 9,
    orbitRadius: 20,
    orbitRadiusMax: 36,
  },
  theme: {
    carpet: '#3a2820',
    carpetAlt: '#2e2018',
    carpetSpeck: '#5a4030',
    wall: 0x2a201c,
    apron: 0x1e1814,
    aisle: 0x4a3830,
    ceiling: '#221c18',
    ceilingLine: '#322820',
    sconce: 0xe8c090,
    frame: 0x2a2018,
    curtainA: '#5a3020',
    curtainB: '#7a4030',
    curtainC: '#3a2018',
  },
  zones: [
    {
      id: 'front',
      name: 'Lounge Front',
      rowStart: 0,
      rowCount: 2,
      priceBase: 18,
      pricePerScore: 0.32,
      color: 0x8a5a38,
      benefits: ['Close & plush', 'Power recliner', 'In-seat service'],
    },
    {
      id: 'mid',
      name: 'Sofa Circle',
      rowStart: 2,
      rowCount: 3,
      priceBase: 26,
      pricePerScore: 0.4,
      color: 0xb07848,
      benefits: ['Calibrated view', 'Double-wide option', 'Welcome drink'],
    },
    {
      id: 'rear',
      name: 'Mezzanine',
      rowStart: 5,
      rowCount: 3,
      priceBase: 22,
      pricePerScore: 0.36,
      color: 0x6a4830,
      benefits: ['Private rear pods', 'Quietest seats', 'Coat hooks'],
    },
  ],
  seatsInRow: () => 8,
  featuredRow: 3,
  featuredSeatApprox: 4,
}

export const LAYOUTS: Record<CinemaLayoutId, CinemaLayout> = {
  standard: STANDARD,
  imax: IMAX,
  grand: GRAND,
  boutique: BOUTIQUE,
}

export const LAYOUT_ORDER: CinemaLayoutId[] = ['standard', 'imax', 'grand', 'boutique']

let active: CinemaLayout = STANDARD

/** Live hall dims — mutated when the active layout changes. */
export let HALL: HallDims = { ...STANDARD.hall }

/** Live zones for the active layout. */
export let ZONES: ZoneDef[] = STANDARD.zones

export let TOTAL_ROWS = ZONES.reduce((n, z) => n + z.rowCount, 0)

export const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function getLayout(): CinemaLayout {
  return active
}

export function setLayout(id: CinemaLayoutId): CinemaLayout {
  const next = LAYOUTS[id]
  if (!next) return active
  active = next
  HALL = { ...next.hall }
  ZONES = next.zones
  TOTAL_ROWS = next.zones.reduce((n, z) => n + z.rowCount, 0)
  return active
}

export function zoneForRow(rowIndex: number): ZoneDef {
  for (const z of ZONES) {
    if (rowIndex >= z.rowStart && rowIndex < z.rowStart + z.rowCount) return z
  }
  return ZONES[ZONES.length - 1]!
}

export function seatsInRow(rowIndex: number): number {
  return active.seatsInRow(rowIndex)
}
