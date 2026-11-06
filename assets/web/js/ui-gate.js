/* =========================================================
   JustGo — ENTRADA DO APP
   Boas-vindas com vídeo, login/criar conta e configuração do perfil.
   Sem conta não entra: o app sempre abre aqui até a pessoa logar.
   ========================================================= */
Object.assign(UI, {
  GOOGLE_G: '<svg viewBox="0 0 24 24" class="ic"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>',

  // vídeo de fundo: carregado como blob (o servidor do app Android não manda o tipo do mp4)
  async gateVideo() {
    const v = $('#gateVid'); if (!v) return;
    try {
      if (!this._welBlob) { const r = await fetch('img/welcome.mp4'); if (!r.ok) return; this._welBlob = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: 'video/mp4' })); }
      if (!document.body.contains(v)) return;
      v.src = this._welBlob; v.muted = true; v.loop = true; v.playsInline = true;
      v.addEventListener('playing', () => v.classList.add('on'), { once: true });
      await v.play();
    } catch (e) {}
  },
  gateBg(extra = '') {
    return `<div class="gate-bg ${extra}"><img src="img/welcome.jpg" alt=""><video id="gateVid" muted playsinline loop preload="none"></video></div><div class="gate-shade"></div>`;
  },

  /* ---------- 1. boas-vindas ---------- */
  welcome() {
    App.tab = 'gate'; App.gateStep = 'welcome';
    const st = Cloud.settings || {};
    const sp = ['run', 'ride', 'swim', 'walk', 'hike', 'board'];
    this.render(`<main class="gate wel">
      ${this.gateBg()}
      <div class="wel-top">${this.brand()}</div>
      <div class="wel-body">
        <div class="wel-sports">${sp.map((k, i) => `<span style="--c:${CONFIG.sports[k].color};--d:${i * 0.07 + 0.2}s">${I(SPORT_IC[k])}</span>`).join('')}</div>
        <h1><span style="--d:.25s">Seu treino.</span><span style="--d:.4s">Sua cidade.</span><span class="hl" style="--d:.55s">Seu jogo.</span></h1>
        <p style="--d:.7s">Grave com GPS, conquiste territórios no seu bairro, suba de liga e treine junto com a sua galera.</p>
        <div class="wel-feats" style="--d:.8s"><span>${I('flag')}Territórios</span><span>${I('trophy')}Ligas e missões</span><span>${I('users')}Amigos</span></div>
        <div class="wel-cta" style="--d:.95s">
          <button class="btn wel-main" data-act="gateAuth" data-v="signup">Criar conta grátis ${I('chevronRight')}</button>
          ${st.google !== false ? `<button class="btn wel-glass" data-act="loginGoogle">${this.GOOGLE_G}Continuar com Google</button>` : ''}
          <button class="wel-link" data-act="gateAuth" data-v="signin">Já tem conta? <b>Entrar</b></button>
          <p class="wel-legal">Ao continuar, você aceita os <button data-act="legal" data-v="terms">Termos de Uso</button> e a <button data-act="legal" data-v="privacy">Política de Privacidade</button>.</p>
        </div>
      </div>
    </main>`, false);
    this.gateVideo();
  },

  /* ---------- 2. entrar / criar conta ---------- */
  authx(mode) {
    mode = mode || App.authMode || 'signup'; App.authMode = mode; App.tab = 'gate'; App.gateStep = 'auth';
    const up = mode === 'signup', st = Cloud.settings || {};
    this.render(`<main class="gate ax">
      ${this.gateBg('blur')}
      <div class="ax-top"><button class="ax-back" data-act="gateBack" aria-label="Voltar">${I('chevronLeft')}</button>${this.brand()}<span style="width:40px"></span></div>
      <div class="ax-head"><span class="ax-kick">${up ? 'Comece grátis' : 'Bom te ver de novo'}</span><h1>${up ? 'Crie sua conta' : 'Entre no JustGo'}</h1><p>${up ? 'Seus treinos ficam salvos na nuvem e você já entra no ranking da sua cidade.' : 'Seus treinos, ligas e amigos estão te esperando.'}</p></div>
      <section class="ax-sheet">
        <div class="ax-seg"><button class="${up ? '' : 'on'}" data-act="gateAuth" data-v="signin">Entrar</button><button class="${up ? 'on' : ''}" data-act="gateAuth" data-v="signup">Criar conta</button><i style="transform:translateX(${up ? 100 : 0}%)"></i></div>
        ${up ? `<label class="ax-terms"><input type="checkbox" id="authTerms"><span class="ax-box">${I('check')}</span><span>Li e concordo com os <button type="button" data-act="legal" data-v="terms">Termos de Uso</button> e a <button type="button" data-act="legal" data-v="privacy">Política de Privacidade</button>, e tenho 13 anos ou mais.</span></label>` : ''}
        ${st.google !== false ? `<button class="btn ax-google" data-act="loginGoogle">${this.GOOGLE_G}Continuar com Google</button><div class="ax-or"><span>ou com e-mail</span></div>` : ''}
        <form id="authForm" class="ax-form" autocomplete="on" novalidate>
          <label class="ax-field"><span class="ax-ic">${I('mail')}</span><input id="authEmail" type="email" inputmode="email" autocomplete="email" placeholder="Seu e-mail" required></label>
          <label class="ax-field"><span class="ax-ic">${I('lock')}</span><input id="authPass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="${up ? 'Crie uma senha (6+ caracteres)' : 'Sua senha'}" minlength="6" required><button type="button" class="ax-eye" data-act="pwToggle" aria-label="Mostrar senha">${I('eyeOff')}</button></label>
          ${up ? '<div class="ax-str" id="pwStr"><i></i><i></i><i></i><i></i><span>Use letras e números</span></div>' : ''}
          <div class="auth-err" id="authErr" hidden></div>
          <button type="submit" class="btn ax-submit" id="authBtn">${up ? 'Criar conta' : 'Entrar'}</button>
        </form>
        ${up ? '<p class="ax-note">Seu treino e sua localização só são usados para o app funcionar. Veja a Política de Privacidade.</p>' : '<button class="ax-forgot" data-act="forgot">Esqueci minha senha</button><p class="ax-note">Ao entrar, você aceita os <button data-act="legal" data-v="terms">Termos de Uso</button> e a <button data-act="legal" data-v="privacy">Política de Privacidade</button>.</p>'}
        <p class="ax-switch">${up ? 'Já tem conta?' : 'Ainda não tem conta?'} <button data-act="gateAuth" data-v="${up ? 'signin' : 'signup'}">${up ? 'Entrar' : 'Criar agora'}</button></p>
      </section>
    </main>`, false);
    this.gateVideo();
    const pw = $('#authPass'), bar = $('#pwStr');
    if (pw && bar) pw.addEventListener('input', () => {
      const v = pw.value, s = (v.length >= 6) + (v.length >= 10) + (/\d/.test(v) && /[a-z]/i.test(v)) + /[^a-z0-9]/i.test(v);
      bar.dataset.s = v ? s : ''; bar.querySelector('span').textContent = !v ? 'Use letras e números' : s <= 1 ? 'Senha fraca' : s === 2 ? 'Senha ok' : s === 3 ? 'Senha forte' : 'Senha muito forte';
    });
  },

  /* ---------- 3. configurar o perfil (só na primeira vez) ---------- */
  setup(step = 0) {
    App.tab = 'gate'; App.gateStep = 'setup'; App.setupStep = step;
    const P = Store.data.profile, S = App.setupData || (App.setupData = {
      name: (Cloud.me && Cloud.me.name) || (P.name && P.name !== 'Atleta' ? P.name : ''),
      user: (Cloud.me && Cloud.me.username) || '', city: (Cloud.me && Cloud.me.city) || P.city || (Store.data.lastCity || ''),
      sports: P.sports && P.sports.length ? [...P.sports] : ['run'], exp: P.experience || 'iniciante', goal: P.goalWeek || 10,
    });
    const steps = ['Perfil', 'Esportes', 'Meta'], pct = ((step + 1) / steps.length) * 100;
    const head = (k, t, p) => `<div class="su-head"><span class="su-kick">${k}</span><h1>${t}</h1><p>${p}</p></div>`;
    let body = '';
    if (step === 0) {
      body = `${head('Passo 1 de 3', 'Como a galera vai te achar?', 'Seu nome e @ aparecem no feed, nos rankings e no mapa de territórios.')}
        <div class="su-av"><div class="su-av-c" id="suAv">${esc((S.name || 'J')[0].toUpperCase())}</div><small>Você coloca sua foto depois, no Perfil</small></div>
        <label class="su-field"><span>Nome</span><input id="suName" value="${esc(S.name)}" placeholder="Como você quer ser chamado" autocomplete="name" maxlength="40"></label>
        <label class="su-field"><span>Nome de usuário</span><div class="su-at"><b>@</b><input id="suUser" value="${esc(S.user)}" placeholder="ex.: lucas.corre" autocapitalize="off" autocomplete="off" maxlength="20"></div><small id="suUserMsg">Letras, números, ponto e _</small></label>
        <label class="su-field"><span>Cidade</span><div class="su-at"><b>${I('mapPin', 'xs')}</b><input id="suCity" value="${esc(S.city)}" placeholder="ex.: Vitória" maxlength="40"></div><small>Para o ranking e os territórios da sua região</small></label>`;
    } else if (step === 1) {
      body = `${head('Passo 2 de 3', 'O que você pratica?', 'Escolha quantos quiser. As missões e o Início se ajustam a eles.')}
        <div class="su-sports">${Object.entries(CONFIG.sports).map(([k, s]) => `<button class="su-sp ${S.sports.includes(k) ? 'on' : ''}" style="--c:${s.color}" data-act="suSport" data-v="${k}"><span>${I(SPORT_IC[k])}</span><b>${s.name}</b><i>${I('check')}</i></button>`).join('')}</div>
        <div class="su-lab">Seu nível</div>
        <div class="su-exp">${[['iniciante', 'Iniciante', 'Estou começando'], ['intermediario', 'Intermediário', 'Treino toda semana'], ['avancado', 'Avançado', 'Provas e metas altas']].map(([k, n, d]) => `<button class="${S.exp === k ? 'on' : ''}" data-act="suExp" data-v="${k}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>`;
    } else {
      const sugg = S.exp === 'avancado' ? [30, 50, 80] : S.exp === 'intermediario' ? [15, 25, 40] : [5, 10, 20];
      body = `${head('Passo 3 de 3', 'Qual a sua meta semanal?', 'Ela aparece no Início com um anel que enche a cada treino. Dá pra mudar quando quiser.')}
        <div class="su-goal"><button class="su-pm" data-act="suGoal" data-v="-1" aria-label="Menos">${I('minus')}</button><div><b class="num" id="suGoalN">${S.goal}</b><span>km por semana</span></div><button class="su-pm" data-act="suGoal" data-v="1" aria-label="Mais">${I('plus')}</button></div>
        <div class="su-chips">${sugg.map((v, i) => `<button class="${S.goal === v ? 'on' : ''}" data-act="suGoalSet" data-v="${v}">${v} km<small>${['Leve', 'Equilibrada', 'Puxada'][i]}</small></button>`).join('')}</div>
        <div class="su-sum">${I('sparkles')}<span>Com ${S.goal} km por semana você fecha cerca de <b>${Math.max(1, Math.round(S.goal * 4.3))} km por mês</b> e já começa com 3 missões valendo XP.</span></div>`;
    }
    this.render(`<main class="gate su">
      <div class="su-top"><button class="ax-back dark" data-act="${step ? 'suStep' : 'gateLogout'}" data-v="${step - 1}" aria-label="Voltar">${I('chevronLeft')}</button><div class="su-prog"><i style="width:${pct}%"></i></div><span class="su-n">${step + 1}/3</span></div>
      <div class="su-body">${body}</div>
      <div class="su-foot"><div class="auth-err" id="suErr" hidden></div><button class="btn su-next" id="suNext" data-act="suNext">${step < 2 ? 'Continuar' : 'Começar a treinar'} ${I('chevronRight')}</button></div>
    </main>`, false);
    if (step === 0) {
      const n = $('#suName'), u = $('#suUser'), av = $('#suAv');
      const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.').replace(/[^a-z0-9_.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '').slice(0, 20);
      let touched = !!S.user;
      n.addEventListener('input', () => { S.name = n.value; av.textContent = (n.value.trim() || 'J')[0].toUpperCase(); if (!touched) { u.value = slug(n.value); S.user = u.value; this.suCheck(); } });
      u.addEventListener('input', () => { touched = true; const c = u.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''); if (c !== u.value) u.value = c; S.user = c; this.suCheck(); });
      $('#suCity').addEventListener('input', (e) => { S.city = e.target.value; });
      if (!S.name) setTimeout(() => n.focus(), 350);
      if (S.user) this.suCheck();
    }
  },
  // confere se o @ está livre (com um pequeno atraso enquanto digita)
  suCheck() {
    clearTimeout(this._suT);
    const m = $('#suUserMsg'), u = (App.setupData || {}).user || '';
    if (!m) return;
    m.className = '';
    if (u.length < 3) { m.textContent = 'Mínimo de 3 caracteres'; App.userOk = false; return; }
    m.textContent = 'Conferindo…';
    this._suT = setTimeout(async () => {
      try {
        const { data } = await Cloud.sb.from('profiles').select('id').eq('username', u).maybeSingle();
        if (((App.setupData || {}).user || '') !== u) return;
        const free = !data || (Cloud.user && data.id === Cloud.user.id);
        App.userOk = free; m.className = free ? 'ok' : 'bad'; m.innerHTML = free ? `${I('check', 'xs')} @${esc(u)} está livre` : `@${esc(u)} já está em uso`;
      } catch (e) { App.userOk = true; m.textContent = 'Letras, números, ponto e _'; }
    }, 380);
  },
});
