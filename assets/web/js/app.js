/* =========================================================
   JustGo — APLICAÇÃO
   Navegação, fluxo do treino e ações dos botões (data-act)
   ========================================================= */
const App = {
  tab: 'home', nav: 'home',
  sub: { progress: 'missions', history: 'mine', social: 'discover', profile: 'activities' },
  sport: 'run', swimMode: 'pool', mode: 'free', preset: null, route: null,
  sim: false, simMult: 5,
  tracker: null, coach: null, routeLive: null, wl: null,

  // tela -> aba da barra inferior que fica acesa
  parents: { notifs: 'home', pro: 'profile', progress: 'profile', settings: 'profile', stats: 'profile', gear: 'profile', safety: 'profile', account: 'profile', plans: 'home', pool: 'record', swimSetup: 'record', search: 'social', user: 'social', ract: 'social', chalPick: 'social', torch: 'social', retro: 'home', atleta: 'profile', avatarEdit: 'profile', club: 'social', history: 'home', heatmap: 'home' },

  init() {
    Store.load();
    // 2.8.2: todos os treinos já feitos passam a ser públicos (uma vez)
    setTimeout(() => this.statsFix().catch((e) => console.warn(e)), 9000);
    if (!Store.data.fixGps1) { try { this.repairActs(); } catch (e) { console.warn(e); } }
    if (!Store.data.pubAll1) { Store.data.activities.forEach((a) => { delete a.private; }); Store.data.pubAll1 = 1; try { Store.save(); } catch (e) {} }
    Shop.apply();
    this.sport = Store.data.profile.sports[0] || 'run';
    this.sim = false;
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !Native.on) {
      // quando sair versão nova, recarrega sozinho (exceto no meio de um treino)
      const had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !this.tracker && !this._reloaded) { this._reloaded = true; location.reload(); } });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
    }

    // barra inferior com o botão Gravar no centro
    $('#nav').innerHTML = [['home', 'home', 'Início'], ['mapa', 'map', 'Mapa'], ['record', 'play', 'Gravar'], ['social', 'users', 'Social'], ['profile', 'user', 'Perfil']]
      .map(([v, ic, n]) => v === 'record' ? `<button class="nav-rec" data-act="go" data-v="${v}" aria-label="${n}"><span class="rec-btn">${I(ic)}</span><span>${n}</span></button>` : `<button data-act="${v === 'profile' ? 'navProfile' : 'go'}" data-v="${v}">${I(ic)}<span>${n}</span></button>`).join('');
    // título pequeno no topo aparece ao rolar
    let scT = false; window.addEventListener('scroll', () => { if (scT) return; scT = true; requestAnimationFrame(() => { scT = false; const s = window.scrollY > 36; const t = document.querySelector('.top'); if (t && t.classList.contains('scrolled') !== s) t.classList.toggle('scrolled', s); }); }, { passive: true });

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (el && this.actions[el.dataset.act]) { e.preventDefault(); this.actions[el.dataset.act](el, e); }
    });
    document.addEventListener('change', (e) => this.onChange(e));
    document.addEventListener('submit', (e) => { if (e.target.id === 'authForm') { e.preventDefault(); this.auth(); } });
    document.addEventListener('input', (e) => {
      if (e.target.id === 'rtProg' && typeof Retro !== 'undefined' && Retro.base) { if (Retro.playing) Retro.pause(); Retro.seek(+e.target.value / 1000); return; }
      if (e.target.classList && e.target.classList.contains('cp-in')) { const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 132) + 'px'; t.closest('.cp-box').classList.toggle('has', !!t.value.trim()); }
      if (e.target.id === 'searchQ') { clearTimeout(this._sq); const q = e.target.value.trim(); this._sq = setTimeout(() => UI.searchResults(q).catch(() => {}), 300); }
    });
    document.addEventListener('visibilitychange', () => {
      const tr = this.tracker; if (!tr || tr.state === 'done') return;
      if (document.visibilityState === 'visible') { this.wake(); tr.wakeUp(); Background.update(); }
      else Store.saveLive(tr.snapshot()); // salva antes do navegador congelar
    });
    window.addEventListener('pagehide', () => { if (this.tracker && this.tracker.state !== 'done') Store.saveLive(this.tracker.snapshot()); });
    window.addEventListener('beforeunload', (e) => { if (this.tracker && this.tracker.state !== 'done') { e.preventDefault(); e.returnValue = ''; } });

    this._cloudP = Cloud.init().then(() => this.onCloudReady());
    try { const lv = localStorage.getItem('justgo_ver'); if (lv && lv !== CONFIG.version) setTimeout(() => FX.toast(`JustGo atualizado para a versão ${CONFIG.version}`), 1500); localStorage.setItem('justgo_ver', CONFIG.version); } catch (e) {}
    Geo.locate(false); // se a localização já foi permitida, atualiza a cidade
    this.boot();
  },
  // abre o app: espera a nuvem dizer se tem alguém logado; sem conta, vai para a entrada
  async boot() {
    const t0 = Date.now();
    if (Cloud.configured()) await Promise.race([this._cloudP, new Promise((r) => setTimeout(r, 8000))]);
    setTimeout(() => { const sp = $('#splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); } }, Math.max(0, 650 - (Date.now() - t0)));
    if (this.gate()) return;
    this.enterApp(true);
  },
  gateNeed() {
    if (!Cloud.configured()) return Store.data.profile.onboarded ? null : 'local';
    if (!Cloud.sb) { let f = null; try { f = localStorage.getItem('jg_authed'); } catch (e) {} return f && Store.data.profile.onboarded ? null : 'welcome'; }
    if (!Cloud.user) return 'welcome';
    if (!Cloud.me || !Cloud.me.username) return 'setup';
    return null;
  },
  gate() {
    const n = this.gateNeed(); if (!n) return false;
    if (n === 'local') UI.onboarding(0); else if (n === 'setup') UI.setup(App.setupStep || 0); else UI.welcome();
    return true;
  },
  // logou (e-mail ou Google): completa o perfil ou entra direto
  afterAuth() {
    const n = this.gateNeed();
    if (n === 'setup') return UI.setup(0);
    if (!n) { FX.toast(`Bem-vindo, ${(Cloud.me && Cloud.me.name ? Cloud.me.name : 'atleta').split(' ')[0]}!`); this.enterApp(); }
  },
  enterApp(first) {
    if (Cloud.user) { const P = Store.data.profile; if (!P.onboarded || P.name === 'Atleta') { P.onboarded = true; if (Cloud.me && Cloud.me.name && P.name === 'Atleta') P.name = Cloud.me.name; Store.save(); } }
    this.go('home');
    if (!first) return;
    this.checkLive();
    const season = Game.checkSeason();
    if (season) FX.modal(`<div class="unlock"><div class="lock-anim open" style="background:${season.league.color}">${I('crown')}</div><span class="eyebrow">Temporada encerrada</span><h3>Liga ${season.league.name}</h3><p class="muted">Você fez ${season.xp} XP no mês passado.</p><div class="reward"><span>+${season.league.reward} moedas</span></div><button class="btn primary" data-m="ok">Começar nova temporada</button></div>`);
  },
  go(tab) {
    if (tab !== 'record') this.stopRecWatch();
    if (this.tab === 'view3d' && tab !== 'view3d') View3D.close();
    if (tab === 'safety') this.from = this.tab;
    if (tab === 'record' && this.tab !== 'record' && !this.tracker && Pref('defaultSport') && !this.route) { this.sport = Pref('defaultSport'); if (this.sport !== 'swim') this.mode = this.mode === 'manual' || this.mode === 'set' ? 'free' : this.mode; }
    if (tab === 'notifs' && this.tab !== 'notifs') this.backTo2 = ['home', 'profile', 'mapa', 'social'].includes(this.tab) ? this.tab : 'home';
    if (tab === 'progress' && this.tab !== 'progress') this.backTo = ['home', 'profile', 'mapa', 'social'].includes(this.tab) ? this.tab : 'profile';
    this.tab = tab; this.nav = this.parents[tab] || tab;
    const fn = UI[tab]; (typeof fn === 'function' ? fn : UI.home).call(UI);
    if (tab === 'settings') UI.verInfo();
  },
  applyTheme() { Shop.apply(); },
  // entrar ou criar conta com e-mail e senha
  async auth() {
    const email = ($('#authEmail').value || '').trim(), pass = $('#authPass').value || '', mode = this.authMode || 'signin';
    const err = $('#authErr'), btn = $('#authBtn');
    const show = (m) => { err.textContent = m; err.hidden = false; };
    err.hidden = true;
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Digite um e-mail válido.');
    if (pass.length < 6) return show('A senha precisa ter pelo menos 6 caracteres.');
    if (mode === 'signup' && $('#authTerms') && !$('#authTerms').checked) return show('Para criar a conta, marque que leu e concorda com os Termos e a Política de Privacidade.');
    btn.disabled = true; btn.textContent = mode === 'signup' ? 'Criando conta…' : 'Entrando…';
    try {
      if (mode === 'signup') {
        const r = await Cloud.signUp(email, pass);
        if (!r.session) {
          btn.disabled = false; btn.textContent = 'Criar conta';
          return FX.modal(`<div class="unlock"><div class="lock-anim open">${I('mail')}</div><h3>Confirme seu e-mail</h3><p class="muted">Enviamos um link para <b>${esc(email)}</b>. Depois de confirmar, é só entrar com sua senha.</p><button class="btn primary" data-m="ok">Ok</button></div>`).then(() => { this.authMode = 'signin'; if (this.tab === 'gate') UI.authx('signin'); else UI.account(); });
        }
        FX.toast('Conta criada!');
      } else { await Cloud.signIn(email, pass); FX.toast('Bem-vindo de volta!'); }
    } catch (e) { btn.disabled = false; btn.textContent = mode === 'signup' ? 'Criar conta' : 'Entrar'; show(Cloud.msg(e)); }
  },
  async askNewPassword() {
    const f = await FX.prompt('Crie uma senha nova', [['np', 'Nova senha', 'password', '', 'Mínimo de 6 caracteres']], 'Salvar senha');
    if (!f || !f.np) return;
    if (f.np.length < 6) { FX.toast('A senha precisa ter pelo menos 6 caracteres.'); return this.askNewPassword(); }
    try { await Cloud.newPassword(f.np); FX.toast('Senha alterada!'); } catch (e) { FX.toast(Cloud.msg(e)); }
  },
  countdown() {
    return new Promise((res) => {
      const el = document.createElement('div'); el.className = 'countdown'; document.body.appendChild(el);
      let n = 3;
      const step = () => {
        if (n === 0) { el.innerHTML = '<b>Vai!</b>'; FX.beep([880, 1320]); FX.vibrate([200]); setTimeout(() => { el.remove(); res(); }, 450); return; }
        el.innerHTML = `<b>${n}</b><small>Prepare-se</small>`; FX.beep([660]); FX.vibrate([60]); n--; setTimeout(step, 850);
      };
      el.onclick = () => { n = 0; };
      step();
    });
  },
  stopRecWatch() { if (this.recWatch != null) { try { navigator.geolocation.clearWatch(this.recWatch); } catch (e) {} this.recWatch = null; } },
  // nuvem conectada: atualiza a tela atual (mostra/esconde o "Entrar")
  onCloudReady() { if (Cloud.configured() && Cloud.ready && !Cloud.user && !this.tracker) { if (this.tab !== 'gate' && this.tab) UI.welcome(); return; } setTimeout(() => Cloud.backfill().catch(() => {}), 3000); setTimeout(() => Zones.cleanup().catch(() => {}).then(() => Zones.recheck()).catch(() => {}), 6000); if (!Store.data.profile.onboarded) return; if (['home', 'progress', 'social', 'profile', 'history', 'account', 'mapa'].includes(this.tab) && !this.tracker) this.go(this.tab); },
  async firstLocate() { const p = await Geo.locate(false); if (p && this.tab === 'home') {} },

  /* ---------- tela ativa durante o treino ---------- */
  async wake() { if (!Pref('keepAwake')) return; try { if ('wakeLock' in navigator) this.wl = await navigator.wakeLock.request('screen'); } catch (e) {} },
  release() { try { this.wl && this.wl.release(); } catch (e) {} this.wl = null; },

  /* ---------- escolha do modo de treino ---------- */
  async pickInterval() {
    const v = await FX.modal(`<h3>Treino intervalado</h3><p class="muted">Avisos sonoros e por voz em cada tiro e recuperação.</p><div class="col">${CONFIG.intervals.map((p) => `<button class="btn ghost" data-m="${p.id}">${I('zap')} ${p.name}<small class="inline">${p.rest}s rec.</small></button>`).join('')}<button class="btn ghost" data-m="custom">${I('settings')} Personalizado</button><button class="btn link" data-m="no">Cancelar</button></div>`);
    if (v === 'no') return false;
    if (v === 'custom') {
      const f = await FX.prompt('Intervalado personalizado', [['iReps', 'Repetições', 'number', '6'], ['iDist', 'Distância de cada tiro (m) — deixe 0 para usar tempo', 'number', '400'], ['iDur', 'Ou duração de cada tiro (segundos)', 'number', '0'], ['iRest', 'Recuperação (segundos)', 'number', '90'], ['iWarm', 'Aquecimento (minutos)', 'number', '10']], 'Usar');
      if (!f) return false;
      const reps = Math.max(1, +f.iReps || 6), dist = +f.iDist || 0, dur = +f.iDur || 0;
      this.preset = { id: 'custom', name: `${reps} × ${dist ? dist + ' m' : dur + ' s'}`, warm: (+f.iWarm || 0) * 60, reps, work: dist ? { dist } : { dur: dur || 60 }, rest: +f.iRest || 0, cool: 300 };
    } else this.preset = CONFIG.intervals.find((p) => p.id === v);
    return true;
  },
  async pickRoute() {
    const list = Store.data.routes.filter((r) => r.sport === this.sport);
    if (!list.length) { FX.toast('Nenhuma rota salva para este esporte. Salve uma a partir de uma atividade.'); return false; }
    const v = await FX.modal(`<h3>Treinar em uma rota</h3><div class="col">${list.map((r) => { const b = Routes.best(r); return `<button class="btn ghost" data-m="${r.id}">${I(r.segment ? 'flag' : 'route')} ${esc(r.name)}<small class="inline">${Fmt.km(r.distance)} km${b ? ' · ' + Fmt.time(b.time) : ''}</small></button>`; }).join('')}<button class="btn link" data-m="no">Cancelar</button></div>`);
    if (v === 'no') return false;
    this.route = Store.data.routes.find((r) => r.id === v); return !!this.route;
  },

  /* ---------- fluxo do treino ---------- */
  async startTraining() {
    this.stopRecWatch();
    if (this.sport === 'swim' && this.swimMode === 'pool') { if (this.mode === 'set') return this.go('swimSetup'); return this.go('pool'); }
    if (this.mode === 'interval' && !this.preset && !(await this.pickInterval())) return;
    if (this.mode === 'route' && !this.route && !(await this.pickRoute())) return;
    if (this.mode === 'plan' && !Plans.active()) return this.go('plans');
    if (Pref('countdown') && !this._counted) { this._counted = true; await this.countdown(); this._counted = false; if (this.tab !== 'record') return; }
    const tr = new Tracker(this.sport, {
      sim: this.sim, mult: this.simMult, autoPause: Game.has('autopause') && Pref('autoPause'), simPath: this.mode === 'route' && this.route ? this.route.points : null,
      onUpdate: () => this.onTick(), onSplit: (n, t) => this.onSplit(n, t),
      onAwayBack: (d, dt) => FX.toast(`Bem-vindo de volta! +${Fmt.km(d)} km somados enquanto o app estava minimizado.`),
    });
    this.tracker = tr; this.tab = 'training';
    tr.start(); Background.start(tr);
    if (!this.sim) Native.call('trainStart', { sport: this.sport });
    if (this.mode === 'interval' && this.preset) this.coach = new Coach(tr, this.preset);
    if (this.mode === 'route' && this.route) this.routeLive = { off: false, left: this.route.distance, ghost: null };
    UI.training(); this.wake();
    if (!this.sim && !Store.data.profile.bgTipSeen) {
      Store.data.profile.bgTipSeen = 1; Store.save();
      const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setTimeout(() => FX.modal(`<div class="m-ic" style="background:var(--brand-soft);color:var(--brand)">${I('signal')}</div><h3>Pode minimizar</h3><p class="muted">O tempo continua contando com o JustGo em segundo plano, e os controles aparecem na tela de bloqueio. Ao voltar, somamos a distância que você percorreu.</p>${ios ? '<p class="muted small" style="margin-top:10px">No iPhone, o GPS de sites pausa quando o app sai da tela. Para o trajeto sair desenhado certinho no mapa, deixe o JustGo aberto (a tela não apaga sozinha).</p>' : '<p class="muted small" style="margin-top:10px">Dica: para o trajeto sair perfeito no mapa, deixe o JustGo aberto. A tela não apaga sozinha durante o treino.</p>'}<button class="btn primary" data-m="ok" style="margin-top:18px">Entendi</button>`), 600);
    }
    FX.beep([440, 660]);
    if (Pref('voice') && !this.coach) {
      const t = this.mode === 'plan' && Plans.today();
      FX.say(t && t.session ? `Treino do plano: ${t.session.type}, ${String(t.session.km).replace('.', ',')} quilômetros. Bom treino!` : 'Treino iniciado. Bom treino!');
    }
    this.liveTimer = setInterval(() => { Store.saveLive(tr.snapshot()); if (Cloud.liveId) Cloud.liveUpdate(tr); }, 12000);
  },
  onTick() {
    const tr = this.tracker; if (!tr) return;
    if (this.coach) this.coach.tick();
    if (this.route && tr.state === 'running') this.routeLive = Routes.live(tr, this.route);
    UI.updateTraining();
  },
  onSplit(n, t) {
    const tr = this.tracker;
    FX.vibrate([100]);
    if (Pref('voice') && !tr.stale && !(this.coach && !this.coach.done)) {
      const kmh = Math.min((tr.distance / Math.max(1, tr.moving / 1000)) * 3.6, (CONFIG.sports[tr.sport] || {}).maxKmh || 60);
      const pace = Fmt.isSpeed(tr.sport) ? `velocidade média de ${Math.round(kmh)} quilômetros por hora` : `ritmo do último quilômetro: ${FX.spokenTime(t)}`;
      FX.say(`Quilômetro ${n}. Tempo total: ${FX.spokenTime(tr.moving / 1000)}. ${pace}.`);
    }
    if (Game.has('splits')) FX.toast(`Km ${n}: ${Fmt.time(t)}`);
  },
  async finishTraining() {
    const tr0 = this.tracker, logged = Cloud.loggedIn();
    const defTitle = UI.actTitle({ start: tr0.startTs || Date.now(), sport: tr0.sport });
    const v = await FX.modal(`<div class="finish"><h3>Finalizar treino</h3><p class="muted num">${Fmt.km(tr0.distance)} km · ${Fmt.time(tr0.moving / 1000)}</p>
      <span class="fin-lbl">Esporte</span>
      <div class="fin-sports">${Object.entries(CONFIG.sports).map(([k, sp]) => `<label><input type="radio" name="finSport" value="${k}" ${k === tr0.sport ? 'checked' : ''}><span style="--c:${sp.color}">${I(SPORT_IC[k])}${sp.name}</span></label>`).join('')}</div>
      <label class="field"><span>Nome do treino <em>opcional</em></span><input id="finTitle" maxlength="60" placeholder="${esc(defTitle)}"></label>
      <span class="fin-lbl">Quem pode ver</span>
      <div class="fin-vis">
        <label><input type="radio" name="finVis" value="public" checked><span>${I('globe')}<b>Público</b><small>${logged ? 'Aparece no feed e no Descobrir, e disputa território' : 'É publicado quando você entrar na sua conta'}</small></span></label>
        <label><input type="radio" name="finVis" value="private"><span>${I('lock')}<b>Só eu</b><small>Fica salvo só para você</small></span></label>
      </div>
      <div class="row2"><button class="btn ghost" data-m="no">Voltar ao treino</button><button class="btn primary" data-m="yes">Salvar treino</button></div></div>`);
    if (v !== 'yes' || !this.tracker) return;
    const F = FX.form || {};
    const tr = this.tracker; tr.stop(); this.release(); Background.stop(); Native.call('trainStop');
    clearInterval(this.liveTimer); Store.clearLive(); Cloud.liveStop();
    const act = tr.toActivity();
    if (F.finSport && CONFIG.sports[F.finSport]) act.sport = F.finSport;
    if (F.finTitle && F.finTitle.trim()) act.title = F.finTitle.trim().slice(0, 60);
    act.private = F.finVis === 'private'; // padrão: público
    if (this.coach) act.workout = this.coach.summary();
    if (this.route) act.routeId = this.route.id;
    this.tracker = null; this.coach = null; this.routeLive = null;
    if (this.mode === 'interval') this.preset = null;
    if (act.distance < 20) {
      const keep = await FX.confirm('Treino muito curto', 'Menos de 20 metros registrados. Quer salvar mesmo assim?', 'Salvar');
      if (!keep) { FX.toast('Treino descartado.'); return this.go('home'); }
    }
    this.finalizeActivity(act);
  },
  // salva, valida (antitrapaça), processa jogo, mostra o resumo e publica
  finalizeActivity(act) {
    Game.validate(act);
    Store.data.activities.push(act); Store.save();
    const res = Game.process(act);
    this.tab = 'summary'; this.nav = 'home';
    UI.summary(act, res, true);
    if (act.flagged) FX.beep([300, 200]);
    FX.celebrate(res);
    Game.fetchWeather(act).then((w) => {
      if (!w) return;
      const el = $('#sWeather'); if (el) el.innerHTML = `${I(w.weather.rain >= 0.2 ? 'cloudRain' : 'cloud', 'xs')} ${Math.round(w.weather.temp)}°C`;
      if (w.medal) { FX.toast('Medalha: Treino na chuva!'); FX.beep([659, 784, 988]); }
    });
    Cloud.publish(act).catch(() => {});
    // altitude pelo relevo real (subida/descida e calorias mais exatas); publica de novo com os números certos
    Elev.apply(act).then((ch) => { if (!ch) return; Store.save(); if (act.pub) Cloud.publish(act).catch(() => {}); if (App.tab === 'detail' && $('#sWeather')) UI.summary(act, null, false); }).catch(() => {});
    // território: disputa as áreas fechadas neste treino
    if (res.zones && res.zones.loops.length && !act.private) {
      Zones.claim(act, res.zones.loops).then((r) => {
        if (!r) return;
        const names = [...new Set(r.stolen.map((z) => z.owner_name || 'outro atleta'))];
        if (r.stolen.length) { FX.beep([523, 659, 784, 1047]); FX.toast(`Você roubou ${r.stolen.length} área${r.stolen.length > 1 ? 's' : ''} de ${names.join(', ')}!`); }
        else if (r.created.length) FX.toast(`Área conquistada: ${Zones.areaTxt(r.created.reduce((x, z) => x + z.area, 0))}`);
      }).catch((e) => console.error(e));
    }
  },
  async adjustPhoto() {
    const P = Store.data.profile, src = P.photoSrc || P.photo; if (!src) return;
    try {
      const r = await fetch(src.startsWith('data:') ? src : src + (src.includes('?') ? '&' : '?') + 'r=' + Date.now(), { mode: 'cors' });
      const img = await createImageBitmap(await r.blob());
      return this.setPhotoImg(img, false);
    } catch (e) { FX.toast('Não deu para abrir a foto. Tente trocar por uma nova.'); }
  },
  // foto do treino: reduz para no máx. 1280 px (≈150–250 KB) e envia
  async addActPhoto(id, file) {
    const a = this.find(id); if (!a) return;
    if (!Cloud.loggedIn()) return FX.toast('Entre na sua conta para adicionar fotos aos treinos.');
    if (UI.photosOf(a).length >= 2) return FX.toast('Máximo de 2 fotos por treino.');
    let img; try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = URL.createObjectURL(file); }); }
    if (!img) return FX.toast('Não deu para abrir essa imagem.');
    const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    FX.toast('Enviando foto…');
    try {
      const r = await Cloud.uploadActPhoto(a.id, blob);
      a.photos = [...(a.photos || []).filter((p) => p && (p.url || typeof p === 'string')), r].slice(0, 2); Store.save();
      if (!a.private) Cloud.publish(a).catch(() => {});
      FX.toast('Foto adicionada!');
    } catch (e) {
      console.warn('foto treino', e);
      FX.toast(/bucket|not found|policy|row-level/i.test(String(e && (e.message || e.error))) ? 'Falta configurar as fotos de treino no Supabase (SQL).' : 'Não deu para enviar a foto agora.');
    }
    if (this.tab === 'detail') UI.summary(a, null, false);
  },
  // recorta a foto em quadrado, reduz para 320 px (≈25 KB) e envia
  async setPhoto(file) {
    if (!/^image\//.test(file.type || 'image/')) return FX.toast('Escolha uma imagem.');
    let img;
    try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }).catch(() => null); }
    if (!img) return FX.toast('Não deu para abrir essa imagem.');
    return this.setPhotoImg(img, true);
  },
  // recorta (centralizar/zoom) e salva; guarda também a original (até 1280 px) para reajustar depois
  async setPhotoImg(img, isNew) {
    const crop = await this.cropPhoto(img);
    if (!crop) return;
    const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
    g.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sw, 0, 0, S, S);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    const P = Store.data.profile;
    P.photo = c.toDataURL('image/jpeg', 0.7); Store.save(); // aparece na hora, mesmo sem internet
    if (!this.tracker) this.go(this.tab);
    if (!Cloud.loggedIn()) return FX.toast('Foto salva neste aparelho. Entre na conta para os outros verem.');
    try {
      P.photo = await Cloud.uploadPhoto(blob); Store.save(); FX.toast('Foto de perfil atualizada!');
      if (isNew) { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), o = document.createElement('canvas'); o.width = Math.round(img.width * k); o.height = Math.round(img.height * k); o.getContext('2d').drawImage(img, 0, 0, o.width, o.height); const ob = await new Promise((r) => o.toBlob(r, 'image/jpeg', 0.85)); try { P.photoSrc = await Cloud.uploadPhotoSrc(ob); Store.save(); } catch (e) {} }
    }
    catch (e) {
      console.warn('foto', e);
      FX.toast(/bucket|not found|column|photo/i.test(String(e && (e.message || e.error))) ? 'Falta configurar as fotos no Supabase (SQL do avatars).' : 'Não deu para enviar a foto agora. Ela ficou salva neste aparelho.');
    }
  },
  // conserta treinos antigos: tira leituras de GPS repetidas (menos de 0,8 s da anterior),
  // que somavam metros "fantasmas" e geravam velocidades absurdas. Recalcula distância e parciais.
  // revisão geral dos treinos já salvos (uma vez): relevo real, clima preciso e republica no Social
  async statsFix() {
    const D = Store.data; if (D.statsV >= 3) return;
    const list = [...D.activities].sort((a, b) => b.start - a.start);
    let n = 0, fail = 0;
    for (const a of list) {
      if (App.tracker) return; // nunca durante um treino
      let ch = false;
      try { ch = (await Elev.apply(a)) || ch; } catch (e) { fail++; }
      if (a.points && a.points.length && !(a.weather && a.weather.v === 2)) { try { ch = !!(await Game.fetchWeather(a, true)) || ch; } catch (e) {} }
      if (ch) { n++; Store.save(); if (a.pub) Cloud.publish(a).catch(() => {}); }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!fail) D.statsV = 3; Store.save(); // sem internet em algum: tenta de novo na próxima abertura
    if (n) FX.toast(`Estatísticas revisadas em ${n} treino${n > 1 ? 's' : ''}: relevo e clima mais precisos.`);
  },
  repairActs() {
    const D = Store.data, changed = [];
    D.activities.forEach((a) => {
      const P = a.points; if (!P || P.length < 3 || a.mode === 'pool') return;
      const out = [P[0]];
      for (let i = 1; i < P.length; i++) {
        const q = P[i], last = out[out.length - 1], dt = (q[2] - last[2]) / 1000;
        if (!q[4] && !q[5] && dt < 0.8 && Geo.dist(last, q) < 25 && i < P.length - 1) continue;
        out.push(q);
      }
      if (out.length === P.length) return;
      let dist = 0; const splits = []; let mv = 0, lastSplit = 0;
      for (let i = 1; i < out.length; i++) {
        if (out[i][4]) continue;
        const d = Geo.dist(out[i - 1], out[i]), dt = (out[i][2] - out[i - 1][2]) / 1000;
        dist += d; if (dt > 0 && d / dt > 0.3) mv += dt;
        while (dist >= (splits.length + 1) * 1000) { splits.push(Math.round(mv - lastSplit)); lastSplit = mv; }
      }
      a.points = out;
      if (Math.abs(dist - a.distance) > 5) {
        a.fixedFrom = a.distance; a.distance = Math.round(dist);
        if (a.splits && a.splits.length && splits.length) a.splits = splits;
        changed.push(a);
      }
    });
    D.fixGps1 = 1; Store.save();
    if (changed.length) {
      setTimeout(() => { changed.forEach((a) => { if (a.pub) Cloud.publish(a).catch(() => {}); }); }, 8000);
      setTimeout(() => FX.toast(`${changed.length} treino${changed.length > 1 ? 's' : ''} com GPS corrigido${changed.length > 1 ? 's' : ''} (distância mais precisa).`), 2500);
    }
  },
  // tela de ajuste: arrastar para centralizar, pinça/controle para zoom. Devolve o recorte (ou null)
  cropPhoto(img) {
    return new Promise((done) => {
      const W = Math.min(window.innerWidth - 72, 360), dpr = Math.min(2, window.devicePixelRatio || 1);
      const el = document.createElement('div'); el.className = 'crop';
      el.innerHTML = `<div class="crop-box"><h3>Ajustar foto</h3><p class="muted small">Arraste para centralizar · use dois dedos ou a barra para aproximar</p>
        <div class="crop-stage" style="width:${W}px;height:${W}px"><canvas width="${W * dpr}" height="${W * dpr}" style="width:${W}px;height:${W}px"></canvas></div>
        <div class="crop-zoom">${I('minus')}<input type="range" min="100" max="400" value="100" aria-label="Zoom">${I('plus')}</div>
        <div class="row2"><button class="btn ghost" data-c="no">Cancelar</button><button class="btn primary" data-c="ok">Usar foto</button></div></div>`;
      document.body.appendChild(el);
      const cv = el.querySelector('canvas'), g = cv.getContext('2d'), rng = el.querySelector('input');
      const iw = img.width, ih = img.height, base = W / Math.min(iw, ih);
      let s = base, x = (W - iw * s) / 2, y = (W - ih * s) / 2;
      const clamp = () => { s = Math.max(base, Math.min(base * 4, s)); x = Math.min(0, Math.max(W - iw * s, x)); y = Math.min(0, Math.max(W - ih * s, y)); };
      const draw = () => {
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W);
        g.drawImage(img, x, y, iw * s, ih * s);
        g.save(); g.fillStyle = 'rgba(8,12,24,.55)'; g.beginPath(); g.rect(0, 0, W, W); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2, true); g.fill('evenodd'); g.restore();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); g.stroke();
      };
      const zoomAt = (ns, cx, cy) => { const k = ns / s; x = cx - (cx - x) * k; y = cy - (cy - y) * k; s = ns; clamp(); rng.value = Math.round((s / base) * 100); draw(); };
      const pts = new Map(); let pinch = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e)); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s }; } });
      cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return; const p = pos(e), old = pts.get(e.pointerId); pts.set(e.pointerId, p);
        if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(pinch.s * (d / pinch.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        else if (pts.size === 1) { x += p[0] - old[0]; y += p[1] - old[1]; clamp(); draw(); }
      });
      const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); zoomAt(s * (e.deltaY < 0 ? 1.1 : 0.9), p[0], p[1]); }, { passive: false });
      rng.addEventListener('input', () => zoomAt(base * (rng.value / 100), W / 2, W / 2));
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]'); if (!b) return;
        el.remove(); done(b.dataset.c === 'ok' ? { sx: -x / s, sy: -y / s, sw: W / s } : null);
      });
      this._cropEl = el; draw();
    });
  },
  async checkLive() {
    const s = Store.loadLive();
    if (!s || !s.points) return;
    const ok = await FX.confirm('Treino não finalizado', `Encontramos um treino de ${CONFIG.sports[s.sport].name.toLowerCase()} com ${Fmt.km(s.distance)} km que não foi salvo. Quer salvar?`, 'Salvar');
    Store.clearLive();
    if (!ok) return;
    this.finalizeActivity({ id: uid(), sport: s.sport, start: s.startTs, duration: Math.round(s.moving / 1000), elapsed: Math.round((s.savedAt - s.startTs) / 1000), distance: Math.round(s.distance), points: s.points, splits: s.splits, mode: s.sim ? 'sim' : 'gps' });
  },

  /* ---------- localização para o contato de confiança ---------- */
  phoneLink(text) {
    let ph = (Store.data.trusted.phone || '').replace(/\D/g, '');
    if (ph && ph.length <= 11) ph = '55' + ph;
    return `https://wa.me/${ph}?text=${encodeURIComponent(text)}`;
  },
  async shareLive() {
    const T = Store.data.trusted, tr = this.tracker;
    if (Cloud.loggedIn()) {
      try {
        const link = Cloud.liveId ? this._liveLink : (this._liveLink = await Cloud.liveStart(tr ? tr.sport : this.sport));
        if (tr) Cloud.liveUpdate(tr);
        const b = $('#tLive'); if (b) b.classList.add('on');
        const text = `Estou treinando com o JustGo. Acompanhe minha localização ao vivo: ${link}`;
        if (navigator.share && !T.phone) { try { await navigator.share({ title: 'JustGo ao vivo', text, url: link }); return; } catch (e) { return; } }
        window.open(this.phoneLink(text), '_blank'); return;
      } catch (e) { console.error(e); }
    }
    // sem conta: envia a posição atual
    const last = tr && tr.points[tr.points.length - 1];
    const send = (lat, lng) => window.open(this.phoneLink(`Estou treinando agora. Minha localização: https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`), '_blank');
    if (last) return send(last[0], last[1]);
    navigator.geolocation.getCurrentPosition((p) => send(p.coords.latitude, p.coords.longitude), () => FX.toast('Não consegui pegar sua localização.'), { enableHighAccuracy: true, timeout: 10000 });
  },

  /* ---------- campos de formulário ---------- */
  onChange(e) {
    if (e.target.id === 'rtProg') { Retro.pause(); Retro.seek(+e.target.value / 1000); return; }
    if (e.target.id === 'actPhotoIn') { const f = e.target.files && e.target.files[0], id = e.target.dataset.id; e.target.value = ''; if (f) this.addActPhoto(id, f); return; }
    if (e.target.id === 'photoIn') { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) this.setPhoto(f); return; }
    const t = e.target, D = Store.data, P = D.profile;
    if (t.id === 'simChk') { this.sim = t.checked; const s = $('#simMult'); if (s) s.disabled = !t.checked; }
    else if (t.id === 'simMult') this.simMult = +t.value;
    else if (t.id === 'themeChk') { P.theme = t.checked ? 'light' : 'dark'; if (D.equipped.theme) D.equipped.theme = null; Store.save(); Shop.apply(); }
    else if (t.id === 'gpxIn' && t.files[0]) GPX.importFile(t.files[0]);
    else if (t.id === 'backupIn' && t.files[0]) this.restore(t.files[0]);
    else if (t.id === 'note') { const a = this.find(t.dataset.id); if (a) { a.note = t.value; Store.save(); } }
    else if (t.id === 'actGear') { const a = this.find(t.dataset.id); if (a) { a.gear = t.value || null; Store.save(); FX.toast('Equipamento atualizado'); } }
    else if (t.id === 'privZone') { D.privacy.zone = t.checked; Store.save(); if (t.checked && D.privacy.lat == null) FX.toast('Agora marque onde fica sua casa.'); }
    else if (t.id === 'privEnds') { D.privacy.trimEnds = t.checked; Store.save(); }
    else if (t.name === 'privR') { D.privacy.radius = +t.value; Store.save(); }
    else if (t.dataset.pref) { P[t.dataset.pref] = t.checked; Store.save(); if (t.dataset.pref === 'spotsOn' && !t.checked) Spots.leave(); FX.toast(t.dataset.pref === 'spotsOn' ? (t.checked ? 'Você volta a aparecer nos pontos' : 'Você está invisível nos pontos') : t.checked ? 'Ativado' : 'Desativado'); }
    else if (t.id === 'v3Prog') View3D.seek(+t.value / 1000);
    else if (t.dataset.pro) {
      const k = t.dataset.pro, num = t.type === 'number';
      let v = t.type === 'checkbox' ? t.checked : num ? Math.max(0, +t.value || 0) : t.value;
      if (k === 'weight' || k === 'age') { P[k] = Math.max(k === 'weight' ? 20 : 5, +t.value || P[k]); Store.save(); Pro._cache = new WeakMap(); }
      else Pro.set(k, v);
      if (k === 'on') { FX.toast(v ? 'Modo profissional ativado' : 'Modo profissional desativado'); UI.pro(); } else FX.toast('Salvo');
    }
    else if (t.dataset.gbt || t.dataset.gbw) {
      const g = Gear.get(t.dataset.gbt || t.dataset.gbw); if (!g) return;
      if (t.dataset.gbt) g.btype = t.value; else g.bweight = Math.max(0, +t.value || 0) || null;
      Store.save(); Pro._cache = new WeakMap(); FX.toast('Bike atualizada');
    }
    else if (t.dataset.hr) {
      const a = this.find(t.dataset.id); if (!a) return;
      const v = Math.round(+t.value || 0); a.hr = { ...(a.hr || {}), [t.dataset.hr]: v >= 40 && v <= 230 ? v : undefined };
      if (!a.hr.avg && !a.hr.max) delete a.hr;
      Store.save(); UI.summary(a, null, false); FX.toast('Batimentos salvos');
    }
    else if (t.dataset.trust) { D.trusted[t.dataset.trust] = t.value.trim(); Store.save(); FX.toast('Contato salvo'); }
    else if (t.dataset.set) {
      const k = t.dataset.set, num = ['weight', 'age', 'goalWeek', 'goalMonth'].includes(k);
      P[k] = num ? Math.max(1, +t.value || 1) : t.value.trim() || 'Atleta';
      Store.save();
      if (k.startsWith('goal') && this.tab === 'progress') UI.progress();
      else if (k.startsWith('goal')) FX.toast('Meta salva');
    }
  },
  find(id) { return Store.data.activities.find((a) => a.id === id); },

  async restore(file) {
    try {
      const d = JSON.parse(await file.text());
      if (!d || !Array.isArray(d.activities)) throw new Error('formato');
      if (!(await FX.confirm('Restaurar backup?', `Isso substitui os dados atuais por ${d.activities.length} treinos do arquivo.`, 'Restaurar', true))) return;
      localStorage.setItem(Store.key, JSON.stringify(d)); Store.load(); Shop.apply(); FX.toast('Backup restaurado!'); this.go('profile');
    } catch (e) { FX.toast('Arquivo de backup inválido.'); }
  },

  /* ---------- treinos de demonstração (sem GPS) ---------- */
  demo() {
    const loop = [Geo.home()[0] + 0.004, Geo.home()[1] - 0.003];
    const mk = (sport, daysAgo, km, hour, opts = {}) => {
      const sp = CONFIG.sports[sport], v = sp.simSpeed * (0.9 + Math.random() * 0.2);
      const start = new Date(); start.setDate(start.getDate() - daysAgo); start.setHours(hour, 10, 0, 0);
      if (sport === 'swim') {
        const laps = Math.round((km * 1000) / 25), dur = Math.round((km * 1000) / v);
        return { id: uid(), sport, start: start.getTime(), duration: dur, elapsed: dur, distance: laps * 25, points: [], splits: [], mode: 'sim', pool: { length: 25, laps, strokes: 18 } };
      }
      const tr = new Tracker(sport, { sim: true, mult: 5 });
      tr.simNow = start.getTime(); tr.state = 'running'; tr.startTs = tr.simNow; tr.last = tr.simNow; tr.lastMove = tr.simNow; tr.initSim(); tr.simV = v;
      tr.simPos = opts.loop ? [...loop] : [Geo.home()[0] + (Math.random() - 0.5) * 0.02, Geo.home()[1] + (Math.random() - 0.5) * 0.02];
      if (opts.loop) { tr.heading = 45; tr.simStep = function () { this.simI++; this.heading += 360 / ((km * 1000) / (this.simV * 5)); const d = this.simV * 5, h = (this.heading * Math.PI) / 180; this.simPos[0] += (d * Math.cos(h)) / 111320; this.simPos[1] += (d * Math.sin(h)) / (111320 * Math.cos((this.simPos[0] * Math.PI) / 180)); this.onPos({ lat: this.simPos[0], lng: this.simPos[1], alt: 760 + Math.sin(this.simI / 10) * 6, acc: 5, t: this.simNow }); }; }
      let guard = 0;
      while (tr.distance < km * 1000 && guard++ < 20000) { tr.simNow += 5000; tr.simStep(); tr.moving += 5000; }
      tr.endTs = tr.simNow;
      return tr.toActivity();
    };
    const plan = [['run', 9, 4, 7], ['ride', 8, 18, 17], ['run', 6, 5.2, 6, { loop: true }], ['swim', 5, 1.2, 19], ['run', 4, 3, 7], ['ride', 3, 24, 16], ['run', 2, 5.2, 6, { loop: true }], ['run', 1, 6, 18]];
    let sum = { xp: 0, unlocks: [] };
    plan.forEach(([s, d, km, h, o]) => {
      const a = mk(s, d, km, h, o); Game.validate(a); Store.data.activities.push(a);
      const r = Game.process(a); sum.xp += r.xp; sum.unlocks.push(...r.unlocks);
    });
    Store.save();
    FX.toast(`${plan.length} treinos criados · +${sum.xp} XP · ${sum.unlocks.length} funções liberadas`);
    FX.celebrate({ missions: [], medals: [], records: [], unlocks: sum.unlocks, levelUp: null });
    this.sub.history = 'mine'; this.go('history');
  },

  /* ---------- ações dos botões ---------- */
  actions: {
    go: (el) => App.go(el.dataset.v),
    sub: (el) => { const [t, s] = el.dataset.v.split(':'); App.sub[t] = s; App.go(t); },
    subTab: (el) => { App.sub[App.tab] = el.dataset.v; App.go(App.tab); },
    view3d: (el) => { let a = App.find(el.dataset.v), remote = false; if (!a && Cloud._cache && Cloud._cache[el.dataset.v]) { a = Cloud.toLocal(Cloud._cache[el.dataset.v]); remote = true; } if (!a) return; App.v3Remote = remote ? a : null; App.v3From = App.tab; App.v3Act = a.id; App.tab = 'view3d'; UI.view3d(a); },
    v3Close: () => { View3D.close(); if (App.v3Remote) { App.v3Remote = null; App.tab = 'ract'; App.nav = 'social'; UI.remote(App.v3Act); return; } App.tab = 'detail'; const a = App.find(App.v3Act); if (a) UI.summary(a, null, false); else App.go('home'); },
    v3Play: () => (View3D.playing ? View3D.pause() : View3D.play()),
    v3Video: () => View3D.video(),
    v3Speed: () => View3D.setSpeed(),
    terrClaim: async (el) => {
      const act = App.find(el.dataset.v); if (!act) return;
      if (!Cloud.loggedIn()) return FX.toast('Entre na conta para conquistar no mapa.');
      el.disabled = true; el.textContent = 'Conquistando…';
      if (el.dataset.home) act.pubNearHome = true;
      act.zc = 0; const r = {}; Zones.hook(act, r); Store.save();
      if (!r.zones || !r.zones.loops.length) { el.disabled = false; el.textContent = 'Conquistar'; return FX.toast('Esse treino não fechou área.'); }
      try {
        const c = await Zones.claim(act, r.zones.loops);
        UI._zonesCloud = null;
        if (c && c.privacy) FX.toast('A área encosta na sua zona de casa (Privacidade). Toque em Publicar para mostrar no mapa.');
        else if (c && (c.created.length || c.stolen.length)) { FX.beep([523, 659, 784, 1047]); FX.toast(`Território conquistado: ${Zones.areaTxt(r.zones.loops.reduce((s, l) => s + l.area, 0))}!`); }
        else if (Cloud.zoneErr) FX.toast('Erro ao enviar: ' + Cloud.zoneErr.slice(0, 100));
        else FX.toast('Essa área já é sua no mapa.');
      if (App.tab === 'detail') UI.summary(act, null, false);
      } catch (e) { console.error(e); FX.toast('Não deu para enviar agora. Tente de novo.'); }
      el.disabled = false; el.textContent = 'Conquistar';
    },
    v3Cancel: () => { View3D.cancelVideo = true; },
    v3Light: () => { View3D.light = !View3D.light; const a = App.find(App.v3Act); View3D.close(); if (a) UI.view3d(a); FX.toast(View3D.light ? 'Modo leve ligado' : 'Qualidade máxima'); },
    chalOpen: (el) => { App.tab = 'challenge'; App.nav = 'social'; UI.challenge(el.dataset.v); },
    followList: (el) => { App.tab = 'followList'; App.nav = 'profile'; UI.followList(el.dataset.v); },
    clubTab: (el) => { App.clubTab = el.dataset.v; UI.club(UI._club.c.id); },
    clubInvite: () => {
      const c = UI._club && UI._club.c; if (!c) return;
      const msg = `Bora treinar comigo no clube "${c.name}" do JustGo! Baixe o app e entre com o código ${c.invite_code}.`;
      try { navigator.clipboard.writeText(msg); } catch (e) {}
      window.open('https://wa.me/?text=' + encodeURIComponent(msg)); FX.toast('Convite copiado. Mande no WhatsApp!');
    },
    clubEdit: async () => {
      const c = UI._club && UI._club.c; if (!c) return;
      const f = await FX.prompt('Editar clube', [['ceName', 'Nome', 'text', c.name], ['ceGoal', 'Meta do mês (km, somando todos)', 'number', c.goal_km], ['ceDesc', 'Descrição', 'text', c.description || '', 'ex.: Treinos toda terça às 19h no parque', 'maxlength="120"']], 'Salvar');
      if (!f) return;
      try { await Cloud.clubUpdate(c.id, { name: (f.ceName || c.name).trim().slice(0, 60), goal_km: Math.max(1, +f.ceGoal || c.goal_km), description: (f.ceDesc || '').trim().slice(0, 120) || null }); UI._club = null; FX.toast('Clube atualizado'); UI.club(c.id); } catch (e) { FX.toast('Não foi possível salvar.'); }
    },
    clubLeave: async () => {
      const c = UI._club && UI._club.c; if (!c) return;
      if (!(await FX.confirm('Sair do clube?', `Você deixa de aparecer no ranking de ${c.name}. Dá para voltar com o código.`, 'Sair', true))) return;
      try { await Cloud.clubLeave(c.id); UI._club = null; FX.toast('Você saiu do clube'); App.sub.social = 'clubs'; App.go('social'); } catch (e) { FX.toast('Não foi possível sair agora.'); }
    },
    msToggle: (el) => {
      const k = el.dataset.v, sel = App.msPick || (App.msPick = []);
      const i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else { if (sel.length >= 2) sel.shift(); sel.push(k); }
      UI.progress();
    },
    msSave: () => { const sel = (App.msPick || []).slice(0, 2); if (!sel.length) return; Store.data.profile.missionSports = sel; Store.save(); App.msEditing = false; App.msPick = null; FX.toast('Missões atualizadas!'); UI.progress(); },
    msEdit: () => { App.msEditing = true; App.msPick = [...(Store.data.profile.missionSports || [])]; UI.progress(); },
    swapDaily: (el) => { const n = Game.swapDaily(el.dataset.v); if (n) FX.toast(`Nova missão: ${n.text}`); else FX.toast('Você já trocou uma missão hoje.'); UI.go ? null : null; if (App.tab === 'progress') UI.progress(); else App.go(App.tab); },
    sportPick: async () => {
      const v = await FX.modal(UI.sportGrid(App.sport));
      if (v && CONFIG.sports[v]) App.actions.sport({ dataset: { v } });
    },
    sport: (el) => { App.sport = el.dataset.v; App.mode = App.sport === 'swim' && App.swimMode === 'pool' ? 'manual' : 'free'; App.route = null; App.go('record'); },
    swimMode: (el) => { App.swimMode = el.dataset.v; App.mode = el.dataset.v === 'pool' ? 'manual' : 'free'; App.go('record'); },
    voiceToggle: () => {
      const on = !Pref('voice'); Store.data.profile.voice = on; Store.save(); FX.vibrate([30]);
      const b = $('.voice-tg'); if (b) { b.classList.toggle('on', on); b.innerHTML = `<i>${I(on ? 'mic' : 'micOff')}</i><small>Voz ${on ? 'ligada' : 'desligada'}</small>`; }
      FX.toast(on ? 'Assistente de voz ligado: ele fala a cada km' : 'Assistente de voz desligado');
      if (on) FX.say('Assistente de voz ligado.');
    },
    recenter: () => { const m = UI.recMap, d = UI.recDot; if (m && d) m.setView(d.getLatLng(), 16); else Geo.locate(true).then((p) => { if (p && UI.recMap) UI.recMap.setView([p[0], p[1]], 16); }); },
    simToggle: async () => {
      const v = await FX.modal(`<h3>Modo teste</h3><p class="muted">Simula o GPS para testar o app no computador, sem sair de casa.</p><div class="col">${[['off', 'Desligado (GPS real)'], ['1', '1× velocidade real'], ['5', '5× mais rápido'], ['20', '20× mais rápido']].map(([k, n]) => `<button class="btn ghost ${(k === 'off' && !App.sim) || (App.sim && +k === App.simMult) ? 'is-on' : ''}" data-m="${k}">${n}</button>`).join('')}</div>`);
      if (v === 'off') App.sim = false; else { App.sim = true; App.simMult = +v; }
      App.go('record');
    },
    visSet: async (el) => {
      const [id, v] = el.dataset.v.split(':'); const a = App.find(id); if (!a) return;
      const priv = v === 'private'; if (!!a.private === priv) return;
      a.private = priv; Store.save();
      const box = $('#visCard'); if (box) box.outerHTML = UI.visRow(a);
      if (!Cloud.loggedIn()) { FX.toast(priv ? 'Agora só você vê este treino.' : 'Vai ser publicado quando você entrar na sua conta.'); return; }
      try { if (priv) await Cloud.unpublish(a.id); else await Cloud.publish(a); FX.toast(priv ? 'Agora só você vê este treino.' : 'Treino publicado!'); }
      catch (e) { FX.toast('Sem conexão: tente de novo em instantes.'); }
    },
    visToggle: async (el) => {
      const a = App.find(el.dataset.v); if (!a) return;
      if (a.private && !Cloud.loggedIn()) { FX.toast('Entre na sua conta para publicar.'); return App.go('account'); }
      a.private = !a.private; Store.save();
      try { if (a.private) await Cloud.unpublish(a.id); else await Cloud.publish(a); } catch (e) {}
      FX.toast(a.private ? 'Agora só você vê este treino.' : 'Treino publicado!');
      el.innerHTML = `${I(a.private ? 'lock' : 'globe')}${a.private ? 'Privado' : 'Público'}`;
    },
    mapLayer: (el) => { const L0 = App.mapLayers, k = el.dataset.v; L0[k] = !L0[k]; el.classList.toggle('on', L0[k]); if (k === 'explore') return Explore.show(UI.bigMap, L0[k]); UI.mapaDraw(); },
    mapCenter: () => {
      if (!('geolocation' in navigator)) return;
      FX.toast('Buscando sua posição…');
      navigator.geolocation.getCurrentPosition((p) => { Geo.remember(p.coords.latitude, p.coords.longitude); UI.mapa(); }, () => FX.toast('Permita a localização para ver o mapa da sua região.'), { enableHighAccuracy: true, timeout: 15000 });
    },
    followHere: async (el) => {
      try { await Cloud.follow(el.dataset.v); } catch (e) {}
      document.querySelectorAll(`[data-act=followHere][data-v="${el.dataset.v}"]`).forEach((b) => { b.outerHTML = `<span class="followed-tag">${I('check', 'xs')} Seguindo</span>`; });
      if (Cloud._fol) Cloud._fol.add(el.dataset.v);
      FX.toast('Seguindo!');
    },
    checkUpdate: async () => {
      if (!Native.on) { FX.toast('No navegador o JustGo já abre sempre na versão mais nova.'); return; }
      FX.toast('Procurando atualização…');
      const r = await Native.call('checkUpdate');
      if (!r) {
        // instalador 2.5.1: sabe se atualizar, mas só ao abrir o app
        if (await Native.call('version')) return FX.modal(`<div class="unlock"><div class="lock-anim open">${I('refresh')}</div><h3>Feche e abra o JustGo</h3><p class="muted">Feche o app por completo (tire da lista de apps abertos) e abra de novo. A atualização é baixada na abertura e aparece o aviso "Atualizar".</p><button class="btn primary" data-m="ok">Entendi</button></div>`);
        return FX.modal(`<div class="unlock"><div class="lock-anim">${I('download')}</div><h3>Instale o app novo uma vez</h3><p class="muted">Este instalador do JustGo é de antes das atualizações automáticas. Baixe e instale o APK mais recente — seus treinos continuam salvos se você entrar com a mesma conta. Depois disso, tudo se atualiza sozinho.</p><button class="btn primary" data-m="ok">Entendi</button></div>`);
      }
      if (r.ready) { JG.updateReady(r.ready); FX.toast('Atualização pronta!'); }
      else if (r.status === 'em dia') FX.toast(`Você já está na versão mais nova (${CONFIG.version}).`);
      else if (/APK/.test(r.status)) FX.modal(`<div class="unlock"><div class="lock-anim">${I('download')}</div><h3>Precisa do app novo</h3><p class="muted">Esta atualização precisa de um instalador mais novo. Baixe e instale o APK mais recente do JustGo.</p><button class="btn primary" data-m="ok">Entendi</button></div>`);
      else FX.toast('Não deu para verificar agora. Confira a internet e tente de novo.');
      UI.verInfo();
    },
    proSet: (el) => { const [k, v] = el.dataset.v.split(':'); Pro.set(k, v); UI.pro(); },
    proOn: () => { Pro.set('on', true); FX.toast('Modo profissional ativado'); App.go('pro'); },
    navProfile: () => { App.sub.profile = 'activities'; App.go('profile'); },
    profTab: (el) => { App.sub.profile = el.dataset.v; UI.profile(); },
    setPref: (el) => {
      const [k, v] = el.dataset.v.split(':'), P = Store.data.profile;
      P[k] = v; if (k === 'theme') { Store.data.equipped.theme = null; Shop.apply(); }
      Store.save(); UI.settings();
    },
    adjInfo: () => FX.modal(`<h3>Ritmo corrigido</h3><p class="muted">Mostra quanto o seu treino valeria <b>no plano e num dia fresco</b>, para comparar treinos de forma justa.</p>
      <div class="list"><div class="row">${UI.iconBox('mountain')}<div class="grow"><b>Relevo</b><small>Cada trecho é ajustado pela inclinação do terreno, pelo esforço real de correr em subida e descida (curva medida em corredores, a mesma ideia do “GAP”). A altitude vem do mapa de relevo, não do GPS.</small></div></div>
      <div class="row">${UI.iconBox('sun')}<div class="grow"><b>Calor e umidade</b><small>Usa a temperatura e o ponto de orvalho na hora do treino (regra usada por treinadores): quanto mais quente e úmido, mais o corpo desacelera.</small></div></div>
      <div class="row">${UI.iconBox('bike')}<div class="grow"><b>No pedal</b><small>A velocidade que a sua potência média daria numa reta plana, sem vento.</small></div></div></div>
      <button class="btn primary" data-m="ok">Entendi</button>`),
    actPhotoDel: async (el) => {
      const a = App.find(el.dataset.v); if (!a || !a.photos) return;
      if (!(await FX.confirm('Remover foto?', 'Ela some do treino e do Social.', 'Remover', true))) return;
      const [p] = a.photos.splice(+el.dataset.i, 1); a.photosCleared = 1; Store.save();
      if (p && p.path) Cloud.removeActPhoto(p.path).catch(() => {});
      if (!a.private) Cloud.publish(a).catch(() => {});
      UI.summary(a, null, false);
    },
    photoView: (el) => FX.modal(`<div class="photo-view"><img src="${esc(el.dataset.v)}" alt="Foto"></div><button class="btn ghost" data-m="ok">Fechar</button>`),
    avCreate: () => { UI._avDraft = null; App.avTab = 'body'; App.tab = 'avatarEdit'; App.nav = 'profile'; UI.avatarEdit(true); },
    avHide: () => { Store.data.avatarHide = 1; Store.save(); FX.toast('Tudo bem! Você pode criar quando quiser em Perfil → Ajustes.'); App.go('home'); },
    avTab: (el) => { App.avTab = el.dataset.v; UI.avatarEdit(); },
    avSet: (el) => { const c = UI._avDraft, k = el.dataset.k, v = el.dataset.v; if (!c) return; c[k] = k === 'skin' || k === 'hairC' ? +v : k === 'beard' ? v === '1' : v; UI.avatarEdit(); },
    avItem: async (el) => {
      const c = UI._avDraft, it = Avatar.item(el.dataset.v); if (!c || !it) return;
      if (!Avatar.has(it.id)) {
        if (it.cond) return FX.toast(`Item conquistado: ${Avatar.COND[it.cond][0]}.`);
        if (Store.data.coins < it.price) return FX.toast(`Faltam ${it.price - Store.data.coins} moedas. Moedas vêm de missões e treinos.`);
        if (!(await FX.confirm(`Comprar ${it.name}?`, `Custa ${it.price} moedas. Você tem ${Store.data.coins}.`, 'Comprar'))) return;
        Avatar.buy(it.id); c.own = { ...(c.own || {}), [it.id]: Date.now() }; FX.toast('Item comprado!'); FX.vibrate([20, 30, 20]);
      }
      c.eq[it.cat] = it.id; UI.avatarEdit();
    },
    avSave: () => { const c = UI._avDraft; if (!c) return; const isNew = !Avatar.on(); c.own = { ...((Store.data.avatar || {}).own || {}), ...(c.own || {}) }; Avatar.save(c); UI._avDraft = null; FX.toast(isNew ? 'Seu atleta nasceu! 🎉 Agora ele evolui com seus treinos.' : 'Atleta atualizado!'); App.go(isNew ? 'home' : 'atleta'); },
    avRemove: async () => { if (!(await FX.confirm('Remover seu atleta?', 'Ele some do app e do seu perfil. Os itens comprados ficam guardados se você criar de novo.', 'Remover', true))) return; Store.data.avatar.on = false; Store.save(); if (Cloud.loggedIn()) Cloud.pushAvatar().catch(() => {}); App.go('profile'); },
    avPhoto: async () => {
      const cv = await Avatar.png(null, { portrait: true, size: 320, bg: '#DCE8FF', mood: 'happy' }); if (!cv) return FX.toast('Não deu para gerar a imagem.');
      const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9)); const P = Store.data.profile;
      P.photo = cv.toDataURL('image/jpeg', 0.8); Store.save();
      if (Cloud.loggedIn()) { try { P.photo = await Cloud.uploadPhoto(blob); Store.save(); } catch (e) {} }
      FX.toast('Seu atleta agora é sua foto de perfil!'); App.go('atleta');
    },
    spotSuggest: () => Spots.suggest(),
    spotOpen: (el) => Spots.sheet(el.dataset.v),
    retroStart: () => Retro.start(),
    retroCancel: () => { if (Retro.busy) { Retro.cancelVideo = true; FX.toast('Geração cancelada. A retrospectiva continua disponível.'); } else { Retro.close(); App.go('home'); } },
    retroClose: () => { if (Retro.busy) return App.actions.retroCancel(); Retro.close(); App.go('home'); },
    retroPlay: () => (Retro.playing ? Retro.pause() : Retro.play()),
    retroSpeed: (el) => Retro.setSpeed(+el.dataset.v),
    retroExport: () => Retro.exportVideo(),
    retroShare: () => Retro.reshare(),
    torchOpen: (el) => { App.tab = 'torch'; App.nav = 'social'; UI.torch(el.dataset.v); },
    torchNew: async () => {
      const lim = Date.now() - 47 * 3600e3, a = [...Store.data.activities].filter((x) => x.start > lim && !x.flagged && !x.private).sort((x, y) => y.start - x.start)[0];
      if (!a) return FX.toast('Para acender a Tocha, faça um treino primeiro (vale qualquer esporte).');
      App.actions.torchAct({ dataset: { v: a.id } });
    },
    torchAct: async (el) => {
      const a = App.find(el.dataset.v); if (!a) return;
      if (!Cloud.loggedIn()) return FX.toast('Entre na conta para usar a Tocha.');
      if (a.private) return FX.toast('Treinos privados não valem para a Tocha. Deixe este treino público.');
      if (a.flagged) return FX.toast('Este treino não conta para a Tocha.');
      let hold = [], fr = [];
      try { [hold, fr] = await Promise.all([Cloud.torchHolding(true), Cloud.friends()]); } catch (e) { return FX.toast('Tocha ainda não configurada no servidor (SQL).'); }
      if (!fr.length) return FX.toast('A Tocha é entre amigos: vocês dois precisam se seguir.');
      const pm = await Cloud.profilesMap(fr), opts = fr.map((id) => `<option value="${id}">${esc((pm[id] && pm[id].name) || 'Amigo')}</option>`).join('');
      const t = hold[0], lit = !t && Date.now() - a.start > 48 * 3600e3;
      if (lit) return FX.toast('Para acender uma Tocha, use um treino das últimas 48 h.');
      const f = await FX.prompt(t ? 'Passar a Tocha 🔥' : 'Acender uma Tocha 🔥', [['toFriend', 'Para qual amigo?', 'select', opts]], t ? 'Passar a Tocha' : 'Acender e passar',
        t ? `Você está com a Tocha de ${esc((t.creator && t.creator.name) || 'um amigo')} (${t.legs} pessoas, ${Fmt.num(t.total_m / 1000)} km). Este treino de ${Fmt.km(a.distance)} km entra na corrente.` : `Este treino de ${Fmt.km(a.distance)} km abre a corrente. Seu amigo terá 48 h para treinar e passar adiante.`);
      if (!f || !f.toFriend) return;
      try {
        if (!a.pub) await Cloud.publish(a);
        if (t) await Cloud.torchPass(t.id, a.id, f.toFriend); else await Cloud.torchLight(a.id, f.toFriend);
        Store.data.torchPasses = (Store.data.torchPasses || 0) + 1; Store.save();
        FX.vibrate([30, 40, 30]); FX.toast(`Tocha passada para ${(pm[f.toFriend] && pm[f.toFriend].name || 'seu amigo').split(' ')[0]}! 🔥`);
      } catch (e) {
        const m = String(e && e.message || '');
        FX.toast(/ja usado/.test(m) ? 'Este treino já foi usado numa Tocha.' : /apagou/.test(m) ? 'O prazo venceu: essa Tocha apagou.' : /treino invalido/.test(m) ? 'Use um treino feito depois de receber a Tocha (e público).' : /amigos/.test(m) ? 'Só dá para passar para amigos (vocês se seguem).' : 'Não deu para passar a Tocha agora.');
      }
    },
    editAct: async (el) => {
      const a = App.find(el.dataset.v); if (!a) return;
      const gps = a.points && a.points.length > 1;
      const opts = Object.entries(CONFIG.sports).filter(([k, v]) => (gps ? v.gps !== false && k !== 'swim' || k === a.sport : true)).map(([k, v]) => `<option value="${k}" ${k === a.sport ? 'selected' : ''}>${v.name}</option>`).join('');
      const f = await FX.prompt('Editar treino', [
        ['eaTitle', 'Título', 'text', UI.actTitle(a), 'ex.: Pedal na orla com a galera', 'maxlength="60"'],
        ['eaSport', 'Esporte', 'select', opts],
      ], 'Salvar');
      if (!f) return;
      const t = (f.eaTitle || '').trim().slice(0, 60);
      a.title = t || undefined; if (!t) delete a.title;
      if (f.eaSport && CONFIG.sports[f.eaSport] && f.eaSport !== a.sport) { a.sport = f.eaSport; delete a.zc; }
      Store.save();
      if (a.pub && !a.private) Cloud.publish(a).catch(() => {});
      FX.toast('Treino atualizado'); UI.summary(a, null, false);
    },
    photoRemove: async () => {
      const P = Store.data.profile; delete P.photo; Store.save();
      if (Cloud.loggedIn()) Cloud.removePhoto().catch(() => {});
      FX.toast('Foto removida'); App.go(App.tab);
    },
    photoPick: () => { const i = $('#photoIn'); if (i) i.click(); },
    // toque na própria foto: ver, trocar, reajustar ou remover
    myPhoto: async () => {
      const P = Store.data.profile, has = !!P.photo;
      const v = await FX.modal(`<div class="ph-sheet"><div class="ph-big">${UI.avatar('xl')}</div><b>${esc(P.name || 'Você')}</b>
        <div class="ph-acts">${has ? `<button class="ph-a" data-m="view">${I('search')}<span>Ver foto</span></button>` : ''}<button class="ph-a" data-m="pick">${I('camera')}<span>${has ? 'Trocar foto' : 'Escolher foto'}</span></button>${has ? `<button class="ph-a" data-m="adjust">${I('edit')}<span>Ajustar</span></button><button class="ph-a danger" data-m="del">${I('trash')}<span>Remover</span></button>` : ''}</div></div>
        <button class="btn ghost" data-m="no">Fechar</button>`);
      if (v === 'view') return App.actions.photoView({ dataset: { v: P.photo } });
      if (v === 'pick') { const i = $('#photoIn'); if (i) i.click(); else FX.toast('Abra seu perfil para trocar a foto.'); return; }
      if (v === 'adjust') return App.adjustPhoto();
      if (v === 'del') return App.actions.photoRemove();
    },
    // toque na foto de outra pessoa: ver em tamanho grande
    avView: (el) => {
      const p = (UI._people && UI._people[el.dataset.v]) || {};
      FX.modal(`<div class="ph-sheet">${p.photo ? `<div class="photo-view round"><img src="${esc(p.photo)}" alt="Foto de ${esc(p.name || '')}"></div>` : `<div class="ph-big">${UI.avatarOf(p.name, p.frame, p.avatar, 'xl')}</div>`}<b>${esc(p.name || 'Atleta')}</b>${p.username ? `<small class="muted">@${esc(p.username)}</small>` : ''}</div><button class="btn ghost" data-m="ok">Fechar</button>`);
    },
    quickStart: (el) => { const v = el.dataset.v; if (!CONFIG.sports[v]) return; App.go('record'); App.actions.sport({ dataset: { v } }); },
    editProfile: async () => {
      const P = Store.data.profile;
      const f = await FX.prompt('Editar perfil', [
        ['epName', 'Nome', 'text', P.name],
        ['epCity', 'Cidade', 'text', (Cloud.me && Cloud.me.city) || Pref('city'), 'ex.: Vitória'],
        ['epBio', 'Bio', 'text', Pref('bio'), 'ex.: Correndo atrás dos 21K 🏃', 'maxlength="80"'],
        ['epWeight', 'Peso (kg) · para calcular calorias', 'number', P.weight],
        ['epAge', 'Idade', 'number', P.age],
      ], 'Salvar');
      if (!f) return;
      P.name = (f.epName || '').trim() || 'Atleta'; P.city = (f.epCity || '').trim(); P.bio = (f.epBio || '').trim().slice(0, 80);
      P.weight = Math.max(20, +f.epWeight || P.weight); P.age = Math.max(5, +f.epAge || P.age);
      Store.save();
      if (Cloud.loggedIn() && Cloud.me && Cloud.me.username) Cloud.saveProfile(Cloud.me.username, P.name, P.city).catch(() => {});
      FX.toast('Perfil atualizado'); App.go(App.tab === 'settings' ? 'settings' : 'profile');
    },
    hideLogin: () => { Store.data.profile.loginHiddenAt = Date.now(); Store.save(); App.go('home'); },
    mode: async (el) => {
      const v = el.dataset.v;
      if (v === 'interval' && !(await App.pickInterval())) return;
      if (v === 'route' && !(await App.pickRoute())) return;
      if (v === 'plan' && !Plans.active()) return App.go('plans');
      App.mode = v; if (v !== 'route') App.route = null; App.go('record');
    },
    start: () => App.startTraining(),
    pause: () => { App.tracker.pause(); Background.pause(); UI.trainButtons(); UI.updateTraining(); if (Pref('voice')) FX.say('Treino pausado'); },
    resume: () => { App.tracker.resume(); Background.resume(); UI.trainButtons(); if (Pref('voice')) FX.say('Retomando'); },
    finish: () => App.finishTraining(),
    live: () => App.shareLive(),
    sos: () => FX.modal(`<div class="m-ic bad">${I('phone')}</div><h3>Emergência</h3><p class="muted">Ligar agora para:</p><div class="col"><a class="btn danger" href="tel:192">192 · SAMU</a><a class="btn danger ghost" href="tel:193">193 · Bombeiros</a><a class="btn danger ghost" href="tel:190">190 · Polícia</a>${Store.data.trusted.phone ? `<button class="btn ghost" data-m="trust">${I('signal')} Avisar ${esc(Store.data.trusted.name || 'contato de confiança')}</button>` : ''}<button class="btn ghost" data-m="no">Cancelar</button></div>`).then((v) => { if (v === 'trust') App.shareLive(); }),
    poolSave: () => {
      const length = +(document.querySelector('input[name=pLen]:checked') || { value: 25 }).value, laps = +$('#pLaps').value, dur = (+$('#pMin').value || 0) * 60 + (+$('#pSec').value || 0);
      if (!laps || !dur) return FX.toast('Preencha as voltas e o tempo.');
      const strokes = $('#pStrokes') ? +$('#pStrokes').value || 0 : 0;
      App.finalizeActivity({ id: uid(), sport: 'swim', start: Date.now() - dur * 1000, duration: dur, elapsed: dur, distance: Math.round(length * laps), points: [], splits: [], mode: 'pool', pool: { length, laps, strokes } });
    },
    // série de natação
    setBegin: () => {
      const id = (document.querySelector('input[name=ssPreset]:checked') || {}).value, base = CONFIG.swimSets.find((p) => p.id === id) || CONFIG.swimSets[0];
      const preset = { ...base, reps: +$('#ssReps').value || base.reps, rest: $('#ssRest').value === '' ? base.rest : +$('#ssRest').value };
      preset.name = `${preset.reps} × ${preset.dist} m`;
      SwimSet.start(preset, +(document.querySelector('input[name=ssPool]:checked') || { value: 25 }).value);
      App.tab = 'swimSet'; UI.swimSet(); App.wake();
    },
    setTap: () => { const s = SwimSet.s; if (!s) return; if (s.phase === 'ready') SwimSet.go(); else if (s.phase === 'work') SwimSet.repDone(); else if (s.phase === 'rest') SwimSet.go(); },
    setCancel: async () => {
      const s = SwimSet.s;
      if (s && s.results.length) { const v = await FX.modal(`<h3>Encerrar série?</h3><p class="muted">${s.results.length} repetições feitas.</p><div class="col"><button class="btn primary" data-m="save">Salvar o que fiz</button><button class="btn danger ghost" data-m="drop">Descartar</button><button class="btn ghost" data-m="no">Continuar nadando</button></div>`); if (v === 'no') return; if (v === 'save') return SwimSet.finish(); }
      SwimSet.cancel(); App.release(); App.go('record');
    },
    feel: (el) => { const a = App.find(el.dataset.id); if (!a) return; a.feeling = +el.dataset.v; Store.save(); document.querySelectorAll('.feel button').forEach((b) => b.classList.toggle('on', b === el)); },
    gpxOut: (el) => GPX.export(App.find(el.dataset.v)),
    detail: (el) => { App.stopRecWatch(); App.tab = 'detail'; App.nav = 'home'; UI.summary(App.find(el.dataset.v), null, false); },
    del: async (el) => {
      if (!(await FX.confirm('Excluir treino?', 'Isso não pode ser desfeito. XP e missões já conquistados continuam com você.', 'Excluir', true))) return;
      const id = el.dataset.v;
      Store.data.activities = Store.data.activities.filter((a) => a.id !== id);
      Store.data.routes.forEach((r) => (r.efforts = r.efforts.filter((e) => e.act !== id)));
      Store.save(); Cloud.unpublish(id).catch(() => {}); App.go('history');
    },
    heatmap: () => App.go('heatmap'),
    shareCard: (el) => ShareCard.open(App.find(el.dataset.v)),
    saveRoute: async (el) => {
      const a = App.find(el.dataset.v);
      const f = await FX.prompt('Salvar rota', [['rName', 'Nome da rota', 'text', `${UI.actTitle(a)} · ${Fmt.km(a.distance, 1)} km`]], 'Salvar', 'Depois é só escolher "Rota salva" na tela inicial para repetir o percurso.');
      if (!f) return;
      const r = Routes.create(a, f.rName || 'Minha rota');
      FX.toast(r ? 'Rota salva!' : 'Trajeto curto demais para virar rota.');
    },
    mkSegment: async (el) => {
      const a = App.find(el.dataset.v), km = a.distance / 1000;
      const f = await FX.prompt('Criar segmento', [['sName', 'Nome do segmento', 'text', '', 'ex.: Subida da ponte'], ['sFrom', 'Começa no km', 'number', '0', '', `step="0.1" min="0" max="${km.toFixed(1)}"`], ['sTo', 'Termina no km', 'number', Math.min(km, 1).toFixed(1), '', `step="0.1" min="0" max="${km.toFixed(1)}"`]], 'Criar', `Escolha um trecho desta atividade (0 a ${Fmt.num(km)} km). Sempre que você passar por ele, o tempo entra no seu ranking pessoal.`);
      if (!f) return;
      const from = Math.max(0, +f.sFrom || 0), to = Math.min(km, +f.sTo || km);
      if (to - from < 0.2) return FX.toast('O segmento precisa ter pelo menos 200 m.');
      const r = Routes.create(a, f.sName || `Segmento ${Fmt.num(from)}–${Fmt.num(to)} km`, from * 1000, to * 1000);
      FX.toast(r ? 'Segmento criado!' : 'Não consegui criar esse trecho.');
      if (r) UI.summary(a, null, App.tab === 'summary');
    },
    routeStart: (el) => { const r = Store.data.routes.find((x) => x.id === el.dataset.v); App.sport = r.sport; if (r.sport === 'swim') App.swimMode = 'open'; App.mode = 'route'; App.route = r; App.go('record'); },
    routeDel: async (el) => { if (!(await FX.confirm('Apagar rota?', 'Os tempos registrados nela também serão apagados.', 'Apagar', true))) return; Store.data.routes = Store.data.routes.filter((r) => r.id !== el.dataset.v); Store.save(); App.go('history'); },
    routeBoard: (el) => { const r = Store.data.routes.find((x) => x.id === el.dataset.v); const list = [...r.efforts].sort((a, b) => a.time - b.time); FX.modal(`<h3>${esc(r.name)}</h3><p class="muted">${Fmt.km(r.distance)} km · seus tempos</p><div class="list modal-list">${list.map((e, i) => `<div class="row"><span class="pos num ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><div class="grow"><b class="num">${Fmt.time(e.time)}</b><small>${new Date(e.date).toLocaleDateString('pt-BR')}</small></div><span class="num muted">${Fmt.pace(r.sport, r.distance / e.time)} ${Fmt.paceUnit(r.sport)}</span></div>`).join('')}</div><button class="btn ghost" data-m="ok">Fechar</button>`); },
    // equipamentos
    gearAdd: async (el) => {
      const type = el.dataset.v;
      const f = await FX.prompt(type === 'shoe' ? 'Novo tênis' : 'Nova bike', [['gName', 'Nome', 'text', '', type === 'shoe' ? 'ex.: Nike Pegasus 41' : 'ex.: Caloi Elite'], ['gKm', 'Quilometragem que já tem', 'number', '0']], 'Adicionar');
      if (!f || !f.gName) return;
      Gear.add(type, f.gName, f.gKm); UI.gear();
    },
    gearDefault: (el) => { Gear.setDefault(el.dataset.v); UI.gear(); },
    gearRetire: (el) => { const g = Gear.get(el.dataset.v); g.retired = !g.retired; if (g.retired) g.isDefault = false; Store.save(); UI.gear(); },
    // loja
    buy: async (el) => {
      const it = Shop.item(el.dataset.v);
      if (Store.data.coins < it.price) return FX.toast(`Faltam ${it.price - Store.data.coins} moedas. Bora treinar!`);
      if (!(await FX.confirm(`Comprar ${it.name}?`, `Custa ${it.price} moedas. Você tem ${Store.data.coins}.`, 'Comprar'))) return;
      Shop.buy(it.id); FX.beep(); if (it.cat === 'finish') FX.finish(); FX.toast(`${it.name} equipado!`); UI.progress();
    },
    equip: (el) => { const [c, id] = el.dataset.v.split(':'); Shop.equip(c, id || null); if (c === 'finish') FX.finish(); UI.progress(); },
    // planos
    planStart: async (el) => {
      const p = CONFIG.plans.find((x) => x.id === el.dataset.v);
      if (!(await FX.confirm(`Começar "${p.name}"?`, `${p.weeks} semanas, ${p.perWeek} treinos por semana. O plano começa nesta semana.`, 'Começar'))) return;
      Plans.start(p.id); App.sport = p.sport; if (p.sport === 'swim') App.swimMode = 'open'; App.mode = 'plan'; FX.toast('Plano ativado!'); UI.plans();
    },
    planStop: async () => { if (!(await FX.confirm('Abandonar plano?', 'O progresso deste plano será perdido.', 'Abandonar', true))) return; Store.data.plan = null; Store.save(); if (App.mode === 'plan') App.mode = 'free'; UI.plans(); },
    // estatísticas
    statsP: (el) => { App.statsP = el.dataset.v; UI.stats(); },
    statsS: (el) => { App.statsS = el.dataset.v; UI.stats(); },
    // privacidade
    privHome: (el) => {
      const set = (lat, lng) => { Object.assign(Store.data.privacy, { lat, lng, zone: true }); Store.save(); FX.toast('Zona de privacidade marcada'); UI.safety(); };
      if (el.dataset.v === 'last') { const a = [...Store.data.activities].reverse().find((x) => x.points && x.points.length); return a ? set(a.points[0][0], a.points[0][1]) : FX.toast('Nenhum treino com GPS ainda.'); }
      navigator.geolocation.getCurrentPosition((p) => set(p.coords.latitude, p.coords.longitude), () => FX.toast('Não consegui pegar sua localização.'), { enableHighAccuracy: true, timeout: 10000 });
    },
    // conta
    loginGoogle: async () => {
      const tc = $('#authTerms'); if (tc && !tc.checked) { const e = $('#authErr'); if (e) { e.textContent = 'Marque que você concorda com os Termos e a Política de Privacidade para continuar.'; e.hidden = false; } return; }
      // confere de novo na hora (o Google pode ter sido ativado depois que o app abriu)
      const st = await Cloud.loadSettings(true);
      if (st && st.loaded && !st.google) return FX.modal(`<div class="unlock"><div class="lock-anim">${I('lock')}</div><h3>Google ainda desligado</h3><p class="muted">O Supabase está respondendo que o login com Google não está ativo. Confira em Authentication → Sign In / Providers → Google se a chave está ligada e salva. Enquanto isso, entre com e-mail e senha.</p><button class="btn primary" data-m="ok">Usar e-mail</button></div>`);
      try { await Cloud.loginGoogle(); } catch (e) { FX.toast(Cloud.msg(e)); }
    },
    legal: (el) => Legal.show(el.dataset.v === 'terms' ? 'terms' : 'privacy'),
    deleteAccount: async () => {
      if (!(await FX.confirm('Excluir conta?', 'Isso apaga sua conta e TODOS os seus dados (treinos, amigos, ranking, territórios e foto) de forma definitiva. Não dá para desfazer.', 'Continuar', true))) return;
      const r = await FX.modal(`<h3>Confirme a exclusão</h3><p class="muted">Digite <b>EXCLUIR</b> para apagar sua conta para sempre.</p><label class="field"><input id="delConf" autocomplete="off" autocapitalize="characters" placeholder="EXCLUIR"></label><div class="row2"><button class="btn ghost" data-m="no">Cancelar</button><button class="btn danger" data-m="yes">Excluir tudo</button></div>`);
      if (r !== 'yes' || String((FX.form && FX.form.delConf) || '').trim().toUpperCase() !== 'EXCLUIR') return r === 'yes' ? FX.toast('Digite EXCLUIR para confirmar.') : null;
      try {
        await Cloud.deleteAccount();
        try { localStorage.removeItem('jg_authed'); } catch (e) {}
        App.setupData = null; App.setupStep = 0;
        FX.toast('Conta excluída.'); UI.welcome();
      } catch (e) { FX.toast(/function|schema cache|not found/i.test(String(e && e.message)) ? 'Exclusão ainda não ativada no servidor. Fale com o suporte.' : Cloud.msg(e)); }
    },
    authMode: (el) => { App.authMode = el.dataset.v; UI.account(); },
    pwToggle: (el) => { const i = $('#authPass'); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = I(show ? 'eye' : 'eyeOff'); },
    forgot: async () => {
      const f = await FX.prompt('Recuperar senha', [['fEmail', 'E-mail da conta', 'email', ($('#authEmail') && $('#authEmail').value) || '', 'voce@email.com']], 'Enviar link', 'Enviamos um link para você criar uma senha nova.');
      if (!f || !f.fEmail) return;
      try { await Cloud.resetPassword(f.fEmail.trim()); FX.modal(`<div class="unlock"><div class="lock-anim open">${I('mail')}</div><h3>Confira seu e-mail</h3><p class="muted">Se existir uma conta com <b>${esc(f.fEmail)}</b>, o link de recuperação chega em instantes. Olhe também o spam.</p><button class="btn primary" data-m="ok">Ok</button></div>`); }
      catch (e) { FX.toast(Cloud.msg(e)); }
    },
    logout: async () => { if (!(await FX.confirm('Sair da conta?', 'Seus dados continuam salvos neste aparelho e na nuvem.', 'Sair'))) return; await Cloud.logout(); try { localStorage.removeItem('jg_authed'); } catch (e) {} App.setupData = null; App.setupStep = 0; UI.welcome(); },
    profileSave: async () => {
      const u = $('#pfUser').value.trim(), n = $('#pfName').value.trim(), c = $('#pfCity').value.trim();
      if (u.length < 3) return FX.toast('Nome de usuário precisa de 3 letras ou mais.');
      try { await Cloud.saveProfile(u, n || 'Atleta', c); FX.toast('Perfil criado!'); App.go('social'); }
      catch (e) { FX.toast(/duplicate|unique/i.test(e.message) ? 'Esse nome de usuário já existe.' : 'Erro ao salvar o perfil.'); }
    },
    citySave: async () => { try { await Cloud.saveProfile(Cloud.me.username, Cloud.me.name, $('#pfCity2').value.trim()); FX.toast('Cidade salva'); } catch (e) { FX.toast('Erro ao salvar.'); } },
    syncNow: async () => { FX.toast('Sincronizando…'); await Cloud.pull(); await Cloud.push(); FX.toast('Tudo sincronizado'); UI.account(); },
    publishAll: async () => { FX.toast('Publicando treinos…'); try { await Cloud.publishAll(); FX.toast('Histórico publicado!'); } catch (e) { FX.toast('Erro ao publicar.'); } },
    // social
    rank: (el) => { const [k, v] = el.dataset.v.split(':'); App.rank[k] = v || null; UI.social(); },
    like: async (el) => {
      if (!Cloud.loggedIn()) return FX.toast('Entre na conta para curtir.');
      const on = el.dataset.on !== '1', n = el.querySelector('.num') || el.querySelector('span');
      // o mesmo treino pode aparecer em vários lugares da tela: atualiza todos
      document.querySelectorAll(`[data-act="like"][data-v="${el.dataset.v}"]`).forEach((b) => {
        b.dataset.on = on ? '1' : '0'; b.classList.toggle('on', on);
        const c = b.querySelector('.num'); if (c) c.textContent = Math.max(0, (+c.textContent || 0) + (on ? 1 : -1));
        if (on) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      });
      if (on) FX.vibrate([20]);
      try { await Cloud.like(el.dataset.v, on); } catch (e) { FX.toast('Não deu para curtir agora.'); }
    },
    shareProfile: async () => {
      const u = Cloud.me && Cloud.me.username, n = Store.data.profile.name || 'Atleta';
      const text = `Me segue no JustGo${u ? ': @' + u : ''}! Bora treinar e dominar a cidade 🏃‍♂️🚴`;
      if (!Native.on && navigator.share) { try { await navigator.share({ title: 'JustGo · ' + n, text }); return; } catch (e) { return; } }
      const v = await FX.modal(`<div class="m-ic">📣</div><h3>Compartilhar seu perfil</h3><p class="muted">Chame a galera para te seguir no JustGo.</p><div class="share-pv">${esc(text)}</div><div class="row2"><button class="btn ghost" data-m="copy">Copiar texto</button><button class="btn primary" data-m="wa">Enviar no WhatsApp</button></div>`);
      if (v === 'wa') { const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text); if (Native.on) Native.call('open', { url }); else window.open(url, '_blank'); }
      else if (v === 'copy') { try { await navigator.clipboard.writeText(text); FX.toast('Texto copiado!'); } catch (e) { FX.toast(text); } }
    },
    cpQuick: (el) => { const t = $('#' + el.dataset.t); if (!t) return; t.value = el.dataset.v; t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); },
    comments: async (el) => {
      const v = await UI.commentsSheet(el.dataset.v);
      if (v === 'send' && FX.form.cmText && FX.form.cmText.trim()) { await Cloud.comment(el.dataset.v, FX.form.cmText.trim()); const s = el.querySelector('span'); s.textContent = +s.textContent + 1; App.actions.comments(el); }
    },
    follow: async (el) => { await Cloud.follow(el.dataset.v); let fr = false; try { fr = (await Cloud.friendState(el.dataset.v)).friends; } catch (e) {} FX.toast(fr ? 'Vocês agora são amigos! 🤝' : 'Seguindo!'); App.refreshSocial(el.dataset.v); },
    unfollow: async (el) => { let fr = false; try { fr = (await Cloud.friendState(el.dataset.v)).friends; } catch (e) {} if (fr && !(await FX.confirm('Deixar de seguir?', 'Vocês deixam de ser amigos (desafios e Tocha são só entre amigos).', 'Deixar de seguir', true))) return; await Cloud.unfollow(el.dataset.v); App.refreshSocial(el.dataset.v); },
    raOpen: (el) => {
      if (!Cloud.loggedIn()) return;
      if (App.tab !== 'ract') App.raFrom = { tab: App.tab, uid: UI._uid, club: UI._clubId, y: window.scrollY };
      App.tab = 'ract'; App.nav = 'social'; UI.remote(el.dataset.v, el.dataset.cm === '1');
    },
    raBack: () => {
      const f = App.raFrom || { tab: 'social' }; App.raFrom = null;
      if (f.tab === 'user' && f.uid) { App.tab = 'user'; App.nav = 'social'; UI.user(f.uid); }
      else if (f.tab === 'club' && f.club) { App.tab = 'club'; App.nav = 'social'; UI.club(f.club); }
      else if (f.tab === 'notifs') App.go('notifs');
      else { App.go('social'); if (f.y) setTimeout(() => window.scrollTo(0, f.y), 900); }
    },
    raFocus: () => { const t = $('#raText'); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => t.focus(), 350); } },
    raFollow: async (el) => { try { await Cloud.follow(el.dataset.v); if (Cloud._fol) Cloud._fol.add(el.dataset.v); el.outerHTML = `<span class="badge">${I('check', 'xs')} Seguindo</span>`; FX.toast('Seguindo!'); } catch (e) { FX.toast('Não deu para seguir agora.'); } },
    raComment: async (el) => {
      const t = $('#raText'), v = t && t.value.trim(); if (!v) return t && t.focus();
      el.disabled = true;
      try { await Cloud.comment(el.dataset.v, v); t.value = ''; await UI.raComments(el.dataset.v); FX.vibrate([15]); } catch (e) { FX.toast('Não deu para comentar agora.'); }
      el.disabled = false;
    },
    raDelCm: async (el) => {
      if (await FX.modal('<h3>Apagar comentário?</h3><div class="row2"><button class="btn ghost" data-m="no">Cancelar</button><button class="btn primary" data-m="ok">Apagar</button></div>') !== 'ok') return;
      try { await Cloud.sb.from('comments').delete().eq('id', el.dataset.v); } catch (e) {}
      UI.raComments(el.dataset.a);
    },
    userOpen: (el) => { if (!Cloud.loggedIn()) return; App.tab = 'user'; App.nav = 'social'; UI.user(el.dataset.v); },
    clubCreate: async () => {
      const f = await FX.prompt('Criar clube', [['cName', 'Nome do clube', 'text', '', 'ex.: Corredores do Parque'], ['cGoal', 'Meta coletiva do mês (km)', 'number', '500']], 'Criar');
      if (!f || !f.cName) return;
      try { const c = await Cloud.createClub(f.cName, f.cGoal); FX.toast(`Clube criado! Código: ${c.invite_code}`); App.tab = 'club'; UI.club(c.id); } catch (e) { FX.toast('Erro ao criar o clube.'); }
    },
    clubJoin: async () => {
      const f = await FX.prompt('Entrar em um clube', [['cCode', 'Código de convite', 'text', '', 'ex.: K7P2QX']], 'Entrar');
      if (!f || !f.cCode) return;
      try { const id = await Cloud.joinClub(f.cCode); FX.toast('Você entrou no clube!'); App.tab = 'club'; UI.club(id); } catch (e) { FX.toast('Código não encontrado.'); }
    },
    clubOpen: (el) => { App.tab = 'club'; App.nav = 'social'; App.clubTab = 'rank'; UI._club = null; UI.club(el.dataset.v); },
    chalNew: (el) => {
      if (el && el.dataset && el.dataset.nf) return FX.toast('Desafios são entre amigos: vocês dois precisam se seguir.');
      App.chal = { to: (el && el.dataset && el.dataset.v) || null, sport: '', days: 7, q: '' };
      App.tab = 'chalPick'; App.nav = 'social'; UI.chalPick();
    },
    chpTo: (el) => { App.chal.to = App.chal.to === el.dataset.v ? null : el.dataset.v; UI.chalPickDraw(); },
    chpSport: (el) => { App.chal.sport = el.dataset.v; UI.chalPickDraw(); },
    chpDays: (el) => { App.chal.days = +el.dataset.v; UI.chalPickDraw(); },
    chpSend: async (el) => {
      const S = App.chal; if (!S || !S.to) return;
      el.disabled = true;
      try { await Cloud.challenge(S.to, S.sport || null, S.days); FX.vibrate([20, 40, 20]); FX.toast('Desafio enviado! 🔥'); App.sub.social = 'challenges'; App.go('social'); }
      catch (e) { el.disabled = false; FX.toast('Não deu para enviar o desafio.'); }
    },
    subTab2: (el) => { App.sub.social = el.dataset.v; App.go('social'); },
    followList2: (el) => { const [w, id] = el.dataset.v.split(':'); App.tab = 'followList'; App.nav = 'social'; UI.followList(w, id); },
    chalAnswer: async (el) => { const [id, ok] = el.dataset.v.split(':'); await Cloud.answerChallenge(id, ok === '1'); FX.toast(ok === '1' ? 'Desafio aceito. Valendo!' : 'Desafio recusado'); UI.social(); },
    copy: (el) => { try { navigator.clipboard.writeText(el.dataset.v); FX.toast('Copiado!'); } catch (e) { FX.toast(el.dataset.v); } },
    terrRefresh: async () => { FX.toast('Buscando disputas…'); try { UI._terrOwners = await Cloud.territoryOwners(Object.keys(Store.data.territory)); } catch (e) {} App.go('history'); },
    backup: () => FX.download(`justgo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(Store.data), 'application/json'),
    demo: () => App.demo(),
    reset: async () => {
      if (!(await FX.confirm('Apagar tudo?', 'Todos os treinos, XP, medalhas e desbloqueios serão apagados deste aparelho.', 'Apagar', true))) return;
      localStorage.removeItem(Store.key); Store.load(); Shop.apply(); UI.onboarding(0);
    },
    ob: (el) => UI.onboarding(+el.dataset.v),
    // entrada do app
    gateAuth: (el) => UI.authx(el.dataset.v),
    gateBack: () => UI.welcome(),
    gateLogout: async () => { try { await Cloud.logout(); } catch (e) {} try { localStorage.removeItem('jg_authed'); } catch (e) {} App.setupData = null; UI.welcome(); },
    suStep: (el) => UI.setup(Math.max(0, +el.dataset.v)),
    suSport: (el) => { const S = App.setupData, k = el.dataset.v, i = S.sports.indexOf(k); if (i >= 0) { if (S.sports.length > 1) S.sports.splice(i, 1); } else S.sports.push(k); el.classList.toggle('on', S.sports.includes(k)); FX.vibrate([12]); },
    suExp: (el) => { App.setupData.exp = el.dataset.v; document.querySelectorAll('.su-exp button').forEach((b) => b.classList.toggle('on', b === el)); },
    suGoal: (el) => { const S = App.setupData; S.goal = Math.max(1, Math.min(300, S.goal + (+el.dataset.v) * (S.goal >= 30 ? 5 : 1))); UI.setup(2); },
    suGoalSet: (el) => { App.setupData.goal = +el.dataset.v; UI.setup(2); },
    suNext: async () => {
      const S = App.setupData, step = App.setupStep || 0, err = $('#suErr'), btn = $('#suNext');
      const show = (m) => { err.textContent = m; err.hidden = false; };
      err.hidden = true;
      if (step === 0) {
        S.name = ($('#suName').value || '').trim(); S.user = ($('#suUser').value || '').trim(); S.city = ($('#suCity').value || '').trim();
        if (S.name.length < 2) return show('Digite seu nome.');
        if (S.user.length < 3) return show('O nome de usuário precisa de pelo menos 3 caracteres.');
        if (App.userOk === false) return show(`@${S.user} já está em uso. Tente outro.`);
        btn.disabled = true;
        try { await Cloud.saveProfile(S.user, S.name, S.city); }
        catch (e) { btn.disabled = false; return show(/duplicate|unique|23505/i.test(String(e.message || e.code || '')) || e.code === '23505' ? `@${S.user} já está em uso. Tente outro.` : Cloud.msg(e)); }
        return UI.setup(1);
      }
      if (step === 1) return UI.setup(2);
      const P = Store.data.profile;
      P.name = S.name || (Cloud.me && Cloud.me.name) || 'Atleta'; P.sports = S.sports.length ? S.sports : ['run']; P.experience = S.exp;
      P.goalWeek = S.goal; P.goalMonth = S.goal * 4; if (!(P.missionSports && P.missionSports.length)) P.missionSports = P.sports.slice(0, 2); if (S.city) P.city = S.city; P.onboarded = true; Store.save();
      try { Cloud.pushProfile(); } catch (e) {}
      App.sport = P.sports[0]; App.mode = 'free'; App.setupData = null; App.setupStep = 0;
      App.enterApp(true);
      FX.modal(`<div class="unlock"><div class="lock-anim open">${I('sparkles')}</div><span class="eyebrow">Tudo pronto</span><h3>Bem-vindo ao JustGo, ${esc(P.name.split(' ')[0])}!</h3><p class="muted">Suas 3 missões de hoje já estão valendo XP. Grave o primeiro treino para começar a subir de nível.</p><button class="btn primary" data-m="ok">Bora!</button></div>`);
    },
    obDone: () => {
      const P = Store.data.profile;
      P.name = $('#obName').value.trim() || 'Atleta';
      const sports = [...document.querySelectorAll('input[name=obSport]:checked')].map((i) => i.value);
      P.sports = sports.length ? sports : ['run'];
      P.experience = (document.querySelector('input[name=obExp]:checked') || {}).value || 'iniciante';
      P.goalWeek = Math.max(1, +$('#obGoal').value || 10); P.goalMonth = P.goalWeek * 4;
      P.onboarded = true; Store.save();
      App.sport = P.sports[0]; App.mode = 'free'; App.go('home');
      FX.toast('Perfil pronto! Suas 3 missões de hoje já estão valendo.');
    },
  },
  refreshSocial(id) {
    if (this.tab === 'user') return UI.user(id);
    if (this.tab === 'search') { const q = $('#searchQ'); return UI.searchResults(q ? q.value.trim() : ''); }
    UI.social();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

// o app Android (Flutter) conversa com estes objetos por window.X
window.App = App; window.FX = FX; window.UI = UI; window.Store = Store; window.View3D = View3D;
