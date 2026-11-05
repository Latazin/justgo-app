/* =========================================================
   JustGo — NÚCLEO
   Store (dados locais), Fmt (formatação), Geo (distâncias)
   e Tracker (GPS + cronômetro + modo teste)
   ========================================================= */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Armazenamento local ---------- */
const Store = {
  key: 'justgo_v1',
  liveKey: 'justgo_live',
  data: null,

  defaults() {
    return {
      profile: { name: 'Atleta', sports: ['run'], experience: 'iniciante', goalWeek: 10, goalMonth: 40, weight: 70, age: 30, theme: 'light', onboarded: false },
      xp: 0, coins: 0,
      activities: [],
      unlocked: {},       // id -> data do desbloqueio
      missionsDone: {},   // chave da missão -> data
      medals: {},         // id -> data
      records: {},        // chave -> { value, act, date, label, fmt }
      dailyDoneCount: 0, bestStreak: 0, bestWeekStreak: 0,
      xpLog: [],          // [data, xp] — usado nas temporadas
      seasons: {},        // mês -> { league, xp }
      gear: [],           // tênis e bikes
      routes: [],         // rotas salvas e segmentos
      plan: null,         // plano de treino ativo
      territory: {},      // (antigo, hexágonos)
      zones: [],          // áreas conquistadas fechando circuitos
      owned: {},          // itens comprados na loja
      equipped: { line: null, frame: null, avatar: null, theme: null, finish: null },
      privacy: { zone: false, lat: null, lng: null, radius: 250, trimEnds: true },
      trusted: { name: '', phone: '' },
    };
  },
  load() {
    try { this.data = JSON.parse(localStorage.getItem(this.key)); } catch (e) { this.data = null; }
    const d = this.defaults();
    this.data = this.data ? { ...d, ...this.data, profile: { ...d.profile, ...(this.data.profile || {}) }, equipped: { ...d.equipped, ...(this.data.equipped || {}) }, privacy: { ...d.privacy, ...(this.data.privacy || {}) } } : d;
    // 2.20: a voz passa a vir desligada; quem quiser liga em Configurações ou na tela de gravar
    try { if (!localStorage.getItem('jg_voice2')) { this.data.profile.voice = false; this.data.voice2 = 1; localStorage.setItem('jg_voice2', '1'); localStorage.setItem(this.key, JSON.stringify(this.data)); } } catch (e) {}
    return this.data;
  },
  save() {
    this.data.updatedAt = Date.now();
    if (window.Cloud) Cloud.queuePush();
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch (e) { if (/quota/i.test(e.name + e.message)) FX.toast('Armazenamento cheio: exporte um backup e apague treinos antigos.'); }
  },
  saveLive(snapshot) { try { localStorage.setItem(this.liveKey, JSON.stringify(snapshot)); } catch (e) {} },
  loadLive() { try { return JSON.parse(localStorage.getItem(this.liveKey)); } catch (e) { return null; } },
  clearLive() { try { localStorage.removeItem(this.liveKey); } catch (e) {} },
};

/* ---------- Preferências (tela Configurações) ---------- */
const PREF_DEFAULTS = { spotsOn: true, autoPause: true, voice: false, countdown: true, sounds: true, haptics: true, mapStyle: 'color', keepAwake: true, defaultSport: '', bio: '', city: '' };
const Pref = (k) => { const P = Store.data && Store.data.profile; return P && P[k] !== undefined ? P[k] : PREF_DEFAULTS[k]; };

/* ---------- Formatação pt-BR ---------- */
const Fmt = {
  time(s) {
    s = Math.max(0, Math.round(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  },
  km(m, dec = 2) { return ((m || 0) / 1000).toFixed(dec).replace('.', ','); },
  num(n, dec = 1) { return (n || 0).toFixed(dec).replace('.', ','); },
  // ritmo/velocidade conforme o esporte, a partir de m/s
  // esportes de rodas e barco mostram velocidade (km/h); natação, ritmo por 100 m; o resto, min/km
  isSpeed(sport) { return !!(CONFIG.sports[sport] && CONFIG.sports[sport].speed); },
  pace(sport, mps) {
    if (!mps || mps < 0.15 || !isFinite(mps)) return '--';
    if (this.isSpeed(sport)) return this.num(mps * 3.6);
    if (sport === 'swim') return this.time(100 / mps);
    return this.time(1000 / mps);
  },
  paceUnit(sport) { return this.isSpeed(sport) ? 'km/h' : sport === 'swim' ? 'min/100 m' : 'min/km'; },
  paceLabel(sport, avg) { return this.isSpeed(sport) ? (avg ? 'Vel. média' : 'Velocidade') : (avg ? 'Ritmo médio' : 'Ritmo'); },
  date(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },
};

/* ---------- Geografia ---------- */
const Geo = {
  // última posição conhecida do usuário (abre os mapas na cidade dele)
  home() { const p = Store.data && Store.data.lastPos; return p ? [p[0], p[1]] : CONFIG.gps.simStart; },
  hasHome() { return !!(Store.data && Store.data.lastPos); },
  remember(lat, lng) {
    if (typeof Spots !== 'undefined') Spots.onPos(lat, lng); // presença automática nos pontos
    const old = Store.data.lastPos;
    if (old && Geo.dist(old, [lat, lng]) < 200) return;
    Store.data.lastPos = [+lat.toFixed(5), +lng.toFixed(5)];
    try { localStorage.setItem(Store.key, JSON.stringify(Store.data)); } catch (e) {}
  },
  // pede a posição atual (só pergunta permissão quando ask = true)
  async locate(ask = false) {
    if (Native.on) { const r = await Native.call('geoGet', { ask }); if (r && r.lat != null) { Geo.remember(r.lat, r.lng); return [r.lat, r.lng, r.acc]; } return null; }
    if (!('geolocation' in navigator)) return null;
    if (!ask) {
      try { const st = await navigator.permissions.query({ name: 'geolocation' }); if (st.state !== 'granted') return null; } catch (e) { return null; }
    }
    return new Promise((res) => navigator.geolocation.getCurrentPosition(
      (p) => { Geo.remember(p.coords.latitude, p.coords.longitude); res([p.coords.latitude, p.coords.longitude, p.coords.accuracy]); },
      () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }));
  },
  // distância em metros entre [lat,lng] (fórmula de Haversine)
  dist(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  },
  // divide pontos em segmentos (pausas criam trechos separados no mapa)
  segments(points) {
    const segs = []; let cur = [];
    (points || []).forEach((p) => {
      if (p[4] && cur.length) { segs.push(cur); cur = []; }
      cur.push([p[0], p[1]]);
    });
    if (cur.length) segs.push(cur);
    return segs;
  },
  elevationGain(points) { return this.elevation(points).gain; },
  // subida/descida: média móvel por distância (±40 m) e só conta variação a partir de 3 m
  elevation(points) {
    const P = (points || []).filter((p) => p && p[3] != null);
    if (P.length < 2) return { gain: 0, loss: 0, min: null, max: null };
    const D = [0]; for (let i = 1; i < P.length; i++) D.push(D[i - 1] + (P[i][4] ? 0 : this.dist(P[i - 1], P[i])));
    const S = []; let a = 0, b = 0, sum = 0;
    for (let i = 0; i < P.length; i++) {
      while (D[b] !== undefined && D[b] <= D[i] + 40) { sum += P[b][3]; b++; }
      while (D[a] < D[i] - 40) { sum -= P[a][3]; a++; }
      S.push(sum / (b - a));
    }
    let gain = 0, loss = 0, ref = S[0];
    S.forEach((v) => { const d = v - ref; if (d >= 3) { gain += d; ref = v; } else if (d <= -3) { loss -= d; ref = v; } });
    return { gain: Math.round(gain), loss: Math.round(loss), min: Math.round(Math.min(...S)), max: Math.round(Math.max(...S)) };
  },
};

/* =========================================================
   Tracker — cronômetro + GPS (ou simulação)
   Ponto salvo: [lat, lng, timestamp, altitude, novoTrecho]
   ========================================================= */
class Tracker {
  constructor(sport, opts = {}) {
    this.sport = sport;
    this.sim = !!opts.sim;
    this.mult = opts.mult || 5;
    this.autoPause = !!opts.autoPause;
    this.onUpdate = opts.onUpdate || (() => {});
    this.onSplit = opts.onSplit || (() => {});
    this.onAwayBack = opts.onAwayBack || null;
    this.simPath = opts.simPath || null;
    this.points = []; this.splits = [];
    this.distance = 0; this.moving = 0; this.speed = 0;
    this.state = 'idle'; this.autoPaused = false; this.resumeGap = false;
    this.gpsStatus = this.sim ? 'simulado' : 'procurando GPS…';
    this.lastSplitMoving = 0; this.rejects = 0;
    this.maxMps = CONFIG.sports[sport].maxKmh / 3.6;
  }
  now() { return this.sim ? this.simNow : Date.now(); }

  start() {
    this.simNow = Date.now();
    this.state = 'running';
    this.startTs = this.now(); this.last = this.now(); this.lastMove = this.now();
    if (this.sim) this.initSim(); else this.watch();
    this.timer = setInterval(() => this.tick(), 1000);
    this.emit();
  }
  // chamado quando o usuário volta para o app
  wakeUp() {
    if (this.sim || this.state !== 'running' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((p) => { const now = Date.now(), ts = p.timestamp && Math.abs(now - p.timestamp) < 10000 ? p.timestamp : now; this.onPos({ lat: p.coords.latitude, lng: p.coords.longitude, alt: p.coords.altitude, acc: p.coords.accuracy, t: ts }); }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    this.tick();
  }
  pause() { this.state = 'paused'; this.speed = 0; this.emit(); }
  resume() { this.state = 'running'; this.resumeGap = true; this.autoPaused = false; this.last = this.now(); this.lastMove = this.now(); this.emit(); }
  stop() {
    clearInterval(this.timer);
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.endTs = this.now();
    this.state = 'done';
  }

  watch() {
    if (!('geolocation' in navigator)) { this.gpsStatus = 'sem GPS neste aparelho'; return; }
    this.watchId = navigator.geolocation.watchPosition(
      (p) => { const now = Date.now(), ts = p.timestamp && Math.abs(now - p.timestamp) < 10000 ? p.timestamp : now; this.onPos({ lat: p.coords.latitude, lng: p.coords.longitude, alt: p.coords.altitude, acc: p.coords.accuracy, t: ts }); }, // hora da leitura do GPS

      (e) => { this.gpsStatus = e.code === 1 ? 'permissão de GPS negada' : 'sinal de GPS fraco'; this.emit(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }

  tick() {
    if (this.sim) { this.simNow += 1000 * this.mult; if (this.state === 'running') this.simStep(); }
    const n = this.now(), dt = Math.max(0, n - this.last); this.last = Math.max(this.last, n);
    // site ficou minimizado (o navegador congelou o app): o tempo do intervalo conta como treino
    if (!this.sim && this.state === 'running' && dt > 15000) {
      if (!this.autoPaused) this.moving += dt;
      this.lastMove = n; this.awayMs = (this.awayMs || 0) + dt; this.away = true;
      return this.emit();
    }
    if (this.state === 'running') {
      if (this.autoPause && n - this.lastMove > CONFIG.gps.autoPauseSecs * 1000) { this.autoPaused = true; this.speed = 0; }
      if (!this.autoPaused) this.moving += dt;
      if (n - this.lastMove > 8000) this.speed *= 0.5; // sem movimento: velocidade cai
    }
    this.emit();
  }

  onPos(p) {
    if (p.acc == null || p.acc < 100) { this.fix = [p.lat, p.lng]; if (!this.sim) Geo.remember(p.lat, p.lng); }
    if (p.acc != null && p.acc > CONFIG.gps.maxAccuracy) { this.gpsStatus = 'precisão ruim (' + Math.round(p.acc) + ' m)'; return this.emit(); }
    this.gpsStatus = this.sim ? 'simulado' : 'GPS ok · ±' + Math.round(p.acc || 0) + ' m';
    if (this.state !== 'running') return this.emit();
    // pontos que chegam em lote (app voltando do segundo plano): o relógio do treino anda junto com o
    // horário de cada ponto. Sem isso a distância subia e o tempo não, e a voz falava 120 km/h de bike.
    if (!this.sim && p.t > this.last && p.t <= Date.now() + 1000) { if (!this.autoPaused) this.moving += p.t - this.last; this.last = p.t; }
    this.stale = !this.sim && Date.now() - p.t > 30000;

    const pt = [+p.lat.toFixed(6), +p.lng.toFixed(6), p.t, p.alt != null ? +p.alt.toFixed(1) : null];
    const last = this.points[this.points.length - 1];

    // primeiro ponto, ou retomada após pausa: começa trecho novo sem somar distância
    if (!last || this.resumeGap) {
      if (last) pt[4] = 1;
      this.points.push(pt); this.resumeGap = false; this.lastMove = p.t;
      return this.emit();
    }
    const d = Geo.dist(last, pt), dt = (p.t - last[2]) / 1000;
    if (dt <= 0) return;
    // leitura repetida/colada (menos de 0,8 s): espera a próxima. Era isso que gerava 11.000 km/h
    if (dt < 0.8 && d < 25) return this.emit();
    const v = d / dt;
    // primeiro ponto depois de ficar em segundo plano: soma o trecho que faltou
    if (dt > 20 && v <= this.maxMps * 1.1) {
      this.distance += d; this.gapDist = (this.gapDist || 0) + d; pt[5] = 1; // ponto estimado
      this.points.push(pt); this.lastMove = p.t; this.away = false;
      this.checkSplits(); this.onAwayBack && this.onAwayBack(d, dt);
      return this.emit();
    }

    // salto impossível: descarta; se insistir 3x, recomeça trecho dali
    if (v > this.maxMps * CONFIG.gps.jumpFactor && d > 20) {
      if (++this.rejects >= 3) { pt[4] = 1; this.points.push(pt); this.rejects = 0; }
      return this.emit();
    }
    this.rejects = 0;
    // parado (sinal, semáforo): o GPS "passeia" dentro da margem de precisão. Só conta deslocamento maior
    // que essa margem (mín. 3 m, máx. 15 m). O último ponto fica onde está: andando de verdade nada se perde.
    const minMove = Math.max(CONFIG.gps.minMoveM, Math.min(15, (p.acc || 6) * 1.1));
    if (d < minMove) return this.emit();
    // deslocamento lento demais para ser gente se movendo (< 0,5 m/s) e dentro de ~2,5× a precisão: é o GPS oscilando
    if (v < 0.5 && d < Math.min(30, (p.acc || 6) * 2.5)) return this.emit();

    if (v >= CONFIG.gps.autoPauseSpeed) { this.lastMove = p.t; this.autoPaused = false; }
    this.distance += d;
    this.points.push(pt);
    // velocidade atual = distância percorrida nos últimos ~5 s (nunca entre dois pontos colados)
    { const P = this.points; let k = P.length - 1, dd = 0;
      while (k > 0 && !P[k][4] && pt[2] - P[k - 1][2] <= 6000) { dd += Geo.dist(P[k - 1], P[k]); k--; }
      const span = (pt[2] - P[k][2]) / 1000, vw = span >= 2 ? dd / span : v;
      const vc = Math.min(vw, this.maxMps * 1.15);
      this.speed = this.speed ? this.speed * 0.5 + vc * 0.5 : vc; }

    this.checkSplits();
    this.emit();
  }
  // parciais por km
  checkSplits() {
    while (this.distance >= (this.splits.length + 1) * 1000) {
      const t = this.moving / 1000 - this.lastSplitMoving;
      this.lastSplitMoving = this.moving / 1000;
      this.splits.push(Math.round(t));
      this.onSplit(this.splits.length, t);
    }
  }

  /* ----- Modo teste: anda por conta própria ----- */
  initSim() {
    this.simPos = this.simPath ? [this.simPath[0][0], this.simPath[0][1]] : [...Geo.home()];
    this.simAlong = 0;
    this.heading = Math.random() * 360; this.simAlt = 760; this.simI = 0;
    this.simV = CONFIG.sports[this.sport].simSpeed;
  }
  simStep() {
    this.simI++;
    // modo teste numa rota salva: percorre o próprio trajeto da rota
    if (this.simPath) {
      const P = this.simPath, v = this.simV * (0.9 + Math.random() * 0.2);
      this.simAlong = Math.min(this.simAlong + v * this.mult, P[P.length - 1][2]);
      let k = 1; while (k < P.length - 1 && P[k][2] < this.simAlong) k++;
      const a = P[k - 1], b = P[k], f = (this.simAlong - a[2]) / (b[2] - a[2] || 1);
      const j = () => (Math.random() - 0.5) * 0.00004;
      this.simAlt += Math.sin(this.simI / 12) * 1.2;
      return this.onPos({ lat: a[0] + (b[0] - a[0]) * f + j(), lng: a[1] + (b[1] - a[1]) * f + j(), alt: this.simAlt, acc: 5, t: this.simNow });
    }
    this.heading += (Math.random() - 0.5) * 30;
    const v = this.simV * (0.85 + Math.random() * 0.3), d = v * this.mult, h = this.heading * Math.PI / 180;
    this.simPos[0] += (d * Math.cos(h)) / 111320;
    this.simPos[1] += (d * Math.sin(h)) / (111320 * Math.cos(this.simPos[0] * Math.PI / 180));
    this.simAlt += Math.sin(this.simI / 12) * 1.8 * this.mult / 5;
    this.onPos({ lat: this.simPos[0], lng: this.simPos[1], alt: this.simAlt, acc: 5, t: this.simNow });
  }

  emit() { this.onUpdate(this); }

  snapshot() {
    return { sport: this.sport, sim: this.sim, points: this.points, splits: this.splits, distance: this.distance, moving: this.moving, startTs: this.startTs, savedAt: this.now() };
  }
  toActivity() {
    const end = this.endTs || this.now();
    return {
      id: uid(), sport: this.sport, start: this.startTs,
      duration: Math.round(this.moving / 1000), elapsed: Math.round((end - this.startTs) / 1000),
      distance: Math.round(this.distance), points: this.points, splits: this.splits.map(Math.round), estimated: this.gapDist ? Math.round(this.gapDist) : undefined,
      mode: this.sim ? 'sim' : 'gps',
    };
  }
}
