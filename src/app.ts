import './style.css'
import gsap from 'gsap'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CatmullRomCurve3,
  Color,
  HemisphereLight,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
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
  renderHallPicker,
  syncShowcard,
} from './ui/overlay'
import { drawMinimap, drawSeatMap, hitTestSeatMap } from './ui/minimap'
import {
  LAYOUT_ORDER,
  LAYOUTS,
  getLayout,
  setLayout,
  type CinemaLayoutId,
} from './cinema/layout'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SEL = new Color(0xe8a838)
const HOV = new Color(0xf0c56a)
const GROUP = new Color(0xf0c56a)
const FAV_KEY = 'framesight-favs'
const LAYOUT_KEY = 'framesight-layout'

function homeOrbit() {
  const h = getLayout().hall
  return { theta: -Math.PI / 2 + 0.35, phi: 1.05, radius: h.orbitRadius }
}

export function startApp(root: HTMLElement): void {
  const ui = mountOverlay(root)
  const rng = mulberry32(20260717)

  try {
    const saved = localStorage.getItem(LAYOUT_KEY) as CinemaLayoutId | null
    if (saved && LAYOUTS[saved]) setLayout(saved)
  } catch {
    /* ignore */
  }

  let HOME = homeOrbit()

  const renderer = new WebGLRenderer({
    canvas: ui.canvas,
    antialias: false,
    powerPreference: 'default',
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25))
  renderer.setSize(innerWidth, innerHeight)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.35
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap

  const scene = new Scene()
  scene.background = new Color(0x1a1418)

  const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.15, 220)
  const hemi = new HemisphereLight(0xffe8d8, 0x3a2428, 1.15)
  const amb = new AmbientLight(0xfff0e4, 0.85)
  scene.add(hemi, amb)

  ui.loaderText.textContent = 'Raising the curtain…'
  let hall = buildAuditorium(scene, renderer)
  let screen = createScreen(renderer)
  scene.add(screen.group)

  ui.loaderText.textContent = 'Placing seats…'
  let seats = buildSeats(scene, renderer, camera, rng)

  let orbitRadiusMin = 12
  let orbitRadiusMax = getLayout().hall.orbitRadiusMax

  // Soft bloom — half-res blur for far less fill cost
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloomRes = new Vector2(
    Math.max(1, Math.floor(innerWidth * 0.5)),
    Math.max(1, Math.floor(innerHeight * 0.5)),
  )
  const bloom = new UnrealBloomPass(bloomRes, 0.28, 0.55, 0.85)
  composer.addPass(bloom)

  const audio = new TheatreAudio()
  const orbit = createOrbit(HOME, new Vector3(0, getLayout().hall.screenY * 0.45, -1))
  let lastOrbit = { ...HOME }

  function applyLayoutMeta() {
    const layout = getLayout()
    syncShowcard(ui, {
      screenName: layout.name,
      formatTag: layout.formatTag,
      tagline: layout.tagline,
    })
    HOME = homeOrbit()
    orbitRadiusMin = Math.max(10, layout.hall.orbitRadius * 0.4)
    orbitRadiusMax = layout.hall.orbitRadiusMax
    orbit.target.set(0, layout.hall.screenY * 0.45, -1)
  }

  type Mode = 'orbit' | 'fly' | 'seat'
  let mode: Mode = 'orbit'
  let is2D = false
  let confirmed = false
  let hoverIdx = -1
  let selectedIdx = -1
  const selectedGroup = new Set<number>()
  const favourites = loadFavs()
  let currentInfo: SeatInfo | null = null
  let panelRevealed = false
  let houseLevel = { v: 1 }

  const seatView = {
    eye: new Vector3(),
    yawBase: 0,
    pitchBase: 0,
    yawOff: 0,
    pitchOff: 0,
  }
  const seatLookDir = new Vector3()
  const seatLookAt = new Vector3()

  // Demand-driven render: only burn GPU when something actually changed
  let dirty = true
  let looping = false
  let filmActive = true
  let lastHoverPick = 0
  let lastMmX = Number.NaN
  let lastMmZ = Number.NaN
  const ORBIT_EPS = 1e-4
  const HOVER_PICK_MS = 90

  function invalidate() {
    dirty = true
    schedule()
  }

  function schedule() {
    if (looping || document.hidden) return
    looping = true
    requestAnimationFrame(tick)
  }

  const clock0 = performance.now()
  function tick() {
    looping = false
    if (document.hidden) return

    const t = (performance.now() - clock0) / 1000
    let keepGoing = false

    if (filmActive) {
      screen.update(t)
      dirty = true
      keepGoing = true
    }

    if (mode === 'orbit') {
      clampOrbit(orbit, 0.25, 1.35, orbitRadiusMin, orbitRadiusMax)
      const dx = Math.abs(orbit.thetaT - orbit.theta)
      const dy = Math.abs(orbit.phiT - orbit.phi)
      const dr = Math.abs(orbit.radiusT - orbit.radius)
      if (dx > ORBIT_EPS || dy > ORBIT_EPS || dr > ORBIT_EPS) {
        dampOrbit(orbit, 0.14)
        applyOrbit(camera, orbit)
        dirty = true
        keepGoing = true
      } else {
        orbit.theta = orbit.thetaT
        orbit.phi = orbit.phiT
        orbit.radius = orbit.radiusT
      }
      if (pendingHover) {
        const now = performance.now()
        if (now - lastHoverPick >= HOVER_PICK_MS) {
          lastHoverPick = now
          const hx = pendingHover.x
          const hy = pendingHover.y
          pendingHover = null
          const idx = seats.picker.pickAt(hx, hy, ui.canvas)
          setHover(idx)
          if (idx >= 0) showTip(hx + 16, hy + 16, seats.seatInfo(idx))
          else hideTip()
          dirty = true
        } else {
          keepGoing = true
        }
      }
    } else if (mode === 'seat') {
      const yaw = seatView.yawBase + seatView.yawOff
      const pitch = seatView.pitchBase + seatView.pitchOff
      seatLookDir.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      camera.position.copy(seatView.eye)
      seatLookAt.copy(seatView.eye).add(seatLookDir)
      camera.lookAt(seatLookAt)
    }

    if (dirty) {
      const cx = camera.position.x
      const cz = camera.position.z
      if (
        Number.isNaN(lastMmX) ||
        Math.abs(cx - lastMmX) > 0.08 ||
        Math.abs(cz - lastMmZ) > 0.08
      ) {
        drawMinimap(ui.mm, cx, camera.position.y, cz)
        lastMmX = cx
        lastMmZ = cz
      }
      composer.render()
      dirty = false
    }

    if (keepGoing || dirty) schedule()
  }

  function loadFavs(): Set<number> {
    try {
      const raw = localStorage.getItem(`${FAV_KEY}-${getLayout().id}`)
      if (!raw) return new Set()
      return new Set(JSON.parse(raw) as number[])
    } catch {
      return new Set()
    }
  }

  function saveFavs() {
    localStorage.setItem(`${FAV_KEY}-${getLayout().id}`, JSON.stringify([...favourites]))
  }

  function syncFavButton() {
    const on = selectedIdx >= 0 && favourites.has(selectedIdx)
    ui.fav.classList.toggle('on', on)
    ui.fav.setAttribute('aria-pressed', on ? 'true' : 'false')
  }

  function groupStats() {
    const idxs = selectedGroup.size > 0 ? [...selectedGroup] : selectedIdx >= 0 ? [selectedIdx] : []
    let total = 0
    for (const i of idxs) total += seats.seatInfo(i).price
    return { count: idxs.length, total, idxs }
  }

  function refreshMap() {
    drawSeatMap(ui.ov, seats, selectedGroup.size ? selectedGroup : selectedIdx, {
      favourites,
    })
  }

  function paintSelectionColors() {
    // Restore all then re-tint
    for (let i = 0; i < seats.count; i++) seats.restoreSeat(i)
    if (selectedIdx >= 0) {
      const rs = seats.meta.rowStart[selectedIdx]!
      const rc = seats.meta.rowCount[selectedIdx]!
      for (let n = Math.max(rs, selectedIdx - 2); n <= Math.min(rs + rc - 1, selectedIdx + 2); n++) {
        seats.tintRange(n, 1, 1.35)
      }
    }
    for (const i of selectedGroup) {
      seats.seatMesh.setColorAt(i, selectedGroup.size > 1 ? GROUP : SEL)
    }
    if (selectedIdx >= 0) seats.seatMesh.setColorAt(selectedIdx, SEL)
    if (confirmed) seats.setConfirmedGlow(groupStats().idxs)
    seats.flushColors()
    invalidate()
  }

  function applySelection(i: number, opts?: { add?: boolean; fly?: boolean }) {
    if (i < 0) return
    if (opts?.add && seats.meta.avail[i]) {
      if (selectedGroup.has(i) && selectedGroup.size > 1) selectedGroup.delete(i)
      else selectedGroup.add(i)
      selectedIdx = selectedGroup.has(i) ? i : [...selectedGroup][0]!
    } else {
      selectedGroup.clear()
      selectedGroup.add(i)
      selectedIdx = i
    }
    confirmed = false
    seats.clearConfirmedGlow()
    paintSelectionColors()
    refreshMap()
    const info = seats.seatInfo(selectedIdx)
    currentInfo = info
    syncFavButton()
    if (panelRevealed) {
      updateSeatPanel(ui, info, confirmed ? 'confirmed' : 'browsing', groupStats())
    }
    writeDeepLink(info)
    if (opts?.fly) flyToSeat(i)
  }

  function setHover(i: number) {
    if (i === hoverIdx) return
    if (hoverIdx >= 0 && !selectedGroup.has(hoverIdx)) seats.restoreSeat(hoverIdx)
    if (hoverIdx >= 0 && !selectedGroup.has(hoverIdx)) {
      const oldRow = seats.meta.row[hoverIdx]!
      if (selectedIdx < 0 || seats.meta.row[selectedIdx] !== oldRow) {
        const rs = seats.meta.rowStart[hoverIdx]!
        seats.tintRange(rs, seats.meta.rowCount[hoverIdx]!, 1)
        // restore group colors after row tint
        for (const s of selectedGroup) {
          seats.seatMesh.setColorAt(s, selectedGroup.size > 1 ? GROUP : SEL)
        }
        if (selectedIdx >= 0) seats.seatMesh.setColorAt(selectedIdx, SEL)
      }
    }
    hoverIdx = i
    if (i >= 0) {
      const rs = seats.meta.rowStart[i]!
      seats.tintRange(rs, seats.meta.rowCount[i]!, 1.2)
      if (!selectedGroup.has(i)) seats.seatMesh.setColorAt(i, HOV)
      for (const s of selectedGroup) {
        seats.seatMesh.setColorAt(s, selectedGroup.size > 1 ? GROUP : SEL)
      }
      if (selectedIdx >= 0) seats.seatMesh.setColorAt(selectedIdx, SEL)
    }
    seats.flushColors()
    invalidate()
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

  function dimHouse(target: number, duration: number) {
    gsap.to(houseLevel, {
      v: target,
      duration: REDUCED ? 0.15 : duration,
      ease: 'power2.inOut',
      onUpdate() {
        hall.setHouseLevel(houseLevel.v)
        hemi.intensity = 1.15 * (0.35 + houseLevel.v * 0.65)
        amb.intensity = 0.85 * (0.25 + houseLevel.v * 0.75)
        hall.screenWash.intensity = MathUtils.lerp(42, 28, houseLevel.v)
        hall.screenBounce.intensity = MathUtils.lerp(22, 12, houseLevel.v)
        const beamMat = hall.beam.material as { opacity: number }
        beamMat.opacity = MathUtils.lerp(0.28, 0.12, houseLevel.v)
        bloom.strength = MathUtils.lerp(0.55, 0.22, houseLevel.v)
        invalidate()
      },
      onComplete: invalidate,
    })
  }

  function enterSeatMode(info: SeatInfo) {
    mode = 'seat'
    ui.canvas.classList.add('seatmode')
    seats.setLabelsVisible(false)
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
    audio.setLevel(0.02)
    audio.setHum(0.018)
    dimHouse(0.22, 1.1)
    panelRevealed = true
    updateSeatPanel(ui, info, 'previewing', groupStats())
    captureView(info.i)
    invalidate()
  }

  function flyToSeat(i: number) {
    if (!seats.meta.avail[i]) return
    const info = seats.seatInfo(i)
    currentInfo = info
    confirmed = false
    seats.clearConfirmedGlow()
    setHover(-1)
    hideTip()
    if (!selectedGroup.has(i)) {
      selectedGroup.clear()
      selectedGroup.add(i)
    }
    selectedIdx = i
    paintSelectionColors()
    refreshMap()
    syncFavButton()
    writeDeepLink(info)
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
        invalidate()
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
    seats.setLabelsVisible(true)
    dimHouse(1, 1.0)
    audio.setHum(0)
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
        invalidate()
      },
      onComplete() {
        mode = 'orbit'
        if (currentInfo) {
          updateSeatPanel(
            ui,
            currentInfo,
            confirmed ? 'confirmed' : 'browsing',
            groupStats(),
          )
        }
        invalidate()
      },
    })
    audio.setLevel(0.015)
  }

  function grabSeat() {
    if (!currentInfo || confirmed) return
    const g = groupStats()
    if (g.count === 0) return
    confirmed = true
    seats.setConfirmedGlow(g.idxs)
    updateSeatPanel(ui, currentInfo, 'confirmed', g)
    const label =
      g.count === 1
        ? `Row ${currentInfo.rowLetter} · Seat ${currentInfo.seat} is yours`
        : `${g.count} seats reserved · €${g.total}`
    toast(ui, label)
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
    ui.tip.setAttribute('aria-hidden', 'false')
  }
  function hideTip() {
    ui.tip.style.opacity = '0'
    ui.tip.setAttribute('aria-hidden', 'true')
  }

  function writeDeepLink(info: SeatInfo) {
    const url = new URL(location.href)
    url.searchParams.set('row', info.rowLetter)
    url.searchParams.set('seat', String(info.seat))
    history.replaceState(null, '', url)
  }

  function clearDeepLink() {
    const url = new URL(location.href)
    if (!url.searchParams.has('row') && !url.searchParams.has('seat')) return
    url.searchParams.delete('row')
    url.searchParams.delete('seat')
    history.replaceState(null, '', url)
  }

  function findNearestAvailable(idx: number): number {
    const rs = seats.meta.rowStart[idx]!
    const re = rs + seats.meta.rowCount[idx]! - 1
    for (let d = 1; d < seats.meta.rowCount[idx]!; d++) {
      if (idx - d >= rs && seats.meta.avail[idx - d]) return idx - d
      if (idx + d <= re && seats.meta.avail[idx + d]) return idx + d
    }
    return -1
  }

  function selectSeatFromPick(idx: number, add: boolean) {
    if (idx < 0) return
    if (seats.meta.avail[idx]) {
      if (add) {
        applySelection(idx, { add: true })
        toast(ui, `Group · ${groupStats().count} seat${groupStats().count > 1 ? 's' : ''}`)
      } else {
        flyToSeat(idx)
      }
    } else {
      // Occupied bounce cue via brief toast + nearest
      const found = findNearestAvailable(idx)
      if (found >= 0) {
        toast(ui, 'That seat is taken — nearest free seat in the row')
        if (add) applySelection(found, { add: true })
        else flyToSeat(found)
      } else toast(ui, 'That row is sold out — try another')
    }
  }

  function navigateSeat(delta: number) {
    if (mode !== 'orbit' && mode !== 'seat') return
    const start = selectedIdx >= 0 ? selectedIdx : seats.featuredIdx
    let i = start
    for (let n = 0; n < seats.count; n++) {
      i = (i + delta + seats.count) % seats.count
      if (seats.meta.avail[i]) {
        if (mode === 'seat') flyToSeat(i)
        else applySelection(i)
        toast(ui, `Row ${seats.seatInfo(i).rowLetter} · Seat ${seats.seatInfo(i).seat}`)
        return
      }
    }
  }

  function goBestSeat() {
    const best = seats.bestAvailable()
    toast(ui, 'Best available — flying you in')
    flyToSeat(best)
  }

  // Pointer
  const pointers = new Map<number, { x: number; y: number }>()
  let dragStart: { x: number; y: number; t: number; shift: boolean } | null = null
  let dragMoved = 0
  let pinchDist = 0
  let pendingHover: { x: number; y: number } | null = null

  ui.canvas.addEventListener('pointerdown', (e) => {
    ui.canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now(), shift: e.shiftKey }
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
      if (mode === 'orbit') {
        pendingHover = { x: e.clientX, y: e.clientY }
        schedule()
      }
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
        orbit.radiusT = MathUtils.clamp(
          orbit.radiusT * (pinchDist / d),
          orbitRadiusMin,
          orbitRadiusMax,
        )
        invalidate()
      }
      pinchDist = d
      return
    }
    if (mode === 'orbit') {
      orbit.thetaT -= dx * 0.005
      orbit.phiT = MathUtils.clamp(orbit.phiT - dy * 0.0035, 0.25, 1.35)
      hideTip()
      invalidate()
    } else if (mode === 'seat') {
      seatView.yawOff = MathUtils.clamp(seatView.yawOff - dx * 0.003, -1.1, 1.1)
      seatView.pitchOff = MathUtils.clamp(seatView.pitchOff + dy * 0.0022, -0.4, 0.45)
      invalidate()
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
      selectSeatFromPick(idx, dragStart.shift)
    }
    dragStart = null
  }
  ui.canvas.addEventListener('pointerup', endPointer)
  ui.canvas.addEventListener('pointercancel', endPointer)
  ui.canvas.addEventListener('pointerleave', () => {
    if (mode === 'orbit') {
      setHover(-1)
      hideTip()
      invalidate()
    }
    pendingHover = null
  })

  ui.canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (mode === 'orbit') {
        orbit.radiusT = MathUtils.clamp(
          orbit.radiusT * (1 + e.deltaY * 0.0012),
          orbitRadiusMin,
          orbitRadiusMax,
        )
        invalidate()
      } else if (mode === 'seat') {
        camera.fov = MathUtils.clamp(camera.fov + e.deltaY * 0.02, 28, 65)
        camera.updateProjectionMatrix()
        invalidate()
      }
    },
    { passive: false },
  )

  // 2D seat map interaction
  ui.ovCanvas.style.cursor = 'pointer'
  ui.ovCanvas.addEventListener('pointerdown', (e) => {
    const rect = ui.ovCanvas.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / rect.width) * ui.ovCanvas.width
    const sy = ((e.clientY - rect.top) / rect.height) * ui.ovCanvas.height
    const idx = hitTestSeatMap(sx, sy)
    if (idx >= 0) selectSeatFromPick(idx, e.shiftKey)
    audio.ensure()
  })
  ui.ovCanvas.addEventListener('pointermove', (e) => {
    const rect = ui.ovCanvas.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / rect.width) * ui.ovCanvas.width
    const sy = ((e.clientY - rect.top) / rect.height) * ui.ovCanvas.height
    const idx = hitTestSeatMap(sx, sy)
    ui.ovCanvas.style.cursor = idx >= 0 ? 'pointer' : 'default'
  })

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'seat') exitSeatMode()
    if (e.key === 'Enter' && mode === 'seat' && !confirmed) grabSeat()
    if (e.key === '[' || e.key === 'PageUp') {
      e.preventDefault()
      navigateSeat(-1)
    }
    if (e.key === ']' || e.key === 'PageDown') {
      e.preventDefault()
      navigateSeat(1)
    }
    if (e.key === 'b' && !e.metaKey && !e.ctrlKey) goBestSeat()
    if (mode === 'orbit') {
      if (e.key === 'ArrowLeft') {
        orbit.thetaT += 0.1
        invalidate()
      }
      if (e.key === 'ArrowRight') {
        orbit.thetaT -= 0.1
        invalidate()
      }
      if (e.key === 'ArrowUp') {
        orbit.phiT = Math.max(0.25, orbit.phiT - 0.08)
        invalidate()
      }
      if (e.key === 'ArrowDown') {
        orbit.phiT = Math.min(1.35, orbit.phiT + 0.08)
        invalidate()
      }
      if (e.key === '+' || e.key === '=') {
        orbit.radiusT = Math.max(orbitRadiusMin, orbit.radiusT - 2)
        invalidate()
      }
      if (e.key === '-') {
        orbit.radiusT = Math.min(orbitRadiusMax, orbit.radiusT + 2)
        invalidate()
      }
    }
  })

  ui.bkExit.addEventListener('click', exitSeatMode)
  ui.bkSnd.addEventListener('click', () => {
    const muted = audio.toggleMute()
    ui.bkSnd.style.opacity = muted ? '0.4' : '1'
    audio.setLevel(mode === 'seat' ? 0.02 : 0.015)
    audio.setHum(mode === 'seat' ? 0.018 : 0)
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
  ui.fav.addEventListener('click', () => {
    if (selectedIdx < 0) {
      toast(ui, 'Pick a seat first')
      return
    }
    if (favourites.has(selectedIdx)) {
      favourites.delete(selectedIdx)
      toast(ui, 'Removed from favourites')
    } else {
      favourites.add(selectedIdx)
      toast(ui, `Saved Row ${seats.seatInfo(selectedIdx).rowLetter} · Seat ${seats.seatInfo(selectedIdx).seat}`)
    }
    saveFavs()
    syncFavButton()
    refreshMap()
  })

  ui.bestBtn.addEventListener('click', goBestSeat)
  ui.dBest.addEventListener('click', goBestSeat)

  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      const id = (a as HTMLElement).dataset.nav
      if (id === 'auditorium') {
        goHome()
        toast(ui, 'Auditorium view')
      } else if (id === 'showtimes') {
        toast(ui, 'Tonight · 19:40 · Screen 3 — you’re looking at it')
      } else {
        if (selectedIdx >= 0) flyToSeat(selectedIdx)
        else goBestSeat()
      }
    })
  })

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
      onUpdate: invalidate,
      onComplete: invalidate,
    })
    is2D = false
    ui.d3d.textContent = '3D'
    ui.d3d.classList.add('active')
    ui.d3d.setAttribute('aria-pressed', 'true')
  }
  ui.dReset.addEventListener('click', goHome)
  ui.dZin.addEventListener('click', () => {
    if (mode === 'orbit') {
      orbit.radiusT = MathUtils.clamp(orbit.radiusT * 0.86, orbitRadiusMin, orbitRadiusMax)
      invalidate()
    }
  })
  ui.dZout.addEventListener('click', () => {
    if (mode === 'orbit') {
      orbit.radiusT = MathUtils.clamp(orbit.radiusT * 1.16, orbitRadiusMin, orbitRadiusMax)
      invalidate()
    }
  })
  ui.d3d.addEventListener('click', () => {
    if (mode !== 'orbit') return
    is2D = !is2D
    ui.d3d.textContent = is2D ? '2D' : '3D'
    ui.d3d.classList.toggle('active', !is2D)
    ui.d3d.setAttribute('aria-pressed', is2D ? 'false' : 'true')
    gsap.to(orbit, {
      phiT: is2D ? 0.28 : HOME.phi,
      radiusT: is2D ? HOME.radius * 1.28 : HOME.radius,
      duration: REDUCED ? 0.1 : 1,
      ease: 'power2.inOut',
      onUpdate: invalidate,
      onComplete: invalidate,
    })
  })

  ui.sheetPeek.addEventListener('click', () => {
    const collapsed = ui.rightcol.classList.toggle('collapsed')
    ui.sheetPeek.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    ui.sheetPeek.textContent = collapsed ? 'Show seat details' : 'Seat details'
  })

  function onResize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    composer.setSize(innerWidth, innerHeight)
    bloom.setSize(
      Math.max(1, Math.floor(innerWidth * 0.5)),
      Math.max(1, Math.floor(innerHeight * 0.5)),
    )
    invalidate()
  }
  addEventListener('resize', onResize)
  onResize()

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) invalidate()
  })

  // Boot with no seat until the user picks one
  clearDeepLink()
  selectedIdx = -1
  selectedGroup.clear()
  currentInfo = null
  paintSelectionColors()
  refreshMap()
  syncFavButton()
  applyLayoutMeta()

  function mountHallPicker() {
    renderHallPicker(
      ui,
      LAYOUT_ORDER.map((id) => ({
        id,
        shortName: LAYOUTS[id].shortName,
        capacityHint: `${LAYOUTS[id].name} · ${LAYOUTS[id].capacityHint}`,
      })),
      getLayout().id,
      (id) => {
        void switchHall(id as CinemaLayoutId)
      },
    )
  }

  async function switchHall(id: CinemaLayoutId) {
    if (id === getLayout().id) return
    if (mode === 'fly') {
      toast(ui, 'Wait for the camera, then switch halls')
      return
    }

    // Force out of seat preview without the fly-back animation
    if (mode === 'seat') {
      gsap.killTweensOf(orbit)
      gsap.killTweensOf(houseLevel)
      mode = 'orbit'
      ui.canvas.classList.remove('seatmode')
      ui.backbar.classList.remove('show')
      ui.sbHint.classList.remove('show')
      ui.dock.classList.remove('hidden')
      seats.setLabelsVisible(true)
      audio.setHum(0)
      dimHouse(1, 0.35)
    }

    setHover(-1)
    hideTip()
    selectedIdx = -1
    selectedGroup.clear()
    favourites.clear()
    // Reload favs for the destination layout after setLayout
    confirmed = false
    currentInfo = null
    clearDeepLink()

    gsap.killTweensOf(orbit)
    gsap.killTweensOf(houseLevel)

    hall.dispose()
    scene.remove(screen.group)
    screen.dispose()
    seats.dispose()

    setLayout(id)
    try {
      localStorage.setItem(LAYOUT_KEY, id)
    } catch {
      /* ignore */
    }

    for (const i of loadFavs()) favourites.add(i)

    applyLayoutMeta()
    mountHallPicker()

    toast(ui, `${getLayout().name} · ${getLayout().tagline}`, 2800)

    hall = buildAuditorium(scene, renderer)
    screen = createScreen(renderer)
    scene.add(screen.group)
    seats = buildSeats(scene, renderer, camera, rng)

    HOME = homeOrbit()
    lastOrbit = { ...HOME }
    orbit.theta = orbit.thetaT = HOME.theta
    orbit.phi = orbit.phiT = HOME.phi
    orbit.radius = orbit.radiusT = HOME.radius
    applyOrbit(camera, orbit)
    hall.setHouseLevel(1)
    houseLevel.v = 1
    hemi.intensity = 1.15
    amb.intensity = 0.85
    bloom.strength = 0.28

    filmActive = true
    screen.setAnimating(true)
    await screen.openCurtains(true)
    filmActive = false
    screen.setAnimating(false)

    paintSelectionColors()
    refreshMap()
    syncFavButton()
    updateSeatPanel(ui, null, 'empty')
    panelRevealed = true
    lastMmX = Number.NaN
    invalidate()
  }

  mountHallPicker()

  applyOrbit(camera, orbit)
  hall.setHouseLevel(1)
  audio.setLevel(0.012)

  async function playIntro() {
    ui.loaderText.textContent = 'Lights down…'
    dimHouse(0.45, 0.8)
    await screen.openCurtains(REDUCED)
    ui.loader.classList.add('done')
    setTimeout(() => ui.loader.remove(), 700)

    // Camera sweep then settle; reveal panel after
    const sweep = { ...HOME, theta: HOME.theta - 0.55, radius: HOME.radius * 1.2 }
    orbit.theta = orbit.thetaT = sweep.theta
    orbit.phi = orbit.phiT = sweep.phi
    orbit.radius = orbit.radiusT = sweep.radius
    applyOrbit(camera, orbit)

    await new Promise<void>((resolve) => {
      gsap.to(orbit, {
        thetaT: HOME.theta,
        phiT: HOME.phi,
        radiusT: HOME.radius,
        duration: REDUCED ? 0.2 : 2.2,
        ease: 'power2.inOut',
        onUpdate: () => {
          applyOrbit(camera, orbit)
          invalidate()
        },
        onComplete: () => resolve(),
      })
    })

    dimHouse(1, 0.9)
    // Freeze film plate in orbit — biggest idle CPU/GPU win
    filmActive = false
    screen.setAnimating(false)
    panelRevealed = true
    updateSeatPanel(ui, null, 'empty')
    invalidate()
    ui.orbitHint.classList.add('show')
    setTimeout(() => ui.orbitHint.classList.remove('show'), 5200)
  }

  void playIntro()

  // Mobile cam footer hint
  if (matchMedia('(max-width: 1100px)').matches) {
    ui.camFooter.textContent = 'Tap a seat in 3D · ★ for best available'
  }
}
