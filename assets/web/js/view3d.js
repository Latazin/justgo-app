/* =========================================================
   JustGo — TREINO EM 3D
   Relevo real (AWS Terrain Tiles, aberto e sem chave), prédios
   do OpenStreetMap quando existirem e o percurso desenhado
   sobre o terreno. "Voo" segue o trajeto do início ao fim.
   Tudo roda no aparelho: nenhum servidor, nenhuma API paga.

   Suavidade: o caminho da câmera é calculado UMA vez antes do
   voo (posição e direção suavizadas), então cada quadro só
   interpola números — sem tremer nas curvas do GPS.
   Vídeo: renderiza quadro a quadro esperando o mapa carregar,
   então o vídeo sai liso mesmo em celular lento (só demora mais).
   ========================================================= */
const View3D = {
  DEM: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  map: null, raf: 0, playing: false, t: 0,
  weak() { const m = navigator.deviceMemory || 4, c = navigator.hardwareConcurrency || 8; return m <= 3 || c <= 4; },
  supported() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } },
  canVideo() { return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'; },

  open(act) {
    if (!window.maplibregl || !this.supported()) { FX.toast('Seu aparelho não consegue mostrar o mapa em 3D.'); return false; }
    const pts = (act.points || []).filter((p) => p && p[0] != null);
    if (pts.length < 2) { FX.toast('Este treino não tem percurso para ver em 3D.'); return false; }
    if (this.light == null) this.light = this.weak();
    try { this.speed = +localStorage.getItem('jg_v3_speed') || 1; } catch (e) { this.speed = 1; }
    // trajeto leve (um ponto a cada ~8 m) com distância acumulada
    const P = [pts[0]]; for (let i = 1; i < pts.length; i++) if (pts[i][4] || Geo.dist(P[P.length - 1], pts[i]) >= 8) P.push(pts[i]);
    // pedaços soltos no começo/fim depois de um corte do GPS (ex.: um ponto pulado lá em casa
    // ao terminar) não fazem parte do percurso — sem isso o vídeo puxava uma linha reta até eles
    const segs = [[]]; P.forEach((p, i) => { if (i && p[4]) segs.push([]); segs[segs.length - 1].push(p); });
    const len = (sg) => { let d = 0; for (let k = 1; k < sg.length; k++) d += Geo.dist(sg[k - 1], sg[k]); return d; };
    while (segs.length > 1 && len(segs[segs.length - 1]) < 150) segs.pop();
    while (segs.length > 1 && len(segs[0]) < 150) { segs.shift(); segs[0][0] = segs[0][0].slice(0, 4); }
    P.length = 0; segs.forEach((sg) => P.push(...sg));
    const D = [0]; for (let i = 1; i < P.length; i++) D.push(D[i - 1] + (P[i][4] ? 0 : Geo.dist(P[i - 1], P[i])));
    this.P = P; this.D = D; this.total = D[D.length - 1] || 1; this.act = act; this.t = 0; this.playing = false;
    this.color = Shop.lineColor(act.sport);
    this.track();
    return true;
  },

  /* ---------- caminho da câmera, calculado uma vez ---------- */
  track() {
    const N = Math.max(120, Math.min(900, Math.round(this.total / 10))), step = this.total / (N - 1);
    const raw = []; for (let k = 0; k < N; k++) raw.push(this.at(k * step).pos);
    // centro: média móvel de ~±70 m (some a tremida do GPS)
    const w = Math.max(2, Math.round(70 / step)), C = raw.map((_, k) => {
      let a = 0, b = 0, n = 0; for (let j = Math.max(0, k - w); j <= Math.min(N - 1, k + w); j++) { a += raw[j][0]; b += raw[j][1]; n++; }
      return [a / n, b / n];
    });
    const B0 = C.map((p, k) => (k ? this.bearing(C[k - 1], p) : 0)); for (let k = 1; k < N; k++) if (!isFinite(B0[k]) || Geo.dist(C[k - 1], C[k]) < 0.5) B0[k] = B0[k - 1];
    // direção: olha ~180 m à frente e suaviza bastante (curvas largas, sem chicote)
    const ah = Math.max(1, Math.round(180 / step));
    let B = C.map((c, k) => { const j = Math.min(N - 1, k + ah), i0 = j === k ? Math.max(0, k - ah) : k; return this.bearing(C[i0], C[j === k ? k : j]); });
    for (let k = 1; k < N; k++) { if (!isFinite(B[k])) B[k] = B[k - 1]; while (B[k] - B[k - 1] > 180) B[k] -= 360; while (B[k] - B[k - 1] < -180) B[k] += 360; }
    if (!isFinite(B[0])) B[0] = 0;
    const wb = Math.max(3, Math.round(260 / step));
    const sm = (A, w) => A.map((_, k) => { let s = 0, n = 0; for (let j = Math.max(0, k - w); j <= Math.min(N - 1, k + w); j++) { s += A[j]; n++; } return s / n; });
    B = sm(B, wb);
    // trechos "enrolados" (trilha, zigue-zague, voltas no mesmo lugar): mede quanto o trajeto
    // anda de verdade em ~±220 m. Quanto mais curva junta, mais a câmera sobe, abre o ângulo
    // e para de girar atrás de cada curva — mostra o trecho inteiro de cima.
    const tw = Math.max(2, Math.round(220 / step));
    let K = raw.map((_, k) => {
      const a = Math.max(0, k - tw), b = Math.min(N - 1, k + tw), path = (b - a) * step; if (path < 120) return 0;
      const ratio = Geo.dist(raw[a], raw[b]) / path;
      let turn = 0; for (let j = Math.max(1, a); j < b; j++) { let d = B0[j] - B0[j - 1]; while (d > 180) d -= 360; while (d < -180) d += 360; turn += Math.abs(d); }
      return Math.max(0, Math.min(1, Math.max((0.72 - ratio) / 0.42, (turn / (path / 100) - 25) / 45)));
    });
    K = sm(sm(K, Math.max(2, Math.round(200 / step))), Math.max(2, Math.round(150 / step)));
    // direção e centro "calmos" (janela bem maior) para misturar nos trechos enrolados
    const Bc = sm(B, Math.max(4, Math.round(700 / step)));
    const wc = Math.max(3, Math.round(260 / step)), Cc = C.map((_, k) => { let a = 0, b = 0, n = 0; for (let j = Math.max(0, k - wc); j <= Math.min(N - 1, k + wc); j++) { a += C[j][0]; b += C[j][1]; n++; } return [a / n, b / n]; });
    const C2 = C.map((c, k) => [c[0] + (Cc[k][0] - c[0]) * K[k], c[1] + (Cc[k][1] - c[1]) * K[k]]);
    const B2 = B.map((b, k) => b + (Bc[k] - b) * K[k]);
    this.T = { N, C: C2, B: B2, K };
  },
  zoom() { return this.light ? 14.4 : 14.8; }, // câmera mais alta: mostra mais do bairro em volta
  cam(t) {
    const { N, C, B, K } = this.T, f = Math.max(0, Math.min(1, t)) * (N - 1), i = Math.min(N - 2, Math.floor(f)), u = f - i, k = K[i] + (K[i + 1] - K[i]) * u;
    return { center: [C[i][1] + (C[i + 1][1] - C[i][1]) * u, C[i][0] + (C[i + 1][0] - C[i][0]) * u], bearing: B[i] + (B[i + 1] - B[i]) * u, pitch: 60 - 18 * k, zoom: this.zoom() - 1.15 * k };
  },
  bounds() { const P = this.P, lngs = P.map((p) => p[1]), lats = P.map((p) => p[0]); return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]; },
  overCam(bearing) {
    const el = this.map.getContainer(), pad = Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.14);
    const c = this.map.cameraForBounds(this.bounds(), { padding: { top: pad * 1.6, bottom: pad * 1.8, left: pad, right: pad }, bearing, pitch: 50 }) || {};
    const ctr = c.center ? (c.center.lng != null ? [c.center.lng, c.center.lat] : c.center) : this.cam(0.5).center;
    return { center: ctr, zoom: Math.min(16, (c.zoom || 14) - 0.15), bearing, pitch: 50 };
  },

  mount(el) {
    const M = CONFIG.maps, light = this.light;
    const map = new maplibregl.Map({
      container: el, style: M.color, attributionControl: { compact: true },
      bounds: this.bounds(), fitBoundsOptions: { padding: 50 },
      pitch: 55, bearing: this.T.B[0] - 40, maxPitch: 80, fadeDuration: 0,
      pixelRatio: light ? 1 : Math.min(1.5, window.devicePixelRatio || 1), // 1.5 já fica nítido e pesa bem menos que 2–3
      antialias: false, maxTileCacheSize: 120,
    });
    this.map = map;
    map.on('error', (e) => console.warn('3D', e && e.error && e.error.message));
    map.on('load', () => {
      try {
        map.addSource('dem', { type: 'raster-dem', tiles: [this.DEM], encoding: 'terrarium', tileSize: 256, maxzoom: light ? 12 : 13, attribution: 'Relevo: Terrain Tiles (AWS/Mapzen)' });
        map.setTerrain({ source: 'dem', exaggeration: light ? 1.25 : 1.6 });
        const firstSymbol = (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
        if (!light) map.addLayer({ id: 'jg-hill', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5a6b7d' } }, firstSymbol);
        if (map.setSky) map.setSky({ 'sky-color': '#7fb6ff', 'horizon-color': '#e6f0ff', 'fog-color': '#f2f6fb', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 });
      } catch (e) { console.warn(e); }
      // menos coisa para desenhar: some com ícones de lojas/POIs (no 3D só poluem) e,
      // no modo leve, com os prédios
      map.getStyle().layers.forEach((l) => {
        try {
          if (l.type === 'fill-extrusion') map.setLayoutProperty(l.id, 'visibility', light ? 'none' : 'visible');
          else if (l.type === 'symbol' && /poi|housenum|transit|aerialway|ferry/i.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
        } catch (e) {}
      });
      const segs = Geo.segments(this.P).map((s) => s.map((p) => [p[1], p[0]]));
      map.addSource('jg-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segs } } });
      map.addSource('jg-done', { type: 'geojson', data: this.doneGeo(0) });
      map.addLayer({ id: 'jg-route-case', type: 'line', source: 'jg-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'jg-route', type: 'line', source: 'jg-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': this.color, 'line-width': 5, 'line-opacity': 0.45 } });
      map.addLayer({ id: 'jg-done', type: 'line', source: 'jg-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': this.color, 'line-width': 6 } });
      const P = this.P, pin = (cls) => { const d = document.createElement('div'); d.className = 'pin ' + cls; d.innerHTML = '<i></i>'; return d; };
      this.pins = [new maplibregl.Marker({ element: pin('start') }).setLngLat([P[0][1], P[0][0]]).addTo(map),
        new maplibregl.Marker({ element: pin('end') }).setLngLat([P[P.length - 1][1], P[P.length - 1][0]]).addTo(map)];
      const me = document.createElement('div'); me.className = 'v3-dot'; me.style.setProperty('--c', this.color);
      this.dot = new maplibregl.Marker({ element: me }).setLngLat([P[0][1], P[0][0]]).addTo(map);
      this.ready = true; this.ui();
      // espera os primeiros tiles e desce suave até o início (sem "pulo")
      let go = false; const start = () => { if (go || !this.map) return; go = true; this.play(); };
      map.once('idle', () => setTimeout(start, 300)); setTimeout(start, 4000);
    });
  },

  // trecho já percorrido até a distância d
  at(d) {
    const D = this.D, P = this.P; let lo = 0, hi = D.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (D[m] < d) lo = m + 1; else hi = m; }
    const i = Math.max(1, lo), a = P[i - 1], b = P[i], f = D[i] - D[i - 1] ? (d - D[i - 1]) / (D[i] - D[i - 1]) : 0;
    return { i, pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] };
  },
  doneGeo(d) {
    if (!this.P) return { type: 'FeatureCollection', features: [] };
    const { i, pos } = this.at(Math.max(0.01, d)), segs = []; let cur = [];
    for (let k = 0; k < i; k++) { if (this.P[k][4] && cur.length) { segs.push(cur); cur = []; } cur.push([this.P[k][1], this.P[k][0]]); }
    cur.push([pos[1], pos[0]]); segs.push(cur);
    return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segs.filter((s) => s.length > 1) } };
  },
  bearing(a, b) { const y = Math.sin(((b[1] - a[1]) * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180), x = Math.cos((a[0] * Math.PI) / 180) * Math.sin((b[0] * Math.PI) / 180) - Math.sin((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.cos(((b[1] - a[1]) * Math.PI) / 180); return (Math.atan2(y, x) * 180) / Math.PI; },
  speed: 1,
  flyMs() { return Math.max(12000, Math.min(45000, (this.total / 1000) * 4500)); },
  setSpeed() { const L = [0.5, 1, 1.5, 2]; this.speed = L[(L.indexOf(this.speed) + 1) % L.length]; try { localStorage.setItem('jg_v3_speed', String(this.speed)); } catch (e) {} this.ui(); },
  // duração do voo = a mesma da prévia, na velocidade escolhida
  flySec() { return this.flyMs() / 1000 / this.speed; },
  setDone(d) { const s = this.map && this.map.getSource('jg-done'); if (s) s.setData(this.doneGeo(d)); },

  // voo: duração proporcional à distância (12 s a 45 s)
  play() {
    if (!this.ready || this.busy) return;
    if (this.t >= 1) { this.t = 0; this.setDone(0); }
    this.playing = true; this.ui();
    const m = this.map;
    const run = () => {
      let last = performance.now(), lastData = 0;
      const step = (now) => {
        if (!this.playing || !this.map) return;
        // se um quadro demorar (tile chegando), o voo desacelera em vez de dar um salto
        this.t = Math.min(1, this.t + Math.min(now - last, 50) / (this.flyMs() / this.speed)); last = now;
        const d = this.t * this.total, here = this.at(d).pos;
        m.jumpTo(this.cam(this.t));
        this.dot.setLngLat([here[1], here[0]]);
        if (now - lastData > 110 || this.t >= 1) { lastData = now; this.setDone(d); this.ui(true); }
        if (this.t >= 1) { this.playing = false; this.ui(); this.overview(); return; }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    };
    // vindo da visão geral: desliza até a câmera do ponto atual antes de começar
    const c = this.cam(this.t), cur = m.getCenter(), far = Geo.dist([cur.lat, cur.lng], [c.center[1], c.center[0]]) > 60 || Math.abs(m.getZoom() - c.zoom) > 0.3;
    if (far) { m.easeTo({ ...c, duration: 1600, easing: (x) => x * x * (3 - 2 * x) }); m.once('moveend', () => { if (this.playing) run(); }); }
    else run();
  },
  pause() { this.playing = false; cancelAnimationFrame(this.raf); if (this.map) this.map.stop(); this.ui(); },
  overview() { if (this.map) this.map.easeTo({ ...this.overCam(this.map.getBearing() - 30), duration: 2400 }); },
  seek(f) { this.pause(); this.t = Math.max(0, Math.min(1, f)); const d = this.t * this.total, h = this.at(d).pos; this.dot.setLngLat([h[1], h[0]]); this.setDone(d); this.map.easeTo({ ...this.cam(this.t), duration: 350 }); this.ui(); },
  ui(onlyProgress) {
    const bar = $('#v3Prog'), km = $('#v3Km'); if (bar) bar.value = Math.round(this.t * 1000); if (km) km.textContent = `${Fmt.km(this.t * this.total)} km`;
    if (onlyProgress) return;
    const b = $('#v3Play'); if (b) b.innerHTML = this.playing ? I('pause') : I('play');
    const l = $('#v3Light'); if (l) l.classList.toggle('on', !!this.light);
    const v = $('#v3Spd'); if (v) v.textContent = `${String(this.speed).replace('.', ',')}x`;
    const e = $('#v3Len'); if (e) e.textContent = `vídeo de ~${Math.round(this.flySec() + 4.4)} s`;
  },
  close() { this.cancelVideo = true; this.pause(); if (this.map) { try { this.map.remove(); } catch (e) {} } this.map = null; this.ready = false; this.busy = false; },

  /* =========================================================
     VÍDEO 9:16 (720×1280, MP4/H.264) — Reels, Status, Stories
     ========================================================= */
  W: 720, H: 1280, FPS: 30,
  loadMuxer() {
    if (window.Mp4Muxer) return Promise.resolve();
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'js/vendor/mp4-muxer.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  },
  async encoderConfig() {
    const base = { width: this.W, height: this.H, bitrate: 4_500_000, framerate: this.FPS, latencyMode: 'quality' };
    for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) {
      for (const hw of ['prefer-hardware', 'no-preference']) {
        try { const r = await VideoEncoder.isConfigSupported({ ...base, codec, hardwareAcceleration: hw, avc: { format: 'avc' } }); if (r.supported) return { cfg: r.config, mc: 'avc' }; } catch (e) {}
      }
    }
    // reserva (aparelhos sem H.264 no navegador)
    try { const r = await VideoEncoder.isConfigSupported({ ...base, codec: 'vp09.00.31.08' }); if (r.supported) return { cfg: r.config, mc: 'vp9' }; } catch (e) {}
    return null;
  },

  // um quadro: copia o canvas logo no próximo desenho do mapa. Só segura (no máximo
  // ~0,7 s) se ainda faltar pedaço do mapa — o pré-carregamento já trouxe quase tudo.
  frame(draw, cap) {
    const m = this.map, t0 = performance.now(); cap = cap || (this.light ? 450 : 700);
    return new Promise((res) => {
      let done = false;
      const fin = () => { done = true; m.off('render', h); clearTimeout(to); try { draw(); } catch (e) { console.warn(e); } res(); };
      const h = () => { if (done) return; if (!m.areTilesLoaded() && performance.now() - t0 < cap) return; fin(); };
      const to = setTimeout(() => { if (done) return; if (this.cancelVideo || !this.map) { done = true; m.off('render', h); return res(); } m.triggerRepaint(); }, cap + 30);
      m.on('render', h); m.triggerRepaint();
    });
  },
  // espera o mapa carregar de verdade (usado só no pré-carregamento)
  settle(ms) { const m = this.map; return new Promise((res) => { let ok = false; const f = () => { if (ok) return; ok = true; m.off('idle', f); res(); }; m.once('idle', f); m.triggerRepaint(); setTimeout(f, ms); }); },

  async video() {
    if (!this.ready || this.busy) return;
    if (!this.canVideo()) { FX.toast('Seu aparelho não consegue gerar o vídeo. Atualize o "Android System WebView" na Play Store.'); return; }
    this.pause(); this.busy = true; this.cancelVideo = false;
    const m = this.map, root = $('.v3'), prevPR = m.getPixelRatio(), prevT = this.t;
    let EC = null;
    try { await this.loadMuxer(); EC = await this.encoderConfig(); } catch (e) {}
    if (!EC) { this.busy = false; FX.toast('Não deu para gerar vídeo neste aparelho.'); return; }

    // mapa vira um quadro 9:16 e renderiza já na resolução do vídeo
    root.classList.add('rec'); this.recUI(0);
    m.resize(); m.setPixelRatio((this.light ? 480 : 560) / m.getContainer().clientWidth); m.resize();
    try { m.setLayoutProperty('jg-done', 'visibility', 'none'); } catch (e) {} // a linha percorrida é desenhada por cima, sem ida ao worker a cada quadro
    this.pins.forEach((p) => (p.getElement().style.visibility = 'hidden')); this.dot.getElement().style.visibility = 'hidden';

    const out = document.createElement('canvas'); out.width = this.W; out.height = this.H;
    const g = out.getContext('2d', { alpha: false });
    try { await Promise.all(['800 64px "Barlow Condensed"', '700 30px Inter', '800 52px Inter', '600 22px Inter'].map((f) => document.fonts.load(f))); } catch (e) {}

    const target = new Mp4Muxer.ArrayBufferTarget();
    const mux = new Mp4Muxer.Muxer({ target, video: { codec: EC.mc, width: this.W, height: this.H, frameRate: this.FPS }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let encErr = null;
    const enc = new VideoEncoder({ output: (c, meta) => mux.addVideoChunk(c, meta), error: (e) => { encErr = e; } });
    enc.configure(EC.cfg);

    // roteiro: aproxima (1,3 s) → voo (até 16 s) → abre para a visão geral girando (3,2 s)
    const F = this.FPS, nIn = Math.round(1.8 * F), nFly = Math.round(this.flySec() * F), nOut = Math.round(2.6 * F), total = nIn + nFly + nOut;
    const c0 = this.cam(0), c1 = this.cam(1), endB = c1.bearing - 35, over = this.overCam(endB);
    const intro = { ...this.overCam(c0.bearing - 50), pitch: 45 };
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const mix = (a, b, u) => {
      let db = b.bearing - a.bearing; while (db > 180) db -= 360; while (db < -180) db += 360;
      return { center: [a.center[0] + (b.center[0] - a.center[0]) * u, a.center[1] + (b.center[1] - a.center[1]) * u], zoom: a.zoom + (b.zoom - a.zoom) * u, pitch: a.pitch + (b.pitch - a.pitch) * u, bearing: a.bearing + db * u };
    };
    // pré-carrega o mapa ao longo do trajeto (bem mais rápido que esperar quadro a quadro)
    const stops = [intro, c0]; const gap = Math.max(350, this.total / 28); for (let d = gap; d < this.total; d += gap) stops.push(this.cam(d / this.total)); stops.push(c1, over);
    for (let k = 0; k < stops.length && !this.cancelVideo; k++) { m.jumpTo(stops[k]); await this.settle(this.light ? 1500 : 2200); this.recUI((k / stops.length) * 0.25, 'Preparando o mapa…'); }
    this.linePts(); this.profile();
    for (let i = 0; i < total && !this.cancelVideo && !encErr; i++) {
      let t, cam;
      if (i < nIn) { t = 0; cam = mix(intro, c0, ease(i / nIn)); }
      else if (i < nIn + nFly) { const u = (i - nIn) / (nFly - 1); t = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; t = 0.15 * t + 0.85 * u; cam = this.cam(t); } // começa e termina macio
      else { const u = (i - nIn - nFly) / (nOut - 1); t = 1; cam = mix(c1, over, ease(Math.min(1, u * 1.6))); cam.bearing += u * 18; }
      m.jumpTo(cam);
      await this.frame(() => this.compose(g, t, i >= nIn + nFly ? (i - nIn - nFly) / (nOut - 1) : 0, i < nIn ? i / nIn : 1));
      const vf = new VideoFrame(out, { timestamp: Math.round((i * 1e6) / F), duration: Math.round(1e6 / F) });
      enc.encode(vf, { keyFrame: i % (F * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) this.recUI(0.25 + 0.75 * (i / total));
    }

    let blob = null;
    if (!this.cancelVideo && !encErr) {
      try { await enc.flush(); mux.finalize(); blob = new Blob([target.buffer], { type: 'video/mp4' }); } catch (e) { encErr = e; }
    }
    try { enc.close(); } catch (e) {}
    // volta ao normal
    if (this.map) {
      root.classList.remove('rec'); m.setPixelRatio(prevPR); m.resize(); try { m.setLayoutProperty('jg-done', 'visibility', 'visible'); } catch (e) {}
      this.pins.forEach((p) => (p.getElement().style.visibility = '')); this.dot.getElement().style.visibility = '';
      this.t = prevT; this.setDone(this.t * this.total); m.jumpTo(this.overCam(endB)); this.ui();
    }
    this.busy = false;
    if (blob) { this.recUI(1); FX.download(`justgo-3d-${new Date(this.act.start).toISOString().slice(0, 10)}.mp4`, blob, 'video/mp4'); FX.toast('Vídeo pronto!'); Native.haptic && Native.haptic('success'); }
    else if (encErr) { console.warn(encErr); FX.toast('Não deu para gerar o vídeo. Tente no modo leve.'); }
    const s = $('#v3Rec'); if (s) s.remove();
  },

  // desenha um quadro do vídeo: mapa + bolinha + textos
  compose(g, t, outro, intro) {
    const W = this.W, H = this.H, m = this.map, cv = m.getCanvas(), pr = m.getPixelRatio(), a = this.act, sp = CONFIG.sports[a.sport] || {};
    const s = Math.max(W / cv.width, H / cv.height), dw = cv.width * s, dh = cv.height * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
    g.drawImage(cv, ox, oy, dw, dh);
    const px = (ll) => { const p = m.project(ll); return [ox + p.x * pr * s, oy + p.y * pr * s]; };
    // pontos atrás da câmera projetam em lugar errado (viravam retas cruzando a tela):
    // mede o quanto cada ponto está "à frente" e ignora o que está atrás da borda de baixo
    const el = m.getContainer(), ctr = m.getCenter(), br = (m.getBearing() * Math.PI) / 180, kx = 111320 * Math.cos((ctr.lat * Math.PI) / 180);
    const fwd = (ll) => (ll[0] - ctr.lng) * kx * Math.sin(br) + (ll[1] - ctr.lat) * 110540 * Math.cos(br);
    const bot = m.unproject([el.clientWidth / 2, el.clientHeight]), lim = Math.min(-150, fwd([bot.lng, bot.lat]) * 1.6);
    const vis = (ll) => fwd(ll) > lim;
    const P = this.P, ring = (ll, fill, r) => { if (!vis(ll)) return; const [x, y] = px(ll); if (x < -40 || y < -40 || x > W + 40 || y > H + 40) return; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(x, y, r - 5, 0, 7); g.fillStyle = fill; g.fill(); };
    const Q = this.Q, dNow = t * this.total, seg = [];
    if (Q && Q.length) {
      let cur = [];
      for (let k = 0; k < Q.length && Q[k].d <= dNow; k++) {
        if (!vis(Q[k].ll)) { if (cur.length) { seg.push(cur); cur = []; } continue; }
        const q = px(Q[k].ll), l = cur[cur.length - 1];
        if ((Q[k].br || (l && Math.hypot(q[0] - l[0], q[1] - l[1]) > W * 1.2)) && cur.length) { seg.push(cur); cur = []; }
        cur.push(q);
      }
      const h = this.at(dNow).pos; if (cur.length) { const [lx, ly] = cur[cur.length - 1], [hx2, hy2] = px([h[1], h[0]]); if (Math.hypot(hx2 - lx, hy2 - ly) < 400) cur.push([hx2, hy2]); } seg.push(cur);
      g.lineCap = 'round'; g.lineJoin = 'round';
      [['#fff', 14], [this.color, 9]].forEach(([c, w]) => { g.strokeStyle = c; g.lineWidth = w; seg.forEach((sg) => { if (sg.length < 2) return; g.beginPath(); g.moveTo(sg[0][0], sg[0][1]); for (let k = 1; k < sg.length; k++) g.lineTo(sg[k][0], sg[k][1]); g.stroke(); }); });
    }
    ring([P[0][1], P[0][0]], '#12B886', 15);
    if (t >= 0.98) ring([P[P.length - 1][1], P[P.length - 1][0]], '#111827', 15);
    const here = this.at(t * this.total).pos, [hx, hy] = px([here[1], here[0]]);
    g.beginPath(); g.arc(hx, hy, 30, 0, 7); g.fillStyle = this.color + '44'; g.fill();
    g.beginPath(); g.arc(hx, hy, 17, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.arc(hx, hy, 12, 0, 7); g.fillStyle = this.color; g.fill();

    this.hud(g, t, outro, intro);
  },

  // logo do JustGo desenhada direto no canvas (mesmo desenho do ícone do app)
  logo(g, x, y, sz) {
    g.save(); g.translate(x, y); g.scale(sz / 64, sz / 64);
    const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#4A8CFF'); gr.addColorStop(0.55, '#1F6BFF'); gr.addColorStop(1, '#0F47D6');
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, 64, 64, 15) : g.rect(0, 0, 64, 64); g.fillStyle = gr; g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 7.75; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(34.4, 18.5); g.lineTo(47.25, 32); g.lineTo(34.4, 45.5); g.stroke();
    const A = g.globalAlpha, bar = (bx, by, w, col, o) => { g.globalAlpha = o * A; g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(bx, by, w, 3.6, 1.8) : g.rect(bx, by, w, 3.6); g.fill(); };
    bar(17.9, 23.2, 11, '#fff', 0.72); bar(12.5, 30.2, 16.4, '#FFC72E', 1); bar(21.25, 37.2, 7.6, '#fff', 0.72); g.globalAlpha = A;
    g.restore();
  },

  // informações do vídeo: faixa de cinema no topo (logo + título) e no rodapé (números + altimetria).
  // O meio do quadro fica livre para a rota.
  hud(g, t, outro, intro) {
    const W = this.W, H = this.H, a = this.act, sp = CONFIG.sports[a.sport] || {}, col = this.color;
    // entrada em etapas (fade + leve deslize): faixas → logo → título → números → altimetria
    const I0 = intro == null ? 1 : intro, st = (a0, b0) => { const x = Math.max(0, Math.min(1, (I0 - a0) / (b0 - a0))); return 1 - Math.pow(1 - x, 3); };
    const eBg = st(0, 0.35), eLogo = st(0.1, 0.5), eTitle = st(0.22, 0.62), eNum = st(0.36, 0.8), eProf = st(0.5, 1);
    const ls = (v) => { try { g.letterSpacing = v; } catch (e) {} };
    const fit = (txt, max) => { let t2 = txt; while (g.measureText(t2).width > max && t2.length > 4) t2 = t2.slice(0, -2); return t2 === txt ? txt : t2 + '…'; };
    const shadow = (on) => { g.shadowColor = on ? 'rgba(0,0,0,.45)' : 'transparent'; g.shadowBlur = on ? 14 : 0; g.shadowOffsetY = on ? 2 : 0; };
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';

    // degradês suaves (curtos) só para dar leitura ao texto
    g.globalAlpha = eBg; let gr = g.createLinearGradient(0, 0, 0, 250); gr.addColorStop(0, 'rgba(6,10,24,.82)'); gr.addColorStop(0.55, 'rgba(6,10,24,.4)'); gr.addColorStop(1, 'rgba(6,10,24,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 250);
    gr = g.createLinearGradient(0, H - 330, 0, H); gr.addColorStop(0, 'rgba(6,10,24,0)'); gr.addColorStop(0.4, 'rgba(6,10,24,.62)'); gr.addColorStop(1, 'rgba(6,10,24,.92)');
    g.fillStyle = gr; g.fillRect(0, H - 330, W, 330);

    // ---- topo: logo + JustGo · etiqueta do esporte
    const ty = 44 - (1 - eLogo) * 24;
    g.globalAlpha = eLogo; const ls0 = 54 * (0.7 + 0.3 * eLogo); this.logo(g, 40 + (54 - ls0) / 2, ty + (54 - ls0) / 2, ls0);
    g.font = 'italic 800 44px "Barlow Condensed", Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText('Just', 106, ty + 42);
    const jw = g.measureText('Just').width; g.fillStyle = '#5B9BFF'; g.fillText('Go', 106 + jw, ty + 42);
    g.font = '800 17px Inter, sans-serif'; ls('2px'); const tag = String(sp.name || 'Treino').toUpperCase(), tw = g.measureText(tag).width + 46; ls('0px');
    const tx = W - 40 - tw; g.beginPath(); g.roundRect ? g.roundRect(tx, ty + 9, tw, 36, 18) : g.rect(tx, ty + 9, tw, 36); g.fillStyle = 'rgba(255,255,255,.14)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.arc(tx + 19, ty + 27, 5.5, 0, 7); g.fillStyle = col; g.fill();
    g.fillStyle = '#fff'; ls('2px'); g.fillText(tag, tx + 32, ty + 33); ls('0px');
    // título + data
    g.globalAlpha = eTitle; g.save(); g.translate(0, (1 - eTitle) * 18); shadow(true);
    g.font = '800 38px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(fit(UI.actTitle(a), W - 80), 40, ty + 112);
    g.font = '500 21px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(Fmt.date(a.start), 40, ty + 144);
    shadow(false); g.restore();

    // ---- rodapé: três números grandes
    const dist = t * this.total, secs = (a.duration || 0) * (dist / (a.distance || this.total || 1));
    const avg = a.duration ? (a.distance || this.total) / a.duration : 0;
    const cols = [['DISTÂNCIA', Fmt.km(dist), 'km'], ['TEMPO', Fmt.time(secs), ''], [String(Fmt.paceLabel(a.sport, true)).toUpperCase(), Fmt.pace(a.sport, avg), Fmt.paceUnit(a.sport)]];
    const by0 = H - 214, cw3 = (W - 80) / 3, by = by0;
    cols.forEach(([lab, val, unit], k) => {
      const ek = st(0.36 + k * 0.08, 0.76 + k * 0.08); g.globalAlpha = ek; g.save(); g.translate(0, (1 - ek) * 28);
      const x = 40 + k * cw3;
      g.fillStyle = col; g.fillRect(x, by - 18, 22, 4);
      g.font = '700 16px Inter, sans-serif'; ls('1.6px'); g.fillStyle = 'rgba(255,255,255,.66)'; g.fillText(lab, x, by + 12); ls('0px');
      shadow(true); g.font = '800 62px "Barlow Condensed", Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(val, x, by + 72); shadow(false);
      if (unit) { const vw = g.measureText(val).width; g.font = '700 20px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.66)'; if (vw + 10 + g.measureText(unit).width < cw3 - 8) g.fillText(unit, x + vw + 8, by + 72); }
      g.restore();
    });
    g.globalAlpha = eProf;
    // ---- altimetria (ou barra) que vai enchendo
    const px0 = 40, pw = W - 80, py0 = H - 108 + (1 - eProf) * 20, ph = 52 * (0.4 + 0.6 * eProf), E = this.prof;
    if (E) {
      const X = (k) => px0 + (pw * k) / (E.length - 1), Y = (k) => py0 + ph - E[k] * ph;
      const path = () => { g.beginPath(); g.moveTo(px0, py0 + ph); E.forEach((_, k) => g.lineTo(X(k), Y(k))); g.lineTo(px0 + pw, py0 + ph); g.closePath(); };
      path(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
      g.save(); g.beginPath(); g.rect(px0, py0 - 10, pw * t, ph + 20); g.clip();
      const fg = g.createLinearGradient(0, py0, 0, py0 + ph); fg.addColorStop(0, col); fg.addColorStop(1, col + '33'); path(); g.fillStyle = fg; g.fill();
      g.beginPath(); E.forEach((_, k) => (k ? g.lineTo(X(k), Y(k)) : g.moveTo(X(k), Y(k)))); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); g.restore();
      const f = t * (E.length - 1), k0 = Math.min(E.length - 2, Math.floor(f)), hy = Y(k0) + (Y(k0 + 1) - Y(k0)) * (f - k0), hx = px0 + pw * t;
      g.beginPath(); g.arc(hx, hy, 14, 0, 7); g.fillStyle = col + '55'; g.fill();
      g.beginPath(); g.arc(hx, hy, 7.5, 0, 7); g.fillStyle = '#fff'; g.fill();
    } else {
      const ry = py0 + ph - 8, rd = (x, w) => { g.beginPath(); g.roundRect ? g.roundRect(x, ry, w, 8, 4) : g.rect(x, ry, w, 8); g.fill(); };
      g.fillStyle = 'rgba(255,255,255,.18)'; rd(px0, pw); if (t > 0) { g.fillStyle = col; rd(px0, Math.max(8, pw * t)); }
    }
    g.globalAlpha = 1;
    // fim: chamada com a logo, acima dos números
    if (outro > 0.35) {
      const eo = 1 - Math.pow(1 - Math.min(1, (outro - 0.35) * 2.2), 3); g.globalAlpha = eo;
      g.font = '700 21px Inter, sans-serif'; const msg = 'Grave o seu no app JustGo', mw = g.measureText(msg).width, bw = mw + 82, bx = (W - bw) / 2, yy = by - 96 + (1 - eo) * 24;
      g.beginPath(); g.roundRect ? g.roundRect(bx, yy, bw, 50, 25) : g.rect(bx, yy, bw, 50); g.fillStyle = 'rgba(6,10,24,.72)'; g.fill();
      this.logo(g, bx + 10, yy + 9, 32); g.fillStyle = '#fff'; g.fillText(msg, bx + 56, yy + 33);
      g.globalAlpha = 1;
    }
  },

  // perfil de altimetria normalizado (0–1) em 90 colunas; nulo se o treino não tem altitude
  profile() {
    const P = this.P, D = this.D, n = 90, E = []; let ok = 0;
    for (let k = 0; k < n; k++) { const d = (k / (n - 1)) * this.total; let i = this.at(d).i; const v = P[i] && P[i][3]; E.push(v == null ? null : v); if (v != null) ok++; }
    if (ok < n * 0.6) return (this.prof = null);
    for (let k = 0; k < n; k++) if (E[k] == null) E[k] = k ? E[k - 1] : E.find((v) => v != null);
    const S = E.map((_, k) => { let s = 0, c = 0; for (let j = Math.max(0, k - 2); j <= Math.min(n - 1, k + 2); j++) { s += E[j]; c++; } return s / c; });
    const lo = Math.min(...S), hi = Math.max(...S), span = Math.max(25, hi - lo);
    return (this.prof = S.map((v) => 0.12 + (0.88 * (v - lo)) / span));
  },

  // trajeto simplificado (~1 ponto a cada 12 m) para desenhar no vídeo
  linePts() {
    const P = this.P, D = this.D, Q = []; let last = -1e9;
    for (let k = 0; k < P.length; k++) if (P[k][4] || D[k] - last >= 12 || k === P.length - 1) { Q.push({ ll: [P[k][1], P[k][0]], d: D[k], br: !!P[k][4] }); last = D[k]; }
    this.Q = Q;
  },
  recUI(f, label) {
    let el = $('#v3Rec');
    if (!el) {
      el = document.createElement('div'); el.id = 'v3Rec'; el.className = 'v3-rec';
      el.innerHTML = `<div class="v3-rec-box"><b>Gerando vídeo…</b><small>Leva alguns segundos. Deixe o app aberto.</small><div class="v3-rec-bar"><i></i></div><button class="btn ghost sm" data-act="v3Cancel">Cancelar</button></div>`;
      $('.v3').appendChild(el);
    }
    el.querySelector('i').style.width = `${Math.round(f * 100)}%`;
    el.querySelector('b').textContent = f >= 1 ? 'Vídeo pronto!' : `${label || 'Gerando vídeo…'} ${Math.round(f * 100)}%`;
  },
};
