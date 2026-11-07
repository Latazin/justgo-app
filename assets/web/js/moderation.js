/* =========================================================
   JustGo — SEGURANÇA E MODERAÇÃO
   • Detector de nudez no próprio aparelho antes de enviar qualquer foto
   • Denunciar post, comentário ou perfil
   • Painel de moderação (só para admins: tabela "admins" no Supabase)
   ========================================================= */
const Mod = {
  /* ---------- detector de nudez (nsfwjs, roda offline no aparelho) ---------- */
  _p: null,
  load() {
    if (this._p) return this._p;
    this._p = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/nsfw/nsfwjs.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); })
      .then(() => nsfwjs.load('vendor/nsfw/model/', { size: 224 }))
      .catch((e) => { this._p = null; throw e; });
    return this._p;
  },
  // aquece o detector quando a pessoa abre a escolha de foto (fica pronto mais rápido)
  warm() { if (!this._p) setTimeout(() => this.load().catch(() => {}), 50); },
  toCanvas(src) {
    const w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height;
    const k = Math.min(1, 512 / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
  },
  async check(src) {
    const m = await this.load(), c = this.toCanvas(src), pr = await m.classify(c);
    const P = (k) => (pr.find((x) => x.className === k) || {}).probability || 0;
    const porn = P('Porn'), hent = P('Hentai'), sexy = P('Sexy');
    return { ok: !(porn >= 0.5 || hent >= 0.6 || porn + hent >= 0.65), porn, hent, sexy };
  },
  // true = pode enviar. Bloqueia nudez/sexo explícito com aviso.
  async guard(src) {
    const t = setTimeout(() => FX.toast('Verificando a foto…'), 400);
    let r = null;
    try { r = await this.check(src); } catch (e) { console.warn('detector', e); clearTimeout(t); return true; } // se o detector falhar, as denúncias cobrem
    clearTimeout(t);
    if (r.ok) return true;
    const D = Store.data; D.nsfwBlocks = (D.nsfwBlocks || 0) + 1; Store.save();
    FX.modal(`<div class="ui8"><span class="ui8-ic bad">${I('shield')}</span><h3>Foto não permitida</h3><p class="muted">Essa imagem parece ter nudez ou conteúdo sexual, o que não é permitido no JustGo. Escolha outra foto.</p><p class="muted small" style="margin-top:8px">Contas que insistirem podem ser suspensas (Termos de Uso, item 4).</p><button class="btn primary" data-m="ok">Escolher outra</button></div>`);
    return false;
  },

  /* ---------- denúncias ---------- */
  REASONS: [
    ['nudity', 'Nudez ou conteúdo sexual', 'eyeOff', '#DC2626'],
    ['violence', 'Violência ou conteúdo chocante', 'alert', '#EA580C'],
    ['hate', 'Assédio, ódio ou bullying', 'message', '#7C3AED'],
    ['spam', 'Spam, golpe ou propaganda', 'link', '#0EA5E9'],
    ['fake', 'Treino falso (carro, GPS falso)', 'route', '#F59E0B'],
    ['other', 'Outro motivo', 'flag', '#64748B'],
  ],
  KIND_N: { post: 'este treino', comment: 'este comentário', user: 'este perfil' },
  async report(kind, id, user) {
    if (!Cloud.loggedIn()) return FX.toast('Entre na sua conta para denunciar.');
    if (user && user === Cloud.user.id) return FX.toast('Esse conteúdo é seu.');
    const pr = FX.modal(`<div class="rp8"><div class="m-hero bad">${I('flag')}</div><h3>Denunciar ${this.KIND_N[kind] || ''}</h3><p class="muted">Sua denúncia é anônima. Qual é o problema?</p>
      <div class="rp8-list">${this.REASONS.map(([k, n, ic, c]) => `<label class="rp8-r"><input type="radio" name="rpWhy" value="${k}"><span style="--c:${c}"><i>${I(ic, 'xs')}</i><b>${n}</b><em>${I('check', 'xs')}</em></span></label>`).join('')}</div>
      <label class="rp8-note"><textarea id="rpNote" rows="2" maxlength="300" placeholder="Quer explicar melhor? (opcional)"></textarea></label>
      <div class="row2"><button class="btn ghost" data-m="no">Cancelar</button><button class="btn danger" data-m="send" id="rpGo" disabled>Enviar denúncia</button></div></div>`);
    document.querySelectorAll('input[name=rpWhy]').forEach((r) => (r.onchange = () => { const b = $('#rpGo'); if (b) b.disabled = false; }));
    const v = await pr;
    if (v !== 'send') return;
    const why = FX.form && FX.form.rpWhy, note = ((FX.form && FX.form.rpNote) || '').trim().slice(0, 300);
    if (!why) return;
    try {
      await Cloud.report(kind, id, user, why, note);
      if (kind === 'post') { const D = Store.data; D.hiddenPosts = [...new Set([...(D.hiddenPosts || []), id])].slice(-300); Store.save(); document.querySelectorAll(`[data-pid="${CSS.escape(id)}"]`).forEach((e) => e.remove()); }
      FX.modal(`<div class="ui8"><span class="ui8-ic on" style="background:linear-gradient(135deg,#34D399,#059669)">${I('check')}</span><h3>Denúncia enviada</h3><p class="muted">Obrigado por ajudar a manter o JustGo seguro. Nossa equipe vai analisar${kind === 'post' ? ', e esse post não aparece mais para você' : ''}.</p><button class="btn primary" data-m="ok">Fechar</button></div>`);
    } catch (e) {
      const m = String((e && e.message) || '');
      FX.toast(/duplicate|unique/i.test(m) ? 'Você já denunciou isso. Obrigado!' : /relation|does not exist|schema/i.test(m) ? 'Denúncias ainda não ativadas no servidor.' : 'Não deu para enviar agora. Tente de novo.');
    }
  },
  // menu "…" do post
  async postMenu(id, user) {
    const mine = Cloud.user && user === Cloud.user.id;
    const v = await FX.modal(`<div class="pm8">${mine ? '' : `<button class="pm8-b bad" data-m="report">${I('flag')}<div><b>Denunciar post</b><small>Nudez, violência, spam ou treino falso</small></div></button>
      <button class="pm8-b" data-m="hide">${I('eyeOff')}<div><b>Não quero ver isso</b><small>Esconde este post só para você</small></div></button>`}
      <button class="pm8-b" data-m="user">${I('user')}<div><b>Ver perfil</b><small>Abrir o perfil de quem postou</small></div></button>
      <button class="btn ghost" data-m="no">Cancelar</button></div>`);
    if (v === 'report') return this.report('post', id, user);
    if (v === 'hide') { const D = Store.data; D.hiddenPosts = [...new Set([...(D.hiddenPosts || []), id])].slice(-300); Store.save(); document.querySelectorAll(`[data-pid="${CSS.escape(id)}"]`).forEach((e) => e.remove()); FX.toast('Post escondido.'); }
    if (v === 'user') App.actions.userOpen({ dataset: { v: user } });
  },

  /* ---------- painel do admin ---------- */
  REASON_N(k) { return (this.REASONS.find((r) => r[0] === k) || [0, k])[1]; },
  async panel() {
    App.tab = 'modPanel'; App.nav = 'profile';
    const tab = App.modTab || 'open';
    UI.render(`${UI.back('account', 'Moderação')}<main class="screen md8"><div class="fl-tabs md8-tabs"><button class="${tab === 'open' ? 'on' : ''}" data-act="modTab" data-v="open"><span>Abertas</span></button><button class="${tab === 'done' ? 'on' : ''}" data-act="modTab" data-v="done"><span>Resolvidas</span></button><i class="fl-ind" style="transform:translateX(${tab === 'open' ? 0 : 100}%);width:calc((100% - 12px) / 2)"></i></div><div id="mdBody">${UI.skel('feed')}</div></main>`);
    let list = [];
    try { list = await Cloud.modReports(tab); } catch (e) { $('#mdBody').innerHTML = `<div class="v8-empty sm">${I('alert')}<p>${/relation|does not exist/i.test(String(e && e.message)) ? 'Rode o SQL de moderação no Supabase.' : 'Não deu para carregar.'}</p></div>`; return; }
    const el = $('#mdBody'); if (!el) return;
    if (!list.length) { el.innerHTML = `<div class="v8-empty">${I('shield')}<h3>${tab === 'open' ? 'Nenhuma denúncia aberta' : 'Nada resolvido ainda'}</h3><p>${tab === 'open' ? 'Quando alguém denunciar um post, comentário ou perfil, aparece aqui.' : ''}</p></div>`; return; }
    el.innerHTML = list.map((g) => this.card(g, tab)).join('');
  },
  card(g, tab) {
    const t = g.target || {}, u = g.user || {}, why = Object.entries(g.reasons).sort((a, b) => b[1] - a[1]);
    let prev = '';
    if (g.kind === 'post') {
      const ph = (t.photos || []).map((p) => (typeof p === 'string' ? p : p && p.url)).filter(Boolean);
      prev = t.id ? `<div class="md8-prev"><b>${esc(t.title || 'Treino')}</b>${t.stats && t.stats.caption ? `<p>${esc(t.stats.caption)}</p>` : ''}<small>${(CONFIG.sports[t.sport] || {}).name || ''} · ${Fmt.km(t.distance || 0)} km · ${new Date(t.start).toLocaleDateString('pt-BR')}</small>${ph.length ? `<div class="md8-ph">${ph.map((s) => `<img src="${esc(s)}" loading="lazy" alt="">`).join('')}</div>` : ''}</div>` : '<div class="md8-prev"><small>Post já apagado</small></div>';
    } else if (g.kind === 'comment') prev = `<div class="md8-prev"><p>“${esc(t.text || 'Comentário apagado')}”</p></div>`;
    else prev = `<div class="md8-prev"><small>Perfil denunciado${u.city ? ' · ' + esc(u.city) : ''}</small></div>`;
    const acts = tab === 'open' ? `<div class="md8-acts">
        <button class="btn ghost" data-act="modDo" data-v="${g.rid}:dismiss">Ignorar</button>
        ${g.kind !== 'user' ? `<button class="btn ghost" data-act="modDo" data-v="${g.rid}:${t.hidden ? 'restore' : 'hide'}">${t.hidden ? 'Reexibir' : 'Ocultar'}</button><button class="btn ghost bad" data-act="modDo" data-v="${g.rid}:delete">Apagar</button>` : ''}
        <button class="btn danger" data-act="modDo" data-v="${g.rid}:ban">${u.banned ? 'Já banido' : 'Banir autor'}</button></div>` : `<div class="md8-done">${I('check', 'xs')} ${({ dismiss: 'Ignorada', hide: 'Ocultado', restore: 'Reexibido', delete: 'Apagado', ban: 'Autor banido' })[g.action] || 'Resolvida'}${u.banned ? ` · <button class="lnk" data-act="modUnban" data-v="${u.id}">Desbanir</button>` : ''}</div>`;
    return `<article class="md8">
      <header><span class="md8-k">${({ post: 'Post', comment: 'Comentário', user: 'Perfil' })[g.kind]}</span>${t.hidden ? '<span class="md8-k hid">Oculto</span>' : ''}${u.banned ? '<span class="md8-k ban">Banido</span>' : ''}<span class="grow"></span><small>${V8.ago(g.t)}</small></header>
      <button class="md8-who tap" data-act="userOpen" data-v="${u.id || ''}">${UI.avatarOf(u.name, u.frame, u.avatar, 'sm', u.photo)}<div><b>${esc(u.name || 'Atleta')}</b><small>@${esc(u.username || '')}</small></div></button>
      ${prev}
      <div class="md8-why">${why.map(([k, n]) => `<span>${esc(this.REASON_N(k))}${n > 1 ? ` <b>×${n}</b>` : ''}</span>`).join('')}</div>
      ${g.notes.length ? `<div class="md8-notes">${g.notes.map((n) => `<p>“${esc(n)}”</p>`).join('')}</div>` : ''}
      <small class="md8-by">${g.count} ${g.count === 1 ? 'denúncia' : 'denúncias'}</small>
      ${acts}</article>`;
  },
};

/* ---------- nuvem ---------- */
Object.assign(Cloud, {
  async report(kind, id, user, reason, note) {
    const { error } = await this.sb.from('reports').insert({ reporter: this.user.id, kind, target_id: String(id), target_user: user || null, reason, note: note || null });
    if (error) throw error;
  },
  async isAdmin(force) {
    if (!this.loggedIn()) return false;
    if (!force && this._admin != null && this._adminUid === this.user.id) return this._admin;
    try { const { data } = await this.sb.from('admins').select('user_id').eq('user_id', this.user.id).maybeSingle(); this._admin = !!data; } catch (e) { this._admin = false; }
    this._adminUid = this.user.id; return this._admin;
  },
  async modCount() { const { count } = await this.sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'); return count || 0; },
  async modReports(tab) {
    let q = this.sb.from('reports').select('*').order('created_at', { ascending: false }).limit(200);
    q = tab === 'open' ? q.eq('status', 'open') : q.neq('status', 'open');
    const { data, error } = await q; if (error) throw error;
    const G = {};
    (data || []).forEach((r) => { const k = r.kind + ':' + r.target_id; const g = G[k] || (G[k] = { rid: r.id, kind: r.kind, target_id: r.target_id, uid: r.target_user, reasons: {}, notes: [], count: 0, t: 0, action: r.action }); g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1; if (r.note) g.notes.push(r.note); g.count++; g.t = Math.max(g.t, Date.parse(r.created_at)); });
    const groups = Object.values(G).sort((a, b) => b.count - a.count || b.t - a.t);
    const pIds = groups.filter((g) => g.kind === 'post').map((g) => g.target_id), cIds = groups.filter((g) => g.kind === 'comment').map((g) => g.target_id);
    const [acts, cms] = await Promise.all([pIds.length ? this.sb.from('activities').select('id,user_id,title,sport,distance,start,photos,stats,hidden').in('id', pIds) : { data: [] }, cIds.length ? this.sb.from('comments').select('id,user_id,text,hidden').in('id', cIds) : { data: [] }]);
    const A = {}, C = {}; (acts.data || []).forEach((a) => (A[a.id] = a)); (cms.data || []).forEach((c) => (C[String(c.id)] = c));
    const users = [...new Set(groups.map((g) => g.uid).filter(Boolean))];
    let pm = {}; if (users.length) { const { data: ps } = await this.sb.from('profiles').select('id,name,username,photo,frame,avatar,city,banned').in('id', users); (ps || []).forEach((p) => (pm[p.id] = p)); }
    groups.forEach((g) => { g.target = g.kind === 'post' ? A[g.target_id] : g.kind === 'comment' ? C[g.target_id] : null; g.user = pm[g.uid] || { id: g.uid }; });
    return groups;
  },
  async modResolve(rid, act) { const { error } = await this.sb.rpc('mod_resolve', { rid, act }); if (error) throw error; },
  async modUnban(uid) { const { error } = await this.sb.rpc('mod_unban', { uid }); if (error) throw error; },
});

/* ---------- ganchos nas telas ---------- */
(() => {
  // conta: linha "Moderação" só para admin
  const acc = UI.account;
  UI.account = function () {
    const r = acc.apply(this, arguments);
    Cloud.isAdmin().then(async (ok) => {
      const el = $('#modRow'); if (!ok || !el) return;
      let n = 0; try { n = await Cloud.modCount(); } catch (e) {}
      el.outerHTML = `<button class="row tap" data-act="modPanel">${UI.iconBox('shield')}<div class="grow"><b>Moderação</b><small>Denúncias de posts, comentários e perfis</small></div>${n ? `<span class="md8-badge num">${n}</span>` : ''}${I('chevronRight', 'chev')}</button>`;
    }).catch(() => {});
    return r;
  };
  // início: aviso de denúncias novas para o admin
  const home = UI.home;
  UI.home = function () {
    const r = home.apply(this, arguments);
    if (Cloud.loggedIn()) Cloud.isAdmin().then(async (ok) => {
      if (!ok || App.tab !== 'home') return; let n = 0; try { n = await Cloud.modCount(); } catch (e) { return; }
      const el = $('#hTorch'); if (!n || !el || $('.md8-home')) return;
      el.insertAdjacentHTML('beforebegin', `<section class="ad8 md8-home" data-act="modPanel" style="--a:#DC2626"><span class="ad8-ic">${I('flag')}</span><div class="grow"><b>${n} ${n === 1 ? 'denúncia aberta' : 'denúncias abertas'}</b><small>Toque para revisar no painel de moderação.</small></div><span class="ad8-go">Ver${I('chevronRight', 'xs')}</span></section>`);
    }).catch(() => {});
    return r;
  };
  // conta suspensa: avisa ao entrar
  const after = Cloud.afterLogin;
  Cloud.afterLogin = async function () {
    const r = await after.apply(this, arguments);
    if (this.me && this.me.banned && !this._banShown) { this._banShown = true; FX.modal(`<div class="ui8"><span class="ui8-ic bad">${I('shield')}</span><h3>Conta suspensa</h3><p class="muted">Sua conta foi suspensa por violar os Termos de Uso do JustGo. Você não pode publicar treinos nem comentar.</p><button class="btn primary" data-m="ok">Entendi</button></div>`); }
    return r;
  };
})();
