/* =========================================================
   JustGo — TELAS PRINCIPAIS
   Cada função monta uma tela em HTML. As ações dos botões
   ficam em app.js (atributo data-act). Telas sociais: ui-social.js
   ========================================================= */
const SPORT_IC = { run: 'run', ride: 'bike', swim: 'swim' };
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
  baseLayer(m, dark) {
    const M = CONFIG.maps, raster = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    if (!L.maplibreGL || !window.maplibregl) { m.getContainer().classList.toggle('map-dim', dark); return raster(); }
    try {
      const gl = L.maplibreGL({ style: dark ? M.dark : M.color, attribution: M.attribution, interactive: false }).addTo(m);
      const glMap = gl.getMaplibreMap && gl.getMaplibreMap();
      if (glMap) {
        let fell = false;
        glMap.on('error', (e) => {
          if (fell || !e || !e.error || !/style|fetch|load|404|Failed/i.test(String(e.error.message || e.error.status || ''))) return;
          fell = true; glMap.setStyle(M.fallback);
          if (dark) m.getContainer().classList.add('map-invert');
        });
      }
      return gl;
    } catch (err) {
      m.getContainer().classList.toggle('map-dim', dark);
      return raster();
    }
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
  },
  thumbMap(el) {
    let pts; try { pts = JSON.parse(el.dataset.route); } catch (e) { return; }
    if (!pts || pts.length < 2) return;
    while (this.thumbs.length >= 6) this.dropThumb(this.thumbs[0].el);
    const box = document.createElement('div'); box.className = 'thumb-map'; el.appendChild(box);
    const m = L.map(box, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false });
    this.baseLayer(m, false);
    const r = this.routeLine(m, pts, el.dataset.color || '#FC5200', 4);
    this.endpoints(m, pts[0], pts[pts.length - 1]);
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
    const right = login ? `<button class="login-chip" data-act="go" data-v="account">${I('user')}Entrar</button>` : `<button class="avatar-btn" data-act="go" data-v="profile" aria-label="Perfil">${this.avatar('xs')}</button>`;
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
  avatar(size = '') { const n = Store.data.profile.name || 'A'; return `<div class="avatar ${size}"><span>${esc(n[0].toUpperCase())}</span></div>`; },
  greeting() { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; },
  today() { return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); },
  avatarOf(name, frame, bg, size = 'sm') { return `<div class="avatar ${size}" style="${frame ? `--frame:${frame};` : '--frame:var(--line-2);'}${bg ? `--avatar-bg:${bg}` : ''}"><span>${esc((name || 'A')[0].toUpperCase())}</span></div>`; },
  iconBox(name, color) { return `<div class="ibox" ${color ? `style="--c:${color}"` : ''}>${I(name)}</div>`; },
  tabsBar(items, active, act) { return `<div class="subtabs">${items.map(([v, n]) => `<button class="${v === active ? 'on' : ''}" data-act="${act}" data-v="${v}">${n}</button>`).join('')}</div>`; },
  actTitle(a) {
    if (a.title) return a.title;
    if (a.workout && a.workout.type === 'interval') return `Intervalado ${a.workout.name}`;
    if (a.workout && a.workout.type === 'swimset') return `Série ${a.workout.name}`;
    const h = new Date(a.start).getHours();
    const per = h >= 5 && h < 12 ? 'matinal' : h >= 12 && h < 18 ? 'à tarde' : 'noturn';
    if (a.sport === 'ride') return `Pedal ${per === 'noturn' ? 'noturno' : per}`;
    return `${a.sport === 'run' ? 'Corrida' : 'Natação'} ${per === 'noturn' ? 'noturna' : per}`;
  },
  thinRoute(pts) { const step = Math.max(1, Math.floor(pts.length / 120)); return pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => [+(+p[0]).toFixed(5), +(+p[1]).toFixed(5)]); },
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
  missionRow(m, pre, kind) {
    const now = Date.now(), p = Game.mProgress(m, Game.scope(kind, now));
    const done = Store.data.missionsDone[Game.mKey(pre, m, now)];
    const ic = m.icon || (m.sport && m.sport !== 'all' ? SPORT_IC[m.sport] : m.type === 'before' ? 'sunrise' : 'target');
    const col = m.sport && m.sport !== 'all' ? CONFIG.sports[m.sport].color : '';
    return `<div class="row ${done ? 'done' : ''}">${done ? `<div class="ibox ok">${I('check')}</div>` : this.iconBox(ic, col)}
      <div class="grow"><div class="row-t"><b>${esc(m.text)}</b><span class="xp">+${m.xp} XP</span></div>${this.bar(done ? 100 : p.pct, done ? 'ok' : '')}<small>${done ? 'Concluída' : p.txt}</small></div></div>`;
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
      { ic: MARK('hero'), t: 'Bem-vindo ao JustGo', p: 'Registre corridas, pedais e natação. Cada treino vira progresso que você enxerga.' },
      { ic: `<div class="ob-ring">${I('lock')}<i class="orb o1"></i><i class="orb o2"></i></div>`, t: 'Desbloqueie o app treinando', p: 'Você começa com cronômetro, GPS e histórico. Gráficos, treinador por voz, Fantasma, território e muito mais abrem conforme você soma quilômetros.' },
      { ic: `<div class="ob-ring">${I('trophy')}<i class="orb o1"></i><i class="orb o2"></i></div>`, t: 'Missões, ligas e amigos', p: 'Missões diárias, temporadas mensais, clubes e desafios. Ganhe XP, suba de liga e domine o mapa da sua cidade.' },
    ];
    if (step < 3) {
      const s = slides[step];
      return this.render(`<main class="onb"><div class="onb-top">${step < 2 ? '<button class="link" data-act="ob" data-v="3">Pular</button>' : ''}</div>
        <div class="onb-art">${s.ic}</div><h1>${s.t}</h1><p>${s.p}</p>
        <div class="dots">${slides.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn primary lg" data-act="ob" data-v="${step + 1}">${step < 2 ? 'Continuar' : 'Começar'}</button></main>`, false);
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

    this.render(`${this.header('', '', { brand: true })}
    <main class="screen home">
      <section class="hello"><span class="eyebrow">${this.today()}</span><h1>${this.greeting()}, ${esc(D.profile.name.split(' ')[0])}</h1></section>
      ${this.loginCard()}

      <section class="card level-card tap" data-act="sub" data-v="progress:tree">
        <div class="lv-top"><div class="lv-num"><span class="eyebrow">Nível</span><b class="display">${lv.l}</b></div>
          <div class="grow"><b>${Game.title(lv.l)}</b><small class="num">${lv.txt} para o nível ${lv.l + 1}</small>${this.bar(lv.pct, 'brand')}</div></div>
        <div class="lv-stats">
          <div>${I('flame')}<b class="num">${streak}</b><small>dias seguidos</small></div>
          <div style="--lc:${L0.color}">${I('crown')}<b>${L0.name}</b><small>liga do mês</small></div>
          <div>${I('coin')}<b class="num">${D.coins}</b><small>moedas</small></div>
        </div>
      </section>

      <section class="card week tap" data-act="go" data-v="stats">
        <div class="week-top">
          <div><span class="eyebrow">Esta semana</span><div class="week-n"><b class="display">${Fmt.num(wkKm)}</b><span>km</span></div><small>${week.length} ${week.length === 1 ? 'treino' : 'treinos'} · ${Fmt.time(wkTime)}</small></div>
          <div class="goal-ring" style="--p:${gp}"><div><b class="num">${Math.round(gp)}%</b><small>de ${goal} km</small></div></div>
        </div>
        <div class="week-bars">${days.map((v, i) => `<div class="wb ${i === todayI ? 'today' : ''}"><i style="height:${Math.max(v ? 10 : 4, (v / maxD) * 100)}%" class="${v ? 'has' : ''}"></i><small>${WEEKDAYS[i]}</small></div>`).join('')}</div>
      </section>

      <button class="cta" data-act="go" data-v="record"><div class="cta-ic">${I('play')}</div><div class="grow"><b>Pronto para treinar?</b><small>${plan && plan.session ? `Hoje: ${esc(plan.session.type)} · ${Fmt.num(plan.session.km)} km` : 'Corrida, pedal ou natação com GPS'}</small></div>${I('chevronRight', 'chev')}</button>

      ${plan ? `${this.sectionHead('Plano de treino', ['Ver plano', 'plans'])}<div class="list"><div class="row tap" data-act="go" data-v="plans">${this.iconBox('clipboard', CONFIG.sports[plan.def.sport].color)}<div class="grow"><b>${plan.session ? `${esc(plan.session.type)} · ${Fmt.num(plan.session.km)} km` : plan.P.finished ? 'Plano concluído!' : 'Semana completa'}</b><small>${esc(plan.def.name)} · semana ${Math.min(plan.w + 1, plan.weeks.length)} de ${plan.weeks.length}</small></div>${I('chevronRight', 'chev')}</div></div>` : ''}

      ${this.sectionHead(`Missões de hoje <em>${dDone}/${daily.length}</em>`, ['Ver todas', 'progress:missions', 'sub'])}
      <div class="list">${daily.map((m) => this.missionRow(m, 'd', 'day')).join('')}</div>

      ${next ? `${this.sectionHead('Próximo desbloqueio', ['Ver árvore', 'progress:tree', 'sub'])}<div class="list">${this.unlockRow(next)}</div>` : ''}

      ${this.sectionHead('Atividades recentes', recent.length ? ['Ver todas', 'history'] : null)}
      ${recent.length ? recent.map((a) => this.postCard(a, esc(D.profile.name))).join('') : `<div class="empty compact">${I('activity')}<p>Seus treinos aparecem aqui.</p></div>`}
    </main>`);
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
        <div class="sport-seg">${Object.entries(CONFIG.sports).map(([k, v]) => `<button class="${k === s ? 'on' : ''}" style="--c:${v.color}" data-act="sport" data-v="${k}">${I(SPORT_IC[k])}<span>${v.name}</span></button>`).join('')}</div>
        ${pool ? '<span class="round-btn ghost"></span>' : `<button class="round-btn" data-act="recenter" aria-label="Centralizar">${I('nav')}</button>`}
      </div>
      ${pool ? '' : '<div class="rec-gps" id="recGps"><i></i><span>Procurando sua localização…</span></div>'}
      <section class="rec-sheet">
        ${s === 'swim' ? `<div class="seg">${[['pool', 'Piscina'], ['open', 'Águas abertas']].map(([m, n]) => `<button class="${App.swimMode === m ? 'on' : ''}" data-act="swimMode" data-v="${m}">${n}</button>`).join('')}</div>` : ''}
        ${this.modeChips()}${this.modeInfo()}
        <div class="rec-start">
          ${pool ? '<span class="side"></span>' : `<button class="side" data-act="simToggle" aria-pressed="${App.sim}"><i class="${App.sim ? 'on' : ''}">${I('flask')}</i><small>${App.sim ? `Teste ${App.simMult}×` : 'Teste'}</small></button>`}
          <button class="start" data-act="start" aria-label="${startLbl}">${pool ? I(App.mode === 'set' ? 'repeat' : 'clipboard') : I('play')}<span>${startLbl}</span></button>
          <button class="side" data-act="go" data-v="safety"><i>${I('shield')}</i><small>Segurança</small></button>
        </div>
        <small class="rec-note">${pool ? 'Registro manual ou série guiada' : App.sim ? 'Modo teste ligado: o GPS será simulado' : `${sp.name} · GPS de alta precisão`}</small>
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
      <div class="t-top"><span class="t-sport">${I(SPORT_IC[tr.sport])}${sp.name}${tr.sim ? `<em>Teste ${tr.mult}×</em>` : ''}</span><span id="tGps" class="gps"></span>
        <button class="t-icon ${Cloud.liveId ? 'on' : ''}" id="tLive" data-act="live" title="Compartilhar localização">${I('signal')}</button><button class="sos" data-act="sos">SOS</button></div>
      <div id="tState" class="t-state"></div>
      <div id="tPhase" class="t-phase" hidden></div>
      <div class="t-hero"><span class="eyebrow">Distância</span><div class="t-dist"><b id="tDist" class="num">0,00</b><span>km</span></div></div>
      <div class="t-grid">
        <div><span class="eyebrow">Tempo</span><b id="tTime" class="num">0:00</b></div>
        <div><span class="eyebrow">${tr.sport === 'ride' ? 'Velocidade' : 'Ritmo'}</span><b id="tPace" class="num">--</b><small>${unit}</small></div>
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
      this.liveLine = this.routeLine(map, [], Shop.lineColor(tr.sport), 5);
      this.ghostDot = null; this.liveMap = map;
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
      if (tr.points.length) this.liveLine.setLatLngs(Geo.segments(tr.points));
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
    const stats = [['Distância', Fmt.km(act.distance), 'km'], [act.sport === 'ride' ? 'Vel. média' : 'Ritmo médio', Fmt.pace(act.sport, avg), Fmt.paceUnit(act.sport)], ['Tempo', Fmt.time(act.duration), '']];
    const more = [['Calorias', `${Game.calories(act)} kcal`]];
    if (hasMap) more.push(['Ganho de elevação', `${Geo.elevationGain(act.points)} m`]);
    if (act.elapsed && act.elapsed !== act.duration) more.push(['Tempo total', Fmt.time(act.elapsed)]);
    if (act.estimated) more.push(['Distância estimada (app minimizado)', Fmt.km(act.estimated) + ' km']);
    if (act.pool) more.push(['Piscina', `${act.pool.laps} × ${String(act.pool.length).replace('.', ',')} m`]);
    if (act.hexes) more.push(['Hexágonos percorridos', act.hexes]);
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
        ...(res.newHexes ? [['hexagon', 'Território', `${res.newHexes} hexágono${res.newHexes > 1 ? 's' : ''} novo${res.newHexes > 1 ? 's' : ''}`, '']] : []),
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
        ? `<section class="card splits"><div class="sp-h"><span>Km</span><span>${act.sport === 'ride' ? 'Vel.' : 'Ritmo'}</span><span></span></div>${act.splits.map((t, i) => `<div class="sp-row"><span class="num">${i + 1}</span><b class="num ${t === best ? 'best' : ''}">${act.sport === 'ride' ? Fmt.num(3600 / t) : Fmt.time(t)}</b><div class="sp-bar"><i style="width:${40 + (60 * (worst - t)) / (worst - best || 1)}%"></i></div></div>`).join('')}</section>`
        : this.lockedBox('splits', '<div class="fake-splits"></div>'));
    }
    let charts = '';
    if (hasMap && act.sport === 'run') charts = this.sectionHead('Ritmo') + (Game.has('paceChart') ? `<section class="card"><canvas class="chart" id="cPace"></canvas></section>` : this.lockedBox('paceChart'));
    if (hasMap && act.sport === 'ride') charts = this.sectionHead('Velocidade e elevação') + (Game.has('rideChart') ? `<section class="card"><canvas class="chart" id="cSpeed"></canvas><canvas class="chart" id="cAlt"></canvas></section>` : this.lockedBox('rideChart'));
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
    if (hasMap) {
      acts.push(Game.has('routes') ? `<button class="chip-btn" data-act="saveRoute" data-v="${act.id}">${I('bookmark')}Salvar rota</button>` : this.lockChip('routes', 'Salvar rota'));
      acts.push(Game.has('segments') ? `<button class="chip-btn" data-act="mkSegment" data-v="${act.id}">${I('scissors')}Criar segmento</button>` : this.lockChip('segments', 'Criar segmento'));
      acts.push(`<button class="chip-btn" data-act="gpxOut" data-v="${act.id}">${I('download')}GPX</button>`);
    }
    const feelLbl = ['Muito difícil', 'Difícil', 'Moderado', 'Bom', 'Excelente'];
    const W = act.weather;
    this.render(`<header class="top"><div class="top-l"><button class="back" data-act="go" data-v="${isNew ? 'home' : 'history'}">${I('chevronLeft')}</button></div>
      <div class="top-r">${!isNew ? `<button class="icon-btn" data-act="del" data-v="${act.id}" title="Excluir">${I('trash')}</button>` : ''}</div></header>
    <main class="screen summary">
      <div class="post-h">${this.avatar()}<div class="grow"><b>${esc(Store.data.profile.name)}</b><small>${Fmt.date(act.start)}${act.mode === 'sim' ? ' · modo teste' : act.mode === 'gpx' ? ' · importado' : ''}</small></div><span class="weather" id="sWeather">${W ? `${I(W.rain >= 0.2 ? 'cloudRain' : 'cloud', 'xs')} ${W.temp}°C` : ''}</span></div>
      <h1 class="act-title">${this.actTitle(act)}</h1>
      ${act.flagged ? `<div class="notice bad">${I('alert')}<div><b>Não conta para missões e rankings</b><small>${esc(act.flagReason)}</small></div></div>` : ''}
      <div class="big-stats">${stats.map(([l, v, u]) => `<div><span class="eyebrow">${l}</span><b class="num">${v}</b>${u ? `<small>${u}</small>` : ''}</div>`).join('')}</div>
      ${hasMap ? '<div id="sMap" class="s-map"></div>' : act.pool ? `<div class="pool-art">${I('swim')}<b class="num">${Fmt.km(act.distance)} km</b><small>${act.pool.laps} voltas</small></div>` : ''}
      <div class="actions wrap">${acts.join('')}</div>
      ${rewards}
      <section class="card kvl">${more.map(([l, v]) => `<div><span>${l}</span><b class="num">${v}</b></div>`).join('')}</section>
      ${gearHtml ? `<div class="list">${gearHtml}</div>` : ''}
      ${workout}${effortsHtml}${splits}${charts}
      ${this.sectionHead('Esforço percebido')}
      <div class="feel">${feelLbl.map((l, i) => `<button class="${act.feeling === i + 1 ? 'on' : ''}" data-act="feel" data-v="${i + 1}" data-id="${act.id}"><b>${i + 1}</b><small>${l}</small></button>`).join('')}</div>
      <textarea id="note" data-id="${act.id}" placeholder="Adicione uma anotação privada…">${esc(act.note || '')}</textarea>
      ${isNew ? '<button class="btn primary lg" data-act="go" data-v="home">Concluir</button>' : ''}
    </main>`, !isNew);

    const map = hasMap && this.map('sMap');
    if (map) {
      const line = this.routeLine(map, Geo.segments(act.points), color, 5);
      this.endpoints(map, act.points[0], act.points[act.points.length - 1]);
      map.fitBounds(line.getBounds(), { padding: [28, 28] });
    }
    const s = hasMap ? FX.series(act.points) : null;
    if ($('#cPace')) FX.chart($('#cPace'), s.x, s.v.map((v) => (v > 0.5 ? 1000 / v : NaN)), { color: sp.color, invert: true, fmtY: (v) => Fmt.time(v), label: 'min/km', minRange: 60 });
    if ($('#cSpeed')) FX.chart($('#cSpeed'), s.x, s.v.map((v) => v * 3.6), { color: sp.color, fmtY: (v) => v.toFixed(0), label: 'km/h', minRange: 6 });
    if ($('#cAlt')) FX.chart($('#cAlt'), s.x, s.alt, { color: '#8E8E93', fmtY: (v) => v.toFixed(0), label: 'elevação (m)', minRange: 20 });
  },

  /* =========================================================
     ATIVIDADES: minhas, rotas e território
     ========================================================= */
  history() {
    const sub = App.sub.history;
    const tabs = this.tabsBar([['mine', 'Minhas'], ['routes', 'Rotas e segmentos'], ['territory', 'Território']], sub, 'subTab');
    let body = '';
    if (sub === 'routes') body = this.routesView();
    else if (sub === 'territory') body = this.territoryView();
    else {
      const list = [...Store.data.activities].sort((a, b) => b.start - a.start), name = esc(Store.data.profile.name);
      body = `<div class="actions">
        ${Game.has('heatmap') ? `<button class="chip-btn" data-act="heatmap">${I('flame')}Mapa de calor</button>` : this.lockChip('heatmap', 'Mapa de calor')}
        <label class="chip-btn">${I('upload')}Importar GPX<input type="file" id="gpxIn" accept=".gpx,application/gpx+xml" hidden></label>
        <button class="chip-btn" data-act="go" data-v="stats">${I('barChart')}Estatísticas</button></div>
      ${list.length ? list.map((a) => this.postCard(a, name)).join('')
        : `<div class="empty">${I('activity')}<h3>Nenhuma atividade ainda</h3><p>Seu primeiro treino aparece aqui. No computador, use o modo teste.</p><button class="btn primary" data-act="go" data-v="home">Começar um treino</button></div>`}`;
    }
    this.render(`${this.back('home', 'Atividades')}<main class="screen">${tabs}${body}</main>`);
    if (sub === 'territory') this.drawTerritory();
  },
  postCard(a, name, opts = {}) {
    const color = opts.color || Shop.lineColor(a.sport);
    const pts = opts.route || a.points;
    return `<article class="post" ${opts.noTap ? '' : `data-act="detail" data-v="${a.id}"`}>
      <div class="post-h">${opts.avatar || this.avatar('sm')}<div class="grow"><b>${name}</b><small>${I(SPORT_IC[a.sport], 'xs')} ${Fmt.date(typeof a.start === 'string' ? Date.parse(a.start) : a.start)}${a.mode === 'sim' ? ' · teste' : ''}</small></div>${a.flagged ? '<span class="badge bad">Não conta</span>' : a.xp ? `<span class="badge">+${a.xp} XP</span>` : ''}</div>
      <h3>${esc(this.actTitle(a))}</h3>
      <div class="post-stats"><div><span>Distância</span><b class="num">${Fmt.km(a.distance)} km</b></div><div><span>${a.sport === 'ride' ? 'Vel. média' : 'Ritmo'}</span><b class="num">${Fmt.pace(a.sport, a.duration ? a.distance / a.duration : 0)}${a.sport === 'ride' ? ' km/h' : a.sport === 'swim' ? ' /100m' : ' /km'}</b></div><div><span>Tempo</span><b class="num">${Fmt.time(a.duration)}</b></div></div>
      ${pts && pts.length > 1 ? `<div class="post-map" data-color="${color}" data-route='${JSON.stringify(this.thinRoute(pts))}'>${this.routeSVG(pts, color)}</div>` : a.pool || (a.stats && a.stats.pool) ? `<div class="post-map pool">${I('swim')}<span>Natação na piscina</span></div>` : ''}
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
  territoryView() {
    if (!Game.has('territory')) {
      const n = Object.keys(Store.data.territory).length;
      return this.lockedBox('territory', `<div class="fake-field"><span>Hexágonos já percorridos</span><b>${n}</b><span>Área</span><b>${Fmt.num(Hex.areaKm2(n), 2)} km²</b></div>`) + `<p class="muted small center">Seu território já está sendo registrado desde o primeiro treino. Ele aparece aqui quando você desbloquear.</p>`;
    }
    const T = Store.data.territory, ids = Object.keys(T), n = ids.length;
    const lost = this._terrOwners ? ids.filter((h) => this._terrOwners[h] && Cloud.user && this._terrOwners[h].owner !== Cloud.user.id).length : 0;
    return `<section class="card terr-sum"><div><span class="eyebrow">Hexágonos</span><b class="num">${n - lost}</b></div><div><span class="eyebrow">Área</span><b class="num">${Fmt.num(Hex.areaKm2(n - lost), 2)}<small> km²</small></b></div><div><span class="eyebrow">Roubados</span><b class="num ${lost ? 'bad' : ''}">${lost}</b></div></section>
      <div id="terrMap" class="terr-map"></div>
      <p class="muted small">Cada hexágono tem cerca de ${CONFIG.territory.hexSize} m. Passe por ele para dominar; quem passar mais vezes vira o dono${Cloud.loggedIn() ? '. Amigos podem roubar seus territórios!' : '. Entre na sua conta para disputar com amigos.'}</p>
      ${Cloud.loggedIn() ? `<button class="btn ghost" data-act="terrRefresh">${I('refresh')}Atualizar disputas</button>` : ''}`;
  },
  drawTerritory() {
    const T = Store.data.territory, ids = Object.keys(T);
    const map = Game.has('territory') && this.map('terrMap');
    if (!map) return;
    if (!ids.length) { map.setView(Geo.home(), 14); return; }
    const maxN = Math.max(...ids.map((h) => T[h].n));
    const group = L.featureGroup().addTo(map), O = this._terrOwners || {};
    ids.slice(0, 3000).forEach((h) => {
      const o = O[h], mine = !o || !Cloud.user || o.owner === Cloud.user.id;
      L.polygon(Hex.polygon(h), { color: mine ? '#FC5200' : '#A78BFA', weight: 1, fillColor: mine ? '#FC5200' : '#A78BFA', fillOpacity: 0.18 + 0.5 * (T[h].n / maxN) })
        .bindPopup(mine ? `Seu · ${T[h].n} passagem${T[h].n > 1 ? 's' : ''}` : `Dono: ${esc(o.owner_name)} (${o.count}×) · você: ${T[h].n}×`).addTo(group);
    });
    Object.values(O).forEach((o) => { if (!T[o.hex]) L.polygon(Hex.polygon(o.hex), { color: '#A78BFA', weight: 1, fillOpacity: 0.25 }).bindPopup(esc(o.owner_name)).addTo(group); });
    map.fitBounds(group.getBounds(), { padding: [16, 16] });
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
    this.render(`${this.header('Progresso')}<main class="screen">${tabs}${body}</main>`);
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
    return `<section class="event"><div class="ev-ic">${I(season.icon || 'calendar')}</div><div class="grow"><span class="eyebrow">Evento do mês</span><b>${esc(season.text)}</b>${this.bar(sp.pct)}<small class="num">${sp.txt} · +${season.xp} XP</small></div></section>
      ${this.sectionHead(`Diárias <em>renovam em ${h}h ${m}min</em>`)}<div class="list">${Game.dailyMissions(now).map((x) => this.missionRow(x, 'd', 'day')).join('')}</div>
      ${this.sectionHead(`Semanais <em>${wd} ${wd === 1 ? 'dia' : 'dias'} restantes</em>`)}<div class="list">${CONFIG.weekly.map((x) => this.missionRow(x, 'w', 'week')).join('')}</div>
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
    return `<div class="list">${rows.map((r, i) => `<div class="row board ${r.user_id === me ? 'is-me' : ''}" data-act="userOpen" data-v="${r.user_id}"><span class="pos num ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span>${this.avatarOf(r.name, r.frame, r.avatar)}<div class="grow"><b>${esc(r.name)}</b><small>${r.username ? '@' + esc(r.username) : ''}${r.city ? ' · ' + esc(r.city) : ''}</small></div><b class="num">${fmt(Number(r.value))}</b></div>`).join('')}</div>`;
  },
  shopView() {
    const D = Store.data, cats = [['line', 'Cor do traçado'], ['frame', 'Moldura do perfil'], ['avatar', 'Avatar'], ['theme', 'Tema do app'], ['finish', 'Efeito de chegada']];
    const def = { line: 'Cor do esporte', frame: 'Laranja JustGo', avatar: 'Grafite', theme: 'Padrão', finish: 'Confete' };
    const swatch = (it) => it.cat === 'line' ? `<i class="sw" style="background:${it.value}"></i>` : it.cat === 'frame' ? `<i class="sw ring-sw" style="background:${it.value}"></i>` : it.cat === 'avatar' ? `<i class="sw" style="background:${it.value}"></i>` : it.cat === 'theme' ? `<i class="sw theme-${it.value}"></i>` : `<i class="sw fx">${I(it.value === 'fireworks' ? 'sparkles' : 'activity')}</i>`;
    return `<section class="card wallet"><div>${I('coin')}<b class="num">${D.coins}</b><small>moedas</small></div><small>Ganhe moedas treinando, cumprindo missões e subindo de liga. Tudo na loja é visual: nada dá vantagem.</small></section>
      ${cats.map(([c, n]) => `${this.sectionHead(n)}<div class="shop">
        <button class="item ${!D.equipped[c] ? 'eq' : ''}" data-act="equip" data-v="${c}:">${c === 'line' ? '<i class="sw" style="background:conic-gradient(#FC5200 0 33%,#12B886 0 66%,#1C9BEF 0)"></i>' : c === 'frame' ? '<i class="sw ring-sw" style="background:#FC5200"></i>' : c === 'avatar' ? '<i class="sw" style="background:linear-gradient(145deg,#3A3A3C,#1C1C1E)"></i>' : c === 'theme' ? '<i class="sw theme-dark"></i>' : `<i class="sw fx">${I('sparkles')}</i>`}<b>${def[c]}</b><small>${!D.equipped[c] ? 'Em uso' : 'Grátis'}</small></button>
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
    const L0 = Game.league(Game.monthXp()), tab = App.sub.profile || 'overview';
    const login = Cloud.configured() && !Cloud.loggedIn();
    const city = (Cloud.me && Cloud.me.city) || Pref('city');
    const handle = Cloud.me && Cloud.me.username ? '@' + esc(Cloud.me.username) : '';
    const sportsTxt = (P.sports || []).map((k) => CONFIG.sports[k] && CONFIG.sports[k].name).filter(Boolean).join(' · ');
    const medals = Object.keys(D.medals).length;
    let body = '';
    if (tab === 'medals') {
      body = `<section class="card ach-sum"><div><span class="eyebrow">Medalhas</span><b class="display">${medals}<span>/${CONFIG.medals.length}</span></b></div>${this.bar((medals / CONFIG.medals.length) * 100, 'brand')}<small>Treine em horários diferentes, bata recordes e complete planos para ganhar mais.</small></section>
        <div class="medal-list">${CONFIG.medals.map((m) => { const on = D.medals[m.id]; return `<div class="medal-row ${on ? 'on' : ''}"><div class="hex">${I(m.icon)}</div><div class="grow"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>${on ? `<span class="badge ok-badge">${I('check', 'xs')} ${new Date(on).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>` : `<span class="badge">${I('lock', 'xs')}</span>`}</div>`; }).join('')}</div>`;
    } else if (tab === 'records') {
      const pred = Game.predictions();
      body = `${this.sectionHead('Recordes pessoais')}${this.recordsHtml()}
        ${this.sectionHead('Previsão de prova')}
        ${Game.has('racePredict') ? `<section class="card">${pred ? `<div class="kv four">${pred.map((x) => `<div><span class="eyebrow">${x.n}</span><b class="num">${Fmt.time(x.t)}</b></div>`).join('')}</div><small class="muted">Estimativa pela fórmula de Riegel, com base no seu melhor tempo de corrida.</small>` : '<p class="muted">Corra pelo menos 1 km para gerar a previsão.</p>'}</section>`
          : this.lockedBox('racePredict', '<div class="fake-field"><span>5K</span><b>25:10</b><span>10K</span><b>52:30</b></div>')}`;
    } else {
      // visão geral: últimas 8 semanas + esportes + atalhos
      const ws = Game.weekStart(Date.now()), wk = Array(8).fill(0);
      acts.forEach((a) => { const i = 7 - Math.round((ws - Game.weekStart(a.start)) / (7 * 864e5)); if (i >= 0 && i < 8) wk[i] += a.distance / 1000; });
      const avg = wk.reduce((x, y) => x + y, 0) / 8;
      body = `<section class="card"><div class="row-t"><div><span class="eyebrow">Últimas 8 semanas</span><div class="week-n"><b class="display">${Fmt.num(wk.reduce((x, y) => x + y, 0))}</b><span>km</span></div></div><small class="num">média ${Fmt.num(avg)} km/sem</small></div>
          ${this.bars(wk, wk.map((_, i) => (i === 7 ? 'atual' : '')), { hi: 7 })}</section>
        <div class="sport-cards">${Object.entries(CONFIG.sports).map(([k, sp]) => { const l = acts.filter((a) => a.sport === k), km = Game.km(l), t = l.reduce((x, a) => x + a.duration, 0); return `<div class="sport-card" style="--c:${sp.color}"><div class="sc-ic">${I(SPORT_IC[k])}</div><b class="display">${Fmt.num(km, km >= 100 ? 0 : 1)}<span> km</span></b><small>${sp.name} · ${l.length} treino${l.length === 1 ? '' : 's'}</small><small class="num">${Fmt.time(t)}</small></div>`; }).join('')}</div>
        <div class="shortcuts">${[['history', 'activity', 'Atividades'], ['stats', 'barChart', 'Estatísticas'], ['plans', 'clipboard', 'Planos'], ['gear', 'shoe', 'Equipamentos']].map(([v, ic, n]) => `<button class="shortcut" data-act="go" data-v="${v}">${I(ic)}<span>${n}</span></button>`).join('')}</div>`;
    }
    this.render(`${this.header('Perfil', `<button class="icon-btn" data-act="go" data-v="settings" aria-label="Configurações">${I('settings')}</button>`)}<main class="screen profile">
      <section class="prof-card">
        <div class="prof-cover" style="--lc:${L0.color}"><button class="cover-edit" data-act="editProfile">${I('settings', 'xs')} Editar perfil</button></div>
        <div class="prof-body">${this.avatar('lg')}
          <h2>${esc(P.name)}</h2>
          <small class="prof-meta">${[handle, city ? `${I('mapPin', 'xs')} ${esc(city)}` : ''].filter(Boolean).join(' · ') || 'Toque em Editar perfil para completar'}</small>
          ${Pref('bio') ? `<p class="prof-bio">${esc(Pref('bio'))}</p>` : ''}
          <div class="prof-tags"><span class="league-pill" style="--lc:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span><span class="lvl-pill">${I('zap', 'xs')} Nível ${lv.l} · ${Game.title(lv.l)}</span>${sportsTxt ? `<span class="lvl-pill">${esc(sportsTxt)}</span>` : ''}</div>
          <div class="lv">${this.bar(lv.pct, 'brand')}<small class="num">${lv.txt} para o nível ${lv.l + 1}</small></div>
        </div>
        <div class="prof-stats"><div><b class="num">${acts.length}</b><small>Atividades</small></div><div><b class="num">${Fmt.num(Game.km(acts), 0)}</b><small>Km totais</small></div><div><b class="num">${medals}</b><small>Medalhas</small></div><div><b class="num">${Math.max(D.bestStreak || 0, Game.streakDays())}</b><small>Melhor ofensiva</small></div></div>
      </section>
      ${login ? `<button class="cta login" data-act="go" data-v="account"><div class="cta-ic">${I('user')}</div><div class="grow"><b>Entrar ou criar conta</b><small>Salve na nuvem e treine com amigos</small></div>${I('chevronRight', 'chev')}</button>` : ''}
      ${this.tabsBar([['overview', 'Visão geral'], ['medals', 'Conquistas'], ['records', 'Recordes']], tab, 'profTab')}
      ${body}
    </main>`);
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
        ${link('', 'flask', 'Dados de demonstração', 'Cria treinos simulados para testar', 'demo')}
        <button class="cfg-row tap danger" data-act="reset">${this.iconBox('trash', 'var(--bad)')}<div class="grow"><b>Apagar todos os dados</b><small>Remove treinos, XP e desbloqueios deste aparelho</small></div></button>
      </div>

      <div class="about">${MARK('lg')}<b>Just<span>Go</span></b><small>Versão ${CONFIG.version}${Native.on ? ' · app Android' : ''}</small><small>Mapas © OpenFreeMap · OpenMapTiles · OpenStreetMap</small></div>
    </main>`);
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
