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
  // t: teste de 7 dias de uma função · u: liberar uma função para sempre
  FREE: [
    ['i', 'mascot-egg'], ['c', 50], ['s', 1], ['i', 'line-ice'], ['i', 'flag'], ['b', 1], ['t', 1], ['c', 100], ['z', 1], ['i', 'line-speed'],
    ['c', 50], ['i', 'frame-silver'], ['b', 1], ['c', 75], ['i', 'title'], ['c', 50], ['z', 1], ['i', 'av-ocean'], ['c', 75], ['s', 1],
    ['t', 1], ['b', 1], ['i', 'line-lime'], ['c', 75], ['c', 100], ['z', 1], ['c', 50], ['i', 'fx-pulse'], ['c', 75], ['s', 1],
    ['c', 50], ['b', 1], ['i', 'av-forest'], ['c', 75], ['c', 100], ['z', 1], ['t', 1], ['i', 'frame-verao'], ['c', 75], ['s', 1],
    ['c', 50], ['b', 1], ['c', 75], ['i', 'line-violet'], ['c', 150], ['z', 1], ['c', 75], ['s', 1], ['c', 100], ['i', 'sticker-t1'],
  ],
  PREMIUM: [
    ['i', 'line-flame'], ['c', 150], ['i', 'frame-fire'], ['b', 2], ['i', 'poster'], ['t', 2], ['s', 2], ['i', 'theme-midnight'], ['u', 1], ['i', 'line-neon'],
    ['z', 2], ['i', 'ghost-wolf'], ['c', 150], ['i', 'av-aurora'], ['b', 2], ['t', 2], ['i', 'frame-gold'], ['i', 'voice-futebol'], ['u', 1], ['s', 2],
    ['i', 'line-gold'], ['c', 150], ['i', 'theme-graphite'], ['i', 'fx-arch'], ['c', 250], ['b', 3], ['i', 'av-sunset'], ['z', 3], ['u', 1], ['i', 'frame-aurora'],
    ['i', 'line-ruby'], ['t', 2], ['s', 3], ['i', 'theme-ocean'], ['c', 250], ['b', 3], ['i', 'frame-diamond'], ['u', 1], ['i', 'line-platinum'], ['z', 3],
    ['t', 3], ['i', 'av-galaxy'], ['b', 3], ['i', 'frame-legend'], ['c', 300], ['s', 3], ['i', 'line-lava'], ['c', 250], ['i', 'title-legend'], ['i', 'mascot-dragon'],
  ],

  /* ---------- estado ---------- */
  st() {
    const D = Store.data;
    if (!D.pass) D.pass = {};
    const P = D.pass;
    P.got = P.got || {}; P.inv = P.inv || {}; ['s', 'z', 'b', 't', 'u'].forEach((k) => (P.inv[k] = P.inv[k] || 0)); P.ent = P.ent || {}; P.eq = P.eq || {};
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
    if (t === 't') return { ic: 'timer', name: v > 1 ? `${v} testes de 7 dias` : 'Teste de 7 dias', short: `×${v}`, kind: 'trial', useful: 1, desc: 'Escolha uma função ainda bloqueada (ex.: Fantasma, Planos de treino, Segmentos) e use por 7 dias.' };
    if (t === 'u') return { ic: 'unlock', name: 'Função liberada para sempre', short: '×1', kind: 'unlock', useful: 1, desc: 'Escolha qualquer função bloqueada e ela fica sua para sempre, sem precisar dos km.' };
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
      else if ('szbtu'.includes(t)) P.inv[t] = (P.inv[t] || 0) + v;
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
  locked() {
    const D = Store.data;
    return CONFIG.unlocks.filter((u) => !D.unlocked[u.id] && (typeof Game.relevant !== 'function' || Game.relevant(u)));
  },
  async pickUnlock(title, sub) {
    const L = this.locked();
    if (!L.length) { FX.toast('Você já liberou todas as funções. Guarde para a próxima temporada!'); return null; }
    const v = await FX.modal(`<h3>${title}</h3><p class="muted">${sub}</p><div class="ps-pick">${L.map((u) => `<button data-m="${u.id}">${I(u.icon || 'unlock')}<span class="grow"><b>${esc(u.name)}</b><small>${esc(u.desc || '')}</small></span>${Ads && Ads.trialOn && Ads.trialOn(u.id) ? '<em>em teste</em>' : ''}</button>`).join('')}</div><button class="btn ghost block" data-m="no">Agora não</button>`);
    return v && v !== 'no' && v !== 'ok' ? CONFIG.unlocks.find((u) => u.id === v) : null;
  },
  async useTrial() {
    const P = this.st(); if (!(P.inv.t > 0)) return;
    const u = await this.pickUnlock('Testar uma função por 7 dias', 'Escolha o que você quer usar. Depois dos 7 dias, volta a ficar bloqueada até você bater a meta.');
    if (!u) return;
    const D = Store.data; D.trials = D.trials || {}; const until = Math.max(D.trials[u.id] || 0, Date.now()) + 7 * 864e5;
    D.trials[u.id] = until; (u.needs || []).forEach((n) => { if (!D.unlocked[n]) D.trials[n] = Math.max(D.trials[n] || 0, until); });
    P.inv.t--; Store.save(); FX.beep([523, 784]);
    FX.toast(`${u.name} liberada por 7 dias.`); if (App.tab === 'pass') UI.pass();
  },
  async useUnlock() {
    const P = this.st(); if (!(P.inv.u > 0)) return;
    const u = await this.pickUnlock('Liberar uma função para sempre', 'Escolha bem: ela fica sua de vez, sem precisar dos km.');
    if (!u) return;
    const D = Store.data; D.unlocked[u.id] = Date.now(); (u.needs || []).forEach((n) => { if (!D.unlocked[n]) D.unlocked[n] = Date.now(); });
    P.inv.u--; Store.save(); FX.beep([523, 659, 784, 1047]); FX.vibrate([30, 40, 30]);
    FX.modal(`<div class="ps-info"><div class="m-hero">${I(u.icon || 'unlock')}</div><h3>${esc(u.name)} é sua!</h3><p class="muted">Liberada para sempre. Já pode usar.</p><button class="btn primary" data-m="ok">Boa!</button></div>`);
    if (App.tab === 'pass') UI.pass();
  },
  // próxima recompensa que vale mostrar (prioriza itens e coisas úteis)
  nextGood() {
    const lv = this.level(), prem = this.premium();
    for (let l = lv + 1; l <= this.MAX; l++) {
      for (const tr of prem ? ['p', 'f'] : ['f', 'p']) {
        const r = this.reward(tr, l); if (!r) continue;
        const i = this.rewardInfo(r);
        if (i.kind === 'item' || i.useful) return { l, tr, i, r };
      }
    }
    return null;
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

  /* ---------- cartão do Início (bem visível) ---------- */
  // aviso de estreia, uma vez
  intro() {
    const P = this.st(); if (P.introSeen === this.SEASON.id || !this.active()) return;
    P.introSeen = this.SEASON.id; Store.save();
    FX.modal(`<div class="ps-intro"><div class="psi-art">${this.mascotSvg('egg', 0)}${this.mascotSvg('dragon', 3)}</div>
      <h3>Chegou a ${this.SEASON.name}</h3>
      <p class="muted">50 níveis de recompensas até ${new Date(this.SEASON.end + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}. Você sobe treinando e completando missões, como sempre.</p>
      <ul class="ps-best"><li>${I('sparkles')}<span><b>Ovo do mascote</b> agora: choca com 10 km</span></li><li>${I('unlock')}<span><b>Testes de funções</b>, escudos e pontos em dobro</span></li><li>${I('crown')}<span><b>Título que evolui</b> ao lado do seu nome</span></li></ul>
      <button class="btn primary block" data-m="go">Ver a temporada</button><button class="btn ghost block" data-m="no">Depois</button></div>`).then((v) => { if (v === 'go') App.go('pass'); });
  },

  /* ---------- arte de cada recompensa (desenhada, com as cores reais do item) ---------- */
  RARITY: { c: ['Comum', '#94A3B8'], r: ['Raro', '#38BDF8'], e: ['Épico', '#A78BFA'], l: ['Lendário', '#F5B841'] },
  rarity(r) {
    const [t, v] = r;
    if (t === 'c') return v >= 200 ? 'r' : 'c';
    if (t === 's' || t === 'z') return v >= 3 ? 'r' : 'c';
    if (t === 'b' || t === 't') return 'r';
    if (t === 'u') return 'l';
    const L = { 'mascot-dragon': 'l', 'title-legend': 'l', 'fx-arch': 'l', 'voice-futebol': 'e', 'ghost-wolf': 'e', 'line-flame': 'e', 'line-lava': 'l', 'frame-legend': 'l', 'poster': 'e', 'mascot-egg': 'r', 'theme-ocean': 'e', 'frame-diamond': 'e', 'sticker-t1': 'e', 'title': 'r', 'flag': 'r', 'line-speed': 'r' };
    return L[v] || (/^(theme|frame)-/.test(v) ? 'e' : 'r');
  },
  art(r) {
    const [t, v] = r, it = t === 'i' ? this.item(v) : null;
    const svg = (inner, vb = '0 0 80 80') => `<svg class="ps-art" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
    if (t === 'c') {
      const n = v >= 200 ? 4 : v >= 100 ? 3 : 2;
      return svg(Array.from({ length: n }, (_, k) => `<g transform="translate(${18 + k * 9} ${46 - k * 8})"><ellipse cx="12" cy="14" rx="15" ry="6" fill="#B45309"/><ellipse cx="12" cy="10" rx="15" ry="6" fill="#F5B841"/><ellipse cx="12" cy="10" rx="9" ry="3.4" fill="none" stroke="#FDE68A" stroke-width="1.6"/></g>`).join('') + `<text x="40" y="76" text-anchor="middle" class="ps-art-n">${v}</text>`);
    }
    if (t === 's') return svg(`<path d="M40 10 L64 20 V40 C64 55 53 66 40 72 C27 66 16 55 16 40 V20Z" fill="#1E293B" stroke="#FB923C" stroke-width="3"/><path d="M40 26 C46 34 50 38 50 46 C50 53 45 58 40 58 C35 58 30 53 30 46 C30 41 33 38 35 35 C36 39 38 41 40 41 C40 36 38 31 40 26Z" fill="#FB923C"/><path d="M40 44 C43 47 44 49 44 51 C44 54 42 56 40 56 C38 56 36 54 36 51 C36 49 38 47 40 44Z" fill="#FDE68A"/>${v > 1 ? `<text x="66" y="74" text-anchor="end" class="ps-art-n">×${v}</text>` : ''}`);
    if (t === 'z') return svg(`<path d="M40 10 L64 20 V40 C64 55 53 66 40 72 C27 66 16 55 16 40 V20Z" fill="#1858F0" stroke="#93C5FD" stroke-width="3"/><path d="M28 42 L36 36 L44 44 L52 34" stroke="#fff" stroke-width="3.5" fill="none" stroke-linejoin="round"/><path d="M28 50 H52" stroke="#93C5FD" stroke-width="3"/>${v > 1 ? `<text x="66" y="74" text-anchor="end" class="ps-art-n">×${v}</text>` : ''}`);
    if (t === 'b') return svg(`<circle cx="40" cy="38" r="26" fill="#FDE047"/><circle cx="40" cy="38" r="26" fill="none" stroke="#CA8A04" stroke-width="3"/><text x="40" y="47" text-anchor="middle" font-family="Barlow Cond, sans-serif" font-weight="700" font-style="italic" font-size="26" fill="#713F12">2×</text>${v > 1 ? `<text x="66" y="76" text-anchor="end" class="ps-art-n">×${v}</text>` : ''}`);
    if (t === 't') return svg(`<circle cx="40" cy="42" r="24" fill="#0EA5E9"/><circle cx="40" cy="42" r="18" fill="#E0F2FE"/><path d="M40 30 V42 L48 47" stroke="#0369A1" stroke-width="3.5" stroke-linecap="round" fill="none"/><rect x="34" y="12" width="12" height="6" rx="2" fill="#0369A1"/><text x="40" y="76" text-anchor="middle" class="ps-art-n">7 dias${v > 1 ? ` ×${v}` : ''}</text>`);
    if (t === 'u') return svg(`<rect x="18" y="36" width="44" height="32" rx="7" fill="#F5B841"/><path d="M28 36 V26 C28 18 34 13 41 13 C48 13 53 18 53 24" stroke="#F5B841" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="40" cy="50" r="5" fill="#713F12"/><rect x="38" y="52" width="4" height="9" rx="2" fill="#713F12"/><g fill="#FDE68A"><circle cx="66" cy="20" r="2.5"/><circle cx="14" cy="28" r="2"/></g>`);
    if (!it) return svg(`<circle cx="40" cy="40" r="24" fill="#334155"/>`);
    const route = 'M10 60 C22 36 30 64 40 42 C50 20 58 52 70 22';
    switch (it.cat) {
      case 'line':
        if (it.style === 'flame') return svg(`<path d="${route}" stroke="#FF5A1F" stroke-width="14" fill="none" stroke-linecap="round" opacity=".3"/><path d="${route}" stroke="${it.id === 'line-lava' ? '#FF1F00' : '#FF3D00'}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="${route}" stroke="#FFD54A" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 8"/><path d="M66 14 C70 20 74 22 74 28 C74 32 71 34 68 34 C65 34 62 32 62 28 C62 25 64 24 65 22 C66 24 67 25 68 25 C68 22 66 18 66 14Z" fill="#FDBA74"/>`);
        if (it.style === 'speed') return svg(`<defs><linearGradient id="spg" x1="0" x2="1"><stop offset="0" stop-color="#2563EB"/><stop offset=".4" stop-color="#22C55E"/><stop offset=".7" stop-color="#EAB308"/><stop offset="1" stop-color="#EF4444"/></linearGradient></defs><path d="${route}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/><path d="${route}" stroke="url(#spg)" stroke-width="6" fill="none" stroke-linecap="round"/>`);
        return svg(`<path d="${route}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/><path d="${route}" stroke="${it.value}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="10" cy="60" r="5" fill="#22C55E" stroke="#fff" stroke-width="2"/>`);
      case 'frame': case 'avatar':
        return `<span class="ps-art ps-art-av ${it.cat}" style="--v:${it.value}"><i>${esc((Store.data.profile.name || 'A').trim()[0] || 'A')}</i></span>`;
      case 'theme': {
        const C = { 'theme-midnight': ['#070B16', '#151E31', '#3D7FFF'], 'theme-graphite': ['#16181B', '#262A30', '#E5E7EB'], 'theme-ocean': ['#02101F', '#0C2A45', '#22D3EE'] }[it.id] || ['#0B0C0E', '#1D2024', '#3D7FFF'];
        return svg(`<rect x="22" y="8" width="36" height="64" rx="7" fill="${C[0]}" stroke="#475569" stroke-width="2"/><rect x="27" y="16" width="26" height="10" rx="3" fill="${C[1]}"/><rect x="27" y="30" width="26" height="18" rx="3" fill="${C[1]}"/><path d="M29 44 l6 -6 l5 4 l9 -10" stroke="${C[2]}" stroke-width="2.5" fill="none"/><rect x="27" y="52" width="16" height="4" rx="2" fill="${C[2]}"/><rect x="27" y="59" width="22" height="4" rx="2" fill="${C[1]}"/>`);
      }
      case 'finish':
        if (it.value === 'arch') return svg(`<g fill="#F5B841"><circle cx="16" cy="14" r="2.5"/><circle cx="66" cy="10" r="2.5"/><circle cx="40" cy="6" r="2"/></g><path d="M14 74 V34 Q40 10 66 34 V74" fill="none" stroke="#1858F0" stroke-width="7"/><rect x="16" y="26" width="48" height="12" rx="3" fill="#0F172A"/><g fill="#fff">${Array.from({ length: 8 }, (_, k) => `<rect x="${18 + k * 5.5}" y="${k % 2 ? 27 : 32}" width="5.5" height="5"/>`).join('')}</g><text x="40" y="58" text-anchor="middle" font-family="Barlow Cond, sans-serif" font-weight="700" font-style="italic" font-size="13" fill="#E2E8F0">CHEGADA</text>`);
        return svg(`<circle cx="40" cy="40" r="10" fill="#38BDF8"/><circle cx="40" cy="40" r="20" fill="none" stroke="#38BDF8" stroke-width="3" opacity=".6"/><circle cx="40" cy="40" r="30" fill="none" stroke="#38BDF8" stroke-width="2" opacity=".3"/>`);
      case 'mascot': return it.value === 'dragon' ? this.mascotSvg('dragon', 3, 'ps-art') : this.mascotSvg('egg', 0, 'ps-art');
      case 'ghost': return svg(`<circle cx="40" cy="40" r="30" fill="#312E81"/><path d="M18 22 L28 40 L40 32 L52 40 L62 22 L58 48 C58 60 50 68 40 68 C30 68 22 60 22 48Z" fill="#A5B4FC"/><path d="M29 47 L36 49 L31 53Z M51 47 L44 49 L49 53Z" fill="#FDE047"/><path d="M36 60 L40 64 L44 60" fill="#312E81"/><g stroke="#A5B4FC" stroke-width="2.5" stroke-linecap="round" opacity=".7"><path d="M4 34 H12"/><path d="M2 44 H10"/><path d="M5 54 H12"/></g>`);
      case 'voice': return svg(`<rect x="8" y="10" width="64" height="30" rx="8" fill="#fff" stroke="#DC2626" stroke-width="3"/><path d="M28 40 L24 50 L36 40Z" fill="#fff" stroke="#DC2626" stroke-width="3" stroke-linejoin="round"/><text x="40" y="32" text-anchor="middle" font-family="Barlow Cond, sans-serif" font-weight="700" font-style="italic" font-size="17" fill="#B91C1C">GOOOL!</text><rect x="46" y="48" width="12" height="18" rx="6" fill="#E11D48"/><path d="M42 60 C42 68 62 68 62 60" stroke="#E11D48" stroke-width="2.5" fill="none"/>`);
      case 'poster': return svg(`<rect x="18" y="6" width="44" height="68" rx="4" fill="#1E1B4B" stroke="#F5B841" stroke-width="2"/><path d="M24 34 C30 22 36 36 42 24 C48 14 52 26 56 18" stroke="#FF7A3D" stroke-width="3" fill="none" stroke-linecap="round"/><text x="40" y="56" text-anchor="middle" font-family="Barlow Cond, sans-serif" font-weight="700" font-style="italic" font-size="18" fill="#fff">10K</text><rect x="28" y="62" width="24" height="3" rx="1.5" fill="#F5B841"/>`);
      case 'flag': return svg(`<ellipse cx="34" cy="70" rx="20" ry="5" fill="none" stroke="#3D7FFF" stroke-width="2.5" stroke-dasharray="4 4"/><rect x="32" y="12" width="4" height="58" rx="2" fill="#E2E8F0"/><path d="M36 14 H66 L58 26 L66 38 H36Z" fill="#1858F0"/><path d="M44 26 H58" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`);
      case 'title': return it.value === 'legend'
        ? svg(`<path d="M14 54 L20 24 L32 38 L40 18 L48 38 L60 24 L66 54Z" fill="#A855F7" stroke="#F5B841" stroke-width="3" stroke-linejoin="round"/><rect x="14" y="56" width="52" height="8" rx="3" fill="#F5B841"/><circle cx="40" cy="44" r="5" fill="#FDE68A"/>`)
        : svg(`<g transform="translate(0 4)"><circle cx="24" cy="30" r="12" fill="#B4703A"/><circle cx="40" cy="22" r="12" fill="#94A3B8"/><circle cx="56" cy="30" r="12" fill="#D4A017"/><path d="M40 46 L52 58 L40 72 L28 58Z" fill="#38BDF8" stroke="#E0F2FE" stroke-width="2"/></g>`);
      case 'sticker': return svg(`<circle cx="40" cy="40" r="30" fill="#FDE047" stroke="#fff" stroke-width="4"/><path d="M40 20 l5 11 l12 1 l-9 8 l3 12 l-11 -6 l-11 6 l3 -12 l-9 -8 l12 -1z" fill="#F97316"/><text x="40" y="66" text-anchor="middle" font-family="Barlow Cond, sans-serif" font-weight="700" font-size="9" fill="#7C2D12">VERÃO 26</text>`);
    }
    return svg(`<circle cx="40" cy="40" r="24" fill="#334155"/>`);
  },

  /* ---------- tela: "Rota do Verão" ----------
     A temporada é uma prova de 50 km. O nível é o seu número de peito,
     cada nível é um marco de km na estrada e cada prêmio é uma placa:
     verde (grátis, como as placas de rodovia) e marrom (premium, como
     as placas de atrativo turístico). */
  pins() { return ['tl', 'tr', 'bl', 'br'].map((p) => `<i class="pin ${p}"><svg viewBox="0 0 30 12"><path d="M3 6 H24 a3 3 0 0 0 0 -3 H6" fill="none" stroke="#9AA4B2" stroke-width="1.8" stroke-linecap="round"/><circle cx="3" cy="6" r="2.6" fill="#C8CFD8"/></svg></i>`).join(''); },
  bib(lv, small) {
    const S = this.SEASON, name = esc((Store.data.profile.name || 'Atleta').split(' ').slice(0, 2).join(' '));
    return `<div class="bib ${small ? 'sm' : ''}">${this.pins()}
      <div class="bib-top"><span>Corrida de Verão</span><span>Temporada 1</span></div>
      <div class="bib-num num">${lv}</div>
      <div class="bib-name">${name}</div>
      <div class="bib-chip"><span>${this.premium() ? 'PREMIUM' : 'KM ' + lv + ' / ' + this.MAX}</span><i></i></div>
    </div>`;
  },
  card(track, lv, cur) {
    const r = this.reward(track, lv); if (!r) return '<div class="sg empty"></div>';
    const i = this.rewardInfo(r), locked = track === 'p' && !this.premium(), big = this.rarity(r) === 'l' || this.rarity(r) === 'e';
    const got = (this.st().got[this.SEASON.id] || {})[track + lv];
    return `<button class="sg ${track} ${got ? 'got' : ''} ${lv <= cur ? 'reached' : ''} ${locked ? 'locked' : ''} ${big ? 'big' : ''}" data-act="passPick" data-v="${track}:${lv}">
      <span class="sg-face"><span class="sg-pic">${this.art(r)}</span><span class="sg-name">${esc(i.name)}</span>${got ? '<em class="sg-stamp">PEGO</em>' : locked ? `<em class="sg-lock">${I('lock', 'xs')}</em>` : ''}</span>
      <span class="sg-post"></span>
    </button>`;
  },
  detail(track, lv) {
    const r = this.reward(track, lv), i = this.rewardInfo(r);
    const locked = track === 'p' && !this.premium(), cur = this.level(), got = (this.st().got[this.SEASON.id] || {})[track + lv];
    const n = lv - cur, state = got ? 'Já é seu' : locked ? (n <= 0 ? 'Libera na hora com o Premium' : `Premium · faltam ${n} km`) : `Faltam ${n} km`;
    return `<div class="pd2 ${track}"><div class="pd2-pic">${this.art(r)}</div><div class="pd2-t"><span class="pd2-k">KM ${lv} · ${track === 'p' ? 'Premium' : 'Grátis'}</span><b>${esc(i.name)}</b>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}<span class="pd2-st ${got ? 'ok' : locked ? 'lock' : ''}">${state}</span></div></div>`;
  },
  view() {
    this.st(); this.grant(true);
    const pts = this.points(), lv = this.level(pts), into = pts - (lv - 1) * this.PER_LEVEL, max = lv >= this.MAX, prem = this.premium();
    const P = this.st(), days = this.daysLeft(), S = this.SEASON;
    const owned = this.ITEMS.filter((x) => this.owns(x.id) && x.cat !== 'sticker');
    const isOn = (it) => (['line', 'frame', 'avatar', 'theme', 'finish'].includes(it.cat) ? Store.data.equipped[it.cat] === it.id : P.eq[it.cat] === it.id);
    const sel = this._sel || ['p', Math.min(this.MAX, lv + (lv < this.MAX ? 1 : 0))];
    const inv = [['s', 'Escudo de ofensiva', 'usa sozinho'], ['z', 'Escudo de território', 'Usar'], ['b', 'Pontos em dobro', P.boostNext ? 'no próximo treino' : 'Usar'], ['t', 'Teste de 7 dias', 'Escolher'], ['u', 'Liberar função', 'Escolher']];
    const end = new Date(S.end + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    return `<main class="screen rv">
      <section class="rv-hero">
        <div class="rv-sun"></div>
        <svg class="rv-hills" viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M0 70 C60 30 110 55 160 40 C220 20 260 60 320 38 C360 24 385 40 400 34 V90 H0Z" fill="#F7D79B"/><path d="M0 80 C80 60 140 78 220 64 C290 52 340 72 400 60 V90 H0Z" fill="#EFC27A"/></svg>
        <div class="rv-hero-in">
          <div class="rv-head"><span class="rv-k">${this.active() ? `Faltam ${days} dias · até ${end}` : Date.now() < this.win()[0] ? 'A largada é em breve' : 'Prova encerrada'}</span><h1>${S.name}</h1></div>
          ${this.bib(lv)}
          <div class="rv-prog"><div class="rv-prog-t"><b class="num">${max ? 'Chegada!' : `${this.PER_LEVEL - into} pts`}</b><span>${max ? 'Você completou os 50 km da temporada' : `para o KM ${lv + 1}`}</span></div><div class="rv-prog-bar"><i style="width:${max ? 100 : (into / this.PER_LEVEL) * 100}%"></i></div></div>
        </div>
      </section>

      <section class="rv-road-wrap">
        <div class="rv-road-scroll" id="psTrack">
          <div class="rv-road" style="--n:${this.MAX};--done:${lv}">
            <div class="rv-asphalt"><i class="rv-trail"></i></div>
            ${Array.from({ length: this.MAX }, (_, k) => k + 1).map((l) => `<div class="rv-col ${l <= lv ? 'done' : ''} ${l === lv ? 'cur' : ''}" ${l === lv ? 'id="psCur"' : ''}>
              ${this.card('p', l, lv)}
              <div class="rv-km"><span class="num">${l}</span>${l === lv ? `<div class="rv-me">${this.mascotNow('xs') || this.mascotSvg('egg', 0, 'xs')}</div>` : ''}</div>
              ${this.card('f', l, lv)}
            </div>`).join('')}
            <div class="rv-finish"><span>CHEGADA</span></div>
          </div>
        </div>
        <div class="rv-legend"><span class="lg-p">Placas marrons · Premium</span><span class="lg-f">Placas verdes · Grátis</span></div>
        <div class="rv-detail" id="psDetail">${this.detail(sel[0], sel[1])}</div>
      </section>

      ${prem ? `<section class="rv-kit on"><div class="grow"><b>Inscrição Premium confirmada</b><small>Sem anúncios e com todas as placas marrons liberadas.</small></div><button class="btn" data-act="passBuy" data-v="skip">+3 km · ${this.price('skip')}</button></section>`
      : `<section class="rv-kit">
        <div class="kit-tag">INSCRIÇÃO PREMIUM</div>
        <h2>O kit completo da prova</h2>
        <p class="kit-sub">Libera as 50 placas marrons. As dos km que você já passou chegam na hora.</p>
        <ul class="kit-list">
          <li>${this.art(['i', 'mascot-dragon'])}<div><b>Dragão lendário</b><small>no KM 50, só para quem tem o kit</small></div></li>
          <li>${this.art(['i', 'line-flame'])}<div><b>Rastro de chamas</b><small>já no seu próximo treino</small></div></li>
          <li>${this.art(['u', 1])}<div><b>4 funções para sempre</b><small>você escolhe quais</small></div></li>
          <li>${this.art(['i', 'voice-futebol'])}<div><b>Narrador de futebol e fantasma de lobo</b><small>o treino vira um jogo</small></div></li>
          <li>${this.art(['b', 1])}<div><b>Sem anúncios</b><small>escudos, XP em dobro e testes na hora</small></div></li>
        </ul>
        <button class="btn kit-cta" data-act="passBuy" data-v="pass"><span>Fazer inscrição Premium</span><b><s>${this.PRODUCTS.pass.was}</s>${this.price('pass')}</b></button>
        <button class="btn kit-cta2" data-act="passBuy" data-v="plus">Inscrição + 10 km na frente · ${this.price('plus')}</button>
        <p class="ps-fine">Pagamento único pela Google Play, vale até ${end}. Fica salvo na sua conta.</p>
      </section>`}

      <section class="v9-sec rv-bag">
        <header class="v9-h"><h2>Sua mochila</h2></header>
        <div class="p2-inv">${inv.map(([k, name, act]) => { const n = P.inv[k] || 0, can = k !== 's' && n > 0 && !(k === 'b' && P.boostNext); return `<${can ? `button data-act="passUse" data-v="${k}"` : 'div'} class="${n ? 'has' : ''}"><span class="p2-ii">${this.art([k, 1])}</span><b class="num">${n}</b><small>${name}</small>${can || k === 's' || (k === 'b' && P.boostNext) ? `<em>${act}</em>` : ''}</${can ? 'button' : 'div'}>`; }).join('')}</div>
        ${owned.length ? `<h3 class="p2-sub">Visuais da temporada</h3><div class="rv-own">${owned.map((it) => `<button class="${isOn(it) ? 'on' : ''}" data-act="passEquip" data-v="${it.cat}:${it.id}"><span class="p2-oa">${it.cat === 'mascot' && it.value === 'egg' ? this.mascotSvg('egg', this.mascotStage(), 'ps-art') : this.art(['i', it.id])}</span><span class="p2-on">${esc(it.name)}</span><em>${isOn(it) ? 'Em uso' : 'Usar'}</em></button>`).join('')}</div>` : ''}
        ${this.owns('sticker-t1') ? `<div class="ps-sticker">${this.art(['i', 'sticker-t1'])}<span>Figurinha da ${S.name} conquistada</span></div>` : ''}
      </section>

      <section class="v9-sec rv-rules">
        <header class="v9-h"><h2>Regulamento</h2></header>
        <ol>
          <li><b>Cada ${this.PER_LEVEL} pontos = 1 km</b> na rota da temporada.</li>
          <li><b>Treino:</b> ${this.PTS.act} pontos + ${this.PTS.perKm} por km (vale a partir de 1 km ou 10 minutos, até 15 km).</li>
          <li><b>Missões:</b> diária ${this.PTS.d}, semanal ${this.PTS.w}, do mês ${this.PTS.m}.</li>
          <li><b>Pontos em dobro</b> valem para o próximo treino depois de usar.</li>
          <li>A prova termina em <b>${end}</b>. O que você ganhou continua seu.</li>
        </ol>
      </section>
    </main>`;
  },
  /* cartão do Início: o número de peito + a próxima placa */
  homeCard() {
    if (!this.active() && Date.now() > this.win()[1]) return '';
    try { this.grant(true); } catch (e) {}
    const pts = this.points(), lv = this.level(pts), into = pts - (lv - 1) * this.PER_LEVEL, max = lv >= this.MAX, nx = this.nextGood();
    return `<section class="rv-home tap" data-act="go" data-v="pass">
      ${this.bib(lv, true)}
      <div class="rvh-r">
        <span class="rvh-k">${this.SEASON.name} · faltam ${this.daysLeft()} dias</span>
        <div class="rvh-bar"><i style="width:${max ? 100 : (into / this.PER_LEVEL) * 100}%"></i></div>
        <small class="rvh-pts">${max ? 'Você chegou ao KM 50!' : `${this.PER_LEVEL - into} pts para o KM ${lv + 1}`}</small>
        ${nx ? `<div class="rvh-next ${nx.tr}"><span class="rvh-pic">${this.art(nx.r)}</span><span class="grow"><small>KM ${nx.l}${nx.tr === 'p' && !this.premium() ? ' · Premium' : ''}</small><b>${esc(nx.i.name)}</b></span></div>` : ''}
      </div>
    </section>`;
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
      if (Pass.active() && r.pass.pts) setTimeout(() => Pass.grant(), 2600);
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
    setTimeout(() => { const tr = $('#psTrack'), c = $('#psCur'); if (tr && c) tr.scrollLeft = c.offsetLeft - tr.clientWidth / 2 + c.clientWidth / 2; }, 60);
    if (Native.on && !Object.keys(Pass.prices).length) Pass.loadPrices().then(() => { if (App.tab === 'pass') { const y = window.scrollY; UI.render(`${UI.back('home', 'Temporada')}${Pass.view()}`); window.scrollTo(0, y); } }).catch(() => {});
  };
  App.parents.pass = 'home';
  Object.assign(App.actions, {
    passBuy: (el) => Pass.buy(el.dataset.v),
    passUse: (el) => ({ z: () => Pass.useZone(), b: () => Pass.useBoost(), t: () => Pass.useTrial(), u: () => Pass.useUnlock() }[el.dataset.v] || (() => {}))(),
    passEquip: (el) => { const [c, id] = el.dataset.v.split(':'); Pass.equip(c, id); UI.pass(); },
    passPick: (el) => {
      const [tr, l] = el.dataset.v.split(':'); Pass._sel = [tr, +l];
      const d = $('#psDetail'); if (d) { d.innerHTML = Pass.detail(tr, +l); d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }
      document.querySelectorAll('.sg.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel');
    },
    passInfo: (el) => {
      const [tr, l] = el.dataset.v.split(':'), lv = +l, r = Pass.reward(tr, lv), i = Pass.rewardInfo(r);
      const locked = tr === 'p' && !Pass.premium(), reached = Pass.level() >= lv;
      const art = i.kind === 'item' && i.item.cat === 'mascot' ? Pass.mascotSvg(i.item.value === 'dragon' ? 'dragon' : 'egg', i.item.value === 'dragon' ? 3 : 1) : `<div class="m-hero">${I(i.ic)}</div>`;
      FX.modal(`<div class="ps-info">${art}<span class="ps-tag ${tr}">${tr === 'p' ? 'Premium' : 'Grátis'} · nível ${lv}</span><h3>${esc(i.name)}</h3>${i.desc ? `<p class="muted">${esc(i.desc)}</p>` : ''}
        <p class="ps-state">${locked ? 'Faz parte do Passe Premium.' : reached ? 'Você já ganhou.' : `Faltam ${lv - Pass.level()} níveis.`}</p>
        ${locked ? `<button class="btn primary" data-m="buy">Ver Passe Premium</button>` : `<button class="btn primary" data-m="ok">Fechar</button>`}</div>`).then((v) => { if (v === 'buy') { const b = document.querySelector('.ps-buy'); if (b) b.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    },
  });

  // Premium: recompensas dos anúncios sem precisar assistir
  if (typeof Ads !== 'undefined') {
    const show = Ads.show.bind(Ads);
    Ads.show = async function (kind) { if (Pass.premium() && Pass.active()) { FX.toast('Premium: recompensa liberada sem anúncio'); return true; } return show(kind); };
  }
  // cartão da temporada no Início, logo depois da semana
  const home = UI.home.bind(UI);
  UI.home = function (...a) {
    const r = home(...a);
    try { const w = document.querySelector('.v9-week'); if (w && !document.querySelector('.rv-home')) w.insertAdjacentHTML('afterend', Pass.homeCard()); } catch (e) {}
    if (!Pass._introT) Pass._introT = setTimeout(() => { try { if (App.tab === 'home' && Store.data.profile.onboarded) Pass.intro(); } catch (e) {} }, 2500);
    return r;
  };
  // resumo do treino: quanto rendeu na temporada
  const sum = UI.summary.bind(UI);
  UI.summary = function (act, res, isNew, ...rest) {
    const r = sum(act, res, isNew, ...rest);
    try {
      if (isNew && res && res.pass && res.pass.pts && Pass.active()) {
        const p = res.pass, up = p.lv1 > p.lv0, nx = Pass.nextGood();
        const html = `<section class="ps-sum tap" data-act="go" data-v="pass"><span class="pss-ic">${Pass.mascotNow('xs') || I('sparkles')}</span><div class="grow"><small>${Pass.SEASON.name}</small><b>${up ? `Subiu para o nível ${p.lv1}!` : `+${p.pts} pontos${act.passBoost ? ' (em dobro)' : ''}`}</b>${nx ? `<small>Próxima: ${esc(nx.i.name)} no nível ${nx.l}</small>` : ''}</div>${I('chevronRight', 'xs')}</section>`;
        const anchor = document.querySelector('.screen .sum-stats, .screen .stat-grid, .screen .post-stats, .screen > section');
        if (anchor && !document.querySelector('.ps-sum')) anchor.insertAdjacentHTML('afterend', html);
      }
    } catch (e) {}
    return r;
  };

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
