/* =========================================================
   JustGo — PONTE COM O APP ANDROID (Flutter)
   No navegador não faz nada. Dentro do app, troca o GPS,
   a voz, o compartilhamento e os links pelos recursos nativos.
   ========================================================= */
const Native = {
  on: typeof window.JustGoNative !== 'undefined',
  seq: 0, pend: {}, watchers: {}, errs: {}, wseq: 0, last: null,

  // chama o lado Flutter e espera a resposta
  call(cmd, args = {}) {
    if (!this.on) return Promise.resolve(null);
    const id = ++this.seq;
    return new Promise((res) => {
      this.pend[id] = res;
      try { window.JustGoNative.postMessage(JSON.stringify({ id, cmd, ...args })); } catch (e) { delete this.pend[id]; return res(null); }
      setTimeout(() => { if (this.pend[id]) { delete this.pend[id]; res(null); } }, 45000);
    });
  },
  _resolve(id, data) { const f = this.pend[id]; if (f) { delete this.pend[id]; f(data); } },

  // posições vindas do GPS nativo (também em lote, quando o app volta do segundo plano)
  _pos(p) { this.last = p; Object.values(this.watchers).forEach((w) => { try { w(p); } catch (e) { console.error(e); } }); },
  _posBatch(list) { (list || []).forEach((p) => this._pos(p)); },
  _geoError(code, msg) { Object.values(this.errs).forEach((f) => { try { f && f({ code, message: msg }); } catch (e) {} }); },

  // botão "voltar" do Android: 'handled' | 'training' | 'exit'
  // Fecha primeiro o que está por cima (janela, ajuste de foto, compartilhar), depois volta
  // de tela em tela até o Início. No Início, pede um segundo toque para sair do app.
  back() {
    const prev = this._backAt || 0; this._backAt = 0;
    try {
      const m = document.getElementById('modal');
      if (m && m.classList.contains('show')) {
        const b = m.querySelector('[data-m=no]') || m.querySelector('[data-m=ok]');
        if (b) b.click(); else { m.classList.remove('show'); m.innerHTML = ''; }
        return 'handled';
      }
      const ov = [...document.querySelectorAll('body > .crop')].pop();
      if (ov) { const b = ov.querySelector('[data-c=no]'); if (b) b.click(); else ov.remove(); return 'handled'; }
      const cd = document.querySelector('body > .countdown'); if (cd) return 'handled';
      if (typeof App === 'undefined') return 'exit';
      if (App.tracker) return 'training';
      if (typeof SwimSet !== 'undefined' && SwimSet.s) return 'training';
      if (App.tab === 'view3d') { App.actions.v3Close(); return 'handled'; }
      if (App.tab === 'retro') { App.actions.retroClose(); return 'handled'; }
      if (App.tab && App.tab !== 'home') {
        const back = document.querySelector('.top .back, .top [data-act=back], header .back, [data-act=back]');
        const t0 = App.tab;
        if (back) back.click();
        if (!back || App.tab === t0) App.go('home');
        return 'handled';
      }
      // no Início: rolou para baixo? volta ao topo primeiro
      const sc = document.scrollingElement || document.documentElement;
      if (sc && sc.scrollTop > 200) { window.scrollTo({ top: 0, behavior: 'smooth' }); return 'handled'; }
      const now = Date.now();
      if (now - prev < 2200) return 'exit';
      this._backAt = now; typeof FX !== 'undefined' && FX.toast('Toque em voltar de novo para sair');
      return 'handled';
    } catch (e) { try { if (typeof App !== 'undefined' && App.tab !== 'home') { App.go('home'); return 'handled'; } } catch (e2) {} }
    return 'exit';
  },

  // nova versão do visual baixada em segundo plano pelo app
  updateReady(build) {
    if (document.querySelector('.upd')) return;
    const el = document.createElement('div'); el.className = 'upd';
    el.innerHTML = '<div class="grow"><b>Nova versão do JustGo</b><small>Toque para atualizar agora</small></div><button class="go">Atualizar</button><button class="x" aria-label="Depois">✕</button>';
    el.querySelector('.go').onclick = () => {
      if (window.App && App.tracker) { el.remove(); window.FX && FX.toast('Atualiza sozinho quando o treino terminar.'); return; }
      el.remove(); this.call('reload');
    };
    el.querySelector('.x').onclick = () => el.remove();
    document.body.appendChild(el);
  },

  // arquivo (Blob) → menu de compartilhar do Android
  async shareBlob(name, blob, mime) {
    const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
    return this.call('share', { name, mime: mime || blob.type || 'application/octet-stream', b64 });
  },
};
window.JG = Native;

if (Native.on) {
  document.documentElement.classList.add('is-native');
  const toPos = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, altitude: p.alt, accuracy: p.acc, speed: p.speed, heading: null, altitudeAccuracy: null }, timestamp: p.t });
  const geo = {
    getCurrentPosition(ok, err) {
      Native.call('geoGet', { ask: true }).then((r) => (r && r.lat != null ? ok(toPos(r)) : err && err({ code: r && r.denied ? 1 : 2, message: 'Sem localização' })));
    },
    watchPosition(ok, err) {
      const id = ++Native.wseq;
      Native.watchers[id] = (p) => ok(toPos(p)); Native.errs[id] = err;
      Native.call('geoWatch').then((r) => { if (r && r.denied && err) err({ code: 1, message: 'Permissão negada' }); });
      if (Native.last && Date.now() - Native.last.t < 15000) setTimeout(() => Native.watchers[id] && ok(toPos(Native.last)), 0);
      return id;
    },
    clearWatch(id) {
      delete Native.watchers[id]; delete Native.errs[id];
      if (!Object.keys(Native.watchers).length) Native.call('geoUnwatch');
    },
  };
  try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (e) {}
  // links que abririam nova janela vão para o app certo (WhatsApp, mapas…)
  window.open = (url) => { if (url) Native.call('open', { url: String(url) }); return null; };
}
