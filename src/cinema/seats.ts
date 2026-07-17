import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MathUtils,
  MeshPhongMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three'
import { mergeBoxes } from '../shared/geometry'
import { GpuPicker } from '../shared/picking'
import type { PerspectiveCamera, WebGLRenderer } from 'three'
import {
  HALL,
  ROW_LETTERS,
  TOTAL_ROWS,
  zoneForRow,
  seatsInRow,
  type ZoneDef,
} from './layout'

export type SeatInfo = {
  i: number
  row: number
  rowLetter: string
  seat: number
  zone: ZoneDef
  score: number
  price: number
  avail: boolean
  pos: Vector3
}

export type SeatSystem = {
  seatMesh: InstancedMesh
  picker: GpuPicker
  count: number
  meta: {
    pos: Float32Array
    row: Uint8Array
    seatNum: Uint16Array
    zoneIdx: Uint8Array
    rowStart: Uint32Array
    rowCount: Uint16Array
    avail: Uint8Array
  }
  baseColors: Float32Array
  seatInfo: (i: number) => SeatInfo
  eyeFor: (i: number) => Vector3
  lookFor: () => Vector3
  paintSeat: (i: number, r: number, g: number, b: number) => void
  restoreSeat: (i: number) => void
  tintRange: (start: number, count: number, mul: number) => void
  featuredIdx: number
  flushColors: () => void
}

function seatGeometry() {
  const pan = new BoxGeometry(0.5, 0.07, 0.48)
  pan.translate(0, 0.48, 0.04)
  const back = new BoxGeometry(0.5, 0.62, 0.08)
  back.rotateX(-0.18)
  back.translate(0, 0.82, -0.22)
  const armsL = new BoxGeometry(0.08, 0.22, 0.42)
  armsL.translate(-0.28, 0.58, 0.02)
  const armsR = new BoxGeometry(0.08, 0.22, 0.42)
  armsR.translate(0.28, 0.58, 0.02)
  const ped = new BoxGeometry(0.36, 0.42, 0.3)
  ped.translate(0, 0.21, 0.02)
  return mergeBoxes([pan, back, armsL, armsR, ped])
}

export function buildSeats(
  scene: Scene,
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  rng: () => number,
): SeatSystem {
  // Count seats
  let count = 0
  const rowLayouts: { n: number; z: number; y: number; left: number; right: number }[] = []
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const n = seatsInRow(r)
    const z = HALL.firstRowZ + r * HALL.rowSpacing
    const y = HALL.seatY0 + r * HALL.rake
    // Split around centre aisle
    const half = Math.floor(n / 2)
    rowLayouts.push({ n, z, y, left: half, right: n - half })
    count += n
  }

  const geo = seatGeometry()
  const mat = new MeshPhongMaterial({ shininess: 28, specular: 0x2a1a1c })
  const seatMesh = new InstancedMesh(geo, mat, count)
  seatMesh.frustumCulled = false

  const pickGeo = new BoxGeometry(0.58, 1.15, 0.55)
  pickGeo.translate(0, 0.58, 0)
  const picker = new GpuPicker(renderer, camera, pickGeo, count)

  const meta = {
    pos: new Float32Array(count * 3),
    row: new Uint8Array(count),
    seatNum: new Uint16Array(count),
    zoneIdx: new Uint8Array(count),
    rowStart: new Uint32Array(count),
    rowCount: new Uint16Array(count),
    avail: new Uint8Array(count),
  }
  const baseColors = new Float32Array(count * 3)
  const zoneList = ['front', 'mid', 'rear'] as const

  const dummy = new Object3D()
  const jitter = new Color()
  let idx = 0
  let featuredIdx = -1

  for (let r = 0; r < TOTAL_ROWS; r++) {
    const layout = rowLayouts[r]!
    const zone = zoneForRow(r)
    const zoneIdx = zoneList.indexOf(zone.id)
    const rowStart = idx
    const totalW =
      (layout.left - 1) * HALL.seatSpacing +
      HALL.aisleHalf * 2 +
      (layout.right - 1) * HALL.seatSpacing +
      HALL.seatSpacing

    // Left bank (negative X)
    for (let q = 0; q < layout.left; q++) {
      const x =
        -HALL.aisleHalf -
        HALL.seatSpacing / 2 -
        (layout.left - 1 - q) * HALL.seatSpacing
      placeSeat(idx, x, layout.y, layout.z, r, q + 1, zone, zoneIdx, rowStart, layout.n, rng)
      // Featured: mid zone centre-ish
      if (zone.id === 'mid' && r === 6 && q === layout.left - 1) featuredIdx = idx
      idx++
    }
    // Right bank
    for (let q = 0; q < layout.right; q++) {
      const x = HALL.aisleHalf + HALL.seatSpacing / 2 + q * HALL.seatSpacing
      placeSeat(
        idx,
        x,
        layout.y,
        layout.z,
        r,
        layout.left + q + 1,
        zone,
        zoneIdx,
        rowStart,
        layout.n,
        rng,
      )
      if (featuredIdx < 0 && zone.id === 'mid' && r === 6 && q === 0) featuredIdx = idx
      idx++
    }
    void totalW
  }

  function placeSeat(
    i: number,
    x: number,
    y: number,
    z: number,
    row: number,
    seatNum: number,
    zone: ZoneDef,
    zoneIdx: number,
    rowStart: number,
    rowCount: number,
    rngFn: () => number,
  ) {
    dummy.position.set(x, y, z)
    // Face the screen (−Z); backrest toward the rear of the house
    dummy.rotation.set(0, Math.PI, 0)
    dummy.updateMatrix()
    seatMesh.setMatrixAt(i, dummy.matrix)
    picker.pickMesh.setMatrixAt(i, dummy.matrix)

    const unavailable =
      rngFn() < 0.38 &&
      !(zone.id === 'mid' && row === 6 && Math.abs(seatNum - 9) <= 1)

    jitter.setHex(zone.color)
    jitter.offsetHSL(
      (rngFn() - 0.5) * 0.02,
      (rngFn() - 0.5) * 0.06,
      (rngFn() - 0.5) * 0.12,
    )
    if (unavailable) jitter.multiplyScalar(0.55)
    seatMesh.setColorAt(i, jitter)
    baseColors[i * 3] = jitter.r
    baseColors[i * 3 + 1] = jitter.g
    baseColors[i * 3 + 2] = jitter.b

    meta.pos[i * 3] = x
    meta.pos[i * 3 + 1] = y
    meta.pos[i * 3 + 2] = z
    meta.row[i] = row
    meta.seatNum[i] = seatNum
    meta.zoneIdx[i] = zoneIdx
    meta.rowStart[i] = rowStart
    meta.rowCount[i] = rowCount
    meta.avail[i] = unavailable ? 0 : 1
  }

  seatMesh.instanceMatrix.needsUpdate = true
  picker.pickMesh.instanceMatrix.needsUpdate = true
  if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true
  scene.add(seatMesh)

  // Occupied patrons
  {
    const occ: number[] = []
    for (let i = 0; i < count; i++) if (!meta.avail[i]) occ.push(i)
    const torsoGeo = (() => {
      const body = new BoxGeometry(0.4, 0.48, 0.28)
      body.translate(0, 0.88, -0.02)
      const lap = new BoxGeometry(0.38, 0.12, 0.36)
      lap.translate(0, 0.58, 0.12)
      return mergeBoxes([body, lap])
    })()
    const headGeo = new SphereGeometry(0.13, 7, 5)
    headGeo.translate(0, 1.22, -0.02)
    const torsoMat = new MeshPhongMaterial({ shininess: 8 })
    const headMat = new MeshPhongMaterial({ shininess: 12 })
    const torsos = new InstancedMesh(torsoGeo, torsoMat, occ.length)
    const heads = new InstancedMesh(headGeo, headMat, occ.length)
    torsos.frustumCulled = false
    heads.frustumCulled = false
    const cloth = [0x1a1a22, 0xe8e0d4, 0x2a4a6e, 0x4a2a1a, 0x1a3a2a, 0x3a1a3a]
    const skins = [0x8d5a3b, 0xc98d63, 0xeac1a4, 0x6b4226, 0xa5714b]
    const dm = new Object3D()
    const cc = new Color()
    occ.forEach((si, k) => {
      dm.position.set(meta.pos[si * 3]!, meta.pos[si * 3 + 1]!, meta.pos[si * 3 + 2]!)
      dm.rotation.set(0, Math.PI + (rng() - 0.5) * 0.25, 0)
      const sc = 0.92 + rng() * 0.14
      dm.scale.setScalar(sc)
      dm.updateMatrix()
      torsos.setMatrixAt(k, dm.matrix)
      heads.setMatrixAt(k, dm.matrix)
      cc.setHex(cloth[(rng() * cloth.length) | 0]!)
      torsos.setColorAt(k, cc)
      cc.setHex(skins[(rng() * skins.length) | 0]!)
      heads.setColorAt(k, cc)
    })
    torsos.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    if (torsos.instanceColor) torsos.instanceColor.needsUpdate = true
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true
    scene.add(torsos, heads)
  }

  if (featuredIdx < 0) featuredIdx = Math.floor(count / 2)

  const tmpC = new Color()

  function seatScore(i: number): number {
    const z = meta.pos[i * 3 + 2]!
    const x = meta.pos[i * 3]!
    const dist = Math.abs(z - HALL.screenZ)
    // Sweet spot ~ mid rows, near centre
    const distPenalty = MathUtils.clamp(Math.abs(dist - 14) / 12, 0, 1) * 22
    const sidePenalty = (Math.abs(x) / (HALL.width / 2)) * 14
    const rakeBonus = MathUtils.clamp((meta.pos[i * 3 + 1]! - 0.5) / 3, 0, 1) * 6
    return Math.round(MathUtils.clamp(94 - distPenalty - sidePenalty + rakeBonus, 52, 99))
  }

  function seatPrice(i: number, score: number): number {
    const zone = zoneForRow(meta.row[i]!)
    return Math.round(zone.priceBase + score * zone.pricePerScore)
  }

  function seatInfo(i: number): SeatInfo {
    const zone = zoneForRow(meta.row[i]!)
    const score = seatScore(i)
    return {
      i,
      row: meta.row[i]! + 1,
      rowLetter: ROW_LETTERS[meta.row[i]!] ?? '?',
      seat: meta.seatNum[i]!,
      zone,
      score,
      price: seatPrice(i, score),
      avail: !!meta.avail[i],
      pos: new Vector3(meta.pos[i * 3], meta.pos[i * 3 + 1], meta.pos[i * 3 + 2]),
    }
  }

  function eyeFor(i: number): Vector3 {
    return new Vector3(
      meta.pos[i * 3],
      meta.pos[i * 3 + 1]! + 1.15,
      meta.pos[i * 3 + 2]! + 0.08,
    )
  }

  function lookFor(): Vector3 {
    return new Vector3(0, HALL.screenY, HALL.screenZ)
  }

  function paintSeat(i: number, r: number, g: number, b: number) {
    tmpC.setRGB(r, g, b)
    seatMesh.setColorAt(i, tmpC)
  }

  function restoreSeat(i: number) {
    paintSeat(i, baseColors[i * 3]!, baseColors[i * 3 + 1]!, baseColors[i * 3 + 2]!)
  }

  function tintRange(start: number, countN: number, mul: number) {
    for (let i = start; i < start + countN; i++) {
      paintSeat(
        i,
        Math.min(1, baseColors[i * 3]! * mul),
        Math.min(1, baseColors[i * 3 + 1]! * mul),
        Math.min(1, baseColors[i * 3 + 2]! * mul),
      )
    }
  }

  function flushColors() {
    if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true
  }

  return {
    seatMesh,
    picker,
    count,
    meta,
    baseColors,
    seatInfo,
    eyeFor,
    lookFor,
    paintSeat,
    restoreSeat,
    tintRange,
    featuredIdx,
    flushColors,
  }
}
