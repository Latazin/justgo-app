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
    const tabs = this.tabsBar([['feed', 'Feed'], ['rank', 'Rankings'], ['clubs', 'Clubes'], ['challenges', 'Desafios']], sub, 'subTab');
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
    if (sub === 'rank') this.socialRank().then(fill).catch(fail);
    if (sub === 'clubs') this.socialClubs().then(fill).catch(fail);
    if (sub === 'challenges') this.socialChallenges().then(fill).catch(fail);
  },
  remotePost(a, opts = {}) {
    const p = a.profiles || {}, name = esc(p.name || 'Atleta');
    const footer = `<div class="post-foot"><button class="react ${a.liked ? 'on' : ''}" data-act="like" data-v="${a.id}" data-on="${a.liked ? 1 : 0}">${I('heart')}<span class="num">${a.likes || 0}</span></button><button class="react" data-act="comments" data-v="${a.id}">${I('message')}<span class="num">${a.comments || 0}</span></button></div>`;
    return this.postCard({ ...a, mode: null }, `<span data-act="userOpen" data-v="${a.user_id}">${name}</span>`, { route: a.route, avatar: this.avatarOf(p.name, p.frame, p.avatar), noTap: true, footer: opts.noFoot ? '' : footer, color: CONFIG.sports[a.sport].color });
  },
  async socialFeed() {
    const list = await Cloud.feed();
    if (!list.length) return `<div class="empty">${I('users')}<h3>Seu feed está vazio</h3><p>Siga amigos para ver os treinos deles aqui. Seus próprios treinos também aparecem.</p><button class="btn primary" data-act="go" data-v="search">Buscar atletas</button></div>`;
    return list.map((a) => this.remotePost(a)).join('');
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
  async club(id) {
    this.render(`${this.back('social', 'Clube')}<main class="screen"><div id="clubBody" class="loading">Carregando…</div></main>`);
    try {
      const d = await Cloud.club(id), pct = (d.total / (d.c.goal_km || 1)) * 100;
      $('#clubBody').outerHTML = `<section class="card club-head"><span class="eyebrow">${d.members} membro${d.members > 1 ? 's' : ''}</span><h2>${esc(d.c.name)}</h2>
        <div class="week-n"><b class="num">${Fmt.num(d.total)}</b><span>de ${d.c.goal_km} km no mês</span></div>${this.bar(pct, 'brand')}
        <button class="chip-btn" data-act="copy" data-v="${esc(d.c.invite_code)}">${I('copy')}Código de convite: <b>${esc(d.c.invite_code)}</b></button></section>
        ${this.sectionHead('Ranking do mês')}${this.board(d.board, (v) => Fmt.num(v) + ' km')}`;
    } catch (e) { $('#clubBody').textContent = 'Não foi possível abrir o clube.'; }
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
      return `<div class="row">${this.iconBox('swords', 'var(--brand)')}<div class="grow"><b>${title}</b><small>${sub}</small></div>${right}</div>`;
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
    el.innerHTML = rows.length ? `<div class="list">${rows.filter((r) => r.id !== Cloud.user.id).map((r) => { const f = fol.includes(r.id); return `<div class="row"><span data-act="userOpen" data-v="${r.id}" class="tap">${this.avatarOf(r.name, r.frame, r.avatar)}</span><div class="grow tap" data-act="userOpen" data-v="${r.id}"><b>${esc(r.name)}</b><small>@${esc(r.username || '')}${r.city ? ' · ' + esc(r.city) : ''} · nível ${r.level}</small></div><button class="chip-btn sm ${f ? '' : 'primary-chip'}" data-act="${f ? 'unfollow' : 'follow'}" data-v="${r.id}">${f ? 'Seguindo' : 'Seguir'}</button></div>`; }).join('')}</div>` : '<p class="muted">Ninguém encontrado.</p>';
  },
  async user(id) {
    this.render(`${this.back('social', 'Perfil')}<main class="screen"><div id="userBody" class="loading">Carregando…</div></main>`);
    try {
      const [d, fol] = await Promise.all([Cloud.profileOf(id), Cloud.following()]);
      const p = d.p, f = fol.includes(id), self = id === Cloud.user.id;
      const L0 = CONFIG.leagues.find((x) => x.id === p.league) || CONFIG.leagues[0];
      $('#userBody').outerHTML = `<section class="prof">${this.avatarOf(p.name, p.frame, p.avatar, 'lg')}<h1>${esc(p.name)}</h1><small>@${esc(p.username || '')}${p.city ? ' · ' + esc(p.city) : ''} · nível ${p.level}</small>
        <span class="league-pill" style="--lc:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span>
        <div class="prof-stats"><div><b class="num">${Fmt.num(p.total_km, 0)}</b><small>Km totais</small></div><div><b class="num">${p.medals}</b><small>Medalhas</small></div><div><b class="num">${d.followers}</b><small>Seguidores</small></div><div><b class="num">${p.xp}</b><small>XP</small></div></div></section>
        ${self ? '' : `<div class="row2"><button class="btn ${f ? 'ghost' : 'primary'}" data-act="${f ? 'unfollow' : 'follow'}" data-v="${id}">${f ? 'Seguindo' : 'Seguir'}</button><button class="btn ghost" data-act="chalNew" data-v="${id}">${I('swords')}Desafiar</button></div>`}
        ${this.sectionHead('Atividades recentes')}${d.acts.length ? d.acts.map((a) => this.remotePost(a, { noFoot: true })).join('') : '<p class="muted">Nenhuma atividade pública.</p>'}`;
    } catch (e) { $('#userBody').textContent = 'Perfil não encontrado.'; }
  },
  async commentsSheet(id) {
    const list = await Cloud.comments(id);
    const v = await FX.modal(`<h3>Comentários</h3><div class="comments">${list.length ? list.map((c) => `<div class="cm"><b>${esc(c.profiles ? c.profiles.name : 'Atleta')}</b><p>${esc(c.text)}</p><small>${new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') : '<p class="muted">Seja o primeiro a comentar.</p>'}</div>
      <textarea id="cmText" placeholder="Escreva um comentário… (dê os parabéns!)"></textarea><div class="row2"><button class="btn ghost" data-m="no">Fechar</button><button class="btn primary" data-m="send">Enviar</button></div>`);
    return v;
  },
});
