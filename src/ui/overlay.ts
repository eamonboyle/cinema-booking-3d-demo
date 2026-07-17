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
  orbitHint: HTMLElement
  dock: HTMLElement
  dReset: HTMLButtonElement
  d3d: HTMLButtonElement
  dBest: HTMLButtonElement
  dZin: HTMLButtonElement
  dZout: HTMLButtonElement
  fav: HTMLButtonElement
  bestBtn: HTMLButtonElement
  mm: CanvasRenderingContext2D
  ov: CanvasRenderingContext2D
  ovCanvas: HTMLCanvasElement
  showTitle: HTMLElement
  showMeta: HTMLElement
  camFooter: HTMLElement
  rightcol: HTMLElement
  sheetPeek: HTMLButtonElement
}

export function mountOverlay(root: HTMLElement): UiRefs {
  root.innerHTML = `
    <div id="loader" aria-live="polite">
      <div class="loader-mark" aria-hidden="true"></div>
      <div class="lt" id="loader-text">Dimming the house lights…</div>
    </div>

    <canvas id="c" aria-label="Interactive 3D cinema. Click any seat to preview the screen view. Use bracket keys to move between seats." tabindex="0"></canvas>
    <div id="vig" aria-hidden="true"></div>

    <nav>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        FrameSight
      </div>
      <div class="nav-links">
        <a href="#auditorium" class="active" data-nav="auditorium">Auditorium</a>
        <a href="#showtimes" data-nav="showtimes">Showtimes</a>
        <a href="#tickets" data-nav="tickets">Tickets</a>
      </div>
      <div class="nav-actions">
        <button class="icon-btn" id="fav" aria-label="Save seat" aria-pressed="false">
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
      <button type="button" id="best-btn" class="ghost-cta">Find best seat</button>
    </section>

    <section id="camcard" class="panel" aria-label="Camera controls">
      <header>
        <div class="panel-title">Look around</div>
      </header>
      <div class="cam-body">
        <canvas id="mm" width="280" height="160" aria-hidden="true"></canvas>
      </div>
      <footer id="cam-footer">Drag to orbit · Scroll to zoom · Click a seat</footer>
    </section>

    <div id="rightcol">
      <button type="button" id="sheet-peek" aria-expanded="true">Seat details</button>
      <section id="overview" class="panel" aria-label="Seat map">
        <header>
          <div class="panel-title">Seat map · click to select · Shift+click for group</div>
        </header>
        <canvas id="ov" width="320" height="220" role="img" aria-label="Interactive seat map"></canvas>
      </section>

      <section id="seatcard" class="panel" aria-label="Selected seat" aria-live="polite">
        <header>
          <div class="label"><span id="p-label">PICK A SEAT</span></div>
        </header>
        <div id="p-zone">Click any seat in 3D or on the map</div>
        <div class="seat-grid">
          <div class="cell"><div class="k">Row</div><div class="v" id="p-row">—</div></div>
          <div class="cell"><div class="k">Seat</div><div class="v" id="p-seat">—</div></div>
          <div class="cell"><div class="k">Price</div><div class="v" id="p-price">€— <span class="unit">/seat</span></div></div>
        </div>
        <div class="preview">
          <img id="p-img" alt="View of the screen from the selected seat" />
          <div class="ph" id="p-ph">Select a seat to preview the view</div>
          <div class="pill" id="p-score">★ — screen</div>
        </div>
        <div class="benefits" id="benefits">
          <div class="benefit"><span class="btxt">—</span></div>
          <div class="benefit"><span class="btxt">—</span></div>
          <div class="benefit"><span class="btxt">—</span></div>
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
      <button class="dock-btn" id="d-best" aria-label="Find best available seat">★</button>
      <div class="dock-sep"></div>
      <button class="dock-btn" id="d-zout" aria-label="Zoom out">−</button>
      <button class="dock-btn" id="d-zin" aria-label="Zoom in">+</button>
    </div>

    <div id="orbit-hint">Click a seat · [ ] to browse · Shift+click for a group</div>
    <div id="sb-hint">Look around · scroll to zoom the screen</div>
    <div id="backbar" role="toolbar" aria-label="Seat view controls">
      <button id="bk-exit" type="button">← Back to house</button>
      <button id="bk-snd" type="button" aria-label="Toggle theatre sound">♪</button>
    </div>

    <div id="tip" role="tooltip">
      <div class="t1" id="tip1">Row · Seat</div>
      <div class="t2" id="tip2">€—</div>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
  `

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const ovCanvas = $('ov') as HTMLCanvasElement

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
    orbitHint: $('orbit-hint'),
    dock: $('dock'),
    dReset: $('d-reset') as HTMLButtonElement,
    d3d: $('d-3d') as HTMLButtonElement,
    dBest: $('d-best') as HTMLButtonElement,
    dZin: $('d-zin') as HTMLButtonElement,
    dZout: $('d-zout') as HTMLButtonElement,
    fav: $('fav') as HTMLButtonElement,
    bestBtn: $('best-btn') as HTMLButtonElement,
    mm: ($('mm') as HTMLCanvasElement).getContext('2d')!,
    ov: ovCanvas.getContext('2d')!,
    ovCanvas,
    showTitle: $('show-title'),
    showMeta: $('show-meta'),
    camFooter: $('cam-footer'),
    rightcol: $('rightcol'),
    sheetPeek: $('sheet-peek') as HTMLButtonElement,
  }
}

export type PanelState = 'empty' | 'suggested' | 'previewing' | 'confirmed' | 'browsing'

export function updateSeatPanel(
  ui: UiRefs,
  info: {
    zone: { name: string; benefits: [string, string, string] }
    rowLetter: string
    seat: number
    price: number
    score: number
  } | null,
  state: PanelState,
  group?: { count: number; total: number },
): void {
  if (!info || state === 'empty') {
    ui.pLabel.textContent = 'PICK A SEAT'
    ui.pZone.textContent = 'Click any seat in 3D or on the map'
    ui.pRow.textContent = '—'
    ui.pSeat.textContent = '—'
    ui.pPrice.innerHTML = '€— <span class="unit">/seat</span>'
    ui.pScore.textContent = '★ — screen'
    ui.benefits.forEach((el) => {
      el.textContent = '—'
    })
    ui.pImg.classList.remove('ready')
    ui.pImg.removeAttribute('src')
    ui.pPh.style.display = 'grid'
    ui.pPh.textContent = 'Select a seat to preview the view'
    ui.checkout.classList.remove('done')
    ui.ckLabel.textContent = 'Reserve seat'
    ui.seatcard.classList.remove('refresh')
    void ui.seatcard.offsetWidth
    ui.seatcard.classList.add('refresh')
    return
  }

  const multi = group && group.count > 1
  ui.pLabel.textContent =
    state === 'confirmed'
      ? multi
        ? 'SEATS CONFIRMED'
        : 'SEAT CONFIRMED'
      : state === 'previewing'
        ? 'PREVIEWING SEAT'
        : state === 'browsing'
          ? 'SELECTED SEAT'
          : 'SUGGESTED SEAT'
  ui.pZone.textContent = multi
    ? `${info.zone.name} · ${group!.count} seats`
    : info.zone.name
  ui.pRow.textContent = info.rowLetter
  ui.pSeat.textContent = multi ? `${info.seat}+` : String(info.seat)
  ui.pPrice.innerHTML = multi
    ? `€${group!.total} <span class="unit">total</span>`
    : `€${info.price} <span class="unit">/seat</span>`
  ui.pScore.textContent = `★ ${info.score}% screen`
  info.zone.benefits.forEach((b, k) => {
    const el = ui.benefits[k]
    if (el) el.textContent = b
  })
  ui.checkout.classList.toggle('done', state === 'confirmed')
  ui.ckLabel.textContent =
    state === 'confirmed'
      ? multi
        ? 'Seats reserved ✓'
        : 'Seat reserved ✓'
      : multi
        ? `Reserve ${group!.count} seats`
        : 'Reserve seat'
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
