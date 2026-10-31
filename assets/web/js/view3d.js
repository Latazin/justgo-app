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
    // trajeto leve (um ponto a cada ~8 m) com distância acumulada
    const P = [pts[0]]; for (let i = 1; i < pts.length; i++) if (pts[i][4] || Geo.dist(P[P.length - 1], pts[i]) >= 8) P.push(pts[i]);
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
    // direção: olha ~180 m à frente e suaviza bastante (curvas largas, sem chicote)
    const ah = Math.max(1, Math.round(180 / step));
    let B = C.map((c, k) => { const j = Math.min(N - 1, k + ah), i0 = j === k ? Math.max(0, k - ah) : k; return this.bearing(C[i0], C[j === k ? k : j]); });
    for (let k = 1; k < N; k++) { if (!isFinite(B[k])) B[k] = B[k - 1]; while (B[k] - B[k - 1] > 180) B[k] -= 360; while (B[k] - B[k - 1] < -180) B[k] += 360; }
    if (!isFinite(B[0])) B[0] = 0;
    const wb = Math.max(3, Math.round(260 / step));
    B = B.map((_, k) => { let s = 0, n = 0; for (let j = Math.max(0, k - wb); j <= Math.min(N - 1, k + wb); j++) { s += B[j]; n++; } return s / n; });
    this.T = { N, C, B };
  },
  zoom() { return this.light ? 15 : 15.5; },
  cam(t) {
    const { N, C, B } = this.T, f = Math.max(0, Math.min(1, t)) * (N - 1), i = Math.min(N - 2, Math.floor(f)), u = f - i;
    return { center: [C[i][1] + (C[i + 1][1] - C[i][1]) * u, C[i][0] + (C[i + 1][0] - C[i][0]) * u], bearing: B[i] + (B[i + 1] - B[i]) * u, pitch: 60, zoom: this.zoom() };
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
  flyMs() { return Math.max(12000, Math.min(45000, (this.total / 1000) * 4500)); },
  setDone(d) { const s = this.map && this.map.getSource('jg-done'); if (s) s.setData(this.doneGeo(d)); },

  // voo: duração proporcional à distância (12 s a 45 s)
  play() {
    if (!this.ready || this.busy) return;
    if (this.t >= 1) { this.t = 0; this.setDone(0); }
    this.playing = true; this.ui();
    const dur = this.flyMs(), m = this.map;
    const run = () => {
      let last = performance.now(), lastData = 0;
      const step = (now) => {
        if (!this.playing || !this.map) return;
        // se um quadro demorar (tile chegando), o voo desacelera em vez de dar um salto
        this.t = Math.min(1, this.t + Math.min(now - last, 50) / dur); last = now;
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

  // um quadro "pronto": espera o mapa terminar de carregar e copia o canvas no mesmo instante
  frame(draw) {
    const m = this.map;
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(to); m.off('idle', fin); try { draw(); } catch (e) { console.warn(e); } res(); };
      const to = setTimeout(() => { m.off('idle', fin); if (this.cancelVideo || !this.map) { done = true; return res(); } m.once('render', fin); m.triggerRepaint(); }, this.light ? 2500 : 4000);
      m.once('idle', fin); m.triggerRepaint();
    });
  },

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
    m.resize(); m.setPixelRatio(this.W / m.getContainer().clientWidth); m.resize();
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
    const F = this.FPS, nIn = Math.round(1.3 * F), nFly = Math.round(Math.max(8, Math.min(16, this.flyMs() / 2800)) * F), nOut = Math.round(3.2 * F), total = nIn + nFly + nOut;
    const c0 = this.cam(0), c1 = this.cam(1), endB = c1.bearing - 35, over = this.overCam(endB);
    const intro = { ...this.overCam(c0.bearing - 50), pitch: 45 };
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const mix = (a, b, u) => {
      let db = b.bearing - a.bearing; while (db > 180) db -= 360; while (db < -180) db += 360;
      return { center: [a.center[0] + (b.center[0] - a.center[0]) * u, a.center[1] + (b.center[1] - a.center[1]) * u], zoom: a.zoom + (b.zoom - a.zoom) * u, pitch: a.pitch + (b.pitch - a.pitch) * u, bearing: a.bearing + db * u };
    };
    let lastDone = -1;
    for (let i = 0; i < total && !this.cancelVideo && !encErr; i++) {
      let t, cam;
      if (i < nIn) { t = 0; cam = mix(intro, c0, ease(i / nIn)); }
      else if (i < nIn + nFly) { const u = (i - nIn) / (nFly - 1); t = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; t = 0.15 * t + 0.85 * u; cam = this.cam(t); } // começa e termina macio
      else { const u = (i - nIn - nFly) / (nOut - 1); t = 1; cam = mix(c1, over, ease(Math.min(1, u * 1.6))); cam.bearing += u * 18; }
      m.jumpTo(cam);
      const d = t * this.total; if (Math.abs(d - lastDone) > 0.5) { this.setDone(d); lastDone = d; }
      await this.frame(() => this.compose(g, t, i >= nIn + nFly ? (i - nIn - nFly) / (nOut - 1) : 0));
      const vf = new VideoFrame(out, { timestamp: Math.round((i * 1e6) / F), duration: Math.round(1e6 / F) });
      enc.encode(vf, { keyFrame: i % (F * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) this.recUI(i / total);
    }

    let blob = null;
    if (!this.cancelVideo && !encErr) {
      try { await enc.flush(); mux.finalize(); blob = new Blob([target.buffer], { type: 'video/mp4' }); } catch (e) { encErr = e; }
    }
    try { enc.close(); } catch (e) {}
    // volta ao normal
    if (this.map) {
      root.classList.remove('rec'); m.setPixelRatio(prevPR); m.resize();
      this.pins.forEach((p) => (p.getElement().style.visibility = '')); this.dot.getElement().style.visibility = '';
      this.t = prevT; this.setDone(this.t * this.total); m.jumpTo(this.overCam(endB)); this.ui();
    }
    this.busy = false;
    if (blob) { this.recUI(1); FX.download(`justgo-3d-${new Date(this.act.start).toISOString().slice(0, 10)}.mp4`, blob, 'video/mp4'); FX.toast('Vídeo pronto!'); Native.haptic && Native.haptic('success'); }
    else if (encErr) { console.warn(encErr); FX.toast('Não deu para gerar o vídeo. Tente no modo leve.'); }
    const s = $('#v3Rec'); if (s) s.remove();
  },

  // desenha um quadro do vídeo: mapa + bolinha + textos
  compose(g, t, outro) {
    const W = this.W, H = this.H, m = this.map, cv = m.getCanvas(), pr = m.getPixelRatio(), a = this.act, sp = CONFIG.sports[a.sport] || {};
    const s = Math.max(W / cv.width, H / cv.height), dw = cv.width * s, dh = cv.height * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
    g.drawImage(cv, ox, oy, dw, dh);
    const px = (ll) => { const p = m.project(ll); return [ox + p.x * pr * s, oy + p.y * pr * s]; };
    const P = this.P, ring = (ll, fill, r) => { const [x, y] = px(ll); if (x < -40 || y < -40 || x > W + 40 || y > H + 40) return; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(x, y, r - 5, 0, 7); g.fillStyle = fill; g.fill(); };
    ring([P[0][1], P[0][0]], '#12B886', 15);
    if (t >= 0.98) ring([P[P.length - 1][1], P[P.length - 1][0]], '#111827', 15);
    const here = this.at(t * this.total).pos, [hx, hy] = px([here[1], here[0]]);
    g.beginPath(); g.arc(hx, hy, 30, 0, 7); g.fillStyle = this.color + '44'; g.fill();
    g.beginPath(); g.arc(hx, hy, 17, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.arc(hx, hy, 12, 0, 7); g.fillStyle = this.color; g.fill();

    // faixas escuras para o texto ler bem sobre qualquer mapa
    let gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, 'rgba(8,12,24,.62)'); gr.addColorStop(1, 'rgba(8,12,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 300);
    gr = g.createLinearGradient(0, H - 380, 0, H); gr.addColorStop(0, 'rgba(8,12,24,0)'); gr.addColorStop(1, 'rgba(8,12,24,.78)'); g.fillStyle = gr; g.fillRect(0, H - 380, W, 380);

    g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    g.font = 'italic 800 64px "Barlow Condensed", Inter, sans-serif'; g.fillText('JustGo', 48, 104);
    const jw = g.measureText('JustGo').width; g.fillStyle = '#1F6BFF'; g.beginPath(); g.arc(48 + jw + 14, 92, 9, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '700 32px Inter, sans-serif';
    let title = UI.actTitle(a); while (g.measureText(title).width > W - 96 && title.length > 4) title = title.slice(0, -2); if (title !== UI.actTitle(a)) title += '…';
    g.fillText(title, 48, 160);
    g.font = '500 24px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.78)'; g.fillText(`${sp.name || ''} · ${Fmt.date(a.start)}`, 48, 198);

    // números: crescem junto com o voo
    const dist = t * this.total, secs = (a.duration || 0) * (dist / (a.distance || this.total || 1));
    const avg = a.duration ? (a.distance || this.total) / a.duration : 0;
    const cols = [['DISTÂNCIA', `${Fmt.km(dist)}`, 'km'], ['TEMPO', Fmt.time(secs), ''], [Fmt.paceLabel(a.sport, true).toUpperCase(), Fmt.pace(a.sport, avg), Fmt.paceUnit(a.sport)]];
    const cw = (W - 96) / 3;
    cols.forEach(([lab, val, unit], k) => {
      const x = 48 + k * cw;
      g.font = '600 20px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.72)'; g.fillText(lab, x, H - 168);
      g.font = '800 52px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(val, x, H - 110);
      if (unit) { g.font = '600 22px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.72)'; g.fillText(unit, x, H - 76); }
    });
    // barra de progresso do percurso
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(48, H - 50, W - 96, 6);
    g.fillStyle = this.color; g.fillRect(48, H - 50, (W - 96) * t, 6);
    if (outro > 0.35) { g.globalAlpha = Math.min(1, (outro - 0.35) * 3); g.font = '600 22px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.9)'; g.textAlign = 'right'; g.fillText('Grave o seu no app JustGo', W - 48, H - 20); g.textAlign = 'left'; g.globalAlpha = 1; }
  },

  recUI(f) {
    let el = $('#v3Rec');
    if (!el) {
      el = document.createElement('div'); el.id = 'v3Rec'; el.className = 'v3-rec';
      el.innerHTML = `<div class="v3-rec-box"><b>Gerando vídeo…</b><small>Pode demorar um pouco. Deixe o app aberto.</small><div class="v3-rec-bar"><i></i></div><button class="btn ghost sm" data-act="v3Cancel">Cancelar</button></div>`;
      $('.v3').appendChild(el);
    }
    el.querySelector('i').style.width = `${Math.round(f * 100)}%`;
    el.querySelector('b').textContent = f >= 1 ? 'Vídeo pronto!' : `Gerando vídeo… ${Math.round(f * 100)}%`;
  },
};
