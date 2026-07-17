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
  type Scene,
  type WebGLRenderer,
} from 'three'
import { canvasTexture } from '../shared/textures'
import { HALL } from './layout'

export function buildAuditorium(scene: Scene, renderer: WebGLRenderer): Group {
  const root = new Group()

  // Floor carpet — warm burgundy, readable under house lights
  const carpetTex = canvasTexture(renderer, 256, 256, (x, w, h) => {
    x.fillStyle = '#6a3040'
    x.fillRect(0, 0, w, h)
    x.globalAlpha = 0.28
    for (let i = 0; i < 40; i++) {
      x.fillStyle = i % 2 ? '#5a2836' : '#7a3c4c'
      x.fillRect(0, (i / 40) * h, w, h / 55)
    }
    x.globalAlpha = 0.12
    for (let i = 0; i < 1200; i++) {
      x.fillStyle = Math.random() > 0.5 ? '#3a1820' : '#8a4a58'
      x.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    x.globalAlpha = 1
  }, 8, 10)
  const floor = new Mesh(
    new PlaneGeometry(HALL.width + 4, HALL.depth + 4),
    new MeshLambertMaterial({ map: carpetTex }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, 2)
  floor.receiveShadow = true
  root.add(floor)

  // Side walls
  const wallMat = new MeshLambertMaterial({ color: 0x4a3038 })
  const wallL = new Mesh(new BoxGeometry(0.4, HALL.height, HALL.depth + 2), wallMat)
  wallL.position.set(-HALL.width / 2 - 0.2, HALL.height / 2, 1)
  const wallR = wallL.clone()
  wallR.position.x = HALL.width / 2 + 0.2
  root.add(wallL, wallR)

  // Back wall
  const back = new Mesh(
    new BoxGeometry(HALL.width + 2, HALL.height, 0.4),
    wallMat,
  )
  back.position.set(0, HALL.height / 2, HALL.depth / 2 - 1)
  root.add(back)

  // Ceiling with acoustic panels
  const ceilTex = canvasTexture(renderer, 128, 128, (x, w, h) => {
    x.fillStyle = '#3a3034'
    x.fillRect(0, 0, w, h)
    x.strokeStyle = '#4a4044'
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

  // Stage apron
  const apron = new Mesh(
    new BoxGeometry(HALL.screenW + 4, 0.35, 2.2),
    new MeshLambertMaterial({ color: 0x3a2a30 }),
  )
  apron.position.set(0, 0.15, HALL.screenZ + 1.4)
  root.add(apron)

  // Aisle runner
  const aisle = new Mesh(
    new PlaneGeometry(HALL.aisleHalf * 2, HALL.depth * 0.7),
    new MeshLambertMaterial({ color: 0x7a4050 }),
  )
  aisle.rotation.x = -Math.PI / 2
  aisle.position.set(0, 0.02, 2)
  root.add(aisle)

  // Exit signs
  const exitMat = new MeshBasicMaterial({ color: 0x4db87a })
  ;[
    [-HALL.width / 2 + 0.5, 2.4, HALL.depth / 2 - 1.5],
    [HALL.width / 2 - 0.5, 2.4, HALL.depth / 2 - 1.5],
  ].forEach(([x, y, z]) => {
    const sign = new Mesh(new BoxGeometry(0.9, 0.28, 0.08), exitMat)
    sign.position.set(x!, y!, z!)
    root.add(sign)
  })

  // House fill over seating
  const houseFill = new DirectionalLight(0xfff2e4, 1.35)
  houseFill.position.set(4, 14, 8)
  root.add(houseFill)
  const houseFill2 = new DirectionalLight(0xffe0c8, 0.7)
  houseFill2.position.set(-6, 10, -2)
  root.add(houseFill2)

  // Ceiling house lights
  for (let i = 0; i < 4; i++) {
    const z = -6 + i * 5.5
    const pl = new PointLight(0xfff0e0, 2.2, 16, 1.4)
    pl.position.set(0, HALL.height - 1.2, z)
    root.add(pl)
  }

  // Wall sconces
  const sconceMat = new MeshBasicMaterial({ color: 0xffc858 })
  for (let i = 0; i < 5; i++) {
    const z = -8 + i * 5
    ;[-1, 1].forEach((side) => {
      const bulb = new Mesh(new CylinderGeometry(0.08, 0.1, 0.15, 8), sconceMat)
      bulb.position.set(side * (HALL.width / 2 - 0.35), 2.8, z)
      root.add(bulb)
      const pl = new PointLight(0xffc878, 1.8, 14, 1.5)
      pl.position.copy(bulb.position)
      root.add(pl)
    })
  }

  // Screen wash light
  const wash = new SpotLight(0xfff4e8, 28, 50, Math.PI / 2.6, 0.45, 1)
  wash.position.set(0, HALL.height - 1.5, 6)
  wash.target.position.set(0, HALL.screenY, HALL.screenZ)
  root.add(wash, wash.target)

  // Soft bounce from screen onto seats
  const screenBounce = new SpotLight(0xffe8d0, 12, 35, Math.PI / 2.4, 0.6, 1.1)
  screenBounce.position.set(0, HALL.screenY, HALL.screenZ + 1)
  screenBounce.target.position.set(0, 2, 4)
  root.add(screenBounce, screenBounce.target)

  // Projector booth glow at back
  const booth = new Mesh(
    new BoxGeometry(3.5, 1.8, 1.2),
    new MeshLambertMaterial({ color: 0x2a2226 }),
  )
  booth.position.set(0, HALL.height - 1.2, HALL.depth / 2 - 2.2)
  root.add(booth)
  const beam = new Mesh(
    new PlaneGeometry(0.4, 14),
    new MeshBasicMaterial({
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  )
  beam.position.set(0, 5.5, 0)
  beam.rotation.x = -0.35
  root.add(beam)

  scene.add(root)
  return root
}
