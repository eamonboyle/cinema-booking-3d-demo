import './style.css'
import gsap from 'gsap'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CatmullRomCurve3,
  Color,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { TheatreAudio } from './shared/audio'
import { mulberry32 } from './shared/rng'
import { applyOrbit, clampOrbit, createOrbit, dampOrbit } from './shared/orbit'
import { buildAuditorium } from './cinema/auditorium'
import { buildSeats, type SeatInfo } from './cinema/seats'
import { createScreen } from './cinema/screen'
import {
  mountOverlay,
  toast,
  updateSeatPanel,
} from './ui/overlay'
import { drawMinimap, drawSeatMap } from './ui/minimap'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const HOME = { theta: -Math.PI / 2 + 0.35, phi: 1.05, radius: 28 }
const SEL = new Color(0xe8a838)
const HOV = new Color(0xf0c56a)

export function startApp(root: HTMLElement): void {
  const ui = mountOverlay(root)
  const rng = mulberry32(20260717)

  const renderer = new WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.35
  renderer.shadowMap.enabled = true

  const scene = new Scene()
  scene.background = new Color(0x1a1418)
  scene.fog = null

  const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.15, 200)
  scene.add(new HemisphereLight(0xffe8d8, 0x3a2428, 1.15))
  scene.add(new AmbientLight(0xfff0e4, 0.85))

  ui.loaderText.textContent = 'Raising the curtain…'
  buildAuditorium(scene, renderer)
  const screen = createScreen(renderer)
  scene.add(screen.group)

  ui.loaderText.textContent = 'Placing seats…'
  const seats = buildSeats(scene, renderer, camera, rng)

  const audio = new TheatreAudio()
  const orbit = createOrbit(HOME, new Vector3(0, 2.8, -1))
  let lastOrbit = { ...HOME }

  type Mode = 'orbit' | 'fly' | 'seat'
  let mode: Mode = 'orbit'
  let is2D = false
  let confirmed = false
  let hoverIdx = -1
  let selectedIdx = -1
  let currentInfo: SeatInfo | null = null

  const seatView = {
    eye: new Vector3(),
    yawBase: 0,
    pitchBase: 0,
    yawOff: 0,
    pitchOff: 0,
  }

  function applySelection(i: number) {
    if (selectedIdx >= 0) {
      const rs = seats.meta.rowStart[selectedIdx]!
      const rc = seats.meta.rowCount[selectedIdx]!
      seats.tintRange(rs, rc, 1)
    }
    selectedIdx = i
    if (i >= 0) {
      const rs = seats.meta.rowStart[i]!
      const rc = seats.meta.rowCount[i]!
      for (let n = Math.max(rs, i - 2); n <= Math.min(rs + rc - 1, i + 2); n++) {
        seats.tintRange(n, 1, 1.35)
      }
      seats.seatMesh.setColorAt(i, SEL)
    }
    seats.flushColors()
    drawSeatMap(ui.ov, seats, selectedIdx)
  }

  function setHover(i: number) {
    if (i === hoverIdx) return
    if (hoverIdx >= 0 && hoverIdx !== selectedIdx) seats.restoreSeat(hoverIdx)
    if (hoverIdx >= 0 && hoverIdx !== selectedIdx) {
      const oldRow = seats.meta.row[hoverIdx]!
      // restore row tint if not selected row
      if (selectedIdx < 0 || seats.meta.row[selectedIdx] !== oldRow) {
        const rs = seats.meta.rowStart[hoverIdx]!
        seats.tintRange(rs, seats.meta.rowCount[hoverIdx]!, 1)
      }
    }
    hoverIdx = i
    if (i >= 0) {
      const rs = seats.meta.rowStart[i]!
      seats.tintRange(rs, seats.meta.rowCount[i]!, 1.2)
      if (i !== selectedIdx) seats.seatMesh.setColorAt(i, HOV)
    }
    if (selectedIdx >= 0) seats.seatMesh.setColorAt(selectedIdx, SEL)
    seats.flushColors()
  }

  function captureView(i: number) {
    const eye = seats.eyeFor(i)
    const look = seats.lookFor()
    const sp = camera.position.clone()
    const sq = camera.quaternion.clone()
    const sf = camera.fov
    camera.position.copy(eye)
    camera.lookAt(look)
    camera.fov = 52
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const oc = document.createElement('canvas')
    oc.width = 480
    oc.height = 270
    oc.getContext('2d')!.drawImage(renderer.domElement, 0, 0, oc.width, oc.height)
    ui.pImg.src = oc.toDataURL('image/jpeg', 0.78)
    ui.pImg.classList.add('ready')
    ui.pPh.style.display = 'none'
    camera.position.copy(sp)
    camera.quaternion.copy(sq)
    camera.fov = sf
    camera.updateProjectionMatrix()
  }

  function enterSeatMode(info: SeatInfo) {
    mode = 'seat'
    ui.canvas.classList.add('seatmode')
    seatView.eye.copy(seats.eyeFor(info.i))
    const d = seats.lookFor().sub(seatView.eye)
    seatView.yawBase = Math.atan2(d.x, d.z)
    seatView.pitchBase = Math.asin(MathUtils.clamp(d.y / d.length(), -1, 1))
    seatView.yawOff = 0
    seatView.pitchOff = 0
    camera.fov = 52
    camera.updateProjectionMatrix()
    ui.dock.classList.add('hidden')
    ui.backbar.classList.add('show')
    ui.sbHint.classList.add('show')
    setTimeout(() => ui.sbHint.classList.remove('show'), 4000)
    audio.setLevel(0.035)
    captureView(info.i)
  }

  function flyToSeat(i: number) {
    const info = seats.seatInfo(i)
    currentInfo = info
    confirmed = false
    setHover(-1)
    hideTip()
    applySelection(i)
    updateSeatPanel(ui, info, 'previewing')
    ui.pImg.classList.remove('ready')
    ui.pPh.style.display = 'grid'
    if (mode === 'orbit') {
      lastOrbit = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius }
    }
    mode = 'fly'
    const eye = seats.eyeFor(i)
    const look = seats.lookFor()
    const startLook = new Vector3()
    camera.getWorldDirection(startLook).multiplyScalar(20).add(camera.position)
    const p0 = camera.position.clone()
    const p1 = p0.clone().lerp(eye, 0.35)
    p1.y = Math.max(p0.y, eye.y) + 6
    const p2 = eye.clone().add(new Vector3(0, 2.5, 3))
    const curve = new CatmullRomCurve3([p0, p1, p2, eye], false, 'catmullrom', 0.35)
    const st = { t: 0 }
    const lp = new Vector3()
    const startFov = camera.fov
    gsap.to(st, {
      t: 1,
      duration: REDUCED ? 0.6 : 2.6,
      ease: 'power3.inOut',
      onUpdate() {
        curve.getPoint(st.t, camera.position)
        lp.copy(startLook).lerp(look, MathUtils.smoothstep(st.t, 0.15, 0.9))
        camera.lookAt(lp)
        camera.fov = MathUtils.lerp(startFov, 52, MathUtils.smoothstep(st.t, 0.3, 1))
        camera.updateProjectionMatrix()
      },
      onComplete() {
        enterSeatMode(info)
      },
    })
    audio.ensure()
    audio.setLevel(0.02)
  }

  function exitSeatMode() {
    if (mode !== 'seat') return
    mode = 'fly'
    ui.canvas.classList.remove('seatmode')
    ui.backbar.classList.remove('show')
    ui.sbHint.classList.remove('show')
    ui.dock.classList.remove('hidden')
    orbit.theta = orbit.thetaT = lastOrbit.theta
    orbit.phi = orbit.phiT = lastOrbit.phi
    orbit.radius = orbit.radiusT = lastOrbit.radius
    const sp = Math.sin(lastOrbit.phi)
    const dest = new Vector3(
      orbit.target.x + lastOrbit.radius * sp * Math.cos(lastOrbit.theta),
      orbit.target.y + lastOrbit.radius * Math.cos(lastOrbit.phi),
      orbit.target.z + lastOrbit.radius * sp * Math.sin(lastOrbit.theta),
    )
    const p0 = camera.position.clone()
    const p1 = p0.clone().lerp(dest, 0.45)
    p1.y = Math.max(p0.y, dest.y) + 5
    const curve = new CatmullRomCurve3([p0, p1, dest], false, 'catmullrom', 0.4)
    const startLook = new Vector3()
    camera.getWorldDirection(startLook).multiplyScalar(20).add(camera.position)
    const st = { t: 0 }
    const lp = new Vector3()
    const startFov = camera.fov
    gsap.to(st, {
      t: 1,
      duration: REDUCED ? 0.5 : 1.8,
      ease: 'power3.inOut',
      onUpdate() {
        curve.getPoint(st.t, camera.position)
        lp.copy(startLook).lerp(orbit.target, MathUtils.smoothstep(st.t, 0.1, 0.85))
        camera.lookAt(lp)
        camera.fov = MathUtils.lerp(startFov, 50, MathUtils.smoothstep(st.t, 0, 0.7))
        camera.updateProjectionMatrix()
      },
      onComplete() {
        mode = 'orbit'
        if (currentInfo) updateSeatPanel(ui, currentInfo, confirmed ? 'confirmed' : 'suggested')
      },
    })
    audio.setLevel(0.015)
  }

  function grabSeat() {
    if (!currentInfo || confirmed) return
    confirmed = true
    updateSeatPanel(ui, currentInfo, 'confirmed')
    toast(
      ui,
      `Row ${currentInfo.rowLetter} · Seat ${currentInfo.seat} is yours`,
    )
  }

  function showTip(x: number, y: number, info: SeatInfo) {
    ui.tip1.textContent = `Row ${info.rowLetter} · Seat ${info.seat}`
    ui.tip2.textContent = info.avail
      ? `€${info.price} · ${info.score}% screen`
      : 'Unavailable'
    ui.tip2.style.color = info.avail ? '' : '#8a7a72'
    ui.tip.style.left = `${Math.min(x, innerWidth - 200)}px`
    ui.tip.style.top = `${y}px`
    ui.tip.style.opacity = '1'
  }
  function hideTip() {
    ui.tip.style.opacity = '0'
  }

  // Pointer
  const pointers = new Map<number, { x: number; y: number }>()
  let dragStart: { x: number; y: number; t: number } | null = null
  let dragMoved = 0
  let pinchDist = 0
  let pendingHover: { x: number; y: number } | null = null

  ui.canvas.addEventListener('pointerdown', (e) => {
    ui.canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now() }
    dragMoved = 0
    if (pointers.size === 2) {
      const p = [...pointers.values()]
      pinchDist = Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y)
    }
    ui.canvas.classList.add('dragging')
    audio.ensure()
  })

  ui.canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      if (mode === 'orbit') pendingHover = { x: e.clientX, y: e.clientY }
      return
    }
    const prev = pointers.get(e.pointerId)!
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragMoved += Math.abs(dx) + Math.abs(dy)
    if (pointers.size === 2) {
      const p = [...pointers.values()]
      const d = Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y)
      if (pinchDist > 0 && mode === 'orbit') {
        orbit.radiusT = MathUtils.clamp(orbit.radiusT * (pinchDist / d), 12, 48)
      }
      pinchDist = d
      return
    }
    if (mode === 'orbit') {
      orbit.thetaT -= dx * 0.005
      orbit.phiT = MathUtils.clamp(orbit.phiT - dy * 0.0035, 0.25, 1.35)
      hideTip()
    } else if (mode === 'seat') {
      seatView.yawOff = MathUtils.clamp(seatView.yawOff - dx * 0.003, -1.1, 1.1)
      seatView.pitchOff = MathUtils.clamp(seatView.pitchOff + dy * 0.0022, -0.4, 0.45)
    }
  })

  function endPointer(e: PointerEvent) {
    ui.canvas.classList.remove('dragging')
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    pinchDist = 0
    if (
      dragStart &&
      mode === 'orbit' &&
      dragMoved < 7 &&
      performance.now() - dragStart.t < 520
    ) {
      const idx = seats.picker.pickAt(e.clientX, e.clientY, ui.canvas)
      if (idx >= 0) {
        if (seats.meta.avail[idx]) flyToSeat(idx)
        else {
          const rs = seats.meta.rowStart[idx]!
          const re = rs + seats.meta.rowCount[idx]! - 1
          let found = -1
          for (let d = 1; d < seats.meta.rowCount[idx]!; d++) {
            if (idx - d >= rs && seats.meta.avail[idx - d]) {
              found = idx - d
              break
            }
            if (idx + d <= re && seats.meta.avail[idx + d]) {
              found = idx + d
              break
            }
          }
          if (found >= 0) {
            toast(ui, 'That seat is taken — nearest free seat in the row')
            flyToSeat(found)
          } else toast(ui, 'That row is sold out — try another')
        }
      }
    }
    dragStart = null
  }
  ui.canvas.addEventListener('pointerup', endPointer)
  ui.canvas.addEventListener('pointercancel', endPointer)
  ui.canvas.addEventListener('pointerleave', () => {
    if (mode === 'orbit') {
      setHover(-1)
      hideTip()
    }
    pendingHover = null
  })

  ui.canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (mode === 'orbit') {
        orbit.radiusT = MathUtils.clamp(orbit.radiusT * (1 + e.deltaY * 0.0012), 12, 48)
      } else if (mode === 'seat') {
        camera.fov = MathUtils.clamp(camera.fov + e.deltaY * 0.02, 28, 65)
        camera.updateProjectionMatrix()
      }
    },
    { passive: false },
  )

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'seat') exitSeatMode()
    if (e.key === 'Enter' && mode === 'seat' && !confirmed) grabSeat()
    if (mode === 'orbit') {
      if (e.key === 'ArrowLeft') orbit.thetaT += 0.1
      if (e.key === 'ArrowRight') orbit.thetaT -= 0.1
      if (e.key === 'ArrowUp') orbit.phiT = Math.max(0.25, orbit.phiT - 0.08)
      if (e.key === 'ArrowDown') orbit.phiT = Math.min(1.35, orbit.phiT + 0.08)
      if (e.key === '+' || e.key === '=') orbit.radiusT = Math.max(12, orbit.radiusT - 2)
      if (e.key === '-') orbit.radiusT = Math.min(48, orbit.radiusT + 2)
    }
  })

  ui.bkExit.addEventListener('click', exitSeatMode)
  ui.bkSnd.addEventListener('click', () => {
    const muted = audio.toggleMute()
    ui.bkSnd.style.opacity = muted ? '0.4' : '1'
    audio.setLevel(mode === 'seat' ? 0.035 : 0.015)
  })
  ui.checkout.addEventListener('click', () => {
    if (confirmed) {
      toast(ui, 'Seat reserved — checkout isn’t wired in this demo', 3000)
      return
    }
    if (mode === 'seat') {
      grabSeat()
      return
    }
    if (selectedIdx >= 0 && mode === 'orbit') {
      toast(ui, 'Taking you there — reserve once you like the view')
      flyToSeat(selectedIdx)
    }
  })
  ui.fav.addEventListener('click', () => ui.fav.classList.toggle('on'))

  function goHome() {
    if (mode === 'seat') {
      exitSeatMode()
      return
    }
    if (mode !== 'orbit') return
    gsap.to(orbit, {
      thetaT: HOME.theta,
      phiT: HOME.phi,
      radiusT: HOME.radius,
      duration: REDUCED ? 0.1 : 1.1,
      ease: 'power2.inOut',
    })
    is2D = false
    ui.d3d.textContent = '3D'
  }
  ui.dReset.addEventListener('click', goHome)
  ui.dZin.addEventListener('click', () => {
    if (mode === 'orbit') orbit.radiusT = MathUtils.clamp(orbit.radiusT * 0.86, 12, 48)
  })
  ui.dZout.addEventListener('click', () => {
    if (mode === 'orbit') orbit.radiusT = MathUtils.clamp(orbit.radiusT * 1.16, 12, 48)
  })
  ui.d3d.addEventListener('click', () => {
    if (mode !== 'orbit') return
    is2D = !is2D
    ui.d3d.textContent = is2D ? '2D' : '3D'
    gsap.to(orbit, {
      phiT: is2D ? 0.28 : HOME.phi,
      radiusT: is2D ? 36 : HOME.radius,
      duration: REDUCED ? 0.1 : 1,
      ease: 'power2.inOut',
    })
  })

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
  })

  // Featured seat
  const featured = seats.seatInfo(seats.featuredIdx)
  applySelection(seats.featuredIdx)
  updateSeatPanel(ui, featured, 'suggested')
  currentInfo = featured
  drawSeatMap(ui.ov, seats, selectedIdx)

  applyOrbit(camera, orbit)
  ui.loader.classList.add('done')
  setTimeout(() => ui.loader.remove(), 700)

  // Capture initial thumbnail after first frame
  requestAnimationFrame(() => captureView(seats.featuredIdx))

  const clock0 = performance.now()
  function tick() {
    const t = (performance.now() - clock0) / 1000
    screen.update(t)

    if (mode === 'orbit') {
      clampOrbit(orbit, 0.25, 1.35, 12, 48)
      dampOrbit(orbit, 0.14)
      applyOrbit(camera, orbit)
      if (pendingHover && performance.now() % 3 < 2) {
        const idx = seats.picker.pickAt(pendingHover.x, pendingHover.y, ui.canvas)
        setHover(idx)
        if (idx >= 0) showTip(pendingHover.x + 16, pendingHover.y + 16, seats.seatInfo(idx))
        else hideTip()
        pendingHover = null
      }
    } else if (mode === 'seat') {
      const yaw = seatView.yawBase + seatView.yawOff
      const pitch = seatView.pitchBase + seatView.pitchOff
      const dir = new Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      camera.position.copy(seatView.eye)
      camera.lookAt(seatView.eye.clone().add(dir))
    }

    drawMinimap(ui.mm, camera.position.x, camera.position.y, camera.position.z)
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
