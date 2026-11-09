/* =========================================================
   JustGo — PASSE DA TEMPORADA
   Duas trilhas de 50 níveis (grátis e premium). Os pontos vêm
   do que a pessoa já faz: treinos e missões. Nada de baú ou
   roleta: cada nível tem uma recompensa fixa, à vista.

   Ritmo: 300 pontos por nível (nível 50 = 14.700 pontos).
   - treino: 100 + 20 por km (até 15 km conta) — vale de 1 km ou 10 min
   - missão diária: 40 · semanal: 250 · do mês: 400
   Quem treina 3x/semana (~5 km) e faz as semanais chega ao 50
   em ~9 semanas; quem treina 2x/semana passa do nível 30.
   A temporada tem 12 semanas.

   Compra: Google Play (o app nativo abre a cobrança). O comprovante
   é conferido no servidor (função pass-verify no Supabase) e o
   premium fica ligado à conta.
   ========================================================= */
const Pass = {
  SEASON: { id: 't1', name: 'Temporada de Verão', short: 'Verão', start: '2026-11-09', end: '2027-02-01' },
  PER_LEVEL: 300,
  MAX: 50,
  PTS: { act: 100, perKm: 20, kmCap: 15, d: 40, w: 250, m: 400 },
  // produtos cadastrados no Play Console (Monetizar > Produtos no app)
  PRODUCTS: {
    pass: { id: 'jg_passe_t1', name: 'Passe Premium', fallback: 'R$ 9,90', was: 'R$ 14,90' },
    plus: { id: 'jg_passe_t1_mais10', name: 'Passe + 10 níveis', fallback: 'R$ 24,90' },
    skip: { id: 'jg_pular3', name: 'Pular 3 níveis', fallback: 'R$ 2,90', consumable: true },
  },

  /* ---------- itens exclusivos do passe ---------- */
  ITEMS: [
    { id: 'line-flame', cat: 'line', name: 'Rastro de chamas', value: '#FF5A1F', style: 'flame', desc: 'Seu percurso pega fogo no mapa, com faíscas correndo pela linha.' },
    { id: 'line-speed', cat: 'line', name: 'Rastro por velocidade', value: '#22C55E', style: 'speed', desc: 'A linha muda de cor com o seu ritmo: azul devagar, verde, amarelo e vermelho no gás.' },
    { id: 'line-neon', cat: 'line', name: 'Traçado Neon', value: '#00E5FF', desc: 'Azul elétrico exclusivo da temporada.' },
    { id: 'line-ruby', cat: 'line', name: 'Traçado Rubi', value: '#E11D48', desc: 'Vermelho rubi exclusivo.' },
    { id: 'line-platinum', cat: 'line', name: 'Traçado Platina', value: '#C7D2FE', desc: 'Prata azulada, para quem chegou longe.' },
    { id: 'line-lava', cat: 'line', name: 'Traçado Lava', value: '#FF3D00', style: 'flame', desc: 'Chamas mais intensas, só para o fim da temporada.' },
    { id: 'frame-verao', cat: 'frame', name: 'Moldura Verão', value: 'linear-gradient(135deg,#FDE047,#FB923C,#F43F5E)', desc: 'Moldura da Temporada de Verão.' },
    { id: 'frame-aurora', cat: 'frame', name: 'Moldura Aurora', value: 'conic-gradient(#22D3EE,#A78BFA,#F472B6,#22D3EE)', desc: 'Cores de aurora em volta da sua foto.' },
    { id: 'frame-diamond', cat: 'frame', name: 'Moldura Diamante', value: 'linear-gradient(135deg,#E0F2FE,#7DD3FC,#E0E7FF,#A5B4FC)', desc: 'Brilho de diamante.' },
    { id: 'frame-legend', cat: 'frame', name: 'Moldura Lendária', value: 'conic-gradient(#F5B841,#FF5A1F,#A78BFA,#22D3EE,#F5B841)', desc: 'A moldura de quem completou quase tudo.' },
    { id: 'av-aurora', cat: 'avatar', name: 'Fundo Aurora', value: 'linear-gradient(145deg,#22D3EE,#A78BFA)', desc: 'Fundo do avatar em aurora.' },
    { id: 'av-galaxy', cat: 'avatar', name: 'Fundo Galáxia', value: 'radial-gradient(circle at 30% 30%,#A78BFA,#312E81 60%,#0F172A)', desc: 'Fundo do avatar com cara de galáxia.' },
    { id: 'theme-ocean', cat: 'theme', name: 'Tema Oceano', value: 'ocean', desc: 'O app inteiro em azul profundo.' },
    { id: 'fx-arch', cat: 'finish', name: 'Arco de chegada com fogos', value: 'arch', desc: 'Ao terminar o treino, um arco de chegada aparece e a tela explode em fogos, com som.' },
    { id: 'mascot-egg', cat: 'mascot', name: 'Ovo do mascote', value: 'egg', desc: 'Choca com 10 km na temporada e vira um filhote que cresce com seus km.' },
    { id: 'mascot-dragon', cat: 'mascot', name: 'Dragão lendário', value: 'dragon', desc: 'O mascote raro da temporada. Aura dourada e asas: só tem quem completou o passe premium.' },
    { id: 'ghost-wolf', cat: 'ghost', name: 'Fantasma de lobo', value: 'wolf', desc: 'Seu melhor tempo corre ao seu lado como um lobo de olhos brilhando.' },
    { id: 'voice-futebol', cat: 'voice', name: 'Narrador de futebol', value: 'futebol', desc: 'Narra seu treino como um jogo. Liga junto com o Assistente de voz.' },
    { id: 'poster', cat: 'poster', name: 'Pôster de cinema', value: 'poster', desc: 'Novo modelo de imagem: seu treino vira pôster de filme para postar.' },
    { id: 'flag', cat: 'flag', name: 'Bandeira de território', value: 'flag', desc: 'Suas áreas no mapa ganham uma bandeira com o seu nome.' },
    { id: 'title', cat: 'title', name: 'Título que evolui', value: 'evolve', desc: 'Bronze, prata, ouro e diamante conforme seus km na temporada. Aparece ao lado do seu nome.' },
    { id: 'title-legend', cat: 'title', name: 'Título Lenda do Verão', value: 'legend', desc: 'O título mais raro da temporada, ao lado do seu nome.' },
    { id: 'sticker-t1', cat: 'sticker', name: 'Figurinha da Temporada de Verão', value: 't1', desc: 'Figurinha comemorativa no seu perfil. Prova de que você jogou a temporada inteira.' },
  ],

  /* ---------- trilhas ---------- */
  // c: moedas · s: escudo de ofensiva · z: escudo de território · b: pontos em dobro · i: item
  FREE: [
    ['i', 'mascot-egg'], ['c', 50], ['s', 1], ['i', 'line-ice'], ['i', 'flag'], ['b', 1], ['c', 50], ['c', 100], ['z', 1], ['i', 'line-speed'],
    ['c', 50], ['i', 'frame-silver'], ['b', 1], ['c', 75], ['i', 'title'], ['c', 50], ['z', 1], ['i', 'av-ocean'], ['c', 75], ['s', 1],
    ['c', 50], ['b', 1], ['i', 'line-lime'], ['c', 75], ['c', 100], ['z', 1], ['c', 50], ['i', 'fx-pulse'], ['c', 75], ['s', 1],
    ['c', 50], ['b', 1], ['i', 'av-forest'], ['c', 75], ['c', 100], ['z', 1], ['c', 50], ['i', 'frame-verao'], ['c', 75], ['s', 1],
    ['c', 50], ['b', 1], ['c', 75], ['i', 'line-violet'], ['c', 150], ['z', 1], ['c', 75], ['s', 1], ['c', 100], ['i', 'sticker-t1'],
  ],
  PREMIUM: [
    ['i', 'line-flame'], ['c', 150], ['i', 'frame-fire'], ['b', 2], ['i', 'poster'], ['c', 100], ['s', 2], ['i', 'theme-midnight'], ['c', 100], ['i', 'line-neon'],
    ['z', 2], ['i', 'ghost-wolf'], ['c', 150], ['i', 'av-aurora'], ['b', 2], ['c', 100], ['i', 'frame-gold'], ['i', 'voice-futebol'], ['c', 150], ['s', 2],
    ['i', 'line-gold'], ['c', 100], ['i', 'theme-graphite'], ['i', 'fx-arch'], ['c', 250], ['b', 3], ['i', 'av-sunset'], ['z', 3], ['c', 150], ['i', 'frame-aurora'],
    ['i', 'line-ruby'], ['c', 150], ['s', 3], ['i', 'theme-ocean'], ['c', 250], ['b', 3], ['i', 'frame-diamond'], ['c', 150], ['i', 'line-platinum'], ['z', 3],
    ['c', 200], ['i', 'av-galaxy'], ['b', 3], ['i', 'frame-legend'], ['c', 300], ['s', 3], ['i', 'line-lava'], ['c', 250], ['i', 'title-legend'], ['i', 'mascot-dragon'],
  ],

  /* ---------- estado ---------- */
  st() {
    const D = Store.data;
    if (!D.pass) D.pass = {};
    const P = D.pass;
    P.got = P.got || {}; P.inv = P.inv || { s: 0, z: 0, b: 0 }; P.ent = P.ent || {}; P.eq = P.eq || {};
    return P;
  },
  ent() { return this.st().ent[this.SEASON.id] || { premium: false, skips: 0 }; },
  premium() { return !!this.ent().premium; },
  item(id) { return this.ITEMS.find((x) => x.id === id) || (typeof CONFIG !== 'undefined' && CONFIG.shop.find((x) => x.id === id)) || null; },
  owns(id) { return !!Store.data.owned[id]; },
  equipped(cat) { const id = this.st().eq[cat]; return id && this.owns(id) ? id : null; },
  has(cat) { return !!this.equipped(cat); },

  /* ---------- pontos ---------- */
  win() { const s = this.SEASON; return [Date.parse(s.start + 'T00:00:00'), Date.parse(s.end + 'T23:59:59')]; },
  active() { const [a, b] = this.win(), n = Date.now(); return n >= a && n <= b; },
  daysLeft() { return Math.max(0, Math.ceil((this.win()[1] - Date.now()) / 864e5)); },
  actPts(a) {
    const km = (a.distance || 0) / 1000, min = (a.duration || 0) / 60;
    if (km < 1 && min < 10) return 0;
    if (a.flagged || a.mode === 'sim') return 0;
    const p = this.PTS.act + Math.round(Math.min(km, this.PTS.kmCap) * this.PTS.perKm);
    return a.passBoost ? p * 2 : p;
  },
  keys() {
    if (this._keys && this._keysT > Date.now() - 6e4) return this._keys;
    const [a, b] = this.win(), d = new Set(), w = new Set(), m = new Set();
    for (let t = a; t <= Math.min(b, Date.now() + 864e5); t += 864e5) { d.add(Game.dayKey(t)); w.add(Game.weekKey(t)); m.add(Game.monthKey(t)); }
    this._keysT = Date.now();
    return (this._keys = { d, w, m });
  },
  points() {
    const [a, b] = this.win(), D = Store.data, K = this.keys();
    let p = 0;
    for (const x of D.activities) { const t = typeof x.start === 'string' ? Date.parse(x.start) : x.start; if (t >= a && t <= b) p += this.actPts(x); }
    for (const k of Object.keys(D.missionsDone || {})) {
      const [pre, key] = k.split(':');
      if (pre === 'd' && K.d.has(key)) p += this.PTS.d;
      else if (pre === 'w' && K.w.has(key)) p += this.PTS.w;
      else if (pre === 'm' && K.m.has(key)) p += this.PTS.m;
    }
    p += (this.ent().skips || 0) * this.PER_LEVEL;
    return p;
  },
  level(p = this.points()) { return Math.min(this.MAX, 1 + Math.floor(p / this.PER_LEVEL)); },
  seasonKm() {
    const [a, b] = this.win();
    return Store.data.activities.filter((x) => { const t = typeof x.start === 'string' ? Date.parse(x.start) : x.start; return t >= a && t <= b && !x.flagged; }).reduce((s, x) => s + (x.distance || 0), 0) / 1000;
  },

  /* ---------- recompensas ---------- */
  reward(track, lv) { return (track === 'p' ? this.PREMIUM : this.FREE)[lv - 1]; },
  rewardInfo(r) {
    const [t, v] = r;
    if (t === 'c') return { ic: 'coin', name: `${v} moedas`, short: `${v}`, kind: 'coins' };
    if (t === 's') return { ic: 'flame', name: v > 1 ? `${v} escudos de ofensiva` : 'Escudo de ofensiva', short: `×${v}`, kind: 'streak', desc: 'Salva sua sequência de dias automaticamente se você perder um dia.' };
    if (t === 'z') return { ic: 'shield', name: v > 1 ? `${v} escudos de território` : 'Escudo de território', short: `×${v}`, kind: 'zone', desc: 'Protege suas áreas por 24 h. Use quando quiser.' };
    if (t === 'b') return { ic: 'zap', name: v > 1 ? `${v}× pontos em dobro` : 'Pontos em dobro', short: `×${v}`, kind: 'boost', desc: 'O próximo treino vale o dobro de pontos na temporada.' };
    const it = this.item(v) || { name: v };
    return { ic: this.itemIcon(it), name: it.name, kind: 'item', item: it, desc: it.desc || '', special: !!this.ITEMS.find((x) => x.id === v) };
  },
  itemIcon(it) {
    return { line: 'route', frame: 'user', avatar: 'user', theme: 'sun', finish: 'flag', mascot: 'sparkles', ghost: 'ghost', voice: 'mic', poster: 'film', flag: 'flag', title: 'crown', sticker: 'award' }[it.cat] || 'gift';
  },
  // entrega o que já foi alcançado e ainda não foi entregue (inclusive premium comprado depois)
  grant(silent) {
    const P = this.st(), D = Store.data, lv = this.level(), sid = this.SEASON.id, got = (P.got[sid] = P.got[sid] || {});
    const novos = [];
    const give = (track, l) => {
      const k = track + l; if (got[k]) return;
      const r = this.reward(track, l); if (!r) return;
      got[k] = Date.now();
      const [t, v] = r;
      if (t === 'c') D.coins += v;
      else if (t === 's' || t === 'z' || t === 'b') P.inv[t] = (P.inv[t] || 0) + v;
      else if (t === 'i' && !D.owned[v]) {
        D.owned[v] = Date.now();
        const it = this.item(v);
        // itens especiais já entram em uso (dá para trocar no passe)
        if (it && ['mascot', 'ghost', 'voice', 'poster', 'flag', 'title'].includes(it.cat)) P.eq[it.cat] = v;
      }
      novos.push([track, l, r]);
    };
    for (let l = 1; l <= lv; l++) { give('f', l); if (this.premium()) give('p', l); }
    if (novos.length) {
      Store.save();
      if (!silent) {
        const best = novos.find(([, , r]) => r[0] === 'i') || novos[novos.length - 1];
        const info = this.rewardInfo(best[2]);
        FX.toast(novos.length > 1 ? `Temporada: ${novos.length} recompensas novas, incluindo ${info.name}` : `Temporada: você ganhou ${info.name}`);
      }
    }
    return novos;
  },
  // escudo de ofensiva do passe: salva o dia de ontem sozinho
  autoStreak() {
    const P = this.st(); if (!(P.inv.s > 0) || typeof Ads === 'undefined') return;
    const o = Ads.streakOffer && (() => { const D = Store.data, y = Ads.yKey(); const days = new Set(Game.acts().map((a) => Game.dayKey(a.start)).concat(D.streakSaves || [])); if (days.has(y)) return null; const cur = Game.streakDays(); D.streakSaves = (D.streakSaves || []).concat([y]); const would = Game.streakDays(); D.streakSaves.pop(); return would >= 2 && would > cur ? { would, y } : null; })();
    if (!o) return;
    const D = Store.data; D.streakSaves = (D.streakSaves || []).concat([o.y]).slice(-30); P.inv.s--; Store.save();
    FX.toast(`Escudo de ofensiva usado: seus ${o.would} dias seguidos continuam valendo.`);
  },

  /* ---------- compra (Google Play) ---------- */
  prices: {},
  async loadPrices() {
    if (!Native.on) return;
    const ids = Object.values(this.PRODUCTS).map((p) => p.id);
    const r = await Native.call('billingQuery', { ids }, 20000);
    if (r && r.items) r.items.forEach((x) => (this.prices[x.id] = x.price));
  },
  price(k) { const p = this.PRODUCTS[k]; return this.prices[p.id] || p.fallback; },
  async buy(k) {
    const p = this.PRODUCTS[k];
    if (!Cloud.loggedIn()) return FX.toast('Entre na sua conta para comprar. O passe fica salvo nela.');
    if (!Native.on) return FX.modal(`<h3>Compra pelo app</h3><p class="muted">O passe é comprado pelo app JustGo instalado no Android, pela Google Play.</p><button class="btn primary" data-m="ok">Entendi</button>`);
    if (k === 'skip' && this.level() >= this.MAX) return FX.toast('Você já está no nível máximo.');
    if (k !== 'skip' && this.premium()) return FX.toast('Seu passe premium já está ativo.');
    const r = await Native.call('billingBuy', { id: p.id, consumable: !!p.consumable, user: Cloud.user && Cloud.user.id }, 30000);
    if (r === null) return FX.modal(`<h3>Atualize o app</h3><p class="muted">Para comprar, instale a versão mais nova do JustGo pela Play Store.</p><button class="btn primary" data-m="ok">Entendi</button>`);
    if (!r.ok) FX.toast(r.error === 'notFound' ? 'Produto ainda não disponível na Play Store.' : r.error === 'unavailable' ? 'A Google Play não está disponível neste aparelho.' : 'Não foi possível abrir a compra.');
  },
  // a parte nativa avisa: comprou, pendente, cancelou, erro
  async onBilling(ev) {
    if (!ev) return;
    if (ev.type === 'canceled') return;
    if (ev.type === 'error') return FX.toast('A compra não foi concluída.');
    if (ev.type === 'pending') return FX.toast('Pagamento pendente. Quando confirmar, o passe é liberado sozinho.');
    if (ev.type !== 'purchased') return;
    const prod = Object.values(this.PRODUCTS).find((p) => p.id === ev.product);
    if (!Cloud.loggedIn()) { this._waiting = ev; return; }
    try {
      const { data, error } = await Cloud.sb.functions.invoke('pass-verify', { body: { product: ev.product, token: ev.token, order: ev.order, season: this.SEASON.id } });
      if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'falhou');
      this.setEnt(data.ent);
      await Native.call('billingFinish', { token: ev.token, consumable: !!(prod && prod.consumable) }, 20000);
      if (data.again) { this.grant(true); return; } // compra antiga restaurada: só garante o que é dela
      const novos = this.grant(true);
      FX.beep([523, 659, 784, 1047]); FX.vibrate([30, 40, 30]);
      FX.modal(`<div class="ps-done">${this.mascotSvg(prod && prod.consumable ? 'egg' : 'dragon', 2)}<h3>${prod && prod.consumable ? 'Níveis liberados!' : 'Passe Premium ativo!'}</h3>
        <p class="muted">${prod && prod.consumable ? `Você avançou 3 níveis na ${this.SEASON.name}.` : `Todas as recompensas premium dos níveis que você já alcançou foram entregues${novos.length ? ` (${novos.length} ${novos.length === 1 ? 'item' : 'itens'})` : ''}.`}</p>
        <button class="btn primary" data-m="ok">Ver meu passe</button></div>`).then(() => { if (App.tab === 'pass') UI.pass(); else App.go('pass'); });
    } catch (e) {
      console.error(e);
      FX.toast('Pagamento recebido. Estamos confirmando com a Google Play — o passe aparece em instantes.');
      setTimeout(() => this.onBilling(ev), 30000);
    }
  },
  setEnt(e) {
    if (!e) return;
    const P = this.st(); P.ent[e.season || this.SEASON.id] = { premium: !!e.premium, skips: e.skips || 0 };
    Store.save();
  },
  async loadEnt() {
    if (!Cloud.loggedIn()) return;
    try {
      const { data } = await Cloud.sb.from('pass_entitlements').select('season,premium,skips').eq('user_id', Cloud.user.id);
      if (data) { const P = this.st(); data.forEach((e) => (P.ent[e.season] = { premium: !!e.premium, skips: e.skips || 0 })); Store.save(); }
    } catch (e) {}
    // compras que ficaram sem confirmar (app fechou no meio, reinstalou…)
    if (Native.on) Native.call('billingRestore', {}, 20000).catch(() => {});
    this.grant(true);
  },

  /* ---------- uso do inventário ---------- */
  async useZone() {
    const P = this.st(); if (!(P.inv.z > 0)) return;
    if (!Cloud.loggedIn()) return FX.toast('Entre na conta para proteger suas áreas.');
    if (typeof Ads !== 'undefined' && Ads.shieldOn()) return FX.toast('O escudo já está ativo.');
    try {
      const u = await Cloud.activateShield();
      P.inv.z--; Store.data.shieldUntil = Date.parse(u) || Date.now() + 24 * 3600e3; Store.save();
      FX.beep([392, 523, 659]); FX.toast('Escudo ativado: suas áreas estão protegidas por 24 h.'); UI.pass();
    } catch (e) { FX.toast(/limite/.test(String(e && e.message)) ? 'Você já usou um escudo hoje. Tente amanhã.' : 'Não foi possível ativar agora.'); }
  },
  useBoost() {
    const P = this.st(); if (!(P.inv.b > 0) || P.boostNext) return;
    P.inv.b--; P.boostNext = true; Store.save();
    FX.toast('Pronto: seu próximo treino vale o dobro de pontos.'); UI.pass();
  },
  equip(cat, id) {
    const P = this.st();
    if (['line', 'frame', 'avatar', 'theme', 'finish'].includes(cat)) { Shop.equip(cat, Store.data.equipped[cat] === id ? null : id); if (cat === 'finish' && Store.data.equipped.finish) FX.finish(); }
    else { P.eq[cat] = P.eq[cat] === id ? null : id; Store.save(); }
    if (cat === 'voice' && P.eq.voice && !Pref('voice')) FX.toast('Ligue o Assistente de voz em Configurações para ouvir o narrador.');
  },

  /* ---------- título que evolui ---------- */
  TIERS: [[0, 'Bronze', '#B4703A'], [50, 'Prata', '#94A3B8'], [150, 'Ouro', '#D4A017'], [300, 'Diamante', '#38BDF8']],
  title() {
    const t = this.equipped('title'); if (!t) return null;
    if (t === 'title-legend') return { name: 'Lenda do Verão', color: '#A855F7', legend: 1 };
    const km = this.seasonKm(); let tier = this.TIERS[0];
    for (const x of this.TIERS) if (km >= x[0]) tier = x;
    return { name: `${tier[1]} do Verão`, color: tier[2] };
  },
  titleChip(info) {
    if (!info || !info.title) return '';
    return ` <span class="pt-chip" style="--c:${/^#[0-9a-f]{6}$/i.test(info.color || '') ? info.color : '#94A3B8'}">${esc(String(info.title).slice(0, 24))}</span>`;
  },
  publicInfo() { const t = this.title(); return t ? { title: t.name, color: t.color } : null; },

  /* ---------- mascote ---------- */
  mascotStage() { const km = this.seasonKm(); return km < 10 ? 0 : km < 50 ? 1 : km < 120 ? 2 : 3; },
  mascotSvg(kind, stage, cls = '') {
    const eyes = `<circle cx="48" cy="60" r="6.5" fill="#0F1B2D"/><circle cx="72" cy="60" r="6.5" fill="#0F1B2D"/><circle cx="50.5" cy="57.5" r="2.2" fill="#fff"/><circle cx="74.5" cy="57.5" r="2.2" fill="#fff"/>`;
    const mouth = `<path d="M54 71 Q60 77 66 71" stroke="#0F1B2D" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    const blush = `<ellipse cx="41" cy="70" rx="4.5" ry="2.6" fill="#FB7185" opacity=".45"/><ellipse cx="79" cy="70" rx="4.5" ry="2.6" fill="#FB7185" opacity=".45"/>`;
    if (kind === 'egg' && stage === 0) {
      const km = Math.min(10, this.seasonKm()), crack = km >= 3 ? `<path d="M40 64 l7 -6 l6 7 l7 -8 l6 7 l8 -6" stroke="#8B6B3D" stroke-width="2.4" fill="none" stroke-linejoin="round"/>` : '';
      const peek = km >= 6 ? `<path d="M46 38 L42 24 L54 34Z M74 38 L78 24 L66 34Z" fill="#F5B841"/>` : '';
      return `<svg class="mascot ${cls}" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="110" rx="26" ry="4.5" fill="#000" opacity=".12"/>${peek}<path d="M60 18 C82 18 94 52 94 74 C94 96 79 108 60 108 C41 108 26 96 26 74 C26 52 38 18 60 18Z" fill="#FFF7E6" stroke="#E9D5B0" stroke-width="2"/><circle cx="46" cy="52" r="5" fill="#2DD4BF" opacity=".55"/><circle cx="74" cy="80" r="7" fill="#2DD4BF" opacity=".45"/><circle cx="68" cy="40" r="3.5" fill="#F5B841" opacity=".7"/>${crack}</svg>`;
    }
    if (kind === 'dragon') {
      return `<svg class="mascot dragon ${cls}" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="m-aura" cx="60" cy="64" r="50" fill="none" stroke="#F5B841" stroke-width="2" stroke-dasharray="3 7" opacity=".9"/>
        <circle cx="60" cy="64" r="44" fill="url(#dg${cls})" opacity=".35"/>
        <defs><radialGradient id="dg${cls}"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#FDE68A" stop-opacity="0"/></radialGradient></defs>
        <path d="M30 62 C10 50 8 30 14 22 C20 34 28 40 38 44Z" fill="#7C3AED"/><path d="M90 62 C110 50 112 30 106 22 C100 34 92 40 82 44Z" fill="#7C3AED"/>
        <path d="M40 40 L32 12 L52 32Z M80 40 L88 12 L68 32Z" fill="#F5B841"/>
        <ellipse cx="60" cy="68" rx="32" ry="34" fill="#14B8A6"/><ellipse cx="60" cy="80" rx="18" ry="16" fill="#99F6E4"/>
        <path d="M52 101 l-4 8 h10z M68 101 l4 8 h-10z" fill="#0F766E"/>${eyes}${mouth}${blush}
        <path d="M60 28 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1z" fill="#FDE047"/>
        <g class="m-spark" fill="#FDE047"><circle cx="16" cy="88" r="2.2"/><circle cx="104" cy="92" r="2.2"/><circle cx="98" cy="16" r="1.8"/><circle cx="22" cy="14" r="1.8"/></g></svg>`;
    }
    const s = Math.max(1, stage), scale = [0, 0.78, 0.9, 1][s];
    const band = s >= 2 ? `<path d="M30 50 Q60 40 90 50 L90 56 Q60 46 30 56Z" fill="#1858F0"/>` : '';
    const medal = s >= 3 ? `<path d="M54 86 L60 96 L66 86" stroke="#1858F0" stroke-width="3" fill="none"/><circle cx="60" cy="98" r="5.5" fill="#F5B841" stroke="#B45309" stroke-width="1.5"/>` : '';
    return `<svg class="mascot ${cls}" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="110" rx="${26 * scale}" ry="4.5" fill="#000" opacity=".12"/><g transform="translate(60 106) scale(${scale}) translate(-60 -106)">
      <path d="M40 42 L32 18 L52 34Z M80 42 L88 18 L68 34Z" fill="#F5B841"/><ellipse cx="60" cy="68" rx="33" ry="35" fill="#2DD4BF"/><ellipse cx="60" cy="80" rx="19" ry="17" fill="#99F6E4"/>
      <ellipse cx="46" cy="104" rx="8" ry="4" fill="#0F766E"/><ellipse cx="74" cy="104" rx="8" ry="4" fill="#0F766E"/>${band}${eyes}${mouth}${blush}${medal}</g></svg>`;
  },
  mascotNow(cls) {
    const m = this.equipped('mascot'); if (!m) return '';
    return m === 'mascot-dragon' ? this.mascotSvg('dragon', 3, cls) : this.mascotSvg('egg', this.mascotStage(), cls);
  },
  mascotLabel() {
    const m = this.equipped('mascot'); if (!m) return '';
    if (m === 'mascot-dragon') return 'Dragão lendário';
    const st = this.mascotStage(), km = this.seasonKm();
    return ['Ovo · choca com 10 km', 'Filhote', 'Jovem atleta', 'Atleta da temporada'][st] + (st === 0 ? ` (${Fmt.num(Math.min(10, km))}/10 km)` : st === 1 ? ` · cresce com 50 km` : st === 2 ? ` · evolui com 120 km` : '');
  },

  /* ---------- fantasma de lobo ---------- */
  wolfSvg() {
    return `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#312E81" opacity=".85"/><path d="M10 12 L16 22 L22 18 L28 22 L34 12 L32 26 C32 32 27 36 22 36 C17 36 12 32 12 26Z" fill="#A5B4FC"/><path d="M16 25 L20 26 L17 28Z M28 25 L24 26 L27 28Z" fill="#FDE047"/><path d="M20 31 L22 33 L24 31" fill="#312E81"/></svg>`;
  },

  /* ---------- bandeira no território ---------- */
  flagMarker(z) {
    if (!this.has('flag') || typeof L === 'undefined') return null;
    const c = Zones.center(z.poly), name = esc((Store.data.profile.name || 'Você').split(' ')[0]);
    return L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'zflag', html: `<span>${I('flag', 'xs')}${name}</span>`, iconSize: null, iconAnchor: [6, 28] }) });
  },

  /* ---------- traçados especiais ---------- */
  styledLine(m, latlngs, weight, style, act) {
    if (style === 'flame') {
      const glow = L.polyline(latlngs, { color: '#FF5A1F', weight: weight + 8, opacity: 0.28, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
      const line = L.polyline(latlngs, { color: '#FF3D00', weight: weight + 1, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
      const spark = L.polyline(latlngs, { color: '#FFD54A', weight: Math.max(2, weight - 2), opacity: 1, dashArray: '2 14', lineCap: 'round', className: 'flame-spark', interactive: false }).addTo(m);
      return { line, casing: glow, setLatLngs(ll) { glow.setLatLngs(ll); line.setLatLngs(ll); spark.setLatLngs(ll); return this; }, getBounds() { return line.getBounds(); } };
    }
    if (style === 'speed' && act && act.points && act.points.length > 2) {
      const pts = act.points, sp = [];
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dt = ((b[2] || 0) - (a[2] || 0)) / 1000; sp.push(dt > 0 ? Geo.dist(a, b) / dt : 0); }
      const ok = sp.filter((v) => v > 0.3).sort((x, y) => x - y);
      if (ok.length < 5) return null;
      const lo = ok[Math.floor(ok.length * 0.1)], hi = ok[Math.floor(ok.length * 0.9)] || lo + 1;
      const col = (v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(0.1, hi - lo))); const stops = [[37, 99, 235], [34, 197, 94], [234, 179, 8], [239, 68, 68]]; const f = t * 3, i = Math.min(2, Math.floor(f)), u = f - i; const c = stops[i].map((x, k) => Math.round(x + (stops[i + 1][k] - x) * u)); return `rgb(${c.join(',')})`; };
      const casing = L.polyline(latlngs, { color: '#fff', weight: weight + 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
      const g = L.layerGroup().addTo(m);
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1], b = pts[i]; if (b[4] || Geo.dist(a, b) > 200) continue;
        L.polyline([[a[0], a[1]], [b[0], b[1]]], { color: col(sp[i - 1]), weight, opacity: 1, lineCap: 'round', interactive: false }).addTo(g);
      }
      return { line: casing, casing, setLatLngs() { return this; }, getBounds() { return casing.getBounds(); } };
    }
    return null;
  },

  /* ---------- narrador de futebol ---------- */
  narrate(n, tr, t) {
    const pace = FX.spokenTime(t), tot = FX.spokenTime(tr.moving / 1000);
    const L1 = [
      `Olha ele aí! Quilômetro ${n} na conta! Esse último saiu em ${pace}. Tempo de jogo: ${tot}.`,
      `Avança pela lateral, passa pela marcação e completa o quilômetro ${n}! Último em ${pace}!`,
      `Que fase! Quilômetro ${n}, em ${pace}. A torcida está de pé!`,
      `Tabela, tabela e... quilômetro ${n}! Cronômetro marca ${tot}.`,
      `É do atleta! Quilômetro ${n} em ${pace}. Ninguém segura!`,
    ];
    return L1[(n - 1) % L1.length];
  },

  /* ---------- tela ---------- */
  rowCell(track, lv, reached) {
    const r = this.reward(track, lv); if (!r) return '<div class="ps-cell empty"></div>';
    const i = this.rewardInfo(r), locked = track === 'p' && !this.premium();
    const got = (this.st().got[this.SEASON.id] || {})[track + lv];
    const big = i.special;
    return `<button class="ps-cell ${track} ${got ? 'got' : ''} ${reached && !locked ? 'on' : ''} ${big ? 'big' : ''}" data-act="passInfo" data-v="${track}:${lv}">
      <span class="ps-ic">${big && i.item.cat === 'mascot' ? this.mascotSvg(i.item.value === 'dragon' ? 'dragon' : 'egg', i.item.value === 'dragon' ? 3 : 0) : I(i.ic)}</span>
      <span class="ps-t">${esc(i.name)}</span>
      ${locked ? `<i class="ps-lock">${I('lock', 'xs')}</i>` : got ? `<i class="ps-ok">${I('check', 'xs')}</i>` : ''}
    </button>`;
  },
  view() {
    this.st(); this.grant(true);
    const pts = this.points(), lv = this.level(pts), into = pts - (lv - 1) * this.PER_LEVEL, max = lv >= this.MAX, prem = this.premium();
    const P = this.st(), days = this.daysLeft();
    const S = this.SEASON, fmtD = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    const owned = this.ITEMS.filter((x) => this.owns(x.id) && x.cat !== 'sticker');
    const isOn = (it) => (['line', 'frame', 'avatar', 'theme', 'finish'].includes(it.cat) ? Store.data.equipped[it.cat] === it.id : P.eq[it.cat] === it.id);
    const t = this.title();
    return `<main class="screen ps">
      <section class="ps-head">
        <div class="ps-top"><div class="grow"><span class="ps-dates">${fmtD(S.start)} – ${fmtD(S.end)} · ${this.active() ? `faltam ${days} dias` : Date.now() < this.win()[0] ? 'começa em breve' : 'encerrada'}</span><h1>${S.name}</h1></div>${prem ? `<span class="ps-badge">Premium</span>` : ''}</div>
        <div class="ps-lv"><b class="num">${lv}</b><span>nível<br>de ${this.MAX}</span><div class="ps-masc">${this.mascotNow('sm')}</div></div>
        <div class="v9-bar"><i style="width:${max ? 100 : (into / this.PER_LEVEL) * 100}%"></i></div>
        <div class="ps-sub"><span class="num">${max ? 'Nível máximo' : `${into} / ${this.PER_LEVEL} pontos`}</span><span>${Fmt.num(this.seasonKm())} km na temporada</span></div>
        ${t ? `<div class="ps-title">Seu título: <span class="pt-chip" style="--c:${t.color}">${esc(t.name)}</span></div>` : ''}
      </section>

      ${prem ? `<section class="v9-sec ps-buy on"><div class="grow"><b>Passe Premium ativo</b><small>Quer chegar mais rápido no Dragão lendário?</small></div><button class="btn ghost" data-act="passBuy" data-v="skip">Pular 3 níveis · ${this.price('skip')}</button></section>`
      : `<section class="v9-sec ps-buy">
        <div class="ps-buy-h"><div class="grow"><b>Passe Premium</b><small>50 recompensas a mais, bem melhores. As dos níveis que você já alcançou chegam na hora.</small></div><div class="ps-price"><s>${this.PRODUCTS.pass.was}</s><b class="num">${this.price('pass')}</b><small>preço de lançamento</small></div></div>
        <ul class="ps-best">
          <li>${this.mascotSvg('dragon', 3, 'xs')}<span><b>Dragão lendário</b> no nível 50</span></li>
          <li>${I('flame')}<span><b>Rastro de chamas</b> já no primeiro treino</span></li>
          <li>${I('ghost')}<span><b>Fantasma de lobo</b> e <b>narrador de futebol</b></span></li>
          <li>${I('flag')}<span><b>Arco de chegada com fogos</b>, temas e molduras exclusivas</span></li>
        </ul>
        <button class="btn primary block" data-act="passBuy" data-v="pass">Comprar Passe Premium · ${this.price('pass')}</button>
        <button class="btn ghost block" data-act="passBuy" data-v="plus">Passe + 10 níveis · ${this.price('plus')}</button>
        <p class="ps-fine">Pagamento único pela Google Play, vale até o fim da temporada. Fica salvo na sua conta.</p>
      </section>`}

      <section class="v9-sec">
        <header class="v9-h"><h2>Seus itens</h2></header>
        <div class="ps-inv">
          <div><span>${I('flame')}</span><b class="num">${P.inv.s || 0}</b><small>Escudo de ofensiva</small><em>usa sozinho</em></div>
          <button data-act="passUse" data-v="z" ${P.inv.z > 0 ? '' : 'disabled'}><span>${I('shield')}</span><b class="num">${P.inv.z || 0}</b><small>Escudo de território</small><em>${P.inv.z > 0 ? 'Usar' : '—'}</em></button>
          <button data-act="passUse" data-v="b" ${P.inv.b > 0 && !P.boostNext ? '' : 'disabled'}><span>${I('zap')}</span><b class="num">${P.inv.b || 0}</b><small>Pontos em dobro</small><em>${P.boostNext ? 'Ativo no próximo treino' : P.inv.b > 0 ? 'Usar' : '—'}</em></button>
        </div>
        ${owned.length ? `<div class="ps-own">${owned.map((it) => `<button class="${isOn(it) ? 'on' : ''}" data-act="passEquip" data-v="${it.cat}:${it.id}">${it.cat === 'mascot' ? this.mascotSvg(it.value === 'dragon' ? 'dragon' : 'egg', it.value === 'dragon' ? 3 : this.mascotStage(), 'xs') : I(this.itemIcon(it))}<span>${esc(it.name)}</span><em>${isOn(it) ? 'Em uso' : 'Usar'}</em></button>`).join('')}</div>` : ''}
        ${this.owns('sticker-t1') ? `<div class="ps-sticker">${I('award')}<span>Figurinha da ${S.name} conquistada</span></div>` : ''}
      </section>

      <section class="v9-sec ps-track">
        <header class="v9-h"><h2>Recompensas</h2></header>
        <div class="ps-cols"><span>Grátis</span><span></span><span>Premium</span></div>
        ${Array.from({ length: this.MAX }, (_, i) => i + 1).map((l) => `<div class="ps-row ${l <= lv ? 'done' : ''} ${l === lv ? 'cur' : ''}" ${l === lv ? 'id="psCur"' : ''}>${this.rowCell('f', l, l <= lv)}<span class="ps-n num">${l}</span>${this.rowCell('p', l, l <= lv)}</div>`).join('')}
      </section>

      <section class="v9-sec ps-how">
        <header class="v9-h"><h2>Como ganhar pontos</h2></header>
        <dl><div><dt>Cada treino</dt><dd class="num">${this.PTS.act} + ${this.PTS.perKm}/km</dd></div><div><dt>Missão diária</dt><dd class="num">${this.PTS.d}</dd></div><div><dt>Missão semanal</dt><dd class="num">${this.PTS.w}</dd></div><div><dt>Missão do mês</dt><dd class="num">${this.PTS.m}</dd></div></dl>
        <p class="ps-fine">Treinos a partir de 1 km ou 10 minutos. Até 15 km por treino contam. Cada nível precisa de ${this.PER_LEVEL} pontos.</p>
      </section>
    </main>`;
  },
};

/* ---------- ligações com o resto do app ---------- */
(() => {
  // itens do passe valem como itens da loja (cores, molduras, temas, chegada)
  const item0 = Shop.item.bind(Shop);
  Shop.item = (id) => item0(id) || Pass.ITEMS.find((x) => x.id === id && ['line', 'frame', 'avatar', 'theme', 'finish'].includes(x.cat)) || null;
  // Tema Oceano: usa a base escura e troca as cores
  const ap = Shop.apply.bind(Shop);
  Shop.apply = function () { ap(); const r = document.documentElement, oc = r.dataset.theme === 'ocean'; if (oc) r.dataset.theme = 'midnight'; r.classList.toggle('t-ocean', oc); };
  Shop.lineStyle = () => { const id = Store.data.equipped.line, it = id && Pass.ITEMS.find((x) => x.id === id); return it ? it.style || null : null; };

  // chegada com arco e fogos
  const fin = FX.finish.bind(FX);
  FX.finish = function () {
    if ((typeof Shop !== 'undefined' && Shop.val('finish')) !== 'arch') return fin();
    const d = document.createElement('div'); d.className = 'arch-fx';
    d.innerHTML = `<svg viewBox="0 0 300 180"><path d="M30 180 V60 Q150 -10 270 60 V180" fill="none" stroke="#1858F0" stroke-width="16"/><rect x="40" y="38" width="220" height="34" rx="6" fill="#0F1B2D"/><g fill="#fff">${Array.from({ length: 22 }, (_, i) => `<rect x="${42 + i * 10}" y="${i % 2 ? 40 : 55}" width="10" height="15"/>`).join('')}</g><text x="150" y="112" text-anchor="middle" font-family="Barlow Cond, Barlow, sans-serif" font-weight="700" font-style="italic" font-size="38" fill="#0F1B2D">CHEGADA</text></svg>`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
    FX.beep([523, 659, 784, 1047, 1319]);
    FX.fireworks(); setTimeout(() => FX.fireworks(), 900);
  };
  const cel = FX.celebrate && FX.celebrate.bind(FX);
  if (cel) FX.celebrate = function (res) { const r = cel(res); if (Pass.equipped('voice') === 'voice-futebol' && Pref('voice')) setTimeout(() => FX.say('Gooooool! Fim de jogo! Que treino, que treino! Pode correr pro abraço!'), 1200); return r; };

  // pontos em dobro + recompensas novas ao terminar um treino
  const proc = Game.process.bind(Game);
  Game.process = function (act) {
    const P = Pass.st(), lv0 = Pass.level();
    if (P.boostNext && Pass.actPts(act) > 0) { act.passBoost = 1; P.boostNext = false; }
    const r = proc(act);
    try {
      const lv1 = Pass.level();
      r.pass = { pts: Pass.actPts(act), lv0, lv1 };
      if (Pass.active() && r.pass.pts) setTimeout(() => { FX.toast(lv1 > lv0 ? `${Pass.SEASON.name}: subiu para o nível ${lv1}!` : `+${r.pass.pts} pontos na ${Pass.SEASON.name}`); Pass.grant(); }, 2600);
    } catch (e) {}
    return r;
  };

  // pôster de cinema como modelo de imagem
  const tpls = ShareCard.tpls.bind(ShareCard);
  ShareCard.tpls = () => (Pass.equipped('poster') ? tpls().concat([['poster', 'Pôster']]) : tpls());
  const rend = ShareCard.render.bind(ShareCard);
  ShareCard.render = async function (act, tpl = this.tpl, fmt = this.fmt) {
    if (tpl !== 'poster' || !Pass.equipped('poster')) return rend(act, tpl === 'poster' ? 'map' : tpl, fmt);
    const [W, H] = this.size(fmt), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), sp = CONFIG.sports[act.sport] || {};
    try { await Promise.all(['700 80px "Barlow Cond"', 'italic 700 80px "Barlow Cond"', '600 30px Barlow'].map((f) => document.fonts.load(f))); } catch (e) {}
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0B1020'); g.addColorStop(0.55, '#1E1B4B'); g.addColorStop(1, '#0B1020'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // luz de holofote
    const rg = x.createRadialGradient(W / 2, H * 0.36, 40, W / 2, H * 0.36, W * 0.75); rg.addColorStop(0, 'rgba(255,90,31,.35)'); rg.addColorStop(1, 'rgba(255,90,31,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    // percurso
    const pts = act.points || [];
    if (pts.length > 1) {
      const R = this.fit(act, 120, H * 0.12, W - 240, H * 0.46);
      if (R) { x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = '#FF5A1F'; x.shadowBlur = 40; x.strokeStyle = '#FF7A3D'; x.lineWidth = 14; this.path(x, R); x.stroke(); x.shadowBlur = 0; x.strokeStyle = '#FFE0B2'; x.lineWidth = 4; this.path(x, R); x.stroke(); x.restore(); }
    }
    const km = (act.distance || 0) / 1000, big = km >= 42 ? 'MARATONA' : km >= 21 ? 'MEIA' : `${km >= 10 ? Math.floor(km) : km.toFixed(1).replace('.', ',')}K`;
    const name = (Store.data.profile.name || 'Atleta').toUpperCase();
    x.textAlign = 'center'; x.fillStyle = '#F5B841'; x.font = '600 34px Barlow, sans-serif'; x.fillText(`${name} EM`, W / 2, H * 0.66);
    x.fillStyle = '#fff'; x.font = `italic 700 ${fmt === 'story' ? 300 : 250}px "Barlow Cond", sans-serif`; x.fillText(big, W / 2, H * 0.66 + (fmt === 'story' ? 270 : 220));
    const tag = ['Cada passo, uma cena.', 'Baseado em fatos suados.', 'Uma história de superação.', 'Sem dublê.'][Math.floor((act.start || 0) / 864e5) % 4];
    x.font = 'italic 500 40px Barlow, sans-serif'; x.fillStyle = '#E2E8F0'; x.fillText(tag, W / 2, H * 0.66 + (fmt === 'story' ? 350 : 290));
    // créditos de cinema
    const date = new Date(act.start).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    x.font = '500 26px "Barlow Cond", sans-serif'; x.fillStyle = 'rgba(226,232,240,.75)';
    const cred = `UM TREINO DE ${sp.name ? sp.name.toUpperCase() : 'JUSTGO'}  ·  ${Fmt.km(act.distance)} KM  ·  ${Fmt.time(act.moving ? act.moving / 1000 : act.duration)}  ·  ${date.toUpperCase()}`;
    x.fillText(cred, W / 2, H - 150);
    x.font = '700 30px "Barlow Cond", sans-serif'; x.fillStyle = '#fff'; x.fillText('EM CARTAZ NO JUSTGO', W / 2, H - 100);
    return c;
  };

  // título ao lado do nome no perfil e mascote
  const prof = UI.profile && UI.profile.bind(UI);
  if (prof) UI.profile = function (...a) {
    const r = prof(...a);
    try {
      const t = Pass.title(), h = document.querySelector('.screen h1, .pf2-name, .pf-name');
      if (t && h && !h.querySelector('.pt-chip')) h.insertAdjacentHTML('beforeend', ` <span class="pt-chip" style="--c:${t.color}">${esc(t.name)}</span>`);
      const m = Pass.mascotNow('md');
      if (m) { const anchor = document.querySelector('.qp8') || document.querySelector('.pf2-btns'); if (anchor && !document.querySelector('.ps-pf')) anchor.insertAdjacentHTML('afterend', `<button class="ps-pf" data-act="go" data-v="pass">${m}<span class="grow"><b>Seu mascote</b><small>${esc(Pass.mascotLabel())}</small></span>${I('chevronRight', 'xs')}</button>`); }
    } catch (e) {}
    return r;
  };

  // tela e ações
  UI.pass = function () {
    this.render(`${this.back('home', 'Temporada')}${Pass.view()}`);
    setTimeout(() => { const c = $('#psCur'); if (c && Pass.level() > 3) c.scrollIntoView({ block: 'center' }); }, 60);
    if (Native.on && !Object.keys(Pass.prices).length) Pass.loadPrices().then(() => { if (App.tab === 'pass') { const y = window.scrollY; UI.render(`${UI.back('home', 'Temporada')}${Pass.view()}`); window.scrollTo(0, y); } }).catch(() => {});
  };
  App.parents.pass = 'home';
  Object.assign(App.actions, {
    passBuy: (el) => Pass.buy(el.dataset.v),
    passUse: (el) => (el.dataset.v === 'z' ? Pass.useZone() : Pass.useBoost()),
    passEquip: (el) => { const [c, id] = el.dataset.v.split(':'); Pass.equip(c, id); UI.pass(); },
    passInfo: (el) => {
      const [tr, l] = el.dataset.v.split(':'), lv = +l, r = Pass.reward(tr, lv), i = Pass.rewardInfo(r);
      const locked = tr === 'p' && !Pass.premium(), reached = Pass.level() >= lv;
      const art = i.kind === 'item' && i.item.cat === 'mascot' ? Pass.mascotSvg(i.item.value === 'dragon' ? 'dragon' : 'egg', i.item.value === 'dragon' ? 3 : 1) : `<div class="m-hero">${I(i.ic)}</div>`;
      FX.modal(`<div class="ps-info">${art}<span class="ps-tag ${tr}">${tr === 'p' ? 'Premium' : 'Grátis'} · nível ${lv}</span><h3>${esc(i.name)}</h3>${i.desc ? `<p class="muted">${esc(i.desc)}</p>` : ''}
        <p class="ps-state">${locked ? 'Faz parte do Passe Premium.' : reached ? 'Você já ganhou.' : `Faltam ${lv - Pass.level()} níveis.`}</p>
        ${locked ? `<button class="btn primary" data-m="buy">Ver Passe Premium</button>` : `<button class="btn primary" data-m="ok">Fechar</button>`}</div>`).then((v) => { if (v === 'buy') { const b = document.querySelector('.ps-buy'); if (b) b.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    },
  });

  // compras e escudos ao abrir e ao entrar na conta
  const al = Cloud.afterLogin.bind(Cloud);
  Cloud.afterLogin = async function (...a) {
    const r = await al(...a);
    setTimeout(() => { Pass.loadEnt(); if (Pass._waiting) { const w = Pass._waiting; Pass._waiting = null; Pass.onBilling(w); } }, 1500);
    return r;
  };
  setTimeout(() => { try { Pass.st(); Pass.grant(true); Pass.autoStreak(); } catch (e) {} }, 3000);
})();
window.Pass = Pass;
