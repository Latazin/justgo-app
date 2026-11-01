/* =========================================================
   JustGo — EFEITOS E UTILITÁRIOS
   Som, voz, confete, modais, gráficos, download e GPX
   ========================================================= */
const FX = {
  /* ---------- som (Web Audio, sem arquivos) ---------- */
  beep(notes = [523, 659, 784, 1046]) {
    if (!Pref('sounds')) return;
    try {
      const ctx = this.audio || (this.audio = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === 'suspended') ctx.resume();
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.11;
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4);
      });
    } catch (e) {}
  },
  vibrate(p = [60, 40, 60]) { if (!Pref('haptics')) return; try { if (Native.on) { Native.call('haptic'); } navigator.vibrate && navigator.vibrate(p); } catch (e) {} },

  /* ---------- voz (Web Speech API) ---------- */
  say(text) {
    if (!Pref('voice')) return;
    if (Native.on) { Native.call('say', { text }); return; }
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('pt'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  },
  spokenTime(s) {
    s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = [];
    if (h) p.push(`${h} ${h > 1 ? 'horas' : 'hora'}`);
    if (m) p.push(`${m} ${m > 1 ? 'minutos' : 'minuto'}`);
    if (x || !p.length) p.push(`${x} ${x === 1 ? 'segundo' : 'segundos'}`);
    return p.join(' e ');
  },

  /* ---------- toast e modal ---------- */
  toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('show'), 2800);
  },
  // retorna Promise com o data-m do botão clicado
  modal(html) {
    return new Promise((res) => {
      const m = $('#modal');
      m.innerHTML = `<div class="modal-bg"><div class="modal-box"><i class="m-grip"></i>${html}</div></div>`;
      // emoji do título vira um ícone em destaque (visual mais limpo)
      const h = m.querySelector('.modal-box > h3');
      if (h && !m.querySelector('.modal-box > .m-done, .modal-box > .m-ic')) {
        const re = /\s*(\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u, mm = h.textContent.match(re);
        if (mm) { h.innerHTML = h.innerHTML.replace(mm[1], '').replace(/\uFE0F/g, '').trim(); const ic = document.createElement('div'); ic.className = 'm-ic'; ic.textContent = mm[1]; h.before(ic); }
      }
      m.classList.add('show');
      m.onclick = (e) => {
        let b = e.target.closest('[data-m]');
        // toque fora da janela = cancelar (quando existe a opção)
        if (!b && e.target.classList.contains('modal-bg')) b = m.querySelector('[data-m=no]');
        if (!b) return;
        // guarda o que foi digitado antes de fechar
        this.form = {};
        m.querySelectorAll('input[id], textarea[id], select[id]').forEach((el) => { this.form[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        m.querySelectorAll('input[type=radio]:checked').forEach((el) => { this.form[el.name] = el.value; });
        m.classList.remove('show'); m.innerHTML = ''; m.onclick = null;
        res(b.dataset.m);
      };
    });
  },
  // formulário rápido em modal: fields = [[id, rótulo, tipo, valor, placeholder]]
  async prompt(title, fields, ok = 'Salvar', text = '') {
    const html = `<h3>${title}</h3>${text ? `<p class="muted">${text}</p>` : ''}<div class="form">${fields.map(([id, l, t = 'text', v = '', ph = '', extra = '']) =>
      t === 'select' ? `<label class="field"><span>${l}</span><select id="${id}">${v}</select></label>` : `<label class="field"><span>${l}</span><input id="${id}" type="${t}" value="${esc(v)}" placeholder="${esc(ph)}" ${extra}></label>`).join('')}</div>
      <div class="row2"><button class="btn ghost" data-m="no">Cancelar</button><button class="btn primary" data-m="ok">${ok}</button></div>`;
    const r = await this.modal(html);
    return r === 'ok' ? this.form : null;
  },
  confirm(title, text, ok = 'Confirmar', danger = false) {
    return this.modal(`<h3>${title}</h3><p class="muted">${text}</p><div class="row2"><button class="btn ghost" data-m="no">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-m="yes">${ok}</button></div>`).then((v) => v === 'yes');
  },

  /* ---------- confete ---------- */
  // efeito de chegada (loja): confete, fogos ou pulso
  finish() {
    const fx = (typeof Shop !== 'undefined' && Shop.val('finish')) || 'confetti';
    if (fx === 'fireworks') return this.fireworks();
    if (fx === 'pulse') { const d = document.createElement('div'); d.className = 'pulse-fx'; document.body.appendChild(d); setTimeout(() => d.remove(), 1400); return; }
    this.confetti();
  },
  fireworks() {
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const ctx = c.getContext('2d'), W = (c.width = innerWidth), H = (c.height = innerHeight), P = [];
    const cols = ['#1F6BFF', '#FFB020', '#FFFFFF', '#A78BFA', '#7FD8F5'];
    [0, 350, 700, 1000].forEach((t, k) => setTimeout(() => { const x = W * (0.2 + Math.random() * 0.6), y = H * (0.2 + Math.random() * 0.3), col = cols[k % cols.length]; for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2, v = 3 + Math.random() * 4; P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: col }); } }, t));
    const t0 = performance.now();
    const loop = (t) => { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      P.forEach((p) => { p.vy += 0.06; p.x += p.vx; p.y += p.vy; p.l -= 0.012; if (p.l > 0) { ctx.globalAlpha = p.l; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill(); } });
      ctx.globalAlpha = 1; if (t - t0 < 2800) requestAnimationFrame(loop); else c.remove(); };
    requestAnimationFrame(loop);
  },
  confetti() {
    const c = document.createElement('canvas'); c.className = 'confetti';
    document.body.appendChild(c);
    const ctx = c.getContext('2d'), W = (c.width = innerWidth), H = (c.height = innerHeight);
    const colors = ['#1F6BFF', '#FFFFFF', '#6AA5FF', '#BCD4FF'];
    const P = Array.from({ length: 120 }, () => ({ x: W / 2, y: H / 2.5, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -16 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0] }));
    const t0 = performance.now();
    const loop = (t) => {
      ctx.clearRect(0, 0, W, H);
      P.forEach((p) => { p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(loop); else c.remove();
    };
    requestAnimationFrame(loop);
  },

  /* ---------- sequência de comemoração após o treino ---------- */
  async celebrate(res) {
    if (!res) return;
    if (res.missions.length || res.medals.length || res.records.some((r) => r.broken)) { this.beep([659, 784, 988]); this.vibrate(); }
    for (const u of res.unlocks) await this.unlockModal(u);
    if (res.levelUp) {
      this.finish(); this.beep([523, 659, 784, 1046, 1318]);
      await this.modal(`<div class="unlock"><span class="eyebrow">Novo nível</span><div class="lvl-big num">${res.levelUp}</div><h3>${Game.title(res.levelUp)}</h3><p class="muted">Continue treinando para liberar mais funções.</p><button class="btn primary" data-m="ok">Continuar</button></div>`);
    }
  },
  unlockModal(u) {
    setTimeout(() => {
      const el = $('#lockAnim');
      if (el) { el.innerHTML = I('unlock'); el.classList.add('open'); }
      const box = $('.unlock .reveal'); if (box) box.classList.add('show');
      this.finish(); this.beep(); this.vibrate([80, 50, 120]);
    }, 900);
    return this.modal(`<div class="unlock">
      <div class="lock-anim" id="lockAnim">${I('lock')}</div>
      <span class="eyebrow">Função desbloqueada</span>
      <div class="reveal"><div class="u-icon">${I(u.icon)}</div><h3>${esc(u.name)}</h3><p class="muted">${esc(u.desc)}</p>
      <div class="reward"><span>+${u.reward.xp} XP</span><span>+${u.reward.coins} moedas</span></div>
      ${!u.ready ? `<p class="soon">Esta função chega numa próxima versão do app e já fica liberada para você.</p>` : ''}</div>
      <button class="btn primary" data-m="ok">Continuar</button></div>`);
  },

  /* ---------- download de arquivo ---------- */
  download(name, content, type) {
    if (Native.on) { const blob = content instanceof Blob ? content : new Blob([content], { type }); Native.shareBlob(name, blob, type); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },

  /* ---------- gráfico de linha simples em canvas ---------- */
  chart(canvas, xs, ys, { color = '#4D8DFF', fmtY = (v) => v.toFixed(0), invert = false, label = '', xEnd = '', minRange = 0 } = {}) {
    if (!canvas || xs.length < 2) return;
    const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const pad = { l: 48, r: 10, t: 18, b: 22 };
    const vals = ys.filter(isFinite); if (!vals.length) return;
    let min = Math.min(...vals), max = Math.max(...vals);
    if (minRange && max - min < minRange) { const c = (max + min) / 2; min = c - minRange / 2; max = c + minRange / 2; }
    if (max - min < 1e-6) { max += 1; min -= 1; }
    const x0 = xs[0] || 0, xMax = xs[xs.length - 1] || 1;
    const X = (x) => pad.l + ((x - x0) / (xMax - x0 || 1)) * (W - pad.l - pad.r);
    const Y = (y) => { let f = (y - min) / (max - min); if (invert) f = 1 - f; return H - pad.b - f * (H - pad.t - pad.b); };
    const css = getComputedStyle(document.documentElement);
    ctx.font = '500 11px Inter, system-ui'; ctx.fillStyle = css.getPropertyValue('--text-3'); ctx.strokeStyle = css.getPropertyValue('--line');
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(fmtY(v), 4, y + 4);
    }
    ctx.fillText(xEnd ? '' : '0', pad.l, H - 6); ctx.textAlign = 'right'; ctx.fillText(xEnd || Fmt.num(xMax) + ' km', W - pad.r, H - 6); ctx.textAlign = 'left';
    if (label) ctx.fillText(label, pad.l, 12);
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, color + '66'); grad.addColorStop(1, color + '00');
    ctx.beginPath();
    xs.forEach((x, i) => { if (!isFinite(ys[i])) return; i ? ctx.lineTo(X(x), Y(ys[i])) : ctx.moveTo(X(x), Y(ys[i])); });
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.lineTo(X(xs[xs.length - 1]), H - pad.b); ctx.lineTo(X(xs[0]), H - pad.b); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
  },

  // séries de velocidade (janela de 30 s) e altitude por km percorrido
  series(points) {
    const out = { x: [], v: [], alt: [] };
    if (!points || points.length < 3) return out;
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + (points[i][4] ? 0 : Geo.dist(points[i - 1], points[i]));
    let j = 0; const step = Math.max(1, Math.floor(points.length / 300));
    for (let i = 1; i < points.length; i++) {
      while (j < i && points[i][2] - points[j][2] > 30000) j++;
      if (i % step) continue;
      const dt = (points[i][2] - points[Math.min(j, i - 1)][2]) / 1000;
      const dd = cum[i] - cum[Math.min(j, i - 1)];
      out.x.push(cum[i] / 1000);
      out.v.push(dt >= 3 && dd / dt < 45 ? dd / dt : NaN);
      out.alt.push(points[i][3] != null ? points[i][3] : NaN);
    }
    // média móvel para tirar o serrilhado do GPS
    const sm = (arr, w = 4) => arr.map((_, i) => { let s = 0, n = 0; for (let k = Math.max(0, i - w); k <= Math.min(arr.length - 1, i + w); k++) if (isFinite(arr[k])) { s += arr[k]; n++; } return n ? s / n : NaN; });
    out.v = sm(out.v); out.alt = sm(out.alt, 2);
    return out;
  },
};

/* =========================================================
   GPX — exportar e importar
   ========================================================= */
const GPX = {
  types: { run: 'running', ride: 'cycling', swim: 'swimming' },

  export(act) {
    if (!act.points || act.points.length < 2) return FX.toast('Este treino não tem trajeto de GPS.');
    const sp = CONFIG.sports[act.sport];
    let x = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="JustGo" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${sp.name} JustGo</name><time>${new Date(act.start).toISOString()}</time></metadata>\n<trk><name>${sp.name} JustGo</name><type>${this.types[act.sport]}</type>\n<trkseg>\n`;
    act.points.forEach((p, i) => {
      if (p[4] && i > 0) x += '</trkseg>\n<trkseg>\n';
      x += `<trkpt lat="${p[0]}" lon="${p[1]}">${p[3] != null ? `<ele>${p[3]}</ele>` : ''}<time>${new Date(p[2]).toISOString()}</time></trkpt>\n`;
    });
    x += '</trkseg>\n</trk>\n</gpx>\n';
    const d = new Date(act.start);
    FX.download(`justgo-${act.sport}-${d.toISOString().slice(0, 10)}.gpx`, x, 'application/gpx+xml');
  },

  async importFile(file) {
    try {
      const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
      const segs = [...doc.getElementsByTagName('trkseg')];
      const groups = segs.length ? segs.map((s) => [...s.getElementsByTagName('trkpt')]) : [[...doc.getElementsByTagName('rtept')]];
      const points = [];
      groups.forEach((g, gi) => g.forEach((n, i) => {
        const t = n.getElementsByTagName('time')[0], e = n.getElementsByTagName('ele')[0];
        const p = [+(+n.getAttribute('lat')).toFixed(6), +(+n.getAttribute('lon')).toFixed(6), t ? Date.parse(t.textContent) : NaN, e ? +e.textContent : null];
        if (gi > 0 && i === 0) p[4] = 1;
        points.push(p);
      }));
      if (points.length < 2) return FX.toast('GPX sem pontos de trajeto.');
      if (points.some((p) => !isFinite(p[2]))) return FX.toast('GPX sem horários nos pontos: não dá para calcular o tempo.');

      const typeTag = (doc.getElementsByTagName('type')[0] || {}).textContent || '';
      let sport = /cycl|bik|ride/i.test(typeTag) ? 'ride' : /swim/i.test(typeTag) ? 'swim' : /run/i.test(typeTag) ? 'run' : null;
      if (!sport) {
        sport = await FX.modal(`<h3>Qual foi o esporte?</h3><div class="col">${Object.entries(CONFIG.sports).map(([k, s]) => `<button class="btn ghost" data-m="${k}">${I(s.icon)} ${s.name}</button>`).join('')}</div>`);
      }

      // recalcula distância, tempo em movimento e parciais
      let dist = 0, moving = 0, lastSplit = 0; const splits = [];
      for (let i = 1; i < points.length; i++) {
        if (points[i][4]) continue;
        const d = Geo.dist(points[i - 1], points[i]), dt = (points[i][2] - points[i - 1][2]) / 1000;
        if (dt <= 0) continue;
        if (dt < 60 && d / dt > 0.3) moving += dt; // ignora paradas
        dist += d;
        while (dist >= (splits.length + 1) * 1000) { splits.push(Math.round(moving - lastSplit)); lastSplit = moving; }
      }
      const act = { id: uid(), sport, start: points[0][2], duration: Math.round(moving), elapsed: Math.round((points[points.length - 1][2] - points[0][2]) / 1000), distance: Math.round(dist), points, splits, mode: 'gpx' };
      App.finalizeActivity(act);
    } catch (e) {
      console.error(e); FX.toast('Não consegui ler esse arquivo GPX.');
    }
  },
};
