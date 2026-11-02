/* =========================================================
   JustGo — SEU ATLETA (avatar opcional)
   Um personagem que evolui com os treinos de VERDADE:
   - 4 atributos (Velocidade, Resistência, Força, Constância)
     calculados dos treinos — não dá para comprar
   - humor pelo último treino (animado → no sofá com saudade)
   - 5 estágios de evolução pelo nível
   - itens comprados com moedas ou conquistados
   Tudo desenhado em vetor (SVG), no celular, sem custo.
   ========================================================= */
const Avatar = {
  SKIN: ['#FDDCC4', '#F2C29B', '#D9A066', '#B9774A', '#8D5524', '#5C3A1E'],
  HAIRC: ['#1F1A17', '#4A2C1A', '#8B5A2B', '#D4A55A', '#B23A1F', '#9CA3AF'],
  // 6 masculinos e 6 femininos
  HAIR: [['curto', 'Social', 'm'], ['topete', 'Topete', 'm'], ['degrade', 'Degradê', 'm'], ['raspado', 'Raspado', 'm'], ['cacheado', 'Black power', 'm'], ['careca', 'Careca', 'm'],
    ['longo', 'Longo liso', 'f'], ['rabo', 'Rabo de cavalo', 'f'], ['coque', 'Coque', 'f'], ['cachos', 'Cacheado', 'f'], ['trancas', 'Tranças', 'f'], ['chanel', 'Chanel', 'f']],
  STAGES: [[1, 'Iniciante'], [5, 'Atleta de bairro'], [15, 'Veterano'], [30, 'Elite'], [50, 'Lenda']],
  ATTR: [
    ['vel', 'Velocidade', 'zap', '#1F6BFF', 'Sobe quando seu ritmo melhora (usamos o ritmo corrigido pelo relevo e calor).'],
    ['res', 'Resistência', 'shield', '#12B886', 'Sobe com os km das últimas 4 semanas (cada esporte tem seu peso).'],
    ['for', 'Força', 'mountain', '#F97316', 'Sobe com a subida acumulada nos últimos 60 dias.'],
    ['con', 'Constância', 'flame', '#EF4444', 'Sobe com dias ativos nas últimas 4 semanas e dias seguidos.'],
  ],
  // itens: [id, cat, nome, valor/cor, preço (0 = grátis), condição especial]
  ITEMS: [
    ['tee_blue', 'top', 'Camiseta azul', { c: '#1F6BFF' }, 0], ['tee_white', 'top', 'Camiseta branca', { c: '#F8FAFC' }, 0], ['tee_black', 'top', 'Camiseta preta', { c: '#1F2937' }, 0], ['tee_red', 'top', 'Camiseta vermelha', { c: '#EF4444' }, 0],
    ['tank_neon', 'top', 'Regata neon', { c: '#A3E635', tank: 1 }, 60], ['tee_stripe', 'top', 'Listrada', { c: '#0EA5E9', stripe: '#fff' }, 120], ['jersey', 'top', 'Camisa de ciclismo', { c: '#F59E0B', stripe: '#1F2937', jersey: 1 }, 150],
    ['tee_retro', 'top', 'Camiseta da Retrospectiva', { c: '#7C3AED', stripe: '#F472B6' }, 0, 'retro'], ['tee_torch', 'top', 'Camiseta da Tocha', { c: '#F97316', stripe: '#FDE68A' }, 0, 'torch'],
    ['tee_elite', 'top', 'Uniforme Elite', { c: '#1E3A8A', stripe: '#FBBF24' }, 0, 'stage4'], ['tee_legend', 'top', 'Uniforme Lenda', { c: '#F59E0B', stripe: '#FFFBEB', gold: 1 }, 0, 'stage5'],
    ['sh_black', 'bottom', 'Short preto', { c: '#111827' }, 0], ['sh_navy', 'bottom', 'Short marinho', { c: '#1E3A8A' }, 0], ['sh_red', 'bottom', 'Short vermelho', { c: '#DC2626' }, 50], ['tights', 'bottom', 'Legging', { c: '#111827', long: 1 }, 80], ['bib', 'bottom', 'Bermuda de ciclismo', { c: '#0F172A', long: 0.75 }, 120],
    ['shoe_white', 'shoes', 'Tênis branco', { c: '#F8FAFC' }, 0], ['shoe_blue', 'shoes', 'Tênis azul', { c: '#1F6BFF' }, 0], ['shoe_neon', 'shoes', 'Tênis neon', { c: '#A3E635' }, 70], ['shoe_red', 'shoes', 'Tênis vermelho', { c: '#EF4444' }, 70], ['shoe_gold', 'shoes', 'Tênis dourado', { c: '#FBBF24' }, 0, 'stage5'],
    ['hat_none', 'hat', 'Nada', {}, 0], ['cap', 'hat', 'Boné', { c: '#1F6BFF' }, 40], ['band', 'hat', 'Faixa', { c: '#EF4444' }, 40], ['visor', 'hat', 'Viseira', { c: '#F8FAFC' }, 90], ['helmet', 'hat', 'Capacete', { c: '#12B886' }, 100], ['crown', 'hat', 'Coroa do Bairro', { c: '#FBBF24' }, 0, 'zones'],
    ['gl_none', 'glasses', 'Nada', {}, 0], ['gl_sport', 'glasses', 'Óculos esportivo', { c: '#22D3EE' }, 60], ['gl_sun', 'glasses', 'Óculos escuro', { c: '#111827' }, 80],
    ['acc_none', 'acc', 'Nada', {}, 0], ['watch', 'acc', 'Relógio', { c: '#111827' }, 0, 'stage3'], ['medal', 'acc', 'Medalha', { c: '#FBBF24' }, 0, 'acts10'], ['torch', 'acc', 'Tocha na mão', { c: '#F97316' }, 0, 'torch'], ['cape', 'acc', 'Capa de montanhista', { c: '#DC2626' }, 0, 'force60'],
    ['tr_none', 'trail', 'Nada', {}, 0], ['tr_wind', 'trail', 'Rastro de vento', { c: '#93C5FD' }, 0, 'vel40'], ['tr_fire', 'trail', 'Rastro de fogo', { c: '#F97316' }, 200], ['tr_bolt', 'trail', 'Raio', { c: '#FACC15' }, 300], ['tr_rainbow', 'trail', 'Arco-íris', {}, 400], ['tr_gold', 'trail', 'Brilho dourado', { c: '#FBBF24' }, 0, 'stage5'],
  ],
  CATS: [['top', 'Camiseta'], ['bottom', 'Short'], ['shoes', 'Tênis'], ['hat', 'Cabeça'], ['glasses', 'Óculos'], ['acc', 'Acessório'], ['trail', 'Rastro']],
  COND: {
    retro: ['Gere uma Retrospectiva do mês', () => !!(Store.data.retro && Object.keys(Store.data.retro).length)],
    torch: ['Passe a Tocha 3 vezes', () => (Store.data.torchPasses || 0) >= 3],
    zones: ['Domine 3 áreas no mapa', () => Zones.mine().length >= 3],
    acts10: ['Complete 10 treinos', () => Store.data.activities.filter((a) => !a.flagged).length >= 10],
    stage3: ['Chegue ao estágio Veterano (nível 15)', () => Avatar.stage().i >= 2],
    stage4: ['Chegue ao estágio Elite (nível 30)', () => Avatar.stage().i >= 3],
    stage5: ['Chegue ao estágio Lenda (nível 50)', () => Avatar.stage().i >= 4],
    force60: ['Força 60 ou mais', () => Avatar.stats().for >= 60],
    vel40: ['Velocidade 40 ou mais', () => Avatar.stats().vel >= 40],
  },

  /* ---------- estado ---------- */
  on() { const a = Store.data.avatar; return !!(a && a.on); },
  cfg() { return Store.data.avatar || this.defaults(); },
  defaults() { return { on: false, skin: 1, hair: 'curto', hairC: 0, beard: false, eq: { top: 'tee_blue', bottom: 'sh_black', shoes: 'shoe_white', hat: 'hat_none', glasses: 'gl_none', acc: 'acc_none', trail: 'tr_none' }, own: {} }; },
  item(id) { const r = this.ITEMS.find((x) => x[0] === id); return r ? { id: r[0], cat: r[1], name: r[2], v: r[3], price: r[4], cond: r[5] } : null; },
  has(id) { const it = this.item(id); if (!it) return false; if (it.cond) return !!(this.COND[it.cond] && this.COND[it.cond][1]()); return it.price === 0 || !!(this.cfg().own || {})[id]; },
  v(cfg, cat) { const it = this.item((cfg.eq || {})[cat]); return it ? it.v : {}; },

  stage() {
    const lv = Game.level(Store.data.xp); let i = 0; this.STAGES.forEach(([m], k) => { if (lv >= m) i = k; });
    const next = this.STAGES[i + 1];
    return { i, name: this.STAGES[i][1], lv, next: next ? next[0] : null, nextName: next ? next[1] : null, pct: next ? Math.min(100, ((lv - this.STAGES[i][0]) / (next[0] - this.STAGES[i][0])) * 100) : 100 };
  },

  // atributos 1–100 calculados dos treinos reais (guardados enquanto nada muda)
  stats() {
    const A = Store.data.activities.filter((a) => !a.flagged && a.mode !== 'sim'), sig = A.length + ':' + (A[A.length - 1] ? A[A.length - 1].id + A[A.length - 1].distance : '') + ':' + new Date().toDateString();
    if (this._st && this._st.sig === sig) return this._st.v;
    const now = Date.now(), d28 = A.filter((a) => a.start > now - 28 * 864e5), d60 = A.filter((a) => a.start > now - 60 * 864e5);
    const cl = (x) => Math.max(0, Math.min(1, x));
    let vs = 0;
    d60.forEach((a) => {
      if (!a.duration || !a.distance) return;
      let v = a.distance / a.duration;
      try { const J = a.points && a.points.length > 10 && Adjust.compute(a); if (J && J.adj) v = J.adj; } catch (e) {}
      const sp = a.sport; let s;
      if (sp === 'run') s = (v - 1.9) / (5.5 - 1.9);
      else if (sp === 'walk' || sp === 'hike') s = ((v - 1.0) / (2.2 - 1.0)) * 0.6;
      else if (sp === 'ride') s = (v * 3.6 - 12) / (40 - 12);
      else if (sp === 'swim') s = (v - 0.4) / (1.6 - 0.4);
      else s = ((v * 3.6 - 8) / (30 - 8)) * 0.8;
      vs = Math.max(vs, cl(s));
    });
    const W = { run: 1, walk: 0.7, hike: 1.2, ride: 0.33, swim: 4, skate: 0.4, board: 0.35, paddle: 1 };
    const eq = d28.reduce((s, a) => s + (a.distance / 1000) * (W[a.sport] || 0.5), 0);
    const climb = d60.reduce((s, a) => s + (a.points && a.points.length > 1 ? Geo.elevationGain(a.points) : 0), 0);
    const days = new Set(d28.map((a) => new Date(a.start).toDateString())).size, streak = Game.streakDays ? Game.streakDays(false) : 0;
    const v = {
      vel: A.length ? Math.round(1 + 99 * Math.pow(vs, 0.9)) : 1,
      res: Math.max(1, Math.round(100 * Math.sqrt(cl(eq / 160)))),
      for: Math.max(1, Math.round(100 * Math.sqrt(cl(climb / 2500)))),
      con: Math.max(1, Math.round(100 * cl((days / 18) * 0.8 + (streak / 14) * 0.2))),
    };
    v.pow = Math.round((v.vel + v.res + v.for + v.con) / 4);
    this._st = { sig, v }; return v;
  },

  // humor pelo último treino
  mood() {
    const A = Store.data.activities.filter((a) => a.mode !== 'sim'); if (!A.length) return { k: 'wait', days: null };
    const sorted = [...A].sort((x, y) => y.start - x.start), last = sorted[0];
    const day = (t) => new Date(new Date(t).toDateString()).getTime(), days = Math.round((day(Date.now()) - day(last.start)) / 864e5);
    const prev = sorted[1], gap = prev ? Math.round((day(last.start) - day(prev.start)) / 864e5) : 99;
    const cfg = Store.data.avatar;
    if (days === 0 && gap >= 3 && cfg && cfg.cheered !== last.id) return { k: 'cheer', days, act: last.id };
    return { k: days === 0 ? 'happy' : days === 1 ? 'ok' : days <= 3 ? 'wait' : 'sofa', days };
  },
  line(m) {
    const P = (Store.data.profile.name || '').split(' ')[0] || 'atleta', d = new Date().getDate();
    const L = {
      cheer: ['VOLTAMOS!! 🎉 Que saudade de treinar com você!', 'Eu sabia que você voltava! Bora manter o ritmo? 🔥'],
      happy: ['Que treino! Bora de novo amanhã? 💪', 'Tô voando hoje! Valeu, ' + P + '!', 'Mais forte a cada treino. Sente isso? ⚡'],
      ok: ['Descansado e pronto pra próxima!', 'Recuperado! Hoje rola um treino?'],
      wait: ['Tô aqui te esperando… bora uma volta? 👟', 'Já separei o tênis. Só falta você!'],
      sofa: [`Tô no sofá há ${m.days} dias 😴 Uma volta curtinha?`, `${m.days} dias sem treino… meus músculos tão com saudade 🥲`],
    }[m.k] || ['Bora treinar?'];
    return L[d % L.length];
  },

  /* =========================================================
     DESENHO (SVG) — viewBox 200×240, chão em y≈220
     ========================================================= */
  POSES: {
    stand: { hd: [100, 56], nk: [100, 98], hp: [100, 146], sL: [84, 104], sR: [116, 104], eL: [77, 128], eR: [123, 128], hL: [80, 151], hR: [120, 151], pL: [92, 152], pR: [108, 152], kL: [90, 184], kR: [110, 184], fL: [88, 213], fR: [112, 213] },
    runA: { hd: [104, 56], nk: [103, 98], hp: [100, 146], sL: [87, 104], sR: [119, 104], eL: [73, 118], eR: [131, 127], hL: [70, 97], hR: [141, 147], pL: [93, 152], pR: [108, 152], kL: [79, 177], kR: [117, 175], fL: [63, 196], fR: [122, 210] },
    runB: { hd: [104, 54], nk: [103, 96], hp: [100, 144], sL: [87, 102], sR: [119, 102], eL: [77, 127], eR: [129, 115], hL: [66, 144], hR: [137, 93], pL: [93, 150], pR: [108, 150], kL: [97, 181], kR: [121, 168], fL: [92, 211], fR: [138, 188] },
    cheer: { hd: [100, 50], nk: [100, 92], hp: [100, 140], sL: [84, 98], sR: [116, 98], eL: [70, 78], eR: [130, 78], hL: [64, 54], hR: [136, 54], pL: [92, 146], pR: [108, 146], kL: [86, 176], kR: [114, 176], fL: [82, 204], fR: [118, 204] },
    sofa: { hd: [100, 88], nk: [100, 128], hp: [100, 170], sL: [84, 134], sR: [116, 134], eL: [79, 156], eR: [121, 156], hL: [92, 174], hR: [108, 174], pL: [92, 176], pR: [108, 176], kL: [88, 192], kR: [112, 192], fL: [86, 216], fR: [114, 216] },
    ride: { hd: [128, 76], nk: [120, 108], hp: [90, 146], sL: [113, 110], sR: [125, 112], eL: [127, 126], eR: [135, 128], hL: [140, 138], hR: [146, 140], pL: [88, 150], pR: [92, 150], kL: [108, 168], kR: [100, 174], fL: [101, 198], fR: [110, 206] },
  },

  svg(cfg, o = {}) {
    cfg = cfg || this.cfg(); const st = o.stats || this.stats(), sg = o.stage != null ? o.stage : this.stage().i;
    const mood = o.mood || 'happy', pose = o.pose || 'stand', w = o.w || 200, uid = 'a' + Math.random().toString(36).slice(2, 7);
    const frames = pose === 'run' ? (o.still ? ['runA'] : ['runA', 'runB']) : [pose];
    const vb = o.portrait ? '50 18 100 100' : '0 0 200 240';
    const trail = this.v(cfg, 'trail'), trailId = (cfg.eq || {}).trail;
    let back = '';
    // aura de estágio e efeitos de atributo (atrás do corpo)
    if (!o.portrait) {
      back += `<ellipse cx="100" cy="${pose === 'sofa' ? 222 : 220}" rx="${pose === 'ride' ? 70 : 34}" ry="6" fill="#0B1220" opacity=".14"/>`;
      if (sg >= 3) back += `<defs><radialGradient id="${uid}au"><stop offset="0" stop-color="${sg >= 4 ? '#FBBF24' : '#60A5FA'}" stop-opacity=".55"/><stop offset="1" stop-color="${sg >= 4 ? '#FBBF24' : '#60A5FA'}" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="120" r="96" fill="url(#${uid}au)" class="av-aura"/>`;
      if (sg >= 4 || trailId === 'tr_gold') back += [[40, 60], [160, 70], [30, 150], [170, 160], [60, 30], [146, 34]].map(([x, y], i) => `<path class="av-spark" style="animation-delay:${i * 0.3}s" d="M${x} ${y - 6}l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#FDE68A"/>`).join('');
      back += this.trail(trailId, trail, pose, st, uid);
    }
    const body = frames.map((f, i) => `<g class="av-f av-f${i}">${this.figure(cfg, this.POSES[f], st, sg, mood, f, uid)}</g>`).join('');
    const extra = pose === 'sofa' && !o.portrait ? this.couch() : '';
    const bike = pose === 'ride' && !o.portrait ? this.bike() : '';
    const zz = mood === 'sofa' && !o.portrait ? `<g class="av-zz" fill="#64748B" font-family="Inter, sans-serif" font-weight="800"><text x="132" y="70" font-size="16">z</text><text x="146" y="54" font-size="20">z</text><text x="162" y="36" font-size="24">Z</text></g>` : '';
    return `<svg class="av-svg av-${pose} ${frames.length > 1 ? 'av-anim' : ''} ${o.cls || ''}" viewBox="${vb}" width="${w}" height="${o.portrait ? w : Math.round((w * 240) / 200)}" xmlns="http://www.w3.org/2000/svg">${back}${extra}${bike}${body}${zz}</svg>`;
  },

  trail(id, t, pose, st, uid) {
    if (pose === 'sofa') return '';
    const x0 = pose === 'ride' ? 20 : 30;
    if (id === 'tr_wind' || (id === 'tr_none' && st.vel >= 50 && (pose === 'run' || pose === 'ride'))) return `<g stroke="${t.c || '#93C5FD'}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75" class="av-trail"><path d="M${x0} 110 h34"/><path d="M${x0 - 10} 132 h44"/><path d="M${x0} 154 h30"/></g>`;
    if (id === 'tr_fire') return `<defs><linearGradient id="${uid}fi" x1="1" x2="0"><stop offset="0" stop-color="#FDE047"/><stop offset=".5" stop-color="#F97316"/><stop offset="1" stop-color="#DC2626" stop-opacity="0"/></linearGradient></defs><g class="av-trail" fill="url(#${uid}fi)"><path d="M78 130 C60 110 40 120 14 104 C36 128 30 140 10 152 C40 150 58 156 78 150 Z"/><path d="M80 176 C62 166 44 176 22 166 C40 182 36 190 20 200 C46 196 62 196 82 190 Z" opacity=".8"/></g>`;
    if (id === 'tr_bolt') return `<g class="av-trail" fill="#FACC15" stroke="#CA8A04" stroke-width="1.5"><path d="M64 96 L40 128 L56 128 L34 166 L72 120 L56 120 Z"/></g>`;
    if (id === 'tr_rainbow') return `<g class="av-trail" fill="none" stroke-width="6" stroke-linecap="round" opacity=".85">${['#EF4444', '#F59E0B', '#FACC15', '#22C55E', '#3B82F6', '#8B5CF6'].map((c, i) => `<path d="M80 ${118 + i * 6} C56 ${112 + i * 6} 36 ${126 + i * 6} 8 ${118 + i * 6}" stroke="${c}"/>`).join('')}</g>`;
    if (id === 'tr_gold') return `<g class="av-trail" fill="none" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M30 112h36M18 134h48M30 156h32"/></g>`;
    return '';
  },
  couch() { return `<g><rect x="38" y="138" width="124" height="66" rx="18" fill="#7C8DB5"/><rect x="30" y="150" width="26" height="58" rx="12" fill="#6B7BA4"/><rect x="144" y="150" width="26" height="58" rx="12" fill="#6B7BA4"/><rect x="54" y="176" width="92" height="30" rx="10" fill="#93A3C8"/><rect x="44" y="204" width="8" height="12" rx="3" fill="#475569"/><rect x="148" y="204" width="8" height="12" rx="3" fill="#475569"/></g>`; },
  bike() { return `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="200" r="24" stroke="#1F2937" stroke-width="5"/><circle cx="152" cy="200" r="24" stroke="#1F2937" stroke-width="5"/><circle cx="50" cy="200" r="3" fill="#1F2937"/><circle cx="152" cy="200" r="3" fill="#1F2937"/><path d="M50 200 L84 152 L140 146 L152 200 M84 152 L104 202 L140 146 M104 202 L50 200" stroke="#1F6BFF" stroke-width="5"/><path d="M76 148 h18" stroke="#111827" stroke-width="6"/><path d="M138 142 l10 -6 h8" stroke="#111827" stroke-width="5"/><circle cx="104" cy="202" r="6" stroke="#374151" stroke-width="3"/></g>`; },

  figure(cfg, J, st, sg, mood, pose, uid) {
    const skin = this.SKIN[cfg.skin] || this.SKIN[1], top = this.v(cfg, 'top'), bot = this.v(cfg, 'bottom'), sh = this.v(cfg, 'shoes');
    const acc = (cfg.eq || {}).acc, strong = st.for >= 60 ? 2.5 : 0;
    const L = (a, b, c, wd, extra = '') => `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" ${extra}/>`;
    const mid = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    const dark = (c) => this.shade(c, -0.18);
    const leg = (p, k, f, behind) => {
      const s = behind ? dark : (x) => x, full = bot.long >= 1;
      let g = L(p, k, s(skin), 15 + strong) + L(k, f, s(full ? bot.c : skin), 13 + strong * 0.6);
      g += L(p, bot.long ? k : mid(p, k, 0.62), s(bot.c || '#111'), 17 + strong); // short / bermuda / legging
      const dx = f[0] >= p[0] ? 5 : -5;
      g += `<ellipse cx="${f[0] + dx}" cy="${f[1] + 2}" rx="11" ry="6.5" fill="${s(sh.c || '#fff')}" stroke="${dark(sh.c || '#ddd')}" stroke-width="1.5"/>`;
      return g;
    };
    const arm = (s, e, h, behind) => {
      const sd = behind ? dark : (x) => x;
      let g = L(s, e, sd(skin), 12 + strong) + L(e, h, sd(skin), 11 + strong * 0.6) + `<circle cx="${h[0]}" cy="${h[1]}" r="${6.5 + strong * 0.3}" fill="${sd(skin)}"/>`;
      if (!top.tank) g += L(s, mid(s, e, 0.5), sd(top.c || '#1F6BFF'), 15 + strong);
      return g;
    };
    const backSide = pose === 'ride' || pose === 'runA' ? ['R', 'L'] : ['L', 'R'];
    let g = '';
    // capa atrás
    if (acc === 'cape' && pose !== 'sofa') g += `<path d="M${J.sL[0] - 4} ${J.sL[1] - 4} Q ${J.hp[0] - 26} ${J.hp[1] + 20} ${J.hp[0] - 34} ${J.hp[1] + 44} L ${J.hp[0] + 30} ${J.hp[1] + 40} Q ${J.hp[0] + 24} ${J.hp[1]} ${J.sR[0] + 4} ${J.sR[1] - 4} Z" fill="#DC2626" stroke="#991B1B" stroke-width="1.5"/>`;
    // cabelo longo atrás da cabeça
    const [hx, hy] = J.hd, hc = this.HAIRC[cfg.hairC] || this.HAIRC[0];
    const hatOn = (cfg.eq || {}).hat && (cfg.eq || {}).hat !== 'hat_none';
    g += this.hairBack(cfg.hair, hx, hy, hc, hatOn);
    // membros de trás
    g += leg(J['p' + backSide[0]], J['k' + backSide[0]], J['f' + backSide[0]], true);
    g += arm(J['s' + backSide[0]], J['e' + backSide[0]], J['h' + backSide[0]], true);
    // tronco (cápsula)
    const tc = top.c || '#1F6BFF';
    g += L([J.pL[0], J.pL[1] - 2], [J.pR[0], J.pR[1] - 2], bot.c || '#111', 24 + strong); // quadril (short)
    const ht = [J.hp[0] + (J.nk[0] - J.hp[0]) * 0.12, J.hp[1] + (J.nk[1] - J.hp[1]) * 0.12];
    g += L(J.nk, ht, tc, 42 + strong * 1.2);
    if (top.tank) g += `<path d="M${J.nk[0] - 8} ${J.nk[1] - 18} q 8 8 16 0" stroke="${skin}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    const cx = (J.nk[0] + J.hp[0]) / 2, cy = (J.nk[1] + J.hp[1]) / 2;
    if (top.stripe) g += `<g stroke="${top.stripe}" stroke-width="4" stroke-linecap="round">${top.jersey ? `<path d="M${cx - 14} ${cy - 10} L${cx + 14} ${cy - 10}"/>` : `<path d="M${cx - 15} ${cy - 8} L${cx + 15} ${cy - 8}"/><path d="M${cx - 15} ${cy + 2} L${cx + 15} ${cy + 2}"/>`}</g>`;
    if (top.gold) g += `<path d="M${cx} ${cy - 12} l3.5 7 7.7 1.1 -5.6 5.4 1.3 7.6 -6.9 -3.6 -6.9 3.6 1.3 -7.6 -5.6 -5.4 7.7 -1.1z" fill="#FFFBEB"/>`;
    else if (sg >= 1 && !top.stripe) g += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="900" font-style="italic" fill="${this.lum(tc) > 0.6 ? '#1F6BFF' : '#fff'}" opacity=".9">JG</text>`;
    if (st.con >= 50) g += `<path d="M${cx + 10} ${cy + 8} c -4 -6 2 -8 0 -14 c 6 4 8 10 4 14 z" fill="#F97316" stroke="#FDE68A" stroke-width="1"/>`;
    if (acc === 'medal') g += `<path d="M${cx - 7} ${cy - 18} L${cx} ${cy - 2} L${cx + 7} ${cy - 18}" stroke="#1F6BFF" stroke-width="3" fill="none"/><circle cx="${cx}" cy="${cy + 2}" r="6" fill="#FBBF24" stroke="#B45309" stroke-width="1.5"/>`;
    // membros da frente
    g += leg(J['p' + backSide[1]], J['k' + backSide[1]], J['f' + backSide[1]], false);
    g += arm(J['s' + backSide[1]], J['e' + backSide[1]], J['h' + backSide[1]], false);
    const hf = J['h' + backSide[1]];
    if (acc === 'watch') g += `<rect x="${J.hL[0] - 6}" y="${J.hL[1] - 12}" width="12" height="8" rx="2" fill="#111827" stroke="#22D3EE" stroke-width="1.5"/>`;
    if (acc === 'torch') g += `<path d="M${hf[0]} ${hf[1]} L${hf[0] + 4} ${hf[1] - 22}" stroke="#78350F" stroke-width="5" stroke-linecap="round"/><path class="av-flame" d="M${hf[0] + 4} ${hf[1] - 22} c -10 -8 -2 -16 0 -24 c 4 8 12 12 4 24 z" fill="#F97316" stroke="#FDE047" stroke-width="2"/>`;
    // cabeça
    g += L(J.nk, [hx, hy + 20], skin, 13);
    g += `<circle cx="${hx - 26}" cy="${hy + 4}" r="5" fill="${skin}"/><circle cx="${hx + 26}" cy="${hy + 4}" r="5" fill="${skin}"/>`;
    g += `<circle cx="${hx}" cy="${hy}" r="27" fill="${skin}"/>`;
    g += this.hair(cfg.hair, hx, hy, hc, hatOn);
    if (cfg.beard) g += `<path d="M${hx - 22} ${hy + 6} Q ${hx - 20} ${hy + 30} ${hx} ${hy + 30} Q ${hx + 20} ${hy + 30} ${hx + 22} ${hy + 6} Q ${hx + 14} ${hy + 20} ${hx} ${hy + 20} Q ${hx - 14} ${hy + 20} ${hx - 22} ${hy + 6} Z" fill="${hc}" opacity=".92"/>`;
    g += this.face(mood, hx, hy, cfg.beard);
    g += this.hat((cfg.eq || {}).hat, this.v(cfg, 'hat'), hx, hy);
    g += this.glasses((cfg.eq || {}).glasses, this.v(cfg, 'glasses'), hx, hy);
    return g;
  },
  // calota de cabelo: cobre o alto da cabeça, desce nas laterais e marca a linha da testa
  cap(x, y, c, top = -34, line = -12, side = 6, op = 1) {
    return `<path d="M${x - 28} ${y + side} C ${x - 32} ${y - 18} ${x - 19} ${y + top} ${x} ${y + top} C ${x + 19} ${y + top} ${x + 32} ${y - 18} ${x + 28} ${y + side} L ${x + 24} ${y + side} C ${x + 24} ${y - 4} ${x + 15} ${y + line} ${x} ${y + line} C ${x - 15} ${y + line} ${x - 24} ${y - 4} ${x - 24} ${y + side} Z" fill="${c}" ${op < 1 ? `opacity="${op}"` : ''}/>`;
  },
  shine(x, y, c) { return `<path d="M${x - 14} ${y - 24} q 10 -7 22 -4" stroke="${this.shade(c, 0.35)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`; },
  curls(pts, c, r) { return `<g fill="${c}">${pts.map(([px, py, rr]) => `<circle cx="${px}" cy="${py}" r="${rr || r}"/>`).join('')}</g>`; },
  // parte de trás (desenhada atrás da cabeça e do corpo)
  hairBack(h, x, y, c, hat) {
    const d = this.shade(c, -0.12);
    switch (h) {
      case 'longo': return `<path d="M${x - 30} ${y - 6} C ${x - 37} ${y + 26} ${x - 32} ${y + 50} ${x - 22} ${y + 58} L ${x + 22} ${y + 58} C ${x + 32} ${y + 50} ${x + 37} ${y + 26} ${x + 30} ${y - 6} Z" fill="${d}"/>`;
      case 'chanel': return `<path d="M${x - 31} ${y - 6} C ${x - 35} ${y + 14} ${x - 32} ${y + 26} ${x - 25} ${y + 30} L ${x + 25} ${y + 30} C ${x + 32} ${y + 26} ${x + 35} ${y + 14} ${x + 31} ${y - 6} Z" fill="${d}"/>`;
      case 'rabo': return `<path d="M${x + 18} ${y - 22} C ${x + 46} ${y - 22} ${x + 48} ${y + 18} ${x + 34} ${y + 46} C ${x + 33} ${y + 24} ${x + 28} ${y + 2} ${x + 14} ${y - 10} Z" fill="${d}"/><circle cx="${x + 24}" cy="${y - 17}" r="4.5" fill="#F472B6"/>`;
      case 'trancas': {
        let g = '';
        [-1, 1].forEach((s) => { for (let i = 0; i < 6; i++) g += `<ellipse cx="${x + s * (25 + i * 0.6)}" cy="${y + 4 + i * 9}" rx="6" ry="6.5" fill="${i % 2 ? c : d}"/>`; g += `<circle cx="${x + s * 28}" cy="${y + 58}" r="3.5" fill="#F59E0B"/>`; });
        return `<path d="M${x - 30} ${y - 4} C ${x - 32} ${y + 14} ${x + 32} ${y + 14} ${x + 30} ${y - 4} Z" fill="${d}"/>` + g;
      }
      case 'cachos': {
        const pts = []; for (let a = 150; a <= 390; a += 20) { const r = a > 180 && a < 360 ? 31 : 29, rad = (a * Math.PI) / 180; pts.push([x + Math.cos(rad) * r, y - Math.sin(rad) * r * -1 * -1 + (a > 180 && a < 360 ? 0 : 0), 12]); }
        const back = []; for (let i = -3; i <= 3; i++) back.push([x + i * 9.5, y + 26 + Math.abs(i) * -1.5, 11]);
        for (let i = 0; i < 4; i++) { back.push([x - 33, y + 2 + i * 9, 11]); back.push([x + 33, y + 2 + i * 9, 11]); }
        return this.curls(back, d, 11);
      }
      default: return '';
    }
  },
  // frente (por cima da cabeça)
  hair(h, x, y, c, hat) {
    const d = this.shade(c, -0.2), l = this.shade(c, 0.18);
    switch (h) {
      case 'careca': return `<path d="M${x - 12} ${y - 20} q 8 -4 14 -2" stroke="#fff" stroke-width="3" opacity=".35" fill="none" stroke-linecap="round"/>`;
      case 'raspado': return this.cap(x, y, l, -29, -9, 4, 0.9) + `<path d="M${x - 22} ${y - 8} C ${x - 16} ${y - 12} ${x + 16} ${y - 12} ${x + 22} ${y - 8}" stroke="${c}" stroke-width="2" fill="none" opacity=".6"/>`;
      case 'degrade': return this.cap(x, y, l, -30, -10, 6, 0.55) + `<path d="M${x - 21} ${y - 12} C ${x - 23} ${y - 38} ${x + 23} ${y - 38} ${x + 21} ${y - 12} C ${x + 12} ${y - 17} ${x - 12} ${y - 17} ${x - 21} ${y - 12} Z" fill="${c}"/>` + this.shine(x, y - 4, c);
      case 'topete': return this.cap(x, y, c, -34, -12, 6) + (hat ? '' : `<path d="M${x - 16} ${y - 22} C ${x - 16} ${y - 47} ${x + 22} ${y - 50} ${x + 25} ${y - 30} C ${x + 14} ${y - 37} ${x + 2} ${y - 33} ${x - 16} ${y - 22} Z" fill="${c}"/><path d="M${x - 6} ${y - 36} q 12 -8 24 -4" stroke="${l}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`);
      case 'cacheado': {
        const pts = []; for (let a = 165; a >= 15; a -= 15) { const rad = (a * Math.PI) / 180; pts.push([x + Math.cos(rad) * 26, y - Math.sin(rad) * 26 - 3, 10.5]); }
        for (let a = 140; a >= 40; a -= 20) { const rad = (a * Math.PI) / 180; pts.push([x + Math.cos(rad) * 15, y - Math.sin(rad) * 15 - 12, 10]); }
        return this.cap(x, y, c, -30, -11, 4) + this.curls(pts, c, 10);
      }
      case 'longo': return this.cap(x, y, c, -34, -10, 8) + `<path d="M${x - 28} ${y + 2} C ${x - 31} ${y + 22} ${x - 27} ${y + 34} ${x - 21} ${y + 40} L ${x - 17} ${y + 38} C ${x - 22} ${y + 26} ${x - 23} ${y + 10} ${x - 20} ${y - 6} Z" fill="${c}"/><path d="M${x + 28} ${y + 2} C ${x + 31} ${y + 22} ${x + 27} ${y + 34} ${x + 21} ${y + 40} L ${x + 17} ${y + 38} C ${x + 22} ${y + 26} ${x + 23} ${y + 10} ${x + 20} ${y - 6} Z" fill="${c}"/><path d="M${x + 2} ${y - 33} C ${x} ${y - 24} ${x - 1} ${y - 16} ${x + 3} ${y - 10}" stroke="${d}" stroke-width="2" fill="none" opacity=".7"/>` + this.shine(x, y, c);
      case 'chanel': return this.cap(x, y, c, -34, -6, 8) + `<path d="M${x - 28} ${y + 2} C ${x - 30} ${y + 16} ${x - 27} ${y + 24} ${x - 22} ${y + 26} L ${x - 19} ${y + 22} C ${x - 22} ${y + 14} ${x - 23} ${y + 6} ${x - 21} ${y - 2} Z" fill="${c}"/><path d="M${x + 28} ${y + 2} C ${x + 30} ${y + 16} ${x + 27} ${y + 24} ${x + 22} ${y + 26} L ${x + 19} ${y + 22} C ${x + 22} ${y + 14} ${x + 23} ${y + 6} ${x + 21} ${y - 2} Z" fill="${c}"/>` + this.shine(x, y, c);
      case 'rabo': return this.cap(x, y, c, -33, -13, 4) + `<path d="M${x - 18} ${y - 18} C ${x - 6} ${y - 26} ${x + 10} ${y - 26} ${x + 20} ${y - 18}" stroke="${d}" stroke-width="2" fill="none" opacity=".55"/>` + this.shine(x, y, c);
      case 'coque': return this.cap(x, y, c, -32, -12, 4) + (hat ? '' : `<circle cx="${x}" cy="${y - 37}" r="12" fill="${c}"/><path d="M${x - 8} ${y - 40} q 8 -7 16 0" stroke="${l}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/><path d="M${x - 10} ${y - 27} h20" stroke="#F472B6" stroke-width="4" stroke-linecap="round"/>`);
      case 'trancas': return this.cap(x, y, c, -33, -11, 6) + `<path d="M${x} ${y - 33} V ${y - 11}" stroke="${d}" stroke-width="2.2" opacity=".8"/><path d="M${x - 14} ${y - 28} L ${x - 20} ${y - 6} M${x + 14} ${y - 28} L ${x + 20} ${y - 6}" stroke="${d}" stroke-width="1.6" opacity=".5"/>`;
      case 'cachos': {
        const pts = []; for (let a = 170; a >= 10; a -= 14) { const rad = (a * Math.PI) / 180; pts.push([x + Math.cos(rad) * 28, y - Math.sin(rad) * 28 - 2, 10]); }
        pts.push([x - 12, y - 16, 9], [x + 2, y - 19, 9], [x + 15, y - 15, 9]);
        return this.cap(x, y, c, -32, -10, 8) + this.curls(pts, c, 10);
      }
      case 'curto': default:
        return this.cap(x, y, c, -34, -12, 6) + `<path d="M${x - 14} ${y - 12} C ${x - 10} ${y - 22} ${x + 6} ${y - 26} ${x + 22} ${y - 14}" stroke="${d}" stroke-width="2" fill="none" opacity=".55"/>` + this.shine(x, y, c);
    }
  },
  face(m, x, y, beard) {
    const ink = '#1F2937';
    let eyes, mouth;
    if (m === 'cheer') { eyes = `<path d="M${x - 15} ${y + 2} q 5 -7 10 0 M${x + 5} ${y + 2} q 5 -7 10 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`; mouth = `<path d="M${x - 8} ${y + 11} q 8 12 16 0 z" fill="#7F1D1D"/>`; }
    else if (m === 'happy') { eyes = `<path d="M${x - 14} ${y + 2} q 4 -5 8 0 M${x + 6} ${y + 2} q 4 -5 8 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`; mouth = `<path d="M${x - 7} ${y + 12} q 7 7 14 0" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`; }
    else if (m === 'sofa') { eyes = `<path d="M${x - 15} ${y + 2} h9 M${x + 6} ${y + 2} h9" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`; mouth = `<path d="M${x - 5} ${y + 15} q 5 -4 10 0" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`; }
    else if (m === 'wait') { eyes = `<circle cx="${x - 10}" cy="${y + 1}" r="3.4" fill="${ink}"/><circle cx="${x + 10}" cy="${y + 1}" r="3.4" fill="${ink}"/><path d="M${x - 15} ${y - 8} l8 2 M${x + 15} ${y - 8} l-8 2" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`; mouth = `<path d="M${x - 6} ${y + 14} h12" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`; }
    else { eyes = `<circle cx="${x - 10}" cy="${y + 1}" r="3.4" fill="${ink}"/><circle cx="${x + 10}" cy="${y + 1}" r="3.4" fill="${ink}"/><circle cx="${x - 9}" cy="${y}" r="1.1" fill="#fff"/><circle cx="${x + 11}" cy="${y}" r="1.1" fill="#fff"/>`; mouth = `<path d="M${x - 6} ${y + 12} q 6 5 12 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`; }
    const blush = beard ? '' : `<ellipse cx="${x - 17}" cy="${y + 10}" rx="5" ry="3" fill="#F472B6" opacity=".35"/><ellipse cx="${x + 17}" cy="${y + 10}" rx="5" ry="3" fill="#F472B6" opacity=".35"/>`;
    return eyes + blush + mouth;
  },
  hat(id, v, x, y) {
    switch (id) {
      case 'cap': return `<path d="M${x - 27} ${y - 6} C ${x - 26} ${y - 34} ${x + 26} ${y - 34} ${x + 27} ${y - 6} Z" fill="${v.c}"/><path d="M${x - 30} ${y - 6} h 44 q 14 0 18 6 h -62 z" fill="${this.shade(v.c, -0.25)}"/><circle cx="${x}" cy="${y - 28}" r="3" fill="${this.shade(v.c, -0.25)}"/>`;
      case 'band': return `<path d="M${x - 27} ${y - 10} Q ${x} ${y - 20} ${x + 27} ${y - 10} L ${x + 27} ${y - 3} Q ${x} ${y - 13} ${x - 27} ${y - 3} Z" fill="${v.c}"/>`;
      case 'visor': return `<path d="M${x - 27} ${y - 8} Q ${x} ${y - 16} ${x + 27} ${y - 8} L ${x + 27} ${y - 3} Q ${x} ${y - 11} ${x - 27} ${y - 3} Z" fill="${v.c}"/><path d="M${x - 24} ${y - 5} q 24 -6 48 0 q -6 12 -24 10 q -18 2 -24 -10 z" fill="#0EA5E9" opacity=".55"/>`;
      case 'helmet': return `<path d="M${x - 29} ${y - 2} C ${x - 30} ${y - 40} ${x + 30} ${y - 40} ${x + 29} ${y - 2} Z" fill="${v.c}"/><path d="M${x - 14} ${y - 30} v 10 M${x} ${y - 33} v 12 M${x + 14} ${y - 30} v 10" stroke="#0B1220" stroke-width="3" stroke-linecap="round" opacity=".45"/><path d="M${x - 29} ${y - 2} h58" stroke="#0B1220" stroke-width="3" opacity=".4"/>`;
      case 'crown': return `<path d="M${x - 18} ${y - 22} L ${x - 20} ${y - 44} L ${x - 8} ${y - 32} L ${x} ${y - 48} L ${x + 8} ${y - 32} L ${x + 20} ${y - 44} L ${x + 18} ${y - 22} Z" fill="#FBBF24" stroke="#B45309" stroke-width="2" stroke-linejoin="round"/><circle cx="${x}" cy="${y - 30}" r="3" fill="#EF4444"/>`;
      default: return '';
    }
  },
  glasses(id, v, x, y) {
    if (id === 'gl_sport') return `<path d="M${x - 26} ${y} Q ${x} ${y - 8} ${x + 26} ${y} L ${x + 22} ${y + 8} Q ${x} ${y + 4} ${x - 22} ${y + 8} Z" fill="${v.c}" opacity=".9" stroke="#0B1220" stroke-width="2"/>`;
    if (id === 'gl_sun') return `<rect x="${x - 19}" y="${y - 5}" width="15" height="11" rx="4" fill="#0B1220"/><rect x="${x + 4}" y="${y - 5}" width="15" height="11" rx="4" fill="#0B1220"/><path d="M${x - 4} ${y - 1} h8" stroke="#0B1220" stroke-width="2.5"/>`;
    return '';
  },
  shade(hex, f) { const n = parseInt((hex || '#888888').slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); },
  lum(hex) { const n = parseInt((hex || '#888888').slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; },

  // imagem (canvas) do atleta — para foto de perfil, card de compartilhar e retrospectiva
  png(cfg, o = {}) {
    const s = this.svg(cfg, { ...o, still: true, w: o.size || 400 }).replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ').replace(/class="[^"]*"/g, '');
    return new Promise((ok) => {
      const img = new Image(), sz = o.size || 400, h = o.portrait ? sz : Math.round((sz * 240) / 200);
      img.onload = () => { const c = document.createElement('canvas'); c.width = sz; c.height = h; const g = c.getContext('2d'); if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, sz, h); } g.drawImage(img, 0, 0, sz, h); ok(c); };
      img.onerror = () => ok(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  },

  /* ---------- ações ---------- */
  save(cfg) { cfg.on = true; Store.data.avatar = cfg; Store.save(); if (Cloud.loggedIn && Cloud.loggedIn()) Cloud.pushAvatar().catch(() => {}); },
  buy(id) {
    const it = this.item(id), cfg = this.cfg(), D = Store.data;
    if (!it || this.has(id)) return 'ok';
    if (it.cond) return 'locked';
    if (D.coins < it.price) return 'coins';
    D.coins -= it.price; cfg.own = cfg.own || {}; cfg.own[id] = Date.now(); Store.data.avatar = cfg; Store.save();
    return 'ok';
  },
  publicData() { const c = this.cfg(), st = this.stats(), sg = this.stage(); return { cfg: { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: !!c.beard, eq: c.eq }, pow: st.pow, stage: sg.i, st: { vel: st.vel, res: st.res, for: st.for, con: st.con } }; },
};
