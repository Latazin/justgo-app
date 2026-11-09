/* =========================================================
   JustGo — Comentários 2.0
   - responder a um comentário (fica agrupado embaixo dele)
   - curtir comentário (com contagem e "o autor curtiu")
   - selo "Autor" em quem postou o treino
   - menções @nome destacadas, reações rápidas
   Precisa do comentarios.sql (coluna parent_id e tabela comment_likes).
   Sem o SQL, continua funcionando como antes (sem respostas/curtidas).
   ========================================================= */
const Cm = {
  replyTo: null,     // { id, root, name }
  open: {},          // respostas abertas por comentário
  owner: {},         // dono de cada treino
  hasV2: null,       // o banco já tem respostas/curtidas?

  async load(aid) {
    let list = [];
    const { data, error } = await Cloud.sb.from('comments').select('*').eq('activity_id', aid).order('created_at');
    if (error) throw error;
    list = await Cloud.attachProfiles(data || []);
    this.hasV2 = list.length ? Object.prototype.hasOwnProperty.call(list[0], 'parent_id') : this.hasV2;
    // curtidas
    const ids = list.map((c) => c.id);
    if (ids.length) {
      const { data: lk, error: le } = await Cloud.sb.from('comment_likes').select('comment_id,user_id').in('comment_id', ids);
      if (!le) {
        this.hasV2 = true;
        const me = Cloud.user && Cloud.user.id, own = this.owner[aid];
        list.forEach((c) => { const L = (lk || []).filter((x) => x.comment_id === c.id); c.likes = L.length; c.liked = L.some((x) => x.user_id === me); c.ownerLiked = !!own && own !== c.user_id && L.some((x) => x.user_id === own); });
      } else if (/comment_likes/.test(le.message || '')) this.hasV2 = false;
    }
    if (!(aid in this.owner)) {
      try { const { data: a } = await Cloud.sb.from('activities').select('user_id').eq('id', aid).maybeSingle(); this.owner[aid] = a ? a.user_id : null; } catch (e) { this.owner[aid] = null; }
      if (this.owner[aid]) { const own = this.owner[aid]; const { data: lk } = ids.length ? await Cloud.sb.from('comment_likes').select('comment_id,user_id').in('comment_id', ids).eq('user_id', own).then((r) => r).catch(() => ({ data: [] })) : { data: [] }; const s = new Set((lk || []).map((x) => x.comment_id)); list.forEach((c) => (c.ownerLiked = own !== c.user_id && s.has(c.id))); }
    }
    return list;
  },

  text(t) {
    return esc(t).replace(/(^|\s)@([\wÀ-ÿ.]{2,30})/g, '$1<b class="cm-at">@$2</b>');
  },

  item(c, aid, reply) {
    const p = c.profiles || {}, me = Cloud.user && Cloud.user.id, own = this.owner[aid];
    const first = esc((p.name || 'Atleta').split(' ')[0]);
    return `<div class="cm ${reply ? 'rep' : ''}" id="cm${c.id}">
      <div class="cm-av" data-act="userOpen" data-v="${c.user_id}">${UI.avatarOf(p.name, p.frame, p.avatar, reply ? 'xs' : 'sm', p.photo)}</div>
      <div class="cm-body">
        <div class="cm-bubble">
          <div class="cm-h"><b data-act="userOpen" data-v="${c.user_id}">${esc(p.name || 'Atleta')}${UI.vb(c.user_id, p.username)}</b>${c.user_id === own ? '<span class="cm-author">Autor</span>' : ''}</div>
          <p>${this.text(c.text)}</p>
        </div>
        <div class="cm-acts">
          <span class="cm-t">${UI.ago(Date.parse(c.created_at))}</span>
          ${this.hasV2 !== false ? `<button class="cm-like ${c.liked ? 'on' : ''}" data-act="cmLike" data-v="${c.id}" data-a="${aid}">${I('heart', 'xs')}<span class="num">${c.likes || ''}</span></button>
          <button data-act="cmReply" data-v="${c.id}" data-r="${reply ? c.parent_id : c.id}" data-n="${first}">Responder</button>` : ''}
          <button class="cm-more" data-act="cmMore" data-v="${c.id}" data-a="${aid}" data-u="${c.user_id}" aria-label="Mais opções">${I('more', 'xs')}</button>
          ${c.ownerLiked ? `<span class="cm-ol" title="O autor curtiu">${I('heart', 'xs')} do autor</span>` : ''}
        </div>
      </div>
    </div>`;
  },

  render(list, aid) {
    const roots = list.filter((c) => !c.parent_id), byId = {};
    list.forEach((c) => (byId[c.id] = c));
    // resposta de resposta vai para a conversa do comentário original
    const rootOf = (c) => { let x = c, n = 0; while (x.parent_id && byId[x.parent_id] && n++ < 10) x = byId[x.parent_id]; return x.id; };
    const kids = {}; list.filter((c) => c.parent_id).forEach((c) => { const r = rootOf(c); (kids[r] = kids[r] || []).push(c); });
    if (!roots.length && !list.length) {
      return `<div class="cm-empty"><div class="cm-empty-art">${['🔥', '👏', '💪'].map((e) => `<span>${e}</span>`).join('')}</div><b>Seja o primeiro a comentar</b><small>Um "boa!" já faz a pessoa sorrir no meio do treino.</small></div>`;
    }
    return roots.map((c) => {
      const R = kids[c.id] || [], openAll = this.open[c.id] || R.length <= 2, shown = openAll ? R : R.slice(-1);
      return `<div class="cm-thread">${this.item(c, aid, false)}${R.length ? `<div class="cm-replies">${!openAll ? `<button class="cm-showrep" data-act="cmOpen" data-v="${c.id}" data-a="${aid}"><i></i>Ver mais ${R.length - 1} ${R.length - 1 === 1 ? 'resposta' : 'respostas'}</button>` : ''}${shown.map((r) => this.item(r, aid, true)).join('')}</div>` : ''}</div>`;
    }).join('');
  },

  setReply(r) {
    this.replyTo = r;
    const bar = $('#cmReplyBar'), t = $('#raText');
    if (bar) bar.innerHTML = r ? `<span>Respondendo a <b>${r.name}</b></span><button data-act="cmCancel" aria-label="Cancelar resposta">${I('x', 'xs')}</button>` : '';
    if (bar) bar.hidden = !r;
    if (t) { t.placeholder = r ? `Responder a ${r.name.replace(/<[^>]+>/g, '')}…` : 'Adicione um comentário…'; if (r) { if (!t.value.startsWith('@')) t.value = ''; t.focus(); } }
  },
};

(() => {
  // lista de comentários na tela do treino
  UI.raComments = async function (id) {
    const el = $('#raCm'); if (!el) return;
    let list = [];
    try { list = await Cm.load(id); } catch (e) { try { list = await Cloud.comments(id); } catch (e2) {} }
    el.innerHTML = Cm.render(list, id);
    const n = $('#raCmN'); if (n) n.textContent = list.length;
    // barra "respondendo a…" logo acima da caixa
    const comp = el.parentElement && el.parentElement.querySelector('.composer');
    if (comp && !$('#cmReplyBar')) comp.insertAdjacentHTML('afterbegin', '<div id="cmReplyBar" class="cm-replybar" hidden></div>');
    if (Cm.replyTo) Cm.setReply(Cm.replyTo);
  };

  // caixa: reações com emoji (somam ao texto) no lugar das frases prontas
  const comp0 = UI.composer.bind(UI);
  UI.composer = function (id, act, aid, quick = true) {
    if (id !== 'raText') return comp0(id, act, aid, quick);
    return `<div class="composer cm-composer"><div class="cp-emoji">${['🔥', '👏', '💪', '🚀', '❤️', '😮', '🏃', '🏆'].map((e) => `<button data-act="cmEmoji" data-v="${e}">${e}</button>`).join('')}</div>
      <div class="cp-row">${UI.avatar('sm')}<div class="cp-box"><textarea id="${id}" class="cp-in" rows="1" maxlength="500" placeholder="Adicione um comentário…"></textarea>
      <button class="cp-send" data-act="${act}" data-v="${aid}" aria-label="Enviar">${I('send')}</button></div></div></div>`;
  };

  Cloud.comment = async function (id, text, parent) {
    const row = { activity_id: id, user_id: this.user.id, text: text.slice(0, 500) };
    if (parent) row.parent_id = parent;
    let { error } = await this.sb.from('comments').insert(row);
    if (error && parent && /parent_id/.test(error.message || '')) { delete row.parent_id; ({ error } = await this.sb.from('comments').insert(row)); }
    if (error) throw error;
  };

  // notificações dentro do app: respostas e curtidas em comentários
  const notif0 = Cloud.notifications.bind(Cloud);
  Cloud.notifications = async function () {
    const out = await notif0();
    try {
      const me = this.user.id;
      const { data: myc } = await this.sb.from('comments').select('id,text,activity_id').eq('user_id', me).order('created_at', { ascending: false }).limit(80);
      const ids = (myc || []).map((c) => c.id), txt = {}; (myc || []).forEach((c) => (txt[c.id] = c));
      if (ids.length) {
        const [rep, lk] = await Promise.all([
          this.sb.from('comments').select('id,parent_id,activity_id,user_id,text,created_at,profiles(*)').in('parent_id', ids).neq('user_id', me).order('created_at', { ascending: false }).limit(30),
          this.sb.from('comment_likes').select('comment_id,user_id,created_at,profiles(*)').in('comment_id', ids).neq('user_id', me).order('created_at', { ascending: false }).limit(30),
        ]);
        (rep.data || []).forEach((x) => x.profiles && out.push({ k: 'comment', reply: 1, t: Date.parse(x.created_at), u: x.profiles, act: x.activity_id, text: x.text }));
        (lk.data || []).forEach((x) => x.profiles && txt[x.comment_id] && out.push({ k: 'like', clike: 1, t: Date.parse(x.created_at), u: x.profiles, act: txt[x.comment_id].activity_id, text: txt[x.comment_id].text }));
        out.sort((a, b) => b.t - a.t);
      }
    } catch (e) {}
    return out.slice(0, 60);
  };
  const K = (UI.NOTIF_K || (typeof V8 !== 'undefined' && V8.NOTIF_K));
  if (K) {
    const lk = K.like[2], cm = K.comment[2];
    K.like[2] = (n, f) => (n.clike ? `curtiu seu comentário <q>${esc((n.text || '').slice(0, 60))}</q>` : lk(n, f));
    K.comment[2] = (n, f) => (n.reply ? `respondeu você: <q>${esc((n.text || '').slice(0, 90))}</q>` : cm(n, f));
  }

  Object.assign(App.actions, {
    // abrir comentários sempre na tela do treino (com respostas)
    comments: (el) => { const b = document.createElement('button'); b.dataset.v = el.dataset.v; b.dataset.cm = '1'; App.actions.raOpen(b); },
    raComment: async (el) => {
      const t = $('#raText'), v = t && t.value.trim(); if (!v) return t && t.focus();
      el.disabled = true;
      const r = Cm.replyTo;
      try {
        await Cloud.comment(el.dataset.v, v, r ? r.root : null);
        t.value = ''; t.style.height = '';
        if (r) Cm.open[r.root] = true;
        Cm.setReply(null);
        await UI.raComments(el.dataset.v); FX.vibrate([15]);
        const last = r ? document.querySelector(`#cm${r.root}`) : null; if (last) last.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (e) { FX.toast('Não deu para comentar agora.'); }
      el.disabled = false;
    },
    cmReply: (el) => {
      if (!Cloud.loggedIn()) return FX.toast('Entre na conta para responder.');
      const name = el.dataset.n, t = $('#raText');
      Cm.setReply({ id: +el.dataset.v, root: +el.dataset.r, name: esc(name) });
      if (t) { if (+el.dataset.v !== +el.dataset.r) t.value = `@${name} `; t.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => t.focus(), 300); }
    },
    cmCancel: () => Cm.setReply(null),
    cmOpen: (el) => { Cm.open[el.dataset.v] = true; UI.raComments(el.dataset.a); },
    cmEmoji: (el) => { const t = $('#raText'); if (!t) return; t.value = (t.value ? t.value.replace(/\s*$/, ' ') : '') + el.dataset.v; t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); FX.vibrate([8]); },
    cmLike: async (el) => {
      if (!Cloud.loggedIn()) return FX.toast('Entre na conta para curtir.');
      const on = !el.classList.contains('on'), n = el.querySelector('span'), cur = +n.textContent || 0;
      el.classList.toggle('on', on); n.textContent = on ? cur + 1 : cur - 1 || ''; if (on) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); FX.vibrate([10]); }
      try {
        const q = on ? Cloud.sb.from('comment_likes').insert({ comment_id: +el.dataset.v, user_id: Cloud.user.id }) : Cloud.sb.from('comment_likes').delete().eq('comment_id', +el.dataset.v).eq('user_id', Cloud.user.id);
        const { error } = await q; if (error && !/duplicate/.test(error.message || '')) throw error;
      } catch (e) { el.classList.toggle('on', !on); n.textContent = cur || ''; FX.toast('Não deu para curtir agora.'); }
    },
    cmMore: async (el) => {
      const mine = Cloud.user && el.dataset.u === Cloud.user.id, own = Cm.owner[el.dataset.a] === (Cloud.user && Cloud.user.id);
      const v = await FX.modal(`<div class="cm-menu">${mine || own ? `<button data-m="del">${I('trash')}Apagar comentário</button>` : ''}${mine ? '' : `<button data-m="rep">${I('flag')}Denunciar</button>`}<button data-m="copy">${I('copy')}Copiar texto</button><button class="cancel" data-m="no">Cancelar</button></div>`);
      if (v === 'del') {
        try { await Cloud.sb.from('comments').delete().eq('id', +el.dataset.v); } catch (e) {}
        UI.raComments(el.dataset.a);
      } else if (v === 'rep') {
        const b = document.createElement('button'); Object.assign(b.dataset, { k: 'comment', v: el.dataset.v, u: el.dataset.u }); App.actions.report(b);
      } else if (v === 'copy') {
        const p = document.querySelector(`#cm${el.dataset.v} .cm-bubble p`); try { await navigator.clipboard.writeText(p ? p.textContent : ''); FX.toast('Copiado'); } catch (e) {}
      }
    },
  });
})();
