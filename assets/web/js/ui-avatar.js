/* =========================================================
   JustGo — TELAS DO ATLETA (avatar)
   Cartão da tela inicial, tela "Seu atleta", editor + loja,
   ranking por estágio. Tudo opcional: só aparece se a pessoa
   decidir criar.
   ========================================================= */
Object.assign(UI, {
  // cartão da tela inicial: o atleta grande com o humor do dia (ou o convite para criar)
  avatarHome() {
    if (!Avatar.on()) {
      if (Store.data.avatarHide) return '';
      const demo = Avatar.svg(Avatar.defaults(), { pose: 'cheer', mood: 'cheer', w: 92, still: true, stats: { vel: 1, res: 1, for: 1, con: 1 }, stage: 0 });
      return `<section class="card av-invite"><div class="avi-art">${demo}</div><div class="grow"><b>Crie seu atleta</b><small>Um personagem que fica mais forte, mais rápido e evolui com os seus treinos de verdade. É opcional!</small>
        <div class="avi-btns"><button class="btn primary sm" data-act="avCreate">Criar</button><button class="btn ghost sm" data-act="avHide">Agora não</button></div></div></section>`;
    }
    const m = Avatar.mood(), st = Avatar.stats(), sg = Avatar.stage();
    if (m.k === 'cheer') { const c = Avatar.cfg(); c.cheered = m.act; Store.save(); }
    const pose = m.k === 'sofa' ? 'sofa' : m.k === 'cheer' ? 'cheer' : m.k === 'happy' ? 'run' : 'stand';
    return `<button class="card av-home tap mood-${m.k}" data-act="go" data-v="atleta">
      <div class="avh-art">${Avatar.svg(null, { pose, mood: m.k, w: 132 })}</div>
      <div class="grow"><div class="avh-bubble">${esc(Avatar.line(m))}</div>
        <div class="avh-top"><b>${esc(sg.name)}</b><span class="num">Poder ${st.pow}</span></div>
        <div class="avh-attrs">${Avatar.ATTR.map(([k, n, ic, c]) => `<div style="--c:${c}">${I(ic, 'xs')}<i><i style="width:${st[k]}%"></i></i><b class="num">${st[k]}</b></div>`).join('')}</div></div></button>`;
  },

  // tela "Seu atleta" (rota 'atleta')
  atleta() { return this.avatarScreen(); },
  avatarScreen() {
    if (!Avatar.on()) return this.avatarEdit(true);
    const m = Avatar.mood(), st = Avatar.stats(), sg = Avatar.stage(), cfg = Avatar.cfg();
    const pose = m.k === 'sofa' ? 'sofa' : m.k === 'cheer' ? 'cheer' : 'run';
    const sp = (Store.data.activities.slice(-1)[0] || {}).sport;
    this.render(`${this.back('profile', 'Seu atleta')}<main class="screen av-screen">
      <section class="av-stage-hero s${sg.i}"><div class="avs-art">${Avatar.svg(null, { pose: sp === 'ride' && m.k !== 'sofa' ? 'ride' : pose, mood: m.k, w: 210 })}</div>
        <div class="avh-bubble big">${esc(Avatar.line(m))}</div>
        <h1>${esc(sg.name)}</h1><p class="muted">Poder <b class="num">${st.pow}</b> · nível ${sg.lv}</p>
        ${sg.next ? `<div class="avs-next"><div class="row-t"><small>Próxima evolução: <b>${esc(sg.nextName)}</b></small><small class="num">nível ${sg.next}</small></div>${this.bar(sg.pct, 'brand')}</div>` : `<p class="avs-max">${I('crown', 'xs')} Estágio máximo alcançado!</p>`}
        <div class="row2"><button class="btn primary" data-act="go" data-v="avatarEdit">${I('edit')} Personalizar</button><button class="btn ghost" data-act="avPhoto">${I('camera')} Usar como foto</button></div>
      </section>
      ${this.sectionHead('Atributos')}
      <div class="list av-attrs">${Avatar.ATTR.map(([k, n, ic, c, how]) => `<div class="row" style="--c:${c}"><div class="ibox" style="--c:${c}">${I(ic)}</div><div class="grow"><div class="row-t"><b>${n}</b><b class="num">${st[k]}</b></div><i class="avb"><i style="width:${st[k]}%"></i></i><small>${how}</small></div></div>`).join('')}</div>
      <p class="muted small av-note">${I('info', 'xs')} Atributos só sobem treinando: não dá para comprar. Se você ficar uns dias parado, seu atleta fica com saudade, mas não perde nada.</p>
      ${this.sectionHead('Evolução')}
      <div class="av-evo">${Avatar.STAGES.map(([lv, n], i) => `<div class="${i <= sg.i ? 'on' : ''} ${i === sg.i ? 'cur' : ''}">${Avatar.svg(cfg, { pose: 'stand', mood: 'happy', w: 54, still: true, stage: i, stats: { vel: 1, res: 1, for: i >= 3 ? 70 : 1, con: i >= 2 ? 60 : 1 } })}<b>${n}</b><small>nível ${lv}</small></div>`).join('')}</div>
      ${Cloud.loggedIn() ? `${this.sectionHead(`Ranking: ${esc(sg.name)}`)}<div id="avRank" class="list"><div class="loading">Carregando…</div></div><p class="muted small">Você só disputa com atletas do mesmo estágio: é justo para quem está começando.</p>` : ''}
      <button class="btn ghost sm av-remove" data-act="avRemove">Remover meu atleta</button>
    </main>`);
    if (Cloud.loggedIn()) this.avatarRank();
  },
  async avatarRank() {
    const el = $('#avRank'); if (!el) return;
    let rows = [];
    try { rows = await Cloud.avatarRank(Avatar.stage().i); } catch (e) { el.innerHTML = '<p class="muted small">Ranking ainda não configurado no servidor (SQL do atleta).</p>'; return; }
    if (!$('#avRank')) return;
    const me = Cloud.user.id;
    el.innerHTML = rows.length ? rows.map((p, i) => `<button class="row tap ${p.id === me ? 'me' : ''}" data-act="userOpen" data-v="${p.id}"><b class="rk num">${i + 1}</b><div class="av-mini">${p.avatar_cfg ? Avatar.svg(p.avatar_cfg, { portrait: true, w: 40, mood: 'happy', stage: p.avatar_stage || 0, stats: (p.avatar_cfg.st || { vel: 1, res: 1, for: 1, con: 1 }) }) : ''}</div><div class="grow"><b>${esc(p.name || 'Atleta')}${p.id === me ? ' (você)' : ''}</b><small>${p.city ? esc(p.city) : ''}</small></div><b class="num pow">${p.avatar_pow || 0}</b></button>`).join('')
      : '<p class="muted small">Ninguém do seu estágio publicou um atleta ainda. Seja o primeiro!</p>';
  },

  // editor (criação e personalização) com a loja de itens
  avatarEdit(creating) {
    const D = Store.data;
    if (!this._avDraft || creating === true) this._avDraft = JSON.parse(JSON.stringify(D.avatar && D.avatar.on ? D.avatar : Avatar.defaults()));
    const c = this._avDraft, tab = App.avTab || 'body', st = Avatar.stats();
    const isNew = !(D.avatar && D.avatar.on);
    const sw = (k, list, cur, kind) => `<div class="av-sw">${list.map((v, i) => `<button class="${(kind === 'i' ? i : v[0]) === cur ? 'on' : ''}" data-act="avSet" data-k="${k}" data-v="${kind === 'i' ? i : v[0]}" ${kind === 'i' ? `style="--sw:${v}"` : ''}>${kind === 'i' ? '' : esc(v[1])}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'body') {
      body = `<span class="eyebrow">Tom de pele</span>${sw('skin', Avatar.SKIN, c.skin, 'i')}
        <span class="eyebrow">Cabelo</span>
        <div class="av-hair">${[['m', 'Masculinos'], ['f', 'Femininos']].map(([gk, gn]) => `<small class="av-hg">${gn}</small><div class="av-hgrid">${Avatar.HAIR.filter((h) => h[2] === gk).map(([id, nm]) => `<button class="av-hb ${id === c.hair ? 'on' : ''}" data-act="avSet" data-k="hair" data-v="${id}"><span>${Avatar.svg({ ...c, hair: id, eq: { ...c.eq, hat: 'hat_none', glasses: 'gl_none' } }, { portrait: true, still: true, w: 56, mood: 'happy', stats: st })}</span><b>${esc(nm)}</b></button>`).join('')}</div>`).join('')}</div>
        <span class="eyebrow">Cor do cabelo</span>${sw('hairC', Avatar.HAIRC, c.hairC, 'i')}
        <span class="eyebrow">Barba</span>${sw('beard', [['0', 'Sem barba'], ['1', 'Com barba']], c.beard ? '1' : '0')}`;
    } else {
      const items = Avatar.ITEMS.filter((r) => r[1] === tab).map((r) => Avatar.item(r[0]));
      body = `<div class="av-items">${items.map((it) => {
        const has = Avatar.has(it.id), on = c.eq[tab] === it.id, cond = it.cond && Avatar.COND[it.cond];
        const prev = { ...c, eq: { ...c.eq, [tab]: it.id } };
        const art = Avatar.svg(prev, { pose: tab === 'trail' ? 'run' : 'stand', still: true, mood: 'happy', w: tab === 'hat' || tab === 'glasses' ? 70 : 62, portrait: tab === 'hat' || tab === 'glasses', stats: st });
        const tag = on ? `<span class="it-tag on">${I('check', 'xs')} Usando</span>` : has ? '<span class="it-tag">Usar</span>' : cond ? `<span class="it-tag lock">${I('lock', 'xs')} ${esc(cond[0])}</span>` : `<span class="it-tag coin">${I('coin', 'xs')} ${it.price}</span>`;
        return `<button class="av-item ${on ? 'on' : ''} ${has ? '' : 'locked'}" data-act="avItem" data-v="${it.id}"><div class="it-art">${art}</div><b>${esc(it.name)}</b>${tag}</button>`;
      }).join('')}</div>`;
    }
    this.render(`${this.back(isNew ? 'home' : 'atleta', isNew ? 'Criar seu atleta' : 'Personalizar')}<main class="screen av-edit">
      <div class="ave-prev">${Avatar.svg(c, { pose: 'run', mood: 'happy', w: 170, stats: st })}<span class="coins">${I('coin', 'xs')} <b class="num">${D.coins}</b></span></div>
      ${this.tabsBar([['body', 'Corpo'], ...Avatar.CATS], tab, 'avTab')}
      <div class="ave-body">${body}</div>
      <button class="btn primary lg ave-save" data-act="avSave">${isNew ? 'Criar meu atleta' : 'Salvar'}</button>
    </main>`, false);
  },
});
