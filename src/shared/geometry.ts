import {
  BufferGeometry,
  Float32BufferAttribute,
  type Material,
  Mesh,
} from 'three'

/** Merge transformed BufferGeometries into one (stadium pattern). */
export function mergeBoxes(parts: BufferGeometry[]): BufferGeometry {
  const pos: number[] = []
  const norm: number[] = []
  for (const g of parts) {
    const gg = g.index ? g.toNonIndexed() : g
    pos.push(...(gg.attributes.position.array as ArrayLike<number> as number[]))
    norm.push(...(gg.attributes.normal.array as ArrayLike<number> as number[]))
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new Float32BufferAttribute(norm, 3))
  return out
}

export function ringStrip(
  rx1: number,
  rz1: number,
  y1: number,
  rx2: number,
  rz2: number,
  y2: number,
  seg: number,
  mat: Material,
  repU = 10,
): Mesh {
  const TAU = Math.PI * 2
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU
    const c = Math.cos(a)
    const s = Math.sin(a)
    pos.push(rx1 * c, y1, rz1 * s, rx2 * c, y2, rz2 * s)
    uv.push((i / seg) * repU, 0, (i / seg) * repU, 1)
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new Mesh(g, mat)
  m.matrixAutoUpdate = false
  return m
}
