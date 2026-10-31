/* =========================================================
   JustGo — PONTOS ("quem está lá agora?")
   Lugares famosos de treino no mapa. Quem chega perto aparece
   sozinho (dá para desligar). Amigos veem nome e foto; os outros
   só a quantidade de pessoas — por segurança.
   Sugestões viram ponto oficial com 5 votos.
   ========================================================= */
const Spots = {
  VOTES: 5,
  list: null, live: {}, cur: null, lastPing: 0, lastCheck: 0,

  on() { return Pref('spotsOn') !== false; },

  async load(force) {
    if (!Cloud.loggedIn || !Cloud.loggedIn()) return [];
    if (this.list && !force && Date.now() - this._at < 10 * 60e3) return this.list;
    try {
      const { data, error } = await Cloud.sb.from('spots').select('*').limit(2000);
      if (error) throw error;
      this.list = data || []; this._at = Date.now();
      try { const { data: v } = await Cloud.sb.from('spot_votes').select('spot_id').eq('user_id', Cloud.user.id); this.voted = new Set((v || []).map((x) => x.spot_id)); } catch (e) { this.voted = new Set(); }
    } catch (e) { this.err = e; this.list = this.list || []; }
    return this.list;
  },
  async loadLive(lat, lng) {
    try {
      const { data, error } = await Cloud.sb.rpc('spot_live', { la: lat, ln: lng, km: 60 });
      if (error) throw error;
      this.live = {}; (data || []).forEach((r) => (this.live[r.spot_id] = r)); this._liveAt = Date.now();
    } catch (e) { this.live = this.live || {}; }
    return this.live;
  },

  // chamado a cada posição de GPS (treino, tela Gravar, Mapa)
  onPos(lat, lng) {
    if (!this.on() || !Cloud.loggedIn || !Cloud.loggedIn() || Cloud.demo) return;
    const now = Date.now(); if (now - this.lastCheck < 30000) return; this.lastCheck = now;
    this.check(lat, lng).catch(() => {});
  },
  async check(lat, lng) {
    const L = await this.load(); if (!L.length) return;
    // zona de privacidade (casa): nunca marca presença lá
    const Pz = Store.data.privacy; if (Pz && Pz.zone && Pz.lat != null && Geo.dist([lat, lng], [Pz.lat, Pz.lng]) < (Pz.radius || 300)) return this.leave();
    let best = null, bd = Infinity;
    L.forEach((s) => { if (s.status !== 'official') return; const d = Geo.dist([lat, lng], [s.lat, s.lng]); if (d <= (s.radius_m || 500) && d < bd) { best = s; bd = d; } });
    if (best) {
      if (this.cur !== best.id || Date.now() - this.lastPing > 3 * 60e3) {
        const sp = App.tracker ? App.tracker.sport : null;
        await Cloud.sb.rpc('spot_ping', { sid: best.id, sp });
        if (this.cur !== best.id && App.tracker) FX.toast(`📍 Você está no ponto ${best.name}`);
        this.cur = best.id; this.lastPing = Date.now();
      }
    } else if (this.cur) await this.leave();
  },
  async leave() {
    if (!this.cur) return;
    this.cur = null; this.lastPing = 0;
    try { await Cloud.sb.rpc('spot_ping', { sid: null, sp: null }); } catch (e) {}
  },

  /* ---------- no mapa ---------- */
  async draw(map, group) {
    if (!map || !group) return;
    const c = UI.mapCenter || Geo.home();
    const [L0] = await Promise.all([this.load(), this.loadLive(c[0], c[1])]);
    if (!UI.bigMap || UI.bigMap !== map) return;
    group.clearLayers();
    L0.filter((s) => Geo.dist([s.lat, s.lng], c) < 60000).forEach((s) => {
      const lv = this.live[s.id], n = lv ? lv.total : 0, fr = lv ? lv.friends || [] : [], pend = s.status !== 'official';
      const faces = fr.slice(0, 3).map((f) => `<span class="sp-face">${UI.avatarOf(f.name, null, null, 'xs', f.photo)}</span>`).join('');
      const html = `<div class="spot-pin ${pend ? 'pend' : ''} ${n ? 'live' : ''}"><span class="sp-dot">${pend ? I('plus', 'xs') : I('mapPin', 'xs')}</span><span class="sp-name">${esc(s.name)}</span>${n ? `<span class="sp-n">${n}</span>` : ''}${pend ? `<span class="sp-v">${s.votes}/${this.VOTES}</span>` : ''}${faces ? `<span class="sp-faces">${faces}</span>` : ''}</div>`;
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'spot-ic', html, iconSize: null, iconAnchor: [14, 14] }), zIndexOffset: n ? 1000 : 0 })
        .on('click', () => this.sheet(s.id)).addTo(group);
      if (!pend && n) L.circle([s.lat, s.lng], { radius: s.radius_m || 500, color: '#12B886', weight: 1.5, fillColor: '#12B886', fillOpacity: 0.08, dashArray: '4 6', interactive: false }).addTo(group);
    });
  },

  async sheet(id) {
    const s = (this.list || []).find((x) => x.id === id); if (!s) return;
    const lv = this.live[s.id] || { total: 0, sports: [], friends: [] }, pend = s.status !== 'official';
    const cnt = {}; (lv.sports || []).forEach((k) => (cnt[k] = (cnt[k] || 0) + 1));
    const verbs = { run: 'correndo', ride: 'pedalando', walk: 'caminhando', hike: 'na trilha', skate: 'de patins', board: 'de skate', paddle: 'remando', swim: 'nadando' };
    const parts = Object.entries(cnt).map(([k, v]) => `${v} ${verbs[k] || 'treinando'}`).join(' · ');
    const others = lv.total - (lv.friends || []).length - (this.cur === s.id ? 1 : 0);
    const voted = this.voted && this.voted.has(s.id);
    const v = await FX.modal(`<div class="spot-sheet"><div class="ss-ic ${pend ? 'pend' : lv.total ? 'live' : ''}">${I(pend ? 'flag' : 'mapPin')}</div>
      <h3>${esc(s.name)}</h3><small class="muted">${[s.city, s.state].filter(Boolean).map(esc).join(' · ')}${pend ? ' · sugestão da comunidade' : ''}</small>
      ${pend ? `<div class="ss-vote"><b class="num">${s.votes}/${this.VOTES}</b><span>votos para virar ponto oficial</span><div class="ss-bar"><i style="width:${Math.min(100, (s.votes / this.VOTES) * 100)}%"></i></div></div>`
        : `<div class="ss-now ${lv.total ? 'on' : ''}"><b class="num">${lv.total}</b><span>${lv.total === 1 ? 'pessoa aqui agora' : 'pessoas aqui agora'}</span>${parts ? `<small>${parts}</small>` : ''}</div>
        ${(lv.friends || []).length ? `<div class="ss-fr"><span class="eyebrow">Amigos aqui</span>${lv.friends.map((f) => `<div class="ss-f">${UI.avatarOf(f.name, null, null, 'sm', f.photo)}<b>${esc(f.name || 'Amigo')}</b><small>${verbs[f.sport] || 'treinando'}</small></div>`).join('')}</div>` : ''}
        ${others > 0 ? `<p class="muted small">${(lv.friends || []).length ? `E mais ${others}` : others} ${others === 1 ? 'pessoa' : 'pessoas'} que você não segue. Por segurança, só amigos aparecem com nome.</p>` : ''}
        ${this.cur === s.id ? `<p class="ss-me">${I('check', 'xs')} Você aparece aqui agora</p>` : ''}`}</div>
      ${pend ? `<div class="row2"><button class="btn ghost" data-m="no">Fechar</button><button class="btn primary" data-m="vote" ${voted ? 'disabled' : ''}>${voted ? 'Você já votou' : `${I('check', 'xs')} Concordo`}</button></div>` : `<button class="btn ghost" data-m="no">Fechar</button>`}`);
    if (v === 'vote') {
      try { const { data, error } = await Cloud.sb.rpc('spot_vote', { sid: s.id }); if (error) throw error; this.voted.add(s.id); s.votes = data; if (data >= this.VOTES) { s.status = 'official'; FX.toast(`🎉 ${s.name} virou ponto oficial!`); } else FX.toast(`Voto registrado: ${data}/${this.VOTES}`); UI.mapaDraw(); }
      catch (e) { FX.toast('Não deu para votar agora.'); }
    }
  },

  // sugerir um ponto: usa a posição atual (precisa estar no lugar)
  async suggest() {
    if (!Cloud.loggedIn()) return FX.toast('Entre na conta para sugerir pontos.');
    FX.toast('Pegando sua localização…');
    const p = await Geo.locate(true).catch(() => null);
    if (!p) return FX.toast('Não consegui sua localização. Ligue o GPS e tente de novo.');
    if (p[2] && p[2] > 80) return FX.toast('O sinal de GPS está fraco. Vá para um lugar aberto e tente de novo.');
    const L0 = await this.load(true), near = L0.find((s) => Geo.dist([p[0], p[1]], [s.lat, s.lng]) < 300);
    if (near) return FX.toast(`Já existe um ponto aqui: ${near.name}${near.status !== 'official' ? ' (vote nele!)' : ''}.`);
    const f = await FX.prompt('Sugerir ponto 📍', [['spName', 'Nome do lugar', 'text', '', 'ex.: Caco de Vidro', 'maxlength="60"']], 'Sugerir', 'Use quando estiver no lugar. Com 5 votos de outras pessoas ele vira ponto oficial e aparece para todo mundo.');
    if (!f || !(f.spName || '').trim()) return;
    try {
      const { error } = await Cloud.sb.rpc('spot_suggest', { n: f.spName.trim(), la: p[0], ln: p[1], ct: (Cloud.me && Cloud.me.city) || null, st: null });
      if (error) throw error;
      FX.toast('Sugestão enviada! Chame os amigos para votar.'); this.list = null; UI.mapaDraw();
    } catch (e) {
      const m = String(e && e.message || '');
      FX.toast(/ja existe/.test(m) ? 'Já existe um ponto muito perto daqui.' : /limite/.test(m) ? 'Você já sugeriu 3 pontos hoje. Tente amanhã.' : 'Não deu para sugerir agora.');
    }
  },
};
