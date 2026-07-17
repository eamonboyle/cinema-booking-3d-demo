/** Soft theatre ambience + projector hum — synthesised, no assets. */
export class TheatreAudio {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private humGain: GainNode | null = null
  muted = false
  private ambientLevel = 0.015
  private humLevel = 0

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

    // Soft projector / screen hum
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 92
    const osc2 = this.ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = 184
    this.humGain = this.ctx.createGain()
    this.humGain.gain.value = 0
    const humFilter = this.ctx.createBiquadFilter()
    humFilter.type = 'lowpass'
    humFilter.frequency.value = 280
    osc.connect(humFilter)
    osc2.connect(humFilter)
    humFilter.connect(this.humGain)
    this.humGain.connect(this.ctx.destination)
    osc.start()
    osc2.start()
  }

  setLevel(level: number): void {
    this.ambientLevel = level
    this.applyGains()
  }

  setHum(level: number): void {
    this.humLevel = level
    this.applyGains()
  }

  private applyGains(): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 1.0
    if (this.gain) {
      this.gain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.gain.gain.linearRampToValueAtTime(
        this.muted ? 0.0001 : this.ambientLevel,
        t,
      )
    }
    if (this.humGain) {
      this.humGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.humGain.gain.linearRampToValueAtTime(
        this.muted ? 0.0001 : this.humLevel,
        t,
      )
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    this.applyGains()
    return this.muted
  }
}
