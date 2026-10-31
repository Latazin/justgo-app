/* =========================================================
   JustGo — TERRITÓRIO POR CIRCUITO FECHADO
   Correu (ou pedalou) e voltou ao mesmo ponto? A área dentro
   do circuito vira sua. Para roubar a área de alguém, feche
   um circuito por cima de pelo menos metade dela.
   Liberado para todo mundo desde o primeiro treino.
   ========================================================= */
const Zones = {
  SPORTS: ['run', 'ride', 'walk', 'hike', 'skate', 'board'],
  CLOSE_M: 40,       // distância para considerar que voltou ao ponto
  MIN_LOOP_M: 300,   // circuito mínimo
  MIN_AREA: 2000,    // m² (≈ meio quarteirão)
  STEAL: 0.5,        // fração da área do outro que precisa ser coberta
  RADIUS_KM: 5,      // raio do mapa ao redor da pessoa

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
  simplify(poly, max = 90) { const step = Math.max(1, Math.ceil(poly.length / max)); return poly.filter((_, i) => i % step === 0).map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]); },

  /* ---------- encontra os circuitos fechados de um treino ---------- */
  loops(points) {
    const src = (points || []).filter((p) => !p[4]);
    if (src.length < 8) return [];
    // um ponto a cada ~12 m e coordenadas em metros (rápido)
    const P = [src[0]];
    for (let i = 1; i < src.length; i++) if (Geo.dist(P[P.length - 1], src[i]) >= 12) P.push(src[i]);
    if (P.length < 8) return [];
    const o = P[0], X = P.map((p) => this.xy(p, o)), D = [0];
    for (let i = 1; i < X.length; i++) D.push(D[i - 1] + Math.hypot(X[i][0] - X[i - 1][0], X[i][1] - X[i - 1][1]));
    const found = []; let cut = 0;
    for (let i = 1; i < X.length; i++) {
      for (let j = i - 1; j >= cut; j--) {
        const per = D[i] - D[j];
        if (per < this.MIN_LOOP_M) continue;
        if (Math.hypot(X[i][0] - X[j][0], X[i][1] - X[j][1]) > this.CLOSE_M) continue;
        const poly = P.slice(j, i + 1).map((p) => [p[0], p[1]]), a = this.area(poly);
        // descarta ida e volta pela mesma rua (área quase zero) e formas finas demais
        if (a >= this.MIN_AREA && a / (per * per) > 0.012) { found.push({ poly: this.simplify(poly), area: Math.round(a) }); cut = i; break; }
      }
    }
    // voltas repetidas no mesmo circuito viram uma área só (fica a maior)
    found.sort((x, y) => y.area - x.area);
    const out = [];
    found.forEach((l) => { if (!out.some((k) => this.overlap(l.poly, k.poly) > 0.7)) out.push(l); });
    return out;
  },

  /* ---------- áreas guardadas no aparelho ---------- */
  mine() { return Store.data.zones || (Store.data.zones = []); },
  totalArea(list) { return (list || this.mine()).reduce((s, z) => s + (z.area || 0), 0); },
  km2(m2) { return Fmt.num(m2 / 1e6, m2 < 1e5 ? 3 : 2); },
  areaTxt(m2) { return m2 < 100000 ? `${Math.round(m2).toLocaleString('pt-BR')} m²` : `${this.km2(m2)} km²`; },

  // chamado ao salvar cada treino
  hook(act, r) {
    if (!this.SPORTS.includes(act.sport) || act.flagged || !act.points || act.points.length < 8) return;
    const L = this.loops(act.points); if (!L.length) return;
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
    if (!ok.length) return null;
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
