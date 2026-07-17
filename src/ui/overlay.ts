export type UiRefs = {
  canvas: HTMLCanvasElement
  loader: HTMLElement
  loaderText: HTMLElement
  tip: HTMLElement
  tip1: HTMLElement
  tip2: HTMLElement
  toast: HTMLElement
  pLabel: HTMLElement
  pZone: HTMLElement
  pRow: HTMLElement
  pSeat: HTMLElement
  pPrice: HTMLElement
  pImg: HTMLImageElement
  pPh: HTMLElement
  pScore: HTMLElement
  checkout: HTMLButtonElement
  ckLabel: HTMLElement
  benefits: NodeListOf<HTMLElement>
  seatcard: HTMLElement
  backbar: HTMLElement
  bkExit: HTMLButtonElement
  bkSnd: HTMLButtonElement
  sbHint: HTMLElement
  dock: HTMLElement
  dReset: HTMLButtonElement
  d3d: HTMLButtonElement
  dZin: HTMLButtonElement
  dZout: HTMLButtonElement
  fav: HTMLButtonElement
  mm: CanvasRenderingContext2D
  ov: CanvasRenderingContext2D
  showTitle: HTMLElement
  showMeta: HTMLElement
}

export function mountOverlay(root: HTMLElement): UiRefs {
  root.innerHTML = `
    <div id="loader" aria-live="polite">
      <div class="loader-mark" aria-hidden="true"></div>
      <div class="lt" id="loader-text">Dimming the house lights…</div>
    </div>

    <canvas id="c" aria-label="Interactive 3D cinema. Click any seat to preview the screen view."></canvas>
    <div id="vig" aria-hidden="true"></div>

    <nav>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        FrameSight
      </div>
      <div class="nav-links">
        <a href="#" class="active">Auditorium</a>
        <a href="#">Showtimes</a>
        <a href="#">Tickets</a>
      </div>
      <div class="nav-actions">
        <button class="icon-btn" id="fav" aria-label="Save seat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20.5s-7.5-4.7-9.3-9.3C1.3 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 4.4 2.7l.7 1.4.7-1.4c.8-1.6 2.4-2.7 4.4-2.7 3.3 0 5.6 3.1 4.2 6.7-1.8 4.6-9.3 9.3-9.3 9.3Z"/>
          </svg>
        </button>
      </div>
    </nav>

    <section id="showcard" class="panel" aria-label="Now showing">
      <div class="eyebrow">NOW SHOWING</div>
      <h2 id="show-title">Night Drive</h2>
      <div class="show-meta" id="show-meta">Tonight · 19:40 · Screen 3</div>
      <div class="show-tags">
        <span>2h 08m</span>
        <span>12A</span>
        <span>Dolby Atmos</span>
      </div>
    </section>

    <section id="camcard" class="panel" aria-label="Camera controls">
      <header>
        <div class="panel-title">Look around</div>
      </header>
      <div class="cam-body">
        <canvas id="mm" width="280" height="160" aria-hidden="true"></canvas>
      </div>
      <footer>Drag to orbit · Scroll to zoom · Click a seat</footer>
    </section>

    <div id="rightcol">
      <section id="overview" class="panel" aria-label="Seat map">
        <header>
          <div class="panel-title">Seat map</div>
        </header>
        <canvas id="ov" width="320" height="220"></canvas>
      </section>

      <section id="seatcard" class="panel" aria-label="Selected seat">
        <header>
          <div class="label"><span id="p-label">SUGGESTED SEAT</span></div>
        </header>
        <div id="p-zone">Centre House</div>
        <div class="seat-grid">
          <div class="cell"><div class="k">Row</div><div class="v" id="p-row">G</div></div>
          <div class="cell"><div class="k">Seat</div><div class="v" id="p-seat">9</div></div>
          <div class="cell"><div class="k">Price</div><div class="v" id="p-price">€18 <span class="unit">/seat</span></div></div>
        </div>
        <div class="preview">
          <img id="p-img" alt="View of the screen from the selected seat" />
          <div class="ph" id="p-ph">Rendering screen view…</div>
          <div class="pill" id="p-score">★ — screen</div>
        </div>
        <div class="benefits" id="benefits">
          <div class="benefit"><span class="btxt">Sweet-spot rake</span></div>
          <div class="benefit"><span class="btxt">Padded recliner</span></div>
          <div class="benefit"><span class="btxt">Popcorn upgrade</span></div>
        </div>
        <button id="checkout" type="button">
          <span id="checkout-label">Reserve seat</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <path d="M4 12h15M13 6l6 6-6 6"/>
          </svg>
        </button>
      </section>
    </div>

    <div id="dock" role="toolbar" aria-label="3D view controls">
      <button class="dock-btn" id="d-reset" aria-label="Reset view">↺</button>
      <button class="dock-btn active" id="d-3d" aria-pressed="true">3D</button>
      <div class="dock-sep"></div>
      <button class="dock-btn" id="d-zout" aria-label="Zoom out">−</button>
      <button class="dock-btn" id="d-zin" aria-label="Zoom in">+</button>
    </div>

    <div id="sb-hint">Look around · scroll to zoom the screen</div>
    <div id="backbar" role="toolbar" aria-label="Seat view controls">
      <button id="bk-exit" type="button">← Back to house</button>
      <button id="bk-snd" type="button" aria-label="Toggle theatre sound">♪</button>
    </div>

    <div id="tip" aria-hidden="true">
      <div class="t1" id="tip1">Row · Seat</div>
      <div class="t2" id="tip2">€—</div>
    </div>
    <div id="toast" role="status"></div>
  `

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

  return {
    canvas: $('c'),
    loader: $('loader'),
    loaderText: $('loader-text'),
    tip: $('tip'),
    tip1: $('tip1'),
    tip2: $('tip2'),
    toast: $('toast'),
    pLabel: $('p-label'),
    pZone: $('p-zone'),
    pRow: $('p-row'),
    pSeat: $('p-seat'),
    pPrice: $('p-price'),
    pImg: $('p-img') as HTMLImageElement,
    pPh: $('p-ph'),
    pScore: $('p-score'),
    checkout: $('checkout') as HTMLButtonElement,
    ckLabel: $('checkout-label'),
    benefits: document.querySelectorAll('#benefits .btxt'),
    seatcard: $('seatcard'),
    backbar: $('backbar'),
    bkExit: $('bk-exit') as HTMLButtonElement,
    bkSnd: $('bk-snd') as HTMLButtonElement,
    sbHint: $('sb-hint'),
    dock: $('dock'),
    dReset: $('d-reset') as HTMLButtonElement,
    d3d: $('d-3d') as HTMLButtonElement,
    dZin: $('d-zin') as HTMLButtonElement,
    dZout: $('d-zout') as HTMLButtonElement,
    fav: $('fav') as HTMLButtonElement,
    mm: ($('mm') as HTMLCanvasElement).getContext('2d')!,
    ov: ($('ov') as HTMLCanvasElement).getContext('2d')!,
    showTitle: $('show-title'),
    showMeta: $('show-meta'),
  }
}

export type PanelState = 'suggested' | 'previewing' | 'confirmed'

export function updateSeatPanel(
  ui: UiRefs,
  info: {
    zone: { name: string; benefits: [string, string, string] }
    rowLetter: string
    seat: number
    price: number
    score: number
  },
  state: PanelState,
): void {
  ui.pLabel.textContent =
    state === 'confirmed'
      ? 'SEAT CONFIRMED'
      : state === 'previewing'
        ? 'PREVIEWING SEAT'
        : 'SUGGESTED SEAT'
  ui.pZone.textContent = info.zone.name
  ui.pRow.textContent = info.rowLetter
  ui.pSeat.textContent = String(info.seat)
  ui.pPrice.innerHTML = `€${info.price} <span class="unit">/seat</span>`
  ui.pScore.textContent = `★ ${info.score}% screen`
  info.zone.benefits.forEach((b, k) => {
    const el = ui.benefits[k]
    if (el) el.textContent = b
  })
  ui.checkout.classList.toggle('done', state === 'confirmed')
  ui.ckLabel.textContent = state === 'confirmed' ? 'Seat reserved ✓' : 'Reserve seat'
  ui.seatcard.classList.remove('refresh')
  void ui.seatcard.offsetWidth
  ui.seatcard.classList.add('refresh')
}

let toastTimer = 0
export function toast(ui: UiRefs, msg: string, ms = 2600): void {
  ui.toast.textContent = msg
  ui.toast.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), ms)
}
