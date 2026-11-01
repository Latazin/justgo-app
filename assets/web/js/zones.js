/* =========================================================
   JustGo — TERRITÓRIO POR CIRCUITO FECHADO
   Correu (ou pedalou) e voltou ao mesmo ponto? A área dentro
   do circuito vira sua. Para roubar a área de alguém, feche
   um circuito por cima de pelo menos metade dela.
   Liberado para todo mundo desde o primeiro treino.
   ========================================================= */
const Zones = {
  SPORTS: ['run', 'ride', 'walk', 'hike', 'skate', 'board'],
  CLOSE_M: 45,       // distância para considerar que voltou ao mesmo ponto
  END_CLOSE_M: 150,  // no fim do treino: terminar perto de onde já passou fecha a volta
  GAP_M: 60,         // tolerância extra só para as retas de quando o GPS falhou
  SHAPE: 0.015,      // área/perímetro² mínima: faixas compridas e finas demais não contam
  MIN_LOOP_M: 300,   // circuito mínimo
  MIN_AREA: 2000,    // m² (≈ meio quarteirão)
  STEAL: 0.5,        // fração da área do outro que precisa ser coberta
  RADIUS_KM: 15,     // raio do mapa ao redor da pessoa (cidade inteira)

  /* ---------- geometria (coordenadas [lat, lng]) ---------- */
  xy(p, o) { const k = Math.cos((o[0] * Math.PI) / 180); return [(p[1] - o[1]) * 111320 * k, (p[0] - o[0]) * 110574]; },
  area(poly) {
    if (!poly || poly.length < 3) return 0;
    const o = poly[0], P = poly.map((p) => this.xy(p, o)); let s = 0;
    for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; s += x1 * y2 - x2 * y1; }
    return Math.abs(s) / 2;
  },
  bbox(poly) {
    let a = 90, b = -90, c = 180, d = -180;
    poly.forEach(([la, ln]) => { a = Math.min(a, la); b = Math.max(b, la); c = Math.min(c, ln); d = Math.max(d, ln); });
    return [a, b, c, d];
  },
  center(poly) { const [a, b, c, d] = this.bbox(poly); return [(a + b) / 2, (c + d) / 2]; },
  inside(pt, poly) {
    let c = false; const [y, x] = pt;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  },
  // pontos de amostra dentro de um polígono (para medir sobreposição)
  samples(poly, n = 14) {
    const [a, b, c, d] = this.bbox(poly), out = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = [a + ((b - a) * (i + 0.5)) / n, c + ((d - c) * (j + 0.5)) / n];
      if (this.inside(p, poly)) out.push(p);
    }
    return out.length ? out : [this.center(poly)];
  },
  // quanto de A está dentro de B (ou de qualquer polígono de uma lista)
  overlap(A, B) {
    const list = Array.isArray(B[0][0]) ? B : [B], S = this.samples(A);
    return S.filter((p) => list.some((poly) => this.inside(p, poly))).length / S.length;
  },
  segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const u = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
  },
  simplify(poly, max = 90) { const step = Math.max(1, Math.ceil(poly.length / max)); return poly.filter((_, i) => i % step === 0).map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]); },

  /* ---------- encontra as áreas fechadas de um treino ----------
     O percurso é "pintado" numa grade de poucos metros; tudo o que ficar cercado pela rota
     (ou por um retorno a menos de 45 m de onde já passou) vira área. Funciona com voltas
     que se cruzam, oito, várias voltas no mesmo treino e voltinhas dentro do caminho.
     Ida e volta pela mesma rua não cerca nada. Trechos entre pausas nunca são ligados. */
  loops(points) {
    const src = (points || []).filter((p) => p && p[0] != null);
    if (src.length < 8) return [];
    // um ponto a cada ~8 m, separado por trechos (pausas)
    const P = [src[0]], seg = [0]; let sId = 0;
    for (let i = 1; i < src.length; i++) {
      if (src[i][4]) { sId++; P.push(src[i]); seg.push(sId); continue; }
      if (Geo.dist(P[P.length - 1], src[i]) >= 8) { P.push(src[i]); seg.push(sId); }
    }
    if (P.length < 8) return [];
    const o = P[0], X = P.map((p) => this.xy(p, o)), D = [0];
    for (let i = 1; i < X.length; i++) D.push(D[i - 1] + (seg[i] === seg[i - 1] ? Math.hypot(X[i][0] - X[i - 1][0], X[i][1] - X[i - 1][1]) : 0));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    X.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const c = Math.max(5, Math.max(x1 - x0, y1 - y0) / 1600), pad = 6;
    const w = Math.ceil((x1 - x0) / c) + 2 * pad, h = Math.ceil((y1 - y0) / c) + 2 * pad;
    const G = new Uint8Array(w * h); // 1 = rota
    const gx = (x) => (x - x0) / c + pad, gy = (y) => (y - y0) / c + pad;
    const stamp = (fx, fy) => { const cx = Math.round(fx), cy = Math.round(fy); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X_ = cx + dx, Y_ = cy + dy; if (X_ >= 0 && Y_ >= 0 && X_ < w && Y_ < h) G[Y_ * w + X_] = 1; } };
    const line = (a, b) => { const ax = gx(a[0]), ay = gy(a[1]), bx = gx(b[0]), by = gy(b[1]), n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2)); for (let k = 0; k <= n; k++) stamp(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n); };
    for (let i = 1; i < X.length; i++) if (seg[i] === seg[i - 1]) line(X[i - 1], X[i]);
    // retorno perto de onde já passou (mesmo trecho, depois de pelo menos 300 m): fecha a volta
    const H = new Map(), key = (x, y) => Math.floor(x / this.CLOSE_M) + ',' + Math.floor(y / this.CLOSE_M);
    for (let i = 0; i < X.length; i++) {
      const [x, y] = X[i], kx = Math.floor(x / this.CLOSE_M), ky = Math.floor(y / this.CLOSE_M);
      let best = -1, bd = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const L = H.get((kx + dx) + ',' + (ky + dy)); if (!L) continue;
        for (const j of L) {
          if (seg[j] !== seg[i] || D[i] - D[j] < this.MIN_LOOP_M) continue;
          const d = Math.hypot(x - X[j][0], y - X[j][1]); if (d <= this.CLOSE_M && d < bd) { bd = d; best = j; }
        }
      }
      if (best >= 0 && bd > c) line(X[i], X[best]);
      // última posição do trecho: tolerância maior (terminou perto do começo/do caminho)
      if (best < 0 && (i === X.length - 1 || seg[i + 1] !== seg[i])) {
        let bj = -1, bdd = Infinity;
        for (let j = 0; j < i; j++) { if (seg[j] !== seg[i] || D[i] - D[j] < this.MIN_LOOP_M) continue; const d = Math.hypot(x - X[j][0], y - X[j][1]); if (d <= this.END_CLOSE_M && d < bdd) { bdd = d; bj = j; } }
        if (bj >= 0) line(X[i], X[bj]);
      }
      const k = key(x, y); if (!H.has(k)) H.set(k, []); H.get(k).push(i);
    }
    // tudo que o "lado de fora" não alcança está cercado
    const out = new Uint8Array(w * h), Q = new Int32Array(w * h); let qh = 0, qt = 0;
    const push = (i) => { if (!out[i] && !G[i]) { out[i] = 1; Q[qt++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (qh < qt) { const i = Q[qh++], x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w); }
    const F = new Uint8Array(w * h); let any = false;
    for (let i = 0; i < w * h; i++) if (!out[i] && !G[i]) { F[i] = 1; any = true; }
    if (!any) return [];
    // junta a área cercada com a rota em volta dela e tira pontas finas (abertura morfológica)
    const filled = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) filled[i] = out[i] ? 0 : 1;
    const R = 2, morph = (A, isMin) => {
      const T = new Uint8Array(w * h), B = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = isMin ? 1 : 0; for (let d = -R; d <= R && (isMin ? v : !v); d++) { const X_ = x + d; const a = X_ < 0 || X_ >= w ? 0 : A[y * w + X_]; v = isMin ? v & a : v | a; } T[y * w + x] = v; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = isMin ? 1 : 0; for (let d = -R; d <= R && (isMin ? v : !v); d++) { const Y_ = y + d; const a = Y_ < 0 || Y_ >= h ? 0 : T[Y_ * w + x]; v = isMin ? v & a : v | a; } B[y * w + x] = v; }
      return B;
    };
    const M = morph(morph(filled, true), false);
    // componentes
    const lab = new Int32Array(w * h), res = []; let nl = 0;
    for (let s = 0; s < w * h; s++) {
      if (!M[s] || lab[s]) continue;
      nl++; let qh2 = 0, qt2 = 0, n = 0, inner = 0; Q[qt2++] = s; lab[s] = nl;
      while (qh2 < qt2) {
        const i = Q[qh2++], x = i % w; n++; if (F[i]) inner++;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
        for (const j of nb) if (j >= 0 && j < w * h && M[j] && !lab[j]) { lab[j] = nl; Q[qt2++] = j; }
      }
      if (inner * c * c < this.MIN_AREA) continue;
      const poly = this.trace(lab, nl, s, w, h).map(([px, py]) => {
        const mx = (px - pad) * c + x0, my = (py - pad) * c + y0, k = Math.cos((o[0] * Math.PI) / 180);
        return [o[0] + my / 110574, o[1] + mx / (111320 * k)];
      });
      if (poly.length < 4) continue;
      const a = this.area(poly), per = poly.reduce((s_, p, i) => s_ + Geo.dist(p, poly[(i + 1) % poly.length]), 0);
      if (a < this.MIN_AREA || a / (per * per) < this.SHAPE) continue;
      res.push({ poly: this.simplify(poly), area: Math.round(a) });
    }
    return res.sort((x, y) => y.area - x.area);
  },
  // contorno externo de um componente (vizinhança de Moore) + simplificação Douglas-Peucker
  trace(lab, id, s, w, h) {
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x] === id;
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let x = s % w, y = (s / w) | 0; const sx = x, sy = y, pts = [[x, y]]; let d = 6, guard = 0;
    do {
      let found = false;
      for (let k = 0; k < 8; k++) { const nd = (d + 6 + k) % 8, nx = x + dirs[nd][0], ny = y + dirs[nd][1]; if (at(nx, ny)) { x = nx; y = ny; d = nd; found = true; break; } }
      if (!found) break;
      pts.push([x, y]);
    } while ((x !== sx || y !== sy) && ++guard < 200000);
    const rdp = (A, eps) => {
      if (A.length < 3) return A;
      let mi = 0, md = 0; const [ax, ay] = A[0], [bx, by] = A[A.length - 1], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = 1; i < A.length - 1; i++) { const dd = Math.abs((bx - ax) * (ay - A[i][1]) - (ax - A[i][0]) * (by - ay)) / L; if (dd > md) { md = dd; mi = i; } }
      return md > eps ? rdp(A.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(A.slice(mi), eps)) : [A[0], A[A.length - 1]];
    };
    const half = Math.floor(pts.length / 2);
    return rdp(pts.slice(0, half + 1), 0.8).slice(0, -1).concat(rdp(pts.slice(half), 0.8)).slice(0, -1);
  },

  // explica por que um treino virou (ou não) território
  diagnose(act) {
    if (!act || !act.points || act.points.length < 8) return { ok: false, why: 'Este treino não tem percurso de GPS.' };
    if (!this.SPORTS.includes(act.sport)) return { ok: false, why: 'Esse esporte não conquista território.' };
    if (act.flagged) return { ok: false, why: 'Treino marcado como suspeito (velocidade fora do normal).' };
    const L = this.loops(act.points);
    if (L.length) return { ok: true, loops: L, area: L.reduce((s, l) => s + l.area, 0), priv: !!act.private };
    const P = act.points.filter((p) => p && p[0] != null), gap = Math.round(Geo.dist(P[0], P[P.length - 1]));
    if (gap > this.END_CLOSE_M) return { ok: false, why: `O treino terminou a ${gap >= 1000 ? Fmt.km(gap) + ' km' : gap + ' m'} de onde começou e o caminho não se fechou. Para conquistar, termine a menos de ${this.END_CLOSE_M} m do início ou passe de novo por um trecho que já percorreu.` };
    return { ok: false, why: 'A volta ficou pequena ou fina demais (ida e volta pela mesma rua não conta).' };
  },

  /* ---------- áreas guardadas no aparelho ---------- */
  mine() { return Store.data.zones || (Store.data.zones = []); },
  totalArea(list) { return (list || this.mine()).reduce((s, z) => s + (z.area || 0), 0); },
  km2(m2) { return Fmt.num(m2 / 1e6, m2 < 1e5 ? 3 : 2); },
  areaTxt(m2) { return m2 < 100000 ? `${Math.round(m2).toLocaleString('pt-BR')} m²` : `${this.km2(m2)} km²`; },

  // chamado ao salvar cada treino
  hook(act, r) {
    act.zc = 4;
    if (!this.SPORTS.includes(act.sport) || act.flagged || !act.points || act.points.length < 8) return;
    const L = this.loops(act.points); if (!L.length) return;
    // reprocessando um treino: as áreas antigas dele dão lugar às novas (sem contar duas vezes)
    Store.data.zones = this.mine().filter((z) => z.act !== act.id);
    const Z = this.mine(); let nNew = 0, aNew = 0;
    L.forEach((l) => {
      const same = Z.find((z) => this.overlap(l.poly, z.poly) > 0.8 && this.overlap(z.poly, l.poly) > 0.8);
      if (same) { same.at = act.start; same.act = act.id; return; }
      Z.push({ id: uid(), poly: l.poly, area: l.area, at: act.start, act: act.id }); nNew++; aNew += l.area;
    });
    act.loops = L.length; act.loopArea = L.reduce((s, l) => s + l.area, 0);
    r.zones = { loops: L, nNew, aNew };
  },

  // depois de salvar: disputa as áreas com os outros atletas (precisa de conta)
  async claim(act, loops) {
    if (!Cloud.loggedIn() || !Cloud.me || act.private || act.flagged || !loops || !loops.length) return null;
    const P = Store.data.privacy, me = Cloud.user.id, name = Cloud.me.name || 'Atleta';
    // áreas encostadas na zona de privacidade (casa) ficam só no aparelho
    const ok = loops.filter((l) => !(P.zone && P.lat != null && l.poly.some((p) => Geo.dist(p, [P.lat, P.lng]) < P.radius)));
    if (!ok.length) return { stolen: [], created: [], privacy: true };
    const c = this.center(ok[0].poly), near = await Cloud.zonesNear(c[0], c[1], 4);
    const stolen = [], created = [];
    for (const l of ok) {
      for (const z of near) {
        if (z.owner === me || z._taken) continue;
        if (this.overlap(z.poly, l.poly) >= this.STEAL) {
          await Cloud.stealZone(z.id, name); z._taken = true; z.owner = me; stolen.push(z);
        }
      }
      const minePolys = near.filter((z) => z.owner === me).map((z) => z.poly);
      if (minePolys.length && this.overlap(l.poly, minePolys) >= 0.7) continue; // já é sua
      const zc = this.center(l.poly), row = await Cloud.addZone({ poly: l.poly, area: l.area, lat: zc[0], lng: zc[1], activity_id: act.id }, name);
      if (row) { near.push(row); created.push(row); }
    }
    return { stolen, created };
  },
};
Game.hooks.push((act, r) => Zones.hook(act, r));

// regra corrigida (v2.10.2): revê as áreas já conquistadas e apaga as que não eram circuito de verdade
Zones.cleanup = async function () {
  const D = Store.data; if (D.zfix === 2) return;
  const byAct = {}; D.activities.forEach((a) => (byAct[a.id] = a));
  const valid = {}; // id do treino -> circuitos válidos pela regra nova
  const okFor = (aid) => { if (!(aid in valid)) { const a = byAct[aid]; valid[aid] = a && a.points ? this.loops(a.points) : null; } return valid[aid]; };
  const bad = (poly, aid) => { const L = okFor(aid); return L && !L.some((l) => this.overlap(poly, l.poly) > 0.6); };
  const before = this.mine().length;
  D.zones = this.mine().filter((z) => !(z.act && bad(z.poly, z.act)));
  let removed = before - D.zones.length;
  D.activities.forEach((a) => { if (valid[a.id]) { a.loops = valid[a.id].length; a.loopArea = valid[a.id].reduce((s, l) => s + l.area, 0); } });
  if (Cloud.loggedIn() && Cloud.user) {
    try {
      const { data } = await Cloud.sb.from('zones').select('id,poly,activity_id').eq('owner', Cloud.user.id).limit(500);
      for (const z of data || []) if (z.activity_id && byAct[z.activity_id] && bad(z.poly, z.activity_id)) { await Cloud.sb.from('zones').delete().eq('id', z.id); removed++; }
    } catch (e) { console.warn(e); return; } // tenta de novo na próxima abertura
  } else if (Cloud.configured && Cloud.configured()) { Store.save(); return; } // sem conta agora: limpa a nuvem depois
  D.zfix = 2; Store.save();
  if (removed) FX.toast(`Território corrigido: ${removed} área${removed > 1 ? 's' : ''} que não fechava${removed > 1 ? 'm' : ''} circuito ${removed > 1 ? 'foram removidas' : 'foi removida'}.`);
};

// treinos dos últimos 30 dias feitos em versões antigas (ou com a regra antiga, mais rígida)
// são verificados de novo: se fecharam área, a área é conquistada agora
Zones.recheck = async function () {
  const D = Store.data, since = Date.now() - 30 * 864e5;
  const todo = D.activities.filter((a) => a.start >= since && a.zc !== 4 && this.SPORTS.includes(a.sport) && !a.flagged && a.points && a.points.length >= 8);
  if (!todo.length) return;
  let got = 0, area = 0;
  for (const act of todo.sort((x, y) => x.start - y.start)) {
    const r = {}; this.hook(act, r);
    if (r.zones && r.zones.loops.length && !act.private) {
      try { const c = await this.claim(act, r.zones.loops); if (c) { got += c.created.length + c.stolen.length; area += c.created.reduce((x, z) => x + (z.area || 0), 0); } } catch (e) { console.warn(e); }
    }
  }
  Store.save();
  setTimeout(() => this.sync().catch(() => {}), 1500);
  if (got) FX.toast(`Território: ${got} área${got > 1 ? 's' : ''} conquistada${got > 1 ? 's' : ''} em treinos recentes${area ? ` (${this.areaTxt(area)})` : ''}`);
};

// áreas que ficaram só no aparelho (envio falhou ou app fechou antes): manda para o mapa
Zones.pendingOf = function (cloud) {
  const me = Cloud.user && Cloud.user.id, P = Store.data.privacy, acts = {};
  Store.data.activities.forEach((a) => (acts[a.id] = a));
  return this.mine().filter((z) => {
    const a = acts[z.act]; if (a && (a.private || a.flagged)) return false;
    if (P.zone && P.lat != null && z.poly.some((p) => Geo.dist(p, [P.lat, P.lng]) < P.radius)) return false;
    if (cloud.some((o) => o.owner === me && this.overlap(z.poly, o.poly) >= 0.6)) return false;
    // alguém roubou depois: não volta
    if (cloud.some((o) => o.owner !== me && this.overlap(z.poly, o.poly) >= 0.6 && Date.parse(o.captured_at) > (z.at || 0))) return false;
    return true;
  });
};
Zones.sync = async function () {
  if (!Cloud.loggedIn() || !Cloud.me || this._syncing) return 0;
  this._syncing = true; let up = 0;
  try {
    const L = this.mine(); if (!L.length) return 0;
    const c = this.center(L[L.length - 1].poly), near = await Cloud.zonesNear(c[0], c[1], this.RADIUS_KM);
    for (const z of this.pendingOf(near)) {
      const zc = this.center(z.poly), row = await Cloud.addZone({ poly: z.poly, area: z.area, lat: zc[0], lng: zc[1], activity_id: z.act || null }, Cloud.me.name || 'Atleta');
      if (!row) break;
      near.push(row); up++;
    }
    if (up) { FX.toast(`Território enviado para o mapa: ${up} área${up > 1 ? 's' : ''}`); if (App.tab === 'mapa') { UI._zonesCloud = null; UI.mapa(); } }
    else if (Cloud.zoneErr) FX.toast('Não consegui enviar sua área para o mapa: ' + Cloud.zoneErr.slice(0, 90));
  } catch (e) { console.warn(e); } finally { this._syncing = false; }
  return up;
};
