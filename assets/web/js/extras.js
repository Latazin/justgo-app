/* =========================================================
   JustGo — EXTRAS
   Equipamentos, privacidade, território (hexágonos) e loja
   ========================================================= */

/* ---------- Equipamentos: tênis e bikes ---------- */
const Gear = {
  list(type) { return Store.data.gear.filter((g) => !type || g.type === type); },
  get(id) { return Store.data.gear.find((g) => g.id === id); },
  km(g) { return (g.km0 || 0) + Store.data.activities.filter((a) => a.gear === g.id && !a.flagged).reduce((s, a) => s + a.distance, 0) / 1000; },
  typeFor(sport) { return sport === 'run' ? 'shoe' : sport === 'ride' ? 'bike' : null; },
  add(type, name, km0) { const g = { id: uid(), type, name, km0: +km0 || 0, retired: false, isDefault: !this.list(type).some((x) => x.isDefault && !x.retired) }; Store.data.gear.push(g); Store.save(); return g; },
  setDefault(id) { const g = this.get(id); this.list(g.type).forEach((x) => (x.isDefault = x.id === id)); Store.save(); },
  status(g) {
    const lim = CONFIG.gear[g.type], km = this.km(g);
    return { km, lim, pct: Math.min(100, (km / lim.max) * 100), level: km >= lim.max ? 'bad' : km >= lim.warn ? 'warn' : 'ok' };
  },
  // gancho: aplica o equipamento padrão e avisa quando está gasto
  hook(act, r) {
    const type = Gear.typeFor(act.sport); if (!type) return;
    if (!act.gear) { const d = Gear.list(type).find((g) => g.isDefault && !g.retired); if (d) act.gear = d.id; }
    const g = act.gear && Gear.get(act.gear); if (!g) return;
    const st = Gear.status(g);
    if (type === 'shoe' && st.level !== 'ok') r.gearWarn = `${g.name} já tem ${Math.round(st.km)} km. ${st.level === 'bad' ? 'Hora de trocar o tênis!' : 'Comece a pensar em trocar.'}`;
  },
};
Game.hooks.unshift(Gear.hook);

/* ---------- Privacidade: esconde a área de casa e as pontas do trajeto ---------- */
const Privacy = {
  trim(points) {
    if (!points || points.length < 2) return points || [];
    const P = Store.data.privacy; let out = points;
    if (P.zone && P.lat != null) out = out.filter((p) => Geo.dist(p, [P.lat, P.lng]) > P.radius);
    if (P.trimEnds && out.length > 4) {
      const cut = (arr) => { let d = 0, i = 1; for (; i < arr.length; i++) { d += Geo.dist(arr[i - 1], arr[i]); if (d > 200) break; } return i; };
      const a = cut(out), b = out.length - cut([...out].reverse());
      out = a < b ? out.slice(a, b) : [];
    }
    return out;
  },
};

/* ---------- Território: grade de hexágonos sobre o mapa ---------- */
const Hex = {
  R: 6378137,
  size() { return CONFIG.territory.hexSize; },
  merc(lat, lng) { return [this.R * lng * Math.PI / 180, this.R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))]; },
  unmerc(x, y) { return [((2 * Math.atan(Math.exp(y / this.R)) - Math.PI / 2) * 180) / Math.PI, (x / this.R) * 180 / Math.PI]; },
  // escala local de Mercator para manter o hexágono com ~120 m reais
  scale(lat) { return 1 / Math.cos((lat * Math.PI) / 180); },
  id(lat, lng) {
    const [x, y] = this.merc(lat, lng), s = this.size() * this.scale(-20); // escala fixa (Brasil) para a grade ser estável
    const q = ((Math.sqrt(3) / 3) * x - y / 3) / s, r = ((2 / 3) * y) / s;
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dz > dy) rz = -rx - ry;
    return rx + ',' + rz;
  },
  polygon(id) {
    const [q, r] = id.split(',').map(Number), s = this.size() * this.scale(-20);
    const cx = s * Math.sqrt(3) * (q + r / 2), cy = s * 1.5 * r;
    return Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return this.unmerc(cx + s * Math.cos(a), cy + s * Math.sin(a)); });
  },
  // hexágonos por onde o trajeto passou (amostra a cada 40 m)
  fromPoints(points) {
    const set = new Set();
    for (let i = 0; i < points.length; i++) {
      const p = points[i]; set.add(this.id(p[0], p[1]));
      const q = points[i + 1]; if (!q || q[4]) continue;
      const d = Geo.dist(p, q), n = Math.floor(d / 40);
      for (let k = 1; k < n; k++) set.add(this.id(p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n));
    }
    return [...set];
  },
  areaKm2(n) { const s = this.size(); return (n * (3 * Math.sqrt(3) / 2) * s * s) / 1e6; },
  // gancho: soma passagens; o território acumula desde o 1º treino e aparece quando desbloquear
  hook(act, r) {
    if (!act.points || act.points.length < 2) return;
    const T = Store.data.territory, before = Object.keys(T).length;
    const hexes = Hex.fromPoints(act.points);
    hexes.forEach((h) => { const t = T[h] || (T[h] = { n: 0, first: act.start }); t.n++; t.last = act.start; });
    act.hexes = hexes.length;
    r.newHexes = Object.keys(T).length - before;
    r._hexes = hexes;
  },
};
Game.hooks.push(Hex.hook);

/* ---------- Loja e cosméticos ---------- */
const Shop = {
  item(id) { return CONFIG.shop.find((x) => x.id === id); },
  owned(id) { return !!Store.data.owned[id]; },
  buy(id) {
    const it = this.item(id), D = Store.data;
    if (!it || this.owned(id)) return false;
    if (D.coins < it.price) return false;
    D.coins -= it.price; D.owned[id] = Date.now(); D.equipped[it.cat] = id; Store.save(); this.apply();
    return true;
  },
  equip(cat, id) { Store.data.equipped[cat] = id; Store.save(); this.apply(); },
  val(cat) { const id = Store.data.equipped[cat]; const it = id && this.item(id); return it ? it.value : null; },
  lineColor(sport) { return this.val('line') || CONFIG.sports[sport].color; },
  // tema, moldura e avatar viram variáveis CSS
  apply() {
    const root = document.documentElement, P = Store.data.profile;
    const t = P.theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : P.theme;
    root.dataset.theme = this.val('theme') || t;
    root.style.setProperty('--frame', this.val('frame') || 'var(--brand)');
    root.style.setProperty('--avatar-bg', this.val('avatar') || 'linear-gradient(145deg,#3A3A3C,#1C1C1E)');
  },
};

/* =========================================================
   Treino em segundo plano
   - áudio silencioso: o navegador não congela o app tão rápido
   - Media Session: tempo e distância na tela de bloqueio,
     com botões de pausar/retomar
   ========================================================= */
const Background = {
  // gera 1 s de silêncio em WAV (sem arquivo externo)
  silentSrc() {
    if (this._src) return this._src;
    const rate = 8000, n = rate, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return (this._src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  },
  start(tr) {
    if (Native.on) return; // no app, o GPS nativo cuida do segundo plano
    this.tr = tr;
    try {
      const a = this.audio || (this.audio = new Audio());
      a.src = this.silentSrc(); a.loop = true; a.volume = 1; a.setAttribute('playsinline', '');
      a.play().catch(() => {});
    } catch (e) {}
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      try {
        ms.setActionHandler('pause', () => { if (App.tracker && App.tracker.state === 'running') App.actions.pause(); });
        ms.setActionHandler('play', () => { if (App.tracker && App.tracker.state === 'paused') App.actions.resume(); });
        ms.setActionHandler('stop', null);
      } catch (e) {}
    }
    this.update(); clearInterval(this.timer); this.timer = setInterval(() => this.update(), 5000);
  },
  update() {
    const tr = this.tr; if (!tr || !('mediaSession' in navigator)) return;
    const sp = CONFIG.sports[tr.sport], secs = tr.moving / 1000;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${Fmt.km(tr.distance)} km · ${Fmt.time(secs)}`,
        artist: `${sp.name}${tr.state === 'paused' ? ' · pausado' : ' · ritmo ' + Fmt.pace(tr.sport, secs > 0 ? tr.distance / secs : 0) + ' ' + Fmt.paceUnit(tr.sport)}`,
        album: 'JustGo · treino em andamento',
        artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.playbackState = tr.state === 'paused' ? 'paused' : 'playing';
    } catch (e) {}
  },
  pause() { try { this.audio && this.audio.pause(); } catch (e) {} this.update(); },
  resume() { try { this.audio && this.audio.play().catch(() => {}); } catch (e) {} this.update(); },
  stop() {
    clearInterval(this.timer); this.tr = null;
    try { if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } } catch (e) {}
    try { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch (e) {}
  },
};
