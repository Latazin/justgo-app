/* =========================================================
   JustGo — v11 · Perfil, curtidas, comentários e treino de outra pessoa
   Ideia visual: cada atleta é o mapa dos próprios treinos.
   - A capa do perfil é desenhada com o último trajeto da pessoa
     sobre curvas de nível (como num mapa de trilha), na cor do esporte.
   - Curtidas mostram QUEM curtiu (rostos empilhados), como no Strava.
   - O treino de outra pessoa abre com o mapa inteiro, números grandes
     e a conversa logo abaixo.
   Carrega depois de comments.js (substitui partes de ui.js, ui-social*.js,
   ui-v8.js e comments.js).
   ========================================================= */
(() => {
  const SP = (k) => CONFIG.sports[k] || CONFIG.sports.run;
  const T = (t) => (typeof t === 'string' ? Date.parse(t) : t);
  const first = (n) => esc((n || 'Atleta').split(' ')[0]);
  // pontos da nuvem ([lat,lng,...,pausa]) no formato local
  const fromRoute = (r) => (r || []).filter((q) => q && q[0] != null).map((q) => (q[4] ? [q[0], q[1], 0, null, 1] : [q[0], q[1], 0]));
  const seedOf = (s) => { let h = 7; String(s || 'x').split('').forEach((c) => (h = (h * 31 + c.charCodeAt(0)) >>> 0)); return h; };

  const V11 = {
    /* curvas de nível: anéis irregulares, sempre iguais para a mesma pessoa */
    topo(seed, W = 400, H = 170) {
      let s = seed || 1; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      const centers = [[W * (0.15 + rnd() * 0.25), H * (0.2 + rnd() * 0.6)], [W * (0.6 + rnd() * 0.3), H * (0.1 + rnd() * 0.8)]];
      let d = '';
      centers.forEach(([cx, cy], ci) => {
        const p1 = rnd() * 6.28, p2 = rnd() * 6.28, n = ci ? 9 : 7;
        for (let k = 1; k <= n; k++) {
          const R = 14 + k * (ci ? 19 : 22);
          let path = '';
          for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * Math.PI * 2, r = R * (1 + 0.16 * Math.sin(3 * a + p1 + k * 0.25) + 0.08 * Math.sin(5 * a + p2 - k * 0.2));
            path += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r * 1.25).toFixed(1)},${(cy + Math.sin(a) * r * 0.82).toFixed(1)}`;
          }
          d += path + 'Z';
        }
      });
      return d;
    },
    /* trajeto encaixado numa caixa (x, y, largura, altura) */
    routePath(points, bx, by, bw, bh) {
      const segs = Geo.segments(points || []);
      if (!segs.length) return null;
      const all = segs.flat(); if (all.length < 2) return null;
      const lat0 = (all[0][0] * Math.PI) / 180, xy = (p) => [p[1] * Math.cos(lat0), -p[0]];
      const P = all.map(xy), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const sc = Math.min(bw / (maxX - minX || 1e-9), bh / (maxY - minY || 1e-9));
      const ox = bx + (bw - (maxX - minX) * sc) / 2, oy = by + (bh - (maxY - minY) * sc) / 2;
      const step = Math.max(1, Math.floor(all.length / 260));
      const f = (p) => { const [x, y] = xy(p); return [(ox + (x - minX) * sc).toFixed(1), (oy + (y - minY) * sc).toFixed(1)]; };
      const d = segs.map((sg) => 'M' + sg.filter((_, i) => i % step === 0 || i === sg.length - 1).map((p) => f(p).join(',')).join('L')).join('');
      return { d, s: f(all[0]), e: f(all[all.length - 1]) };
    },
    /* capa: cor do esporte + curvas de nível + último trajeto */
    cover(points, color, seed, extra = '') {
      const r = this.routePath(points, 118, 30, 170, 108);
      return `<div class="cv11" style="--c:${color}">
        <svg class="cv11-topo" viewBox="0 0 400 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path d="${this.topo(seed)}"/></svg>
        ${r ? `<svg class="cv11-rt" viewBox="0 0 400 170" preserveAspectRatio="xMaxYMid meet" aria-hidden="true"><path class="sh" d="${r.d}"/><path class="ln" d="${r.d}"/><circle cx="${r.s[0]}" cy="${r.s[1]}" r="5" class="st"/><circle cx="${r.e[0]}" cy="${r.e[1]}" r="5" class="en"/></svg>` : ''}
        ${extra}</div>`;
    },
    /* rostos empilhados */
    stack(list, n = 3) {
      return `<span class="k11-stack">${list.slice(0, n).map((p) => UI.avatarOf(p.name, null, p.avatar, 'xs', p.photo)).join('')}</span>`;
    },
    /* "Curtido por Bia, João e mais 3" */
    likedBy(total, people, liked) {
      const me = Cloud.user && Cloud.user.id;
      const others = (people || []).filter((p) => p && p.id !== me);
      const names = [];
      if (liked) names.push('você');
      others.slice(0, liked ? 1 : 2).forEach((p) => names.push(first(p.name)));
      const rest = Math.max(0, total - names.length);
      if (!names.length) return `<b class="num">${total}</b> ${total === 1 ? 'curtida' : 'curtidas'}`;
      return `Curtido por <b>${names.join('</b>, <b>')}</b>${rest ? ` e mais <b class="num">${rest}</b>` : ''}`;
    },
    // pessoas que curtiram aparecem primeiro se você as segue
    order(ids) {
      const fol = Cloud._fol || new Set(), me = Cloud.user && Cloud.user.id;
      return [...ids].sort((a, b) => (b === me) - (a === me) || fol.has(b) - fol.has(a));
    },
  };
  window.V11 = V11;

  /* ---------------- dados: quem curtiu e o último comentário ---------------- */
  const react0 = Cloud.withReactions.bind(Cloud);
  Cloud.withReactions = async function (list) {
    if (!list || !list.length) return [];
    try {
      const aids = list.map((a) => a.id);
      let cm = await this.sb.from('comments').select('activity_id,user_id,text,created_at').in('activity_id', aids);
      if (cm.error) cm = await this.sb.from('comments').select('activity_id').in('activity_id', aids);
      const lk = await this.sb.from('likes').select('activity_id,user_id').in('activity_id', aids);
      if (lk.error) throw lk.error;
      const me = this.user.id, want = new Set();
      list.forEach((a) => {
        const L = (lk.data || []).filter((x) => x.activity_id === a.id).map((x) => x.user_id);
        a.likes = L.length; a.liked = L.includes(me);
        a.likerIds = V11.order(L).filter((id) => id !== me).slice(0, 3);
        a.likerIds.forEach((id) => want.add(id));
        const C = (cm.data || []).filter((x) => x.activity_id === a.id);
        a.comments = C.length;
        const last = C.filter((x) => x.text).sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))[0];
        a.lastCm = last ? { user_id: last.user_id, text: last.text } : null;
        if (last) want.add(last.user_id);
      });
      if (want.size) {
        const known = UI._people || {}, miss = [...want].filter((id) => !known[id] || !known[id].name);
        if (miss.length) { const { data } = await this.sb.from('profiles').select('*').in('id', miss); (data || []).forEach((p) => UI.keep(p)); }
        const P = (id) => (UI._people || {})[id] || { id, name: 'Atleta' };
        list.forEach((a) => { a.likerP = (a.likerIds || []).map(P); if (a.lastCm) a.lastCm.p = P(a.lastCm.user_id); });
      }
      return list;
    } catch (e) { console.warn('JustGo reações:', e && e.message); return react0(list); }
  };
  // lista completa de quem curtiu
  Cloud.likers = async function (aid) {
    const { data, error } = await this.sb.from('likes').select('user_id').eq('activity_id', aid);
    if (error) throw error;
    const ids = V11.order((data || []).map((x) => x.user_id));
    if (!ids.length) return [];
    const { data: ps } = await this.sb.from('profiles').select('*').in('id', ids);
    const M = new Map((ps || []).map((p) => [p.id, UI.keep(p)]));
    return ids.map((id) => M.get(id) || { id, name: 'Atleta' });
  };
  // perfil público: mais treinos para o resumo dos últimos 30 dias
  Cloud.profileOf = async function (id) {
    const { data: p } = await this.sb.from('profiles').select('*').eq('id', id).single();
    const a = await this.acts(this.sb.from('activities').select('*').eq('user_id', id).order('start', { ascending: false }).limit(24));
    const { count: followers } = await this.sb.from('follows').select('*', { count: 'exact', head: true }).eq('following', id);
    let following = null;
    try { const r = await this.sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower', id); following = r.count; } catch (e) {}
    return { p, acts: a || [], followers: followers || 0, following };
  };

  /* ---------------- post do feed: rostos de quem curtiu + último comentário ---------------- */
  const post0 = UI.remotePost.bind(UI);
  UI.remotePost = function (a, opts = {}) {
    let h = post0(a, opts);
    if (!h || opts.noFoot) return h;
    const n = a.likes || 0, c = a.comments || 0;
    let soc = '';
    if (n) soc += `<button class="k11" data-act="raLikers" data-v="${esc(a.id)}">${a.likerP && a.likerP.length ? V11.stack(a.likerP) : `<span class="k11-h">${I('heart', 'xs')}</span>`}<span class="k11-t">${V11.likedBy(n, a.likerP, a.liked)}</span></button>`;
    if (a.lastCm && a.lastCm.text) {
      const p = a.lastCm.p || {};
      soc += `<button class="k11-cm" data-act="raOpen" data-cm="1" data-v="${esc(a.id)}"><b>${esc(p.name || 'Atleta')}</b> ${esc(a.lastCm.text.slice(0, 140))}${c > 1 ? `<span>Ver ${c === 2 ? 'os 2 comentários' : `todos os ${c} comentários`}</span>` : ''}</button>`;
    }
    if (soc) h = h.replace('<footer class="p8-f">', `<div class="k11-wrap">${soc}</div><footer class="p8-f">`);
    return h;
  };

  /* ---------------- quem curtiu (folha) ---------------- */
  App.actions.raLikers = async (el) => {
    const aid = el.dataset.v;
    FX.modal(`<div class="lk11"><h3>Curtidas</h3><div id="lk11L">${UI.skel ? UI.skel('rank') : '<p class="muted">Carregando…</p>'}</div><button class="btn ghost" data-m="ok">Fechar</button></div>`);
    let L = []; try { L = await Cloud.likers(aid); } catch (e) {}
    const box = $('#lk11L'); if (!box) return;
    const me = Cloud.user && Cloud.user.id, fol = Cloud._fol || new Set();
    box.innerHTML = L.length ? L.map((p) => `<div class="lk11-r"><button class="tap" data-act="lk11Open" data-v="${p.id}">${UI.avatarOf(p.name, p.frame, p.avatar, 'sm', p.photo)}</button><div class="grow tap" data-act="lk11Open" data-v="${p.id}"><b>${esc(p.name || 'Atleta')}${UI.vb(p.id, p.username)}${p.id === me ? ' <em class="you">você</em>' : ''}</b><small>${p.username ? '@' + esc(p.username) : ''}${p.city ? ' · ' + esc(p.city) : ''}</small></div>${p.id === me ? '' : fol.has(p.id) ? `<span class="lk11-f">Seguindo</span>` : `<button class="btn primary sm" data-act="lk11Follow" data-v="${p.id}">Seguir</button>`}<i class="lk11-h">${I('heart', 'xs')}</i></div>`).join('') : '<p class="muted">Ninguém curtiu ainda.</p>';
  };
  App.actions.lk11Open = (el) => { const m = $('#modal'); if (m) { m.classList.remove('show'); m.innerHTML = ''; } App.actions.userOpen(el); };
  App.actions.lk11Follow = async (el) => { el.disabled = true; try { await Cloud.follow(el.dataset.v); if (Cloud._fol) Cloud._fol.add(el.dataset.v); el.outerHTML = '<span class="lk11-f">Seguindo</span>'; } catch (e) { el.disabled = false; FX.toast('Não deu para seguir agora.'); } };

  // depois de curtir na tela do treino, atualiza "Curtido por…"
  const like0 = App.actions.like;
  App.actions.like = async (el) => {
    const r = await like0(el);
    if (App.tab === 'ract' && $('#ra3Kudos')) UI.ra3Kudos(el.dataset.v);
    return r;
  };

  /* ---------------- comentários: estilo limpo, curtir à direita ---------------- */
  Cm.item = function (c, aid, reply) {
    const p = c.profiles || {}, own = this.owner[aid];
    return `<div class="cm3 ${reply ? 'rep' : ''}" id="cm${c.id}">
      <button class="cm3-av" data-act="userOpen" data-v="${c.user_id}">${UI.avatarOf(p.name, p.frame, p.avatar, reply ? 'xs' : 'sm', p.photo)}</button>
      <div class="cm3-b">
        <div class="cm-bubble"><div class="cm3-h"><b data-act="userOpen" data-v="${c.user_id}">${esc(p.name || 'Atleta')}${UI.vb(c.user_id, p.username)}</b>${c.user_id === own ? '<span class="cm-author">Autor</span>' : ''}<span class="cm3-t">${UI.ago(Date.parse(c.created_at))}</span></div>
        <p>${this.text(c.text)}</p></div>
        <div class="cm3-a">${this.hasV2 !== false ? `<button data-act="cmReply" data-v="${c.id}" data-r="${reply ? c.parent_id : c.id}" data-n="${first(p.name)}">Responder</button>` : ''}${c.ownerLiked ? `<span class="cm-ol">${I('heart', 'xs')} curtido pelo autor</span>` : ''}<button class="cm-more" data-act="cmMore" data-v="${c.id}" data-a="${aid}" data-u="${c.user_id}" aria-label="Mais opções">${I('more', 'xs')}</button></div>
      </div>
      ${this.hasV2 !== false ? `<button class="cm-like cm3-like ${c.liked ? 'on' : ''}" data-act="cmLike" data-v="${c.id}" data-a="${aid}" aria-label="Curtir comentário"><span class="num">${c.likes || ''}</span>${I('heart')}</button>` : ''}
    </div>`;
  };
  const render0 = Cm.render.bind(Cm);
  Cm.render = function (list, aid) {
    if (!list.length) return `<div class="cm3-empty"><div>${['🔥', '👏', '💪'].map((e) => `<button data-act="cmEmoji" data-v="${e}">${e}</button>`).join('')}</div><b>Seja o primeiro a comentar</b><small>Um “boa!” já faz o dia de quem treinou.</small></div>`;
    return render0(list, aid);
  };

  /* ---------------- treino de outra pessoa ---------------- */
  UI.ra3Kudos = async function (aid) {
    const el = $('#ra3Kudos'); if (!el) return;
    let L = []; try { L = await Cloud.likers(aid); } catch (e) { return; }
    if (!$('#ra3Kudos')) return;
    const me = Cloud.user && Cloud.user.id, liked = L.some((p) => p.id === me);
    const shown = [...L.filter((p) => p.id === me), ...L.filter((p) => p.id !== me)];
    el.innerHTML = L.length ? `${V11.stack(shown, 5)}<span class="grow">${V11.likedBy(L.length, L, liked)}</span>${I('chevronRight', 'xs')}` : `<span class="ra3-k0">${I('heart', 'xs')}</span><span class="grow">Seja o primeiro a curtir</span>`;
    if (L.length) el.dataset.act = 'raLikers'; else el.removeAttribute('data-act');
  };

  UI.remote = async function (id, toComments) {
    this.render(`<header class="top sub ra3-top"><div class="top-l"><button class="back" data-act="raBack" aria-label="Voltar">${I('chevronLeft')}</button><b class="ttl">Treino</b></div><div class="top-r" id="ra3R"></div></header>
      <main class="screen ra3" id="raBody"><div class="ra3-sk"><i></i><b></b><b></b></div></main>`);
    let a = null; try { a = await Cloud.activityOne(id); } catch (e) { console.warn(e); }
    const body = $('#raBody'); if (!body || App.tab !== 'ract') return;
    if (!a) { body.innerHTML = `<div class="empty">${I('lock')}<h3>Treino indisponível</h3><p>Ele pode ter sido apagado ou deixado privado.</p></div>`; return; }
    const p = this.keep ? this.keep({ id: a.user_id, ...(a.profiles || {}) }) : (a.profiles || {});
    const me = Cloud.user && Cloud.user.id, self = a.user_id === me, fol = Cloud._fol ? Cloud._fol.has(a.user_id) : null;
    const start = T(a.start), sp = SP(a.sport), st = a.stats || {};
    const avg = a.duration ? a.distance / a.duration : 0, speed = Fmt.isSpeed(a.sport);
    const pts = fromRoute(a.route), hasMap = pts.length > 1;
    const ttl = $('.ra3-top .ttl'); if (ttl) ttl.textContent = sp.name;
    const R = $('#ra3R'); if (R && !self) R.innerHTML = `<button class="icon-btn" data-act="postMenu" data-v="${esc(a.id)}" data-u="${a.user_id}" aria-label="Mais opções">${I('more')}</button>`;
    const sub = [];
    if (st.elev != null) sub.push(['Subida', `${st.elev}<small> m</small>`]);
    if (st.kcal) sub.push(['Calorias', `${Fmt.num(st.kcal, 0)}<small> kcal</small>`]);
    if ((a.elapsed || 0) > (a.duration || 0) + 30) sub.push(['Tempo total', Fmt.time(a.elapsed)]);
    if (a.duration && a.distance && !speed && a.sport !== 'swim') sub.push(['Vel. média', `${Fmt.num(avg * 3.6)}<small> km/h</small>`]);
    if (speed && a.duration && a.distance) sub.push(['Ritmo', `${Fmt.pace('run', avg)}<small> /km</small>`]);
    if (st.weather && st.weather.temp != null) sub.push(['Clima', `${Math.round(st.weather.temp)}°C`]);
    if (a.xp) sub.push(['XP', `+${a.xp}`]);
    const when = new Date(start), dayTxt = this.rel ? this.rel(start) : Fmt.date(start);
    const hour = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const cap = (st.caption || '').trim(), photos = this.photosOf(a);
    const title = typeof Pass !== 'undefined' && Pass.titleChip ? Pass.titleChip(st.pass) : '';
    body.innerHTML = `
      ${hasMap ? `<div class="ra3-map" style="--c:${sp.color}"><div id="raMap" class="s-map"></div><span class="ra3-sp">${I(sp.icon, 'xs')}${sp.name}</span><button class="ra3-3d" data-act="view3d" data-v="${a.id}">${I('box3d')}3D</button></div>`
        : `<div class="ra3-nomap" style="--c:${sp.color}">${V11.cover([], sp.color, seedOf(a.id), `<div class="ra3-nm">${I(sp.icon)}<b class="num">${Fmt.km(a.distance)}<small> km</small></b><span>${st.pool ? 'Natação na piscina' : 'Treino sem trajeto'}</span></div>`)}</div>`}
      <section class="ra3-who">
        <button class="ra3-av" data-act="userOpen" data-v="${a.user_id}">${this.avatarOf(p.name, p.frame, p.avatar, 'md', p.photo)}<i style="--c:${sp.color}">${I(sp.icon, 'xs')}</i></button>
        <div class="grow"><b data-act="userOpen" data-v="${a.user_id}">${esc(p.name || 'Atleta')}${UI.vb(a.user_id, p.username)}${title}</b><small>${esc(dayTxt)} às ${hour}${p.city ? ` · ${esc(p.city)}` : ''}</small></div>
        ${self || fol === null || fol ? '' : `<button class="btn primary sm" data-act="raFollow" data-v="${a.user_id}">${I('userPlus', 'xs')}Seguir</button>`}
      </section>
      <h1 class="ra3-title">${esc(this.actTitle(a))}</h1>
      ${cap ? `<p class="ra3-cap">${esc(cap)}</p>` : ''}
      <section class="ra3-big" style="--c:${sp.color}">
        <div><span>Distância</span><b class="num">${Fmt.km(a.distance)}</b><small>km</small></div>
        <div><span>${Fmt.paceLabel(a.sport, true)}</span><b class="num">${Fmt.pace(a.sport, avg)}</b><small>${Fmt.paceUnit(a.sport)}</small></div>
        <div><span>Tempo</span><b class="num">${Fmt.time(a.duration)}</b><small>em movimento</small></div>
      </section>
      ${sub.length ? `<dl class="ra3-sub">${sub.map(([l, v]) => `<div><dt>${l}</dt><dd class="num">${v}</dd></div>`).join('')}</dl>` : ''}
      ${st.adj ? this.adjCard(st.adj, a.sport) : ''}
      ${photos.length ? `<section class="act-photos ro ra3-ph">${photos.map((u) => `<div class="ap"><img src="${esc(u)}" loading="lazy" alt="Foto do treino" data-act="photoView" data-v="${esc(u)}"></div>`).join('')}</section>` : ''}
      <div class="ra3-bar">
        <button class="ra3-like ${a.liked ? 'on' : ''}" data-act="like" data-v="${a.id}" data-on="${a.liked ? 1 : 0}">${I('heart')}<span class="lb">Curtir</span><span class="num">${a.likes || 0}</span></button>
        <button data-act="raFocus">${I('message')}<span class="lb">Comentar</span></button>
        ${self ? '' : `<button data-act="userOpen" data-v="${a.user_id}">${I('user')}<span class="lb">Perfil</span></button>`}
      </div>
      <button class="ra3-kudos" id="ra3Kudos" data-act="raLikers" data-v="${a.id}"><span class="grow muted">…</span></button>
      <div class="ra3-cmh"><h2>Comentários</h2><span class="num" id="raCmN">${a.comments || 0}</span></div>
      <div id="raCm" class="ra-cm ra3-cm"><div class="ra3-sk sm"><b></b><b></b></div></div>
      ${this.composer('raText', 'raComment', a.id)}`;
    if (hasMap) {
      const m = this.map('raMap', { dragging: !L.Browser.mobile, tap: false, scrollWheelZoom: false });
      if (m) {
        const line = this.routeLine(m, Geo.segments(pts), Shop.lineColor(a.sport), 5);
        this.endpoints(m, pts[0], pts[pts.length - 1]);
        const fit = () => { try { m.invalidateSize(); m.fitBounds(line.getBounds(), { padding: [34, 34] }); } catch (e) {} };
        fit(); setTimeout(fit, 300);
      }
    }
    this.ra3Kudos(a.id);
    await this.raComments(a.id);
    if (toComments) { const t = $('#raText'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  /* ---------------- perfil (o seu) ---------------- */
  UI.pfHero = function (acts, lv, L0, handle, city, medals, zones) {
    const P = Store.data.profile, km = Game.km(acts), streak = Game.streakDays();
    const r = 54, C = 2 * Math.PI * r, pct = Math.max(0.02, Math.min(1, lv.pct / 100));
    const ring = `<svg class="pf3-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" class="bg"/><circle cx="60" cy="60" r="${r}" class="fg" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}"/></svg>`;
    const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime(), month = acts.filter((a) => a.start >= m0);
    const last = [...acts].sort((a, b) => b.start - a.start).find((a) => a.points && a.points.length > 4);
    const best5 = Object.values(Store.data.records || {}).find((x) => /5\s?k|5 km/i.test(x.label || ''));
    const longest = acts.reduce((m, a) => (a.distance > (m ? m.distance : 0) ? a : m), null);
    const hl = [
      ['flame', streak, streak === 1 ? 'dia seguido' : 'dias seguidos', 'Sequência', 'go', 'progress'],
      ['calendar', Fmt.num(Game.km(month), 1), `km em ${now.toLocaleDateString('pt-BR', { month: 'long' })}`, 'Este mês', 'profTab', 'stats'],
      ['flag', zones.length ? Zones.areaTxt(Zones.totalArea()) : '0', zones.length ? `${zones.length} área${zones.length > 1 ? 's' : ''}` : 'feche um circuito', 'Território', 'go', 'mapa'],
      best5 ? ['trophy', Fmt.time(best5.value), 'melhor 5K', 'Recorde', 'profTab', 'achievements'] : longest ? ['trophy', Fmt.km(longest.distance), 'km no maior treino', 'Recorde', 'profTab', 'achievements'] : null,
      ['medal', medals, `de ${CONFIG.medals.length} medalhas`, 'Conquistas', 'profTab', 'achievements'],
    ].filter(Boolean);
    const color = last ? SP(last.sport).color : 'var(--brand)';
    const capTxt = last ? `<span class="cv11-cap">${I(SP(last.sport).icon, 'xs')} ${esc(UI.actTitle(last))} · ${Fmt.km(last.distance)} km</span>` : '';
    return `<section class="pf3 me">
      <div class="pf3-cv">${V11.cover(last ? last.points : [], color, seedOf(P.name), capTxt)}
        <div class="pf3-top"><button class="pf3-ib" data-act="shareProfile" aria-label="Compartilhar perfil">${I('share')}</button><button class="pf3-ib" data-act="go" data-v="settings" aria-label="Configurações">${I('settings')}</button></div></div>
      <div class="pf3-row">
        <button class="pf3-ava" data-act="myPhoto" aria-label="Foto de perfil">${ring}${this.avatar('xl')}<span class="pf3-lv num">${lv.l}</span></button><input type="file" id="photoIn" accept="image/*" hidden>
        <div class="pf3-btns"><button class="btn primary sm" data-act="editProfile">${I('edit', 'xs')} Editar</button><button class="pf3-ib2" data-act="go" data-v="atleta" aria-label="Seu atleta">${I('user')}</button></div>
      </div>
      <div class="pf3-id">
        <h1>${esc(P.name || 'Atleta')}${UI.vb(Cloud.user && Cloud.user.id, Cloud.me && Cloud.me.username)}</h1>
        <p class="pf3-meta">${[handle, city ? `${I('mapPin', 'xs')} ${esc(city)}` : ''].filter(Boolean).join('<i>·</i>')}</p>
        ${Pref('bio') ? `<p class="pf3-bio">${esc(Pref('bio'))}</p>` : `<button class="pf3-addbio" data-act="editProfile">${I('plus', 'xs')} Adicionar bio</button>`}
        <div class="pf3-tags"><span style="--c:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span><span>${I('zap', 'xs')} ${Game.title(lv.l)}</span>${Pro.on() ? '<span class="pro-badge">PRO</span>' : ''}</div>
        <div class="pf3-stats">
          <button data-act="profTab" data-v="activities"><b class="num">${acts.length}</b><small>treinos</small></button>
          <button data-act="profTab" data-v="stats"><b class="num">${Fmt.num(km, km < 100 ? 1 : 0)}</b><small>km</small></button>
          ${Cloud.loggedIn() ? `<button data-act="followList" data-v="followers"><b class="num" id="pfFollowers">–</b><small>seguidores</small></button><button data-act="followList" data-v="following"><b class="num" id="pfFollowing">–</b><small>seguindo</small></button>` : `<div><b class="num">${zones.length}</b><small>áreas</small></div><div><b class="num">${medals}</b><small>medalhas</small></div>`}
        </div>
        <div class="pf3-xp"><div><b>Nível ${lv.l}</b><small class="num">${lv.txt}</small></div><i><i style="width:${lv.pct}%"></i></i></div>
        ${UI.quickProgress ? UI.quickProgress() : ''}
      </div>
    </section>
    <div class="pf3-hl">${hl.map(([ic, big, sub, lab, act, v]) => `<button data-act="${act}" data-v="${v}"><small>${I(ic, 'xs')} ${lab}</small><b class="num">${big}</b><span>${sub}</span></button>`).join('')}</div>`;
  };

  /* ---------------- perfil de outra pessoa ---------------- */
  UI.user = async function (id) {
    this._uid = id;
    this.render(`${this.back('social', 'Perfil')}<main class="screen up3"><div id="userBody"><div class="ra3-sk"><i></i><b></b><b></b></div></div></main>`);
    try {
      const [d, fs] = await Promise.all([Cloud.profileOf(id), Cloud.friendState(id)]);
      if (!d.p) throw new Error('sem perfil');
      const p = this.keep({ ...d.p, id }), f = fs.iFollow, self = id === (Cloud.user && Cloud.user.id);
      const L0 = CONFIG.leagues.find((x) => x.id === p.league) || CONFIG.leagues[0];
      const acts = (d.acts || []).map((a) => ({ ...a, t: T(a.start) }));
      const last = acts.find((a) => fromRoute(a.route).length > 4);
      const color = last ? SP(last.sport).color : (acts[0] ? SP(acts[0].sport).color : 'var(--brand)');
      const atl = p.avatar_cfg && p.avatar_cfg.on !== false && p.avatar_pow;
      // últimos 30 dias
      const d30 = acts.filter((a) => a.t >= Date.now() - 30 * 864e5);
      const km30 = d30.reduce((s, a) => s + (a.distance || 0), 0) / 1000, t30 = d30.reduce((s, a) => s + (a.duration || 0), 0);
      const by = {}; d30.forEach((a) => (by[a.sport] = (by[a.sport] || 0) + (a.distance || 0)));
      const split = Object.entries(by).sort((x, y) => y[1] - x[1]), tot = split.reduce((s, x) => s + x[1], 0) || 1;
      const wk = [0, 0, 0, 0]; d30.forEach((a) => { const i = Math.min(3, Math.floor((Date.now() - a.t) / (7 * 864e5))); wk[3 - i] += (a.distance || 0) / 1000; });
      const wmax = Math.max(...wk, 1);
      const capTxt = last ? `<span class="cv11-cap">${I(SP(last.sport).icon, 'xs')} ${esc(this.actTitle(last))} · ${Fmt.km(last.distance)} km</span>` : '';
      const el = $('#userBody'); if (!el) return;
      const followBtn = self ? `<button class="btn primary sm" data-act="navProfile">Seu perfil</button>`
        : `<button class="btn ${f ? 'ghost' : 'primary'} sm" data-act="${f ? 'unfollow' : 'follow'}" data-v="${id}">${fs.friends ? `${I('users', 'xs')} Amigos` : f ? `${I('check', 'xs')} Seguindo` : fs.followsMe ? `${I('userPlus', 'xs')} Seguir de volta` : `${I('userPlus', 'xs')} Seguir`}</button><button class="pf3-ib2" data-act="chalNew" data-v="${id}" ${fs.friends ? '' : 'data-nf="1"'} aria-label="Desafiar">${I('swords')}</button>`;
      el.outerHTML = `<section class="pf3">
          <div class="pf3-cv">${V11.cover(last ? fromRoute(last.route) : [], color, seedOf(id), capTxt)}</div>
          <div class="pf3-row"><button class="pf3-ava" data-act="avView" data-v="${id}">${this.avatarOf(p.name, p.frame, p.avatar, 'xl', p.photo)}<span class="pf3-lv num">${p.level || 1}</span></button><div class="pf3-btns">${followBtn}</div></div>
          <div class="pf3-id">
            <h1>${esc(p.name || 'Atleta')}${UI.vb(p.id, p.username)}</h1>
            <p class="pf3-meta">${[p.username ? '@' + esc(p.username) : '', p.city ? `${I('mapPin', 'xs')} ${esc(p.city)}` : ''].filter(Boolean).join('<i>·</i>')}</p>
            ${p.bio ? `<p class="pf3-bio">${esc(p.bio)}</p>` : ''}
            <div class="pf3-tags"><span style="--c:${L0.color}">${I('crown', 'xs')} Liga ${L0.name}</span><span>${I('zap', 'xs')} Nível ${p.level || 1}</span>${fs.friends ? `<span class="ok">${I('users', 'xs')} Amigos</span>` : fs.followsMe ? '<span>Segue você</span>' : ''}</div>
            <div class="pf3-stats">
              <div><b class="num">${Fmt.num(p.total_km || 0, 0)}</b><small>km</small></div>
              <button data-act="followList2" data-v="followers:${id}"><b class="num">${d.followers}</b><small>seguidores</small></button>
              ${d.following != null ? `<button data-act="followList2" data-v="following:${id}"><b class="num">${d.following}</b><small>seguindo</small></button>` : ''}
              <div><b class="num">${p.medals || 0}</b><small>medalhas</small></div>
            </div>
          </div>
        </section>
        ${!self && fs.followsMe && !fs.friends ? `<p class="fr-hint">${I('userPlus', 'xs')} ${first(p.name)} segue você. Siga de volta para virarem amigos!</p>` : ''}
        <section class="up3-30">
          <header><span>Últimos 30 dias</span><small>${d30.length} ${d30.length === 1 ? 'treino' : 'treinos'}</small></header>
          <div class="up3-30m">
            <div class="up3-km"><b class="num">${Fmt.num(km30, km30 >= 100 ? 0 : 1)}</b><small>km</small><em class="num">${Fmt.time(t30)} em movimento</em></div>
            <div class="up3-wk">${wk.map((v, i) => `<div><i style="height:${v ? Math.max(8, (v / wmax) * 100) : 3}%"></i><small>${i === 3 ? 'esta' : `-${3 - i}`}</small></div>`).join('')}</div>
          </div>
          ${split.length ? `<div class="up3-split">${split.map(([k, v]) => `<i style="flex:${v};--c:${SP(k).color}"></i>`).join('')}</div><div class="up3-leg">${split.map(([k, v]) => `<span style="--c:${SP(k).color}"><i></i>${SP(k).name} <b class="num">${Fmt.num(v / 1000, 1)} km</b> <em class="num">${Math.round((v / tot) * 100)}%</em></span>`).join('')}</div>` : `<p class="up3-none">Sem treinos públicos neste período.</p>`}
        </section>
        ${atl ? `<div class="av-other"><div class="avo-art">${Avatar.svg(p.avatar_cfg, { pose: 'stand', mood: 'happy', w: 86, still: true, stage: p.avatar_stage || 0, stats: p.avatar_cfg.st || { vel: 1, res: 1, for: 1, con: 1 } })}</div><div class="grow"><small class="eyebrow">Atleta</small><b>${esc((Avatar.STAGES[p.avatar_stage || 0] || [0, ''])[1])} · poder ${p.avatar_pow}</b>${p.avatar_cfg.st ? `<div class="avh-attrs">${Avatar.ATTR.map(([k, n, ic, c]) => `<div style="--c:${c}">${I(ic, 'xs')}<i><i style="width:${p.avatar_cfg.st[k]}%"></i></i><b class="num">${p.avatar_cfg.st[k]}</b></div>`).join('')}</div>` : ''}</div></div>` : ''}
        <div class="up3-h"><h2>Treinos</h2><small>${acts.length ? 'toque para ver o treino' : ''}</small></div>
        ${acts.length ? `<div class="up3-grid">${acts.map((a) => this.up3Tile(a)).join('')}</div>` : `<div class="soc-empty compact">${I('activity')}<p>Nenhuma atividade pública ainda.</p></div>`}
        ${self ? '' : `<button class="up-report" data-act="report" data-k="user" data-v="${id}" data-u="${id}">${I('flag', 'xs')} Denunciar perfil</button>`}`;
    } catch (e) { console.error(e); const el = $('#userBody'); if (el) el.innerHTML = '<div class="soc-empty">Perfil não encontrado.</div>'; }
  };
  // mural de treinos: o desenho do trajeto + os números
  UI.up3Tile = function (a) {
    const sp = SP(a.sport), pts = fromRoute(a.route), r = V11.routePath(pts, 10, 10, 140, 80);
    const avg = a.duration ? a.distance / a.duration : 0;
    return `<button class="up3-t" data-act="raOpen" data-v="${esc(a.id)}" style="--c:${sp.color}">
      <span class="up3-art">${r ? `<svg viewBox="0 0 160 100" aria-hidden="true"><path d="${r.d}"/><circle cx="${r.e[0]}" cy="${r.e[1]}" r="3.6"/></svg>` : `<span class="up3-noart">${I(sp.icon)}</span>`}<i>${I(sp.icon, 'xs')}</i></span>
      <b class="num">${Fmt.km(a.distance)}<small> km</small></b>
      <small class="num">${Fmt.pace(a.sport, avg)} ${Fmt.paceUnit(a.sport)} · ${Fmt.time(a.duration)}</small>
      <em>${esc(this.actTitle(a))} · ${esc(this.rel ? this.rel(a.t || T(a.start)) : Fmt.date(T(a.start)))}</em>
    </button>`;
  };
})();

/* =========================================================
   v11.1 · janelas (folhas de baixo) e melhorias de sistema
   ========================================================= */
(() => {
  /* ---------- janelas: folha presa embaixo, título com ícone, X para fechar, rodapé fixo ---------- */
  const CANCEL = /^(fechar|cancelar|agora não|agora nao|voltar|não|nao)$/i;
  FX.modal = function (html) {
    return new Promise((res) => {
      const m = $('#modal');
      m.innerHTML = `<div class="modal-bg"><div class="modal-box mx11"><i class="m-grip"></i>${html}</div></div>`;
      const box = m.querySelector('.modal-box');
      // emoji no título vira ícone
      const h = box.querySelector(':scope > h3');
      if (h && !box.querySelector(':scope > .m-done, :scope > .m-ic')) {
        const re = /\s*(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*)\s*/u, mm = h.textContent.match(re);
        if (mm) { h.innerHTML = h.innerHTML.replace(mm[1], '').replace(/️/g, '').trim(); const ic = document.createElement('div'); ic.className = 'm-ic'; ic.textContent = mm[1]; h.before(ic); }
      }
      // cabeçalho: ícone + título (+ texto) lado a lado
      if (h) {
        const prev = h.previousElementSibling, head = document.createElement('div');
        head.className = 'm-head'; h.before(head);
        if (prev && prev.matches('.m-hero, .m-ic')) head.append(prev);
        const tx = document.createElement('div'); tx.className = 'm-ht'; head.append(tx); tx.append(h);
        box.classList.add('has-head');
      }
      // botão X quando existe uma opção de cancelar
      const btns = [...box.querySelectorAll('[data-m]')];
      const cancel = box.querySelector('[data-m=no]') || btns.find((b) => b.classList.contains('ghost') && CANCEL.test(b.textContent.trim()));
      if (cancel && !box.querySelector('.cm-menu')) {
        box.insertAdjacentHTML('afterbegin', `<button class="m-x" data-m="${esc(cancel.dataset.m)}" aria-label="Fechar">${I('x')}</button>`);
        // "Fechar" sozinho some: o X faz o mesmo
        if (/^fechar$/i.test(cancel.textContent.trim()) && btns.length > 1) cancel.classList.add('m-off');
      }
      // rodapé de botões fixo embaixo da folha
      const foot = box.querySelector(':scope > .row2:last-child, :scope > .btn:last-child');
      if (foot) foot.classList.add('m-foot');
      m.classList.add('show');
      m.onclick = (e) => {
        let b = e.target.closest('[data-m]');
        if (!b && e.target.classList.contains('modal-bg')) b = m.querySelector('[data-m=no]') || m.querySelector('.m-x');
        if (!b) return;
        this.form = {};
        m.querySelectorAll('input[id], textarea[id], select[id]').forEach((el) => { this.form[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        m.querySelectorAll('input[type=radio]:checked').forEach((el) => { this.form[el.name] = el.value; });
        m.classList.remove('show'); m.innerHTML = ''; m.onclick = null;
        res(b.dataset.m);
      };
    });
  };

  /* ---------- lista de curtidas: cabeçalho com contagem, sem "Fechar" ---------- */
  const likers0 = App.actions.raLikers;
  App.actions.raLikers = async (el) => {
    const p = likers0(el); // a janela abre na hora; o X substitui o "Fechar"
    const b = $('.lk11 > .btn'); if (b) b.remove();
    await p;
    const n = document.querySelectorAll('#lk11L .lk11-r').length, h = $('.lk11 h3');
    if (h && n) h.innerHTML = `Curtidas <span class="num">${n}</span>`;
  };

  /* ---------- seu treino: quem curtiu e comentou aparece no resumo ---------- */
  const sum0 = UI.summary.bind(UI);
  UI.summary = function (act, ...rest) {
    const r = sum0(act, ...rest);
    try {
      if (act && act.pub && Cloud.loggedIn()) {
        const id = act.id;
        Cloud.withReactions([{ id }]).then(([a]) => {
          if (!a || App.tab !== 'detail' || $('.ms11') || (!a.likes && !a.comments)) return;
          const anchor = $('.screen.summary .s-map-wrap') || $('.screen.summary .pool-art') || $('.screen.summary > section');
          if (!anchor) return;
          const cm = a.lastCm && a.lastCm.text ? `<p class="ms11-cm"><b>${esc((a.lastCm.p || {}).name || 'Atleta')}</b> ${esc(a.lastCm.text.slice(0, 120))}</p>` : '';
          anchor.insertAdjacentHTML('afterend', `<section class="ms11 tap" data-act="raOpen" data-v="${esc(id)}" data-cm="1">
            <div class="ms11-top">${a.likerP && a.likerP.length ? V11.stack(a.likerP) : `<span class="k11-h">${I('heart', 'xs')}</span>`}<span class="grow">${a.likes ? V11.likedBy(a.likes, a.likerP, false) : 'Ninguém curtiu ainda'}</span><em>${I('message', 'xs')}<span class="num">${a.comments}</span></em></div>
            ${cm}<span class="ms11-go">Ver conversa${I('chevronRight', 'xs')}</span></section>`);
        }).catch(() => {});
      }
    } catch (e) {}
    return r;
  };

  /* ---------- voltar do treino para onde você estava ---------- */
  const raOpen0 = App.actions.raOpen, raBack0 = App.actions.raBack;
  App.actions.raOpen = (el) => {
    const from = App.tab, det = from === 'detail' && $('.ms11') ? el.dataset.v : null;
    raOpen0(el);
    if (App.raFrom && from !== 'ract') { App.raFrom.det = det; App.raFrom.tab = from; }
  };
  App.actions.raBack = () => {
    const f = App.raFrom || {};
    if (f.tab === 'detail' && f.det) { const a = App.find(f.det); App.raFrom = null; if (a) { App.tab = 'detail'; App.nav = 'home'; return UI.summary(a, null, false); } }
    if (f.tab === 'profile' || f.tab === 'home') { App.raFrom = null; return App.go(f.tab); }
    return raBack0();
  };

  /* ---------- toque duplo na foto/mapa do post = curtir ---------- */
  let tapT = 0, tapTimer = null;
  document.addEventListener('click', (e) => {
    const media = e.target.closest && e.target.closest('.p8-media');
    if (!media || e.target.closest('button, a')) return;
    e.stopPropagation(); e.preventDefault();
    const now = Date.now(), post = media.closest('.p8');
    if (now - tapT < 320) {
      clearTimeout(tapTimer); tapT = 0;
      const btn = post && post.querySelector('.p8-like');
      if (btn && btn.dataset.on !== '1') App.actions.like(btn);
      const r = media.getBoundingClientRect(), hrt = document.createElement('span');
      hrt.className = 'dt11'; hrt.innerHTML = I('heart');
      hrt.style.left = `${(e.clientX || r.left + r.width / 2) - r.left}px`; hrt.style.top = `${(e.clientY || r.top + r.height / 2) - r.top}px`;
      media.style.position = 'relative'; media.append(hrt); setTimeout(() => hrt.remove(), 900);
      return;
    }
    tapT = now;
    tapTimer = setTimeout(() => { tapT = 0; App.actions.raOpen(media); }, 300);
  }, true);

  /* ---------- @menção: sugere quem está na conversa ---------- */
  const people = () => {
    const M = new Map();
    document.querySelectorAll('#raCm .cm3').forEach((c) => {
      const b = c.querySelector('.cm3-h b'), av = c.querySelector('.cm3-av');
      if (b && av) M.set(av.dataset.v, b.childNodes[0] ? b.childNodes[0].textContent.trim() : b.textContent.trim());
    });
    const own = $('.ra3-who b'); const ob = $('.ra3-av');
    if (own && ob) M.set(ob.dataset.v, own.childNodes[0] ? own.childNodes[0].textContent.trim() : own.textContent.trim());
    if (Cloud.user) M.delete(Cloud.user.id);
    return [...M.entries()].map(([id, name]) => ({ id, name }));
  };
  document.addEventListener('input', (e) => {
    if (!e.target || e.target.id !== 'raText') return;
    const t = e.target, before = t.value.slice(0, t.selectionStart), mt = before.match(/(^|\s)@([\wÀ-ÿ.]{0,20})$/);
    let box = $('#mn11');
    if (!mt) { if (box) box.remove(); return; }
    const q = mt[2].toLowerCase(), L = people().filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
    if (!L.length) { if (box) box.remove(); return; }
    if (!box) { const c = t.closest('.composer'); if (!c) return; c.insertAdjacentHTML('afterbegin', '<div id="mn11" class="mn11"></div>'); box = $('#mn11'); }
    box.innerHTML = L.map((p) => { const pp = (UI._people || {})[p.id] || {}; return `<button data-act="mn11Pick" data-v="${esc(p.name.split(' ')[0])}">${UI.avatarOf(p.name, null, pp.avatar, 'xs', pp.photo)}<span>${esc(p.name)}</span></button>`; }).join('');
  });
  App.actions.mn11Pick = (el) => {
    const t = $('#raText'); if (!t) return;
    const pos = t.selectionStart || t.value.length, before = t.value.slice(0, pos).replace(/@([\wÀ-ÿ.]{0,20})$/, `@${el.dataset.v} `);
    t.value = before + t.value.slice(pos); t.focus(); t.setSelectionRange(before.length, before.length);
    t.dispatchEvent(new Event('input', { bubbles: true })); const b = $('#mn11'); if (b) b.remove();
  };

  /* ---------- seu perfil: alternar entre lista e mural de treinos ---------- */
  const pfKey = 'justgo_pf_view';
  const pfView = () => { try { return localStorage.getItem(pfKey) || 'list'; } catch (e) { return 'list'; } };
  const prof0 = UI.profile.bind(UI);
  UI.profile = function (...a) {
    const r = prof0(...a);
    try {
      const tab = ['activities', 'stats', 'achievements', 'more'].includes(App.sub.profile) ? App.sub.profile : 'activities';
      const tabs = $('.pf2-screen > .subtabs'), list = [...Store.data.activities].sort((x, y) => y.start - x.start);
      if (tab !== 'activities' || !tabs || !list.length) return r;
      const v = pfView();
      tabs.insertAdjacentHTML('afterend', `<div class="pv11"><span>${list.length} ${list.length === 1 ? 'treino' : 'treinos'}</span><div class="pv11-sw"><button class="${v === 'list' ? 'on' : ''}" data-act="pfView" data-v="list" aria-label="Lista">${I('list', 'xs')}</button><button class="${v === 'grid' ? 'on' : ''}" data-act="pfView" data-v="grid" aria-label="Mural">${I('map', 'xs')}</button></div></div>`);
      if (v === 'grid') {
        const sw = $('.pv11'); let n = sw.nextElementSibling; while (n) { const nx = n.nextElementSibling; n.remove(); n = nx; }
        sw.insertAdjacentHTML('afterend', `<div class="up3-grid pf11-grid">${list.slice(0, 60).map((x) => UI.myTile(x)).join('')}</div>${list.length > 60 ? `<button class="btn ghost" data-act="go" data-v="history">Ver todas as ${list.length} atividades</button>` : ''}`);
      }
    } catch (e) { console.warn(e); }
    return r;
  };
  App.actions.pfView = (el) => { try { localStorage.setItem(pfKey, el.dataset.v); } catch (e) {} const y = window.scrollY; UI.profile(); window.scrollTo(0, y); };
  UI.myTile = function (a) {
    const sp = CONFIG.sports[a.sport] || CONFIG.sports.run, r = V11.routePath(a.points || [], 10, 10, 140, 80), avg = a.duration ? a.distance / a.duration : 0;
    return `<button class="up3-t" data-act="detail" data-v="${esc(a.id)}" style="--c:${sp.color}">
      <span class="up3-art">${r ? `<svg viewBox="0 0 160 100" aria-hidden="true"><path d="${r.d}"/><circle cx="${r.e[0]}" cy="${r.e[1]}" r="3.6"/></svg>` : `<span class="up3-noart">${I(sp.icon)}</span>`}<i>${I(sp.icon, 'xs')}</i></span>
      <b class="num">${Fmt.km(a.distance)}<small> km</small></b>
      <small class="num">${Fmt.pace(a.sport, avg)} ${Fmt.paceUnit(a.sport)} · ${Fmt.time(a.duration)}</small>
      <em>${esc(this.actTitle(a))} · ${esc(this.rel ? this.rel(a.start) : Fmt.date(a.start))}</em>
    </button>`;
  };
})();
