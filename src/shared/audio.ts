/** Soft theatre ambience — synthesised, no assets (stadium crowd pattern). */
export class TheatreAudio {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  muted = false

  ensure(): void {
    if (this.ctx) return
    try {
      this.ctx = new AudioContext()
    } catch {
      return
    }
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true

    const bp = this.ctx.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 420
    bp.Q.value = 0.4

    this.gain = this.ctx.createGain()
    this.gain.gain.value = 0

    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lg = this.ctx.createGain()
    lg.gain.value = 0.006
    lfo.connect(lg)
    lg.connect(this.gain.gain)
    lfo.start()

    src.connect(bp)
    bp.connect(this.gain)
    this.gain.connect(this.ctx.destination)
    src.start()
  }

  setLevel(level: number): void {
    if (!this.ctx || !this.gain) return
    this.gain.gain.cancelScheduledValues(this.ctx.currentTime)
    this.gain.gain.linearRampToValueAtTime(
      this.muted ? 0.0001 : level,
      this.ctx.currentTime + 1.2,
    )
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }
}
