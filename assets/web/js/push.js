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
  // pede a permissão uma vez, explicando antes para que serve
  async askOnce() {
    if (!Native.on) return;
    let asked = null; try { asked = localStorage.getItem('justgo_notif_asked'); } catch (e) {}
    if (asked) return;
    const st = await Native.call('notifState', {}, 8000).catch(() => null);
    if (!st) return; // APK antigo, sem notificações
    try { localStorage.setItem('justgo_notif_asked', '1'); } catch (e) {}
    if (st.enabled) return;
    const v = await FX.modal(`<div class="m-hero" style="--c:var(--brand)">${I('bell')}</div><h3>Ativar notificações?</h3>
      <p class="muted">Avisamos quando alguém seguir você, curtir ou comentar um treino. Durante o treino, a distância, o tempo e o ritmo aparecem na tela de bloqueio.</p>
      <div class="row2"><button class="btn ghost" data-m="no">Agora não</button><button class="btn primary" data-m="yes">Ativar</button></div>`);
    if (v === 'yes') await Native.call('notifAsk', {}, 60000).catch(() => null);
  },
  async test() {
    const st = await Native.call('notifState', {}, 8000).catch(() => null);
    if (!st) return FX.toast('Atualize o app pela Play Store para ter notificações');
    if (!st.enabled) { const r = await Native.call('notifAsk', {}, 60000).catch(() => null); if (!r || !r.ok) return FX.toast('Notificações bloqueadas. Libere nas configurações do Android.'); }
    await Native.call('notifTest', { title: 'Tudo certo!', body: 'É assim que os avisos do JustGo vão aparecer.' });
  },
};

(() => {
  // conta: registra ao entrar, desliga ao sair
  const al = Cloud.afterLogin.bind(Cloud);
  Cloud.afterLogin = async function (...a) { const r = await al(...a); setTimeout(() => { PushJG.sync(); PushJG.askOnce(); }, 2500); return r; };
  const lo = Cloud.logout.bind(Cloud);
  Cloud.logout = async function (...a) { await PushJG.logout(); return lo(...a); };
  // atualiza último treino/ofensiva sempre que o app vai para segundo plano
  document.addEventListener('visibilitychange', () => { if (document.hidden) PushJG.sync(); });
  setTimeout(() => PushJG.sync(), 4000);
})();
