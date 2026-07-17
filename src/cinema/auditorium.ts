import {
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  PointLight,
  SpotLight,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { canvasTexture } from '../shared/textures'
import { HALL, getLayout, type HallTheme } from './layout'

export type AuditoriumHandle = {
  root: Group
  setHouseLevel: (level: number) => void
  screenWash: SpotLight
  screenBounce: SpotLight
  beam: Mesh
  dispose: () => void
}

function disposeObject(obj: Object3D) {
  obj.traverse((child) => {
    const mesh = child as Mesh
    if (mesh.isMesh) {
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        if (!m) continue
        const map = (m as MeshLambertMaterial).map
        map?.dispose()
        m.dispose()
      }
    }
  })
}

export function buildAuditorium(scene: Scene, renderer: WebGLRenderer): AuditoriumHandle {
  const layout = getLayout()
  const theme: HallTheme = layout.theme
  const root = new Group()
  root.name = 'auditorium'
  const houseLights: { intensity: number; light: PointLight | DirectionalLight }[] = []

  const carpetTex = canvasTexture(renderer, 256, 256, (x, w, h) => {
    x.fillStyle = theme.carpet
    x.fillRect(0, 0, w, h)
    x.globalAlpha = 0.28
    for (let i = 0; i < 40; i++) {
      x.fillStyle = i % 2 ? theme.carpetAlt : theme.carpetSpeck
      x.fillRect(0, (i / 40) * h, w, h / 55)
    }
    x.globalAlpha = 0.12
    for (let i = 0; i < 1200; i++) {
      x.fillStyle = Math.random() > 0.5 ? theme.carpetAlt : theme.carpetSpeck
      x.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    x.globalAlpha = 1
  }, 8, 10)
  const floor = new Mesh(
    new PlaneGeometry(HALL.width + 6, HALL.depth + 6),
    new MeshLambertMaterial({ map: carpetTex }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, 2)
  floor.receiveShadow = true
  root.add(floor)

  const wallMat = new MeshLambertMaterial({ color: theme.wall })
  const wallL = new Mesh(new BoxGeometry(0.4, HALL.height, HALL.depth + 2), wallMat)
  wallL.position.set(-HALL.width / 2 - 0.2, HALL.height / 2, 1)
  wallL.receiveShadow = true
  const wallR = wallL.clone()
  wallR.position.x = HALL.width / 2 + 0.2
  root.add(wallL, wallR)

  // Acoustic baffles along side walls
  const baffleMat = new MeshLambertMaterial({ color: theme.wall })
  baffleMat.color.offsetHSL(0, 0, -0.06)
  const baffleCount = Math.max(4, Math.round(HALL.depth / 5))
  for (let i = 0; i < baffleCount; i++) {
    const z = -HALL.depth * 0.35 + i * (HALL.depth * 0.7) / Math.max(1, baffleCount - 1)
    for (const side of [-1, 1] as const) {
      const baffle = new Mesh(
        new BoxGeometry(0.22, HALL.height * 0.55, 1.4),
        baffleMat,
      )
      baffle.position.set(side * (HALL.width / 2 - 0.55), HALL.height * 0.42, z)
      baffle.rotation.y = side * 0.12
      root.add(baffle)
    }
  }

  const back = new Mesh(
    new BoxGeometry(HALL.width + 2, HALL.height, 0.4),
    wallMat,
  )
  back.position.set(0, HALL.height / 2, HALL.depth / 2 - 1)
  root.add(back)

  const ceilTex = canvasTexture(renderer, 128, 128, (x, w, h) => {
    x.fillStyle = theme.ceiling
    x.fillRect(0, 0, w, h)
    x.strokeStyle = theme.ceilingLine
    x.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      x.strokeRect(i * 16 + 2, 2, 12, 12)
      x.strokeRect(i * 16 + 2, 66, 12, 12)
    }
  }, 12, 8)
  const ceiling = new Mesh(
    new PlaneGeometry(HALL.width + 2, HALL.depth + 2),
    new MeshLambertMaterial({ map: ceilTex }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, HALL.height - 0.05, 1)
  root.add(ceiling)

  const apron = new Mesh(
    new BoxGeometry(HALL.screenW + 4, 0.35, 2.2),
    new MeshLambertMaterial({ color: theme.apron }),
  )
  apron.position.set(0, 0.15, HALL.screenZ + 1.4)
  root.add(apron)

  // Stadium step platforms under each row
  const riserMat = new MeshLambertMaterial({ color: theme.apron })
  const totalRows = layout.zones.reduce((n, z) => n + z.rowCount, 0)
  for (let r = 1; r < totalRows; r++) {
    const y = HALL.seatY0 + r * HALL.rake
    const z = HALL.firstRowZ + r * HALL.rowSpacing
    const step = new Mesh(
      new BoxGeometry(HALL.width - 1.2, 0.14, HALL.rowSpacing * 0.94),
      riserMat,
    )
    step.position.set(0, y - 0.07, z)
    step.receiveShadow = true
    root.add(step)
  }

  const aisle = new Mesh(
    new PlaneGeometry(HALL.aisleHalf * 2, HALL.depth * 0.72),
    new MeshLambertMaterial({ color: theme.aisle }),
  )
  aisle.rotation.x = -Math.PI / 2
  aisle.position.set(0, 0.025, 2)
  aisle.receiveShadow = true
  root.add(aisle)

  // Side aisles for wide houses
  if (HALL.width >= 26) {
    for (const side of [-1, 1] as const) {
      const sideAisle = new Mesh(
        new PlaneGeometry(0.9, HALL.depth * 0.65),
        new MeshLambertMaterial({ color: theme.aisle }),
      )
      sideAisle.rotation.x = -Math.PI / 2
      sideAisle.position.set(side * (HALL.width * 0.38), 0.025, 1)
      root.add(sideAisle)
    }
  }

  const exitMat = new MeshBasicMaterial({ color: 0x4db87a })
  ;[
    [-HALL.width / 2 + 0.5, 2.4, HALL.depth / 2 - 1.5],
    [HALL.width / 2 - 0.5, 2.4, HALL.depth / 2 - 1.5],
  ].forEach(([x, y, z]) => {
    const sign = new Mesh(new BoxGeometry(0.9, 0.28, 0.08), exitMat)
    sign.position.set(x!, y!, z!)
    root.add(sign)
  })

  const shadowSpan = Math.max(HALL.width, HALL.depth) * 0.55
  const houseFill = new DirectionalLight(0xfff2e4, 1.55)
  houseFill.position.set(4, HALL.height + 4, 8)
  houseFill.castShadow = true
  houseFill.shadow.mapSize.set(512, 512)
  houseFill.shadow.camera.near = 2
  houseFill.shadow.camera.far = 50
  houseFill.shadow.camera.left = -shadowSpan
  houseFill.shadow.camera.right = shadowSpan
  houseFill.shadow.camera.top = shadowSpan
  houseFill.shadow.camera.bottom = -shadowSpan * 0.6
  houseFill.shadow.bias = -0.001
  root.add(houseFill)
  houseLights.push({ light: houseFill, intensity: 1.55 })

  const houseFill2 = new DirectionalLight(0xffe0c8, 0.85)
  houseFill2.position.set(-6, HALL.height, -2)
  root.add(houseFill2)
  houseLights.push({ light: houseFill2, intensity: 0.85 })

  const lightRows = Math.max(2, Math.round(HALL.depth / 12))
  for (let i = 0; i < lightRows; i++) {
    const z = HALL.firstRowZ + 2 + i * ((HALL.depth * 0.55) / Math.max(1, lightRows - 1))
    const pl = new PointLight(0xfff0e0, 2.8, 18 + HALL.width * 0.15, 1.4)
    pl.position.set(0, HALL.height - 1.2, z)
    root.add(pl)
    houseLights.push({ light: pl, intensity: 2.8 })
  }

  const sconceMat = new MeshBasicMaterial({ color: theme.sconce })
  const sconceCount = Math.max(4, Math.round(HALL.depth / 5.5))
  for (let i = 0; i < sconceCount; i++) {
    const z = HALL.screenZ + 3 + i * ((HALL.depth * 0.7) / Math.max(1, sconceCount - 1))
    ;[-1, 1].forEach((side) => {
      const bulb = new Mesh(new CylinderGeometry(0.08, 0.1, 0.15, 8), sconceMat)
      bulb.position.set(side * (HALL.width / 2 - 0.35), 2.8, z)
      root.add(bulb)
    })
  }
  for (const side of [-1, 1] as const) {
    const pl = new PointLight(0xffc878, 2.4, 16 + HALL.width * 0.1, 1.5)
    pl.position.set(side * (HALL.width / 2 - 0.35), 2.8, 2)
    root.add(pl)
    houseLights.push({ light: pl, intensity: 2.4 })
  }

  const wash = new SpotLight(0xfff4e8, 28, 60, Math.PI / 2.6, 0.45, 1)
  wash.position.set(0, HALL.height - 1.5, Math.max(4, HALL.depth * 0.2))
  wash.target.position.set(0, HALL.screenY, HALL.screenZ)
  root.add(wash, wash.target)

  const screenBounce = new SpotLight(0xffe8d0, 12, 40, Math.PI / 2.4, 0.6, 1.1)
  screenBounce.position.set(0, HALL.screenY, HALL.screenZ + 1)
  screenBounce.target.position.set(0, 2, HALL.firstRowZ + 8)
  root.add(screenBounce, screenBounce.target)

  const booth = new Mesh(
    new BoxGeometry(3.5, 1.8, 1.2),
    new MeshLambertMaterial({ color: 0x2a2226 }),
  )
  booth.position.set(0, HALL.height - 1.2, HALL.depth / 2 - 2.2)
  root.add(booth)

  const beamLen = Math.abs(HALL.screenZ) + HALL.depth * 0.15
  const beam = new Mesh(
    new PlaneGeometry(0.4, beamLen),
    new MeshBasicMaterial({
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  )
  beam.position.set(0, HALL.height * 0.55, (HALL.screenZ + HALL.depth * 0.25) * 0.5)
  beam.rotation.x = -0.35
  root.add(beam)

  scene.add(root)

  return {
    root,
    screenWash: wash,
    screenBounce,
    beam,
    setHouseLevel(level: number) {
      const t = Math.max(0, Math.min(1, level))
      for (const { light, intensity } of houseLights) {
        light.intensity = intensity * t
      }
      sconceMat.color.setHex(t < 0.35 ? 0x6a4820 : theme.sconce)
    },
    dispose() {
      scene.remove(root)
      disposeObject(root)
    },
  }
}
