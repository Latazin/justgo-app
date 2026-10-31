/* =========================================================
   JustGo — RUAS NUNCA PERCORRIDAS
   Pinta no mapa as ruas por onde você já passou (azul) e as que
   ainda faltam (laranja), e mostra quanto da área você explorou.
   As ruas vêm do próprio mapa (OpenStreetMap via OpenFreeMap):
   nada de API extra, tudo calculado no celular.
   ========================================================= */
const Explore = {
  DLAT: 0.00018, // ~20 m
  CLASSES: ['trunk', 'primary', 'secondary', 'tertiary', 'minor', 'path', 'pedestrian', 'living_street', 'track'],
  _grid: null, _sig: '',

  dlng(lat) { return this.DLAT / Math.cos((lat * Math.PI) / 180); },
  key(lat, lng, dl) { return Math.floor(lat / this.DLAT) + ':' + Math.floor(lng / dl); },

  // células (~20 m) por onde você passou, com folga de uma célula para o erro do GPS
  grid(lat0) {
    const A = Store.data.activities.filter((a) => a.points && a.points.length > 1 && a.sport !== 'swim' && !a.flagged);
    const sig = A.length + ':' + (A[A.length - 1] ? A[A.length - 1].id : '');
    if (this._grid && this._sig === sig) return this._grid;
    const G = new Set(), dl = this.dlng(lat0);
    const mark = (la, ln) => { const y = Math.floor(la / this.DLAT), x = Math.floor(ln / dl); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) G.add((y + i) + ':' + (x + j)); };
    A.forEach((a) => {
      const P = a.points;
      for (let i = 1; i < P.length; i++) {
        const p = P[i - 1], q = P[i]; if (q[4]) continue;
        const d = Geo.dist(p, q), n = Math.max(1, Math.ceil(d / 10));
        if (d > 400) continue; // reta de GPS perdido: não conta como rua percorrida
        for (let k = 0; k <= n; k++) mark(p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n);
      }
    });
    this._grid = G; this._sig = sig; this._dl = dl;
    return G;
  },

  roads(gl) {
    const src = Object.entries(gl.getStyle().sources || {});
    const vec = src.find(([, s]) => s.type === 'vector');
    let F = [];
    if (vec) F = gl.querySourceFeatures(vec[0], { sourceLayer: 'transportation' }).filter((f) => this.CLASSES.includes(f.properties.class));
    else { const g = src.find(([, s]) => s.type === 'geojson'); if (g) F = gl.querySourceFeatures(g[0]).filter((f) => ['street', 'major', 'path'].includes(f.properties.k)); }
    const lines = [];
    F.forEach((f) => { const g = f.geometry; if (g.type === 'LineString') lines.push(g.coordinates); else if (g.type === 'MultiLineString') g.coordinates.forEach((c) => lines.push(c)); });
    return lines;
  },

  // calcula na área visível: devolve geojson das ruas feitas/faltando e o percentual
  compute(gl, bounds) {
    const c = bounds.getCenter(), G = this.grid(c.lat), dl = this._dl;
    const inB = (lng, lat) => lat >= bounds.getSouth() && lat <= bounds.getNorth() && lng >= bounds.getWest() && lng <= bounds.getEast();
    const yes = [], no = [], seen = new Set(); let lenY = 0, lenN = 0;
    this.roads(gl).forEach((line) => {
      let cur = null, curOk = null;
      const flush = () => { if (cur && cur.length > 1) (curOk ? yes : no).push(cur); cur = null; };
      for (let i = 1; i < line.length; i++) {
        const [x0, y0] = line[i - 1], [x1, y1] = line[i], d = Geo.dist([y0, x0], [y1, x1]), n = Math.max(1, Math.ceil(d / 15));
        for (let k = 0; k < n; k++) {
          const ax = x0 + ((x1 - x0) * k) / n, ay = y0 + ((y1 - y0) * k) / n, bx = x0 + ((x1 - x0) * (k + 1)) / n, by = y0 + ((y1 - y0) * (k + 1)) / n;
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          if (!inB(mx, my)) { flush(); continue; }
          // a mesma rua aparece repetida nas bordas dos tiles: conta cada trecho uma vez
          const sk = Math.round(mx * 2e4) + ',' + Math.round(my * 2e4); const dup = seen.has(sk); seen.add(sk);
          const ok = G.has(this.key(my, mx, dl)), len = d / n;
          if (!dup) { if (ok) lenY += len; else lenN += len; }
          if (cur && curOk !== ok) flush();
          if (!cur) { cur = [[ax, ay]]; curOk = ok; }
          cur.push([bx, by]);
        }
      }
      flush();
    });
    const tot = lenY + lenN;
    return {
      yes: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: yes } },
      no: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: no } },
      km: lenY / 1000, total: tot / 1000, pct: tot ? (lenY / tot) * 100 : 0,
    };
  },

  // liga/desliga a camada no mapa da aba Mapa
  show(m, on) {
    const gl = m && m._gl && m._gl.getMaplibreMap && m._gl.getMaplibreMap();
    if (!gl) { if (on) FX.toast('Seu aparelho não desenhou o mapa detalhado: esta camada precisa dele.'); return; }
    const off = () => { ['jg-exp-no', 'jg-exp-yes'].forEach((id) => { if (gl.getLayer(id)) gl.removeLayer(id); }); ['jg-exp-no', 'jg-exp-yes'].forEach((id) => { if (gl.getSource(id)) gl.removeSource(id); }); };
    if (this._mv) { m.off('moveend', this._mv); this._mv = null; }
    if (!on) { off(); this.panel(null); return; }
    const run = () => {
      if (!gl.isStyleLoaded()) return gl.once('idle', run);
      if (m.getZoom() < 13.5) { off(); this.panel({ far: true }); return; }
      const r = this.compute(gl, gl.getBounds());
      const up = (id, data, color, w, dash) => {
        if (gl.getSource(id)) gl.getSource(id).setData(data);
        else {
          gl.addSource(id, { type: 'geojson', data });
          const before = (gl.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
          gl.addLayer({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, w * 0.6, 17, w * 1.8], 'line-opacity': dash ? 0.7 : 0.95, ...(dash ? { 'line-dasharray': dash } : {}) } }, before);
        }
      };
      up('jg-exp-no', r.no, '#F97316', 3, [1.2, 1]);
      up('jg-exp-yes', r.yes, '#1F6BFF', 4);
      this.panel(r);
    };
    this._mv = () => { clearTimeout(this._t); this._t = setTimeout(run, 350); };
    m.on('moveend', this._mv);
    if (m.getZoom() < 14) m.setZoom(14.5); else run();
    setTimeout(run, 1200);
  },

  panel(r) {
    let el = $('#expPanel');
    if (!r) { if (el) el.remove(); return; }
    if (!el) { const w = $('.map-wrap'); if (!w) return; el = document.createElement('div'); el.id = 'expPanel'; el.className = 'exp-panel'; w.appendChild(el); }
    el.innerHTML = r.far ? `${I('search', 'xs')} Aproxime o mapa para ver as ruas que você já percorreu`
      : `<div class="exp-ring" style="--p:${r.pct.toFixed(1)}"><b class="num">${Math.round(r.pct)}%</b></div><div class="grow"><b>das ruas desta área</b><small>${Fmt.num(r.km)} de ${Fmt.num(r.total)} km · <i class="dot y"></i>já feitas <i class="dot n"></i>nunca</small></div>`;
  },
};
