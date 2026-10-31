/* =========================================================
   JustGo — TELAS PRINCIPAIS
   Cada função monta uma tela em HTML. As ações dos botões
   ficam em app.js (atributo data-act). Telas sociais: ui-social.js
   ========================================================= */
const SPORT_IC = new Proxy({}, { get: (_, k) => (CONFIG.sports[k] ? CONFIG.sports[k].icon : 'activity') });
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const UI = {
  maps: [],
  clearMaps() { this.maps.forEach((m) => { try { m.remove(); } catch (e) {} }); this.maps = []; },
  render(html, nav = true) {
    this.clearMaps();
    this.thumbs.forEach((t) => { try { t.map.remove(); } catch (e) {} }); this.thumbs = [];
    $('#app').innerHTML = html;
    setTimeout(() => this.mountThumbs(), 0);
    $('#nav').style.display = nav ? '' : 'none';
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === (App.nav || App.tab)));
    window.scrollTo(0, 0);
  },
  isLight() { return document.documentElement.dataset.theme === 'light'; },
  // mapa: Leaflet por cima do MapLibre (vetorial, OpenFreeMap, sem chave)
  // estilo colorido (parques, água, ruas) por padrão, como no Strava
  map(el, opts = {}) {
    if (!window.L || !$('#' + el)) return null;
    const { dark = Pref('mapStyle') === 'dark', attr = true, light, ...rest } = opts;
    const m = L.map(el, { zoomControl: false, attributionControl: attr, ...rest });
    if (m.attributionControl) m.attributionControl.setPrefix(false);
    this.baseLayer(m, dark);
    this.maps.push(m); return m;
  },
  // ruas de verdade: OpenFreeMap (vetorial, sem chave e sem limite). Se o aparelho
  // não desenhar o mapa vetorial (sem WebGL, erro ou demora), cai para o OpenStreetMap.
  baseLayer(m, dark) {
    const M = CONFIG.maps;
    const raster = () => {
      if (m._raster) return m._raster;
      m.getContainer().classList.toggle('map-dim', dark);
      m._raster = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      try { m._raster.bringToBack(); } catch (e) {}
      return m._raster;
    };
    if (!L.maplibreGL || !window.maplibregl || !this.webgl()) return raster();
    try {
      const gl = L.maplibreGL({ style: dark ? M.dark : M.color, attribution: M.attribution, interactive: false }).addTo(m); m._gl = gl;
      const glMap = gl.getMaplibreMap && gl.getMaplibreMap();
      if (glMap) {
        let fell = false, ok = false;
        const giveUp = () => { if (ok) return; try { m.removeLayer(gl); } catch (e) {} raster(); };
        glMap.once('load', () => { ok = true; });
        glMap.on('error', (e) => {
          if (!e || !e.error || !/style|fetch|load|404|Failed|network/i.test(String(e.error.message || e.error.status || ''))) return;
          if (!fell) { fell = true; glMap.setStyle(M.fallback); if (dark) m.getContainer().classList.add('map-invert'); } else giveUp();
        });
        setTimeout(() => { if (!ok && !(glMap.loaded && glMap.loaded())) giveUp(); }, 9000);
      }
      return gl;
    } catch (err) {
      return raster();
    }
  },
  webgl() {
    if (this._webgl == null) { try { const c = document.createElement('canvas'); this._webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { this._webgl = false; } }
    return this._webgl;
  },
  // linha do percurso com contorno (destaca sobre o mapa colorido)
  routeLine(m, latlngs, color, weight = 5) {
    const casing = L.polyline(latlngs, { color: '#ffffff', weight: weight + 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
    const line = L.polyline(latlngs, { color, weight, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m);
    return { line, casing, setLatLngs(ll) { casing.setLatLngs(ll); line.setLatLngs(ll); return this; }, getBounds() { return line.getBounds(); } };
  },
  // pinos de início (verde) e fim (quadriculado), como nos apps de corrida
  endpoints(m, a, b) {
    const pin = (cls) => L.divIcon({ className: 'pin ' + cls, html: '<i></i>', iconSize: [18, 18], iconAnchor: [9, 9] });
    L.marker([a[0], a[1]], { icon: pin('start'), interactive: false, keyboard: false }).addTo(m);
    L.marker([b[0], b[1]], { icon: pin('end'), interactive: false, keyboard: false }).addTo(m);
  },
  // miniaturas com mapa de verdade, criadas só quando aparecem na tela (máx. 6 ao mesmo tempo)
  thumbs: [],
  mountThumbs() {
    this.thumbs.forEach((t) => { try { t.map.remove(); } catch (e) {} }); this.thumbs = [];
    if (this._io) this._io.disconnect();
    if (!window.L || !('IntersectionObserver' in window)) return;
    this._io = new IntersectionObserver((ents) => ents.forEach((en) => {
      const el = en.target;
      if (en.isIntersecting && !el._map) this.thumbMap(el);
      else if (!en.isIntersecting && el._map && this.thumbs.length > 4) this.dropThumb(el);
    }), { rootMargin: '120px 0px' });
    document.querySelectorAll('.post-map[data-route]').forEach((el) => this._io.observe(el));
    // treinos que chegam depois (Social, clubes, perfis carregam da nuvem) também ganham o mapa de ruas
    if (!this._mo && 'MutationObserver' in window) {
      this._mo = new MutationObserver((muts) => {
        if (!this._io) return;
        muts.forEach((m) => m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('.post-map[data-route]')) this._io.observe(n);
          if (n.querySelectorAll) n.querySelectorAll('.post-map[data-route]').forEach((el) => this._io.observe(el));
        }));
      });
      this._mo.observe($('#app'), { childList: true, subtree: true });
    }
  },
  thumbMap(el) {
    let pts; try { pts = JSON.parse(el.dataset.route); } catch (e) { return; }
    if (!pts || !pts.length) return;
    if (!Array.isArray(pts[0][0])) pts = [pts]; // formato antigo: uma linha só
    pts = pts.filter((sg) => sg.length > 1); if (!pts.length) return;
    while (this.thumbs.length >= 6) this.dropThumb(this.thumbs[0].el);
    const box = document.createElement('div'); box.className = 'thumb-map'; el.appendChild(box);
    const m = L.map(box, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false });
    this.baseLayer(m, false);
    const r = this.routeLine(m, pts, el.dataset.color || '#1F6BFF', 4);
    const lastSeg = pts[pts.length - 1];
    this.endpoints(m, pts[0][0], lastSeg[lastSeg.length - 1]);
    m.fitBounds(r.getBounds(), { padding: [22, 22] });
    el._map = m; el.classList.add('live'); this.thumbs.push({ el, map: m });
  },
  dropThumb(el) {
    const i = this.thumbs.findIndex((t) => t.el === el); if (i < 0) return;
    try { this.thumbs[i].map.remove(); } catch (e) {}
    const box = el.querySelector('.thumb-map'); if (box) box.remove();
    el._map = null; el.classList.remove('live'); this.thumbs.splice(i, 1);
  },
  // bolinha azul de "você está aqui"
  youDot(m, pos) {
    const icon = L.divIcon({ className: 'you-dot', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] });
    return L.marker(pos, { icon, interactive: false, keyboard: false }).addTo(m);
  },
  setSportColor(sport) { document.documentElement.style.setProperty('--sport', CONFIG.sports[sport].color); },

  /* ---------- componentes ---------- */
  bar(pct, cls = '') { return `<div class="bar ${cls}"><span style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%"></span></div>`; },
  // topo: título pequeno (aparece ao rolar) + título grande na página
  header(title, extra = '', opts = {}) {
    const D = Store.data, s = Game.streakDays();
    const login = Cloud.configured() && Cloud.ready && !Cloud.loggedIn();
    const left = opts.brand ? this.brand() : `<b class="ttl top-title">${title}</b>`;
    const chips = `<span class="stat-chip" title="Ofensiva${Game.shieldUsedThisWeek ? ' (escudo usado esta semana)' : ''}">${I(Game.shieldUsedThisWeek ? 'shield' : 'flame')}<b class="num">${s}</b></span><span class="stat-chip" title="Moedas">${I('coin')}<b class="num">${D.coins}</b></span>`;
    const bell = Cloud.loggedIn() ? `<button class="icon-btn bell" data-act="go" data-v="notifs" aria-label="Notificações">${I('bell')}<i class="bell-dot" id="bellBadge" ${Cloud.unread ? '' : 'hidden'}>${Cloud.unread > 9 ? '9+' : Cloud.unread || ''}</i></button>` : '';
    const right = login ? `<button class="login-chip" data-act="go" data-v="account">${I('user')}Entrar</button>` : `${bell}<button class="avatar-btn" data-act="go" data-v="profile" aria-label="Perfil">${this.avatar('xs')}</button>`;
    if (Cloud.loggedIn()) setTimeout(() => Cloud.refreshNotifs(), 0);
    return `<header class="top ${opts.brand ? 'is-brand' : ''}"><div class="top-l">${left}</div><div class="top-r">${extra}${chips}${right}</div></header>
      ${!opts.brand && title ? `<div class="page-head"><h1>${title}</h1>${opts.sub ? `<p>${opts.sub}</p>` : ''}</div>` : ''}`;
  },
  loginCard() {
    if (!Cloud.configured() || !Cloud.ready || Cloud.loggedIn()) return '';
    const hid = Store.data.profile.loginHiddenAt; if (hid && Date.now() - hid < 3 * 864e5) return '';
    return `<section class="promo"><button class="promo-x" data-act="hideLogin" aria-label="Fechar">${I('x')}</button>
      <div class="promo-ic">${I('users')}</div><div class="grow"><b>Crie sua conta grátis</b><p>Salve seus treinos na nuvem, siga amigos, entre em clubes e dispute os rankings da sua cidade.</p>
      <div class="promo-act"><button class="btn primary sm" data-act="go" data-v="account">Entrar ou criar conta</button></div></div></section>`;
  },
  back(to, title, right = '') { return `<header class="top sub"><div class="top-l"><button class="back" data-act="go" data-v="${to}" aria-label="Voltar">${I('chevronLeft')}</button><b class="ttl">${title}</b></div><div class="top-r">${right}</div></header>`; },
  brand() { return `<span class="brand">${MARK('sm')}<span>Just<b>Go</b></span></span>`; },
  avatar(size = '') { const P = Store.data.profile, n = P.name || 'A'; return `<div class="avatar ${size}">${this.avaIn(n, P.photo)}</div>`; },
  avaIn(name, photo) { return photo && /^(https:|data:image)/.test(photo) ? `<span class="ph" style="background-image:url('${String(photo).replace(/'/g, '%27')}')"></span>` : `<span>${esc((name || 'A')[0].toUpperCase())}</span>`; },
  greeting() { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; },
  today() { return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); },
  avatarOf(name, frame, bg, size = 'sm', photo) { return `<div class="avatar ${size}" style="${frame ? `--frame:${frame};` : '--frame:var(--line-2);'}${bg ? `--avatar-bg:${bg}` : ''}">${this.avaIn(name, photo)}</div>`; },
  iconBox(name, color) { return `<div class="ibox" ${color ? `style="--c:${color}"` : ''}>${I(name)}</div>`; },
  tabsBar(items, active, act) { return `<div class="subtabs">${items.map(([v, n]) => `<button class="${v === active ? 'on' : ''}" data-act="${act}" data-v="${v}">${n}</button>`).join('')}</div>`; },
  actTitle(a) {
    if (a.title) return a.title;
    if (a.workout && a.workout.type === 'interval') return `Intervalado ${a.workout.name}`;
    if (a.workout && a.workout.type === 'swimset') return `Série ${a.workout.name}`;
    const h = new Date(a.start).getHours();
    const per = h >= 5 && h < 12 ? 'matinal' : h >= 12 && h < 18 ? 'à tarde' : 'noturn';
    const sp = CONFIG.sports[a.sport] || CONFIG.sports.run, fem = (sp.tg || sp.g) === 'f';
    return `${sp.title || sp.name} ${per === 'noturn' ? (fem ? 'noturna' : 'noturno') : per}`;
  },
  // miniatura: poucos pontos, mas respeitando as pausas (cada trecho é uma linha separada)
  thinRoute(pts) {
    const step = Math.max(1, Math.floor(pts.length / 140)), segs = []; let cur = [];
    pts.forEach((p, i) => {
      const brk = p[4] && cur.length, keep = i % step === 0 || i === pts.length - 1 || p[4] || (pts[i + 1] && pts[i + 1][4]);
      if (brk) { if (cur.length > 1) segs.push(cur); cur = []; }
      if (keep || brk) cur.push([+(+p[0]).toFixed(5), +(+p[1]).toFixed(5)]);
    });
    if (cur.length > 1) segs.push(cur);
    return segs;
  },
  // miniatura do trajeto em SVG (leve, sem carregar mapa)
  routeSVG(points, color) {
    const segs = Geo.segments(points);
    if (!segs.length || points.length < 2) return '';
    const all = segs.flat(), lat0 = (all[0][0] * Math.PI) / 180;
    const xy = (p) => [p[1] * Math.cos(lat0), -p[0]];
    const P = all.map(xy), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = 320, H = 160, pad = 16, sc = Math.min((W - 2 * pad) / (maxX - minX || 1e-9), (H - 2 * pad) / (maxY - minY || 1e-9));
    const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
    const step = Math.max(1, Math.floor(all.length / 250));
    const f = (p) => { const [x, y] = xy(p); return `${(ox + (x - minX) * sc).toFixed(1)},${(oy + (y - minY) * sc).toFixed(1)}`; };
    const paths = segs.map((s) => 'M' + s.filter((_, i) => i % step === 0 || i === s.length - 1).map(f).join('L')).join('');
    const [sx, sy] = f(all[0]).split(','), [ex, ey] = f(all[all.length - 1]).split(',');
    return `<svg class="route" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><path d="${paths}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${sx}" cy="${sy}" r="4.5" fill="#fff" stroke="${color}" stroke-width="2.5"/><circle cx="${ex}" cy="${ey}" r="4.5" fill="${color}"/></svg>`;
  },
  missionRow(m, pre, kind, swap = false) {
    const now = Date.now(), p = Game.mProgress(m, Game.scope(kind, now));
    const done = Store.data.missionsDone[Game.mKey(pre, m, now)];
    const ic = m.icon || (m.sport && m.sport !== 'all' ? SPORT_IC[m.sport] : m.type === 'before' ? 'sunrise' : 'target');
    const col = m.sport && m.sport !== 'all' ? CONFIG.sports[m.sport].color : '';
    return `<div class="row ${done ? 'done' : ''}">${done ? `<div class="ibox ok">${I('check')}</div>` : this.iconBox(ic, col)}
      <div class="grow"><div class="row-t"><b>${esc(m.text)}</b><span class="xp">+${m.xp} XP</span></div>${this.bar(done ? 100 : p.pct, done ? 'ok' : '')}<div class="row-t"><small>${done ? 'Concluída' : p.txt}</small>${swap && !done ? `<button class="swap-btn" data-act="swapDaily" data-v="${m.id}">${I('shuffle', 'xs')} Trocar</button>` : ''}</div></div></div>`;
  },
  unlockRow(u) {
    const p = Game.reqProgress(u.req);
    return `<div class="row tap" data-act="sub" data-v="progress:tree"><div class="ibox locked-ic">${I(u.icon)}<i>${I('lock')}</i></div>
      <div class="grow"><div class="row-t"><b>${esc(u.name)}</b><span class="pct">${Math.floor(p.pct)}%</span></div>${this.bar(p.pct)}<small>${esc(Game.reqText(u.req))} · ${p.curTxt}</small></div>${I('chevronRight', 'chev')}</div>`;
  },
  // função trancada: prévia desfocada + cadeado + missão + progresso
  lockedBox(id, preview) {
    const u = Game.unlock(id), p = Game.reqProgress(u.req);
    return `<div class="locked" data-act="sub" data-v="progress:tree">
      <div class="blur">${preview || '<div class="fake-chart"></div>'}</div>
      <div class="lock-over"><div class="lock-badge">${I('lock')}</div><b>${esc(u.name)}</b><small>${esc(Game.reqText(u.req))}</small>${this.bar(p.pct)}<small class="num">${p.curTxt}</small></div></div>`;
  },
  lockChip(id, label) { const u = Game.unlock(id); return `<button class="chip-btn is-locked" data-act="sub" data-v="progress:tree" title="${esc(Game.reqText(u.req))}">${I('lock')}${label}</button>`; },
  sectionHead(title, link) { return `<div class="sec"><h2>${title}</h2>${link ? `<button class="sec-link" data-act="${link[2] || 'go'}" data-v="${link[1]}">${link[0]}</button>` : ''}</div>`; },
  levelLine() {
    const xp = Store.data.xp, l = Game.level(xp), a = Game.xpFor(l), b = Game.xpFor(l + 1);
    return { l, pct: ((xp - a) / (b - a)) * 100, txt: `${xp - a} / ${b - a} XP` };
  },
  bars(vals, labels, { hi = -1, fmt = (v) => Fmt.num(v), color } = {}) {
    const max = Math.max(...vals, 0.0001);
    return `<div class="vbars">${vals.map((v, i) => `<div class="vb ${i === hi ? 'hi' : ''}"><em class="num">${v ? fmt(v) : ''}</em><i style="height:${Math.max(v ? 6 : 2, (v / max) * 100)}%;${color ? `background:${color}` : ''}" class="${v ? 'has' : ''}"></i><small>${labels[i]}</small></div>`).join('')}</div>`;
  },

  /* =========================================================
     ONBOARDING
     ========================================================= */
  onboarding(step = 0) {
    const slides = [
      { img: 'img/ob1.jpg', k: ['zap', 'Treino que vira jogo'], t: 'Corra. Pedale. Nade.<br>Evolua de verdade.', p: 'Registre cada treino com GPS e veja seu progresso crescer a cada quilômetro.' },
      { img: 'img/ob2.jpg', k: ['lock', 'Desbloqueie o app'], t: 'Cada treino libera<br>algo novo.', p: 'Gráficos, treinador por voz, corrida contra o Fantasma, território e muito mais abrem conforme você treina.' },
      { img: 'img/ob3.jpg', k: ['trophy', 'Missões, ligas e amigos'], t: 'Suba de liga e domine<br>a sua cidade.', p: 'Missões diárias, temporadas mensais, clubes e desafios. Ganhe XP e dispute com a sua galera.' },
    ];
    if (step < 3) {
      const s = slides[step];
      return this.render(`<main class="onb"><div class="onb-photo" style="background-image:url(${s.img})"></div>
        <div class="onb-top">${this.brand()}${step < 2 ? '<button class="link" data-act="ob" data-v="3">Pular</button>' : ''}</div>
        <div class="onb-art"><span class="onb-kicker">${I(s.k[0])}${s.k[1]}</span></div><h1>${s.t}</h1><p>${s.p}</p>
        <div class="dots">${slides.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn primary lg" data-act="ob" data-v="${step + 1}">${step < 2 ? 'Continuar' : 'Começar agora'}</button></main>`, false);
    }
    const P = Store.data.profile;
    this.render(`<main class="onb form"><h1>Monte seu perfil</h1><p>Leva 20 segundos. Dá pra mudar depois.</p>
      <label class="field"><span>Nome</span><input id="obName" value="${esc(P.name === 'Atleta' ? '' : P.name)}" placeholder="Como quer ser chamado"></label>
      <div class="field"><span>Esportes favoritos</span><div class="choice">${Object.entries(CONFIG.sports).map(([k, s]) => `<label class="opt"><input type="checkbox" name="obSport" value="${k}" ${P.sports.includes(k) ? 'checked' : ''}><span>${I(SPORT_IC[k])}${s.name}</span></label>`).join('')}</div></div>
      <div class="field"><span>Experiência</span><div class="choice">${[['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']].map(([k, n]) => `<label class="opt"><input type="radio" name="obExp" value="${k}" ${P.experience === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
      <label class="field"><span>Meta semanal (km)</span><input id="obGoal" type="number" min="1" inputmode="numeric" value="${P.goalWeek}"></label>
      <button class="btn primary lg" data-act="obDone">Começar a treinar</button></main>`, false);
  },

  /* =========================================================
     INÍCIO
     ========================================================= */
  modeChips() {
    const s = App.sport, pool = s === 'swim' && App.swimMode === 'pool';
    const list = pool
      ? [['manual', 'Registro manual', 'clipboard', null], ['set', 'Série guiada', 'repeat', 'swimSets']]
      : [['free', 'Livre', 'activity', null], ...(s === 'run' ? [['interval', 'Intervalado', 'zap', 'intervals']] : []), ['route', 'Rota salva', 'route', 'routes'], ['plan', 'Plano', 'clipboard', 'plans']];
    return `<div class="modes">${list.map(([v, n, ic, lock]) => lock && !Game.has(lock)
      ? `<button class="mode is-locked" data-act="sub" data-v="progress:tree">${I('lock')}${n}</button>`
      : `<button class="mode ${App.mode === v ? 'on' : ''}" data-act="mode" data-v="${v}">${I(ic)}${n}</button>`).join('')}</div>`;
  },
  modeInfo() {
    const m = App.mode;
    if (m === 'interval' && App.preset) return `<div class="mode-info">${I('zap')}<b>${esc(App.preset.name)}</b><small>aquecimento ${Math.round(App.preset.warm / 60)} min · recuperação ${App.preset.rest}s</small></div>`;
    if (m === 'route' && App.route) { const b = Routes.best(App.route); return `<div class="mode-info">${I('route')}<b>${esc(App.route.name)}</b><small>${Fmt.km(App.route.distance)} km${b ? ` · melhor ${Fmt.time(b.time)}${Game.has('ghost') ? ' · com Fantasma' : ''}` : ''}</small></div>`; }
    if (m === 'plan') { const t = Plans.today(); if (t && t.session) return `<div class="mode-info">${I('clipboard')}<b>${esc(t.session.type)} · ${Fmt.num(t.session.km)} km</b><small>${esc(t.def.name)} · semana ${t.w + 1}</small></div>`; }
    return '';
  },
  home() {
    this.setSportColor(App.sport);
    const D = Store.data, now = Date.now(), lv = this.levelLine();
    const ws = Game.weekStart(now), week = Game.scope('week', now);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); const k = Game.dayKey(d); return week.filter((a) => Game.dayKey(a.start) === k).reduce((x, a) => x + a.distance, 0) / 1000; });
    const maxD = Math.max(...days, 1), todayI = (new Date().getDay() + 6) % 7;
    const wkKm = Game.km(week), wkTime = week.reduce((x, a) => x + a.duration, 0), goal = D.profile.goalWeek, gp = Math.min(100, (wkKm / goal) * 100);
    const L0 = Game.league(Game.monthXp()), streak = Game.streakDays();
    const next = Game.nextUnlocks(1)[0], plan = Plans.today();
    const recent = [...D.activities].sort((a, b) => b.start - a.start).slice(0, 2);
    const daily = Game.dailyMissions(now), dDone = daily.filter((m) => D.missionsDone[Game.mKey('d', m, now)]).length;
    const lastAct = recent[0], zones = Zones.mine();
    // esportes rápidos: os do perfil, depois os mais usados, completando com corrida/pedal/caminhada
    const used = {}; D.activities.forEach((x) => (used[x.sport] = (used[x.sport] || 0) + 1));
    const quick = [...new Set([...(D.profile.sports || []), ...Object.keys(used).sort((x, y) => used[y] - used[x]), 'run', 'ride', 'walk', 'skate', 'swim', 'hike'])].filter((k) => CONFIG.sports[k]).slice(0, 5);

    this.render(`${this.header('', '', { brand: true })}
    <main class="screen home">
      <section class="hello"><div class="grow"><span class="eyebrow">${this.today()}</span><h1>${this.greeting()}, ${esc(D.profile.name.split(' ')[0])}</h1></div><div id="hWx" class="wx-chip" hidden></div></section>
      ${this.loginCard()}
      <div id="hTorch"></div>
      ${this.retroCard()}
      ${this.avatarHome()}

      <section class="card week tap" data-act="go" data-v="stats">
        <div class="week-top">
          <div><span class="eyebrow">Esta semana</span><div class="week-n"><b class="num">${Fmt.num(wkKm)}</b><span>km</span></div><small>${week.length} ${week.length === 1 ? 'treino' : 'treinos'} · ${Fmt.time(wkTime)}</small></div>
          <div class="goal-ring" style="--p:${gp}"><div><b class="num">${Math.round(gp)}%</b><small>de ${goal} km</small></div></div>
        </div>
        <div class="week-bars">${days.map((v, i) => `<div class="wb ${i === todayI ? 'today' : ''}"><i style="height:${Math.max(v ? 10 : 4, (v / maxD) * 100)}%" class="${v ? 'has' : ''}"></i><small>${WEEKDAYS[i]}</small></div>`).join('')}</div>
      </section>

      <section class="card start-card">
        <div class="sc-top"><div class="grow"><b>Bora treinar?</b><small>${plan && plan.session ? `Hoje no plano: ${esc(plan.session.type)} · ${Fmt.num(plan.session.km)} km` : lastAct ? `Último: ${esc(CONFIG.sports[lastAct.sport] ? CONFIG.sports[lastAct.sport].name : '')} · ${Fmt.km(lastAct.distance)} km · ${this.agoDay(lastAct.start)}` : 'Escolha o esporte e comece com um toque'}</small></div>
          <button class="sc-go" data-act="go" data-v="record" aria-label="Iniciar treino">${I('play')}</button></div>
        <div class="sc-sports">${quick.map((k) => { const v = CONFIG.sports[k]; return `<button style="--c:${v.color}" data-act="quickStart" data-v="${k}"><span>${I(v.icon)}</span><small>${v.name}</small></button>`; }).join('')}</div>
      </section>

      <section class="tiles3">
        <button class="tile tap" data-act="sub" data-v="progress:tree"><span class="t-ic lv"><b class="num">${lv.l}</b></span><b>Nível ${lv.l}</b><small>${Game.title(lv.l)}</small><i class="t-bar"><i style="width:${lv.pct}%"></i></i></button>
        <button class="tile tap" data-act="go" data-v="stats"><span class="t-ic" style="--c:#F97316">${I('flame')}</span><b class="num">${streak} ${streak === 1 ? 'dia' : 'dias'}</b><small>seguidos</small><small class="t-sub" style="--lc:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</small></button>
        <button class="tile tap" data-act="go" data-v="mapa"><span class="t-ic" style="--c:#8B5CF6">${I('flag')}</span><b class="num">${zones.length} ${zones.length === 1 ? 'área' : 'áreas'}</b><small>${zones.length ? Zones.areaTxt(Zones.totalArea(zones)) : 'conquiste a 1ª'}</small><small class="t-sub">Ver mapa ${I('chevronRight', 'xs')}</small></button>
      </section>

      ${plan ? `${this.sectionHead('Plano de treino', ['Ver plano', 'plans'])}<div class="list"><div class="row tap" data-act="go" data-v="plans">${this.iconBox('clipboard', CONFIG.sports[plan.def.sport].color)}<div class="grow"><b>${plan.session ? `${esc(plan.session.type)} · ${Fmt.num(plan.session.km)} km` : plan.P.finished ? 'Plano concluído!' : 'Semana completa'}</b><small>${esc(plan.def.name)} · semana ${Math.min(plan.w + 1, plan.weeks.length)} de ${plan.weeks.length}</small></div>${I('chevronRight', 'chev')}</div></div>` : ''}

      ${this.sectionHead(`Missões de hoje <em>${dDone}/${daily.length}</em>`, ['Ver todas', 'progress:missions', 'sub'])}
      <div class="list">${daily.map((m) => this.missionRow(m, 'd', 'day')).join('')}</div>

      ${Cloud.loggedIn() ? `${this.sectionHead('Da comunidade', ['Ver mais', 'social'])}<div class="comm-strip" id="hComm"><div class="comm-card sk"></div><div class="comm-card sk"></div></div>` : ''}

      ${next ? `${this.sectionHead('Próximo desbloqueio', ['Ver árvore', 'progress:tree', 'sub'])}<div class="list">${this.unlockRow(next)}</div>` : ''}

      ${this.sectionHead('Atividades recentes', recent.length ? ['Ver todas', 'history'] : null)}
      ${recent.length ? recent.map((a) => this.postCard(a, esc(D.profile.name))).join('') : `<div class="empty compact">${I('activity')}<p>Seus treinos aparecem aqui.</p></div>`}
    </main>`);
    this.homeWx(); this.homeComm();
    if (Cloud.loggedIn()) Cloud.torchHolding().then((L) => { const el = $('#hTorch'); if (!el || !L.length || App.tab !== 'home') return; const t = L[0]; el.innerHTML = `<button class="card torch-hold tap" data-act="torchOpen" data-v="${t.id}"><div class="th-flame on">${I('flame')}</div><div class="grow"><b>A Tocha está com você! 🔥</b><small>${esc((t.creator && t.creator.name) || 'Um amigo')} começou · ${t.legs} pessoas · ${Fmt.num(t.total_m / 1000)} km. Faltam <b>${UI.hoursLeft(t.deadline)}</b> para treinar e passar.</small></div>${I('chevronRight', 'chev')}</button>`; }).catch(() => {});
  },
  agoDay(t) { const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; },
  // clima agora (Open-Meteo: grátis, sem chave). Guarda por 30 min.
  async homeWx() {
    if (!Geo.hasHome || !Geo.hasHome()) return;
    const c = Geo.home(); let w = this._wx;
    try {
      if (!w || Date.now() - w.t > 30 * 60e3) {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0].toFixed(2)}&longitude=${c[1].toFixed(2)}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`);
        const j = await r.json(); if (!j.current) return;
        w = this._wx = { t: Date.now(), temp: j.current.temperature_2m, rain: j.current.precipitation, code: j.current.weather_code, wind: j.current.wind_speed_10m };
      }
    } catch (e) { return; }
    const el = $('#hWx'); if (!el || App.tab !== 'home') return;
    const rain = w.rain >= 0.2 || (w.code >= 51 && w.code <= 82), clear = w.code <= 1;
    const tip = rain ? 'Chovendo agora' : w.temp >= 31 ? 'Calor: hidrate-se' : w.temp <= 14 ? 'Friozinho: aqueça bem' : w.wind >= 30 ? 'Vento forte hoje' : 'Bom pra treinar';
    el.innerHTML = `${I(rain ? 'cloudRain' : clear ? 'sun' : 'cloud')}<div><b class="num">${Math.round(w.temp)}°</b><small>${tip}</small></div>`; el.hidden = false;
  },
  // treinos recentes de outras pessoas (carrossel)
  async homeComm() {
    const el = $('#hComm'); if (!el) return;
    let list = []; try { list = await Cloud.homeFeed(); } catch (e) {}
    if (!$('#hComm') || App.tab !== 'home') return;
    if (!list.length) { el.outerHTML = `<div class="empty compact">${I('users')}<p>Quando a galera publicar treinos, eles aparecem aqui.</p></div>`; return; }
    el.innerHTML = list.map((a) => { const p = a.profiles || {}, sp = CONFIG.sports[a.sport] || CONFIG.sports.run, r = (a.route || []).filter((q) => q && q[0] != null);
      return `<button class="comm-card" data-act="raOpen" data-v="${a.id}">
        <div class="cc-h">${this.avatarOf(p.name, p.frame, p.avatar, 'xs', p.photo)}<b>${esc((p.name || 'Atleta').split(' ')[0])}</b><small>${this.ago(Date.parse(a.start))}</small></div>
        <div class="cc-map">${r.length > 1 ? this.routeSVG(r.map((q) => [q[0], q[1], 0]), sp.color) : I(sp.icon)}</div>
        <div class="cc-f"><span style="--c:${sp.color}">${I(sp.icon, 'xs')}</span><b class="num">${Fmt.km(a.distance, 1)} km</b><small>${Fmt.time(a.duration)}</small></div></button>`; }).join('');
  },

  /* =========================================================
     GRAVAR: mapa da cidade + escolha do esporte e do modo
     ========================================================= */
  record() {
    const s = App.sport, sp = CONFIG.sports[s];
    this.setSportColor(s);
    const pool = s === 'swim' && App.swimMode === 'pool';
    const startLbl = pool ? (App.mode === 'set' ? 'Série' : 'Registrar') : 'Iniciar';
    this.render(`<main class="rec ${pool ? 'no-map' : ''}">
      ${pool ? `<div class="rec-pool">${I('swim')}<b>Natação na piscina</b><small>O GPS não funciona dentro d'água. Registre manualmente ou use a série guiada na borda.</small></div>` : '<div id="recMap" class="rec-map"></div>'}
      <div class="rec-top">
        <button class="round-btn" data-act="go" data-v="home" aria-label="Fechar">${I('x')}</button>
        <span class="grow"></span>
        ${pool ? '<span class="round-btn ghost"></span>' : `<button class="round-btn" data-act="recenter" aria-label="Centralizar">${I('nav')}</button>`}
      </div>
      ${pool ? '' : '<div class="rec-gps" id="recGps"><i></i><span>Procurando sua localização…</span></div>'}
      <section class="rec-sheet">
        <button class="sport-pick" style="--c:${sp.color}" data-act="sportPick"><span class="sp-ic">${I(sp.icon)}</span><span class="grow"><small>Esporte</small><b>${sp.name}</b></span><span class="sp-change">Trocar ${I('chevronRight', 'xs')}</span></button>
        ${s === 'swim' ? `<div class="seg">${[['pool', 'Piscina'], ['open', 'Águas abertas']].map(([m, n]) => `<button class="${App.swimMode === m ? 'on' : ''}" data-act="swimMode" data-v="${m}">${n}</button>`).join('')}</div>` : ''}
        ${this.modeChips()}${this.modeInfo()}
        <div class="rec-start">
          <button class="side" data-act="go" data-v="settings"><i>${I('settings')}</i><small>Ajustes</small></button>
          <button class="start" data-act="start" aria-label="${startLbl}">${pool ? I(App.mode === 'set' ? 'repeat' : 'clipboard') : I('play')}<span>${startLbl}</span></button>
          <button class="side" data-act="go" data-v="safety"><i>${I('shield')}</i><small>Segurança</small></button>
        </div>
        <small class="rec-note">${pool ? 'Registro manual ou série guiada' : `${sp.name} · GPS de alta precisão`}</small>
      </section>
    </main>`, true);
    if (pool) return;
    const map = this.map('recMap', { attr: true });
    if (!map) return;
    map.setView(Geo.home(), Geo.hasHome() ? 15 : 12);
    this.recMap = map; this.recDot = null;
    const setPos = (p) => {
      if (!p || !$('#recMap')) return;
      if (!this.recDot) this.recDot = this.youDot(map, [p[0], p[1]]); else this.recDot.setLatLng([p[0], p[1]]);
      if (!this._recFollowed) { map.setView([p[0], p[1]], 16); this._recFollowed = true; }
      const g = $('#recGps'); if (g) { g.className = 'rec-gps ' + (p[2] && p[2] > 30 ? 'weak' : 'ok'); g.innerHTML = `<i></i><span>${p[2] && p[2] > 30 ? `Sinal fraco (±${Math.round(p[2])} m)` : `GPS pronto${p[2] ? ` · ±${Math.round(p[2])} m` : ''}`}</span>`; }
    };
    this._recFollowed = false;
    if (App.route) { const rl = this.routeLine(map, App.route.points.map((p) => [p[0], p[1]]), sp.color, 5); map.fitBounds(rl.getBounds(), { padding: [40, 40] }); this._recFollowed = true; }
    // acompanha a posição enquanto a tela está aberta
    App.stopRecWatch();
    if ('geolocation' in navigator) {
      App.recWatch = navigator.geolocation.watchPosition((p) => { Geo.remember(p.coords.latitude, p.coords.longitude); setPos([p.coords.latitude, p.coords.longitude, p.coords.accuracy]); },
        (e) => { const g = $('#recGps'); if (g) { g.className = 'rec-gps bad'; g.innerHTML = `<i></i><span>${e.code === 1 ? 'Permita a localização para ver o mapa' : 'Sem sinal de GPS'}</span>`; } },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    }
  },

  /* =========================================================
     TREINO AO VIVO
     ========================================================= */
  training() {
    const tr = App.tracker, sp = CONFIG.sports[tr.sport], unit = Fmt.paceUnit(tr.sport);
    this.setSportColor(tr.sport);
    this.render(`<main class="train">
      <div class="t-top"><span class="t-sport">${Avatar.on() ? `<span class="t-av" id="tAv">${Avatar.svg(null, { pose: tr.sport === 'ride' ? 'ride' : 'run', mood: 'happy', w: 34, portrait: false })}</span>` : I(SPORT_IC[tr.sport])}${sp.name}</span><span id="tGps" class="gps"></span>
        <button class="t-icon ${Cloud.liveId ? 'on' : ''}" id="tLive" data-act="live" title="Compartilhar localização">${I('signal')}</button><button class="sos" data-act="sos">SOS</button></div>
      <div id="tState" class="t-state"></div>
      <div id="tPhase" class="t-phase" hidden></div>
      <div class="t-hero"><span class="eyebrow">Distância</span><div class="t-dist"><b id="tDist" class="num">0,00</b><span>km</span></div></div>
      <div class="t-grid">
        <div><span class="eyebrow">Tempo</span><b id="tTime" class="num">0:00</b></div>
        <div><span class="eyebrow">${Fmt.paceLabel(tr.sport)}</span><b id="tPace" class="num">--</b><small>${unit}</small></div>
        <div><span class="eyebrow">Média</span><b id="tAvg" class="num">--</b><small>${unit}</small></div>
      </div>
      <div id="tRoute" class="t-route" hidden></div>
      <div id="tSplit" class="t-split"></div>
      <div id="tMap" class="t-map"></div>
      <div class="t-btns" id="tBtns"></div>
    </main>`, false);
    const map = this.map('tMap', { attr: false });
    if (map) {
      map.setView(Geo.home(), 16);
      if (App.route) { const rl = L.polyline(App.route.points.map((p) => [p[0], p[1]]), { color: '#8E8E93', weight: 6, opacity: 0.5, dashArray: '2 10' }).addTo(map); map.fitBounds(rl.getBounds(), { padding: [20, 20] }); this._centered = true; } else this._centered = false;
      this.trainDot = null;
      // recalcula o tamanho depois do layout (o mapa nasce antes de a tela terminar de montar)
      setTimeout(() => { try { map.invalidateSize(); if (App.route) map.fitBounds(L.latLngBounds(App.route.points.map((p) => [p[0], p[1]])), { padding: [18, 18] }); } catch (e) {} }, 250);
      this.liveLine = this.routeLine(map, [], Shop.lineColor(tr.sport), 5);
      this.ghostDot = null; this.liveMap = map; this.trainStartPin = null;
    }
    this.trainButtons(); this.updateTraining();
  },
  trainButtons() {
    const st = App.tracker.state;
    $('#tBtns').innerHTML = st === 'running'
      ? `<button class="cbtn main" data-act="pause" aria-label="Pausar">${I('pause')}</button>`
      : `<div class="cb"><button class="cbtn stop" data-act="finish" aria-label="Finalizar">${I('stop')}</button><small>Finalizar</small></div>
         <div class="cb"><button class="cbtn main" data-act="resume" aria-label="Retomar">${I('play')}</button><small>Retomar</small></div>`;
  },
  updateTraining() {
    { const av = document.getElementById('tAv'), t0 = App.tracker; if (av && t0) av.classList.toggle('paused', t0.state !== 'running' || !!t0.autoPaused); }
    const tr = App.tracker;
    if (!tr || !$('#tTime')) return;
    const secs = tr.moving / 1000;
    $('#tTime').textContent = Fmt.time(secs);
    $('#tDist').textContent = Fmt.km(tr.distance);
    $('#tPace').textContent = Fmt.pace(tr.sport, tr.autoPaused || tr.state !== 'running' ? 0 : tr.speed);
    $('#tAvg').textContent = Fmt.pace(tr.sport, secs > 0 ? tr.distance / secs : 0);
    const ok = /ok|simulado/.test(tr.gpsStatus);
    $('#tGps').innerHTML = `<i class="${ok ? 'ok' : 'bad'}"></i>${esc(tr.gpsStatus)}`;
    const st = tr.state === 'paused' ? 'Pausado' : tr.autoPaused ? 'Pausa automática' : '';
    $('#tState').textContent = st; $('#tState').classList.toggle('show', !!st);
    if (tr.splits.length && Game.has('splits')) $('#tSplit').textContent = `Km ${tr.splits.length} em ${Fmt.time(tr.splits[tr.splits.length - 1])}`;
    // fase do intervalado
    const c = App.coach && App.coach.view, ph = $('#tPhase');
    if (c) {
      ph.hidden = false; ph.className = 't-phase ' + c.k;
      ph.innerHTML = `<div class="ph-t"><b>${esc(c.label)}</b><span class="num">${c.left}</span></div><div class="ph-bar"><i style="width:${c.pct * 100}%"></i></div>${c.next ? `<small>Depois: ${esc(c.next)}</small>` : ''}`;
    }
    // rota e fantasma
    const R = App.routeLive, rb = $('#tRoute');
    if (R) {
      rb.hidden = false;
      const g = R.ghost;
      rb.innerHTML = `<div><span class="eyebrow">${R.off ? 'Fora do percurso' : 'Restante'}</span><b class="num ${R.off ? 'bad' : ''}">${Fmt.km(Math.max(0, R.left))} km</b></div>${g ? `<div class="ghost ${g.gap >= 0 ? 'ahead' : 'behind'}">${I('ghost')}<div><span class="eyebrow">Fantasma</span><b class="num">${g.gap >= 0 ? '+' : '−'}${Fmt.time(Math.abs(g.gap))}</b></div></div>` : ''}`;
      if (g && this.liveMap) {
        if (!this.ghostDot) this.ghostDot = L.circleMarker(g.pos, { radius: 8, color: '#fff', weight: 2, fillColor: '#A78BFA', fillOpacity: 0.9 }).addTo(this.liveMap);
        else this.ghostDot.setLatLng(g.pos);
      }
    }
    if (this.liveMap) {
      if (tr.points.length) {
        this.liveLine.setLatLngs(Geo.segments(tr.points));
        if (!this.trainStartPin) { const p0 = tr.points[0]; this.trainStartPin = L.marker([p0[0], p0[1]], { icon: L.divIcon({ className: 'pin start', html: '<i></i>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, keyboard: false }).addTo(this.liveMap); }
      }
      const last = tr.points.length ? tr.points[tr.points.length - 1] : tr.fix;
      if (last) {
        const ll = [last[0], last[1]];
        if (!this.trainDot) this.trainDot = this.youDot(this.liveMap, ll); else this.trainDot.setLatLng(ll);
        if (!this._centered) { this.liveMap.setView(ll, 16); this._centered = true; }
        else if (!App.route) this.liveMap.panTo(ll, { animate: false });
      }
    }
  },

  /* =========================================================
     NATAÇÃO NA PISCINA — registro manual e série guiada
     ========================================================= */
  pool() {
    const tools = Game.has('swimTools');
    this.setSportColor('swim');
    this.render(`${this.back('record', 'Natação na piscina')}
    <main class="screen form">
      <div class="field"><span>Tamanho da piscina</span><div class="choice">${[25, 50, 12.5, 20].map((n, i) => `<label class="opt"><input type="radio" name="pLen" value="${n}" ${i === 0 ? 'checked' : ''}><span>${String(n).replace('.', ',')} m</span></label>`).join('')}</div></div>
      <label class="field"><span>Voltas <em>cada volta = 1 comprimento</em></span><input id="pLaps" type="number" min="1" inputmode="numeric" placeholder="40"></label>
      <div class="row2"><label class="field"><span>Minutos</span><input id="pMin" type="number" min="0" inputmode="numeric" placeholder="30"></label><label class="field"><span>Segundos</span><input id="pSec" type="number" min="0" max="59" inputmode="numeric" placeholder="00"></label></div>
      ${tools ? `<label class="field"><span>Braçadas por volta <em>média</em></span><input id="pStrokes" type="number" min="0" inputmode="numeric" placeholder="18"></label>`
        : this.lockedBox('swimTools', '<div class="fake-field"><span>Braçadas por volta</span><b>18</b><span>Ritmo /100 m</span><b>2:05</b></div>')}
      <button class="btn primary lg" data-act="poolSave">Salvar treino</button>
    </main>`);
  },
  swimSetup() {
    this.setSportColor('swim');
    this.render(`${this.back('record', 'Série guiada')}
    <main class="screen form">
      <p class="muted lead">Deixe o celular na borda. O app marca o tempo de cada repetição, conta o descanso e apita para você sair.</p>
      <div class="field"><span>Série</span><div class="choice">${CONFIG.swimSets.map((p, i) => `<label class="opt"><input type="radio" name="ssPreset" value="${p.id}" ${i === 0 ? 'checked' : ''}><span>${p.name}</span></label>`).join('')}</div></div>
      <div class="row2"><label class="field"><span>Repetições</span><input id="ssReps" type="number" min="1" placeholder="padrão"></label><label class="field"><span>Descanso (s)</span><input id="ssRest" type="number" min="0" placeholder="padrão"></label></div>
      <div class="field"><span>Piscina</span><div class="choice">${[25, 50].map((n, i) => `<label class="opt"><input type="radio" name="ssPool" value="${n}" ${i === 0 ? 'checked' : ''}><span>${n} m</span></label>`).join('')}</div></div>
      <button class="btn primary lg" data-act="setBegin">Preparar série</button>
    </main>`);
  },
  swimSet() {
    this.render(`<main class="train set"><div class="t-top"><span class="t-sport">${I('swim')}Série guiada</span><button class="link" data-act="setCancel">Cancelar</button></div>
      <div class="set-main"><span class="eyebrow" id="ssPhase">Pronto</span><b class="num set-time" id="ssTime">0:00</b><div class="set-rep num" id="ssRep"></div><div class="ph-bar"><i id="ssBar"></i></div></div>
      <div class="cfg-list" id="ssList"></div>
      <button class="set-btn" id="ssBtn" data-act="setTap">Começar</button></main>`, false);
    this.updateSwimSet(SwimSet.s);
  },
  updateSwimSet(s) {
    if (!s || !$('#ssTime')) return;
    const now = Date.now(), P = s.preset;
    const names = { ready: 'Pronto', work: 'Nadando', rest: 'Descanso', done: 'Fim' };
    $('#ssPhase').textContent = names[s.phase];
    $('#ssTime').textContent = s.phase === 'work' ? Fmt.time((now - s.repStart) / 1000) : s.phase === 'rest' ? Fmt.time(Math.max(0, (s.restEnd - now) / 1000)) : '0:00';
    $('#ssRep').textContent = `Repetição ${Math.max(1, s.rep)} de ${P.reps} · ${P.dist} m`;
    $('#ssBar').style.width = (s.phase === 'rest' ? (1 - (s.restEnd - now) / (P.rest * 1000)) * 100 : (s.results.length / P.reps) * 100) + '%';
    $('#ssBtn').textContent = s.phase === 'ready' ? 'Começar' : s.phase === 'work' ? 'Repetição concluída' : 'Pular descanso';
    $('#ssBtn').className = 'set-btn ' + s.phase;
    const key = s.results.length; if (this._ssKey !== key) { this._ssKey = key; $('#ssList').innerHTML = s.results.map((r) => `<div><span>${r.rep}</span><b class="num">${Fmt.time(r.time)}</b><small>${Fmt.time(r.time / (r.dist / 100))} /100m</small></div>`).reverse().join(''); }
  },

  /* =========================================================
     RESUMO DO TREINO (também usado no detalhe da atividade)
     ========================================================= */
  summary(act, res, isNew) {
    const sp = CONFIG.sports[act.sport], avg = act.duration ? act.distance / act.duration : 0, color = Shop.lineColor(act.sport);
    this.setSportColor(act.sport);
    const hasMap = act.points && act.points.length > 1;
    const stats = [['Distância', Fmt.km(act.distance), 'km'], [Fmt.paceLabel(act.sport, true), Fmt.pace(act.sport, avg), Fmt.paceUnit(act.sport)], ['Tempo', Fmt.time(act.duration), '']];
    const more = [['Calorias', `${Game.calories(act)} kcal`]];
    if (hasMap) { const E = Geo.elevation(act.points); if (E.max != null) { more.push(['Subida total', `${E.gain} m`], ['Descida total', `${E.loss} m`], ['Altitude mín. / máx.', `${E.min} / ${E.max} m`]); more.push(['Fonte da altitude', act.altSrc === 'dem' ? 'Relevo do terreno (preciso)' : 'GPS do celular (calculando relevo…)']); } }
    if (act.weather && act.weather.temp != null) { const W2 = act.weather; more.push(['Clima no treino', `${Math.round(W2.temp)}°C${W2.feels != null ? ` · sensação ${W2.feels}°C` : ''}`]); if (W2.hum != null) more.push(['Umidade · vento', `${W2.hum}% · ${W2.wind != null ? W2.wind + ' km/h' : '--'}`]); }
    if (act.elapsed && act.elapsed !== act.duration) more.push(['Tempo total', Fmt.time(act.elapsed)]);
    if (act.estimated) more.push(['Distância estimada (app minimizado)', Fmt.km(act.estimated) + ' km']);
    if (act.pool) more.push(['Piscina', `${act.pool.laps} × ${String(act.pool.length).replace('.', ',')} m`]);
    if (act.loopArea) more.push(['Área do circuito', Zones.areaTxt(act.loopArea)]);
    if (!res && act.xp != null && !act.flagged) more.push(['XP ganho', `+${act.xp}`]);

    let rewards = '';
    if (res && !act.flagged) {
      const items = [
        ...res.missions.map((m) => [m.icon || 'target', 'Missão concluída', m.text, `+${m.xp} XP`]),
        ...(res.planSession ? [['clipboard', 'Treino do plano concluído', `${res.planSession.type} · ${Fmt.num(res.planSession.km)} km`, `+${CONFIG.planReward.session} XP`]] : []),
        ...(res.planFinished ? [['trophy', 'Plano concluído!', res.planFinished.name, `+${CONFIG.planReward.finish} XP`]] : []),
        ...res.records.filter((r) => r.broken).map((r) => ['zap', 'Novo recorde pessoal', r.label, '']),
        ...(res.efforts || []).filter((e) => e.pr).map((e) => ['flag', e.segment ? 'Melhor tempo no segmento' : 'Melhor tempo na rota', `${e.route} · ${Fmt.time(e.time)}`, '']),
        ...res.medals.map((m) => [m.icon, 'Medalha conquistada', m.name, '']),
        ...res.unlocks.map((u) => [u.icon, 'Função desbloqueada', u.name, '']),
        ...(res.zones && res.zones.nNew ? [['flag', 'Território conquistado', `${res.zones.nNew} área${res.zones.nNew > 1 ? 's' : ''} · ${Zones.areaTxt(res.zones.aNew)}`, '']] : []),
      ];
      rewards = `<section class="card rewards"><div class="rw-top"><div><span class="eyebrow">XP</span><b class="num">+${res.xp}</b></div><div><span class="eyebrow">Moedas</span><b class="num">+${res.coins}</b></div></div>
        ${items.map(([ic, k, t, x]) => `<div class="rw">${this.iconBox(ic)}<div class="grow"><small>${k}</small><b>${esc(t)}</b></div>${x ? `<span class="xp">${x}</span>` : ''}</div>`).join('')}
        ${res.gearWarn ? `<div class="notice warn">${I('shoe')}<div><b>Equipamento</b><small>${esc(res.gearWarn)}</small></div></div>` : ''}</section>`;
    }

    // treino estruturado
    let workout = '';
    if (act.workout && act.workout.results && act.workout.results.length) {
      const R = act.workout.results, best = Math.min(...R.map((r) => r.time));
      workout = this.sectionHead(act.workout.type === 'interval' ? 'Tiros' : 'Repetições') + `<section class="card splits"><div class="sp-h four"><span>#</span><span>Tempo</span><span>Dist.</span><span>Ritmo</span></div>${R.map((r) => `<div class="sp-row four"><span class="num">${r.rep}</span><b class="num ${r.time === best ? 'best' : ''}">${Fmt.time(r.time)}</b><span class="num">${r.dist} m</span><span class="num">${act.sport === 'swim' ? Fmt.time(r.time / (r.dist / 100)) + '/100' : r.dist ? Fmt.time(r.time / (r.dist / 1000)) + '/km' : '--'}</span></div>`).join('')}</section>`;
    }
    // esforços em rotas e segmentos
    const efforts = Store.data.routes.map((r) => ({ r, e: r.efforts.find((x) => x.act === act.id) })).filter((x) => x.e);
    const effortsHtml = efforts.length ? this.sectionHead('Rotas e segmentos') + `<div class="list">${efforts.map(({ r, e }) => { const b = Routes.best(r); return `<div class="row">${this.iconBox(r.segment ? 'flag' : 'route')}<div class="grow"><b>${esc(r.name)}</b><small>${Fmt.km(r.distance)} km · ${r.efforts.length} tentativa${r.efforts.length > 1 ? 's' : ''}</small></div><b class="num">${Fmt.time(e.time)}</b>${b && b.act === act.id ? '<span class="badge pr">RP</span>' : ''}</div>`; }).join('')}</div>` : '';

    let splits = '';
    if (act.splits && act.splits.length) {
      const best = Math.min(...act.splits), worst = Math.max(...act.splits);
      splits = this.sectionHead('Parciais') + (Game.has('splits')
        ? `<section class="card splits"><div class="sp-h"><span>Km</span><span>${Fmt.isSpeed(act.sport) ? 'Vel.' : 'Ritmo'}</span><span></span></div>${act.splits.map((t, i) => `<div class="sp-row"><span class="num">${i + 1}</span><b class="num ${t === best ? 'best' : ''}">${Fmt.isSpeed(act.sport) ? Fmt.num(3600 / t) : Fmt.time(t)}</b><div class="sp-bar"><i style="width:${40 + (60 * (worst - t)) / (worst - best || 1)}%"></i></div></div>`).join('')}</section>`
        : this.lockedBox('splits', '<div class="fake-splits"></div>'));
    }
    let charts = '';
    if (hasMap && (CONFIG.sports[act.sport] || {}).foot) charts = this.sectionHead('Ritmo') + (Game.has('paceChart') ? `<section class="card"><canvas class="chart" id="cPace"></canvas></section>` : this.lockedBox('paceChart'));
    if (hasMap && Fmt.isSpeed(act.sport)) charts = this.sectionHead('Velocidade e elevação') + (Game.has('rideChart') ? `<section class="card"><canvas class="chart" id="cSpeed"></canvas><canvas class="chart" id="cAlt"></canvas></section>` : this.lockedBox('rideChart'));
    if (act.sport === 'swim') {
      const per100 = act.distance ? act.duration / (act.distance / 100) : 0;
      const cells = [[Fmt.time(per100), 'Ritmo /100 m']];
      if (act.pool && act.pool.strokes) cells.push([act.pool.strokes, 'Braçadas/volta']);
      let inner = `<div class="kv">${cells.map(([v, l]) => `<div><span class="eyebrow">${l}</span><b class="num">${v}</b></div>`).join('')}</div>`;
      if (act.pool && act.pool.strokes) inner += Game.has('swolf') ? `<div class="kv"><div><span class="eyebrow">SWOLF</span><b class="num">${Math.round(act.duration / act.pool.laps + act.pool.strokes)}</b><small>tempo + braçadas por volta · menor é melhor</small></div></div>` : this.lockedBox('swolf', '<div class="fake-field"><span>SWOLF</span><b>42</b></div>');
      charts = this.sectionHead('Natação') + (Game.has('swimTools') ? `<section class="card">${inner}</section>` : this.lockedBox('swimTools'));
    }
    // equipamento
    const gType = Gear.typeFor(act.sport), gList = gType ? Gear.list(gType).filter((g) => !g.retired || g.id === act.gear) : [];
    const gearHtml = gType ? `<label class="row gear-pick">${this.iconBox(gType === 'shoe' ? 'shoe' : 'bike')}<div class="grow"><small>${gType === 'shoe' ? 'Tênis' : 'Bike'}</small>${gList.length ? `<select id="actGear" data-id="${act.id}"><option value="">Nenhum</option>${gList.map((g) => `<option value="${g.id}" ${act.gear === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>` : `<b class="link-like" data-act="go" data-v="gear">Cadastrar ${gType === 'shoe' ? 'tênis' : 'bike'}</b>`}</div></label>` : '';

    // ações
    const acts = [`<button class="chip-btn" data-act="shareCard" data-v="${act.id}">${I('share')}Compartilhar</button>`];
    if (Cloud.loggedIn() && !act.private && !act.flagged && Date.now() - act.start < 7 * 864e5) acts.unshift(`<button class="chip-btn torch-chip" data-act="torchAct" data-v="${act.id}">${I('flame')}Tocha</button>`);
    if (hasMap) {
      acts.push(Game.has('routes') ? `<button class="chip-btn" data-act="saveRoute" data-v="${act.id}">${I('bookmark')}Salvar rota</button>` : this.lockChip('routes', 'Salvar rota'));
      acts.push(Game.has('segments') ? `<button class="chip-btn" data-act="mkSegment" data-v="${act.id}">${I('scissors')}Criar segmento</button>` : this.lockChip('segments', 'Criar segmento'));
      acts.push(`<button class="chip-btn" data-act="gpxOut" data-v="${act.id}">${I('download')}GPX</button>`);
    }
    const feelLbl = ['Muito difícil', 'Difícil', 'Moderado', 'Bom', 'Excelente'];
    const W = act.weather;
    this.render(`<header class="top"><div class="top-l"><button class="back" data-act="go" data-v="${isNew ? 'home' : 'history'}">${I('chevronLeft')}</button></div>
      <div class="top-r"><button class="icon-btn" data-act="editAct" data-v="${act.id}" title="Editar treino" aria-label="Editar treino">${I('edit')}</button>${!isNew ? `<button class="icon-btn" data-act="del" data-v="${act.id}" title="Excluir">${I('trash')}</button>` : ''}</div></header>
    <main class="screen summary">
      <div class="post-h">${this.avatar()}<div class="grow"><b>${esc(Store.data.profile.name)}</b><small>${Fmt.date(act.start)}${act.mode === 'gpx' ? ' · importado' : ''}</small></div>${act.private ? `<span class="badge">${I('lock', 'xs')} Privado</span>` : ''}<span class="weather" id="sWeather">${W && W.temp != null ? `${I(W.rain >= 0.2 ? 'cloudRain' : 'cloud', 'xs')} ${Math.round(W.temp)}°C` : ''}</span></div>
      <h1 class="act-title tap" data-act="editAct" data-v="${act.id}">${esc(this.actTitle(act))} <span class="edit-hint">${I('edit', 'xs')}</span></h1>
      ${act.flagged ? `<div class="notice bad">${I('alert')}<div><b>Não conta para missões e rankings</b><small>${esc(act.flagReason)}</small></div></div>` : ''}
      <div class="big-stats">${stats.map(([l, v, u]) => `<div><span class="eyebrow">${l}</span><b class="num">${v}</b>${u ? `<small>${u}</small>` : ''}</div>`).join('')}</div>
      ${this.adjCard(Adjust.compute(act), act.sport)}
      ${this.photoBlock(act)}
      ${this.visRow(act)}
      ${hasMap ? `<div class="s-map-wrap"><div id="sMap" class="s-map"></div><button class="map3d-btn" data-act="view3d" data-v="${act.id}">${I('box3d')}Ver em 3D</button></div>` : act.pool ? `<div class="pool-art">${I('swim')}<b class="num">${Fmt.km(act.distance)} km</b><small>${act.pool.laps} voltas</small></div>` : ''}
      <div class="actions wrap">${acts.join('')}</div>
      ${rewards}
      ${this.proSection(act)}
      <section class="card kvl">${more.map(([l, v]) => `<div><span>${l}</span><b class="num">${v}</b></div>`).join('')}</section>
      ${gearHtml ? `<div class="list">${gearHtml}</div>` : ''}
      ${workout}${effortsHtml}${splits}${charts}
      ${this.sectionHead('Esforço percebido')}
      <div class="feel">${feelLbl.map((l, i) => `<button class="${act.feeling === i + 1 ? 'on' : ''}" data-act="feel" data-v="${i + 1}" data-id="${act.id}"><b>${i + 1}</b><small>${l}</small></button>`).join('')}</div>
      <textarea id="note" data-id="${act.id}" placeholder="Adicione uma anotação privada…">${esc(act.note || '')}</textarea>
      ${isNew ? '<button class="btn primary lg" data-act="go" data-v="home">Concluir</button>' : ''}
    </main>`, !isNew);

    if (hasMap && act.altSrc !== 'dem' && !act.remote && !this._elevBusy) {
      this._elevBusy = true;
      Elev.apply(act).then((ch) => { this._elevBusy = false; if (!ch) return; Store.save(); if (act.pub) Cloud.publish(act).catch(() => {}); if (App.tab === 'detail' && $('#sMap')) this.summary(act, res, isNew); }).catch(() => { this._elevBusy = false; });
    }
    const map = hasMap && this.map('sMap');
    if (map) {
      const line = this.routeLine(map, Geo.segments(act.points), color, 5);
      this.endpoints(map, act.points[0], act.points[act.points.length - 1]);
      map.fitBounds(line.getBounds(), { padding: [28, 28] });
      setTimeout(() => { try { map.invalidateSize(); map.fitBounds(line.getBounds(), { padding: [28, 28] }); } catch (e) {} }, 300);
    }
    const s = hasMap ? FX.series(act.points) : null;
    if ($('#cPace')) FX.chart($('#cPace'), s.x, s.v.map((v) => (v > 0.5 ? 1000 / v : NaN)), { color: sp.color, invert: true, fmtY: (v) => Fmt.time(v), label: 'min/km', minRange: 60 });
    if ($('#cSpeed')) FX.chart($('#cSpeed'), s.x, s.v.map((v) => v * 3.6), { color: sp.color, fmtY: (v) => v.toFixed(0), label: 'km/h', minRange: 6 });
    if ($('#cAlt')) FX.chart($('#cAlt'), s.x, s.alt, { color: '#8E8E93', fmtY: (v) => v.toFixed(0), label: 'elevação (m)', minRange: 20 });
  },

  // grade com todos os esportes (Gravar)
  sportGrid(cur) {
    return `<h3>Qual esporte?</h3><p class="muted">Escolha o que você vai fazer agora.</p><div class="sport-grid">${Object.entries(CONFIG.sports).map(([k, v]) => `<button class="${k === cur ? 'on' : ''}" style="--c:${v.color}" data-m="${k}"><span>${I(v.icon)}</span><b>${v.name}</b></button>`).join('')}</div><button class="btn ghost" data-m="no">Cancelar</button>`;
  },

  /* ---------- retrospectiva do mês ---------- */
  retroScreen() {
    const mon = Retro.monthName(Retro.month || new Date());
    this.render(`<main class="v3 rec rt-prev"><div id="rtMap" class="v3-map"></div><canvas id="rtView" class="rt-view" width="${Retro.W}" height="${Retro.H}"></canvas>
      <div class="rt-top"><button class="round-btn" data-act="retroClose" aria-label="Fechar">${I('x')}</button><div class="rt-title"><b>Retrospectiva de ${mon}</b><small>Prévia: assista e ajuste a velocidade</small></div></div>
      <div id="rtCtl" class="rt-ctl" hidden></div>
      <div id="rtRec" class="v3-rec"><div class="v3-rec-box"><b>Preparando o mapa…</b><small>Só um instante.</small><div class="v3-rec-bar"><i></i></div><button class="btn ghost sm" data-act="retroCancel">Cancelar</button></div></div></main>`, false);
    const nv = $('#nav'); if (nv) nv.style.display = 'none';
  },
  retroControls() {
    const el = $('#rtCtl'); if (!el) return;
    const R = Retro, sp = R.speed || 1;
    el.hidden = !R.base;
    el.innerHTML = `<div class="rt-row"><button class="v3-play" data-act="retroPlay" aria-label="${R.playing ? 'Pausar' : 'Reproduzir'}" ${R.busy ? 'disabled' : ''}>${I(R.playing ? 'pause' : 'play')}</button>
        <div class="grow"><input type="range" id="rtProg" min="0" max="1000" value="${R.base ? Math.round(((R.pos || 0) / (R.base.length - 1)) * 1000) : 0}" ${R.busy ? 'disabled' : ''} aria-label="Posição"><small id="rtTime" class="num"></small></div></div>
      <div class="rt-speed"><span>Velocidade</span><div class="seg">${[0.5, 1, 1.5, 2].map((v) => `<button class="${v === sp ? 'on' : ''}" data-act="retroSpeed" data-v="${v}" ${R.busy ? 'disabled' : ''}>${String(v).replace('.', ',')}x</button>`).join('')}</div></div>
      <button class="btn primary rt-gen" data-act="retroExport" ${R.busy ? 'disabled' : ''}>${I('film')} Gerar vídeo em ${String(sp).replace('.', ',')}x · ~${R.base ? Math.round(R.buildLen(sp)) : 0} s</button>`;
  },
  retroCard() {
    if (!Store.data.activities.length) return '';
    const st = Retro.state(), mon = Retro.monthName(), M = mon[0].toUpperCase() + mon.slice(1);
    if (st === 'soon') { const left = Retro.openFrom() - new Date().getDate(); return left <= 7 ? `<div class="retro-card soon"><div class="rc-ic">${I('film')}</div><div class="grow"><b>Retrospectiva de ${mon}</b><small>Libera em ${left} ${left === 1 ? 'dia' : 'dias'} (última semana do mês)</small></div></div>` : ''; }
    if (st === 'used') return `<button class="retro-card used tap" data-act="retroShare"><div class="rc-ic">${I('check')}</div><div class="grow"><b>Retrospectiva de ${mon} gerada</b><small>Toque para compartilhar de novo · próxima no mês que vem</small></div>${I('share', 'chev')}</button>`;
    if (st === 'empty') return '';
    return `<button class="retro-card open tap" data-act="retroStart"><div class="rc-ic">${I('film')}</div><div class="grow"><b>${M} em 3D 🎬</b><small>Sua retrospectiva do mês está liberada · 1 por mês</small></div><span class="rc-go">Gerar</span></button>`;
  },

  // cartão "Ritmo corrigido": quanto valeria no plano, num dia fresco
  adjCard(A, sport) {
    if (!A || !A.adj) return '';
    const pace = A.kind === 'pace', fmt = (v) => (pace ? Fmt.time(1000 / v) : Fmt.num(v * 3.6));
    const unit = pace ? '/km' : 'km/h', parts = [];
    if (pace) {
      const rel = Adjust.sPerKm(A.real, A.gap), heat = Adjust.sPerKm(A.gap, A.adj);
      if (Math.abs(rel) >= 2) parts.push(`${I('mountain', 'xs')} Relevo ${rel > 0 ? '−' : '+'}${Math.abs(Math.round(rel))} s/km`);
      if (heat >= 2) parts.push(`${I('sun', 'xs')} Calor −${Math.round(heat)} s/km${A.T != null ? ` · ${Math.round(A.T)}°C${A.RH != null ? `, ${A.RH}% umid.` : ''}` : ''}`);
    } else {
      const dv = (A.adj - A.real) * 3.6;
      if (Math.abs(dv) >= 0.2) parts.push(`${I('mountain', 'xs')} Relevo e esforço ${dv > 0 ? '+' : '−'}${Fmt.num(Math.abs(dv))} km/h`);
    }
    return `<section class="card adj-card tap" data-act="adjInfo">
      <div class="adj-top"><div class="grow"><span class="eyebrow">${pace ? 'Ritmo corrigido' : 'Velocidade no plano'} ${I('info', 'xs')}</span><div class="adj-v"><b class="num">${fmt(A.adj)}</b><small>${unit}</small></div><small class="muted">${pace ? 'equivalente no plano, num dia fresco' : 'com a mesma força, sem subidas'}</small></div>
      <div class="adj-real"><small>Real</small><b class="num">${fmt(A.real)}</b><small>${unit}</small></div></div>
      ${parts.length ? `<div class="adj-parts">${parts.map((p) => `<span>${p}</span>`).join('')}</div>` : `<div class="adj-parts"><span>${I('check', 'xs')} Condições neutras: relevo plano e clima fresco</span></div>`}
    </section>`;
  },

  photosOf(a) { return (a && a.photos || []).map((p) => (typeof p === 'string' ? p : p && p.url)).filter((u) => u && /^(https:|data:image)/.test(u)).slice(0, 2); },
  // bloco de fotos do treino (até 2) na tela do treino
  photoBlock(act) {
    const ph = this.photosOf(act), can = ph.length < 2;
    return `<section class="act-photos">${ph.map((u, i) => `<div class="ap"><img src="${esc(u)}" alt="Foto ${i + 1} do treino" loading="lazy" data-act="photoView" data-v="${esc(u)}"><button class="ap-x" data-act="actPhotoDel" data-v="${act.id}" data-i="${i}" aria-label="Remover foto">${I('x', 'xs')}</button></div>`).join('')}
      ${can ? `<label class="ap add">${I('camera')}<b>${ph.length ? 'Mais uma foto' : 'Adicionar fotos'}</b><small>${ph.length ? '1 de 2' : 'até 2 por treino'}</small><input type="file" id="actPhotoIn" data-id="${act.id}" accept="image/*" hidden></label>` : ''}</section>`;
  },
  // mapa + fotos lado a lado (deslize)
  mediaHtml(mapHtml, ph) {
    if (!ph.length) return mapHtml;
    return `<div class="post-media">${mapHtml ? `<div class="pm-item">${mapHtml}</div>` : ''}${ph.map((u) => `<div class="pm-item"><img src="${esc(u)}" loading="lazy" alt="Foto do treino" data-act="photoView" data-v="${esc(u)}"></div>`).join('')}</div>`;
  },

  /* ---------- treino em 3D (tela cheia) ---------- */
  view3d(act) {
    if (!View3D.open(act)) return;
    this.render(`<main class="v3"><div id="v3Map" class="v3-map"></div>
      <div class="v3-top"><button class="round-btn" data-act="v3Close" aria-label="Fechar">${I('x')}</button><div class="v3-title"><b>${esc(this.actTitle(act))}</b><small>${Fmt.km(act.distance)} km · ${Fmt.time(act.duration)}</small></div>
        <button class="round-btn ${View3D.light ? 'on' : ''}" id="v3Light" data-act="v3Light" aria-label="Modo leve" title="Modo leve">${I('zap')}</button></div>
      <div class="v3-bottom"><button class="v3-play" id="v3Play" data-act="v3Play" aria-label="Reproduzir">${I('play')}</button>
        <div class="grow"><input type="range" id="v3Prog" min="0" max="1000" value="0" aria-label="Posição no percurso"><div class="v3-meta"><span id="v3Km" class="num">0,00 km</span><span>Dois dedos: inclinar e girar</span></div></div>
        <button class="v3-vid" data-act="v3Video" aria-label="Baixar vídeo">${I('download')}<span>Vídeo</span></button></div>
    </main>`, false);
    const nv = $('#nav'); if (nv) nv.style.display = 'none';
    View3D.mount($('#v3Map'));
  },

  /* ---------- quem pode ver o treino (bem visível no resumo) ---------- */
  visRow(act) {
    const pub = !act.private;
    return `<section class="vis-card ${pub ? 'pub' : 'priv'}" id="visCard">
      <div class="vis-top"><div class="vis-ic">${I(pub ? 'globe' : 'lock')}</div><div class="grow"><b>${pub ? 'Treino público' : 'Só você vê este treino'}</b><small>${pub ? (Cloud.loggedIn() ? 'Aparece no feed, no Descobrir e disputa território' : 'É publicado quando você entrar na sua conta') : 'Publique para aparecer no feed e no Descobrir'}</small></div></div>
      <div class="seg vis-seg"><button class="${pub ? 'on' : ''}" data-act="visSet" data-v="${act.id}:public">${I('globe')}Público</button><button class="${pub ? '' : 'on'}" data-act="visSet" data-v="${act.id}:private">${I('lock')}Só eu</button></div>
    </section>`;
  },

  /* ---------- modo profissional: análise detalhada do treino ---------- */
  proSection(act) {
    if (!Pro.on()) return `<button class="pro-teaser" data-act="proOn"><span class="pro-badge">PRO</span><div class="grow"><b>Estatísticas profissionais</b><small>Calorias calculadas com seu corpo e equipamento, velocidade máxima, melhores trechos, potência e zonas de esforço.</small></div>${I('chevronRight', 'chev')}</button>`;
    let R; try { R = Pro.analyze(act); } catch (e) { console.error(e); return ''; }
    const sp = act.sport, run = !!(CONFIG.sports[sp] || {}).foot, ride = sp === 'ride', fast = Fmt.isSpeed(sp), kmh = (v) => Fmt.num(v * 3.6, 1);
    const cell = (l, v, u = '') => `<div><span>${l}</span><b class="num">${v}${u ? `<small> ${u}</small>` : ''}</b></div>`;
    const cells = [];
    if (sp !== 'swim' && R.vmax) cells.push(cell('Velocidade máxima', kmh(R.vmax), 'km/h'));
    if (run && R.vmax) cells.push(cell('Ritmo mais rápido', Fmt.pace('run', R.vmax), '/km'));
    if (sp !== 'swim' && R.avgMoving) cells.push(fast ? cell('Vel. média em movimento', kmh(R.avgMoving), 'km/h') : cell('Ritmo em movimento', Fmt.pace(sp, R.avgMoving), '/km'));
    if (sp === 'swim' && R.per100) cells.push(cell('Ritmo médio', Fmt.time(R.per100), '/100 m'));
    cells.push(cell('Tempo em movimento', Fmt.time(R.moving)));
    if (R.elapsed && R.elapsed !== R.moving) cells.push(cell('Tempo total', Fmt.time(R.elapsed)));
    if (R.up != null) { cells.push(cell('Subida', R.up, 'm')); cells.push(cell('Descida', R.down, 'm')); }
    if (R.altMax != null) cells.push(cell('Altitude máx · mín', `${R.altMax} · ${R.altMin}`, 'm'));
    if (R.gradeMax) cells.push(cell('Inclinação máxima', Fmt.num(R.gradeMax, 1), '%'));
    if (R.met) cells.push(cell('Esforço médio', Fmt.num(R.met, 1), 'MET'));
    if (R.load) cells.push(cell(R.loadHr ? 'Carga (TRIMP)' : 'Carga de treino', R.load, 'pts'));
    const zn = R.zones && R.zones.some((x) => x) ? (() => { const tot = R.zones.reduce((x, y) => x + y, 0), names = ['Leve', 'Moderado', 'Forte', 'Intenso', 'Máximo'];
      return `${this.sectionHead('Zonas de esforço')}<section class="card zones">${R.zones.map((t, i) => `<div class="zn"><span class="zn-n">Z${i + 1}</span><span class="zn-l">${names[i]}</span><div class="zn-bar"><i class="z${i + 1}" style="width:${(t / tot) * 100}%"></i></div><b class="num">${Fmt.time(t)}</b></div>`).join('')}</section>`; })() : '';
    const power = ride && R.pAvg ? `${this.sectionHead('Potência estimada')}<section class="card pro-grid">${[cell('Média', R.pAvg, 'W'), cell('Normalizada', R.pNorm, 'W'), cell('Máxima (30 s)', R.pMax, 'W'), cell('Watts por kg', Fmt.num(R.wkg, 2), 'W/kg'), cell('Trabalho', R.kj, 'kJ'), ...(R.tss ? [cell('Intensidade (IF)', Fmt.num(R.if, 2)), cell('TSS', R.tss)] : [])].join('')}</section>` : '';
    const bests = R.best && R.best.length ? `${this.sectionHead('Melhores trechos')}<div class="list">${R.best.map(([n, t, L]) => `<div class="row">${this.iconBox('zap')}<div class="grow"><b>${n}</b><small>${run ? Fmt.pace('run', L / t) + ' /km' : kmh(L / t) + ' km/h'}</small></div><b class="num">${Fmt.time(t)}</b></div>`).join('')}</div>` : '';
    const splits = R.splits && R.splits.length ? `${this.sectionHead('Parciais detalhadas')}<section class="card splits"><div class="sp-h pro4"><span>Km</span><span>${fast ? 'Tempo' : 'Ritmo'}</span><span>Vel.</span><span>Elev.</span></div>${(() => { const b = Math.min(...R.splits.map((x) => x.t)); return R.splits.map((x) => `<div class="sp-row pro4"><span class="num">${x.km}</span><b class="num ${x.t === b ? 'best' : ''}">${Fmt.time(x.t)}</b><span class="num">${kmh(1000 / x.t)} km/h</span><span class="num elev">${x.up ? `<em class="u">↑${x.up}</em>` : ''}${x.down ? `<em class="d">↓${x.down}</em>` : ''}${!x.up && !x.down ? '—' : ''}</span></div>`).join(''); })()}</section>` : '';
    const hr = act.hr || {};
    const hrBox = `${this.sectionHead('Frequência cardíaca')}<section class="card hr-box"><p class="muted small">Tem relógio ou cinta? Coloque os batimentos e as calorias passam a ser calculadas por eles (bem mais preciso).</p>
      <div class="row2"><label class="field"><span>Média (bpm)</span><input type="number" inputmode="numeric" data-hr="avg" data-id="${act.id}" value="${hr.avg || ''}" placeholder="ex.: 152"></label><label class="field"><span>Máxima (bpm)</span><input type="number" inputmode="numeric" data-hr="max" data-id="${act.id}" value="${hr.max || ''}" placeholder="ex.: 178"></label></div>
      ${R.hrZone ? `<div class="hr-zone"><b>Zona ${R.hrZone}</b><small>${['', 'Recuperação', 'Aeróbico leve', 'Aeróbico', 'Limiar', 'Máximo'][R.hrZone]} · ${R.hrPct}% da sua FC máxima (${Pro.maxHr()} bpm)</small></div>` : ''}</section>`;
    return `<section class="pro-card"><div class="pro-head"><span class="pro-badge">PRO</span><b>Análise detalhada</b><button class="link" data-act="go" data-v="pro">Ajustar dados</button></div>
      <div class="kcal-big"><div><b class="num">${R.kcal.toLocaleString('pt-BR')}</b><span>kcal</span></div><small class="num">${R.moving ? `≈ ${Math.round(R.kcal / (R.moving / 3600))} kcal/h` : ''}</small></div>
      <small class="pro-method">${I('info', 'xs')} ${esc(R.method)}</small>
      ${R.kcalMotion ? `<small class="pro-method">Pelo movimento seriam ${R.kcalMotion} kcal.</small>` : ''}
      <div class="pro-grid">${cells.join('')}</div>${R.notes.map((n) => `<p class="muted small">${esc(n)}</p>`).join('')}</section>
      ${power}${bests}${zn}${splits}${hrBox}`;
  },

  /* =========================================================
     MODO PROFISSIONAL: dados do corpo e equipamentos
     ========================================================= */
  pro() {
    const c = Pro.cfg(), P = Store.data.profile, on = c.on;
    const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${Array.isArray(v) ? v[0] : v}</option>`).join('');
    const num = (k, label, val, unit, ph = '', sub = '') => `<div class="cfg-row"><div class="grow"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="num-in"><input type="number" inputmode="decimal" data-pro="${k}" value="${val || ''}" placeholder="${ph}"><span>${unit}</span></div></div>`;
    const sel = (k, label, map, cur, sub = '') => `<div class="cfg-row"><div class="grow"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><select class="mini-sel" data-pro="${k}">${opt(map, cur)}</select></div>`;
    const bikes = Gear.list('bike').filter((g) => !g.retired);
    this.render(`${this.back('profile', 'Modo profissional')}<main class="screen settings pro-screen">
      <section class="pro-hero ${on ? 'on' : ''}"><div class="pro-hero-top"><span class="pro-badge">PRO</span><label class="switch"><input type="checkbox" data-pro="on" ${on ? 'checked' : ''}><i></i></label></div>
        <h2>Estatísticas profissionais</h2><p>Calorias calculadas pela física do seu treino (subidas, descidas, velocidade, peso e equipamento), velocidade máxima, melhores trechos, potência estimada no pedal, zonas de esforço e carga de treino.</p></section>
      <p class="muted small">Quanto mais você preencher, mais certeiro fica. Os dados ficam só no seu aparelho.</p>

      <h3 class="group">Seu corpo</h3>
      <div class="list cfg-list">
        <div class="cfg-row col-row"><div class="grow"><b>Sexo</b><small>Usado no cálculo pelos batimentos</small></div><div class="seg pref-seg">${[['m', 'Masculino'], ['f', 'Feminino']].map(([v, n]) => `<button class="${c.sex === v ? 'on' : ''}" data-act="proSet" data-v="sex:${v}">${n}</button>`).join('')}</div></div>
        ${num('weight', 'Peso', P.weight, 'kg', '70')}
        ${num('age', 'Idade', P.age, 'anos', '30')}
        ${num('height', 'Altura', c.height, 'cm', '175')}
        ${num('restHr', 'FC de repouso', c.restHr, 'bpm', '60', 'Ao acordar, ainda deitado')}
        ${num('maxHr', 'FC máxima', c.maxHr, 'bpm', String(Pro.maxHr()), c.maxHr ? '' : `Estimada: ${Pro.maxHr()} bpm`)}
      </div>

      <h3 class="group">Corrida e caminhada</h3>
      <div class="list cfg-list">
        ${sel('runSurface', 'Onde você mais corre', Pro.RUNS, c.runSurface)}
        ${num('carry', 'Carga extra', c.carry, 'kg', '0', 'Mochila, colete de hidratação, carrinho…')}
      </div>

      <h3 class="group">Pedal</h3>
      <div class="list cfg-list">
        ${sel('bikeType', 'Tipo de bike', Pro.BIKES, c.bikeType)}
        ${num('bikeWeight', 'Peso da bike', c.bikeWeight, 'kg', String((Pro.BIKES[c.bikeType] || Pro.BIKES.road)[1]))}
        ${sel('position', 'Posição', Pro.POS, c.position, 'Quanto mais deitado, menos resistência do ar')}
        ${sel('tire', 'Piso mais comum', Pro.TIRES, c.tire)}
        ${num('ftp', 'FTP', c.ftp, 'W', '—', 'Opcional: potência de limiar, se você souber')}
      </div>
      ${bikes.length ? `<h3 class="group">Suas bikes <em>cada uma com seu tipo e peso</em></h3><div class="list cfg-list">${bikes.map((g) => `<div class="cfg-row"><div class="grow"><b>${esc(g.name)}</b><select class="mini-sel" data-gbt="${g.id}">${opt(Pro.BIKES, g.btype || c.bikeType)}</select></div><div class="num-in"><input type="number" inputmode="decimal" data-gbw="${g.id}" value="${g.bweight || ''}" placeholder="kg"><span>kg</span></div></div>`).join('')}</div>`
        : `<button class="cfg-row tap list" data-act="go" data-v="gear">${this.iconBox('bike')}<div class="grow"><b>Cadastre suas bikes</b><small>Cada treino usa o tipo e o peso da bike escolhida</small></div>${I('chevronRight', 'chev')}</button>`}

      <h3 class="group">Natação</h3>
      <div class="list cfg-list">
        ${sel('stroke', 'Estilo principal', Pro.STROKES, c.stroke)}
        <label class="cfg-row"><div class="grow"><b>Roupa de neoprene</b><small>Em águas abertas (flutua mais, gasta um pouco menos)</small></div><span class="switch"><input type="checkbox" data-pro="wetsuit" ${c.wetsuit ? 'checked' : ''}><i></i></span></label>
      </div>
      <p class="muted small pro-foot">Como calculamos: na corrida, o custo energético por inclinação de Minetti (2002); no pedal, a potência necessária para vencer rolamento, ar e subidas; na natação, os METs do Compêndio de Atividades Físicas. Com batimentos informados, usamos a fórmula de Keytel (2005). São estimativas científicas — relógio com frequência cardíaca deixa ainda mais preciso.</p>
    </main>`);
  },

  /* =========================================================
     ATIVIDADES: minhas, rotas e território
     ========================================================= */
  history() {
    const sub = App.sub.history;
    const tabs = this.tabsBar([['mine', 'Minhas'], ['routes', 'Rotas e segmentos']], sub, 'subTab');
    let body = '';
    if (sub === 'routes') body = this.routesView();

    else {
      const list = [...Store.data.activities].sort((a, b) => b.start - a.start), name = esc(Store.data.profile.name);
      body = `<div class="actions">
        ${Game.has('heatmap') ? `<button class="chip-btn" data-act="heatmap">${I('flame')}Mapa de calor</button>` : this.lockChip('heatmap', 'Mapa de calor')}
        <label class="chip-btn">${I('upload')}Importar GPX<input type="file" id="gpxIn" accept=".gpx,application/gpx+xml" hidden></label>
        <button class="chip-btn" data-act="go" data-v="stats">${I('barChart')}Estatísticas</button></div>
      ${list.length ? list.map((a) => this.postCard(a, name)).join('')
        : `<div class="empty">${I('activity')}<h3>Nenhuma atividade ainda</h3><p>Seu primeiro treino aparece aqui.</p><button class="btn primary" data-act="go" data-v="home">Começar um treino</button></div>`}`;
    }
    this.render(`${this.back('home', 'Atividades')}<main class="screen">${tabs}${body}</main>`);
  },
  postCard(a, name, opts = {}) {
    const color = opts.color || Shop.lineColor(a.sport);
    const pts = opts.route || a.points;
    return `<article class="post" ${opts.noTap ? '' : `data-act="${opts.tap || 'detail'}" data-v="${a.id}"`}>
      <div class="post-h">${opts.avatar || this.avatar('sm')}<div class="grow"><b>${name}</b><small>${I(SPORT_IC[a.sport], 'xs')} ${Fmt.date(typeof a.start === 'string' ? Date.parse(a.start) : a.start)}</small></div>${a.flagged ? '<span class="badge bad">Não conta</span>' : a.private ? `<span class="badge">${I('lock', 'xs')} Privado</span>` : a.xp ? `<span class="badge">+${a.xp} XP</span>` : ''}</div>
      <h3>${esc(this.actTitle(a))}</h3>
      <div class="post-stats"><div><span>Distância</span><b class="num">${Fmt.km(a.distance)} km</b></div><div><span>${Fmt.isSpeed(a.sport) ? 'Vel. média' : 'Ritmo'}</span><b class="num">${Fmt.pace(a.sport, a.duration ? a.distance / a.duration : 0)}${Fmt.isSpeed(a.sport) ? ' km/h' : a.sport === 'swim' ? ' /100m' : ' /km'}</b></div><div><span>Tempo</span><b class="num">${Fmt.time(a.duration)}</b></div></div>
      ${this.mediaHtml(pts && pts.length > 1 ? `<div class="post-map" data-color="${color}" data-route='${JSON.stringify(this.thinRoute(pts))}'>${this.routeSVG(pts, color)}</div>` : a.pool || (a.stats && a.stats.pool) ? `<div class="post-map pool">${I('swim')}<span>Natação na piscina</span></div>` : '', this.photosOf(a))}
      ${opts.footer || ''}
    </article>`;
  },
  routesView() {
    if (!Game.has('routes') && !Game.has('segments')) return this.lockedBox('routes', '<div class="fake-chart"></div>');
    const R = Store.data.routes;
    if (!R.length) return `<div class="empty">${I('route')}<h3>Nenhuma rota salva</h3><p>Abra uma atividade com GPS e toque em "Salvar rota" ou "Criar segmento". Depois você treina nela e compete com o Fantasma.</p></div>`;
    return `<div class="list">${R.map((r) => { const b = Routes.best(r), sp = CONFIG.sports[r.sport]; return `<div class="route-row">
      <div class="rr-map">${this.routeSVG(r.points.map((p) => [p[0], p[1], 0]), sp.color)}</div>
      <div class="grow"><div class="row-t"><b>${esc(r.name)}</b><span class="badge">${r.segment ? 'Segmento' : 'Rota'}</span></div><small>${sp.name} · ${Fmt.km(r.distance)} km · ${r.efforts.length} tentativa${r.efforts.length === 1 ? '' : 's'}</small>
      ${b ? `<small class="pr-line">${I('trophy', 'xs')} Recorde ${Fmt.time(b.time)} · ${Fmt.pace(r.sport, r.distance / b.time)} ${Fmt.paceUnit(r.sport)}</small>` : ''}
      <div class="rr-act"><button class="chip-btn sm" data-act="routeStart" data-v="${r.id}">${I('play')}Treinar</button>${r.efforts.length > 1 ? `<button class="chip-btn sm" data-act="routeBoard" data-v="${r.id}">${I('list')}Tempos</button>` : ''}<button class="chip-btn sm ghost-btn" data-act="routeDel" data-v="${r.id}">${I('trash')}</button></div></div></div>`; }).join('')}</div>`;
  },
  /* =========================================================
     MAPA: território da região (raio de 15 km), treinos e rotas
     ========================================================= */
  ZCOL: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#84CC16', '#F97316'],
  zoneColor(owner) { let h = 0; String(owner).split('').forEach((c) => (h = (h * 31 + c.charCodeAt(0)) >>> 0)); return this.ZCOL[h % this.ZCOL.length]; },
  mapa() {
    const lay = App.mapLayers || (App.mapLayers = { zones: true, acts: false, routes: false });
    const chip = (k, ic, n) => `<button class="map-chip ${lay[k] ? 'on' : ''}" data-act="mapLayer" data-v="${k}">${I(ic)}${n}</button>`;
    this.render(`<main class="maptab">
      <div class="map-wrap"><div id="bigMap" class="big-map"></div>
        <div class="map-top"><div class="map-chips">${chip('zones', 'flag', 'Territórios')}${chip('acts', 'activity', 'Meus treinos')}${chip('routes', 'route', 'Rotas')}${chip('explore', 'compass', 'Ruas novas')}</div>
          <button class="round-btn" data-act="mapCenter" aria-label="Minha posição">${I('nav')}</button></div></div>
      <section class="map-sheet" id="mapSheet"><div class="loading">Carregando a região…</div></section>
    </main>`);
    const c = Geo.home(), R = Zones.RADIUS_KM * 1000;
    const map = this.map('bigMap', { attr: true, minZoom: 10, maxZoom: 18, maxBoundsViscosity: 0.9 });
    if (!map) return;
    this.bigMap = map; this.mapCenter = c;
    map.setView(c, 13);
    const ring = L.circle(c, { radius: R, color: '#1F6BFF', weight: 1.5, opacity: 0.6, dashArray: '6 8', fill: false, interactive: false }).addTo(map);
    map.setMaxBounds(ring.getBounds().pad(0.15));
    this.mapGroups = { zones: L.featureGroup().addTo(map), acts: L.featureGroup().addTo(map), routes: L.featureGroup().addTo(map) };
    this.youDot(map, c);
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 250);
    this._zonesCloud = null;
    this.mapaDraw();
    if (lay.explore) setTimeout(() => Explore.show(map, true), 600);
    if (Cloud.loggedIn()) Cloud.zonesNear(c[0], c[1], Zones.RADIUS_KM).then((z) => { this._zonesCloud = z; this.mapaDraw(); }).catch((e) => { console.error(e); this._zonesErr = true; this.mapaDraw(); });
    // sem posição salva: tenta achar a pessoa e recentraliza
    if (!Geo.hasHome() && 'geolocation' in navigator) navigator.geolocation.getCurrentPosition((p) => { Geo.remember(p.coords.latitude, p.coords.longitude); if (App.tab === 'mapa') this.mapa(); }, () => {}, { enableHighAccuracy: true, timeout: 15000 });
  },
  mapaDraw() {
    const map = this.bigMap, G = this.mapGroups, lay = App.mapLayers; if (!map || !G || !$('#bigMap')) return;
    Object.values(G).forEach((g) => g.clearLayers());
    const c = this.mapCenter, R = Zones.RADIUS_KM * 1000, near = (p) => Geo.dist(p, c) <= R * 1.1;
    const me = Cloud.user && Cloud.user.id;
    // áreas: da nuvem (todos) ou só as suas, deste aparelho
    const cloud = this._zonesCloud;
    const zones = cloud ? cloud.map((z) => ({ ...z, mine: z.owner === me })) : Zones.mine().map((z) => ({ ...z, mine: true, owner_name: Store.data.profile.name }));
    const inR = zones.filter((z) => near(Zones.center(z.poly)));
    if (lay.zones) inR.forEach((z) => {
      const col = z.mine ? '#1F6BFF' : this.zoneColor(z.owner);
      L.polygon(z.poly, { color: col, weight: 2, fillColor: col, fillOpacity: z.mine ? 0.28 : 0.22 })
        .bindPopup(`<b>${z.mine ? 'Sua área' : 'Área de ' + esc(z.owner_name || 'Atleta')}</b><br>${Zones.areaTxt(z.area)}${z.prev_owner_name ? `<br><small>Roubada de ${esc(z.prev_owner_name)}</small>` : ''}`).addTo(G.zones);
    });
    if (lay.acts) Game.acts().filter((a) => a.points && a.points.length > 1 && near(a.points[0])).slice(-60).forEach((a) => L.polyline(Geo.segments(a.points), { color: Shop.lineColor(a.sport), weight: 3, opacity: 0.55, interactive: false }).addTo(G.acts));
    if (lay.routes) Store.data.routes.filter((r) => r.points.length && near(r.points[0])).forEach((r) => L.polyline(r.points.map((p) => [p[0], p[1]]), { color: '#111317', weight: 4, opacity: 0.8, dashArray: r.segment ? '2 8' : null }).bindPopup(`<b>${esc(r.name)}</b><br>${Fmt.km(r.distance)} km`).addTo(G.routes));
    // painel de baixo
    const mineZ = inR.filter((z) => z.mine), mineArea = Zones.totalArea(mineZ);
    const owners = {}; inR.forEach((z) => { const k = z.owner || 'me'; const o = owners[k] || (owners[k] = { name: z.mine ? 'Você' : z.owner_name || 'Atleta', n: 0, a: 0, mine: z.mine, col: z.mine ? '#1F6BFF' : this.zoneColor(z.owner) }); o.n++; o.a += z.area; });
    const top = Object.values(owners).sort((x, y) => y.a - x.a).slice(0, 5);
    const sheet = $('#mapSheet'); if (!sheet) return;
    sheet.innerHTML = `<div class="ms-head"><div><b>Território da região</b><small>${I('mapPin', 'xs')} raio de ${Zones.RADIUS_KM} km ao seu redor</small></div>${cloud ? '' : Cloud.loggedIn() ? '' : '<button class="chip-btn sm" data-act="go" data-v="account">Entrar</button>'}</div>
      <div class="ms-stats"><div><b class="num">${inR.length}</b><small>áreas na região</small></div><div><b class="num">${mineZ.length}</b><small>são suas</small></div><div><b class="num">${Zones.areaTxt(mineArea)}</b><small>sua área</small></div></div>
      ${top.length ? `<div class="ms-list">${top.map((o, i) => `<div class="ms-row"><span class="pos num ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><i class="ms-dot" style="background:${o.col}"></i><b class="grow">${esc(o.name)}</b><small class="num">${o.n} área${o.n > 1 ? 's' : ''} · ${Zones.areaTxt(o.a)}</small></div>`).join('')}</div>`
        : `<div class="ms-empty">${I('flag')}<div><b>Nenhuma área conquistada aqui ainda</b><small>Seja o primeiro a dominar a região.</small></div></div>`}
      <div class="ms-how">${I('route', 'xs')}<span><b>Como conquistar:</b> corra ou pedale e volte ao mesmo ponto, fechando um circuito. A área de dentro vira sua. <b>Para roubar</b>, feche um circuito por cima de pelo menos metade da área de outra pessoa.</span></div>
      ${!Cloud.loggedIn() ? '<p class="muted small">Sem conta, você vê só as suas áreas. Entre para disputar o mapa com outros atletas.</p>' : this._zonesErr ? '<p class="muted small">Não foi possível carregar as áreas dos outros atletas agora.</p>' : ''}`;
  },
  heatmap() {
    this.render(`${this.back('history', 'Mapa de calor')}<main class="screen full"><div id="hMap" class="h-map"></div></main>`);
    const map = this.map('hMap', { dark: true }); if (!map) return;
    map.setView(Geo.home(), 13);
    let bounds = null;
    Game.acts().filter((a) => a.points && a.points.length > 1).forEach((a) => {
      const line = L.polyline(Geo.segments(a.points), { color: Shop.lineColor(a.sport), weight: 3, opacity: 0.45 }).addTo(map);
      bounds = bounds ? bounds.extend(line.getBounds()) : line.getBounds();
    });
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
  },

  /* =========================================================
     PROGRESSO: missões, árvore, temporada e loja
     ========================================================= */
  progress() {
    const sub = App.sub.progress;
    const tabs = this.tabsBar([['missions', 'Missões'], ['tree', 'Desbloqueios'], ['season', 'Temporada'], ['shop', 'Loja']], sub, 'subTab');
    const body = sub === 'tree' ? this.treeView() : sub === 'season' ? this.seasonView() : sub === 'shop' ? this.shopView() : this.missionsView();
    this.render(`${this.back(App.backTo || 'profile', 'Progresso')}<main class="screen">${tabs}${body}</main>`);
    if (sub === 'season') this.loadSeasonBoard();
  },
  missionsView() {
    const now = Date.now(), mid = new Date(); mid.setHours(24, 0, 0, 0);
    const left = mid - now, h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
    const wd = Math.ceil((Game.weekStart(now) + 7 * 864e5 - now) / 864e5);
    const season = Game.seasonal(now), P = Store.data.profile;
    let goals;
    if (Game.has('goals')) {
      const wk = Game.km(Game.scope('week', now)), mo = Game.km(Game.scope('month', now));
      goals = `<section class="card goals"><div class="goal"><div class="row-t"><b>Semana</b><span class="num">${Fmt.num(wk)} / ${P.goalWeek} km</span></div>${this.bar((wk / P.goalWeek) * 100)}</div>
        <div class="goal"><div class="row-t"><b>Mês</b><span class="num">${Fmt.num(mo)} / ${P.goalMonth} km</span></div>${this.bar((mo / P.goalMonth) * 100)}</div>
        <div class="row2"><label class="field"><span>Meta semanal (km)</span><input type="number" min="1" data-set="goalWeek" value="${P.goalWeek}"></label><label class="field"><span>Meta mensal (km)</span><input type="number" min="1" data-set="goalMonth" value="${P.goalMonth}"></label></div></section>`;
    } else goals = this.lockedBox('goals', '<div class="fake-field"><span>Semana</span><b>12 / 20 km</b><span>Mês</span><b>48 / 80 km</b></div>');
    const sp = Game.mProgress(season, Game.scope('month', now));
    const chosen = P.missionSports;
    // primeira visita: escolher até 2 esportes
    if (!chosen || App.msEditing) {
      const sel = App.msPick || (App.msPick = [...(chosen || P.sports || [])].slice(0, 2));
      return `<section class="ms-pick"><span class="eyebrow">Missões do seu jeito</span><h2>Quais esportes você pratica?</h2><p class="muted">Escolha até 2. As missões diárias e semanais vão ser desses esportes.</p>
        <div class="sport-grid in-page">${Object.entries(CONFIG.sports).map(([k, v]) => `<button class="${sel.includes(k) ? 'on' : ''}" style="--c:${v.color}" data-act="msToggle" data-v="${k}"><span>${I(v.icon)}</span><b>${v.name}</b>${sel.includes(k) ? `<i class="ms-check">${I('check', 'xs')}</i>` : ''}</button>`).join('')}</div>
        <small class="muted center">${sel.length}/2 escolhidos</small>
        <button class="btn primary lg" data-act="msSave" ${sel.length ? '' : 'disabled'}>Ver minhas missões</button></section>`;
    }
    const daily = Game.dailyMissions(now), dDone = daily.filter((x) => Store.data.missionsDone[Game.mKey('d', x, now)]).length;
    const bonus = Store.data.missionsDone[Game.dailyBonusKey(now)], canSwap = !(Store.data.dailySwap && Store.data.dailySwap.day === Game.dayKey(now) && Store.data.dailySwap.used);
    return `<div class="ms-head"><div class="ms-sports">${chosen.map((k) => `<span class="ms-chip" style="--c:${CONFIG.sports[k].color}">${I(CONFIG.sports[k].icon, 'xs')}${CONFIG.sports[k].name}</span>`).join('')}</div><button class="link" data-act="msEdit">Trocar esportes</button></div>
      <section class="bonus-card ${bonus ? 'got' : ''}"><div class="bc-ic">${I(bonus ? 'check' : 'gift')}</div><div class="grow"><b>${bonus ? 'Bônus do dia garantido!' : 'Bônus do dia'}</b><small>${bonus ? `+${CONFIG.dailyBonus.xp} XP e +${CONFIG.dailyBonus.coins} moedas` : `Complete as 3 missões de hoje: +${CONFIG.dailyBonus.xp} XP e +${CONFIG.dailyBonus.coins} moedas`}</small><div class="bc-dots">${daily.map((_, i) => `<i class="${i < dDone ? 'on' : ''}"></i>`).join('')}</div></div><b class="num bc-n">${dDone}/3</b></section>
      ${this.sectionHead(`Diárias <em>renovam em ${h}h ${m}min</em>`)}<div class="list">${daily.map((x) => this.missionRow(x, 'd', 'day', canSwap)).join('')}</div>
      ${canSwap ? '<p class="muted small ms-tip">Não curtiu alguma? Você pode trocar 1 missão por dia.</p>' : ''}
      ${this.sectionHead(`Semanais <em>${wd} ${wd === 1 ? 'dia' : 'dias'} restantes</em>`)}<div class="list">${Game.weeklyMissions().map((x) => this.missionRow(x, 'w', 'week')).join('')}</div>
      <section class="event"><div class="ev-ic">${I(season.icon || 'calendar')}</div><div class="grow"><span class="eyebrow">Evento do mês</span><b>${esc(season.text)}</b>${this.bar(sp.pct)}<small class="num">${sp.txt} · +${season.xp} XP</small></div></section>
      ${this.sectionHead('Metas pessoais')}${goals}
      ${this.sectionHead('Desafios entre amigos', ['Abrir', 'social:challenges', 'sub'])}<div class="list"><div class="row tap" data-act="sub" data-v="social:challenges">${this.iconBox('swords')}<div class="grow"><b>Desafie um amigo</b><small>"Quem pedala mais em 7 dias?" Valendo direto no app.</small></div>${I('chevronRight', 'chev')}</div></div>`;
  },
  treeView() {
    const total = CONFIG.unlocks.length, done = CONFIG.unlocks.filter((u) => Game.has(u.id)).length;
    return `<section class="card tree-sum"><div><span class="eyebrow">Progresso</span><b class="num">${done}<span>/${total}</span></b><small>funções liberadas</small></div><div class="ring" style="--p:${(done / total) * 100}"><span class="num">${Math.round((done / total) * 100)}%</span></div></section>
      ${CONFIG.tiers.map((t) => { const us = CONFIG.unlocks.filter((u) => u.tier === t.id), dn = us.filter((u) => Game.has(u.id)).length; return `<section class="tier">
        <div class="tier-h"><span class="tier-n num">${t.id}</span><div class="grow"><b>${t.name}</b><small>${dn} de ${us.length} liberadas</small></div></div>
        <div class="nodes">${us.map((u) => {
          const on = Game.has(u.id), p = Game.reqProgress(u.req);
          return `<div class="node ${on ? 'on' : p.pct >= 50 ? 'near' : 'off'}">
            <div class="ibox ${on ? '' : 'locked-ic'}">${I(u.icon)}${on ? '' : `<i>${I('lock')}</i>`}</div>
            <div class="grow"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small>
            ${on ? `<span class="ok-line">${I('check', 'xs')} Liberada</span>` : `<div class="req"><span>${esc(Game.reqText(u.req))}</span><span class="num">${Math.floor(p.pct)}%</span></div>${this.bar(p.pct)}<small class="num">${p.curTxt} · recompensa +${u.reward.xp} XP</small>`}</div></div>`;
        }).join('')}</div></section>`; }).join('')}`;
  },
  seasonView() {
    const xp = Game.monthXp(), L0 = Game.league(xp), nx = Game.nextLeague(xp);
    const end = new Date(); end.setMonth(end.getMonth() + 1, 1); end.setHours(0, 0, 0, 0);
    const days = Math.ceil((end - Date.now()) / 864e5), mo = new Date();
    const hist = Object.entries(Store.data.seasons).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
    return `<section class="league" style="--lc:${L0.color}">
        <div class="lg-badge">${I('crown')}</div><span class="eyebrow">Temporada de ${MONTHS[mo.getMonth()]} · termina em ${days} dia${days > 1 ? 's' : ''}</span>
        <h2>Liga ${L0.name}</h2><b class="num lg-xp">${xp} XP</b>
        ${nx ? `${this.bar(((xp - L0.min) / (nx.min - L0.min)) * 100)}<small>${nx.min - xp} XP para a Liga ${nx.name}</small>` : '<small>Você está na liga mais alta. Mantenha o ritmo!</small>'}
      </section>
      <div class="leagues">${CONFIG.leagues.map((l) => `<div class="lg-card ${l.id === L0.id ? 'on' : ''} ${xp >= l.min ? 'reached' : ''}" style="--lc:${l.color}"><div>${I('crown')}</div><b>${l.name}</b><small class="num">${l.min} XP</small><small class="num">+${l.reward} moedas</small></div>`).join('')}</div>
      <p class="muted small">O XP do mês zera no dia 1º. No fim da temporada você recebe as moedas da liga que alcançou.</p>
      ${this.sectionHead('Ranking da temporada')}<div id="seasonBoard">${Cloud.loggedIn() ? '<div class="loading">Carregando…</div>' : `<div class="row soon-row">${this.iconBox('users')}<div class="grow"><b>Dispute com outros atletas</b><small>Entre na sua conta para ver o ranking mensal de XP.</small></div><button class="chip-btn sm" data-act="go" data-v="account">Entrar</button></div>`}</div>
      ${hist.length ? `${this.sectionHead('Temporadas anteriores')}<div class="list">${hist.map(([k, v]) => { const l = CONFIG.leagues.find((x) => x.id === v.league) || CONFIG.leagues[0]; const [y, m] = k.split('-'); return `<div class="row"><div class="ibox" style="--c:${l.color}">${I('crown')}</div><div class="grow"><b>${MONTHS[m - 1]} ${y}</b><small>Liga ${l.name}</small></div><b class="num">${v.xp} XP</b></div>`; }).join('')}</div>` : ''}`;
  },
  async loadSeasonBoard() {
    if (!Cloud.loggedIn()) return;
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    try {
      const b = await Cloud.leaderboard({ since, metric: 'xp' });
      const el = $('#seasonBoard'); if (el) el.innerHTML = this.board(b, (v) => `${Math.round(v)} XP`);
    } catch (e) { const el = $('#seasonBoard'); if (el) el.innerHTML = '<p class="muted">Não foi possível carregar o ranking.</p>'; }
  },
  board(rows, fmt) {
    if (!rows.length) return '<p class="muted small">Ninguém pontuou ainda neste período. Seja o primeiro!</p>';
    const me = Cloud.user && Cloud.user.id;
    return `<div class="list">${rows.map((r, i) => `<div class="row board ${r.user_id === me ? 'is-me' : ''}" data-act="userOpen" data-v="${r.user_id}"><span class="pos num ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span>${this.avatarOf(r.name, r.frame, r.avatar, 'sm', r.photo)}<div class="grow"><b>${esc(r.name)}</b><small>${r.username ? '@' + esc(r.username) : ''}${r.city ? ' · ' + esc(r.city) : ''}</small></div><b class="num">${fmt(Number(r.value))}</b></div>`).join('')}</div>`;
  },
  shopView() {
    const D = Store.data, cats = [['line', 'Cor do traçado'], ['frame', 'Moldura do perfil'], ['avatar', 'Avatar'], ['theme', 'Tema do app'], ['finish', 'Efeito de chegada']];
    const def = { line: 'Cor do esporte', frame: 'Azul JustGo', avatar: 'Grafite', theme: 'Padrão', finish: 'Confete' };
    const swatch = (it) => it.cat === 'line' ? `<i class="sw" style="background:${it.value}"></i>` : it.cat === 'frame' ? `<i class="sw ring-sw" style="background:${it.value}"></i>` : it.cat === 'avatar' ? `<i class="sw" style="background:${it.value}"></i>` : it.cat === 'theme' ? `<i class="sw theme-${it.value}"></i>` : `<i class="sw fx">${I(it.value === 'fireworks' ? 'sparkles' : 'activity')}</i>`;
    return `<section class="card wallet"><div>${I('coin')}<b class="num">${D.coins}</b><small>moedas</small></div><small>Ganhe moedas treinando, cumprindo missões e subindo de liga. Tudo na loja é visual: nada dá vantagem.</small></section>
      ${cats.map(([c, n]) => `${this.sectionHead(n)}<div class="shop">
        <button class="item ${!D.equipped[c] ? 'eq' : ''}" data-act="equip" data-v="${c}:">${c === 'line' ? '<i class="sw" style="background:conic-gradient(#1F6BFF 0 33%,#12B886 0 66%,#14C2D6 0)"></i>' : c === 'frame' ? '<i class="sw ring-sw" style="background:#1F6BFF"></i>' : c === 'avatar' ? '<i class="sw" style="background:linear-gradient(145deg,#3A3A3C,#1C1C1E)"></i>' : c === 'theme' ? '<i class="sw theme-dark"></i>' : `<i class="sw fx">${I('sparkles')}</i>`}<b>${def[c]}</b><small>${!D.equipped[c] ? 'Em uso' : 'Grátis'}</small></button>
        ${CONFIG.shop.filter((x) => x.cat === c).map((it) => { const own = Shop.owned(it.id), eq = D.equipped[c] === it.id; return `<button class="item ${eq ? 'eq' : ''} ${own ? 'own' : D.coins < it.price ? 'poor' : ''}" data-act="${own ? 'equip' : 'buy'}" data-v="${own ? c + ':' + it.id : it.id}">${swatch(it)}<b>${esc(it.name.replace(/^(Traçado|Moldura|Avatar|Tema|Chegada:) ?/, ''))}</b><small>${eq ? 'Em uso' : own ? 'Usar' : `${I('coin', 'xs')} ${it.price}`}</small></button>`; }).join('')}</div>`).join('')}`;
  },

  /* =========================================================
     PLANOS DE TREINO
     ========================================================= */
  plans() {
    if (!Game.has('plans')) return this.render(`${this.back('home', 'Planos de treino')}<main class="screen">${this.lockedBox('plans')}</main>`);
    const a = Plans.today();
    let body = '';
    if (a) {
      const total = a.weeks.reduce((x, y) => x + y.length, 0), dn = Object.keys(a.P.done).length;
      body = `<section class="card plan-head" style="--c:${CONFIG.sports[a.def.sport].color}"><span class="eyebrow">Plano ativo</span><h2>${esc(a.def.name)}</h2><small>${a.weeks.length} semanas · ${a.def.perWeek} treinos por semana</small>${this.bar((dn / total) * 100)}<small class="num">${dn} de ${total} treinos concluídos</small></section>
        <p class="muted small">Faça os treinos com o esporte do plano. Quando você completar pelo menos 80% da distância de um treino da semana, ele é marcado sozinho.</p>
        ${a.weeks.map((wk, w) => { const done = wk.filter((_, i) => a.P.done[`${w}-${i}`]).length, cur = w === a.w; return `<details class="week-plan" ${cur ? 'open' : ''}><summary><span class="tier-n num ${cur ? 'cur' : done === wk.length ? 'ok' : ''}">${w + 1}</span><div class="grow"><b>Semana ${w + 1}${cur ? ' · atual' : ''}</b><small>${done}/${wk.length} treinos · ${Fmt.num(wk.reduce((x, y) => x + y.km, 0))} km</small></div>${I('chevronRight', 'chev')}</summary>
          ${wk.map((s, i) => { const ok = a.P.done[`${w}-${i}`]; return `<div class="row ${ok ? 'done' : ''}">${ok ? `<div class="ibox ok">${I('check')}</div>` : this.iconBox(s.type === 'Prova!' ? 'trophy' : /Interv|Séries|Subidas/.test(s.type) ? 'zap' : /Long|Contínuo/.test(s.type) ? 'route' : 'activity')}<div class="grow"><b>${esc(s.type)} · ${Fmt.num(s.km)} km</b><small>${esc(s.note)}</small></div></div>`; }).join('')}</details>`; }).join('')}
        <button class="btn danger ghost" data-act="planStop">Abandonar plano</button>`;
    } else {
      body = `<p class="muted lead">Escolha um objetivo. O JustGo monta sua semana, acompanha os treinos e avisa quando é dia de longão.</p>
        <div class="list">${CONFIG.plans.map((p) => `<button class="row tap" data-act="planStart" data-v="${p.id}">${this.iconBox(p.id === 'pswim' ? 'swim' : p.sport === 'ride' ? 'bike' : 'trophy', CONFIG.sports[p.sport].color)}<div class="grow"><b>${esc(p.name)}</b><small>${esc(p.desc)} ${p.weeks} semanas · ${p.perWeek}×/semana</small></div>${I('chevronRight', 'chev')}</button>`).join('')}</div>`;
    }
    this.render(`${this.back('home', 'Planos de treino')}<main class="screen">${body}</main>`);
  },

  /* =========================================================
     ESTATÍSTICAS
     ========================================================= */
  stats() {
    const per = App.statsP || 'week', spf = App.statsS || 'all';
    const now = new Date(), acts = Game.acts().filter((a) => spf === 'all' || a.sport === spf);
    let from, labels, buckets, hi;
    if (per === 'week') {
      from = Game.weekStart(now); labels = WEEKDAYS; buckets = Array(7).fill(0); hi = (now.getDay() + 6) % 7;
      acts.forEach((a) => { if (a.start >= from) buckets[(new Date(a.start).getDay() + 6) % 7] += a.distance / 1000; });
    } else if (per === 'month') {
      const d0 = new Date(now.getFullYear(), now.getMonth(), 1); from = d0.getTime();
      const n = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      labels = Array.from({ length: n }, (_, i) => ((i + 1) % 5 === 0 || i === 0 ? String(i + 1) : '')); buckets = Array(n).fill(0); hi = now.getDate() - 1;
      acts.forEach((a) => { if (a.start >= from) buckets[new Date(a.start).getDate() - 1] += a.distance / 1000; });
    } else {
      from = new Date(now.getFullYear(), 0, 1).getTime(); labels = MONTHS.map((m) => m[0].toUpperCase()); buckets = Array(12).fill(0); hi = now.getMonth();
      acts.forEach((a) => { if (a.start >= from) buckets[new Date(a.start).getMonth()] += a.distance / 1000; });
    }
    const inP = acts.filter((a) => a.start >= from);
    const tot = { km: Game.km(inP), time: inP.reduce((s, a) => s + a.duration, 0), n: inP.length, elev: inP.reduce((s, a) => s + Geo.elevationGain(a.points), 0), kcal: inP.reduce((s, a) => s + Game.calories(a), 0) };
    // evolução: últimas 12 semanas
    const ws = Game.weekStart(Date.now()), wk = Array(12).fill(0), pace = Array(12).fill(NaN), pd = Array(12).fill(0), pt = Array(12).fill(0);
    acts.forEach((a) => { const i = 11 - Math.round((ws - Game.weekStart(a.start)) / (7 * 864e5)); if (i >= 0 && i < 12) { wk[i] += a.distance / 1000; if (a.sport === 'run') { pd[i] += a.distance; pt[i] += a.duration; } } });
    pd.forEach((d, i) => { if (d) pace[i] = pt[i] / (d / 1000); });
    const color = spf === 'all' ? 'var(--brand)' : CONFIG.sports[spf].color;
    const bySport = Object.entries(CONFIG.sports).map(([k, s]) => { const l = Game.acts().filter((a) => a.sport === k && a.start >= from); return [k, s, Game.km(l), l.length]; });
    this.render(`${this.back('home', 'Estatísticas')}<main class="screen">
      ${this.tabsBar([['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']], per, 'statsP')}
      <div class="choice sport-filter">${[['all', 'Todos'], ...Object.entries(CONFIG.sports).map(([k, s]) => [k, s.name])].map(([k, n]) => `<button class="pill-btn ${spf === k ? 'on' : ''}" data-act="statsS" data-v="${k}">${n}</button>`).join('')}</div>
      <section class="card"><div class="week-n"><b class="num">${Fmt.num(tot.km)}</b><span>km</span></div>${this.bars(buckets, labels, { hi, color, fmt: (v) => (v >= 10 ? Math.round(v) : Fmt.num(v)) })}</section>
      <div class="stat-grid"><div><span class="eyebrow">Atividades</span><b class="num">${tot.n}</b></div><div><span class="eyebrow">Tempo</span><b class="num">${Fmt.time(tot.time)}</b></div><div><span class="eyebrow">Elevação</span><b class="num">${tot.elev} m</b></div><div><span class="eyebrow">Calorias</span><b class="num">${tot.kcal.toLocaleString('pt-BR')}</b></div></div>
      ${spf === 'all' ? `${this.sectionHead('Por esporte')}<div class="list">${bySport.map(([k, s, km, n]) => `<div class="row">${this.iconBox(SPORT_IC[k], s.color)}<div class="grow"><b>${s.name}</b><small>${n} atividade${n === 1 ? '' : 's'}</small></div><b class="num">${Fmt.num(km)} km</b></div>`).join('')}</div>` : ''}
      ${this.sectionHead('Evolução · 12 semanas')}<section class="card">${this.bars(wk, wk.map((_, i) => (i === 11 ? 'atual' : i % 3 === 2 ? `-${11 - i}` : '')), { hi: 11, color })}</section>
      ${pd.some((x) => x) && (spf === 'all' || spf === 'run') ? `${this.sectionHead('Ritmo médio de corrida')}<section class="card"><canvas class="chart" id="cTrend"></canvas><small class="muted">Quanto mais alto, mais rápido.</small></section>` : ''}
      ${this.sectionHead('Recordes pessoais')}${this.recordsHtml()}
    </main>`);
    const xs = [], ys = []; pace.forEach((v, i) => { if (isFinite(v)) { xs.push(i); ys.push(v); } });
    if ($('#cTrend') && xs.length > 1) FX.chart($('#cTrend'), xs, ys, { color: CONFIG.sports.run.color, invert: true, fmtY: (v) => Fmt.time(v), label: 'min/km', xEnd: 'esta semana', minRange: 30 });
  },
  recordsHtml() {
    const recs = Object.values(Store.data.records);
    return `<section class="card kvl">${recs.length ? recs.map((r) => `<div><span>${esc(r.label)}</span><b class="num">${r.fmt === 'dist' ? Fmt.km(r.value) + ' km' : Fmt.time(r.value)}</b></div>`).join('') : '<p class="muted">Seus recordes aparecem aqui depois do primeiro treino.</p>'}</section>`;
  },

  /* =========================================================
     EQUIPAMENTOS
     ========================================================= */
  gear() {
    const sec = (type, title) => {
      const L0 = Gear.list(type);
      return `${this.sectionHead(title, ['Adicionar', type, 'gearAdd'])}${L0.length ? `<div class="list">${L0.map((g) => { const st = Gear.status(g); return `<div class="row gear ${g.retired ? 'retired' : ''}">${this.iconBox(type === 'shoe' ? 'shoe' : 'bike', st.level === 'bad' ? 'var(--bad)' : st.level === 'warn' ? 'var(--warn)' : '')}
        <div class="grow"><div class="row-t"><b>${esc(g.name)}</b>${g.retired ? '<span class="badge">Aposentado</span>' : g.isDefault ? '<span class="badge">Padrão</span>' : ''}</div>
        <div class="bar ${st.level}"><span style="width:${st.pct}%"></span></div><small class="num">${Fmt.num(st.km)} km${type === 'shoe' ? ` de ~${st.lim.max} km` : ''}${st.level === 'bad' && type === 'shoe' ? ' · hora de trocar' : st.level === 'warn' && type === 'shoe' ? ' · perto do limite' : ''}</small>
        <div class="rr-act">${!g.retired && !g.isDefault ? `<button class="chip-btn sm" data-act="gearDefault" data-v="${g.id}">Tornar padrão</button>` : ''}<button class="chip-btn sm" data-act="gearRetire" data-v="${g.id}">${g.retired ? 'Reativar' : 'Aposentar'}</button></div></div></div>`; }).join('')}</div>`
        : `<div class="row soon-row">${this.iconBox(type === 'shoe' ? 'shoe' : 'bike')}<div class="grow"><b>Nenhum${type === 'shoe' ? ' tênis' : 'a bike'}</b><small>${type === 'shoe' ? 'O app avisa quando o tênis passar de 600 km.' : 'Acompanhe a quilometragem para revisões.'}</small></div></div>`}`;
    };
    this.render(`${this.back('profile', 'Equipamentos')}<main class="screen">${sec('shoe', 'Tênis')}${sec('bike', 'Bikes')}<p class="muted small">O equipamento padrão é ligado sozinho a cada treino. Você pode trocar no resumo da atividade.</p></main>`);
  },

  /* =========================================================
     PERFIL
     ========================================================= */
  profile() {
    const D = Store.data, P = D.profile, acts = Game.acts(), lv = this.levelLine();
    const L0 = Game.league(Game.monthXp()), tab = ['activities', 'stats', 'achievements', 'more'].includes(App.sub.profile) ? App.sub.profile : 'activities';
    const city = (Cloud.me && Cloud.me.city) || Pref('city');
    const handle = Cloud.me && Cloud.me.username ? '@' + esc(Cloud.me.username) : '';
    const medals = Object.keys(D.medals).length, zones = Zones.mine();
    const row = (act, v, ic, t, sub, right = '') => `<button class="row tap" data-act="${act}" data-v="${v}">${this.iconBox(ic)}<div class="grow"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right}${I('chevronRight', 'chev')}</button>`;
    let body = '';
    if (tab === 'activities') {
      const list = [...D.activities].sort((x, y) => y.start - x.start), name = esc(P.name);
      let lastM = '';
      body = list.length ? list.slice(0, 20).map((x) => { const m = new Date(x.start).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); const h = m !== lastM ? `<h4 class="pf-month">${m}</h4>` : ''; lastM = m; return h + this.postCard(x, name); }).join('') + (list.length > 20 ? `<button class="btn ghost" data-act="go" data-v="history">Ver todas as ${list.length} atividades</button>` : '')
        : `<div class="empty">${I('activity')}<h3>Nenhuma atividade ainda</h3><p>Seus treinos aparecem aqui.</p><button class="btn primary" data-act="go" data-v="record">Começar um treino</button></div>`;
    } else if (tab === 'achievements') {
      const pred = Game.predictions();
      body = `<section class="card ach-sum"><div class="row-t"><div><span class="eyebrow">Medalhas</span><b class="display">${medals}<span>/${CONFIG.medals.length}</span></b></div><small>${Math.round((medals / CONFIG.medals.length) * 100)}% conquistadas</small></div>${this.bar((medals / CONFIG.medals.length) * 100, 'brand')}</section>
        <div class="medal-grid">${CONFIG.medals.map((m) => { const on = D.medals[m.id]; return `<div class="medal-tile ${on ? 'on' : ''}" title="${esc(m.desc)}"><div class="hex">${I(on ? m.icon : 'lock')}</div><b>${esc(m.name)}</b><small>${on ? new Date(on).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : esc(m.desc)}</small></div>`; }).join('')}</div>
        ${this.sectionHead('Recordes pessoais')}${this.recordsHtml()}
        ${this.sectionHead('Previsão de prova')}
        ${Game.has('racePredict') ? `<section class="card">${pred ? `<div class="kv four">${pred.map((x) => `<div><span class="eyebrow">${x.n}</span><b class="num">${Fmt.time(x.t)}</b></div>`).join('')}</div><small class="muted">Estimativa pela fórmula de Riegel, com base no seu melhor tempo de corrida.</small>` : '<p class="muted">Corra pelo menos 1 km para gerar a previsão.</p>'}</section>`
          : this.lockedBox('racePredict', '<div class="fake-field"><span>5K</span><b>25:10</b><span>10K</span><b>52:30</b></div>')}`;
    } else {
      const y0 = new Date(new Date().getFullYear(), 0, 1).getTime(), yr = acts.filter((x) => x.start >= y0);
      const ws = Game.weekStart(Date.now()), wk = Array(8).fill(0);
      acts.forEach((x) => { const i = 7 - Math.round((ws - Game.weekStart(x.start)) / (7 * 864e5)); if (i >= 0 && i < 8) wk[i] += x.distance / 1000; });
      const avg = wk.reduce((x, y) => x + y, 0) / 8;
      const daily = Game.dailyMissions(Date.now()), dDone = daily.filter((m) => D.missionsDone[Game.mKey('d', m, Date.now())]).length;
      const un = CONFIG.unlocks.filter((u) => Game.has(u.id)).length;
      body = `${this.sectionHead(`Este ano <em>${new Date().getFullYear()}</em>`)}
        <div class="stat-grid"><div><span class="eyebrow">Distância</span><b class="num">${Fmt.num(Game.km(yr), 1)} <small>km</small></b></div><div><span class="eyebrow">Tempo</span><b class="num">${Fmt.time(yr.reduce((x, a) => x + a.duration, 0))}</b></div><div><span class="eyebrow">Treinos</span><b class="num">${yr.length}</b></div><div><span class="eyebrow">Elevação</span><b class="num">${yr.reduce((x, a) => x + Geo.elevationGain(a.points), 0)} <small>m</small></b></div></div>
        <section class="card tap" data-act="go" data-v="stats"><div class="row-t"><div><span class="eyebrow">Últimas 8 semanas</span><div class="week-n"><b class="num">${Fmt.num(wk.reduce((x, y) => x + y, 0))}</b><span>km</span></div></div><small class="num">média ${Fmt.num(avg)} km/sem</small></div>${this.bars(wk, wk.map((_, i) => (i === 7 ? 'atual' : '')), { hi: 7 })}</section>
        <div class="sport-cards">${Object.entries(CONFIG.sports).map(([k, sp]) => [k, sp, Game.km(acts.filter((x) => x.sport === k))]).sort((a, b) => b[2] - a[2] || ((P.sports || []).includes(b[0]) - (P.sports || []).includes(a[0]))).slice(0, 3).map(([k, sp]) => { const l = acts.filter((x) => x.sport === k), km = Game.km(l); return `<div class="sport-card" style="--c:${sp.color}"><div class="sc-ic">${I(SPORT_IC[k])}</div><b class="num">${Fmt.num(km, km >= 100 ? 0 : 1)}<span> km</span></b><small>${sp.name} · ${l.length} treino${l.length === 1 ? '' : 's'}</small></div>`; }).join('')}</div>
        <button class="pro-entry ${Pro.on() ? 'on' : ''}" data-act="go" data-v="pro"><span class="pro-badge">PRO</span><div class="grow"><b>Modo profissional</b><small>${Pro.on() ? 'Ativado · estatísticas detalhadas em cada treino' : 'Calorias exatas, velocidade máxima, potência e mais'}</small></div><span class="pro-state">${Pro.on() ? 'Ativo' : 'Ativar'}</span></button>
        ${this.retroCard()}
        <button class="terr-card" data-act="go" data-v="mapa"><div class="tc-ic">${I('flag')}</div><div class="grow"><span class="eyebrow">Território</span><b>${zones.length ? `${zones.length} área${zones.length > 1 ? 's' : ''} · ${Zones.areaTxt(Zones.totalArea())}` : 'Nenhuma área ainda'}</b><small>${zones.length ? 'Veja e defenda no mapa' : 'Feche um circuito correndo para conquistar'}</small></div>${I('chevronRight', 'chev')}</button>
`;
    }
    if (tab === 'more') {
      const daily = Game.dailyMissions(Date.now()), dDone = daily.filter((m) => D.missionsDone[Game.mKey('d', m, Date.now())]).length;
      const un = CONFIG.unlocks.filter((u) => Game.has(u.id)).length;
      body = `        ${this.sectionHead('Progresso')}
        <div class="list">
          ${row('sub', 'progress:missions', 'target', 'Missões', `Hoje: ${dDone} de ${daily.length} concluídas`)}
          ${row('sub', 'progress:tree', 'unlock', 'Desbloqueios', `${un} de ${CONFIG.unlocks.length} funções liberadas`)}
          ${row('sub', 'progress:season', 'crown', 'Temporada', `Liga ${L0.name} · ${Game.monthXp()} XP no mês`)}
          ${row('sub', 'progress:shop', 'bag', 'Loja', `${D.coins} moedas`)}
        </div>
        ${this.sectionHead('Treino')}
        <div class="list">
          ${row('go', 'history', 'activity', 'Todas as atividades', `${acts.length} no total`)}
          ${row('go', 'stats', 'barChart', 'Estatísticas', 'Semana, mês, ano e evolução')}
          ${row('go', 'plans', 'clipboard', 'Planos de treino', Plans.today() ? 'Plano ativo' : 'Escolha um objetivo')}
          ${row('go', 'gear', 'shoe', 'Equipamentos', 'Tênis e bikes')}
          ${row('go', 'safety', 'shield', 'Segurança e privacidade', 'Zona de privacidade e contato de confiança')}
        </div>
        ${this.sectionHead('Conta e app')}
        <div class="list">
          ${row('go', 'atleta', 'user', 'Seu atleta', Avatar.on() ? `${Avatar.stage().name} · poder ${Avatar.stats().pow}` : 'Crie um personagem que evolui com seus treinos (opcional)')}
          ${row('editProfile', '', 'user', 'Editar perfil', 'Nome, foto, cidade, bio e peso')}
          ${row('go', 'settings', 'settings', 'Configurações', 'Tema, unidades, voz, mapa, backup e atualizações')}
          ${row('go', 'account', 'cloud', 'Conta e sincronização', Cloud.loggedIn() ? 'Conectado' : 'Entrar ou criar conta')}
        </div>`;
    }
    this.render(`${this.header('Perfil', `<button class="icon-btn" data-act="go" data-v="settings" aria-label="Configurações">${I('settings')}</button>`)}<main class="screen profile">
      <section class="pf-head">
        <div class="pf-cover"><button class="cover-edit" data-act="editProfile">${I('settings', 'xs')} Editar perfil</button></div>
        <div class="pf-id"><button class="pf-photo" data-act="myPhoto" aria-label="Foto de perfil">${this.avatar('lg')}<span class="pf-cam">${I('camera')}</span></button><input type="file" id="photoIn" accept="image/*" hidden><div class="grow"><h2>${esc(P.name)}</h2><small class="prof-meta">${[handle, city ? `${I('mapPin', 'xs')} ${esc(city)}` : ''].filter(Boolean).join(' · ') || '<span class="link-like" data-act="editProfile">Adicionar cidade e bio</span>'}</small></div></div>
        ${Pref('bio') ? `<p class="pf-bio">${esc(Pref('bio'))}</p>` : ''}
        <div class="prof-tags"><span class="league-pill" style="--lc:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span><span class="lvl-pill">${I('zap', 'xs')} Nível ${lv.l} · ${Game.title(lv.l)}</span>${Pro.on() ? '<span class="pro-badge">PRO</span>' : ''}</div>
        ${Cloud.loggedIn() ? `<div class="pf-stats"><div><b class="num">${acts.length}</b><small>Atividades</small></div><button data-act="followList" data-v="friends"><b class="num" id="pfFriends">–</b><small>Amigos</small></button><button data-act="followList" data-v="followers"><b class="num" id="pfFollowers">–</b><small>Seguidores</small></button><button data-act="followList" data-v="following"><b class="num" id="pfFollowing">–</b><small>Seguindo</small></button></div>`
          : `<div class="pf-stats"><div><b class="num">${acts.length}</b><small>Atividades</small></div><div><b class="num">${Fmt.num(Game.km(acts), 0)}</b><small>Km</small></div><div><b class="num">${zones.length}</b><small>Áreas</small></div><div><b class="num">${medals}</b><small>Medalhas</small></div></div>`}
        <div class="pf-level"><div class="row-t"><small>Nível ${lv.l + 1}</small><small class="num">${lv.txt}</small></div>${this.bar(lv.pct, 'brand')}</div>
      </section>
      ${Cloud.configured() && !Cloud.loggedIn() ? `<button class="cta login" data-act="go" data-v="account"><div class="cta-ic">${I('user')}</div><div class="grow"><b>Entrar ou criar conta</b><small>Salve na nuvem, siga amigos e dispute o mapa</small></div>${I('chevronRight', 'chev')}</button>` : ''}
      ${this.tabsBar([['activities', 'Atividades'], ['stats', 'Estatísticas'], ['achievements', 'Conquistas'], ['more', 'Ajustes']], tab, 'profTab')}
      ${body}
    </main>`);
    if (Cloud.loggedIn()) Cloud.followCounts(Cloud.user.id).then((c) => { const a = $('#pfFollowers'), b = $('#pfFollowing'); if (a) a.textContent = c.followers; if (b) b.textContent = c.following; const f = $('#pfFriends'); if (f) f.textContent = c.friends; }).catch(() => {});
  },

  /* =========================================================
     CONFIGURAÇÕES
     ========================================================= */
  settings() {
    const D = Store.data, P = D.profile;
    const sw = (k, t, sub, lock) => {
      if (lock && !Game.has(lock)) return `<div class="cfg-row is-locked" data-act="sub" data-v="progress:tree"><div class="grow"><b>${t}</b><small>${I('lock', 'xs')} Desbloqueie: ${esc(Game.reqText(Game.unlock(lock).req))}</small></div></div>`;
      return `<label class="cfg-row"><div class="grow"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div><span class="switch"><input type="checkbox" data-pref="${k}" ${Pref(k) ? 'checked' : ''}><i></i></span></label>`;
    };
    const link = (v, ic, t, sub, act = 'go') => `<button class="cfg-row tap" data-act="${act}" data-v="${v}">${this.iconBox(ic)}<div class="grow"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${I('chevronRight', 'chev')}</button>`;
    const seg = (k, opts) => `<div class="seg pref-seg">${opts.map(([v, n]) => `<button class="${(Pref(k) || '') === v ? 'on' : ''}" data-act="setPref" data-v="${k}:${v}">${n}</button>`).join('')}</div>`;
    const acc = Cloud.loggedIn() ? (Cloud.me && Cloud.me.username ? '@' + esc(Cloud.me.username) : 'Conta conectada') : Cloud.configured() ? 'Não conectado' : 'Nuvem desativada';
    this.render(`${this.back('profile', 'Configurações')}<main class="screen settings">
      <h3 class="group">Conta</h3>
      <div class="list cfg-list">
        <button class="cfg-row tap" data-act="editProfile">${this.avatar('sm')}<div class="grow"><b>${esc(P.name)}</b><small>Nome, cidade, bio, peso e esportes</small></div>${I('chevronRight', 'chev')}</button>
        <div class="cfg-row">${this.iconBox('camera')}<div class="grow"><b>Foto de perfil</b><small>${P.photo ? 'Aparece no Social, nos clubes e nos comentários' : 'Coloque uma foto para seus amigos te reconhecerem'}</small></div><button class="chip-btn sm" data-act="photoPick">${P.photo ? 'Trocar' : 'Escolher'}</button>${P.photo ? `<button class="chip-btn sm ghost-btn" data-act="photoRemove">Remover</button>` : ''}<input type="file" id="photoIn" accept="image/*" hidden></div>
        ${link('account', 'cloud', 'Conta e sincronização', acc)}
      </div>

      <h3 class="group">Treino</h3>
      <div class="list cfg-list">
        ${sw('autoPause', 'Pausa automática', 'Pausa o cronômetro quando você para', 'autopause')}
        ${sw('voice', 'Treinador por voz', 'Avisos falados a cada km', 'voice')}
        ${sw('countdown', 'Contagem regressiva', '3, 2, 1 antes de começar a gravar')}
        ${sw('keepAwake', 'Manter tela acesa', 'Durante o treino')}
        <div class="cfg-row col-row"><div class="grow"><b>Esporte ao abrir o Gravar</b></div>${seg('defaultSport', [['', 'Último'], ...Object.entries(CONFIG.sports).map(([k, s]) => [k, s.name])])}</div>
      </div>

      <h3 class="group">Metas</h3>
      <div class="list cfg-list">
        <div class="cfg-row"><div class="grow"><b>Meta semanal</b><small>Aparece no Início</small></div><div class="num-in"><input type="number" min="1" inputmode="numeric" data-set="goalWeek" value="${P.goalWeek}"><span>km</span></div></div>
        <div class="cfg-row"><div class="grow"><b>Meta mensal</b>${Game.has('goals') ? '' : `<small>${I('lock', 'xs')} acompanhamento libera com Metas personalizadas</small>`}</div><div class="num-in"><input type="number" min="1" inputmode="numeric" data-set="goalMonth" value="${P.goalMonth}"><span>km</span></div></div>
      </div>

      <h3 class="group">Aparência</h3>
      <div class="list cfg-list">
        <div class="cfg-row col-row"><div class="grow"><b>Tema</b><small>${D.equipped.theme ? 'Um tema da Loja está ativo' : 'Escolha como o app aparece'}</small></div>${seg('theme', [['dark', 'Escuro'], ['light', 'Claro'], ['auto', 'Automático']])}</div>
        <div class="cfg-row col-row"><div class="grow"><b>Estilo dos mapas</b></div>${seg('mapStyle', [['color', 'Colorido'], ['dark', 'Escuro']])}</div>
        ${link('progress:shop', 'bag', 'Loja de visuais', 'Cores do traçado, molduras, temas', 'sub')}
      </div>

      <h3 class="group">Sons e vibração</h3>
      <div class="list cfg-list">
        ${sw('sounds', 'Sons', 'Conquistas, desbloqueios e alertas de treino')}
        ${sw('haptics', 'Vibração', 'A cada km e nos alertas')}
      </div>

      <h3 class="group">Privacidade e segurança</h3>
      <div class="list cfg-list">
        ${link('safety', 'shield', 'Zona de privacidade', D.privacy.zone ? 'Ativa' : 'Desativada')}
        ${link('safety', 'signal', 'Contato de confiança', D.trusted.name ? esc(D.trusted.name) : 'Não definido')}
      </div>

      <h3 class="group">Dados</h3>
      <div class="list cfg-list">
        ${link('', 'download', 'Exportar backup', 'Salva todos os seus dados em um arquivo', 'backup')}
        <label class="cfg-row tap">${this.iconBox('upload')}<div class="grow"><b>Restaurar backup</b><small>Carrega um arquivo exportado antes</small></div>${I('chevronRight', 'chev')}<input type="file" id="backupIn" accept=".json,application/json" hidden></label>
        <button class="cfg-row tap danger" data-act="reset">${this.iconBox('trash', 'var(--bad)')}<div class="grow"><b>Apagar todos os dados</b><small>Remove treinos, XP e desbloqueios deste aparelho</small></div></button>
      </div>

      <h3 class="group">Atualizações</h3>
      <div class="list cfg-list">
        <button class="cfg-row tap" data-act="checkUpdate">${this.iconBox('refresh')}<div class="grow"><b>Procurar atualização</b><small id="verInfo">Versão ${CONFIG.version}${Native.on ? ' · app Android' : ''}</small></div>${I('chevronRight', 'chev')}</button>
      </div>

      <div class="about" data-ver="1">${MARK('lg')}<b>Just<span>Go</span></b><small>Versão ${CONFIG.version}${Native.on ? ' · app Android' : ''}</small><small>Mapas © OpenFreeMap · OpenMapTiles · OpenStreetMap</small></div>
    </main>`);
  },

  async verInfo() {
    if (!Native.on) return;
    const v = await Native.call('version'), el = $('#verInfo'); if (!el) return;
    el.textContent = v ? `Versão ${CONFIG.version} · instalador ${v.native}${v.ready ? ' · atualização pronta' : ''}` : `Versão ${CONFIG.version} · instalador antigo: baixe o APK novo`;
  },

  /* =========================================================
     SEGURANÇA E PRIVACIDADE
     ========================================================= */
  safety() {
    const P = Store.data.privacy, T = Store.data.trusted;
    this.render(`${this.back(App.from === 'settings' ? 'settings' : 'profile', 'Segurança e privacidade')}<main class="screen">
      ${this.sectionHead('Zona de privacidade')}
      <section class="card form">
        <label class="switch"><input type="checkbox" id="privZone" ${P.zone ? 'checked' : ''}><i></i><span>Esconder a área da minha casa<small>Some dos mapas públicos, do feed e do card compartilhado</small></span></label>
        <div class="priv-loc">${I('mapPin')}<span>${P.lat != null ? `Casa marcada (${P.lat.toFixed(3)}, ${P.lng.toFixed(3)})` : 'Casa ainda não marcada'}</span></div>
        <div class="row2"><button class="btn ghost" data-act="privHome" data-v="gps">${I('nav')}Usar minha posição</button><button class="btn ghost" data-act="privHome" data-v="last">${I('flag')}Início do último treino</button></div>
        <div class="field"><span>Raio escondido</span><div class="choice">${[150, 250, 500, 1000].map((r) => `<label class="opt"><input type="radio" name="privR" value="${r}" ${P.radius === r ? 'checked' : ''}><span>${r < 1000 ? r + ' m' : '1 km'}</span></label>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" id="privEnds" ${P.trimEnds ? 'checked' : ''}><i></i><span>Cortar 200 m do início e do fim<small>Proteção extra em todos os treinos públicos</small></span></label>
      </section>
      ${this.sectionHead('Contato de confiança')}
      <section class="card form">
        <p class="muted small">Durante o treino, o botão ${I('signal', 'xs')} envia sua localização para este contato. Com a conta conectada, ele acompanha em tempo real por um link.</p>
        <label class="field"><span>Nome</span><input data-trust="name" value="${esc(T.name)}" placeholder="Ex.: Mãe"></label>
        <label class="field"><span>WhatsApp (com DDD)</span><input data-trust="phone" type="tel" inputmode="tel" value="${esc(T.phone)}" placeholder="27 99999-0000"></label>
      </section>
      ${this.sectionHead('Antitrapaça')}
      <section class="card kvl">${Object.values(CONFIG.sports).map((s) => `<div><span>${s.name}: limite de velocidade média</span><b class="num">${s.maxKmh} km/h</b></div>`).join('')}<div><span>Trechos em velocidade de veículo</span><b>&gt; 25% = não conta</b></div></section>
    </main>`);
  },
};
