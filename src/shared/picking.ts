import {
  InstancedBufferAttribute,
  InstancedMesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type BufferGeometry,
  type WebGLRenderer,
} from 'three'

/** GPU colour-id picking for InstancedMesh — same approach as StadiView. */
export class GpuPicker {
  readonly pickMesh: InstancedMesh
  private readonly pickScene = new Scene()
  private readonly pickRT = new WebGLRenderTarget(1, 1)
  private readonly pickBuf = new Uint8Array(4)
  private readonly renderer: WebGLRenderer
  private readonly camera: PerspectiveCamera

  constructor(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    geometry: BufferGeometry,
    count: number,
  ) {
    this.renderer = renderer
    this.camera = camera
    const pickColAttr = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
    geometry.setAttribute('pickColor', pickColAttr)

    this.pickMesh = new InstancedMesh(
      geometry,
      new ShaderMaterial({
        vertexShader: `
          attribute vec3 pickColor;
          varying vec3 vP;
          void main() {
            vP = pickColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vP;
          void main() { gl_FragColor = vec4(vP, 1.0); }
        `,
      }),
      count,
    )
    this.pickMesh.frustumCulled = true
    this.pickScene.background = null
    this.pickScene.add(this.pickMesh)

    for (let i = 0; i < count; i++) {
      const id = i + 1
      pickColAttr.setXYZ(
        i,
        ((id >> 16) & 255) / 255,
        ((id >> 8) & 255) / 255,
        (id & 255) / 255,
      )
    }
  }

  pickAt(clientX: number, clientY: number, canvas: HTMLCanvasElement): number {
    const dpr = this.renderer.getPixelRatio()
    this.camera.setViewOffset(
      canvas.width,
      canvas.height,
      Math.floor(clientX * dpr),
      Math.floor(clientY * dpr),
      1,
      1,
    )
    this.renderer.setRenderTarget(this.pickRT)
    this.renderer.render(this.pickScene, this.camera)
    this.renderer.setRenderTarget(null)
    this.camera.clearViewOffset()
    this.renderer.readRenderTargetPixels(this.pickRT, 0, 0, 1, 1, this.pickBuf)
    const id = (this.pickBuf[0]! << 16) | (this.pickBuf[1]! << 8) | this.pickBuf[2]!
    return id === 0 ? -1 : id - 1
  }

  dispose(): void {
    this.pickScene.remove(this.pickMesh)
    this.pickMesh.geometry.dispose()
    ;(this.pickMesh.material as ShaderMaterial).dispose()
    this.pickRT.dispose()
  }
}
