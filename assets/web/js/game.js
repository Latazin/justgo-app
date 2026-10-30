/* =========================================================
   JustGo — CAMADA DE JOGO
   XP, níveis, missões, desbloqueios, medalhas, recordes,
   ofensiva (streak) e antitrapaça
   ========================================================= */
const Game = {
  hooks: [], // funções (act, resultado) registradas pelos módulos

  /* ---------- consultas básicas ---------- */
  acts() { return Store.data.activities.filter((a) => !a.flagged); },
  km(list, sport = 'all') { return list.filter((a) => sport === 'all' || a.sport === sport).reduce((s, a) => s + a.distance, 0) / 1000; },
  has(id) { return !!Store.data.unlocked[id]; },
  unlock(id) { return CONFIG.unlocks.find((u) => u.id === id); },

  /* ---------- datas ---------- */
  dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  weekStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); },
  weekKey(ts) { return 'w' + this.dayKey(this.weekStart(ts)); },
  monthKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1); },
  scope(kind, ts) {
    const f = kind === 'day' ? 'dayKey' : kind === 'week' ? 'weekKey' : 'monthKey';
    const k = this[f](ts);
    return this.acts().filter((a) => this[f](a.start) === k);
  },

  /* ---------- ofensiva ---------- */
  // ofensiva com escudo: 1 dia sem treino por semana não quebra a sequência
  streakDays(useShield = true) {
    const days = new Set(this.acts().map((a) => this.dayKey(a.start)));
    const d = new Date(); d.setHours(12, 0, 0, 0);
    if (!days.has(this.dayKey(d))) d.setDate(d.getDate() - 1); // hoje ainda não treinou: conta até ontem
    let n = 0; const used = new Set();
    for (let g = 0; g < 5000; g++) {
      if (days.has(this.dayKey(d))) { n++; d.setDate(d.getDate() - 1); continue; }
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      const wk = this.weekKey(d.getTime());
      if (useShield && n > 0 && !used.has(wk) && days.has(this.dayKey(prev))) { used.add(wk); d.setDate(d.getDate() - 1); continue; }
      break;
    }
    this.shieldUsedThisWeek = used.has(this.weekKey(Date.now()));
    return n;
  },
  weekStreak() {
    const weeks = new Set(this.acts().map((a) => this.weekKey(a.start)));
    const d = new Date(this.weekStart(Date.now())); d.setHours(12);
    if (!weeks.has(this.weekKey(d))) d.setDate(d.getDate() - 7);
    let n = 0;
    while (weeks.has(this.weekKey(d))) { n++; d.setDate(d.getDate() - 7); }
    return n;
  },

  /* ---------- níveis ---------- */
  xpFor(l) { return Math.round((CONFIG.xp.levelBase * (l - 1) * l) / 2); },
  level(xp) { let l = 1; while (xp >= this.xpFor(l + 1)) l++; return l; },
  title(l) { let t = CONFIG.levelTitles[0][1]; CONFIG.levelTitles.forEach(([min, name]) => { if (l >= min) t = name; }); return t; },

  /* ---------- requisitos de desbloqueio ---------- */
  reqProgress(req) {
    const D = Store.data; let cur = 0;
    switch (req.type) {
      case 'km': cur = this.km(this.acts(), req.sport || 'all'); break;
      case 'workouts': cur = this.acts().length; break;
      case 'dayStreak': cur = Math.max(D.bestStreak || 0, this.streakDays()); break;
      case 'weekStreak': cur = Math.max(D.bestWeekStreak || 0, this.weekStreak()); break;
      case 'dailyDone': cur = D.dailyDoneCount || 0; break;
    }
    const pct = Math.min(100, (cur / req.value) * 100);
    const curTxt = req.type === 'km' ? `${Fmt.num(Math.min(cur, req.value))} / ${Fmt.num(req.value, req.value % 1 ? 1 : 0)} km` : `${Math.min(cur, req.value)} / ${req.value}`;
    return { cur, target: req.value, pct, curTxt };
  },
  reqText(req) {
    const v = String(req.value).replace('.', ',');
    switch (req.type) {
      case 'km': return req.sport === 'all' || !req.sport ? `Some ${v} km (qualquer esporte)` : `${CONFIG.sports[req.sport].verb} ${v} km no total`;
      case 'workouts': return `Conclua ${v} treinos`;
      case 'dayStreak': return `Ofensiva de ${v} dias seguidos`;
      case 'weekStreak': return `Treine em ${v} semanas seguidas`;
      case 'dailyDone': return `Complete ${v} missões diárias`;
    }
    return '';
  },
  nextUnlocks(n = 3) {
    return CONFIG.unlocks.filter((u) => !this.has(u.id))
      .map((u) => ({ u, p: this.reqProgress(u.req).pct }))
      .sort((a, b) => b.p - a.p).slice(0, n).map((x) => x.u);
  },

  /* ---------- missões ---------- */
  hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; },
  // 3 missões por dia, sorteio fixo pela data (todos os aparelhos veem as mesmas)
  dailyMissions(ts) {
    const fav = Store.data.profile.sports || [];
    const avail = CONFIG.daily.filter((m) => !m.sport || m.sport === 'all' || !fav.length || fav.includes(m.sport));
    let seed = this.hash(this.dayKey(ts)); const out = [];
    while (out.length < 3 && avail.length) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; out.push(avail.splice(seed % avail.length, 1)[0]); }
    return out;
  },
  seasonal(ts) { const mo = new Date(ts).getMonth() + 1; return CONFIG.seasonal[mo] || { ...CONFIG.seasonalDefault, id: 'mes' + mo }; },
  mKey(pre, m, ts) { const k = pre === 'd' ? this.dayKey(ts) : pre === 'w' ? this.weekKey(ts) : this.monthKey(ts); return `${pre}:${k}:${m.id}`; },
  mProgress(m, list) {
    const bySport = (a) => !m.sport || m.sport === 'all' || a.sport === m.sport;
    let cur = 0;
    switch (m.type) {
      case 'km': cur = this.km(list, m.sport || 'all'); break;
      case 'minutes': cur = list.filter(bySport).reduce((s, a) => s + a.duration / 60, 0); break;
      case 'workouts': cur = list.length; break;
      case 'before': cur = list.filter((a) => new Date(a.start).getHours() < m.hour).length; break;
      case 'sports': cur = new Set(list.map((a) => a.sport)).size; break;
    }
    const txt = m.type === 'km' ? `${Fmt.num(Math.min(cur, m.value))} / ${String(m.value).replace('.', ',')} km`
      : m.type === 'minutes' ? `${Math.floor(Math.min(cur, m.value))} / ${m.value} min` : `${Math.min(cur, m.value)} / ${m.value}`;
    return { cur, target: m.value, pct: Math.min(100, (cur / m.value) * 100), txt };
  },

  /* ---------- antitrapaça ---------- */
  validate(act) {
    const sp = CONFIG.sports[act.sport];
    act.flagged = false; delete act.flagReason;
    if (act.duration > 0) {
      const kmh = (act.distance / act.duration) * 3.6;
      if (kmh > sp.maxKmh) { act.flagged = true; act.flagReason = `Velocidade média de ${Fmt.num(kmh)} km/h, acima do limite de ${sp.maxKmh} km/h para ${sp.name.toLowerCase()}.`; }
    }
    if (!act.flagged && act.points && act.points.length > 10) {
      let fast = 0;
      for (let i = 1; i < act.points.length; i++) {
        const a = act.points[i - 1], b = act.points[i];
        if (b[4]) continue;
        const d = Geo.dist(a, b), dt = (b[2] - a[2]) / 1000;
        if (dt > 0 && (d / dt) * 3.6 > sp.maxKmh) fast += d;
      }
      if (fast > act.distance * 0.25) { act.flagged = true; act.flagReason = 'Trechos em velocidade de veículo detectados (possível carro ou moto).'; }
    }
    return act;
  },

  calories(act) {
    const P = Store.data.profile, w = P.weight || 70, age = P.age || 30;
    const ageF = age > 40 ? 1 - Math.min(0.1, (age - 40) * 0.004) : 1; // gasto cai levemente com a idade
    return Math.round(CONFIG.sports[act.sport].met * w * (act.duration / 3600) * ageF);
  },

  /* ---------- temporadas (XP do mês) ---------- */
  monthXp(ts = Date.now()) { const k = this.monthKey(ts); return (Store.data.xpLog || []).filter(([t]) => this.monthKey(t) === k).reduce((s, [, x]) => s + x, 0); },
  league(xp) { let l = CONFIG.leagues[0]; CONFIG.leagues.forEach((x) => { if (xp >= x.min) l = x; }); return l; },
  nextLeague(xp) { return CONFIG.leagues.find((x) => x.min > xp) || null; },
  // ao virar o mês, entrega a recompensa da liga do mês anterior
  checkSeason() {
    const D = Store.data, now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();
    const k = this.monthKey(prev);
    if (D.seasons[k]) return null;
    const xp = this.monthXp(prev);
    D.seasons[k] = { xp, league: this.league(xp).id, claimed: Date.now() };
    if (!xp) { Store.save(); return null; }
    const l = this.league(xp); D.coins += l.reward; Store.save();
    return { league: l, xp };
  },
  /* ---------- clima (Open-Meteo, grátis e sem chave) ---------- */
  async fetchWeather(act) {
    const p = act.points && act.points[0]; if (!p || act.weather) return null;
    const d = new Date(act.start), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p[0].toFixed(3)}&longitude=${p[1].toFixed(3)}&hourly=temperature_2m,precipitation&timezone=auto&start_date=${day}&end_date=${day}`);
      if (!r.ok) return null;
      const j = await r.json(), h = d.getHours();
      act.weather = { temp: Math.round(j.hourly.temperature_2m[h]), rain: j.hourly.precipitation[h] || 0 };
      const out = { weather: act.weather, medal: null };
      if (act.weather.rain >= 0.2 && !act.flagged && !Store.data.medals.rain) {
        Store.data.medals.rain = act.start; Store.data.xp += CONFIG.medalReward.xp; Store.data.coins += CONFIG.medalReward.coins;
        out.medal = CONFIG.medals.find((m) => m.id === 'rain');
      }
      Store.save(); return out;
    } catch (e) { return null; }
  },

  /* ---------- recordes pessoais ---------- */
  updateRecords(act) {
    const R = Store.data.records, out = [], sp = CONFIG.sports[act.sport];
    const set = (key, label, value, better, fmt) => {
      if (value == null || !isFinite(value)) return;
      const old = R[key];
      if (!old || better(value, old.value)) {
        R[key] = { value, act: act.id, date: act.start, label, fmt };
        out.push({ key, label, value, fmt, broken: !!old });
      }
    };
    const lt = (a, b) => a < b, gt = (a, b) => a > b;
    if (act.distance > 0) set('long_' + act.sport, `Maior distância — ${sp.name}`, act.distance, gt, 'dist');
    const s = act.splits || [];
    if (s.length && act.sport !== 'swim') {
      const roll = (n) => { if (s.length < n) return null; let best = Infinity; for (let i = 0; i + n <= s.length; i++) best = Math.min(best, s.slice(i, i + n).reduce((x, y) => x + y, 0)); return best; };
      set('b1k_' + act.sport, `Melhor 1 km — ${sp.name}`, roll(1), lt, 'time');
      set('b5k_' + act.sport, `Melhor 5 km — ${sp.name}`, roll(5), lt, 'time');
      set('b10k_' + act.sport, `Melhor 10 km — ${sp.name}`, roll(10), lt, 'time');
    }
    if (act.sport === 'swim' && act.distance >= 100) set('b100_swim', 'Melhor ritmo /100 m — Natação', act.duration / (act.distance / 100), lt, 'time');
    return out;
  },

  /* ---------- previsão de prova (fórmula de Riegel) ---------- */
  predictions() {
    const R = Store.data.records;
    let base = null;
    if (R.b10k_run) base = { d: 10000, t: R.b10k_run.value };
    else if (R.b5k_run) base = { d: 5000, t: R.b5k_run.value };
    else if (R.b1k_run) base = { d: 1000, t: R.b1k_run.value };
    if (!base) return null;
    return [['5K', 5000], ['10K', 10000], ['21K', 21097], ['42K', 42195]].map(([n, d]) => ({ n, t: base.t * Math.pow(d / base.d, 1.06) }));
  },

  /* =========================================================
     Processa um treino salvo: XP, moedas, missões, recordes,
     medalhas e desbloqueios. Retorna o que foi conquistado.
     ========================================================= */
  process(act) {
    const D = Store.data;
    const r = { xp: 0, coins: 0, missions: [], unlocks: [], medals: [], records: [], levelUp: null };
    if (act.flagged) { act.xp = 0; act.coins = 0; Store.save(); return r; }

    const sp = CONFIG.sports[act.sport], km = act.distance / 1000;
    const lvl0 = this.level(D.xp);
    r.xp += Math.round(km * sp.xpPerKm + (act.duration / 60) * CONFIG.xp.perMinute);
    r.coins += Math.round(km * sp.coinsPerKm);

    // recordes
    r.records = this.updateRecords(act);
    r.xp += r.records.filter((x) => x.broken).length * CONFIG.xp.perRecord;

    // missões diárias, semanais e do mês
    const ts = act.start;
    const groups = [['d', this.dailyMissions(ts), 'day'], ['w', CONFIG.weekly, 'week'], ['s', [this.seasonal(ts)], 'month']];
    for (const [pre, list, kind] of groups) {
      const scoped = this.scope(kind, ts);
      for (const m of list) {
        const key = this.mKey(pre, m, ts);
        if (D.missionsDone[key]) continue;
        if (this.mProgress(m, scoped).cur >= m.value) {
          D.missionsDone[key] = Date.now();
          r.missions.push({ ...m, kind: pre });
          r.xp += m.xp; r.coins += m.coins;
          if (pre === 'd') D.dailyDoneCount = (D.dailyDoneCount || 0) + 1;
        }
      }
    }

    // módulos extras (rotas, segmentos, plano, território...)
    for (const h of this.hooks) { try { h(act, r); } catch (e) { console.error(e); } }

    // ofensiva
    D.bestStreak = Math.max(D.bestStreak || 0, this.streakDays());
    D.bestWeekStreak = Math.max(D.bestWeekStreak || 0, this.weekStreak());

    // medalhas
    for (const m of CONFIG.medals) {
      if (D.medals[m.id]) continue;
      const h = new Date(act.start).getHours(); let ok = false;
      switch (m.type) {
        case 'single': ok = act.sport === m.sport && km >= m.value; break;
        case 'before': ok = h < m.hour; break;
        case 'after': ok = h >= m.hour; break;
        case 'monthKm': ok = this.km(this.scope('month', act.start)) >= m.value; break;
        case 'record': ok = r.records.some((x) => x.broken); break;
        case 'weekSports': ok = new Set(this.scope('week', act.start).map((a) => a.sport)).size >= m.value; break;
        case 'dayStreak': ok = this.streakDays() >= m.value; break;
        case 'plan': ok = !!r.planFinished; break;
        case 'territory': ok = Object.keys(D.territory || {}).length >= m.value; break;
      }
      if (ok) { D.medals[m.id] = act.start; r.medals.push(m); r.xp += CONFIG.medalReward.xp; r.coins += CONFIG.medalReward.coins; }
    }

    // desbloqueios
    for (const u of CONFIG.unlocks) {
      if (D.unlocked[u.id]) continue;
      if (this.reqProgress(u.req).cur >= u.req.value) {
        D.unlocked[u.id] = Date.now();
        r.unlocks.push(u); r.xp += u.reward.xp; r.coins += u.reward.coins;
      }
    }

    D.xp += r.xp; D.coins += r.coins;
    D.xpLog.push([Date.now(), r.xp]);
    act.xp = r.xp; act.coins = r.coins;
    const lvl1 = this.level(D.xp);
    if (lvl1 > lvl0) r.levelUp = lvl1;
    Store.save();
    return r;
  },
};
