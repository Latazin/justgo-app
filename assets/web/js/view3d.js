/* =========================================================
   JustGo — TREINO EM 3D
   Relevo real (AWS Terrain Tiles, aberto e sem chave), prédios
   do OpenStreetMap quando existirem e o percurso desenhado
   sobre o terreno. "Voo" segue o trajeto do início ao fim.
   ========================================================= */
const View3D = {
  DEM: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  map: null, raf: 0, playing: false, t: 0,
  weak() { const m = navigator.deviceMemory || 4, c = navigator.hardwareConcurrency || 8; return m <= 3 || c <= 4; },
  supported() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } },

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
    return true;
  },

  mount(el) {
    const M = CONFIG.maps, P = this.P, light = this.light;
    const lngs = P.map((p) => p[1]), lats = P.map((p) => p[0]);
    const map = new maplibregl.Map({
      container: el, style: M.color, attributionControl: { compact: true },
      bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], fitBoundsOptions: { padding: 50 },
      pitch: 60, bearing: -20, maxPitch: 80, pixelRatio: light ? 1 : Math.min(2, window.devicePixelRatio || 1), antialias: !light,
    });
    this.map = map;
    map.on('error', (e) => console.warn('3D', e && e.error && e.error.message));
    map.on('load', () => {
      try {
        map.addSource('dem', { type: 'raster-dem', tiles: [this.DEM], encoding: 'terrarium', tileSize: 256, maxzoom: light ? 12 : 14, attribution: 'Relevo: Terrain Tiles (AWS/Mapzen)' });
        map.setTerrain({ source: 'dem', exaggeration: light ? 1.25 : 1.6 });
        const firstSymbol = (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
        if (!light) map.addLayer({ id: 'jg-hill', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5a6b7d' } }, firstSymbol);
        if (map.setSky) map.setSky({ 'sky-color': '#7fb6ff', 'horizon-color': '#e6f0ff', 'fog-color': '#f2f6fb', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 });
      } catch (e) { console.warn(e); }
      // prédios em 3D: liga os que o estilo já tem; no modo leve, desliga
      map.getStyle().layers.filter((l) => l.type === 'fill-extrusion').forEach((l) => { try { map.setLayoutProperty(l.id, 'visibility', light ? 'none' : 'visible'); } catch (e) {} });
      const segs = Geo.segments(P).map((s) => s.map((p) => [p[1], p[0]]));
      map.addSource('jg-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segs } } });
      map.addSource('jg-done', { type: 'geojson', data: this.doneGeo(0) });
      map.addLayer({ id: 'jg-route-case', type: 'line', source: 'jg-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'jg-route', type: 'line', source: 'jg-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': this.color, 'line-width': 5, 'line-opacity': 0.45 } });
      map.addLayer({ id: 'jg-done', type: 'line', source: 'jg-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': this.color, 'line-width': 6 } });
      const pin = (cls) => { const d = document.createElement('div'); d.className = 'pin ' + cls; d.innerHTML = '<i></i>'; return d; };
      new maplibregl.Marker({ element: pin('start') }).setLngLat([P[0][1], P[0][0]]).addTo(map);
      new maplibregl.Marker({ element: pin('end') }).setLngLat([P[P.length - 1][1], P[P.length - 1][0]]).addTo(map);
      const me = document.createElement('div'); me.className = 'v3-dot'; me.style.setProperty('--c', this.color);
      this.dot = new maplibregl.Marker({ element: me }).setLngLat([P[0][1], P[0][0]]).addTo(map);
      this.ready = true; this.ui();
      setTimeout(() => this.play(), 900);
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

  // voo: duração proporcional à distância (12 s a 45 s)
  play() {
    if (!this.ready) return;
    if (this.t >= 1) this.t = 0;
    this.playing = true; this.ui();
    const dur = Math.max(12000, Math.min(45000, (this.total / 1000) * 4500)); let last = performance.now(), frame = 0, brg = this.map.getBearing();
    const step = (now) => {
      if (!this.playing || !this.map) return;
      this.t = Math.min(1, this.t + (now - last) / dur); last = now;
      const d = this.t * this.total, here = this.at(d).pos, ahead = this.at(Math.min(this.total, d + 160)).pos;
      let target = this.bearing(here, ahead); if (!isFinite(target)) target = brg;
      let diff = ((target - brg + 540) % 360) - 180; brg += diff * 0.04; // vira suave
      this.map.jumpTo({ center: [here[1], here[0]], bearing: brg, pitch: 62, zoom: this.light ? 15 : 15.6 });
      this.dot.setLngLat([here[1], here[0]]);
      if (++frame % 3 === 0 || this.t >= 1) { const s = this.map.getSource('jg-done'); if (s) s.setData(this.doneGeo(d)); this.ui(true); }
      if (this.t >= 1) { this.playing = false; this.ui(); this.overview(); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  pause() { this.playing = false; cancelAnimationFrame(this.raf); this.ui(); },
  overview() {
    const P = this.P, lngs = P.map((p) => p[1]), lats = P.map((p) => p[0]);
    this.map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, pitch: 55, bearing: this.map.getBearing() - 30, duration: 2200 });
  },
  seek(f) { this.pause(); this.t = Math.max(0, Math.min(1, f)); const d = this.t * this.total, h = this.at(d).pos; this.dot.setLngLat([h[1], h[0]]); const s = this.map.getSource('jg-done'); if (s) s.setData(this.doneGeo(d)); this.map.easeTo({ center: [h[1], h[0]], duration: 400 }); this.ui(); },
  ui(onlyProgress) {
    const bar = $('#v3Prog'), km = $('#v3Km'); if (bar) bar.value = Math.round(this.t * 1000); if (km) km.textContent = `${Fmt.km(this.t * this.total)} km`;
    if (onlyProgress) return;
    const b = $('#v3Play'); if (b) b.innerHTML = this.playing ? I('pause') : I('play');
    const l = $('#v3Light'); if (l) l.classList.toggle('on', !!this.light);
  },
  close() { this.pause(); if (this.map) { try { this.map.remove(); } catch (e) {} } this.map = null; this.ready = false; },
};
