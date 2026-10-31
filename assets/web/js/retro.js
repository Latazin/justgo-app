/* =========================================================
   JustGo — RETROSPECTIVA 3D DO MÊS
   Um vídeo voando por todos os treinos do mês, com os números
   da temporada. Pode ser gerada UMA vez por mês, só na última
   semana do mês. Tudo feito no celular (MapLibre + WebCodecs).
   ========================================================= */
const Retro = {
  W: 720, H: 1280, FPS: 30, map: null, light: false, cancelVideo: false,
  MONTHS: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],

  key(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; },
  daysIn(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); },
  openFrom(d = new Date()) { return this.daysIn(d) - 6; }, // última semana: os 7 últimos dias
  isOpen(d = new Date()) { return d.getDate() >= this.openFrom(d); },
  used(k = this.key()) { return !!(Store.data.retro && Store.data.retro[k]); },
  monthName(d = new Date()) { return this.MONTHS[d.getMonth()]; },

  acts(d = new Date()) {
    const a0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), a1 = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    return Store.data.activities.filter((a) => a.start >= a0 && a.start < a1 && !a.flagged).sort((x, y) => x.start - y.start);
  },
  stats(list) {
    const km = list.reduce((s, a) => s + a.distance, 0) / 1000, time = list.reduce((s, a) => s + (a.duration || 0), 0);
    const elev = list.reduce((s, a) => s + (a.points ? Geo.elevationGain(a.points) : 0), 0);
    const by = {}; list.forEach((a) => (by[a.sport] = (by[a.sport] || 0) + a.distance));
    const fav = Object.keys(by).sort((x, y) => by[y] - by[x])[0];
    const big = [...list].sort((x, y) => y.distance - x.distance)[0];
    const days = new Set(list.map((a) => new Date(a.start).getDate())).size;
    return { km, n: list.length, time, elev, fav, big, days };
  },

  // estado para a tela/home: 'soon' | 'open' | 'used' | 'empty'
  state(d = new Date()) {
    if (this.used(this.key(d))) return 'used';
    const gps = this.acts(d).filter((a) => a.points && a.points.length > 1);
    if (!this.isOpen(d)) return 'soon';
    return gps.length ? 'open' : 'empty';
  },

  /* ---------- geometria de cada treino ---------- */
  prep(a) {
    const pts = (a.points || []).filter((p) => p && p[0] != null); if (pts.length < 2) return null;
    const P = [pts[0]]; for (let i = 1; i < pts.length; i++) if (pts[i][4] || Geo.dist(P[P.length - 1], pts[i]) >= 10) P.push(pts[i]);
    const D = [0]; for (let i = 1; i < P.length; i++) D.push(D[i - 1] + (P[i][4] ? 0 : Geo.dist(P[i - 1], P[i])));
    const total = D[D.length - 1] || 1, o = { a, P, D, total, color: Shop.lineColor(a.sport) };
    // câmera suavizada (mesma ideia do 3D de um treino)
    const N = Math.max(60, Math.min(500, Math.round(total / 12))), step = total / (N - 1), raw = [];
    for (let k = 0; k < N; k++) raw.push(this.at(o, k * step));
    const w = Math.max(2, Math.round(80 / step)), C = raw.map((_, k) => { let x = 0, y = 0, n = 0; for (let j = Math.max(0, k - w); j <= Math.min(N - 1, k + w); j++) { x += raw[j][0]; y += raw[j][1]; n++; } return [x / n, y / n]; });
    const ah = Math.max(1, Math.round(200 / step));
    let B = C.map((c, k) => (k + ah < N ? View3D.bearing(C[k], C[k + ah]) : NaN));
    for (let k = 1; k < N; k++) { if (!isFinite(B[k])) B[k] = B[k - 1]; while (B[k] - B[k - 1] > 180) B[k] -= 360; while (B[k] - B[k - 1] < -180) B[k] += 360; }
    if (!isFinite(B[0])) B[0] = 0;
    const wb = Math.max(3, Math.round(300 / step)); B = B.map((_, k) => { let s = 0, n = 0; for (let j = Math.max(0, k - wb); j <= Math.min(N - 1, k + wb); j++) { s += B[j]; n++; } return s / n; });
    o.T = { N, C, B };
    o.Q = []; let last = -1e9; for (let k = 0; k < P.length; k++) if (P[k][4] || D[k] - last >= 15 || k === P.length - 1) { o.Q.push({ ll: [P[k][1], P[k][0]], d: D[k], br: !!P[k][4] }); last = D[k]; }
    return o;
  },
  at(o, d) {
    const D = o.D, P = o.P; let lo = 0, hi = D.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (D[m] < d) lo = m + 1; else hi = m; }
    const i = Math.max(1, lo), a = P[i - 1], b = P[i], f = D[i] - D[i - 1] ? (d - D[i - 1]) / (D[i] - D[i - 1]) : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  },
  cam(o, t) {
    const { N, C, B } = o.T, f = Math.max(0, Math.min(1, t)) * (N - 1), i = Math.min(N - 2, Math.floor(f)), u = f - i;
    return { center: [C[i][1] + (C[i + 1][1] - C[i][1]) * u, C[i][0] + (C[i + 1][0] - C[i][0]) * u], bearing: B[i] + (B[i + 1] - B[i]) * u, pitch: 58, zoom: this.light ? 14 : 14.4 };
  },
  overCam(bearing, pitch = 50) {
    const all = this.items.flatMap((o) => o.P), lngs = all.map((p) => p[1]), lats = all.map((p) => p[0]);
    const el = this.map.getContainer(), pad = Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.12);
    const c = this.map.cameraForBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: pad * 2.2, bottom: pad * 2.6, left: pad, right: pad }, bearing, pitch }) || {};
    const ctr = c.center ? (c.center.lng != null ? [c.center.lng, c.center.lat] : c.center) : this.cam(this.items[0], 0.5).center;
    return { center: ctr, zoom: Math.min(15.5, (c.zoom || 12) - 0.1), bearing, pitch };
  },

  /* ---------- gerar ---------- */
  async start() {
    const d = new Date(), k = this.key(d), st = this.state(d);
    if (st === 'used') return FX.toast(`Sua retrospectiva de ${this.monthName(d)} já foi gerada. A próxima libera na última semana do mês que vem.`);
    if (st === 'soon') return FX.toast(`A retrospectiva de ${this.monthName(d)} libera no dia ${this.openFrom(d)}.`);
    if (st === 'empty') return FX.toast('Faça pelo menos um treino com GPS neste mês para gerar a retrospectiva.');
    if (!View3D.supported() || !window.maplibregl) return FX.toast('Seu aparelho não consegue gerar o vídeo em 3D.');
    if (!View3D.canVideo()) return FX.toast('Seu aparelho não consegue gerar vídeo. Atualize o "Android System WebView" na Play Store.');
    const ok = await FX.confirm(`Retrospectiva de ${this.monthName(d)} 🎬`, 'Você pode gerar <b>uma retrospectiva por mês</b>. O vídeo fica salvo no seu celular para compartilhar quando quiser. Leva cerca de 1 minuto: deixe o app aberto.', 'Gerar agora');
    if (!ok) return;
    const list = this.acts(d);
    const gps = list.map((a) => this.prep(a)).filter(Boolean);
    // destaques: até 6 treinos (os maiores), na ordem do mês
    const hi = [...gps].sort((x, y) => y.total - x.total).slice(0, 6).sort((x, y) => x.a.start - y.a.start);
    this.items = gps; this.hi = hi; this.S = this.stats(list); this.month = d;
    App.tab = 'retro'; UI.retroScreen();
    let blob = null;
    try { blob = await this.render(); } catch (e) { console.warn('retro', e); }
    if (blob) {
      Store.data.retro = Store.data.retro || {}; Store.data.retro[k] = Date.now(); Store.save(); Cloud.queuePush && Cloud.queuePush();
      try { await this.saveBlob(k, blob); } catch (e) {}
      FX.download(`justgo-retrospectiva-${k}.mp4`, blob, 'video/mp4');
      FX.toast('Retrospectiva pronta! 🎉');
    } else if (!this.cancelVideo) FX.toast('Não deu para gerar a retrospectiva agora. Ela continua disponível.');
    this.close(); App.go('home');
  },
  close() { this.cancelVideo = true; if (this.map) { try { this.map.remove(); } catch (e) {} } this.map = null; },

  mount() {
    return new Promise((ok) => {
      const light = (this.light = View3D.weak()), all = this.items.flatMap((o) => o.P), lngs = all.map((p) => p[1]), lats = all.map((p) => p[0]);
      const map = new maplibregl.Map({ container: $('#rtMap'), style: CONFIG.maps.color, attributionControl: false, bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], fitBoundsOptions: { padding: 40 }, pitch: 30, fadeDuration: 0, antialias: false, maxPitch: 80, pixelRatio: 1 });
      this.map = map;
      map.on('load', () => {
        try {
          map.addSource('dem', { type: 'raster-dem', tiles: [View3D.DEM], encoding: 'terrarium', tileSize: 256, maxzoom: light ? 12 : 13 });
          map.setTerrain({ source: 'dem', exaggeration: light ? 1.2 : 1.5 });
          if (map.setSky) map.setSky({ 'sky-color': '#7fb6ff', 'horizon-color': '#e6f0ff', 'fog-color': '#f2f6fb', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 });
        } catch (e) {}
        map.getStyle().layers.forEach((l) => { try { if (l.type === 'symbol' && /poi|housenum|transit/i.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none'); if (l.type === 'fill-extrusion' && light) map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (e) {} });
        const feats = this.items.map((o) => ({ type: 'Feature', properties: { c: o.color }, geometry: { type: 'MultiLineString', coordinates: Geo.segments(o.P).map((s) => s.map((p) => [p[1], p[0]])) } }));
        map.addSource('rt', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });
        map.addLayer({ id: 'rt-case', type: 'line', source: 'rt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.55 } });
        map.addLayer({ id: 'rt-line', type: 'line', source: 'rt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 3.5, 'line-opacity': 0.4 } });
        ok();
      });
      setTimeout(ok, 12000);
    });
  },

  async render() {
    this.cancelVideo = false;
    await this.mount(); if (!this.map) return null;
    const m = this.map;
    await View3D.loadMuxer(); const EC = await View3D.encoderConfig.call(this); if (!EC) return null;
    m.resize(); m.setPixelRatio((this.light ? 480 : 560) / m.getContainer().clientWidth); m.resize();
    const F = this.FPS, ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const mix = (a, b, u) => { let db = b.bearing - a.bearing; while (db > 180) db -= 360; while (db < -180) db += 360; return { center: [a.center[0] + (b.center[0] - a.center[0]) * u, a.center[1] + (b.center[1] - a.center[1]) * u], zoom: a.zoom + (b.zoom - a.zoom) * u, pitch: a.pitch + (b.pitch - a.pitch) * u, bearing: a.bearing + db * u }; };
    // roteiro: abertura (2,6 s) → cada destaque (0,6 s de transição + 2,2 s de voo) → fechamento com os números (4,8 s)
    const shots = [], o0 = this.overCam(-20, 35), o1 = this.overCam(-50, 52);
    for (let i = 0; i < 2.6 * F; i++) { const u = i / (2.6 * F - 1); shots.push({ cam: mix(o0, o1, ease(u)), k: -1, t: 0, scene: 'intro', u }); }
    let prev = o1;
    this.hi.forEach((o, n) => {
      const c0 = this.cam(o, 0), nT = Math.round(0.6 * F), nF = Math.round(2.2 * F);
      for (let i = 0; i < nT; i++) shots.push({ cam: mix(prev, c0, ease(i / nT)), k: n, t: 0, scene: 'fly' });
      for (let i = 0; i < nF; i++) { const u = i / (nF - 1), t = 0.1 * (u * u * (3 - 2 * u)) + 0.9 * u; shots.push({ cam: this.cam(o, t), k: n, t, scene: 'fly' }); }
      prev = this.cam(o, 1);
    });
    const oEnd = this.overCam(prev.bearing - 30, 50), nO = Math.round(4.8 * F);
    for (let i = 0; i < nO; i++) { const u = i / (nO - 1), c = mix(prev, oEnd, ease(Math.min(1, u * 2.2))); c.bearing += u * 22; shots.push({ cam: c, k: this.hi.length, t: 1, scene: 'outro', u }); }

    // pré-carrega o mapa nos pontos-chave
    const stops = [o0, o1, ...this.hi.flatMap((o) => [0, 0.33, 0.66, 1].map((t) => this.cam(o, t))), oEnd];
    for (let i = 0; i < stops.length && !this.cancelVideo; i++) { m.jumpTo(stops[i]); await View3D.settle.call(this, 1800); this.ui((i / stops.length) * 0.25, 'Preparando o mapa…'); }

    this.avImg = Avatar.on() ? await Avatar.png(null, { pose: 'cheer', mood: 'cheer', size: 230 }) : null;
    const out = document.createElement('canvas'); out.width = this.W; out.height = this.H;
    const g = out.getContext('2d', { alpha: false });
    try { await Promise.all(['800 64px "Barlow Condensed"', '700 30px Inter', '800 52px Inter', '600 22px Inter'].map((f) => document.fonts.load(f))); } catch (e) {}
    const target = new Mp4Muxer.ArrayBufferTarget();
    const mux = new Mp4Muxer.Muxer({ target, video: { codec: EC.mc, width: this.W, height: this.H, frameRate: F }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let err = null; const enc = new VideoEncoder({ output: (c, meta) => mux.addVideoChunk(c, meta), error: (e) => (err = e) });
    enc.configure(EC.cfg);
    for (let i = 0; i < shots.length && !this.cancelVideo && !err; i++) {
      const s = shots[i]; m.jumpTo(s.cam);
      await View3D.frame.call(this, () => this.compose(g, s));
      const vf = new VideoFrame(out, { timestamp: Math.round((i * 1e6) / F), duration: Math.round(1e6 / F) });
      enc.encode(vf, { keyFrame: i % (F * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) this.ui(0.25 + 0.75 * (i / shots.length));
    }
    if (this.cancelVideo || err) { try { enc.close(); } catch (e) {} return null; }
    await enc.flush(); mux.finalize(); try { enc.close(); } catch (e) {}
    this.ui(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  },

  // um quadro: mapa + linhas já percorridas + textos
  compose(g, s) {
    const W = this.W, H = this.H, m = this.map, cv = m.getCanvas(), pr = m.getPixelRatio();
    const sc = Math.max(W / cv.width, H / cv.height), dw = cv.width * sc, dh = cv.height * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;
    g.drawImage(cv, ox, oy, dw, dh);
    const px = (ll) => { const p = m.project(ll); return [ox + p.x * pr * sc, oy + p.y * pr * sc]; };
    const line = (o, upTo, wid) => {
      const segs = []; let cur = [];
      for (const q of o.Q) { if (q.d > upTo) break; if (q.br && cur.length) { segs.push(cur); cur = []; } cur.push(px(q.ll)); }
      if (upTo < o.total) { const h = this.at(o, upTo); cur.push(px([h[1], h[0]])); }
      segs.push(cur);
      g.lineCap = 'round'; g.lineJoin = 'round';
      [['#fff', wid + 5], [o.color, wid]].forEach(([c, w]) => { g.strokeStyle = c; g.lineWidth = w; segs.forEach((sg) => { if (sg.length < 2) return; g.beginPath(); g.moveTo(sg[0][0], sg[0][1]); for (let k = 1; k < sg.length; k++) g.lineTo(sg[k][0], sg[k][1]); g.stroke(); }); });
    };
    // linhas: destaques já voados ficam cheios; no fim, todos os treinos do mês acendem
    if (s.scene === 'outro') this.items.forEach((o) => line(o, o.total, 6));
    else this.hi.forEach((o, n) => { if (n < s.k) line(o, o.total, 6); else if (n === s.k && s.scene === 'fly') line(o, s.t * o.total, 8); });
    if (s.scene === 'fly') { const o = this.hi[s.k], h = this.at(o, s.t * o.total), [x, y] = px([h[1], h[0]]); g.beginPath(); g.arc(x, y, 28, 0, 7); g.fillStyle = o.color + '44'; g.fill(); g.beginPath(); g.arc(x, y, 15, 0, 7); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(x, y, 10, 0, 7); g.fillStyle = o.color; g.fill(); }

    let gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, 'rgba(8,12,24,.7)'); gr.addColorStop(1, 'rgba(8,12,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 320);
    gr = g.createLinearGradient(0, H - 420, 0, H); gr.addColorStop(0, 'rgba(8,12,24,0)'); gr.addColorStop(1, 'rgba(8,12,24,.82)'); g.fillStyle = gr; g.fillRect(0, H - 420, W, 420);
    const P = Store.data.profile, mon = this.monthName(this.month), S = this.S;
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = '#fff';
    g.font = 'italic 800 56px "Barlow Condensed", Inter, sans-serif'; g.fillText('JustGo', 48, 96);
    const jw = g.measureText('JustGo').width; g.fillStyle = '#1F6BFF'; g.beginPath(); g.arc(48 + jw + 12, 85, 8, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '800 40px Inter, sans-serif'; g.fillText(`Retrospectiva de ${mon}`, 48, 158);
    g.font = '500 24px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(`${P.name || 'Atleta'} · ${this.month.getFullYear()}`, 48, 196);

    // km acumulados até o destaque atual (outros treinos do mês entram proporcionalmente)
    const hiKm = this.hi.reduce((x, o) => x + o.a.distance, 0) / 1000, rest = Math.max(0, S.km - hiKm);
    let doneKm = 0; this.hi.forEach((o, n) => { if (n < s.k) doneKm += o.a.distance / 1000; else if (n === s.k && s.scene === 'fly') doneKm += (o.a.distance / 1000) * s.t; });
    const prog = this.hi.length ? Math.min(1, (s.scene === 'outro' ? 1 : (s.k + (s.scene === 'fly' ? s.t : 0)) / this.hi.length)) : 1;
    const kmNow = s.scene === 'outro' ? S.km : s.scene === 'intro' ? 0 : doneKm + rest * prog;

    if (s.scene === 'fly') {
      const o = this.hi[s.k], sp = CONFIG.sports[o.a.sport] || {};
      const lab = `${new Date(o.a.start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${sp.name || ''} · ${Fmt.km(o.a.distance)} km`;
      g.font = '700 26px Inter, sans-serif'; const tw = g.measureText(lab).width;
      g.fillStyle = 'rgba(255,255,255,.95)'; this.rr(g, 48, H - 300, tw + 40, 54, 27); g.fill();
      g.fillStyle = o.color; g.beginPath(); g.arc(70, H - 273, 8, 0, 7); g.fill();
      g.fillStyle = '#111827'; g.fillText(lab, 86, H - 264);
    }
    if (s.scene !== 'outro') {
      g.fillStyle = 'rgba(255,255,255,.72)'; g.font = '600 20px Inter, sans-serif'; g.fillText('KM NO MÊS', 48, H - 170);
      g.fillStyle = '#fff'; g.font = '800 92px Inter, sans-serif'; g.fillText(Fmt.num(kmNow, 1), 48, H - 76);
      g.font = '600 22px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'right'; g.fillText(`${S.n} treinos · ${S.days} dias ativos`, W - 48, H - 84); g.textAlign = 'left';
    } else {
      const a = Math.min(1, s.u * 2.5); g.globalAlpha = a;
      if (this.avImg) g.drawImage(this.avImg, W - 48 - 190, H - 520 - 236, 190, 228);
      g.fillStyle = 'rgba(8,12,24,.62)'; this.rr(g, 36, H - 520, W - 72, 450, 32); g.fill();
      const cells = [['KM', Fmt.num(S.km, 1)], ['TREINOS', String(S.n)], ['TEMPO', Fmt.time(S.time)], ['SUBIDA', `${S.elev} m`], ['FAVORITO', (CONFIG.sports[S.fav] || {}).name || '—'], ['MAIOR', S.big ? `${Fmt.km(S.big.distance, 1)} km` : '—']];
      cells.forEach(([l, v], i) => {
        const x = 72 + (i % 2) * ((W - 144) / 2), y = H - 440 + Math.floor(i / 2) * 128;
        g.font = '600 20px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(l, x, y);
        g.font = '800 50px Inter, sans-serif'; g.fillStyle = '#fff'; let vv = v; while (g.measureText(vv).width > (W - 160) / 2 && vv.length > 3) vv = vv.slice(0, -2) + '…'; g.fillText(vv, x, y + 56);
      });
      g.globalAlpha = Math.min(1, Math.max(0, (s.u - 0.55) * 4)); g.font = '600 22px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.9)'; g.textAlign = 'center'; g.fillText('Grave os seus treinos no app JustGo', W / 2, H - 30); g.textAlign = 'left';
      g.globalAlpha = 1;
    }
  },
  rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
  ui(f, label) {
    const el = $('#rtRec'); if (!el) return;
    el.querySelector('i').style.width = `${Math.round(f * 100)}%`;
    el.querySelector('b').textContent = f >= 1 ? 'Retrospectiva pronta!' : `${label || 'Gerando sua retrospectiva…'} ${Math.round(f * 100)}%`;
  },

  // guarda o vídeo do mês no celular para compartilhar de novo
  db() { return new Promise((ok, no) => { const r = indexedDB.open('justgo-retro', 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); },
  async saveBlob(k, blob) { const d = await this.db(); await new Promise((ok, no) => { const tx = d.transaction('v', 'readwrite'); tx.objectStore('v').put(blob, k); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); },
  async getBlob(k) { const d = await this.db(); return new Promise((ok) => { const r = d.transaction('v').objectStore('v').get(k); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); },
  async reshare() { try { const b = await this.getBlob(this.key()); if (b) return FX.download(`justgo-retrospectiva-${this.key()}.mp4`, b, 'video/mp4'); } catch (e) {} FX.toast('O vídeo não está mais salvo neste celular.'); },
};
