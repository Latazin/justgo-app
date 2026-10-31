/* =========================================================
   JustGo — ELEVAÇÃO PELO RELEVO REAL
   A altitude do GPS do celular erra 10–30 m e "pula" o tempo
   todo, o que inventa subida. Como o Strava faz com celulares,
   trocamos pela altitude do terreno (modelo digital de elevação
   da AWS/Mapzen, o mesmo do 3D: grátis e sem chave).
   ========================================================= */
const Elev = {
  URL: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  Z: 14, // ~10 m por pixel no Brasil
  tiles: new Map(),

  tile(x, y) {
    const k = `${x}/${y}`;
    if (!this.tiles.has(k)) {
      if (this.tiles.size > 60) this.tiles.delete(this.tiles.keys().next().value);
      this.tiles.set(k, (async () => {
        const r = await fetch(this.URL.replace('{z}', this.Z).replace('{x}', x).replace('{y}', y), { mode: 'cors' });
        if (!r.ok) throw new Error('dem ' + r.status);
        const bmp = await createImageBitmap(await r.blob());
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, 256, 256).data;
      })().catch((e) => { this.tiles.delete(k); throw e; }));
    }
    return this.tiles.get(k);
  },
  // posição em pixels globais do zoom Z
  px(lat, lng) {
    const n = 256 * 2 ** this.Z, s = Math.sin((lat * Math.PI) / 180);
    return [((lng + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  },
  async at(lat, lng) {
    const [X, Y] = this.px(lat, lng), x0 = Math.floor(X - 0.5), y0 = Math.floor(Y - 0.5), fx = X - 0.5 - x0, fy = Y - 0.5 - y0;
    const h = async (gx, gy) => {
      const d = await this.tile(Math.floor(gx / 256), Math.floor(gy / 256)), i = (((gy % 256) + 256) % 256) * 256 + (((gx % 256) + 256) % 256);
      return d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    };
    const [a, b, c, d] = await Promise.all([h(x0, y0), h(x0 + 1, y0), h(x0, y0 + 1), h(x0 + 1, y0 + 1)]);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy; // bilinear
  },

  // troca a altitude de cada ponto do treino pela do terreno. Devolve true se mudou.
  async apply(act) {
    const P = act.points;
    if (!P || P.length < 2 || act.altSrc === 'dem' || act.mode === 'pool') return false;
    // amostra ~1 ponto a cada 15 m e interpola o resto (bem menos consultas)
    const idx = [0]; let acc = 0;
    for (let i = 1; i < P.length; i++) { acc += P[i][4] ? 0 : Geo.dist(P[i - 1], P[i]); if (acc >= 15 || i === P.length - 1) { idx.push(i); acc = 0; } }
    const val = [];
    for (let k = 0; k < idx.length; k += 40) {
      const part = await Promise.all(idx.slice(k, k + 40).map((i) => this.at(P[i][0], P[i][1])));
      val.push(...part);
    }
    if (val.some((v) => !isFinite(v) || v < -500 || v > 9000)) return false;
    if (act.gpsAlt == null) act.gpsAlt = Geo.elevationGain(P); // guarda o valor antigo, só para referência
    for (let k = 0; k < idx.length - 1; k++) {
      const i0 = idx[k], i1 = idx[k + 1], a = val[k], b = val[k + 1];
      for (let i = i0; i <= i1; i++) { const f = i1 === i0 ? 0 : (i - i0) / (i1 - i0); P[i][3] = Math.round((a + (b - a) * f) * 10) / 10; }
    }
    act.altSrc = 'dem';
    return true;
  },
};
