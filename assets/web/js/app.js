/* =========================================================
   JustGo — APLICAÇÃO
   Navegação, fluxo do treino e ações dos botões (data-act)
   ========================================================= */
const App = {
  tab: 'home', nav: 'home',
  sub: { progress: 'missions', history: 'mine', social: 'discover', profile: 'overview' },
  sport: 'run', swimMode: 'pool', mode: 'free', preset: null, route: null,
  sim: false, simMult: 5,
  tracker: null, coach: null, routeLive: null, wl: null,

  // tela -> aba da barra inferior que fica acesa
  parents: { notifs: 'home', pro: 'profile', progress: 'profile', settings: 'profile', stats: 'profile', gear: 'profile', safety: 'profile', account: 'profile', plans: 'home', pool: 'record', swimSetup: 'record', search: 'social', user: 'social', ract: 'social', club: 'social', history: 'home', heatmap: 'home' },

  init() {
    Store.load();
    // 2.8.2: todos os treinos já feitos passam a ser públicos (uma vez)
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
      .map(([v, ic, n]) => v === 'record' ? `<button class="nav-rec" data-act="go" data-v="${v}" aria-label="${n}"><span class="rec-btn">${I(ic)}</span><span>${n}</span></button>` : `<button data-act="go" data-v="${v}">${I(ic)}<span>${n}</span></button>`).join('');
    // título pequeno no topo aparece ao rolar
    window.addEventListener('scroll', () => { const t = document.querySelector('.top'); if (t) t.classList.toggle('scrolled', window.scrollY > 36); }, { passive: true });

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (el && this.actions[el.dataset.act]) { e.preventDefault(); this.actions[el.dataset.act](el, e); }
    });
    document.addEventListener('change', (e) => this.onChange(e));
    document.addEventListener('submit', (e) => { if (e.target.id === 'authForm') { e.preventDefault(); this.auth(); } });
    document.addEventListener('input', (e) => {
      if (e.target.id === 'searchQ') { clearTimeout(this._sq); const q = e.target.value.trim(); this._sq = setTimeout(() => UI.searchResults(q).catch(() => {}), 300); }
    });
    document.addEventListener('visibilitychange', () => {
      const tr = this.tracker; if (!tr || tr.state === 'done') return;
      if (document.visibilityState === 'visible') { this.wake(); tr.wakeUp(); Background.update(); }
      else Store.saveLive(tr.snapshot()); // salva antes do navegador congelar
    });
    window.addEventListener('pagehide', () => { if (this.tracker && this.tracker.state !== 'done') Store.saveLive(this.tracker.snapshot()); });
    window.addEventListener('beforeunload', (e) => { if (this.tracker && this.tracker.state !== 'done') { e.preventDefault(); e.returnValue = ''; } });

    Cloud.init().then(() => this.onCloudReady());
    try { const lv = localStorage.getItem('justgo_ver'); if (lv && lv !== CONFIG.version) setTimeout(() => FX.toast(`JustGo atualizado para a versão ${CONFIG.version}`), 1500); localStorage.setItem('justgo_ver', CONFIG.version); } catch (e) {}
    setTimeout(() => { const sp = $('#splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); } }, 650);
    Geo.locate(false); // se a localização já foi permitida, atualiza a cidade
    if (!Store.data.profile.onboarded) return UI.onboarding(0);
    this.go('home');
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
    btn.disabled = true; btn.textContent = mode === 'signup' ? 'Criando conta…' : 'Entrando…';
    try {
      if (mode === 'signup') {
        const r = await Cloud.signUp(email, pass);
        if (!r.session) {
          btn.disabled = false; btn.textContent = 'Criar conta';
          return FX.modal(`<div class="unlock"><div class="lock-anim open">${I('mail')}</div><h3>Confirme seu e-mail</h3><p class="muted">Enviamos um link para <b>${esc(email)}</b>. Depois de confirmar, é só entrar com sua senha.</p><button class="btn primary" data-m="ok">Ok</button></div>`).then(() => { this.authMode = 'signin'; UI.account(); });
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
  onCloudReady() { setTimeout(() => Cloud.backfill().catch(() => {}), 3000); setTimeout(() => Zones.recheck().catch(() => {}), 6000); if (!Store.data.profile.onboarded) return; if (['home', 'progress', 'social', 'profile', 'history', 'account', 'mapa'].includes(this.tab) && !this.tracker) this.go(this.tab); },
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
    if (Game.has('voice') && !this.coach) {
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
    if (Game.has('voice') && !(this.coach && !this.coach.done)) {
      const pace = Fmt.isSpeed(tr.sport) ? `velocidade média de ${Math.round((tr.distance / (tr.moving / 1000)) * 3.6)} quilômetros por hora` : `ritmo do último quilômetro: ${FX.spokenTime(t)}`;
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
      const el = $('#sWeather'); if (el) el.innerHTML = `${I(w.weather.rain >= 0.2 ? 'cloudRain' : 'cloud', 'xs')} ${w.weather.temp}°C`;
      if (w.medal) { FX.toast('Medalha: Treino na chuva!'); FX.beep([659, 784, 988]); }
    });
    Cloud.publish(act).catch(() => {});
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
  // recorta a foto em quadrado, reduz para 320 px (≈25 KB) e envia
  async setPhoto(file) {
    if (!/^image\//.test(file.type || 'image/')) return FX.toast('Escolha uma imagem.');
    FX.toast('Preparando a foto…');
    let img;
    try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }).catch(() => null); }
    if (!img) return FX.toast('Não deu para abrir essa imagem.');
    const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
    const w = img.width, h = img.height, m = Math.min(w, h), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, S, S);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    const P = Store.data.profile;
    P.photo = c.toDataURL('image/jpeg', 0.7); Store.save(); // aparece na hora, mesmo sem internet
    if (!this.tracker) this.go(this.tab);
    if (!Cloud.loggedIn()) return FX.toast('Foto salva neste aparelho. Entre na conta para os outros verem.');
    try { P.photo = await Cloud.uploadPhoto(blob); Store.save(); FX.toast('Foto de perfil atualizada!'); }
    catch (e) {
      console.warn('foto', e);
      FX.toast(/bucket|not found|column|photo/i.test(String(e && (e.message || e.error))) ? 'Falta configurar as fotos no Supabase (SQL do avatars).' : 'Não deu para enviar a foto agora. Ela ficou salva neste aparelho.');
    }
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
    else if (t.dataset.pref) { P[t.dataset.pref] = t.checked; Store.save(); FX.toast(t.checked ? 'Ativado' : 'Desativado'); }
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
    mapLayer: (el) => { const L0 = App.mapLayers; L0[el.dataset.v] = !L0[el.dataset.v]; el.classList.toggle('on', L0[el.dataset.v]); UI.mapaDraw(); },
    mapCenter: () => {
      if (!('geolocation' in navigator)) return;
      FX.toast('Buscando sua posição…');
      navigator.geolocation.getCurrentPosition((p) => { Geo.remember(p.coords.latitude, p.coords.longitude); UI.mapa(); }, () => FX.toast('Permita a localização para ver o mapa da sua região.'), { enableHighAccuracy: true, timeout: 15000 });
    },
    followHere: async (el) => {
      try { await Cloud.follow(el.dataset.v); } catch (e) {}
      document.querySelectorAll(`[data-act=followHere][data-v="${el.dataset.v}"]`).forEach((b) => { b.outerHTML = `<span class="react followed">${I('check')}Seguindo</span>`; });
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
    profTab: (el) => { App.sub.profile = el.dataset.v; UI.profile(); },
    setPref: (el) => {
      const [k, v] = el.dataset.v.split(':'), P = Store.data.profile;
      P[k] = v; if (k === 'theme') { Store.data.equipped.theme = null; Shop.apply(); }
      Store.save(); UI.settings();
    },
    photoRemove: async () => {
      const P = Store.data.profile; delete P.photo; Store.save();
      if (Cloud.loggedIn()) Cloud.removePhoto().catch(() => {});
      FX.toast('Foto removida'); App.go(App.tab);
    },
    photoPick: () => { const i = $('#photoIn'); if (i) i.click(); },
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
    pause: () => { App.tracker.pause(); Background.pause(); UI.trainButtons(); UI.updateTraining(); if (Game.has('voice')) FX.say('Treino pausado'); },
    resume: () => { App.tracker.resume(); Background.resume(); UI.trainButtons(); if (Game.has('voice')) FX.say('Retomando'); },
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
      // confere de novo na hora (o Google pode ter sido ativado depois que o app abriu)
      const st = await Cloud.loadSettings(true);
      if (st && st.loaded && !st.google) return FX.modal(`<div class="unlock"><div class="lock-anim">${I('lock')}</div><h3>Google ainda desligado</h3><p class="muted">O Supabase está respondendo que o login com Google não está ativo. Confira em Authentication → Sign In / Providers → Google se a chave está ligada e salva. Enquanto isso, entre com e-mail e senha.</p><button class="btn primary" data-m="ok">Usar e-mail</button></div>`);
      try { await Cloud.loginGoogle(); } catch (e) { FX.toast(Cloud.msg(e)); }
    },
    authMode: (el) => { App.authMode = el.dataset.v; UI.account(); },
    pwToggle: (el) => { const i = $('#authPass'); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = I(show ? 'eye' : 'eyeOff'); },
    forgot: async () => {
      const f = await FX.prompt('Recuperar senha', [['fEmail', 'E-mail da conta', 'email', ($('#authEmail') && $('#authEmail').value) || '', 'voce@email.com']], 'Enviar link', 'Enviamos um link para você criar uma senha nova.');
      if (!f || !f.fEmail) return;
      try { await Cloud.resetPassword(f.fEmail.trim()); FX.modal(`<div class="unlock"><div class="lock-anim open">${I('mail')}</div><h3>Confira seu e-mail</h3><p class="muted">Se existir uma conta com <b>${esc(f.fEmail)}</b>, o link de recuperação chega em instantes. Olhe também o spam.</p><button class="btn primary" data-m="ok">Ok</button></div>`); }
      catch (e) { FX.toast(Cloud.msg(e)); }
    },
    logout: async () => { if (!(await FX.confirm('Sair da conta?', 'Seus dados continuam salvos neste aparelho e na nuvem.', 'Sair'))) return; await Cloud.logout(); App.go('profile'); },
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
      const on = el.dataset.on !== '1', n = el.querySelector('span');
      el.dataset.on = on ? '1' : '0'; el.classList.toggle('on', on); n.textContent = +n.textContent + (on ? 1 : -1);
      if (on) FX.vibrate([20]);
      try { await Cloud.like(el.dataset.v, on); } catch (e) {}
    },
    comments: async (el) => {
      const v = await UI.commentsSheet(el.dataset.v);
      if (v === 'send' && FX.form.cmText && FX.form.cmText.trim()) { await Cloud.comment(el.dataset.v, FX.form.cmText.trim()); const s = el.querySelector('span'); s.textContent = +s.textContent + 1; App.actions.comments(el); }
    },
    follow: async (el) => { await Cloud.follow(el.dataset.v); FX.toast('Seguindo!'); App.refreshSocial(el.dataset.v); },
    unfollow: async (el) => { await Cloud.unfollow(el.dataset.v); App.refreshSocial(el.dataset.v); },
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
    chalNew: async (el) => {
      let to = el.dataset.v;
      if (!to) {
        const ids = await Cloud.following();
        if (!ids.length) return FX.toast('Siga alguém primeiro para poder desafiar.');
        const { data } = await Cloud.sb.from('profiles').select('id,name,username').in('id', ids);
        const f0 = await FX.prompt('Desafiar quem?', [['chTo', 'Amigo', 'select', (data || []).map((p) => `<option value="${p.id}">${esc(p.name)} (@${esc(p.username || '')})</option>`).join('')]], 'Continuar');
        if (!f0) return; to = f0.chTo;
      }
      const f = await FX.prompt('Novo desafio', [['chSport', 'Esporte', 'select', `<option value="">Qualquer esporte</option>${Object.entries(CONFIG.sports).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('')}`], ['chDays', 'Duração', 'select', [3, 7, 14, 30].map((d) => `<option value="${d}" ${d === 7 ? 'selected' : ''}>${d} dias</option>`).join('')]], 'Desafiar', 'Vence quem somar mais quilômetros no período.');
      if (!f) return;
      try { await Cloud.challenge(to, f.chSport || null, f.chDays); FX.toast('Desafio enviado!'); App.sub.social = 'challenges'; App.go('social'); } catch (e) { FX.toast('Erro ao enviar o desafio.'); }
    },
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
