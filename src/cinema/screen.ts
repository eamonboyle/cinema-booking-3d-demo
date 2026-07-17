import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type WebGLRenderer,
} from 'three'
import gsap from 'gsap'
import { canvasTexture } from '../shared/textures'
import { HALL } from './layout'

export type ScreenHandle = {
  group: Group
  glow: Mesh
  update: (t: number) => void
  openCurtains: (reduced: boolean) => Promise<void>
}

/** Animated film plate on the silver screen. */
export function createScreen(renderer: WebGLRenderer): ScreenHandle {
  const group = new Group()

  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 576
  const ctx = cv.getContext('2d')!
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()

  const plate = new Mesh(
    new PlaneGeometry(HALL.screenW, HALL.screenH),
    new MeshBasicMaterial({ map: tex }),
  )
  plate.position.set(0, HALL.screenY, HALL.screenZ + 0.04)
  group.add(plate)

  // Frame / proscenium
  const frameMat = new MeshLambertMaterial({ color: 0x3a2a30 })
  const thick = 0.35
  const fw = HALL.screenW + thick * 2
  const fh = HALL.screenH + thick * 2
  const top = new Mesh(new BoxGeometry(fw, thick, 0.4), frameMat)
  top.position.set(0, HALL.screenY + HALL.screenH / 2 + thick / 2, HALL.screenZ)
  const bot = new Mesh(new BoxGeometry(fw, thick * 1.4, 0.5), frameMat)
  bot.position.set(0, HALL.screenY - HALL.screenH / 2 - thick * 0.7, HALL.screenZ)
  const left = new Mesh(new BoxGeometry(thick, fh, 0.4), frameMat)
  left.position.set(-HALL.screenW / 2 - thick / 2, HALL.screenY, HALL.screenZ)
  const right = new Mesh(new BoxGeometry(thick, fh, 0.4), frameMat)
  right.position.set(HALL.screenW / 2 + thick / 2, HALL.screenY, HALL.screenZ)
  group.add(top, bot, left, right)

  // Soft glow plane behind screen (feeds bloom)
  const glow = new Mesh(
    new PlaneGeometry(HALL.screenW * 1.08, HALL.screenH * 1.08),
    new MeshBasicMaterial({
      color: 0xffe8c8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  )
  glow.position.set(0, HALL.screenY, HALL.screenZ - 0.08)
  group.add(glow)

  // Curtain wings (animatable)
  const curtainTex = canvasTexture(renderer, 128, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, '#8a2840')
    g.addColorStop(0.45, '#b03850')
    g.addColorStop(1, '#6a2034')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.globalAlpha = 0.3
    for (let i = 0; i < 18; i++) {
      x.fillStyle = i % 2 ? '#5a1830' : '#c04860'
      x.fillRect((i / 18) * w, 0, w / 28, h)
    }
    x.globalAlpha = 1
  })
  const curtainMat = new MeshLambertMaterial({ map: curtainTex })
  const cw = 3.2
  const ch = HALL.height - 1.2
  const curtains: Mesh[] = []
  const curtainClosedX = [
    -(HALL.screenW / 2 + cw * 0.15),
    HALL.screenW / 2 + cw * 0.15,
  ]
  const curtainOpenX = [
    -(HALL.screenW / 2 + cw * 0.95),
    HALL.screenW / 2 + cw * 0.95,
  ]
  ;[-1, 1].forEach((side, i) => {
    const c = new Mesh(new PlaneGeometry(cw, ch), curtainMat)
    c.position.set(curtainClosedX[i]!, ch / 2 + 0.4, HALL.screenZ + 0.2)
    group.add(c)
    curtains.push(c)
    void side
  })

  // Traveller curtain across screen (rises / parts on intro)
  const traveller = new Mesh(
    new PlaneGeometry(HALL.screenW + 0.4, HALL.screenH + 0.6),
    new MeshLambertMaterial({ map: curtainTex }),
  )
  traveller.position.set(0, HALL.screenY, HALL.screenZ + 0.12)
  group.add(traveller)

  let lastPaint = -1
  const FRAME_DT = 1 / 20

  function paintFilm(t: number): void {
    const w = cv.width
    const h = cv.height
    ctx.fillStyle = '#0a0c12'
    ctx.fillRect(0, 0, w, h)

    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55)
    sky.addColorStop(0, '#1a2744')
    sky.addColorStop(0.55, '#3a4f6e')
    sky.addColorStop(1, '#c4a574')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h * 0.58)

    const ground = ctx.createLinearGradient(0, h * 0.55, 0, h)
    ground.addColorStop(0, '#2a2218')
    ground.addColorStop(1, '#0e0c0a')
    ctx.fillStyle = ground
    ctx.fillRect(0, h * 0.55, w, h * 0.45)

    // City lights
    ctx.globalAlpha = 0.55
    for (let i = 0; i < 40; i++) {
      const bx = ((i * 97 + t * 12) % w)
      const by = h * 0.42 + (i % 7) * 6
      ctx.fillStyle = i % 3 ? '#f0c868' : '#88aaff'
      ctx.fillRect(bx, by, 3, 3)
    }
    ctx.globalAlpha = 1

    ctx.strokeStyle = 'rgba(232, 200, 120, 0.35)'
    ctx.lineWidth = 3
    const vanishX = w * 0.5 + Math.sin(t * 0.15) * 40
    const vanishY = h * 0.52
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(vanishX, vanishY)
      ctx.lineTo(w * 0.5 + i * w * 0.18, h)
      ctx.stroke()
    }

    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.08 + i * 0.2) % 1)
      const y = h * 0.56 + p * h * 0.38
      const scale = 0.25 + p * 1.4
      const x = vanishX + Math.sin(i * 2.1 + t * 0.3) * (40 + p * 120)
      ctx.fillStyle = i % 2 ? '#1a1a22' : '#2a1818'
      ctx.fillRect(x - 28 * scale, y - 10 * scale, 56 * scale, 16 * scale)
      ctx.fillStyle = '#f0d080'
      ctx.globalAlpha = 0.7
      ctx.fillRect(x + 18 * scale, y - 4 * scale, 8 * scale, 4 * scale)
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = 'rgba(242, 235, 224, 0.92)'
    ctx.font = '700 42px "Oswald", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('NIGHT DRIVE', w / 2, h * 0.28)
    ctx.font = '400 20px "Manrope", sans-serif'
    ctx.fillStyle = 'rgba(242, 235, 224, 0.55)'
    ctx.fillText('A Feature Presentation', w / 2, h * 0.34)

    // Lighter grain (throttled already)
    ctx.globalAlpha = 0.07
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    ctx.globalAlpha = 1

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h * 0.06)
    ctx.fillRect(0, h * 0.94, w, h * 0.06)

    tex.needsUpdate = true
  }

  paintFilm(0)

  function openCurtains(reduced: boolean): Promise<void> {
    return new Promise((resolve) => {
      const dur = reduced ? 0.2 : 1.6
      let pending = 2
      const done = () => {
        pending -= 1
        if (pending <= 0) resolve()
      }
      gsap.to(traveller.position, {
        y: HALL.screenY + HALL.screenH + 1.2,
        duration: dur,
        ease: 'power2.inOut',
        onComplete: done,
      })
      gsap.to(traveller.scale, {
        y: 0.02,
        duration: dur,
        ease: 'power2.inOut',
      })
      curtains.forEach((c, i) => {
        gsap.to(c.position, {
          x: curtainOpenX[i]!,
          duration: dur * 0.9,
          delay: reduced ? 0 : 0.15,
          ease: 'power2.inOut',
          onComplete: i === curtains.length - 1 ? done : undefined,
        })
      })
    })
  }

  return {
    group,
    glow,
    openCurtains,
    update(t: number) {
      if (lastPaint < 0 || t - lastPaint >= FRAME_DT) {
        paintFilm(t)
        lastPaint = t
      }
    },
  }
}
