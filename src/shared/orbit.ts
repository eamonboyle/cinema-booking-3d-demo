import { MathUtils, Vector3, type PerspectiveCamera } from 'three'

export type OrbitState = {
  theta: number
  phi: number
  radius: number
  thetaT: number
  phiT: number
  radiusT: number
  target: Vector3
}

export function createOrbit(
  home: { theta: number; phi: number; radius: number },
  target: Vector3,
): OrbitState {
  return {
    theta: home.theta,
    phi: home.phi,
    radius: home.radius,
    thetaT: home.theta,
    phiT: home.phi,
    radiusT: home.radius,
    target,
  }
}

export function applyOrbit(camera: PerspectiveCamera, orbit: OrbitState): void {
  const sp = Math.sin(orbit.phi)
  camera.position.set(
    orbit.target.x + orbit.radius * sp * Math.cos(orbit.theta),
    orbit.target.y + orbit.radius * Math.cos(orbit.phi),
    orbit.target.z + orbit.radius * sp * Math.sin(orbit.theta),
  )
  camera.lookAt(orbit.target)
}

export function dampOrbit(orbit: OrbitState, amount = 0.12): void {
  orbit.theta += (orbit.thetaT - orbit.theta) * amount
  orbit.phi += (orbit.phiT - orbit.phi) * amount
  orbit.radius += (orbit.radiusT - orbit.radius) * amount
}

export function clampOrbit(
  orbit: OrbitState,
  phiMin: number,
  phiMax: number,
  rMin: number,
  rMax: number,
): void {
  orbit.phiT = MathUtils.clamp(orbit.phiT, phiMin, phiMax)
  orbit.radiusT = MathUtils.clamp(orbit.radiusT, rMin, rMax)
}
