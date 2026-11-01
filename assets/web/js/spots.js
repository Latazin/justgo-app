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
    L.forEach((s) => { if (s.status !== 'official') return; const d = Geo.dist([lat, lng], [s.lat, s.lng]); const inn = s.poly && s.poly.length > 2 ? (Zones.inside([lat, lng], s.poly) || this.edgeDist([lat, lng], s.poly) < 30) : d <= (s.radius_m || 500); if (inn && d < bd) { best = s; bd = d; } });
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
      const col = pend ? '#1F6BFF' : '#12B886';
      if (s.poly && s.poly.length > 2) L.polygon(s.poly, { color: col, weight: 2, fillColor: col, fillOpacity: n ? 0.14 : 0.07, dashArray: pend ? '5 7' : null, interactive: false }).addTo(group);
      else if (!pend && n) L.circle([s.lat, s.lng], { radius: s.radius_m || 500, color: '#12B886', weight: 1.5, fillColor: '#12B886', fillOpacity: 0.08, dashArray: '4 6', interactive: false }).addTo(group);
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

  // sugerir um ponto: começa onde a pessoa está (precisa estar no lugar) e ela pode
  // circular com o dedo a área toda do lugar
  async suggest() {
    if (!Cloud.loggedIn()) return FX.toast('Entre na conta para sugerir pontos.');
    FX.toast('Pegando sua localização…');
    const p = await Geo.locate(true).catch(() => null);
    if (!p) return FX.toast('Não consegui sua localização. Ligue o GPS e tente de novo.');
    if (p[2] && p[2] > 80) return FX.toast('O sinal de GPS está fraco. Vá para um lugar aberto e tente de novo.');
    const L0 = await this.load(true), near = L0.find((s) => Geo.dist([p[0], p[1]], [s.lat, s.lng]) < 250 || (s.poly && Zones.inside([p[0], p[1]], s.poly)));
    if (near) return FX.toast(`Você já está no ponto ${near.name}${near.status !== 'official' ? ' (abra no mapa e vote nele!)' : ''}.`);
    this.drawUI([p[0], p[1]]);
  },
  circle(c, r, n = 28) { const k = Math.cos((c[0] * Math.PI) / 180), out = []; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; out.push([c[0] + (r * Math.sin(a)) / 110574, c[1] + (r * Math.cos(a)) / (111320 * k)]); } return out; },
  // distância (m) de um ponto até a borda de um polígono
  edgeDist(pt, poly) { const o = pt, X = poly.map((q) => Zones.xy(q, o)); let m = Infinity; for (let i = 0; i < X.length; i++) m = Math.min(m, Zones.segDist([0, 0], X[i], X[(i + 1) % X.length])); return m; },
  areaTxt(m2) { return m2 < 10000 ? `${Math.round(m2).toLocaleString('pt-BR')} m²` : `${Fmt.num(m2 / 10000, 1)} ha`; },

  drawUI(me) {
    const old = $('#spotDraw'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'spotDraw'; el.className = 'sd';
    el.innerHTML = `<div id="sdMap" class="sd-map"></div><svg class="sd-ink" id="sdInk"><path d=""/></svg>
      <div class="sd-top"><button class="sd-x" data-sd="close" aria-label="Fechar">${I('x')}</button><div class="sd-hint" id="sdHint"><b>Você está aqui</b><span>Circule o lugar com o dedo para marcar a área toda</span></div></div>
      <button class="sd-draw" data-sd="draw">${I('edit')}<span>Circular área</span></button>
      <div class="sd-panel">
        <div class="sd-area"><span class="sd-dot"></span><span id="sdArea">Área do ponto</span><button class="sd-reset" data-sd="reset">Refazer</button></div>
        <label class="sd-field"><span>Nome do lugar</span><input id="sdName" maxlength="60" placeholder="Ex.: Caco de Vidro" autocomplete="off"></label>
        <button class="btn primary sd-send" data-sd="send">Enviar sugestão</button>
        <p class="sd-note">${I('users', 'xs')} Com 5 votos de outras pessoas vira ponto oficial.</p>
      </div>`;
    document.body.appendChild(el);
    const map = UI.map('sdMap', { attr: false }); if (!map) { el.remove(); return FX.toast('Não deu para abrir o mapa.'); }
    map.setView(me, 17);
    const youIc = L.divIcon({ className: 'sd-you', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker(me, { icon: youIc, interactive: false, zIndexOffset: 1000 }).addTo(map);
    let poly = this.circle(me, 90), shape = null, drawing = false;
    const show = () => {
      if (shape) shape.remove();
      shape = L.polygon(poly, { color: '#1F6BFF', weight: 3, fillColor: '#1F6BFF', fillOpacity: 0.16, dashArray: drawing ? '6 8' : null, interactive: false }).addTo(map);
      $('#sdArea').textContent = `Área do ponto · ${this.areaTxt(Zones.area(poly))}`;
    };
    show(); setTimeout(() => { map.invalidateSize(); map.fitBounds(L.polygon(poly).getBounds(), { padding: [70, 70] }); }, 60);
    const ink = $('#sdInk'), path = ink.querySelector('path'), btn = el.querySelector('.sd-draw'), hint = $('#sdHint');
    const mode = (on) => {
      drawing = on; el.classList.toggle('drawing', on); btn.querySelector('span').textContent = on ? 'Cancelar' : 'Circular área';
      hint.innerHTML = on ? '<b>Desenhe com o dedo</b><span>Faça uma volta em torno do lugar, passando por onde você está</span>' : '<b>Você está aqui</b><span>Circule o lugar com o dedo para marcar a área toda</span>';
      if (on) { map.dragging.disable(); map.touchZoom.disable(); } else { map.dragging.enable(); map.touchZoom.enable(); path.setAttribute('d', ''); }
    };
    let pts = [];
    const pos = (e) => { const r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    ink.addEventListener('pointerdown', (e) => { if (!drawing) return; e.preventDefault(); ink.setPointerCapture(e.pointerId); pts = [pos(e)]; path.setAttribute('d', `M${pts[0][0]},${pts[0][1]}`); });
    ink.addEventListener('pointermove', (e) => { if (!drawing || !pts.length) return; const q = pos(e), l = pts[pts.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 4) return; pts.push(q); path.setAttribute('d', 'M' + pts.map((x) => x.join(',')).join(' L') + ' Z'); });
    ink.addEventListener('pointerup', () => {
      if (!drawing || pts.length < 8) { pts = []; return; }
      const step = Math.max(1, Math.ceil(pts.length / 80));
      const np = pts.filter((_, i) => i % step === 0).map(([x, y]) => { const ll = map.containerPointToLatLng([x, y]); return [ll.lat, ll.lng]; });
      pts = [];
      const a = Zones.area(np);
      if (a < 600) { FX.toast('Área muito pequena. Faça uma volta maior em torno do lugar.'); path.setAttribute('d', ''); return; }
      if (a > 3e6) { FX.toast('Área grande demais. Circule só o lugar do ponto.'); path.setAttribute('d', ''); return; }
      if (!Zones.inside(me, np) && this.edgeDist(me, np) > 150) { FX.toast('A área precisa incluir onde você está (o ponto azul).'); path.setAttribute('d', ''); return; }
      poly = np; mode(false); show(); map.fitBounds(L.polygon(poly).getBounds(), { padding: [70, 70] });
      Native.haptic && Native.haptic('light');
    });
    const close = () => { try { map.remove(); } catch (e) {} el.remove(); };
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sd]'); if (!b) return;
      const v = b.dataset.sd;
      if (v === 'close') return close();
      if (v === 'draw') return mode(!drawing);
      if (v === 'reset') { poly = this.circle(me, 90); mode(false); show(); map.fitBounds(L.polygon(poly).getBounds(), { padding: [70, 70] }); return; }
      if (v === 'send') {
        const name = ($('#sdName').value || '').trim();
        if (name.length < 3) { $('#sdName').focus(); return FX.toast('Dê um nome para o lugar (ex.: Caco de Vidro).'); }
        b.disabled = true; b.textContent = 'Enviando…';
        try {
          const pg = poly.map((q) => [+q[0].toFixed(6), +q[1].toFixed(6)]);
          let { error } = await Cloud.sb.rpc('spot_suggest2', { n: name, la: me[0], ln: me[1], ct: (Cloud.me && Cloud.me.city) || null, st: null, pg });
          if (error && /spot_suggest2|function/i.test(error.message || '')) ({ error } = await Cloud.sb.rpc('spot_suggest', { n: name, la: me[0], ln: me[1], ct: (Cloud.me && Cloud.me.city) || null, st: null }));
          if (error) throw error;
          close(); this.list = null; UI.mapaDraw && UI.mapaDraw();
          FX.modal(`<div class="m-done">${I('check')}</div><h3>Sugestão enviada!</h3><p class="muted"><b>${esc(name)}</b> já aparece no mapa. Chame a galera para votar: com 5 votos vira ponto oficial.</p><div class="row2"><button class="btn primary" data-m="ok">Beleza</button></div>`);
        } catch (err) {
          b.disabled = false; b.textContent = 'Enviar sugestão';
          const m = String(err && err.message || '');
          FX.toast(/ja existe/.test(m) ? 'Já existe um ponto muito perto daqui.' : /limite/.test(m) ? 'Você já sugeriu 3 pontos hoje. Tente amanhã.' : /longe/.test(m) ? 'A área precisa ficar onde você está.' : 'Não deu para enviar agora. Tente de novo.');
        }
      }
    });
  },
};
