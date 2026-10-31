/* =========================================================
   JustGo — RITMO CORRIGIDO (relevo + clima)
   "Quanto valeria esse treino no plano, num dia fresco?"
   - Relevo: fator de esforço por inclinação (curva empírica de
     corredores, mesmo princípio do "GAP" dos relógios de corrida).
   - Calor: regra temperatura + ponto de orvalho (°F) usada por
     treinadores de corrida para descontar o efeito do calor úmido.
   - Pedal: velocidade que a mesma potência média daria no plano.
   ========================================================= */
const Adjust = {
  dew(T, RH) { const a = 17.62, b = 243.12, g = Math.log(Math.max(1, RH) / 100) + (a * T) / (b + T); return (b * g) / (a - g); },
  // % de ritmo perdido pelo calor (0 = dia fresco)
  heatPct(T, RH) {
    if (T == null || !isFinite(T)) return 0;
    const Td = RH != null ? this.dew(T, RH) : T - 8, sum = T * 1.8 + 32 + (Td * 1.8 + 32);
    const tab = [[100, 0], [110, 0.5], [120, 1], [130, 2], [140, 3], [150, 4.5], [160, 6], [170, 8], [180, 10], [200, 12]];
    if (sum <= 100) return 0;
    for (let i = 1; i < tab.length; i++) if (sum <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + ((y1 - y0) * (sum - x0)) / (x1 - x0); }
    return 12;
  },
  // fator de esforço por inclinação (%), curva empírica de corredores (estilo GAP):
  // +5% ≈ 1,15 · +10% ≈ 1,37 · −9% ≈ 0,89 (descida que mais ajuda) · −20% ≈ 1,04 (descida forte freia)
  gradeF(g) { g = Math.max(-25, Math.min(25, g)); return 1 + 0.024 * g + 0.0013 * g * g; },
  compute(act) {
    if (!act || !act.points || act.points.length < 10 || typeof Pro === 'undefined') return null;
    const sp = act.sport, cfg = CONFIG.sports[sp] || {};
    let R; try { R = Pro.analyze(act); } catch (e) { return null; }
    const B = R._blocks; if (!B || B.length < 3) return null;
    const W = act.weather || {}, T = W.temp, RH = W.hum;
    let d = 0, t = 0; B.forEach((b) => { d += b.d; t += b.dt; });
    if (!t || !d) return null;
    const real = d / t;
    if (cfg.foot) {
      let deq = 0;
      B.forEach((b) => { deq += b.d * this.gradeF(b.g * 100); });
      const gap = deq / t, heat = this.heatPct(T, RH), adj = gap * (1 + heat / 100);
      return { kind: 'pace', real, gap, adj, heat, T, RH, elevSrc: act.altSrc };
    }
    if (sp === 'ride' && R.pAvg) {
      const bk = R._bike, M = (R._W || 70) + bk.weight, P = R.pAvg * 0.976, f = (v) => M * 9.81 * bk.crr * v + 0.5 * 1.2 * bk.cda * v ** 3 - P;
      let lo = 0.5, hi = 30; for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
      return { kind: 'speed', real, gap: lo, adj: lo, heat: 0, T, RH, elevSrc: act.altSrc };
    }
    return null;
  },
  // diferença em segundos por km (positivo = as condições te atrasaram)
  sPerKm(vSlow, vFast) { return vSlow > 0 && vFast > 0 ? 1000 / vSlow - 1000 / vFast : 0; },
};
