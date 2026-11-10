/* Notificações do celular (só no app instalado).
   - Avisos de quem segue, curte e comenta: o celular guarda um código secreto (token)
     ligado à conta e pergunta as novidades a cada ~15 min, mesmo com o app fechado.
   - Lembrete diário para treinar, com frases que variam (a parte nativa escolhe).
   - Treino ao vivo: distância, tempo e ritmo na notificação (App.onTick manda os números). */
const PushJG = {
  key: 'justgo_push_tok',
  tok() {
    let t = null;
    try { t = localStorage.getItem(this.key); } catch (e) {}
    if (!t) {
      t = (crypto.randomUUID && crypto.randomUUID()) || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
      try { localStorage.setItem(this.key, t); } catch (e) {}
    }
    return t;
  },
  data() {
    const D = Store.data, last = D.activities.reduce((m, a) => Math.max(m, a.start || 0), 0);
    let streak = 0; try { streak = Game.streakDays(); } catch (e) {}
    return {
      url: CONFIG.supabase.url, key: CONFIG.supabase.anonKey,
      name: D.profile.name || '', lastTrain: last, streak,
      social: Pref('notifSocial') !== false, remind: Pref('notifRemind') !== false, remindHour: +Pref('notifHour') || 18,
    };
  },
  async sync() {
    if (!Native.on || !Store.data) return;
    const data = this.data();
    if (Cloud.loggedIn()) {
      const tok = this.tok();
      try { const { error } = await Cloud.sb.rpc('push_register', { tok }); if (!error) data.tok = tok; } catch (e) {}
    }
    try { await Native.call('notifSetup', { data }, 15000); } catch (e) {}
  },
  async logout() {
    if (!Native.on) return;
    try { await Cloud.sb.rpc('push_unregister', { tok: this.tok() }); } catch (e) {}
    try { await Native.call('notifSetup', { data: { tok: null } }, 15000); } catch (e) {}
  },
  // ao abrir o app sem notificações ativas: pede para ativar
  async askOpen(tries = 0) {
    if (!Native.on || !Store.data || !Store.data.profile.onboarded || App.tracker) return;
    const md = $('#modal');
    if (md && md.classList.contains('show')) { if (tries < 6) setTimeout(() => this.askOpen(tries + 1), 4000); return; }
    const st = await Native.call('notifState', {}, 8000).catch(() => null);
    if (!st || st.enabled || App.tracker) return; // APK antigo ou já ativas
    const v = await FX.modal(`<div class="m-hero">${I('bell')}</div><h3>Ative as notificações</h3>
      <p class="muted">Saiba na hora quando alguém seguir você, curtir ou comentar um treino. Durante o treino, distância, tempo e ritmo aparecem na tela de bloqueio.</p>
      <div class="row2"><button class="btn ghost" data-m="no">Agora não</button><button class="btn primary" data-m="yes">Ativar</button></div>`);
    if (v !== 'yes') return;
    const r = await Native.call('notifAsk', {}, 60000).catch(() => null);
    if (r && r.ok) { FX.toast('Notificações ativadas!'); this.sync(); return; }
    // o Android não mostra mais a pergunta depois de recusada: vai direto para as configurações
    if ((st.build || 0) >= 37) { FX.toast('Ative “Notificações” e volte para o app'); await Native.call('notifSettings', {}, 10000).catch(() => null); return; }
    FX.modal(`<h3>Ative nas configurações</h3><p class="muted">Abra as <b>Configurações do Android → Apps → JustGo → Notificações</b> e ative.</p><button class="btn primary" data-m="ok">Entendi</button>`);
  },
  askOnce() { return this.askOpen(); },
  // aviso que chega com o app aberto: faixa no topo, toque abre
  inApp(n) {
    if (!n || App.tracker) return;
    document.querySelectorAll('.ib11').forEach((x) => x.remove());
    const el = document.createElement('button');
    el.className = 'ib11'; el.dataset.go = n.go || 'notifs';
    el.innerHTML = `<span class="ib11-ic">${I(/curtiu/.test(n.title) ? 'heart' : /seguir/.test(n.title) ? 'userPlus' : 'message')}</span><span class="ib11-t"><b>${esc(n.title || 'JustGo')}</b><small>${esc(n.body || '')}</small></span>`;
    el.onclick = () => {
      el.remove();
      const [k, ...rest] = String(el.dataset.go).split(':'), v = rest.join(':');
      if (!Cloud.loggedIn()) return;
      if (k === 'ra' && v) App.actions.raOpen({ dataset: { v, cm: '1' } });
      else if (k === 'user' && v) App.actions.userOpen({ dataset: { v } });
      else App.go('notifs');
    };
    document.body.append(el);
    FX.vibrate && FX.vibrate([12]);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 5500);
    try { if (UI.bellDot) UI.bellDot(); } catch (e) {}
  },
  async test() {
    FX.toast('Enviando notificação de teste…');
    const st = await Native.call('notifState', {}, 8000);
    if (!st) return FX.modal(`<h3>Atualize o app</h3><p class="muted">Esta versão do app instalado ainda não tem notificações. Instale a versão mais nova (Play Store ou o APK mais recente).</p><button class="btn primary" data-m="ok">Entendi</button>`);
    if (st.error) return FX.toast('Erro nas notificações: ' + String(st.error).slice(0, 120));
    if (!st.enabled) {
      const r = await Native.call('notifAsk', {}, 60000);
      if (!r || !r.ok) return FX.modal(`<h3>Notificações bloqueadas</h3><p class="muted">Abra as <b>Configurações do Android → Apps → JustGo → Notificações</b> e ative.</p><button class="btn primary" data-m="ok">Entendi</button>`);
    }
    const r = await Native.call('notifTest', { title: 'Tudo certo!', body: 'É assim que os avisos do JustGo vão aparecer.' }, 10000);
    if (!r || !r.ok) FX.toast('Não consegui mostrar a notificação' + (r && r.error ? ': ' + String(r.error).slice(0, 100) : ''));
    else setTimeout(() => FX.toast(st.fcm ? 'Avisos instantâneos ligados ⚡' : 'Avisos chegam a cada ~15 min (instantâneo ainda não ligado)'), 1800);
  },
};

(() => {
  // conta: registra ao entrar, desliga ao sair
  const al = Cloud.afterLogin.bind(Cloud);
  Cloud.afterLogin = async function (...a) { const r = await al(...a); setTimeout(() => PushJG.sync(), 2500); return r; };
  const lo = Cloud.logout.bind(Cloud);
  Cloud.logout = async function (...a) { await PushJG.logout(); return lo(...a); };
  // atualiza último treino/ofensiva sempre que o app vai para segundo plano
  document.addEventListener('visibilitychange', () => { if (document.hidden) PushJG.sync(); });
  setTimeout(() => PushJG.sync(), 4000);
  setTimeout(() => PushJG.askOpen(), 3500);
})();
