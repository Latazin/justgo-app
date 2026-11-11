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
