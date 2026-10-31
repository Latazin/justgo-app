/* =========================================================
   JustGo — TELAS SOCIAIS E DE CONTA
   Feed, rankings, clubes, desafios, perfis públicos, login
   ========================================================= */
Object.assign(UI, {
  /* ---------- conta / nuvem ---------- */
  account() {
    let body;
    if (!Cloud.configured()) {
      body = `<div class="hero-ic">${I('cloud')}</div><h2 class="center">Nuvem e social</h2>
        <p class="muted center lead">Para login, sincronização entre aparelhos, amigos, clubes, rankings e território disputado, conecte um projeto gratuito do Supabase.</p>
        <section class="card steps"><ol>
          <li>Crie um projeto em <b>supabase.com</b> (plano grátis).</li>
          <li>Em <b>SQL Editor</b>, cole o arquivo <code>supabase/schema.sql</code> e clique em Run.</li>
          <li>Em <b>Authentication → Providers</b>, deixe E-mail ligado e, se quiser, ative o Google.</li>
          <li>Em <b>Authentication → URL Configuration</b>, coloque o endereço do seu site do Netlify.</li>
          <li>Em <b>Project Settings → API</b>, copie a URL e a chave <i>anon public</i> para <code>js/config.js</code>.</li>
        </ol></section>
        <p class="muted small center">Enquanto isso, tudo funciona neste aparelho: treinos, missões, desbloqueios, loja e card compartilhável.</p>`;
    } else if (!Cloud.ready) {
      body = '<div class="loading">Conectando…</div>';
    } else if (!Cloud.loggedIn()) {
      const mode = App.authMode || 'signin', st = Cloud.settings || {};
      const g = `<svg viewBox="0 0 24 24" class="ic"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`;
      body = `<div class="auth"><div class="auth-hero"></div>
        <div class="auth-head">${MARK('lg')}<h2>${mode === 'signup' ? 'Crie sua conta' : 'Entre no JustGo'}</h2><p class="muted">${mode === 'signup' ? 'Leva 10 segundos. Seus treinos ficam salvos na nuvem.' : 'Bom te ver de novo. Bora treinar?'}</p></div>
        <button class="btn google" data-act="loginGoogle">${g}Continuar com Google</button>
        <div class="or"><span>ou com e-mail</span></div>
        ${this.tabsBar([['signin', 'Entrar'], ['signup', 'Criar conta']], mode, 'authMode')}
        <form id="authForm" class="form" autocomplete="on">
          <label class="field"><span>E-mail</span><input id="authEmail" type="email" inputmode="email" autocomplete="email" placeholder="voce@email.com" required></label>
          <label class="field pw"><span>Senha</span><input id="authPass" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="${mode === 'signup' ? 'Mínimo de 6 caracteres' : 'Sua senha'}" minlength="6" required><button type="button" class="pw-eye" data-act="pwToggle" aria-label="Mostrar senha">${I('eyeOff')}</button></label>
          <div class="auth-err" id="authErr" hidden></div>
          <button type="submit" class="btn primary lg" id="authBtn">${mode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
        </form>
        ${mode === 'signin' ? '<button class="link center-link" data-act="forgot">Esqueci minha senha</button>' : '<p class="muted small center">Ao criar a conta, seus treinos deste aparelho vão junto.</p>'}
      </div>`;
    } else if (!Cloud.me || !Cloud.me.username) {
      body = `<h2>Complete seu perfil público</h2><p class="muted lead">É assim que seus amigos vão te encontrar.</p>
        <section class="card form">
          <label class="field"><span>Nome de usuário</span><input id="pfUser" placeholder="ex.: lucas.corre" value="${esc((Cloud.me && Cloud.me.username) || '')}"></label>
          <label class="field"><span>Nome</span><input id="pfName" value="${esc(Store.data.profile.name)}"></label>
          <label class="field"><span>Cidade</span><input id="pfCity" placeholder="ex.: Vitória" value="${esc((Cloud.me && Cloud.me.city) || '')}"></label>
          <button class="btn primary" data-act="profileSave">Salvar perfil</button>
        </section>`;
    } else {
      const me = Cloud.me;
      body = `<section class="prof">${this.avatar('lg')}<h1>${esc(me.name)}</h1><small>@${esc(me.username)}${me.city ? ' · ' + esc(me.city) : ''}</small><small>${esc(Cloud.user.email || '')}</small></section>
        <div class="list">
          <button class="row tap" data-act="syncNow">${this.iconBox('refresh')}<div class="grow"><b>Sincronizar agora</b><small>${Cloud.lastSync ? 'Última sincronização às ' + new Date(Cloud.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Envia e recebe seus dados'}</small></div></button>
          <button class="row tap" data-act="publishAll">${this.iconBox('upload')}<div class="grow"><b>Publicar treinos antigos</b><small>Leva o histórico deste aparelho para o feed e os rankings</small></div></button>
          <button class="row tap" data-act="userOpen" data-v="${Cloud.user.id}">${this.iconBox('user')}<div class="grow"><b>Ver meu perfil público</b><small>Como os outros te veem</small></div>${I('chevronRight', 'chev')}</button>
          <button class="row tap danger" data-act="logout">${this.iconBox('logout')}<div class="grow"><b>Sair da conta</b><small>Seus dados continuam neste aparelho</small></div></button>
        </div>
        <section class="card form"><label class="field"><span>Cidade (para o ranking local)</span><input id="pfCity2" value="${esc(me.city || '')}"></label><button class="btn ghost" data-act="citySave">Salvar cidade</button></section>`;
    }
    this.render(`${this.back('profile', 'Conta')}<main class="screen account">${body}</main>`);
  },

  /* ---------- aba Social ---------- */
  social() {
    const sub = App.sub.social;
    const tabs = this.tabsBar([['discover', 'Descobrir'], ['feed', 'Seguindo'], ['rank', 'Rankings'], ['clubs', 'Clubes'], ['challenges', 'Desafios']], sub, 'subTab');
    const searchBtn = Cloud.loggedIn() ? `<button class="icon-btn" data-act="go" data-v="search" title="Buscar atletas">${I('search')}</button>` : '';
    if (!Cloud.loggedIn()) {
      return this.render(`${this.header('Social')}<main class="screen">
        <section class="social-hero"><h2>Treine com a sua galera</h2><p>Siga amigos, curta e comente treinos, crie clubes, entre nos rankings da sua cidade e desafie quem quiser.</p></section>
        <button class="btn primary lg" data-act="go" data-v="account">${Cloud.configured() ? 'Entrar ou criar conta' : 'Como ativar o social'}</button>
        ${this.sectionHead('Já funciona sem conta')}
        <div class="list"><div class="row">${this.iconBox('share')}<div class="grow"><b>Card para Instagram e WhatsApp</b><small>Abra qualquer atividade e toque em Compartilhar</small></div></div>
        <div class="row">${this.iconBox('signal')}<div class="grow"><b>Enviar localização ao contato de confiança</b><small>Botão no topo da tela de treino</small></div></div></div>
      </main>`);
    }
    if (!Cloud.me || !Cloud.me.username) return App.go('account');
    this.render(`${this.header('Social', searchBtn)}<main class="screen">${tabs}<div id="socialBody"><div class="loading">Carregando…</div></div></main>`);
    const fill = (html) => { const el = $('#socialBody'); if (el) el.innerHTML = html; };
    const fail = (e) => { console.error(e); fill(`<div class="notice bad">${I('alert')}<div><b>Não foi possível carregar</b><small>${esc(e.message || 'Verifique a conexão e o schema do Supabase.')}</small></div></div>`); };
    if (sub === 'feed') this.socialFeed().then(fill).catch(fail);
    if (sub === 'discover') this.socialDiscover().then(fill).catch(fail);
    if (sub === 'rank') this.socialRank().then(fill).catch(fail);
    if (sub === 'clubs') this.socialClubs().then(fill).catch(fail);
    if (sub === 'challenges') this.socialChallenges().then(fill).catch(fail);
  },
  // um treino com dado estranho não derruba a lista inteira
  safePost(a, opts) { try { return this.remotePost(a, opts); } catch (e) { console.warn('post', a && a.id, e); return ''; } },
  remotePost(a, opts = {}) {
    const p = a.profiles || {}, name = esc(p.name || 'Atleta');
    const fol = opts.follow ? `<button class="react follow-btn" data-act="followHere" data-v="${a.user_id}">${I('plus')}Seguir</button>` : '';
    const footer = `<div class="post-foot"><button class="react ${a.liked ? 'on' : ''}" data-act="like" data-v="${a.id}" data-on="${a.liked ? 1 : 0}">${I('heart')}<span class="num">${a.likes || 0}</span></button><button class="react" data-act="raOpen" data-cm="1" data-v="${a.id}">${I('message')}<span class="num">${a.comments || 0}</span></button>${fol}</div>`;
    return this.postCard({ ...a, mode: null }, `<span data-act="userOpen" data-v="${a.user_id}">${name}</span>`, { route: a.route, avatar: this.avatarOf(p.name, p.frame, p.avatar, 'sm', p.photo), tap: 'raOpen', footer: opts.noFoot ? '' : footer, color: (CONFIG.sports[a.sport] || CONFIG.sports.run).color });
  },
  async socialFeed() {
    const list = await Cloud.feed();
    if (!list.length) return `<div class="empty">${I('users')}<h3>Seu feed está vazio</h3><p>Siga amigos para ver os treinos deles aqui. Seus próprios treinos também aparecem.</p>${Cloud.lastErr ? `<p class="muted small">Erro do servidor: ${esc(Cloud.lastErr)}</p>` : ''}<button class="btn primary" data-act="go" data-v="search">Buscar atletas</button></div>`;
    return list.map((a) => this.safePost(a)).join('');
  },
  async socialDiscover() {
    const list = await Cloud.discover();
    if (!list.length) return `<div class="empty">${I('compass')}<h3>Nada por aqui ainda</h3><p>Quando outros atletas publicarem treinos, eles aparecem aqui para você descobrir e seguir.</p>${Cloud.lastErr ? `<p class="muted small">Erro do servidor: ${esc(Cloud.lastErr)}</p>` : ''}</div>`;
    const city = Cloud.me && Cloud.me.city;
    return `<p class="muted small disc-note">${I('compass', 'xs')} Treinos públicos de todos os atletas${city ? ` · primeiro de ${esc(city)}` : ''}</p>${list.map((a) => this.safePost(a, { follow: !(Cloud._fol && Cloud._fol.has(a.user_id)) })).join('')}`;
  },
  async socialRank() {
    const R = App.rank || (App.rank = { period: 'week', scope: 'all', sport: null });
    const since = new Date(); since.setHours(0, 0, 0, 0);
    if (R.period === 'week') since.setTime(Game.weekStart(Date.now())); else if (R.period === 'month') since.setDate(1); else since.setMonth(0, 1);
    const rows = await Cloud.leaderboard({ since, sport: R.sport, scope: R.scope });
    const pill = (k, v, n, cur) => `<button class="pill-btn ${cur === v ? 'on' : ''}" data-act="rank" data-v="${k}:${v}">${n}</button>`;
    return `<div class="choice sport-filter">${pill('period', 'week', 'Semana', R.period)}${pill('period', 'month', 'Mês', R.period)}${pill('period', 'year', 'Ano', R.period)}</div>
      <div class="choice sport-filter">${pill('scope', 'all', 'Geral', R.scope)}${pill('scope', 'friends', 'Amigos', R.scope)}${pill('scope', 'city', Cloud.me.city ? esc(Cloud.me.city) : 'Minha cidade', R.scope)}</div>
      <div class="choice sport-filter">${pill('sport', '', 'Todos', R.sport || '')}${Object.entries(CONFIG.sports).map(([k, s]) => pill('sport', k, s.name, R.sport || '')).join('')}</div>
      ${R.scope === 'city' && !Cloud.me.city ? '<p class="muted small">Cadastre sua cidade em Perfil → Conta.</p>' : this.board(rows, (v) => Fmt.num(v) + ' km')}`;
  },
  async socialClubs() {
    const clubs = await Cloud.myClubs();
    return `<div class="row2"><button class="btn primary" data-act="clubCreate">${I('plus')}Criar clube</button><button class="btn ghost" data-act="clubJoin">${I('link')}Entrar com código</button></div>
      ${clubs.length ? `<div class="list">${clubs.map((c) => `<button class="row tap" data-act="clubOpen" data-v="${c.id}">${this.iconBox('users', 'var(--brand)')}<div class="grow"><b>${esc(c.name)}</b><small>Meta coletiva: ${c.goal_km} km/mês · código ${esc(c.invite_code)}</small></div>${I('chevronRight', 'chev')}</button>`).join('')}</div>`
        : `<div class="empty">${I('users')}<h3>Nenhum clube ainda</h3><p>Crie o clube da empresa, da igreja ou da assessoria e compartilhe o código.</p></div>`}`;
  },
  /* ---------- clube ---------- */
  async club(id) {
    this._clubId = id;
    const tab = App.clubTab || 'rank';
    this.render(`${this.back('social', 'Clube')}<main class="screen"><div id="clubBody" class="loading">Carregando…</div></main>`);
    try {
      const d = this._club && this._club.c.id === id && Date.now() - this._clubAt < 30000 ? this._club : await Cloud.clubFull(id);
      this._club = d; this._clubAt = Date.now();
      const pct = (d.total / (d.c.goal_km || 1)) * 100, top = d.wboard[0], me = Cloud.user.id;
      const mo = new Date(), days = new Date(mo.getFullYear(), mo.getMonth() + 1, 0).getDate() - mo.getDate() + 1;
      const tabs = this.tabsBar([['rank', 'Ranking'], ['members', `Membros · ${d.members.length}`], ['feed', 'Atividades']], tab, 'clubTab');
      let body = '';
      if (tab === 'members') body = `<div class="list">${d.members.map((m) => { const p = m.profiles || {}; return `<div class="row tap" data-act="userOpen" data-v="${m.user_id}">${this.avatarOf(p.name, p.frame, p.avatar, 'sm', p.photo)}<div class="grow"><b>${esc(p.name || 'Atleta')}${m.user_id === me ? ' (você)' : ''}</b><small>${p.username ? '@' + esc(p.username) : ''}${p.city ? ' · ' + esc(p.city) : ''}</small></div>${m.role === 'admin' ? '<span class="badge">Admin</span>' : ''}<b class="num">${Fmt.num(m.km)} km</b></div>`; }).join('')}</div>`;
      else if (tab === 'feed') body = d.acts.length ? d.acts.map((a) => this.safePost(a)).join('') : `<div class="empty compact">${I('activity')}<p>Os treinos dos membros aparecem aqui.</p></div>`;
      else body = `${this.board(d.board, (v) => Fmt.num(v) + ' km')}`;
      $('#clubBody').outerHTML = `<section class="club-hero"><span class="eyebrow">${d.members.length} membro${d.members.length > 1 ? 's' : ''} · código ${esc(d.c.invite_code)}</span><h2>${esc(d.c.name)}</h2>${d.c.description ? `<p class="muted">${esc(d.c.description)}</p>` : ''}
          <div class="club-goal"><div class="row-t"><b class="num">${Fmt.num(d.total)} <small>de ${d.c.goal_km} km no mês</small></b><small class="num">${Math.min(100, Math.round(pct))}%</small></div>${this.bar(pct, 'brand')}<small>${pct >= 100 ? 'Meta do mês batida! 🎉'.replace(' 🎉', '') : `Faltam ${Fmt.num(Math.max(0, d.c.goal_km - d.total))} km · ${days} dia${days > 1 ? 's' : ''} para acabar o mês`}</small></div>
          <div class="club-acts"><button class="btn primary sm" data-act="clubInvite">${I('userPlus')}Convidar</button><button class="btn ghost sm" data-act="copy" data-v="${esc(d.c.invite_code)}">${I('copy')}Copiar código</button>${d.admin ? `<button class="btn ghost sm" data-act="clubEdit">${I('settings')}Editar</button>` : `<button class="btn ghost sm" data-act="clubLeave">${I('logout')}Sair</button>`}</div></section>
        ${top ? `<section class="club-star"><div class="cs-ic">${I('crown')}</div><div class="grow"><span class="eyebrow">Destaque da semana</span><b>${esc(top.name)}</b><small class="num">${Fmt.num(Number(top.value))} km desde segunda</small></div></section>` : ''}
        ${tabs}${body}`;
    } catch (e) { console.error(e); const el = $('#clubBody'); if (el) el.textContent = 'Não foi possível abrir o clube.'; }
  },

  /* ---------- desafio em detalhe ---------- */
  async challenge(id) {
    this.render(`${this.back('social', 'Desafio')}<main class="screen"><div id="chalBody" class="loading">Carregando…</div></main>`);
    try {
      const { c, acts } = await Cloud.challengeDetail(id), me = Cloud.user.id;
      const P = [c.from_user === me ? c.a : c.b, c.from_user === me ? c.b : c.a].map((p, i) => ({ p: p || { name: 'Atleta' }, id: i === 0 ? me : (c.from_user === me ? c.to_user : c.from_user) }));
      P.forEach((x) => { const l = acts.filter((a) => a.user_id === x.id); x.km = l.reduce((s, a) => s + a.distance, 0) / 1000; x.n = l.length; x.t = l.reduce((s, a) => s + a.duration, 0); });
      const end = new Date(c.ends_at).getTime(), start = new Date(c.starts_at).getTime(), over = Date.now() > end;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 864e5)), tot = P[0].km + P[1].km || 1;
      const lead = P[0].km === P[1].km ? null : P[0].km > P[1].km ? 0 : 1;
      const spn = c.sport ? CONFIG.sports[c.sport].name : 'Qualquer esporte';
      // km por dia de cada um
      const nd = Math.max(1, Math.round((end - start) / 864e5)), perDay = P.map(() => Array(nd).fill(0));
      acts.forEach((a) => { const i = Math.min(nd - 1, Math.floor((Date.parse(a.start) - start) / 864e5)); const k = a.user_id === me ? 0 : 1; if (i >= 0) perDay[k][i] += a.distance / 1000; });
      const maxD = Math.max(0.1, ...perDay.flat());
      const status = over ? (lead == null ? 'Empate!' : lead === 0 ? 'Você venceu! 🏆'.replace(' 🏆', '') : `${esc(P[1].p.name)} venceu`) : lead == null ? 'Empatados' : lead === 0 ? `Você está na frente por ${Fmt.num(P[0].km - P[1].km)} km` : `${esc(P[1].p.name)} está na frente por ${Fmt.num(P[1].km - P[0].km)} km`;
      $('#chalBody').outerHTML = `<section class="duel"><span class="eyebrow">${spn} · ${c.days} dias · ${over ? 'encerrado' : `termina em ${left} dia${left === 1 ? '' : 's'}`}</span>
          <div class="duel-row">${P.map((x, i) => `<div class="duel-side ${lead === i ? 'lead' : ''}">${this.avatarOf(x.p.name, x.p.frame, x.p.avatar, 'lg', x.p.photo)}<b>${i === 0 ? 'Você' : esc(x.p.name)}</b><span class="num duel-km">${Fmt.num(x.km)}<small> km</small></span><small>${x.n} treino${x.n === 1 ? '' : 's'} · ${Fmt.time(x.t)}</small></div>${i === 0 ? '<div class="duel-vs">×</div>' : ''}`).join('')}</div>
          <div class="duel-bar"><i style="width:${(P[0].km / tot) * 100}%"></i></div><p class="duel-status">${status}</p></section>
        ${this.sectionHead('Dia a dia')}<section class="card duel-days">${perDay[0].map((_, i) => `<div class="dd"><div class="dd-bars"><i class="me" style="height:${Math.max(perDay[0][i] ? 6 : 2, (perDay[0][i] / maxD) * 100)}%"></i><i class="op" style="height:${Math.max(perDay[1][i] ? 6 : 2, (perDay[1][i] / maxD) * 100)}%"></i></div><small>${new Date(start + i * 864e5).toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</small></div>`).join('')}<div class="dd-leg"><span><i class="me"></i>Você</span><span><i class="op"></i>${esc(P[1].p.name)}</span></div></section>
        ${this.sectionHead('Treinos do desafio')}${acts.length ? `<div class="list">${acts.map((a) => { const mine = a.user_id === me, sp = CONFIG.sports[a.sport] || CONFIG.sports.run; return `<div class="row">${this.iconBox(sp.icon, sp.color)}<div class="grow"><b>${esc(a.title || sp.name)}</b><small>${mine ? 'Você' : esc(P[1].p.name)} · ${Fmt.date(Date.parse(a.start))}</small></div><b class="num">${Fmt.km(a.distance)} km</b></div>`; }).join('')}</div>` : `<div class="empty compact">${I('activity')}<p>Nenhum treino ainda. Quem sair primeiro sai na frente!</p></div>`}`;
    } catch (e) { console.error(e); const el = $('#chalBody'); if (el) el.textContent = 'Não foi possível abrir o desafio.'; }
  },

  /* ---------- notificações ---------- */
  async notifs() {
    this.render(`${this.back(App.backTo2 || 'home', 'Notificações')}<main class="screen"><div id="nBody" class="loading">Carregando…</div></main>`);
    let seen = 0; try { seen = +localStorage.getItem(Cloud.seenKey()) || 0; } catch (e) {}
    const list = await Cloud.refreshNotifs(true); Cloud.markSeen();
    const fol = new Set(await Cloud.following().catch(() => []));
    const ago = (t) => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
    const txt = (n) => ({ follow: 'começou a seguir você', like: `curtiu ${n.title ? `“${esc(n.title)}”` : 'seu treino'}`, comment: `comentou: “${esc((n.text || '').slice(0, 80))}”`, chal: 'desafiou você', chalOn: 'desafio aceito: valendo!', chalOk: 'aceitou seu desafio', zone: `roubou sua área de ${Zones.areaTxt(n.area || 0)}` })[n.k];
    const act = (n) => n.k === 'follow' ? `data-act="userOpen" data-v="${n.u.id}"` : n.k === 'like' || n.k === 'comment' ? `data-act="comments" data-v="${n.act}"` : n.k === 'zone' ? 'data-act="go" data-v="mapa"' : n.k === 'chal' ? 'data-act="sub" data-v="social:challenges"' : `data-act="chalOpen" data-v="${n.id}"`;
    const ic = { follow: 'userPlus', like: 'heart', comment: 'message', chal: 'swords', chalOn: 'swords', chalOk: 'swords', zone: 'flag' };
    const el = $('#nBody'); if (!el) return;
    el.outerHTML = list.length ? `<div class="list notif-list">${list.map((n) => `<div class="row tap notif ${n.t > seen ? 'new' : ''}" ${act(n)}><div class="n-av">${this.avatarOf(n.u.name, n.u.frame, n.u.avatar, 'sm', n.u.photo)}<i class="n-ic n-${n.k}">${I(ic[n.k], 'xs')}</i></div><div class="grow"><p><b>${esc(n.u.name || 'Atleta')}</b> ${txt(n)}</p><small>${ago(n.t)}</small></div>${n.k === 'follow' && !fol.has(n.u.id) ? `<button class="chip-btn sm primary-chip" data-act="followHere" data-v="${n.u.id}">Seguir de volta</button>` : ''}</div>`).join('')}</div>`
      : `<div class="empty">${I('bell')}<h3>Nenhuma notificação</h3><p>Quando alguém seguir você, curtir ou comentar seus treinos, aparece aqui.</p></div>`;
  },
  bellBadge() {
    const b = $('#bellBadge'); if (!b) return;
    const n = Cloud.unread || 0; b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
  },

  /* ---------- seguidores / seguindo ---------- */
  async followList(which, uid) {
    const id = uid || Cloud.user.id;
    this.render(`${this.back(uid && uid !== Cloud.user.id ? 'social' : 'profile', which === 'followers' ? 'Seguidores' : 'Seguindo')}<main class="screen"><div id="flBody" class="loading">Carregando…</div></main>`);
    try {
      const [rows, fol] = await Promise.all([Cloud.followList(id, which), Cloud.following()]);
      const el = $('#flBody'); if (!el) return;
      el.outerHTML = rows.length ? `<div class="list">${rows.map((r) => `<div class="row"><span class="tap" data-act="userOpen" data-v="${r.id}">${this.avatarOf(r.name, r.frame, r.avatar, 'sm', r.photo)}</span><div class="grow tap" data-act="userOpen" data-v="${r.id}"><b>${esc(r.name)}</b><small>${r.username ? '@' + esc(r.username) : ''}${r.city ? ' · ' + esc(r.city) : ''}</small></div>${r.id === Cloud.user.id ? '' : fol.includes(r.id) ? '<span class="badge">Seguindo</span>' : `<button class="chip-btn sm primary-chip" data-act="followHere" data-v="${r.id}">Seguir</button>`}</div>`).join('')}</div>`
        : `<div class="empty">${I('users')}<h3>${which === 'followers' ? 'Ainda sem seguidores' : 'Você ainda não segue ninguém'}</h3><p>${which === 'followers' ? 'Publique seus treinos para mais gente encontrar você.' : 'Veja o Descobrir no Social para encontrar atletas.'}</p></div>`;
    } catch (e) { const el = $('#flBody'); if (el) el.textContent = 'Não foi possível carregar.'; }
  },

  async socialChallenges() {
    const list = await Cloud.challenges(), me = Cloud.user.id;
    const row = (c) => {
      const mine = c.from_user === me, other = mine ? c.b : c.a, spn = c.sport ? CONFIG.sports[c.sport].name.toLowerCase() : 'qualquer esporte';
      const title = `${mine ? 'Você' : esc(c.a && c.a.name)} × ${mine ? esc(c.b && c.b.name) : 'você'}`;
      let right = '', sub = `${c.days} dias · ${spn}`;
      if (c.status === 'pending') right = mine ? '<span class="badge">Aguardando</span>' : `<div class="rr-act"><button class="chip-btn sm" data-act="chalAnswer" data-v="${c.id}:1">Aceitar</button><button class="chip-btn sm ghost-btn" data-act="chalAnswer" data-v="${c.id}:0">Recusar</button></div>`;
      else if (c.status === 'declined') right = '<span class="badge">Recusado</span>';
      else {
        const a = c.scores[me] || 0, b = c.scores[mine ? c.to_user : c.from_user] || 0;
        sub += c.over ? ' · encerrado' : ` · termina ${new Date(c.ends_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
        right = `<div class="vs num"><b class="${a >= b ? 'win' : ''}">${Fmt.num(a)}</b><span>×</span><b class="${b > a ? 'win' : ''}">${Fmt.num(b)}</b><small>km</small></div>`;
        if (c.over) sub += a > b ? ' · você venceu!' : a < b ? ` · ${esc(other && other.name)} venceu` : ' · empate';
      }
      const open = c.status === 'active';
      return `<div class="row ${open ? 'tap' : ''}" ${open ? `data-act="chalOpen" data-v="${c.id}"` : ''}>${this.iconBox('swords', 'var(--brand)')}<div class="grow"><b>${title}</b><small>${sub}</small></div>${right}${open ? I('chevronRight', 'chev') : ''}</div>`;
    };
    return `<button class="btn primary" data-act="chalNew">${I('swords')}Novo desafio</button>
      ${list.length ? `<div class="list">${list.map(row).join('')}</div>` : `<div class="empty">${I('swords')}<h3>Nenhum desafio</h3><p>Desafie um amigo que você segue: quem fizer mais km no período vence.</p></div>`}`;
  },

  /* ---------- busca e perfil público ---------- */
  search() {
    this.render(`${this.back('social', 'Buscar atletas')}<main class="screen"><label class="field search-f">${I('search')}<input id="searchQ" placeholder="Nome ou @usuário" autocomplete="off"></label><div id="searchRes"></div></main>`);
    setTimeout(() => $('#searchQ') && $('#searchQ').focus(), 50);
  },
  async searchResults(q) {
    const el = $('#searchRes'); if (!el) return;
    if (q.length < 2) { el.innerHTML = ''; return; }
    const [rows, fol] = await Promise.all([Cloud.search(q), Cloud.following()]);
    if ($('#searchQ') && $('#searchQ').value.trim() !== q) return;
    el.innerHTML = rows.length ? `<div class="list">${rows.filter((r) => r.id !== Cloud.user.id).map((r) => { const f = fol.includes(r.id); return `<div class="row"><span data-act="userOpen" data-v="${r.id}" class="tap">${this.avatarOf(r.name, r.frame, r.avatar, 'sm', r.photo)}</span><div class="grow tap" data-act="userOpen" data-v="${r.id}"><b>${esc(r.name)}</b><small>@${esc(r.username || '')}${r.city ? ' · ' + esc(r.city) : ''} · nível ${r.level}</small></div><button class="chip-btn sm ${f ? '' : 'primary-chip'}" data-act="${f ? 'unfollow' : 'follow'}" data-v="${r.id}">${f ? 'Seguindo' : 'Seguir'}</button></div>`; }).join('')}</div>` : '<p class="muted">Ninguém encontrado.</p>';
  },
  async user(id) {
    this._uid = id;
    this.render(`${this.back('social', 'Perfil')}<main class="screen"><div id="userBody" class="loading">Carregando…</div></main>`);
    try {
      const [d, fol] = await Promise.all([Cloud.profileOf(id), Cloud.following()]);
      const p = d.p, f = fol.includes(id), self = id === Cloud.user.id;
      const L0 = CONFIG.leagues.find((x) => x.id === p.league) || CONFIG.leagues[0];
      $('#userBody').outerHTML = `<section class="prof">${this.avatarOf(p.name, p.frame, p.avatar, 'lg', p.photo)}<h1>${esc(p.name)}</h1><small>@${esc(p.username || '')}${p.city ? ' · ' + esc(p.city) : ''} · nível ${p.level}</small>
        <span class="league-pill" style="--lc:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span>
        <div class="prof-stats"><div><b class="num">${Fmt.num(p.total_km, 0)}</b><small>Km totais</small></div><div><b class="num">${p.medals}</b><small>Medalhas</small></div><div><b class="num">${d.followers}</b><small>Seguidores</small></div><div><b class="num">${p.xp}</b><small>XP</small></div></div></section>
        ${self ? '' : `<div class="row2"><button class="btn ${f ? 'ghost' : 'primary'}" data-act="${f ? 'unfollow' : 'follow'}" data-v="${id}">${f ? 'Seguindo' : 'Seguir'}</button><button class="btn ghost" data-act="chalNew" data-v="${id}">${I('swords')}Desafiar</button></div>`}
        ${this.sectionHead('Atividades recentes')}${d.acts.length ? d.acts.map((a) => this.safePost(a, { noFoot: true })).join('') : '<p class="muted">Nenhuma atividade pública.</p>'}`;
    } catch (e) { $('#userBody').textContent = 'Perfil não encontrado.'; }
  },
  /* ---------- treino de outra pessoa: mapa, números, curtidas e comentários ---------- */
  async remote(id, toComments) {
    this.render(`<header class="top sub"><div class="top-l"><button class="back" data-act="raBack" aria-label="Voltar">${I('chevronLeft')}</button><b class="ttl">Treino</b></div><div class="top-r"></div></header>
      <main class="screen summary" id="raBody"><div class="loading">Carregando…</div></main>`);
    let a = null; try { a = await Cloud.activityOne(id); } catch (e) { console.warn(e); }
    const body = $('#raBody'); if (!body || App.tab !== 'ract') return;
    if (!a) { body.innerHTML = `<div class="empty">${I('lock')}<h3>Treino indisponível</h3><p>Ele pode ter sido apagado ou deixado privado.</p></div>`; return; }
    const p = a.profiles || {}, me = Cloud.user && Cloud.user.id, self = a.user_id === me, fol = Cloud._fol ? Cloud._fol.has(a.user_id) : null;
    const start = typeof a.start === 'string' ? Date.parse(a.start) : a.start, sp = CONFIG.sports[a.sport] || CONFIG.sports.run;
    const avg = a.duration ? a.distance / a.duration : 0, speed = Fmt.isSpeed(a.sport);
    const route = (a.route || []).filter((q) => q && q[0] != null), hasMap = route.length > 1;
    const more = [['Tempo total', Fmt.time(a.elapsed || a.duration)]];
    if (a.stats && a.stats.elev != null) more.push(['Ganho de elevação', `${a.stats.elev} m`]);
    if (a.duration && a.distance && !speed && a.sport !== 'swim') more.push(['Velocidade média', `${Fmt.num(avg * 3.6)} km/h`]);
    if (a.stats && a.stats.weather && a.stats.weather.temp != null) more.push(['Clima', `${Math.round(a.stats.weather.temp)}°C`]);
    if (a.xp) more.push(['XP ganho', `+${a.xp}`]);
    body.innerHTML = `
      <div class="post-h">${this.avatarOf(p.name, p.frame, p.avatar, 'sm', p.photo)}<div class="grow"><b data-act="userOpen" data-v="${a.user_id}">${esc(p.name || 'Atleta')}</b><small>${I(SPORT_IC[a.sport], 'xs')} ${sp.name} · ${Fmt.date(start)}</small></div>
        ${self || fol === null || fol ? '' : `<button class="chip-btn sm" data-act="raFollow" data-v="${a.user_id}">${I('plus')}Seguir</button>`}</div>
      <h1 class="act-title">${esc(this.actTitle(a))}</h1>
      <div class="big-stats"><div><span class="eyebrow">Distância</span><b class="num">${Fmt.km(a.distance)}</b><small>km</small></div><div><span class="eyebrow">${Fmt.paceLabel(a.sport, true)}</span><b class="num">${Fmt.pace(a.sport, avg)}</b><small>${Fmt.paceUnit(a.sport)}</small></div><div><span class="eyebrow">Tempo</span><b class="num">${Fmt.time(a.duration)}</b></div></div>
      ${hasMap ? `<div class="s-map-wrap"><div id="raMap" class="s-map"></div><button class="map3d-btn" data-act="view3d" data-v="${a.id}">${I('box3d')}Ver em 3D</button></div>` : a.stats && a.stats.pool ? `<div class="pool-art">${I('swim')}<b class="num">${Fmt.km(a.distance)} km</b><small>Natação na piscina</small></div>` : ''}
      <div class="ra-react"><button class="react ${a.liked ? 'on' : ''}" data-act="like" data-v="${a.id}" data-on="${a.liked ? 1 : 0}">${I('heart')}<span class="num">${a.likes || 0}</span></button>
        <button class="react" data-act="raFocus">${I('message')}<span class="num" id="raCmN">${a.comments || 0}</span></button>${self ? '' : `<button class="react" data-act="userOpen" data-v="${a.user_id}">${I('user')}Ver perfil</button>`}</div>
      <section class="card kvl">${more.map(([l, v]) => `<div><span>${l}</span><b class="num">${v}</b></div>`).join('')}</section>
      ${this.sectionHead('Comentários')}
      <div id="raCm" class="ra-cm"><div class="loading">Carregando…</div></div>
      <div class="ra-new"><textarea id="raText" maxlength="500" placeholder="Escreva um comentário… (dê os parabéns!)"></textarea><button class="btn primary" data-act="raComment" data-v="${a.id}">${I('send')}Enviar</button></div>`;
    if (hasMap) {
      const m = this.map('raMap');
      if (m) {
        const pts = route.map((q) => (q[4] ? [q[0], q[1], 0, null, 1] : [q[0], q[1], 0]));
        const line = this.routeLine(m, Geo.segments(pts), Shop.lineColor(a.sport), 5);
        this.endpoints(m, pts[0], pts[pts.length - 1]);
        const fit = () => { try { m.invalidateSize(); m.fitBounds(line.getBounds(), { padding: [28, 28] }); } catch (e) {} };
        fit(); setTimeout(fit, 300);
      }
    }
    await this.raComments(a.id);
    if (toComments) { const t = $('#raText'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  },
  async raComments(id) {
    const el = $('#raCm'); if (!el) return;
    let list = []; try { list = await Cloud.comments(id); } catch (e) {}
    const me = Cloud.user && Cloud.user.id;
    el.innerHTML = list.length ? list.map((c) => { const p = c.profiles || {}; return `<div class="ra-c">${this.avatarOf(p.name, p.frame, p.avatar, 'sm', p.photo)}<div class="grow"><div class="ra-c-h"><b data-act="userOpen" data-v="${c.user_id}">${esc(p.name || 'Atleta')}</b><small>${this.ago(Date.parse(c.created_at))}</small></div><p>${esc(c.text)}</p></div>${c.user_id === me ? `<button class="icon-btn sm" data-act="raDelCm" data-v="${c.id}" data-a="${id}" aria-label="Apagar">${I('trash')}</button>` : ''}</div>`; }).join('')
      : `<p class="muted small">Ninguém comentou ainda. Seja o primeiro!</p>`;
    const n = $('#raCmN'); if (n) n.textContent = list.length;
  },
  ago(t) {
    const s = (Date.now() - t) / 1000;
    if (!isFinite(s)) return '';
    if (s < 60) return 'agora'; if (s < 3600) return `${Math.floor(s / 60)} min`; if (s < 86400) return `${Math.floor(s / 3600)} h`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
    return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  },
  async commentsSheet(id) {
    const list = await Cloud.comments(id);
    const v = await FX.modal(`<h3>Comentários</h3><div class="comments">${list.length ? list.map((c) => `<div class="cm"><b>${esc(c.profiles ? c.profiles.name : 'Atleta')}</b><p>${esc(c.text)}</p><small>${new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') : '<p class="muted">Seja o primeiro a comentar.</p>'}</div>
      <textarea id="cmText" placeholder="Escreva um comentário… (dê os parabéns!)"></textarea><div class="row2"><button class="btn ghost" data-m="no">Fechar</button><button class="btn primary" data-m="send">Enviar</button></div>`);
    return v;
  },
});
