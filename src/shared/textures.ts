import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three'

export function canvasTexture(
  renderer: WebGLRenderer,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repX = 0,
  repY = 0,
): CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  draw(ctx, w, h)
  const t = new CanvasTexture(cv)
  t.anisotropy = renderer.capabilities.getMaxAnisotropy()
  t.colorSpace = SRGBColorSpace
  if (repX || repY) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repX || 1, repY || 1)
  }
  return t
}
