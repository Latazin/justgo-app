/* =========================================================
   JustGo — v12 · Progresso, missões, desbloqueios e liga
   - Topo sem anel com brilho: número do nível grande + faixa de números.
   - Missões: anel de progresso com o ícone do esporte (o anel É o progresso);
     a mais perto de terminar ganha "Quase lá".
   - Desbloqueios: uma trilha vertical, como um percurso com marcos de km.
   - Liga: régua Bronze → Diamante com a sua posição marcada.
   Carrega depois de ui-v11.js.
   ========================================================= */
(() => {
  const SPORT_ICON = (k) => (CONFIG.sports[k] || {}).icon || 'target';
  const ring = (pct, r = 15) => { const C = 2 * Math.PI * r; return `<svg class="mr12" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" class="bg"/><circle cx="18" cy="18" r="${r}" class="fg" stroke-dasharray="${((C * Math.min(100, Math.max(0, pct))) / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>`; };

  /* ---------------- topo do Progresso ---------------- */
  UI.progress = function () {
    const sub = App.sub.progress;
    const tabs = this.tabsBar([['missions', 'Missões'], ['tree', 'Desbloqueios'], ['season', 'Liga'], ['shop', 'Loja']], sub, 'subTab');
    const body = sub === 'tree' ? this.treeView() : sub === 'season' ? this.seasonView() : sub === 'shop' ? this.shopView() : this.missionsView();
    const lv = this.levelLine(), xpm = Game.monthXp(), L0 = Game.league(xpm), D = Store.data, streak = Game.streakDays();
    const hero = `<section class="pg12">
        <div class="pg12-top"><div class="pg12-lv"><small>Nível</small><b class="num">${lv.l}</b></div>
          <div class="grow"><b class="pg12-t">${esc(Game.title(lv.l))}</b><small class="num">${lv.txt} para o nível ${lv.l + 1}</small><i class="pg12-bar"><i style="width:${lv.pct}%"></i></i></div></div>
        <div class="pg12-strip">
          <button data-act="go" data-v="history"><small>${I('flame', 'xs')} Ofensiva</small><b class="num">${streak}</b><span>${streak === 1 ? 'dia' : 'dias'}</span></button>
          <button data-act="subTab" data-v="season" style="--c:${L0.color}"><small>${I('crown', 'xs')} Liga</small><b>${L0.name}</b><span class="num">${xpm} XP no mês</span></button>
          <button data-act="subTab" data-v="shop"><small>${I('coin', 'xs')} Moedas</small><b class="num">${D.coins}</b><span>na loja</span></button>
        </div></section>`;
    this.render(`${this.back(App.backTo || 'profile', 'Progresso')}<main class="screen pg12-screen">${hero}${tabs}${body}</main>`);
    if (sub === 'season') this.loadSeasonBoard();
    if (sub === 'tree') setTimeout(() => { const c = $('.tl12-node.cur'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 250);
  };

  /* ---------------- linha de missão (também usada no Início) ---------------- */
  UI.missionRow = function (m, pre, kind, swap = false) {
    const now = Date.now(), p = Game.mProgress(m, Game.scope(kind, now));
    const done = Store.data.missionsDone[Game.mKey(pre, m, now)];
    const ic = m.icon || (m.sport && m.sport !== 'all' ? SPORT_ICON(m.sport) : m.type === 'before' ? 'sunrise' : 'target');
    const col = m.sport && m.sport !== 'all' && CONFIG.sports[m.sport] ? CONFIG.sports[m.sport].color : 'var(--brand)';
    const near = !done && p.pct >= 60;
    return `<div class="mi12 ${done ? 'done' : ''} ${near ? 'near' : ''}" style="--c:${col}">
      <span class="mi12-ic">${ring(done ? 100 : p.pct)}<i>${I(done ? 'check' : ic, 'xs')}</i></span>
      <div class="grow"><b>${esc(m.text)}</b><small class="num">${done ? 'Concluída' : p.txt}${near ? ' · <em>quase lá</em>' : ''}</small></div>
      <div class="mi12-r"><span class="num">+${m.xp} XP</span>${swap && !done ? `<button class="mi12-sw" data-act="swapDaily" data-v="${m.id}" aria-label="Trocar missão">${I('shuffle', 'xs')}</button>` : ''}</div>
    </div>`;
  };

  /* ---------------- aba Missões ---------------- */
  const ms0 = UI.missionsView.bind(UI);
  UI.missionsView = function () {
    const P = Store.data.profile;
    if (!P.missionSports || App.msEditing) return ms0(); // escolha de esportes: tela antiga serve
    const now = Date.now(), mid = new Date(); mid.setHours(24, 0, 0, 0);
    const left = mid - now, h = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
    const wd = Math.ceil((Game.weekStart(now) + 7 * 864e5 - now) / 864e5);
    const season = Game.seasonal(now), sp = Game.mProgress(season, Game.scope('month', now));
    const daily = Game.dailyMissions(now), dDone = daily.filter((x) => Store.data.missionsDone[Game.mKey('d', x, now)]).length;
    const bonus = Store.data.missionsDone[Game.dailyBonusKey(now)];
    const canSwap = !(Store.data.dailySwap && Store.data.dailySwap.day === Game.dayKey(now) && Store.data.dailySwap.used);
    const weekly = Game.weeklyMissions();
    const wk = Game.km(Game.scope('week', now)), mo = Game.km(Game.scope('month', now));
    const goals = Game.has('goals') ? `<section class="gl12">
        <div><div class="gl12-h"><b>Semana</b><span class="num"><b>${Fmt.num(wk)}</b> / ${P.goalWeek} km</span></div><i class="gl12-bar"><i style="width:${Math.min(100, (wk / P.goalWeek) * 100)}%"></i></i></div>
        <div><div class="gl12-h"><b>Mês</b><span class="num"><b>${Fmt.num(mo)}</b> / ${P.goalMonth} km</span></div><i class="gl12-bar"><i style="width:${Math.min(100, (mo / P.goalMonth) * 100)}%"></i></i></div>
        <div class="gl12-in"><label><span>Meta semanal</span><input type="number" min="1" data-set="goalWeek" value="${P.goalWeek}"><em>km</em></label><label><span>Meta mensal</span><input type="number" min="1" data-set="goalMonth" value="${P.goalMonth}"><em>km</em></label></div>
      </section>` : this.lockedBox('goals', '<div class="fake-field"><span>Semana</span><b>12 / 20 km</b><span>Mês</span><b>48 / 80 km</b></div>');
    return `<div class="ms12-sp">${P.missionSports.map((k) => `<span style="--c:${CONFIG.sports[k].color}">${I(CONFIG.sports[k].icon, 'xs')}${CONFIG.sports[k].name}</span>`).join('')}<button data-act="msEdit">Trocar esportes</button></div>
      <section class="bn12 ${bonus ? 'got' : ''}">
        <div class="bn12-t"><b>${bonus ? 'Bônus do dia garantido' : 'Bônus do dia'}</b><span class="num">${dDone}/3</span></div>
        <div class="bn12-seg">${daily.map((_, i) => `<i class="${i < dDone ? 'on' : ''}"></i>`).join('')}</div>
        <small>${bonus ? `Você ganhou +${CONFIG.dailyBonus.xp} XP e +${CONFIG.dailyBonus.coins} moedas hoje.` : `Complete as 3 de hoje e ganhe <b>+${CONFIG.dailyBonus.xp} XP</b> e <b>+${CONFIG.dailyBonus.coins} moedas</b>.`}</small>
      </section>
      <div class="ms12-h"><h2>Hoje</h2><small>renovam em ${h}h ${mm}min</small></div>
      <div class="ms12-l">${daily.map((x) => this.missionRow(x, 'd', 'day', canSwap)).join('')}</div>
      ${canSwap ? `<p class="ms12-tip">${I('shuffle', 'xs')} Não curtiu alguma? Troque 1 missão por dia.</p>` : ''}
      <div class="ms12-h"><h2>Semana</h2><small>${wd} ${wd === 1 ? 'dia restante' : 'dias restantes'}</small></div>
      <div class="ms12-l">${weekly.map((x) => this.missionRow(x, 'w', 'week')).join('')}</div>
      <div class="ms12-h"><h2>Evento do mês</h2><small class="num">+${season.xp} XP</small></div>
      <section class="ev12"><span class="ev12-ic">${I(season.icon || 'calendar')}</span><div class="grow"><b>${esc(season.text)}</b><i class="gl12-bar"><i style="width:${Math.min(100, sp.pct)}%"></i></i><small class="num">${sp.txt}</small></div></section>
      <div class="ms12-h"><h2>Metas pessoais</h2></div>${goals}
      <button class="ms12-ch" data-act="sub" data-v="social:challenges">${I('swords')}<div class="grow"><b>Desafie um amigo</b><small>“Quem pedala mais em 7 dias?” Valendo direto no app.</small></div>${I('chevronRight', 'xs')}</button>`;
  };

  /* ---------------- aba Desbloqueios: trilha ---------------- */
  UI.treeView = function () {
    Game.syncUnlocks && Game.syncUnlocks();
    const ALL = CONFIG.unlocks, U = ALL.filter((u) => Game.relevant(u)), other = ALL.filter((u) => !Game.relevant(u));
    const total = U.length, done = U.filter((u) => Game.has(u.id)).length;
    const next = Game.nextUnlocks(1)[0];
    const tiers = CONFIG.tiers.filter((t) => U.some((u) => u.tier === t.id));
    let km = 0;
    const node = (u) => {
      const on = Game.has(u.id), trial = on && !Store.data.unlocked[u.id], p = Game.reqProgress(u.req), cur = next && next.id === u.id;
      km++;
      return `<button class="tl12-node ${on ? 'on' : ''} ${cur ? 'cur' : ''}" data-act="unlockInfo" data-v="${u.id}">
        <span class="tl12-dot">${on ? I(trial ? 'clock' : 'check', 'xs') : cur ? `<b class="num">${Math.floor(p.pct)}%</b>` : ''}</span>
        <span class="tl12-ic">${I(u.icon)}</span>
        <div class="grow"><b>${esc(u.name)}</b>${on ? `<small class="ok">${trial ? 'Teste de 24 h ativo' : 'Liberada'}</small>` : `<small>${esc(Game.reqText(u.req))}</small>${cur || p.pct > 0 ? `<i class="tl12-bar"><i style="width:${p.pct}%"></i></i><small class="num">${p.curTxt}</small>` : ''}`}</div>
        ${on ? '' : I('lock', 'xs')}
      </button>`;
    };
    return `<section class="tl12-sum"><div><b class="num">${done}<span>/${total}</span></b><small>funções liberadas</small></div><i class="pg12-bar"><i style="width:${(done / Math.max(1, total)) * 100}%"></i></i>
        ${next ? `<button class="tl12-go" data-act="unlockInfo" data-v="${next.id}"><small>Próximo marco</small><b>${esc(next.name)}</b>${I('chevronRight', 'xs')}</button>` : `<p class="tl12-all">${I('trophy', 'xs')} Você liberou tudo!</p>`}</section>
      <div class="tl12">
        <div class="tl12-start"><span>Largada</span></div>
        ${tiers.map((t) => { const us = U.filter((u) => u.tier === t.id), dn = us.filter((u) => Game.has(u.id)).length; return `<div class="tl12-tier ${dn === us.length ? 'ok' : ''}"><span class="tl12-plate num">${t.id}</span><div><b>${esc(t.name)}</b><small class="num">${dn} de ${us.length}</small></div></div>${us.map(node).join('')}`; }).join('')}
        <div class="tl12-end"><span>${I('flag', 'xs')} Chegada</span></div>
      </div>
      <div class="tr8-sports">${I('activity', 'xs')}<span>Mostrando funções de <b>${Game.userSports().map((k) => (CONFIG.sports[k] || {}).name).filter(Boolean).join(', ') || 'todos os esportes'}</b>.${other.length ? ` ${other.length} de outros esportes ficam escondidas.` : ''}</span><button data-act="msEditTree">Mudar</button></div>`;
  };

  /* ---------------- aba Liga: régua ---------------- */
  UI.seasonView = function () {
    const xp = Game.monthXp(), L0 = Game.league(xp), nx = Game.nextLeague(xp), LS = CONFIG.leagues;
    const end = new Date(); end.setMonth(end.getMonth() + 1, 1); end.setHours(0, 0, 0, 0);
    const days = Math.ceil((end - Date.now()) / 864e5), mo = new Date();
    const i0 = LS.findIndex((l) => l.id === L0.id), seg = 100 / (LS.length - 1);
    const frac = nx ? Math.min(1, (xp - L0.min) / (nx.min - L0.min)) : 0;
    const pos = Math.min(100, i0 * seg + frac * seg);
    const hist = Object.entries(Store.data.seasons).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
    return `<section class="lg12" style="--lc:${L0.color}">
        <small class="lg12-k">Temporada de ${MONTHS[mo.getMonth()]} · termina em ${days} ${days === 1 ? 'dia' : 'dias'}</small>
        <div class="lg12-h"><h2>Liga ${L0.name}</h2><b class="num">${xp}<small> XP</small></b></div>
        <p class="lg12-p">${nx ? `Faltam <b class="num">${nx.min - xp} XP</b> para a Liga ${nx.name}.` : 'Você está na liga mais alta. Mantenha o ritmo!'}</p>
        <div class="lg12-rule">
          <div class="lg12-track"><i style="width:${pos}%"></i></div>
          <span class="lg12-me" style="left:${pos}%"><b>você</b></span>
          ${LS.map((l, i) => `<div class="lg12-stop ${xp >= l.min ? 'got' : ''} ${l.id === L0.id ? 'cur' : ''}" style="left:${i * seg}%;--c:${l.color}"><i>${I('crown', 'xs')}</i><b>${l.name}</b><small class="num">${l.min} XP</small><em class="num">+${l.reward}</em></div>`).join('')}
        </div>
        <small class="lg12-note">${I('coin', 'xs')} Moedas que você ganha no fim do mês, conforme a liga. O XP do mês zera no dia 1º.</small>
      </section>
      <div class="ms12-h"><h2>Ranking do mês</h2><small>XP ganho em ${MONTHS[mo.getMonth()]}</small></div>
      <div id="seasonBoard">${Cloud.loggedIn() ? '<div class="ra3-sk sm"><b></b><b></b><b></b></div>' : `<button class="ms12-ch" data-act="go" data-v="account">${I('users')}<div class="grow"><b>Dispute com outros atletas</b><small>Entre na sua conta para ver o ranking mensal de XP.</small></div>${I('chevronRight', 'xs')}</button>`}</div>
      ${hist.length ? `<div class="ms12-h"><h2>Temporadas anteriores</h2></div><div class="ms12-l">${hist.map(([k, v]) => { const l = LS.find((x) => x.id === v.league) || LS[0]; const [y, m] = k.split('-'); return `<div class="lg12-old" style="--c:${l.color}"><i>${I('crown', 'xs')}</i><div class="grow"><b>${MONTHS[m - 1]} ${y}</b><small>Liga ${l.name}</small></div><b class="num">${v.xp} XP</b></div>`; }).join('')}</div>` : ''}`;
  };

  // ranking: posição, rosto e destaque para você
  UI.board = function (rows, fmt) {
    if (!rows.length) return '<p class="ms12-tip">Ninguém pontuou ainda neste período. Seja o primeiro!</p>';
    const me = Cloud.user && Cloud.user.id, top = Number(rows[0].value) || 1;
    return `<div class="bd12">${rows.map((r, i) => `<button class="bd12-r ${r.user_id === me ? 'me' : ''} ${i < 3 ? 'p' + (i + 1) : ''}" data-act="userOpen" data-v="${r.user_id}">
      <span class="bd12-pos num">${i + 1}</span>${this.avatarOf(r.name, r.frame, r.avatar, 'sm', r.photo)}
      <div class="grow"><b>${esc(r.name)}${UI.vb(r.user_id, r.username)}${r.user_id === me ? ' <em>você</em>' : ''}</b><i class="bd12-bar"><i style="width:${Math.max(4, (Number(r.value) / top) * 100)}%"></i></i></div>
      <b class="num bd12-v">${fmt(Number(r.value))}</b></button>`).join('')}</div>`;
  };
})();

/* ---------------- missões cumpridas sem treino novo ----------------
   As missões só eram conferidas ao salvar um treino. Se a pessoa trocava uma missão
   por outra que os treinos de hoje já cumpriam (ou editava/importava um treino),
   ela ficava "20/20" sem concluir nem pagar. Agora o app confere ao abrir
   o Início e o Progresso e paga o que faltou. */
Game.claimMissions = function (ts = Date.now()) {
  const D = Store.data; if (!D || !D.profile || !D.profile.missionSports) return [];
  const got = []; let xp = 0, coins = 0;
  const groups = [['d', this.dailyMissions(ts), 'day'], ['w', this.weeklyMissions(), 'week'], ['s', [this.seasonal(ts)], 'month']];
  for (const [pre, list, kind] of groups) {
    const scoped = this.scope(kind, ts);
    for (const m of list) {
      const key = this.mKey(pre, m, ts);
      if (D.missionsDone[key]) continue;
      if (this.mProgress(m, scoped).cur >= m.value) {
        D.missionsDone[key] = Date.now(); got.push(m); xp += m.xp; coins += m.coins || 0;
        if (pre === 'd') D.dailyDoneCount = (D.dailyDoneCount || 0) + 1;
      }
    }
  }
  const dl = this.dailyMissions(ts), bk = this.dailyBonusKey(ts);
  if (got.length && !D.missionsDone[bk] && dl.every((m) => D.missionsDone[this.mKey('d', m, ts)])) {
    D.missionsDone[bk] = Date.now(); xp += CONFIG.dailyBonus.xp; coins += CONFIG.dailyBonus.coins;
    got.push({ text: 'Bônus do dia', xp: CONFIG.dailyBonus.xp });
  }
  if (!got.length) return got;
  const l0 = this.level(D.xp);
  D.xp += xp; D.coins += coins; D.xpLog.push([Date.now(), xp]);
  Store.save();
  setTimeout(() => {
    FX.toast(got.length === 1 ? `Missão concluída: ${got[0].text} · +${xp} XP` : `${got.length} missões concluídas · +${xp} XP e +${coins} moedas`);
    const l1 = this.level(D.xp); if (l1 > l0 && FX.levelUp) try { FX.levelUp(l1); } catch (e) {}
  }, 400);
  return got;
};
(() => {
  // confere antes de desenhar a tela, então ela já aparece certa
  const wrap = (name) => { const f = UI[name].bind(UI); UI[name] = function (...a) { try { Game.claimMissions(); } catch (e) { console.warn(e); } return f(...a); }; };
  wrap('home'); wrap('progress');
})();

/* ---------------- estatísticas e atividades ---------------- */
// "▲ 3,2 km a mais que na semana passada (até hoje)"
UI.st12Cmp = function (acts, per, from) {
  try {
    const now = Date.now(), d0 = new Date(from);
    let pFrom, pTo;
    if (per === 'week') { pFrom = from - 7 * 864e5; pTo = now - 7 * 864e5; }
    else if (per === 'month') { const a = new Date(d0); a.setMonth(a.getMonth() - 1); pFrom = a.getTime(); const b = new Date(now); b.setMonth(b.getMonth() - 1); pTo = b.getTime(); }
    else { const a = new Date(d0); a.setFullYear(a.getFullYear() - 1); pFrom = a.getTime(); const b = new Date(now); b.setFullYear(b.getFullYear() - 1); pTo = b.getTime(); }
    const cur = acts.filter((a) => a.start >= from).reduce((s, a) => s + a.distance, 0) / 1000;
    const prev = acts.filter((a) => a.start >= pFrom && a.start < pTo).reduce((s, a) => s + a.distance, 0) / 1000;
    const nm = per === 'week' ? 'na semana passada' : per === 'month' ? 'no mês passado' : 'no ano passado';
    if (!prev && !cur) return '';
    if (!prev) return `<p class="st12-cmp up">${I('trending', 'xs')} Você não tinha treinado ${nm} até hoje. Bom começo!</p>`;
    const d = cur - prev, up = d >= 0;
    return `<p class="st12-cmp ${up ? 'up' : 'dn'}"><b class="num">${up ? '▲' : '▼'} ${Fmt.num(Math.abs(d))} km</b> ${up ? 'a mais' : 'a menos'} que ${nm} até hoje</p>`;
  } catch (e) { return ''; }
};
UI.histView = function () { try { return localStorage.getItem('justgo_hist_view') || 'list'; } catch (e) { return 'list'; } };
App.actions.histView = (el) => { try { localStorage.setItem('justgo_hist_view', el.dataset.v); } catch (e) {} UI.history(); };

/* =========================================================
   v12.1 · Mapa
   - Um botão "Camadas" no lugar da fileira de botões (que rolava de lado e cortava).
   - Território de cada pessoa na cor da moldura que ela comprou na loja.
   - Treinos desenhados finos por baixo dos territórios (antes viravam um borrão azul).
   - Camada vazia avisa (ex.: nenhuma rota salva).
   ========================================================= */
(() => {
  const LAYERS = [
    ['zones', 'flag', 'Territórios', 'Áreas conquistadas na região, na cor de cada atleta'],
    ['spots', 'mapPin', 'Pontos', 'Lugares famosos e quem está treinando lá agora'],
    ['acts', 'activity', 'Meus treinos', 'Todos os seus trajetos por aqui'],
    ['routes', 'route', 'Rotas salvas', 'Suas rotas e segmentos'],
    ['explore', 'compass', 'Ruas novas', 'Quanto das ruas da área você já percorreu'],
  ];
  // cor sólida a partir da moldura (que pode ser degradê)
  const lum = (h) => { const n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const V12Color = function (v) {
    if (!v || typeof v !== 'string') return null;
    const hs = (v.match(/#[0-9a-fA-F]{6}/g) || []);
    if (!hs.length) return null;
    return hs.sort((a, b) => Math.abs(lum(a) - 0.45) - Math.abs(lum(b) - 0.45))[0];
  };
  window.V12Color = V12Color;
  UI.myZoneColor = function () { return V12Color(Shop.val('frame')) || '#1F6BFF'; };
  UI._ownerCol = UI._ownerCol || {};
  const ownerColor = (z) => (z.mine ? UI.myZoneColor() : UI._ownerCol[z.owner] || UI.zoneColor(z.owner));
  // busca a moldura dos donos das áreas (uma consulta só)
  const loadOwnerColors = async (zones) => {
    if (!Cloud.loggedIn()) return;
    const ids = [...new Set(zones.map((z) => z.owner).filter((id) => id && !(id in UI._ownerCol)))];
    if (!ids.length) return;
    try { const { data } = await Cloud.sb.from('profiles').select('id,frame').in('id', ids.slice(0, 200)); ids.forEach((id) => (UI._ownerCol[id] = null)); (data || []).forEach((p) => (UI._ownerCol[p.id] = V12Color(p.frame))); if (App.tab === 'mapa') UI.mapaDraw(); } catch (e) {}
  };

  UI.mapa = function () {
    const lay = App.mapLayers || (App.mapLayers = { zones: true, acts: false, routes: false, spots: true });
    if (lay.spots === undefined) lay.spots = true;
    const on = LAYERS.filter(([k]) => lay[k]);
    this.render(`<main class="maptab mp12">
      <div class="map-wrap"><div id="bigMap" class="big-map"></div>
        <div class="mp12-top">
          <button class="mp12-lay" data-act="mapLayers">${I('layers')}<span>Camadas</span><em class="num">${on.length}</em></button>
          <div class="mp12-on">${on.map(([k, ic]) => `<i title="${k}">${I(ic, 'xs')}</i>`).join('')}</div>
          <span class="grow"></span>
          ${Cloud.loggedIn() ? `<button class="mp12-rb" data-act="spotSuggest" aria-label="Sugerir ponto">${I('plus')}</button>` : ''}
          <button class="mp12-rb" data-act="mapCenter" aria-label="Minha posição">${I('nav')}</button>
        </div></div>
      <section class="map-sheet mp12-sheet" id="mapSheet"><i class="m-grip"></i><div class="ra3-sk sm"><b></b><b></b><b></b></div></section>
    </main>`);
    const c = Geo.home(), R = Zones.RADIUS_KM * 1000;
    const map = this.map('bigMap', { attr: true, minZoom: 10, maxZoom: 18, maxBoundsViscosity: 0.9 });
    if (!map) return;
    this.bigMap = map; this.mapCenter = c;
    map.setView(c, 13);
    const ring = L.circle(c, { radius: R, color: '#1F6BFF', weight: 1.2, opacity: 0.45, dashArray: '4 8', fill: false, interactive: false }).addTo(map);
    map.setMaxBounds(ring.getBounds().pad(0.15));
    // ordem das camadas: treinos por baixo, territórios no meio, rotas e pontos por cima
    this.mapGroups = { acts: L.featureGroup().addTo(map), zones: L.featureGroup().addTo(map), routes: L.featureGroup().addTo(map), spots: L.featureGroup().addTo(map) };
    clearInterval(this._spotT); this._spotT = setInterval(() => { if (App.tab !== 'mapa') return clearInterval(this._spotT); if (App.mapLayers.spots) Spots.draw(this.bigMap, this.mapGroups.spots).then(() => this.spotList()).catch(() => {}); }, 60000);
    if (Cloud.loggedIn()) Geo.locate(false).catch(() => {});
    this.youDot(map, c);
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 250);
    this._zonesCloud = null;
    this.mapaDraw();
    if (lay.explore) setTimeout(() => Explore.show(map, true), 600);
    if (Cloud.loggedIn()) Cloud.zonesNear(c[0], c[1], Zones.RADIUS_KM).then((z) => { this._zonesCloud = z; loadOwnerColors(z); this.mapaDraw(); }).catch((e) => { console.error(e); this._zonesErr = true; this.mapaDraw(); });
    if (!Geo.hasHome() && 'geolocation' in navigator) navigator.geolocation.getCurrentPosition((p) => { Geo.remember(p.coords.latitude, p.coords.longitude); if (App.tab === 'mapa') this.mapa(); }, () => {}, { enableHighAccuracy: true, timeout: 15000 });
  };

  UI.mapaDraw = function () {
    const map = this.bigMap, G = this.mapGroups, lay = App.mapLayers; if (!map || !G || !$('#bigMap')) return;
    Object.values(G).forEach((g) => { if (g !== G.spots) g.clearLayers(); });
    if (lay.spots && Cloud.loggedIn()) Spots.draw(map, G.spots).then(() => this.spotList()).catch(() => {}); else G.spots.clearLayers();
    const c = this.mapCenter, R = Zones.RADIUS_KM * 1000, near = (p) => Geo.dist(p, c) <= R * 1.1;
    const me = Cloud.user && Cloud.user.id, cloud = this._zonesCloud;
    const zones = cloud ? cloud.map((z) => ({ ...z, mine: z.owner === me })) : Zones.mine().map((z) => ({ ...z, mine: true, owner_name: Store.data.profile.name }));
    if (cloud && Cloud.loggedIn()) {
      Zones.pendingOf(cloud).forEach((z) => zones.push({ ...z, mine: true, pending: z.why, owner: me, owner_name: Store.data.profile.name }));
      if (!this._zSynced) { this._zSynced = true; setTimeout(() => Zones.sync().catch(() => {}), 800); }
    }
    const inR = zones.filter((z) => near(Zones.center(z.poly)));
    if (lay.zones) inR.forEach((z) => {
      const col = ownerColor(z);
      L.polygon(z.poly, { color: col, weight: z.mine ? 2.5 : 1.8, fillColor: col, fillOpacity: lay.acts ? 0.16 : z.mine ? 0.3 : 0.22, dashArray: z.pending ? '6 6' : null })
        .bindPopup(`<div class="mp12-pop"><i style="background:${col}"></i><div><b>${z.pending ? ({ home: 'Sua área · só no seu aparelho', private: 'Sua área · treino "Só eu"', flagged: 'Sua área · treino suspeito' }[z.pending] || 'Sua área (enviando…)') : z.mine ? 'Sua área' : esc(z.owner_name || 'Atleta')}</b><small>${Zones.areaTxt(z.area)}${z.prev_owner_name ? ` · roubada de ${esc(z.prev_owner_name)}` : ''}</small>${!z.mine && z.owner ? `<button data-act="userOpen" data-v="${z.owner}">Ver perfil</button>` : ''}</div></div>`).addTo(G.zones);
      if (z.mine && !z.pending && typeof Pass !== 'undefined') { const fm = Pass.flagMarker(z); if (fm) fm.addTo(G.zones); }
    });
    if (lay.acts) Game.acts().filter((a) => a.points && a.points.length > 1 && near(a.points[0])).slice(-80).forEach((a) => L.polyline(Geo.segments(a.points), { color: (CONFIG.sports[a.sport] || CONFIG.sports.run).color, weight: 2.2, opacity: 0.7, interactive: false }).addTo(G.acts));
    if (lay.routes) Store.data.routes.filter((r) => r.points.length && near(r.points[0])).forEach((r) => L.polyline(r.points.map((p) => [p[0], p[1]]), { color: '#111317', weight: 4, opacity: 0.85, dashArray: r.segment ? '2 8' : null }).bindPopup(`<b>${esc(r.name)}</b><br>${Fmt.km(r.distance)} km`).addTo(G.routes));
    // painel
    const mineZ = inR.filter((z) => z.mine), mineArea = Zones.totalArea(mineZ);
    const owners = {}; inR.forEach((z) => { const k = z.owner || 'me'; const o = owners[k] || (owners[k] = { id: z.owner, name: z.mine ? 'Você' : z.owner_name || 'Atleta', n: 0, a: 0, mine: z.mine, col: ownerColor(z) }); o.n++; o.a += z.area; });
    const top = Object.values(owners).sort((x, y) => y.a - x.a).slice(0, 5), totA = Object.values(owners).reduce((s, o) => s + o.a, 0) || 1;
    const sheet = $('#mapSheet'); if (!sheet) return;
    sheet.innerHTML = `<i class="m-grip"></i>
      <div class="mp12-h"><div><b>Território da região</b><small>${I('mapPin', 'xs')} ${Zones.RADIUS_KM} km ao seu redor</small></div>${Cloud.loggedIn() ? '' : '<button class="btn primary sm" data-act="go" data-v="account">Entrar</button>'}</div>
      <div class="mp12-st"><div><b class="num">${Zones.areaTxt(mineArea)}</b><small>sua área</small></div><div><b class="num">${mineZ.length}</b><small>${mineZ.length === 1 ? 'área sua' : 'áreas suas'}</small></div><div><b class="num">${inR.length}</b><small>na região</small></div></div>
      ${top.length ? `<div class="mp12-share">${Object.values(owners).sort((x, y) => y.a - x.a).map((o) => `<i style="flex:${o.a};background:${o.col}"></i>`).join('')}</div>
        <div class="mp12-rk">${top.map((o, i) => `<button class="mp12-r ${o.mine ? 'me' : ''}" ${o.mine || !o.id ? '' : `data-act="userOpen" data-v="${o.id}"`}><span class="num">${i + 1}</span><i style="background:${o.col}"></i><b class="grow">${esc(o.name)}</b><small class="num">${Zones.areaTxt(o.a)} · ${Math.round((o.a / totA) * 100)}%</small></button>`).join('')}</div>`
        : `<div class="mp12-empty">${I('flag')}<div><b>Ninguém conquistou nada aqui ainda</b><small>Feche um circuito correndo ou pedalando e a área de dentro vira sua.</small></div></div>`}
      <div id="spotList"></div>
      <details class="mp12-how"><summary>${I('info', 'xs')} Como conquistar e roubar território</summary><p>Corra ou pedale e volte ao mesmo ponto, fechando um circuito: a área de dentro vira sua. <b>Para roubar</b>, feche um circuito por cima de pelo menos metade da área de outra pessoa. ${Shop.val('frame') ? '' : 'Compre uma <b>moldura</b> na loja e seu território ganha a cor dela.'}</p></details>
      ${!Cloud.loggedIn() ? '<p class="muted small">Sem conta, você vê só as suas áreas.</p>' : this._zonesErr ? '<p class="muted small">Não foi possível carregar as áreas dos outros atletas agora.</p>' : ''}`;
    if (lay.spots) this.spotList();
  };

  // janela de camadas
  App.actions.mapLayers = async () => {
    const lay = App.mapLayers;
    const cnt = { acts: Game.acts().filter((a) => a.points && a.points.length > 1).length, routes: (Store.data.routes || []).length };
    const v = await FX.modal(`<h3>Camadas do mapa</h3><div class="mp12-ls">${LAYERS.map(([k, ic, n, d]) => `<label class="mp12-l"><span class="mp12-li">${I(ic)}</span><div class="grow"><b>${n}${cnt[k] != null ? ` <em class="num">${cnt[k]}</em>` : ''}</b><small>${d}</small></div><input type="checkbox" id="ly_${k}" ${lay[k] ? 'checked' : ''}><i class="mp12-sw"></i></label>`).join('')}</div>
      <div class="row2"><button class="btn ghost" data-m="no">Cancelar</button><button class="btn primary" data-m="ok">Aplicar</button></div>`);
    if (v !== 'ok') return;
    const F = FX.form || {}, before = { ...lay };
    LAYERS.forEach(([k]) => { lay[k] = !!F['ly_' + k]; });
    if (lay.routes && !before.routes && !cnt.routes) FX.toast('Você ainda não salvou rotas. Abra um treino e toque em “Salvar rota”.');
    if (lay.acts && !before.acts && !cnt.acts) FX.toast('Seus treinos com GPS aparecem aqui.');
    if (before.explore && !lay.explore) try { Explore.show(UI.bigMap, false); } catch (e) {}
    UI.mapa();
  };
})();

/* =========================================================
   v12.2 · Final de treino que emociona + vibração
   Tela cheia: o trajeto se desenha, os números sobem e o território pinta.
   Depois: Compartilhar ou Ver resumo. Só então vêm as janelas de nível/desbloqueio.
   ========================================================= */
(() => {
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  // projeta trajeto e áreas no mesmo desenho
  const project = (pts, extra, W, H, pad) => {
    const all = [...pts, ...extra.flat()]; if (all.length < 2) return null;
    const lat0 = (all[0][0] * Math.PI) / 180, xy = (p) => [p[1] * Math.cos(lat0), -p[0]];
    const P = all.map(xy), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = Math.min((W - pad * 2) / (maxX - minX || 1e-9), (H - pad * 2) / (maxY - minY || 1e-9));
    const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
    return (p) => { const [x, y] = xy(p); return [(ox + (x - minX) * sc).toFixed(1), (oy + (y - minY) * sc).toFixed(1)]; };
  };
  const countUp = (el, to, fmt, ms) => {
    if (!el) return;
    if (reduce()) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  FX.finale = function (act, res) {
    return new Promise((done) => {
      try {
        const sp = CONFIG.sports[act.sport] || CONFIG.sports.run, avg = act.duration ? act.distance / act.duration : 0;
        const segs = act.points && act.points.length > 1 ? Geo.segments(act.points) : [];
        const loops = (res && res.zones && res.zones.loops) || [], nNew = res && res.zones ? res.zones.nNew : 0;
        const W = 340, H = 300, f = segs.length ? project(segs.flat(), loops.map((l) => l.poly), W, H, 26) : null;
        const step = Math.max(1, Math.floor(segs.flat().length / 400));
        const path = f ? segs.map((sg) => 'M' + sg.filter((_, i) => i % step === 0 || i === sg.length - 1).map((p) => f(p).join(',')).join('L')).join('') : '';
        const polys = f ? loops.map((l) => `<path class="fn12-zone" d="M${l.poly.map((p) => f(p).join(',')).join('L')}Z"/>`).join('') : '';
        const last = segs.length && segs[segs.length - 1], s0 = f && f(segs[0][0]), e0 = f && f(last[last.length - 1]);
        const chips = [];
        if (res && !act.flagged) {
          chips.push(`<span>${I('zap', 'xs')} +${res.xp} XP</span>`);
          if (res.missions.length) chips.push(`<span>${I('target', 'xs')} ${res.missions.length} ${res.missions.length === 1 ? 'missão' : 'missões'}</span>`);
          if (res.records.some((r) => r.broken)) chips.push(`<span class="gold">${I('trophy', 'xs')} Recorde!</span>`);
          if (res.medals.length) chips.push(`<span class="gold">${I('medal', 'xs')} Medalha</span>`);
        }
        const zoneTxt = nNew ? `+${Zones.areaTxt(res.zones.aNew)} de território` : loops.length ? 'Circuito fechado' : '';
        const el = document.createElement('div');
        el.className = 'fn12'; el.style.setProperty('--c', sp.color);
        const zc = UI.myZoneColor ? UI.myZoneColor() : sp.color;
        el.style.setProperty('--z', zc);
        el.innerHTML = `<div class="fn12-in">
          <div class="fn12-k">${I(sp.icon, 'xs')} ${esc(sp.name)} concluída</div>
          <h2 class="fn12-t">${esc(UI.actTitle(act))}</h2>
          <div class="fn12-art">${f ? `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${polys}<path class="fn12-sh" d="${path}"/><path class="fn12-ln" d="${path}" pathLength="1000"/><circle class="fn12-s" cx="${s0[0]}" cy="${s0[1]}" r="6"/><circle class="fn12-e" cx="${e0[0]}" cy="${e0[1]}" r="7"/></svg>` : `<div class="fn12-noart">${I(sp.icon)}</div>`}
            ${zoneTxt ? `<span class="fn12-zt">${I('flag', 'xs')} ${zoneTxt}</span>` : ''}</div>
          <div class="fn12-big"><b class="num" id="fnKm">0,00</b><small>km</small></div>
          <div class="fn12-row"><div><b class="num" id="fnT">0:00</b><small>tempo</small></div><div><b class="num">${Fmt.pace(act.sport, avg)}</b><small>${Fmt.paceUnit(act.sport)}</small></div><div><b class="num">${Game.calories(act)}</b><small>kcal</small></div></div>
          ${chips.length ? `<div class="fn12-ch">${chips.join('')}</div>` : ''}
          <div class="fn12-btns"><button class="btn ghost" data-fn="share">${I('share', 'xs')} Compartilhar</button><button class="btn primary" data-fn="ok">Ver resumo</button></div>
        </div>`;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('on'));
        const nv = $('#nav'); if (nv) nv.style.visibility = 'hidden';
        countUp($('#fnKm'), act.distance, (v) => Fmt.km(v), 1400);
        countUp($('#fnT'), act.duration, (v) => Fmt.time(Math.round(v)), 1400);
        // ritmo da animação: traço (1,6 s) → território (pinta) → vibração
        setTimeout(() => { FX.vibrate([40]); }, 300);
        setTimeout(() => { el.classList.add('drawn'); FX.vibrate(nNew ? [70, 50, 140] : [90]); if (nNew) FX.beep && FX.beep([523, 659, 784]); }, reduce() ? 0 : 1800);
        const close = (how) => {
          el.classList.remove('on'); if (nv) nv.style.visibility = '';
          setTimeout(() => el.remove(), 260);
          if (how === 'share') setTimeout(() => App.actions.shareCard({ dataset: { v: act.id } }), 280);
          done();
        };
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-fn]'); if (b) close(b.dataset.fn); });
      } catch (e) { console.warn('finale', e); done(); }
    });
  };

  // aparece antes das janelas de desbloqueio/nível
  const cel0 = FX.celebrate.bind(FX);
  FX.celebrate = async function (res) {
    try {
      const act = App.tab === 'summary' ? [...Store.data.activities].sort((a, b) => b.start - a.start)[0] : null;
      if (act && res) { FX.finish(); await FX.finale(act, res); }
    } catch (e) {}
    return cel0(res);
  };

  // vibração nos momentos certos
  const like0 = App.actions.like;
  App.actions.like = async (el) => { if (el && el.dataset.on !== '1') FX.vibrate([25]); return like0(el); };
  const claim0 = Game.claimMissions && Game.claimMissions.bind(Game);
  if (claim0) Game.claimMissions = function (...a) { const g = claim0(...a); if (g.length) FX.vibrate([60, 40, 60]); return g; };
})();

/* =========================================================
   v12.3 · Primeiros 60 segundos
   Cadastro em 2 passos (a meta vem sugerida pelo nível) e, no fim,
   um convite direto para o primeiro treino explicando o território.
   ========================================================= */
UI.firstRun = function (P) {
  const sp = CONFIG.sports[App.sport] || CONFIG.sports.run;
  FX.modal(`<div class="fr12">
      <svg class="fr12-art" viewBox="0 0 220 130" aria-hidden="true">
        <path class="g" d="M0 30h220M0 70h220M0 110h220M40 0v130M100 0v130M160 0v130"/>
        <path class="z" d="M58 94C40 70 52 34 92 30s84 4 82 38-40 44-70 40-36-4-46-14Z"/>
        <path class="r" d="M58 94C40 70 52 34 92 30s84 4 82 38-40 44-70 40-36-4-46-14Z"/>
        <circle cx="58" cy="94" r="7" class="s"/>
      </svg>
      <span class="fr12-k">Tudo pronto, ${esc((P.name || 'atleta').split(' ')[0])}!</span>
      <h3>Seu primeiro treino vale território</h3>
      <p>Dê uma volta e termine onde começou: a área de dentro do circuito vira sua no mapa. Pode ser uma volta no quarteirão.</p>
      <ul><li>${I('target', 'xs')} 3 missões de hoje já valendo XP</li><li>${I('flag', 'xs')} Sua primeira área no mapa da cidade</li></ul>
      <div class="row2"><button class="btn ghost" data-m="later">Depois</button><button class="btn primary" data-m="go">${I(sp.icon, 'xs')} Gravar agora</button></div>
    </div>`).then((v) => { if (v === 'go') App.go('record'); });
};
(() => {
  // no final do primeiro treino: selo especial
  const fin0 = FX.finale;
  FX.finale = function (act, res) {
    const p = fin0(act, res);
    try { if (Store.data.activities.length === 1) { const ch = $('.fn12-ch') || ($('.fn12-big') && $('.fn12-big').insertAdjacentHTML('afterend', '<div class="fn12-ch"></div>'), $('.fn12-ch')); if (ch) ch.insertAdjacentHTML('afterbegin', `<span class="gold">${I('sparkles', 'xs')} Primeiro treino!</span>`); } } catch (e) {}
    return p;
  };
})();

/* =========================================================
   v12.4 · Funil (eventos anônimos)
   Só um código aleatório do aparelho + o tipo do evento. Sem nome, e-mail ou conta.
   Tabela app_events (supabase/funil.sql). Se ela não existir, nada acontece.
   ========================================================= */
const Funnel = {
  key: 'justgo_dev',
  dev() { let d = null; try { d = localStorage.getItem(this.key); } catch (e) {} if (!d) { d = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now(); try { localStorage.setItem(this.key, d); } catch (e) {} } return d; },
  once(k) { try { if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1'); return true; } catch (e) { return false; } },
  track(kind, unique) {
    try {
      if (!Cloud.sb) return;
      const day = new Date().toISOString().slice(0, 10);
      if (unique === 'day' && !this.once(`jg_ev_${kind}_${day}`)) return;
      if (unique === 'ever' && !this.once(`jg_ev_${kind}`)) return;
      Cloud.sb.from('app_events').insert({ dev: this.dev(), kind, ver: CONFIG.version }).then(() => {}, () => {});
    } catch (e) {}
  },
};
window.Funnel = Funnel;
(() => {
  setTimeout(() => { Funnel.track('first_open', 'ever'); Funnel.track('open', 'day'); }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Funnel.track('open', 'day'); });
  const fr0 = UI.firstRun.bind(UI);
  UI.firstRun = function (...a) { Funnel.track('signup', 'ever'); return fr0(...a); };
  const rec0 = UI.record.bind(UI);
  UI.record = function (...a) { Funnel.track('record_open', 'day'); return rec0(...a); };
  const fa0 = App.finalizeActivity.bind(App);
  App.finalizeActivity = function (act, ...a) { const r = fa0(act, ...a); Funnel.track('activity'); Funnel.track('first_activity', 'ever'); return r; };
})();

/* =========================================================
   v12.5 · Widget da tela inicial e treinos do relógio (Health Connect)
   Precisa do app nativo 39+ (AAB 2.40). Em versões antigas, nada aparece.
   ========================================================= */
const NativeX = {
  build: 0,
  async ver() { if (!Native.on) return 0; if (this.build) return this.build; const v = await Native.call('version', {}, 5000).catch(() => null); this.build = (v && v.native) || 0; return this.build; },
};
window.NativeX = NativeX;

const JgWidget = {
  async push() {
    try {
      if (!Native.on || !Store.data || (await NativeX.ver()) < 39) return;
      const P = Store.data.profile, wk = Game.km(Game.scope('week', Date.now())), goal = P.goalWeek || 10, pct = Math.min(100, (wk / goal) * 100), st = Game.streakDays();
      await Native.call('widget', { km: Fmt.num(wk), goal: `de ${goal} km · ${Math.round(pct)}% da meta`, pct: String(Math.round(pct)), streak: st ? `🔥 ${st} ${st === 1 ? 'dia' : 'dias'} seguidos` : 'Treine hoje e comece uma ofensiva' }, 8000);
    } catch (e) {}
  },
};
window.JgWidget = JgWidget;

const HC = {
  SPORT: { RUNNING: 'run', RUNNING_TREADMILL: 'run', BIKING: 'ride', BIKING_STATIONARY: 'ride', SWIMMING_POOL: 'swim', SWIMMING_OPEN_WATER: 'swim', WALKING: 'walk', HIKING: 'hike', SKATING: 'skate', ROLLER_SKATING: 'skate', SKATEBOARDING: 'board', ROWING: 'paddle', PADDLING: 'paddle', KAYAKING: 'paddle', CANOEING: 'paddle' },
  async ok() { return Native.on && (await NativeX.ver()) >= 39; },
  async connect() {
    if (!(await this.ok())) return FX.modal(`<div class="m-hero">${I('watch')}</div><h3>Atualize o app</h3><p class="muted">Para trazer treinos do relógio, instale a versão mais nova do JustGo pela Play Store.</p><button class="btn primary" data-m="ok">Entendi</button>`);
    const st = await Native.call('hcState', {}, 10000).catch(() => null);
    if (st && st.granted) { Store.data.profile.hcOn = true; Store.save(); return this.import(30); }
    const v = await FX.modal(`<div class="m-hero">${I('watch')}</div><h3>Treinos do relógio</h3><p class="muted">O JustGo lê os treinos que seu relógio (Samsung, Garmin, Xiaomi, Polar…) salva no <b>Health Connect</b> do Android. Só leitura: tipo de treino, horário, distância e calorias.</p><p class="muted small">Treinos do relógio não têm trajeto no mapa, então não conquistam território. Valem para km, missões, ofensiva e rankings.</p><div class="row2"><button class="btn ghost" data-m="no">Agora não</button><button class="btn primary" data-m="yes">Conectar</button></div>`);
    if (v !== 'yes') return;
    const r = await Native.call('hcAsk', {}, 120000).catch(() => null);
    if (r && r.install) return FX.toast('Instale ou atualize o Health Connect na Play Store e tente de novo.');
    if (!r || !r.ok) return FX.toast('Sem permissão do Health Connect.');
    Store.data.profile.hcOn = true; Store.save();
    FX.toast('Relógio conectado!');
    return this.import(30);
  },
  async import(days = 7, quiet = false) {
    try {
      if (!(await this.ok())) return 0;
      const r = await Native.call('hcRead', { days }, 30000).catch(() => null);
      if (!r || !r.ok) { if (!quiet) FX.toast('Não consegui ler o Health Connect agora.'); return 0; }
      const D = Store.data, have = new Set(D.activities.map((a) => a.hcId).filter(Boolean));
      let n = 0, xp = 0;
      (r.list || []).sort((a, b) => a.from - b.from).forEach((w) => {
        const sport = this.SPORT[w.type]; if (!sport || have.has(w.id)) return;
        const dur = Math.round((w.to - w.from) / 1000); if (dur < 300) return;
        // gravado também pelo JustGo ao mesmo tempo: não conta duas vezes
        if (D.activities.some((a) => Math.abs(a.start - w.from) < 10 * 60e3 && a.sport === sport)) return;
        const act = { id: uid(), hcId: w.id, sport, start: w.from, duration: dur, elapsed: dur, distance: Math.round(w.dist || 0), points: [], mode: 'watch', title: '', kcal: w.kcal || null, src: w.src || '' };
        Game.validate(act); D.activities.push(act); const res = Game.process(act); xp += res.xp || 0; n++;
        Cloud.publish(act).catch(() => {});
      });
      D.hcLast = Date.now(); Store.save();
      if (n) { FX.toast(`${n} ${n === 1 ? 'treino importado' : 'treinos importados'} do relógio · +${xp} XP`); JgWidget.push(); if (['home', 'history', 'profile'].includes(App.tab)) App.go(App.tab); }
      else if (!quiet) FX.toast('Nenhum treino novo no relógio.');
      return n;
    } catch (e) { console.warn('hc', e); if (!quiet) FX.toast('Não consegui importar do relógio.'); return 0; }
  },
};
window.HC = HC;
App.actions.hcConnect = () => HC.connect();
App.actions.hcImport = () => HC.import(30);

(() => {
  // widget: ao abrir, ao sair do app e depois de cada treino
  setTimeout(() => JgWidget.push(), 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) JgWidget.push(); else if (Store.data && Store.data.profile.hcOn && Date.now() - (Store.data.hcLast || 0) > 3 * 3600e3) HC.import(7, true); });
  setTimeout(() => { if (Store.data && Store.data.profile.hcOn) HC.import(7, true); }, 7000);
  const fa = App.finalizeActivity.bind(App);
  App.finalizeActivity = function (...a) { const r = fa(...a); setTimeout(() => JgWidget.push(), 1500); return r; };
  // Configurações: linha "Relógio e Samsung Health"; Atividades: botão de importar
  const set0 = UI.settings.bind(UI);
  UI.settings = function (...a) {
    const r = set0(...a);
    try {
      const g = [...document.querySelectorAll('h3.group')].find((h) => /Treino/.test(h.textContent)), list = g && g.nextElementSibling;
      if (list && Native.on) list.insertAdjacentHTML('afterbegin', `<button class="cfg-row tap" data-act="${Store.data.profile.hcOn ? 'hcImport' : 'hcConnect'}">${this.iconBox('watch')}<div class="grow"><b>Relógio e Samsung Health</b><small>${Store.data.profile.hcOn ? `Conectado · ${Store.data.hcLast ? 'última busca ' + this.ago(Store.data.hcLast) : 'buscando treinos'}` : 'Traga os treinos do seu relógio pelo Health Connect'}</small></div>${I('chevronRight', 'chev')}</button>`);
    } catch (e) {}
    return r;
  };
  const his0 = UI.history.bind(UI);
  UI.history = function (...a) {
    const r = his0(...a);
    try { const gp = $('#gpxIn'); if (gp && Native.on) gp.closest('label').insertAdjacentHTML('afterend', `<button class="chip-btn" data-act="${Store.data.profile.hcOn ? 'hcImport' : 'hcConnect'}">${I('watch')}Relógio</button>`); } catch (e) {}
    return r;
  };
})();
// calorias medidas pelo relógio valem mais que a estimativa
(() => { const c0 = Game.calories.bind(Game); Game.calories = function (a, ...r) { return a && a.kcal > 0 ? Math.round(a.kcal) : c0(a, ...r); }; })();
