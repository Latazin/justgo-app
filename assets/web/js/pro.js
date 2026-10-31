/* =========================================================
   JustGo — MODO PROFISSIONAL
   Estatísticas detalhadas e calorias calculadas pela física
   do movimento, com os dados do corpo e dos equipamentos.
   Corrida/caminhada: custo energético de Minetti et al. (2002),
     que considera a inclinação de cada trecho (subida e descida).
   Pedal: modelo de potência (rolamento + ar + subida), com peso
     de ciclista + bike, posição, pneu e altitude.
   Natação: METs do Compêndio de Atividades por estilo e ritmo.
   Com frequência cardíaca do relógio: fórmula de Keytel (2005).
   Tudo é estimativa — quanto mais dados, mais perto do real.
   ========================================================= */
const Pro = {
  DEF: { on: false, sex: '', height: 0, restHr: 0, maxHr: 0, carry: 0, runSurface: 'road', bikeType: 'road', bikeWeight: 0, position: 'hoods', tire: 'road', ftp: 0, stroke: 'crawl', wetsuit: false },
  BIKES: { road: ['Speed / estrada', 8.5, 0.0040, 0.36], gravel: ['Gravel', 9.5, 0.0055, 0.40], mtb: ['Mountain bike', 13, 0.0085, 0.48], urban: ['Urbana / passeio', 15, 0.0065, 0.55], ebike: ['Elétrica (assistida)', 22, 0.0065, 0.52] },
  POS: { drops: ['Deitado (drops/clip)', 0.86], hoods: ['Normal (manetes)', 1], upright: ['Sentado reto', 1.3] },
  TIRES: { road: ['Asfalto liso', 1], mixed: ['Asfalto ruim / paralelepípedo', 1.6], gravel: ['Terra / cascalho', 2.2], trail: ['Trilha', 3] },
  RUNS: { road: ['Asfalto / rua', 1], trail: ['Trilha / terra', 1.08], sand: ['Areia', 1.25], treadmill: ['Esteira', 0.95] },
  STROKES: { crawl: 'Crawl (livre)', peito: 'Peito', costas: 'Costas', borboleta: 'Borboleta' },

  cfg() { const P = Store.data; if (!P.pro) P.pro = { ...this.DEF }; return { ...this.DEF, ...P.pro }; },
  on() { return !!(Store.data.pro && Store.data.pro.on); },
  set(k, v) { if (!Store.data.pro) Store.data.pro = { ...this.DEF }; Store.data.pro[k] = v; this._cache = new WeakMap(); Store.save(); },
  maxHr() { const c = this.cfg(), age = Store.data.profile.age || 30; return c.maxHr || Math.round(208 - 0.7 * age); },
  // assinatura dos dados usados no cálculo (muda = recalcula)
  sig() { const c = this.cfg(), P = Store.data.profile; return JSON.stringify([c, P.weight, P.age]); },
  _cache: new WeakMap(),

  bikeOf(act) {
    const c = this.cfg(), g = act.gear && Gear.get(act.gear);
    const type = (g && g.btype) || c.bikeType, B = this.BIKES[type] || this.BIKES.road;
    return { type, name: B[0], weight: +((g && g.bweight) || c.bikeWeight || B[1]), crr: B[2] * (this.TIRES[c.tire] || this.TIRES.road)[1], cda: B[3] * (this.POS[c.position] || this.POS.hoods)[1] };
  },

  // custo de correr/caminhar (J por kg por metro) em função da inclinação (Minetti 2002)
  costRun(i) { return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6; },
  costWalk(i) { return 280.5 * i ** 5 - 58.7 * i ** 4 - 76.8 * i ** 3 + 51.9 * i ** 2 + 19.6 * i + 2.5; },
  swimMet(stroke, mpm) {
    if (stroke === 'borboleta') return 13.8;
    if (stroke === 'peito') return mpm < 40 ? 5.3 : 10.3;
    if (stroke === 'costas') return mpm < 40 ? 4.8 : 9.5;
    return mpm < 45 ? 5.8 : mpm < 65 ? 8.3 : 10.0;
  },
  keytel(hr, mins) {
    const c = this.cfg(), P = Store.data.profile, w = P.weight || 70, age = P.age || 30;
    if (!hr || !c.sex) return null;
    const k = c.sex === 'f' ? (-20.4022 + 0.4472 * hr - 0.1263 * w + 0.074 * age) / 4.184 : (-55.0969 + 0.6309 * hr + 0.1988 * w + 0.2017 * age) / 4.184;
    return Math.max(0, k * mins);
  },

  /* ---------- análise completa de um treino ---------- */
  analyze(act) {
    const sig = this.sig(), hit = this._cache.get(act);
    if (hit && hit.sig === sig && hit.hr === JSON.stringify(act.hr || null) && hit.k === `${act.altSrc}|${act.distance}|${(act.points || []).length}`) return hit.r;
    const r = this._analyze(act);
    this._cache.set(act, { sig, hr: JSON.stringify(act.hr || null), k: `${act.altSrc}|${act.distance}|${(act.points || []).length}`, r });
    return r;
  },
  _analyze(act) {
    const c = this.cfg(), P = Store.data.profile, W = P.weight || 70, sp = act.sport;
    const R = { sport: sp, moving: act.duration, elapsed: act.elapsed || act.duration, distance: act.distance, method: '', notes: [] };
    const pts = (act.points || []).filter((p) => p && p[2] != null);
    const cap = (CONFIG.sports[sp].maxKmh * 1.5) / 3.6;

    // natação sem GPS (piscina) ou com GPS (águas abertas)
    if (sp === 'swim' || pts.length < 5) {
      const mpm = act.duration ? act.distance / (act.duration / 60) : 0;
      if (sp === 'swim') {
        const met = this.swimMet(c.stroke, mpm) * (c.wetsuit && !act.pool ? 0.92 : 1);
        R.kcal = Math.round(met * W * (act.duration / 3600)); R.met = met;
        R.method = `METs de natação · ${this.STROKES[c.stroke] || 'Crawl'} a ${Math.round(mpm)} m/min`;
        R.per100 = act.distance ? act.duration / (act.distance / 100) : 0;
      } else {
        R.kcal = Game.caloriesBasic(act); R.method = 'Estimativa por METs (treino sem GPS)';
      }
      return this.withHr(act, R);
    }

    // blocos de ~10 s: tira o serrilhado do GPS sem perder subidas e acelerações
    const alt = this.smoothAlt(pts);
    const blocks = []; let s = 0;
    for (let i = 1; i <= pts.length; i++) {
      const end = i === pts.length || pts[i][4];
      if (i < pts.length && !end && pts[i][2] - pts[s][2] < 10000) continue;
      const e = end ? i - 1 : i;
      if (e > s) {
        let d = 0; for (let k = s + 1; k <= e; k++) d += Geo.dist(pts[k - 1], pts[k]);
        const dt = (pts[e][2] - pts[s][2]) / 1000;
        if (dt > 0) {
          let v = d / dt; if (v > cap) { d = 0; v = 0; } // salto de GPS
          const da = alt[e] != null && alt[s] != null ? alt[e] - alt[s] : 0;
          blocks.push({ d, dt, v, g: d > 8 ? Math.max(-0.3, Math.min(0.3, da / d)) : 0, alt: alt[e] != null ? alt[e] : 0 });
        }
      }
      s = end ? i : e;
    }
    const mov = blocks.filter((b) => b.v > (Fmt.isSpeed(sp) ? 1 : 0.4));
    const foot = !!CONFIG.sports[sp].foot;
    const movT = mov.reduce((x, b) => x + b.dt, 0) || act.duration;
    R.moving = Math.round(movT);

    // energia por bloco
    let kcal = 0, mech = 0; const zone = [0, 0, 0, 0, 0], pw = [];
    const run = this.RUNS[c.runSurface] || this.RUNS.road, m = W + (+c.carry || 0);
    const bike = this.bikeOf(act);
    blocks.forEach((b) => {
      let k = 0, met = 1;
      if (sp === 'ride') {
        const M = W + bike.weight + (+c.carry || 0), rho = 1.225 * Math.exp(-b.alt / 8500), th = Math.atan(b.g);
        let p = b.v > 0.5 ? (M * 9.81 * (bike.crr * Math.cos(th) + Math.sin(th)) * b.v + 0.5 * rho * bike.cda * b.v ** 3) / 0.976 : 0;
        p = Math.max(0, Math.min(1500, p));
        if (bike.type === 'ebike') p *= 0.5; // motor ajuda em ~metade
        mech += p * b.dt; pw.push([p, b.dt]);
        k = (p * b.dt) / 0.24 / 4184 + (b.dt / 3600) * W * 1.0; // eficiência humana ~24% + metabolismo de repouso
        b.p = p;
      } else if (!foot) {
        // patins, skate, remo: METs do esporte ajustados pela velocidade
        const ref = CONFIG.sports[sp].simSpeed || 4, met0 = CONFIG.sports[sp].met;
        k = b.v > 0.5 ? (met0 * Math.max(0.6, Math.min(1.6, b.v / ref)) * W * b.dt) / 3600 : (b.dt / 3600) * W;
      } else {
        const C = b.v < 2.1 ? this.costWalk(b.g) : this.costRun(b.g);
        k = b.v > 0.4 ? (Math.max(0, C) * run[1] * m * b.d) / 4184 : 0;
        k += (b.dt / 3600) * W * 1.0;
      }
      kcal += k; met = (k / (b.dt / 3600)) / W;
      if (b.v > 0.4) zone[met < 4 ? 0 : met < 7 ? 1 : met < 10 ? 2 : met < 13 ? 3 : 4] += b.dt;
    });
    R.kcal = Math.round(kcal);
    R.met = movT ? (kcal / (movT / 3600)) / W : 0;
    R.zones = zone;
    R.method = !foot && sp !== 'ride' ? `METs de ${CONFIG.sports[sp].name.toLowerCase()} ajustados pela velocidade · ${W} kg` : sp === 'ride'
      ? `Potência pela física do pedal · ${bike.name}, ${Fmt.num(bike.weight, 1)} kg · você ${W} kg${c.carry ? ` + ${c.carry} kg de carga` : ''}`
      : `Custo energético por inclinação (Minetti) · ${W} kg${c.carry ? ` + ${c.carry} kg de carga` : ''} · ${run[0].toLowerCase()}`;

    // velocidade: média em movimento e máxima (janela de 8 s, sem picos de GPS)
    R.avgMoving = movT ? act.distance / movT : 0;
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + (pts[i][4] ? 0 : Geo.dist(pts[i - 1], pts[i]));
    let vmax = 0, j = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][4]) { j = i; continue; }
      while (j < i - 1 && pts[i][2] - pts[j + 1][2] >= 8000) j++;
      const dt = (pts[i][2] - pts[j][2]) / 1000;
      if (dt >= 6) { const v = (cum[i] - cum[j]) / dt; if (v <= cap && v > vmax) vmax = v; }
    }
    R.vmax = vmax;

    // tempo em movimento acumulado (para melhores trechos e parciais)
    const mt = [0];
    for (let i = 1; i < pts.length; i++) { const dt = (pts[i][2] - pts[i - 1][2]) / 1000, dd = cum[i] - cum[i - 1]; mt[i] = mt[i - 1] + (pts[i][4] || dt <= 0 || dd / dt < 0.3 ? 0 : dt); }
    const best = (L) => {
      if (cum[cum.length - 1] < L) return null; let b = Infinity, a = 0;
      for (let i = 1; i < pts.length; i++) { while (a < i && cum[i] - cum[a + 1] >= L) a++; if (cum[i] - cum[a] >= L) b = Math.min(b, (mt[i] - mt[a]) * (L / (cum[i] - cum[a]))); }
      return isFinite(b) && b > 0 ? b : null;
    };
    R.best = foot ? [['400 m', 400], ['1 km', 1000], ['5 km', 5000], ['10 km', 10000]].map(([n, L]) => [n, best(L), L]).filter((x) => x[1])
      : [['1 km', 1000], ['5 km', 5000], ['10 km', 10000], ['20 km', 20000], ['40 km', 40000]].map(([n, L]) => [n, best(L), L]).filter((x) => x[1]);

    // elevação
    let up = 0, down = 0, last = null, amax = -Infinity, amin = Infinity;
    alt.forEach((a) => { if (a == null) return; amax = Math.max(amax, a); amin = Math.min(amin, a); if (last == null) { last = a; return; } const d = a - last; if (Math.abs(d) >= 2) { if (d > 0) up += d; else down -= d; last = a; } });
    R.up = Math.round(up); R.down = Math.round(down); R.altMax = isFinite(amax) ? Math.round(amax) : null; R.altMin = isFinite(amin) ? Math.round(amin) : null;
    let gmax = 0, gmin = 0, a0 = 0;
    for (let i = 1; i < pts.length; i++) {
      while (a0 < i && cum[i] - cum[a0 + 1] >= 100) a0++;
      if (cum[i] - cum[a0] >= 100 && alt[i] != null && alt[a0] != null) { const g = (alt[i] - alt[a0]) / (cum[i] - cum[a0]); gmax = Math.max(gmax, g); gmin = Math.min(gmin, g); }
    }
    R.gradeMax = gmax * 100; R.gradeMin = gmin * 100;

    // parciais por km com subida e descida
    R.splits = []; let k0 = 0, km = 1;
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] >= km * 1000) {
        let u = 0, dn = 0, la = null; for (let q = k0; q <= i; q++) { const a = alt[q]; if (a == null) continue; if (la == null) { la = a; continue; } const d = a - la; if (Math.abs(d) >= 2) { if (d > 0) u += d; else dn -= d; la = a; } }
        R.splits.push({ km, t: mt[i] - mt[k0], up: Math.round(u), down: Math.round(dn) }); k0 = i; km++;
      }
    }

    // potência (pedal)
    if (sp === 'ride' && pw.length) {
      const movP = pw.filter(([p]) => p > 0), tt = movP.reduce((x, [, d]) => x + d, 0) || 1;
      R.pAvg = Math.round(movP.reduce((x, [p, d]) => x + p * d, 0) / tt);
      const roll = pw.map((_, i) => { const w = pw.slice(Math.max(0, i - 2), i + 1); return w.reduce((x, [p]) => x + p, 0) / w.length; });
      R.pNorm = Math.round((roll.reduce((x, p) => x + p ** 4, 0) / roll.length) ** 0.25);
      R.pMax = Math.round(Math.max(...roll));
      R.wkg = R.pAvg / W; R.kj = Math.round(mech / 1000);
      if (c.ftp) { R.if = R.pNorm / c.ftp; R.tss = Math.round(((movT * R.pNorm * R.if) / (c.ftp * 3600)) * 100); }
    }
    // carga de treino estimada (sem frequência cardíaca)
    R.load = Math.round((movT / 3600) * ((R.met || 0) / 10) ** 2 * 100);
    return this.withHr(act, R);
  },
  // frequência cardíaca do relógio: calorias mais certeiras + zona + TRIMP
  withHr(act, R) {
    const hr = act.hr || {}, c = this.cfg();
    if (hr.avg) {
      const k = this.keytel(hr.avg, R.moving / 60);
      if (k != null) { R.kcalMotion = R.kcal; R.kcal = Math.round(k); R.method = `Frequência cardíaca média ${hr.avg} bpm (Keytel) · ${Store.data.profile.weight} kg, ${Store.data.profile.age} anos`; }
      else R.notes.push('Informe seu sexo no Modo profissional para usar os batimentos no cálculo das calorias.');
      const max = this.maxHr(), rest = c.restHr || 60, hrr = Math.max(0, Math.min(1, (hr.avg - rest) / (max - rest)));
      R.hrZone = hrr < 0.6 ? 1 : hrr < 0.7 ? 2 : hrr < 0.8 ? 3 : hrr < 0.9 ? 4 : 5;
      R.hrPct = Math.round((hr.avg / max) * 100);
      const y = c.sex === 'f' ? 0.86 * Math.exp(1.67 * hrr) : 0.64 * Math.exp(1.92 * hrr);
      R.load = Math.round((R.moving / 60) * hrr * y);
      R.loadHr = true;
    }
    return R;
  },
  smoothAlt(pts) {
    const raw = pts.map((p) => (p[3] != null ? p[3] : null));
    return raw.map((_, i) => { let s = 0, n = 0; for (let k = Math.max(0, i - 4); k <= Math.min(raw.length - 1, i + 4); k++) if (raw[k] != null) { s += raw[k]; n++; } return n ? s / n : null; });
  },
};
