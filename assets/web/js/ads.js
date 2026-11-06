/* =========================================================
   JustGo — RECOMPENSAS COM ANÚNCIO (AdMob, só no app Android)
   1. Salvar a ofensiva      (1x a cada 7 dias)
   2. Escudo de território   (24 h, 1x por dia)
   3. Dobrar o XP do treino  (até 3x por dia)
   4. Testar função bloqueada por 24 h (1x por dia)
   ========================================================= */
const Ads = {
  native: 0,
  LIM: { xp: 3, trial: 1, shield: 1 },
  async init() { if (!Native.on) return; try { const v = await Native.call('version'); this.native = (v && v.native) || 0; } catch (e) {} },
  visible() { return Native.on; }, // no navegador não há anúncio
  ok() { return Native.on && this.native >= 28; },
  used(k) { const u = (Store.data.adUse || {})[k], d = Game.dayKey(Date.now()); return u && u.d === d ? u.n : 0; },
  left(k) { return Math.max(0, (this.LIM[k] || 1) - this.used(k)); },
  mark(k) { const D = Store.data; D.adUse = D.adUse || {}; const d = Game.dayKey(Date.now()), u = D.adUse[k]; D.adUse[k] = { d, n: u && u.d === d ? u.n + 1 : 1 }; Store.save(); },
  busy: false,
  // mostra o anúncio; true = assistiu até o fim
  async show(kind = 'xp') {
    if (!this.ok()) {
      if (Native.on) FX.modal(`<div class="ui8"><span class="ui8-ic">${I('download')}</span><h3>Atualize o app</h3><p class="muted">As recompensas precisam da versão nova do JustGo. Instale o APK mais recente ou atualize pela Play Store.</p><button class="btn primary" data-m="ok">Entendi</button></div>`);
      else FX.toast('Recompensas com anúncio estão disponíveis no app Android.');
      return false;
    }
    if (this.busy) return false; this.busy = true;
    FX.toast('Carregando o anúncio…');
    let r = null; try { r = await Native.call('adReward', { kind }); } catch (e) {} finally { this.busy = false; }
    if (r && r.rewarded) return true;
    FX.toast(r && r.error === 'noFill' ? 'Nenhum anúncio disponível agora. Tente de novo em alguns minutos.' : 'Assista até o fim para ganhar a recompensa.');
    return false;
  },

  /* ---------- 1. ofensiva ---------- */
  yKey() { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1); return Game.dayKey(d); },
  streakOffer() {
    const D = Store.data; if (!this.visible()) return null;
    if (D.lastStreakSave && Date.now() - D.lastStreakSave < 7 * 864e5) return null;
    const days = new Set(Game.acts().map((a) => Game.dayKey(a.start)).concat(D.streakSaves || [])), y = this.yKey();
    if (days.has(y)) return null;
    const cur = Game.streakDays();
    D.streakSaves = (D.streakSaves || []).concat([y]); const would = Game.streakDays(); D.streakSaves.pop();
    return would >= 3 && would > cur ? { would, cur } : null;
  },
  async saveStreak() {
    const o = this.streakOffer(); if (!o) return;
    if (!(await this.show('streak'))) return;
    const D = Store.data; D.streakSaves = (D.streakSaves || []).concat([this.yKey()]).slice(-30); D.lastStreakSave = Date.now(); Store.save();
    FX.beep([523, 659, 784, 1047]); FX.vibrate([30, 40, 30]);
    FX.modal(`<div class="ui8"><span class="ui8-ic on" style="background:linear-gradient(135deg,#FB923C,#EA580C)">${I('flame')}</span><h3>Ofensiva salva!</h3><p class="muted">Seus <b>${o.would} dias</b> seguidos continuam valendo. Treine hoje para somar mais um.</p><button class="btn primary" data-m="ok">Bora!</button></div>`);
    if (App.tab === 'home') UI.home();
  },

  /* ---------- 2. escudo ---------- */
  shieldOn() { return (Store.data.shieldUntil || 0) > Date.now(); },
  shieldOffer() {
    if (!this.visible() || !Cloud.loggedIn() || this.shieldOn() || !this.left('shield')) return null;
    const z = (Cloud._notifs || []).find((n) => n.k === 'zone' && Date.now() - n.t < 48 * 3600e3);
    return z ? { who: (z.u && z.u.name) || 'Alguém', area: z.area || 0 } : null;
  },
  async shield() {
    if (this.shieldOn()) return FX.toast('O escudo já está ativo.');
    if (!this.left('shield')) return FX.toast('Você já usou o escudo hoje. Volte amanhã!');
    if (!(await this.show('shield'))) return;
    try {
      const u = await Cloud.activateShield(); this.mark('shield');
      Store.data.shieldUntil = Date.parse(u) || Date.now() + 24 * 3600e3; Store.save();
      FX.beep([392, 523, 659]);
      FX.modal(`<div class="ui8"><span class="ui8-ic on" style="background:linear-gradient(135deg,#34D399,#059669)">${I('shield')}</span><h3>Escudo ativado!</h3><p class="muted">Ninguém consegue roubar suas áreas até <b>${new Date(Store.data.shieldUntil).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</b>.</p><button class="btn primary" data-m="ok">Perfeito</button></div>`);
      if (App.tab === 'home') UI.home();
    } catch (e) { FX.toast(/limite/.test(String(e && e.message)) ? 'Você já usou o escudo hoje.' : /function|schema/.test(String(e && e.message)) ? 'Escudo ainda não ativado no servidor.' : 'Não foi possível ativar agora.'); }
  },

  /* ---------- 3. dobrar XP ---------- */
  async doubleXp(id) {
    const a = App.find(id); if (!a || a.xpDoubled || !(a.xp > 0)) return;
    if (!this.left('xp')) return FX.toast('Você já dobrou 3 treinos hoje. Volte amanhã!');
    if (!(await this.show('xp'))) return;
    const D = Store.data, add = a.xp, lv0 = Game.level(D.xp);
    D.xp += add; D.xpLog = D.xpLog || []; D.xpLog.push([Date.now(), add]); a.xpDoubled = 1; a.xp += add; this.mark('xp'); Store.save();
    FX.beep([659, 784, 988, 1319]); FX.vibrate([30, 40, 30]);
    const el = $('#adXp'); if (el) el.outerHTML = `<div class="ad8 done" id="adXp"><span class="ad8-ic">${I('zap')}</span><div class="grow"><b>XP dobrado!</b><small>+${add} XP extra neste treino</small></div><span class="ad8-big num">+${a.xp}</span></div>`;
    const lv1 = Game.level(D.xp); if (lv1 > lv0) FX.toast(`Subiu para o nível ${lv1}!`);
  },

  /* ---------- 4. testar função ---------- */
  trialOn(id) { return ((Store.data.trials || {})[id] || 0) > Date.now(); },
  async trial(id) {
    if (!this.left('trial')) return FX.toast('Você já testou uma função hoje. Volte amanhã!');
    if (!(await this.show('trial'))) return;
    const D = Store.data; D.trials = D.trials || {}; D.trials[id] = Date.now() + 24 * 3600e3; this.mark('trial'); Store.save();
    const u = Game.unlock(id); FX.beep([523, 784]);
    FX.modal(`<div class="ui8"><span class="ui8-ic on">${I(u.icon)}</span><h3>${esc(u.name)} liberada por 24 h</h3><p class="muted">Aproveite! Para ficar com ela para sempre: ${esc(Game.reqText(u.req).toLowerCase())}.</p><button class="btn primary" data-m="ok">Usar agora</button></div>`);
    if (App.tab === 'progress') UI.progress();
  },

  /* ---------- cartões ---------- */
  homeCards() {
    let h = '';
    const s = this.streakOffer();
    if (s) h += `<section class="ad8 fire" data-act="adStreak"><span class="ad8-ic">${I('flame')}</span><div class="grow"><b>Sua ofensiva de ${s.would} dias vai zerar</b><small>Você não treinou ontem. Assista a um anúncio e salve a sequência.</small></div><span class="ad8-go">${I('play', 'xs')}Salvar</span></section>`;
    if (this.shieldOn()) h += `<section class="ad8 ok"><span class="ad8-ic">${I('shield')}</span><div class="grow"><b>Escudo ativo</b><small>Suas áreas estão protegidas até ${new Date(Store.data.shieldUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</small></div></section>`;
    else { const z = this.shieldOffer(); if (z) h += `<section class="ad8 grn" data-act="adShield"><span class="ad8-ic">${I('shield')}</span><div class="grow"><b>${esc(z.who.split(' ')[0])} roubou sua área</b><small>Proteja suas outras áreas por 24 h assistindo a um anúncio.</small></div><span class="ad8-go">${I('play', 'xs')}Proteger</span></section>`; }
    return h;
  },
};

/* teste de 24 h conta como liberada */
Game.has = function (id) { return !!Store.data.unlocked[id] || Ads.trialOn(id); };
/* dias salvos pela recompensa contam na ofensiva */
(() => {
  const orig = Game.acts.bind(Game);
  const origStreak = Game.streakDays;
  Game.streakDays = function (useShield = true) {
    const saves = Store.data.streakSaves || []; if (!saves.length) return origStreak.call(this, useShield);
    const keep = this.acts; const extra = saves.map((k) => { const [y, m, d] = String(k).split('-').map(Number); return { start: new Date(y, m - 1, d, 12).getTime(), distance: 0, duration: 0, sport: 'run', _save: 1 }; }).filter((x) => isFinite(x.start));
    this.acts = () => orig().concat(extra);
    try { return origStreak.call(this, useShield); } finally { this.acts = keep; }
  };
})();

/* cartões no Início */
(() => {
  const orig = UI.home;
  UI.home = function () { const r = orig.apply(this, arguments); try { const h = Ads.homeCards(), el = $('#hTorch'); if (h && el) el.insertAdjacentHTML('beforebegin', `<div class="ad8-wrap">${h}</div>`); } catch (e) { console.warn(e); } return r; };
})();

/* dobrar XP no resumo do treino recém-feito */
(() => {
  const orig = UI.summary;
  UI.summary = function (act, res, fresh) {
    const r = orig.apply(this, arguments);
    try {
      if (act && (fresh || Date.now() - act.start < 3 * 3600e3) && act.xp > 0 && Ads.visible() && !act.flagged) {
        const el = $('.summary .big-stats'); if (!el) return r;
        const html = act.xpDoubled ? `<div class="ad8 done" id="adXp"><span class="ad8-ic">${I('zap')}</span><div class="grow"><b>XP dobrado!</b><small>+${act.xp / 2} XP extra neste treino</small></div><span class="ad8-big num">+${act.xp}</span></div>`
          : Ads.left('xp') ? `<div class="ad8 xp" id="adXp" data-act="adXp" data-v="${act.id}"><span class="ad8-ic">${I('zap')}</span><div class="grow"><b>Dobre seu XP</b><small>+${act.xp} vira <b class="inl">+${act.xp * 2} XP</b> com um anúncio curto · ${Ads.left('xp')} de 3 hoje</small></div><span class="ad8-go">${I('play', 'xs')}Dobrar</span></div>` : '';
        if (html) el.insertAdjacentHTML('afterend', html);
      }
    } catch (e) { console.warn(e); }
    return r;
  };
})();

window.addEventListener('load', () => setTimeout(() => Ads.init(), 800));
