/* =========================================================
   JustGo — SOCIAL v2 (visual profissional)
   Substitui as telas da aba Social: abas em pílulas, faixa de
   "quem treinou agora", posts no estilo rede social, sugestões
   de atletas, pódio nos rankings, desafios em formato de duelo,
   tela própria para criar desafio, clubes em cartões e perfil
   público com capa.
   ========================================================= */
Object.assign(UI, {
  _people: {},
  keep(p) { if (p && p.id) this._people[p.id] = { ...(this._people[p.id] || {}), ...p }; return p; },
  hue(s) { let h = 0; String(s || '').split('').forEach((c) => (h = (h * 31 + c.charCodeAt(0)) >>> 0)); return 200 + (h % 130); }, // azul → roxo → rosa
  rel(t) {
    const s = (Date.now() - t) / 1000; if (!isFinite(s)) return '';
    if (s < 60) return 'agora'; if (s < 3600) return `há ${Math.floor(s / 60)} min`; if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    if (s < 2 * 86400) return 'ontem'; if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} dias`;
    return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  },
  SOC_TABS: [['discover', 'Descobrir', 'compass'], ['feed', 'Seguindo', 'users'], ['rank', 'Rankings', 'trophy'], ['challenges', 'Desafios', 'swords'], ['clubs', 'Clubes', 'shield'], ['torch', 'Tocha', 'flame']],

  social() {
    const sub = App.sub.social || 'discover';
    if (!Cloud.loggedIn()) {
      return this.render(`${this.header('Social')}<main class="screen soc">
        <section class="soc-hero"><div class="sh-art">${['#1F6BFF', '#12B886', '#F97316', '#EC4899'].map((c, i) => `<span style="--c:${c};--i:${i}">${I(['run', 'bike', 'flame', 'heart'][i])}</span>`).join('')}</div>
          <h2>Treine com a sua galera</h2><p>Siga amigos, curta e comente treinos, entre nos rankings da cidade, desafie quem quiser e passe a Tocha adiante.</p>
          <button class="btn primary lg" data-act="go" data-v="account">${Cloud.configured() ? 'Entrar ou criar conta' : 'Como ativar o social'}</button></section>
      </main>`);
    }
    if (!Cloud.me || !Cloud.me.username) return App.go('account');
    const right = `<button class="icon-btn" data-act="go" data-v="search" title="Buscar atletas">${I('search')}</button><button class="icon-btn" data-act="followList" data-v="friends" title="Amigos">${I('users')}</button>`;
    const tabs = `<nav class="soc-tabs">${this.SOC_TABS.map(([k, n, ic]) => `<button class="${k === sub ? 'on' : ''}" data-act="subTab" data-v="${k}">${I(ic, 'xs')}<span>${n}</span></button>`).join('')}</nav>`;
    this.render(`${this.header('Social', right)}<main class="screen soc">
      ${sub === 'discover' || sub === 'feed' ? '<div id="socStories" class="soc-stories"></div>' : ''}
      ${tabs}<div id="socialBody">${this.skel(sub)}</div></main>`);
    const tb = $('.soc-tabs .on'), bar = $('.soc-tabs'); if (tb && bar) bar.scrollLeft = Math.max(0, tb.offsetLeft - bar.clientWidth / 2 + tb.offsetWidth / 2);
    const fill = (html) => { const el = $('#socialBody'); if (el) el.innerHTML = html; };
    const fail = (e) => { console.error(e); fill(`<div class="notice bad">${I('alert')}<div><b>Não foi possível carregar</b><small>${esc(e.message || 'Verifique a conexão.')}</small></div></div>`); };
    const fn = { feed: 'socialFeed', discover: 'socialDiscover', rank: 'socialRank', clubs: 'socialClubs', challenges: 'socialChallenges', torch: 'socialTorch' }[sub] || 'socialDiscover';
    this[fn]().then(fill).catch(fail);
    if (sub === 'discover' || sub === 'feed') this.socStories();
  },
  skel(sub) {
    const post = '<div class="sk-post"><div class="sk-h"><i class="sk-c"></i><div><i class="sk-l w60"></i><i class="sk-l w40"></i></div></div><i class="sk-l w80"></i><i class="sk-box"></i></div>';
    return sub === 'rank' || sub === 'challenges' || sub === 'clubs' || sub === 'torch' ? '<div class="sk-list">' + '<i class="sk-row"></i>'.repeat(5) + '</div>' : post + post;
  },

  /* ---------- faixa "quem treinou agora" ---------- */
  async socStories() {
    const el = $('#socStories'); if (!el) return;
    let list = [];
    try { list = await Cloud.storyRow(); } catch (e) {}
    if (!$('#socStories')) return;
    const me = Store.data.profile, myLast = [...Store.data.activities].sort((a, b) => b.start - a.start)[0];
    const meCard = `<button class="st" data-act="${myLast ? 'detail' : 'go'}" data-v="${myLast ? myLast.id : 'record'}"><span class="st-ring me">${this.avatar('st')}${myLast ? '' : `<i class="st-plus">${I('plus', 'xs')}</i>`}</span><small>Você</small></button>`;
    el.innerHTML = meCard + list.map((a) => { const p = this.keep({ id: a.user_id, ...(a.profiles || {}) }), sp = CONFIG.sports[a.sport] || CONFIG.sports.run, fresh = Date.now() - Date.parse(a.start) < 24 * 3600e3;
      return `<button class="st" data-act="raOpen" data-v="${a.id}"><span class="st-ring ${fresh ? 'fresh' : ''}" style="--c:${sp.color}">${this.avatarOf(p.name, p.frame, p.avatar, 'st', p.photo)}<i class="st-sp" style="--c:${sp.color}">${I(sp.icon, 'xs')}</i></span><small>${esc((p.name || 'Atleta').split(' ')[0])}</small><em class="num">${Fmt.km(a.distance, 1)} km</em></button>`; }).join('');
    if (!list.length) el.innerHTML += `<div class="st-empty"><small>Quando seus amigos treinarem, eles aparecem aqui.</small></div>`;
  },

  /* ---------- post (treino de outra pessoa) ---------- */
  remotePost(a, opts = {}) {
    const p = this.keep({ id: a.user_id, ...(a.profiles || {}) }), sp = CONFIG.sports[a.sport] || CONFIG.sports.run;
    const t = typeof a.start === 'string' ? Date.parse(a.start) : a.start, avg = a.duration ? a.distance / a.duration : 0;
    const route = (a.route || []).filter((q) => q && q[0] != null), color = Shop.lineColor(a.sport);
    const map = route.length > 1 ? `<div class="post-map" data-color="${color}" data-route='${JSON.stringify(this.thinRoute(route.map((q) => (q[4] ? [q[0], q[1], 0, null, 1] : [q[0], q[1], 0]))))}'>${this.routeSVG(route.map((q) => [q[0], q[1], 0]), color)}</div>` : a.stats && a.stats.pool ? `<div class="post-map pool">${I('swim')}<span>Natação na piscina</span></div>` : '';
    const media = this.mediaHtml(map, this.photosOf(a));
    const elev = a.stats && a.stats.elev, cells = [['Distância', `${Fmt.km(a.distance)}<small> km</small>`], [Fmt.isSpeed(a.sport) ? 'Vel. média' : 'Ritmo', `${Fmt.pace(a.sport, avg)}<small> ${Fmt.isSpeed(a.sport) ? 'km/h' : a.sport === 'swim' ? '/100m' : '/km'}</small>`], ['Tempo', Fmt.time(a.duration)]];
    if (elev >= 10) cells.push(['Subida', `${elev}<small> m</small>`]);
    const fol = opts.follow && a.user_id !== (Cloud.user && Cloud.user.id) ? `<button class="sp-follow" data-act="followHere" data-v="${a.user_id}">Seguir</button>` : '';
    const counts = (a.likes || a.comments) ? `<div class="sp-counts">${a.likes ? `<span>${I('heart', 'xs')} ${a.likes} ${a.likes === 1 ? 'curtida' : 'curtidas'}</span>` : ''}${a.comments ? `<span>${a.comments} ${a.comments === 1 ? 'comentário' : 'comentários'}</span>` : ''}</div>` : '';
    return `<article class="sp-post">
      <header class="sp-h"><button class="sp-av" data-act="userOpen" data-v="${a.user_id}">${this.avatarOf(p.name, p.frame, p.avatar, 'sm', p.photo)}</button>
        <div class="grow"><b data-act="userOpen" data-v="${a.user_id}">${esc(p.name || 'Atleta')}${UI.vb(a.user_id, p.username)}</b><small><span class="sp-sport" style="--c:${sp.color}">${I(sp.icon, 'xs')}</span>${sp.name} · ${this.rel(t)}${p.city ? ` · ${esc(p.city)}` : ''}</small></div>${fol}</header>
      <div class="sp-body tap" data-act="raOpen" data-v="${a.id}"><h3>${esc(this.actTitle(a))}</h3>
        <div class="sp-stats c${cells.length}">${cells.map(([l, v]) => `<div><span>${l}</span><b class="num">${v}</b></div>`).join('')}</div></div>
      ${media ? `<div class="sp-media tap" data-act="raOpen" data-v="${a.id}">${media}</div>` : ''}
      ${opts.noFoot ? '' : `<div class="sp-bar"><button class="sp-btn sp-like ${a.liked ? 'on' : ''}" data-act="like" data-v="${a.id}" data-on="${a.liked ? 1 : 0}" aria-label="Curtir">${I('heart')}<span class="num">${a.likes || 0}</span></button><button class="sp-btn" data-act="raOpen" data-cm="1" data-v="${a.id}" aria-label="Comentar">${I('message')}<span class="num">${a.comments || 0}</span></button><button class="sp-btn sp-see" data-act="raOpen" data-v="${a.id}">Ver treino${I('chevronRight')}</button></div>`}
    </article>`;
  },

  async socialFeed() {
    const list = await Cloud.feed();
    if (!list.length) return `<div class="soc-empty">${I('users')}<h3>Seu feed ainda está vazio</h3><p>Siga atletas para ver os treinos deles aqui. Que tal começar pelo Descobrir?</p><div class="row2"><button class="btn primary" data-act="subTab" data-v="discover">Descobrir atletas</button><button class="btn ghost" data-act="go" data-v="search">${I('search')} Buscar</button></div></div>`;
    return list.map((a) => this.safePost(a)).join('');
  },

  async socialDiscover() {
    const list = await Cloud.discover();
    if (!list.length) return `<div class="soc-empty">${I('compass')}<h3>Nada por aqui ainda</h3><p>Quando outros atletas publicarem treinos, eles aparecem aqui para você descobrir e seguir.</p>${Cloud.lastErr ? `<p class="muted small">Erro do servidor: ${esc(Cloud.lastErr)}</p>` : ''}</div>`;
    // atletas para seguir: quem aparece no Descobrir e você ainda não segue
    const seen = new Set(), sug = [];
    list.forEach((a) => { if (seen.has(a.user_id) || (Cloud._fol && Cloud._fol.has(a.user_id))) return; seen.add(a.user_id); const km = list.filter((x) => x.user_id === a.user_id).reduce((s, x) => s + x.distance, 0); sug.push({ a, km }); });
    const city = Cloud.me && Cloud.me.city;
    const sugHtml = sug.length ? `<div class="soc-sec"><h2>Atletas para seguir</h2>${city ? `<small>${I('mapPin', 'xs')} ${esc(city)} primeiro</small>` : ''}</div>
      <div class="sug-strip">${sug.slice(0, 12).map(({ a, km }) => { const p = this.keep({ id: a.user_id, ...(a.profiles || {}) }), sp = CONFIG.sports[a.sport] || CONFIG.sports.run; return `<div class="sug">
        <button class="sug-av" data-act="userOpen" data-v="${a.user_id}" style="--h:${this.hue(a.user_id)}">${this.avatarOf(p.name, p.frame, p.avatar, 'md', p.photo)}</button>
        <b data-act="userOpen" data-v="${a.user_id}">${esc((p.name || 'Atleta').split(' ').slice(0, 2).join(' '))}</b><small>${p.city ? esc(p.city) : sp.name}</small>
        <span class="sug-km"><i style="--c:${sp.color}">${I(sp.icon, 'xs')}</i>${Fmt.km(km, 1)} km recentes</span>
        <button class="btn primary sm" data-act="followHere" data-v="${a.user_id}">${I('userPlus', 'xs')} Seguir</button></div>`; }).join('')}</div>` : '';
    return `${sugHtml}<div class="soc-sec"><h2>Treinos recentes</h2><small>De toda a comunidade</small></div>${list.map((a) => this.safePost(a, { follow: !(Cloud._fol && Cloud._fol.has(a.user_id)) })).join('')}`;
  },

  /* ---------- rankings com pódio ---------- */
  async socialRank() {
    const R = App.rank || (App.rank = { period: 'week', scope: 'all', sport: null });
    const since = new Date(); since.setHours(0, 0, 0, 0);
    if (R.period === 'week') since.setTime(Game.weekStart(Date.now())); else if (R.period === 'month') since.setDate(1); else since.setMonth(0, 1);
    let rows = R.scope === 'city' && !Cloud.me.city ? [] : await Cloud.leaderboard({ since, sport: R.sport, scope: R.scope });
    try { const pm = await Cloud.profilesMap(rows.map((r) => r.user_id)); rows = rows.map((r) => ({ ...r, ...(pm[r.user_id] ? { photo: pm[r.user_id].photo, city: pm[r.user_id].city, frame: pm[r.user_id].frame, avatar: pm[r.user_id].avatar } : {}) })); } catch (e) {}
    const me = Cloud.user.id, seg = (k, items, cur) => `<div class="seg">${items.map(([v, n]) => `<button class="${cur === v ? 'on' : ''}" data-act="rank" data-v="${k}:${v}">${n}</button>`).join('')}</div>`;
    const chip = (k, v, n, cur, ic, c) => `<button class="f-chip ${cur === v ? 'on' : ''}" data-act="rank" data-v="${k}:${v}" ${c ? `style="--c:${c}"` : ''}>${ic ? I(ic, 'xs') : ''}${n}</button>`;
    const filters = `${seg('period', [['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']], R.period)}
      <div class="f-row">${chip('scope', 'all', 'Geral', R.scope, 'compass')}${chip('scope', 'friends', 'Amigos', R.scope, 'users')}${chip('scope', 'city', Cloud.me.city ? esc(Cloud.me.city) : 'Minha cidade', R.scope, 'mapPin')}</div>
      <div class="f-row">${chip('sport', '', 'Todos', R.sport || '', 'activity')}${Object.entries(CONFIG.sports).map(([k, s]) => chip('sport', k, s.name, R.sport || '', s.icon, s.color)).join('')}</div>`;
    if (R.scope === 'city' && !Cloud.me.city) return filters + `<div class="soc-empty">${I('mapPin')}<h3>Cadastre sua cidade</h3><p>Para ver o ranking da cidade, informe sua cidade em Perfil → Editar perfil.</p></div>`;
    if (!rows.length) return filters + `<div class="soc-empty">${I('trophy')}<h3>Ninguém pontuou ainda</h3><p>Seja o primeiro deste período!</p></div>`;
    const val = (v) => `${Fmt.num(Number(v))}<small> km</small>`, av = (r, sz) => { this.keep({ id: r.user_id, name: r.name, photo: r.photo, frame: r.frame, avatar: r.avatar }); return this.avatarOf(r.name, r.frame, r.avatar, sz, r.photo); };
    const top = rows.slice(0, 3), order = [top[1], top[0], top[2]];
    const podium = `<div class="podium">${order.map((r, i) => { if (!r) return '<div class="pd empty"></div>'; const pos = [2, 1, 3][i]; return `<button class="pd p${pos} ${r.user_id === me ? 'me' : ''}" data-act="userOpen" data-v="${r.user_id}"><span class="pd-av">${av(r, pos === 1 ? 'md' : 'sm')}<i class="pd-medal">${pos}</i></span><b>${esc((r.name || '').split(' ')[0])}</b><span class="num">${val(r.value)}</span><div class="pd-step">${pos}º</div></button>`; }).join('')}</div>`;
    const myPos = rows.findIndex((r) => r.user_id === me);
    const rest = rows.slice(3).map((r, i) => `<button class="rk-row ${r.user_id === me ? 'me' : ''}" data-act="userOpen" data-v="${r.user_id}"><span class="rk-n num">${i + 4}</span>${av(r, 'sm')}<div class="grow"><b>${esc(r.name || 'Atleta')}${r.user_id === me ? ' (você)' : ''}</b>${r.city ? `<small>${esc(r.city)}</small>` : ''}</div><b class="num rk-v">${val(r.value)}</b></button>`).join('');
    return `${filters}${myPos >= 0 ? `<div class="rk-me">${I('trophy', 'xs')} Você está em <b>${myPos + 1}º lugar</b> de ${rows.length}</div>` : ''}${podium}${rest ? `<div class="rk-list">${rest}</div>` : ''}`;
  },

  /* ---------- desafios ---------- */
  async socialChallenges() {
    const list = await Cloud.challenges(), me = Cloud.user.id;
    const other = (c) => this.keep(c.from_user === me ? { id: c.to_user, ...(c.b || {}) } : { id: c.from_user, ...(c.a || {}) });
    const spn = (c) => (c.sport ? CONFIG.sports[c.sport].name : 'Qualquer esporte');
    const inv = list.filter((c) => c.status === 'pending' && c.to_user === me), wait = list.filter((c) => c.status === 'pending' && c.from_user === me);
    const act = list.filter((c) => c.status === 'active' && !c.over), done = list.filter((c) => (c.status === 'active' && c.over) || c.status === 'declined');
    const myP = { name: Store.data.profile.name, photo: Store.data.profile.photo };
    const duel = (c) => {
      const o = other(c), a = c.scores ? c.scores[me] || 0 : 0, b = c.scores ? c.scores[o.id] || 0 : 0, tot = a + b || 1;
      const left = Math.max(0, Math.ceil((Date.parse(c.ends_at) - Date.now()) / 864e5));
      return `<button class="duel-card tap" data-act="chalOpen" data-v="${c.id}"><div class="dc-top"><span class="dc-tag">${I(c.sport ? CONFIG.sports[c.sport].icon : 'activity', 'xs')} ${spn(c)} · ${c.days} dias</span><span class="dc-left">${left ? `${left} ${left === 1 ? 'dia' : 'dias'} restantes` : 'último dia'}</span></div>
        <div class="dc-row"><div class="dc-p ${a >= b ? 'lead' : ''}">${this.avatarOf(myP.name, null, null, 'md', myP.photo)}<b>Você</b><span class="num">${Fmt.num(a)}<small> km</small></span></div><div class="dc-vs">VS</div><div class="dc-p ${b > a ? 'lead' : ''}">${this.avatarOf(o.name, o.frame, o.avatar, 'md', o.photo)}<b>${esc((o.name || 'Atleta').split(' ')[0])}</b><span class="num">${Fmt.num(b)}<small> km</small></span></div></div>
        <div class="dc-bar"><i style="width:${(a / tot) * 100}%"></i></div><small class="dc-st">${a === b ? 'Empatados: bora treinar!' : a > b ? `Você está ${Fmt.num(a - b)} km na frente` : `Faltam ${Fmt.num(b - a)} km para passar`}</small></button>`;
    };
    const invite = (c) => { const o = other(c); return `<div class="ch-inv"><div class="ch-inv-h">${this.avatarOf(o.name, o.frame, o.avatar, 'md', o.photo)}<div class="grow"><b>${esc(o.name || 'Atleta')} desafiou você!</b><small>${spn(c)} · ${c.days} dias · vence quem fizer mais km</small></div></div><div class="row2"><button class="btn ghost sm" data-act="chalAnswer" data-v="${c.id}:0">Recusar</button><button class="btn primary sm" data-act="chalAnswer" data-v="${c.id}:1">${I('swords', 'xs')} Aceitar</button></div></div>`; };
    const small = (c, txt, badge) => { const o = other(c); return `<div class="ch-row">${this.avatarOf(o.name, o.frame, o.avatar, 'sm', o.photo)}<div class="grow"><b>${esc(o.name || 'Atleta')}${UI.vb(o.id, o.username)}</b><small>${spn(c)} · ${c.days} dias${txt ? ' · ' + txt : ''}</small></div>${badge}</div>`; };
    const res = (c) => { if (c.status === 'declined') return small(c, '', '<span class="badge">Recusado</span>'); const o = other(c), a = c.scores[me] || 0, b = c.scores[o.id] || 0; return small(c, `${Fmt.num(a)} × ${Fmt.num(b)} km`, a > b ? `<span class="badge win">${I('trophy', 'xs')} Venceu</span>` : a < b ? '<span class="badge">Perdeu</span>' : '<span class="badge">Empate</span>'); };
    const wins = done.filter((c) => c.status === 'active' && (c.scores[me] || 0) > (c.scores[other(c).id] || 0)).length;
    return `<section class="ch-hero"><div class="grow"><b>Desafie um amigo</b><small>Escolha o esporte e o prazo. Vence quem fizer mais km.</small>${done.length ? `<span class="ch-rec">${I('trophy', 'xs')} ${wins} ${wins === 1 ? 'vitória' : 'vitórias'} em ${done.filter((c) => c.status === 'active').length} desafios</span>` : ''}</div><button class="btn sm ch-new" data-act="chalNew">${I('plus', 'xs')} Novo desafio</button></section>
      ${inv.length ? `<div class="soc-sec"><h2>Convites</h2><small>${inv.length} ${inv.length === 1 ? 'pendente' : 'pendentes'}</small></div>${inv.map(invite).join('')}` : ''}
      ${act.length ? `<div class="soc-sec"><h2>Em andamento</h2></div>${act.map(duel).join('')}` : ''}
      ${wait.length ? `<div class="soc-sec"><h2>Aguardando resposta</h2></div><div class="ch-list">${wait.map((c) => small(c, '', '<span class="badge">Enviado</span>')).join('')}</div>` : ''}
      ${done.length ? `<div class="soc-sec"><h2>Encerrados</h2></div><div class="ch-list">${done.slice(0, 15).map(res).join('')}</div>` : ''}
      ${!list.length ? `<div class="soc-empty">${I('swords')}<h3>Nenhum desafio ainda</h3><p>Desafios são entre amigos (vocês dois se seguem). Comece um agora!</p></div>` : ''}`;
  },

  // tela para criar um desafio (no lugar da lista de seleção)
  async chalPick() {
    const S = App.chal || (App.chal = { to: null, sport: '', days: 7, q: '' });
    this.render(`${this.back('social', 'Novo desafio')}<main class="screen chp"><div id="chpBody">${this.skel('rank')}</div></main>`, false);
    let fr = this._frCache;
    if (!fr || Date.now() - this._frAt > 60000) { try { const ids = await Cloud.friends(); const pm = await Cloud.profilesMap(ids); fr = ids.map((id) => this.keep({ id, ...(pm[id] || {}) })).sort((a, b) => (a.name || '').localeCompare(b.name || '')); this._frCache = fr; this._frAt = Date.now(); } catch (e) { fr = []; } }
    this.chalPickDraw();
  },
  chalPickDraw() {
    const el = $('#chpBody'); if (!el) return;
    const S = App.chal, fr = this._frCache || [], q = (S.q || '').toLowerCase(), sel = fr.find((p) => p.id === S.to) || (S.to && this._people[S.to]);
    const list = fr.filter((p) => !q || (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q));
    const myP = Store.data.profile, sp = S.sport ? CONFIG.sports[S.sport] : null;
    el.innerHTML = `
      <section class="chp-preview"><div class="dc-row"><div class="dc-p lead">${this.avatarOf(myP.name, null, null, 'lg', myP.photo)}<b>Você</b></div><div class="dc-vs">VS</div><div class="dc-p ${sel ? 'lead' : 'ghost'}">${sel ? this.avatarOf(sel.name, sel.frame, sel.avatar, 'lg', sel.photo) : `<span class="chp-q">?</span>`}<b>${sel ? esc((sel.name || '').split(' ')[0]) : 'Escolha'}</b></div></div>
        <p>${sel ? `Vence quem fizer mais km de <b>${sp ? sp.name.toLowerCase() : 'qualquer esporte'}</b> em <b>${S.days} dias</b>` : 'Escolha um amigo para desafiar'}</p></section>
      <div class="soc-sec"><h2>1. Quem?</h2><small>Só amigos (vocês se seguem)</small></div>
      ${fr.length ? `<label class="chp-search">${I('search', 'xs')}<input id="chpQ" placeholder="Buscar amigo" value="${esc(S.q || '')}" autocomplete="off"></label>
        <div class="chp-friends">${list.map((p) => `<button class="chp-f ${p.id === S.to ? 'on' : ''}" data-act="chpTo" data-v="${p.id}">${this.avatarOf(p.name, p.frame, p.avatar, 'md', p.photo)}<b>${esc((p.name || 'Atleta').split(' ')[0])}</b>${p.id === S.to ? `<i class="chp-ck">${I('check', 'xs')}</i>` : ''}</button>`).join('') || '<p class="muted small">Ninguém com esse nome.</p>'}</div>`
        : `<div class="soc-empty compact">${I('users')}<p>Você ainda não tem amigos. Amigo é quem vocês dois se seguem.</p><button class="btn ghost sm" data-act="subTab2" data-v="discover">Descobrir atletas</button></div>`}
      <div class="soc-sec"><h2>2. Qual esporte?</h2></div>
      <div class="chp-sports"><button class="${!S.sport ? 'on' : ''}" data-act="chpSport" data-v="">${I('activity')}<small>Qualquer</small></button>${Object.entries(CONFIG.sports).map(([k, s]) => `<button class="${S.sport === k ? 'on' : ''}" data-act="chpSport" data-v="${k}" style="--c:${s.color}">${I(s.icon)}<small>${s.name}</small></button>`).join('')}</div>
      <div class="soc-sec"><h2>3. Por quanto tempo?</h2></div>
      <div class="seg chp-days">${[3, 7, 14, 30].map((d) => `<button class="${S.days === d ? 'on' : ''}" data-act="chpDays" data-v="${d}">${d} dias</button>`).join('')}</div>
      <div class="chp-pad"></div>
      <button class="btn primary lg chp-send" data-act="chpSend" ${sel ? '' : 'disabled'}>${I('swords')} ${sel ? `Desafiar ${esc((sel.name || '').split(' ')[0])}` : 'Escolha um amigo'}</button>`;
    const inp = $('#chpQ'); if (inp) inp.oninput = () => { S.q = inp.value; const pos = inp.selectionStart; this.chalPickDraw(); const n = $('#chpQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
  },

  /* ---------- clubes ---------- */
  async socialClubs() {
    const clubs = await Cloud.myClubs();
    const card = (c) => { const h = this.hue(c.id || c.name); return `<button class="club-card tap" data-act="clubOpen" data-v="${c.id}"><div class="cc-ban" style="--h:${h}"><span class="cc-ini">${esc((c.name || 'C').split(/\s+/).filter((w) => w && !/^(d[aeo]s?|e|of|the)$/i.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase())}</span></div><div class="cc-info"><b>${esc(c.name)}</b><small>${c.description ? esc(c.description) : `Meta coletiva de ${c.goal_km} km/mês`}</small><span class="cc-code">${I('link', 'xs')} ${esc(c.invite_code)}</span></div>${I('chevronRight', 'chev')}</button>`; };
    return `<div class="club-ctas"><button class="cta-tile" data-act="clubCreate">${I('plus')}<b>Criar clube</b><small>Empresa, assessoria, igreja, amigos</small></button><button class="cta-tile" data-act="clubJoin">${I('link')}<b>Entrar com código</b><small>Recebeu um convite?</small></button></div>
      ${clubs.length ? `<div class="soc-sec"><h2>Seus clubes</h2><small>${clubs.length}</small></div><div class="club-list">${clubs.map(card).join('')}</div>` : `<div class="soc-empty">${I('shield')}<h3>Treine em grupo</h3><p>Clubes somam os km de todo mundo numa meta do mês, com ranking semanal e feed só dos membros.</p></div>`}`;
  },

  /* ---------- busca ---------- */
  search() {
    this.render(`${this.back('social', 'Buscar atletas')}<main class="screen soc"><label class="chp-search big">${I('search')}<input id="searchQ" placeholder="Nome ou @usuário" autocomplete="off"></label><div id="searchRes"><p class="muted small srch-hint">Digite pelo menos 2 letras.</p></div></main>`);
    setTimeout(() => $('#searchQ') && $('#searchQ').focus(), 50);
  },
  async searchResults(q) {
    const el = $('#searchRes'); if (!el) return;
    if (q.length < 2) { el.innerHTML = '<p class="muted small srch-hint">Digite pelo menos 2 letras.</p>'; return; }
    const [rows, fol, fw] = await Promise.all([Cloud.search(q), Cloud.following(), Cloud.followers().catch(() => [])]);
    if ($('#searchQ') && $('#searchQ').value.trim() !== q) return;
    const list = rows.filter((r) => r.id !== Cloud.user.id);
    el.innerHTML = list.length ? `<div class="ppl">${list.map((r) => { this.keep(r); const f = fol.includes(r.id), b = fw.includes(r.id); return `<div class="ppl-row"><button class="tap" data-act="userOpen" data-v="${r.id}">${this.avatarOf(r.name, r.frame, r.avatar, 'md', r.photo)}</button><div class="grow tap" data-act="userOpen" data-v="${r.id}"><b>${esc(r.name)}${UI.vb(r.id, r.username)}</b><small>@${esc(r.username || '')}${r.city ? ' · ' + esc(r.city) : ''} · nível ${r.level || 1}</small></div>${f && b ? `<span class="badge friend">${I('users', 'xs')} Amigos</span>` : f ? '<span class="badge">Seguindo</span>' : `<button class="btn primary sm" data-act="follow" data-v="${r.id}">${b ? 'Seguir de volta' : 'Seguir'}</button>`}</div>`; }).join('')}</div>` : `<div class="soc-empty compact">${I('search')}<p>Ninguém encontrado com “${esc(q)}”.</p></div>`;
  },

  /* ---------- perfil público ---------- */
  async user(id) {
    this._uid = id;
    this.render(`${this.back('social', 'Perfil')}<main class="screen up"><div id="userBody">${this.skel('feed')}</div></main>`);
    try {
      const [d, fs] = await Promise.all([Cloud.profileOf(id), Cloud.friendState(id)]);
      const p = this.keep({ ...d.p, id }), f = fs.iFollow, self = id === Cloud.user.id;
      const L0 = CONFIG.leagues.find((x) => x.id === p.league) || CONFIG.leagues[0], h = this.hue(id);
      const atl = p.avatar_cfg && p.avatar_cfg.on !== false && p.avatar_pow;
      const el = $('#userBody'); if (!el) return;
      el.outerHTML = `<section class="up-head"><div class="up-cover" style="--h:${h}"></div>
          <button class="up-av" data-act="${self ? 'myPhoto' : 'avView'}" data-v="${id}">${this.avatarOf(p.name, p.frame, p.avatar, 'xl', p.photo)}</button>
          <h1>${esc(p.name)}${UI.vb(p.id, p.username)}</h1><small class="up-meta">@${esc(p.username || '')}${p.city ? ` · ${I('mapPin', 'xs')} ${esc(p.city)}` : ''}</small>
          <div class="prof-tags"><span class="league-pill" style="--lc:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span><span class="lvl-pill">${I('zap', 'xs')} Nível ${p.level || 1}</span>${fs.friends ? `<span class="badge friend">${I('users', 'xs')} Amigos</span>` : fs.followsMe ? '<span class="badge">Segue você</span>' : ''}</div>
          <div class="up-stats"><div><b class="num">${Fmt.num(p.total_km, 0)}</b><small>km totais</small></div><button data-act="followList2" data-v="followers:${id}"><b class="num">${d.followers}</b><small>seguidores</small></button><div><b class="num">${p.medals || 0}</b><small>medalhas</small></div><div><b class="num">${p.xp || 0}</b><small>XP</small></div></div>
          ${self ? '' : `<div class="up-acts"><button class="btn ${f ? 'ghost' : 'primary'}" data-act="${f ? 'unfollow' : 'follow'}" data-v="${id}">${fs.friends ? `${I('users')} Amigos` : f ? `${I('check')} Seguindo` : fs.followsMe ? `${I('userPlus')} Seguir de volta` : `${I('userPlus')} Seguir`}</button><button class="btn ghost" data-act="chalNew" data-v="${id}" ${fs.friends ? '' : 'data-nf="1"'}>${I('swords')} Desafiar</button></div>`}
          ${!self && fs.followsMe && !fs.friends ? `<p class="fr-hint">${I('userPlus', 'xs')} ${esc((p.name || '').split(' ')[0])} segue você. Siga de volta para virarem amigos!</p>` : ''}
        </section>
        ${atl ? `<div class="av-other"><div class="avo-art">${Avatar.svg(p.avatar_cfg, { pose: 'stand', mood: 'happy', w: 86, still: true, stage: p.avatar_stage || 0, stats: p.avatar_cfg.st || { vel: 1, res: 1, for: 1, con: 1 } })}</div><div class="grow"><small class="eyebrow">Atleta</small><b>${esc((Avatar.STAGES[p.avatar_stage || 0] || [0, ''])[1])} · poder ${p.avatar_pow}</b>${p.avatar_cfg.st ? `<div class="avh-attrs">${Avatar.ATTR.map(([k, n, ic, c]) => `<div style="--c:${c}">${I(ic, 'xs')}<i><i style="width:${p.avatar_cfg.st[k]}%"></i></i><b class="num">${p.avatar_cfg.st[k]}</b></div>`).join('')}</div>` : ''}</div></div>` : ''}
        <div class="soc-sec"><h2>Atividades</h2><small>${d.acts.length ? 'mais recentes' : ''}</small></div>
        ${d.acts.length ? d.acts.map((a) => this.safePost(a, { noFoot: true })).join('') : `<div class="soc-empty compact">${I('activity')}<p>Nenhuma atividade pública ainda.</p></div>`}`;
    } catch (e) { console.error(e); const el = $('#userBody'); if (el) el.innerHTML = '<div class="soc-empty">Perfil não encontrado.</div>'; }
  },
});
