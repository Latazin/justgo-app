/* =========================================================
   JustGo — NUVEM E SOCIAL (Supabase)
   Só liga quando CONFIG.supabase tem URL e chave.
   Tabelas e regras de segurança: supabase/schema.sql
   ========================================================= */
const Cloud = {
  sb: null, user: null, me: null, ready: false,

  configured() { return !!(CONFIG.supabase.url && CONFIG.supabase.anonKey); },
  loggedIn() { return !!(this.sb && this.user); },

  loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); },

  async init() {
    if (!this.configured()) return;
    try {
      if (!window.supabase) await this.loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      this.sb = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
      const { data } = await this.sb.auth.getSession();
      this.user = data.session ? data.session.user : null;
      this.sb.auth.onAuthStateChange((ev, s) => {
        const was = !!this.user; this.user = s ? s.user : null;
        if (ev === 'PASSWORD_RECOVERY') setTimeout(() => App.askNewPassword(), 300);
        if (ev === 'SIGNED_IN' && !was) this.afterLogin();
        if (ev === 'SIGNED_OUT' && window.App) App.onCloudReady();
      });
      await this.loadSettings();
      if (this._pendingAuth) { const u = this._pendingAuth; this._pendingAuth = null; setTimeout(() => this.handleAuthCallback(u), 200); }
      this.ready = true;
      if (this.user) await this.afterLogin();
    } catch (e) { console.error('Supabase', e); }
  },

  /* ---------- conta ---------- */
  // quais logins estão ligados no Supabase (Google só aparece se estiver ativado)
  async loadSettings(fresh = false) {
    if (this.settings && this.settings.loaded && !fresh) return this.settings;
    try {
      const r = await fetch(`${CONFIG.supabase.url}/auth/v1/settings?t=${Date.now()}`, { headers: { apikey: CONFIG.supabase.anonKey }, cache: 'no-store' });
      if (r.ok) { const j = await r.json(); this.settings = { loaded: true, google: !!(j.external && j.external.google), autoconfirm: !!j.mailer_autoconfirm, signup: !j.disable_signup }; }
    } catch (e) {}
    // se não deu para conferir, não bloqueia nada
    if (!this.settings) this.settings = { loaded: false, google: true, autoconfirm: false, signup: true };
    return this.settings;
  },
  // no app Android o retorno do login vem por link direto (justgo://login-callback)
  redirect() { return Native.on ? 'justgo://login-callback' : location.origin + location.pathname; },
  // recebe o link de volta do login (Google, confirmação de e-mail, recuperar senha)
  async handleAuthCallback(url) {
    if (!this.sb) { this._pendingAuth = url; return; }
    try {
      const u = new URL(url), q = new URLSearchParams((u.hash || '').replace(/^#/, '')), s = u.searchParams;
      const err = q.get('error_description') || s.get('error_description');
      if (err) return FX.toast(decodeURIComponent(err.replace(/\+/g, ' ')));
      if (q.get('access_token')) await this.sb.auth.setSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token') });
      else if (s.get('code')) await this.sb.auth.exchangeCodeForSession(s.get('code'));
      if ((q.get('type') || s.get('type')) === 'recovery') setTimeout(() => App.askNewPassword(), 400);
      else FX.toast('Login feito!');
    } catch (e) { FX.toast(this.msg(e)); }
  },
  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: this.redirect() } });
    if (error) throw error;
    // com "Confirm email" desligado já volta logado; senão, precisa confirmar
    if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error('User already registered');
    return { session: !!(data && data.session) };
  },
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: this.redirect() });
    if (error) throw error;
  },
  async newPassword(password) { const { error } = await this.sb.auth.updateUser({ password }); if (error) throw error; },
  async loginGoogle() {
    const { error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.redirect() } });
    if (error) throw error;
  },
  // mensagens de erro do Supabase em português
  msg(e) {
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/rate limit|too many|429|over_email_send/i.test(m) || (e && e.status === 429)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/already registered|already exists/i.test(m)) return 'Esse e-mail já tem conta. Use "Entrar" com a sua senha.';
    if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/password.*(at least|characters|short)|weak/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/invalid.*email|unable to validate email/i.test(m)) return 'Digite um e-mail válido.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'O login com Google ainda não foi ativado no Supabase.';
    if (/signups not allowed/i.test(m)) return 'Novos cadastros estão desativados no momento.';
    if (/failed to fetch|network/i.test(m)) return 'Sem conexão. Verifique a internet.';
    return m || 'Algo deu errado. Tente de novo.';
  },
  async logout() { await this.sb.auth.signOut(); this.user = null; this.me = null; },

  async afterLogin() {
    const { data } = await this.sb.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
    this.me = data;
    await this.pull();
    if (this.me) this.pushProfile();
    if (['social', 'profile', 'account', 'home'].includes(App.tab)) App.go(App.tab);
  },
  async saveProfile(username, name, city) {
    const row = { id: this.user.id, username: username.toLowerCase().replace(/[^a-z0-9_.]/g, ''), name, city };
    const { data, error } = await this.sb.from('profiles').upsert(row).select().single();
    if (error) throw error;
    this.me = data; Store.data.profile.name = name; Store.save(); this.pushProfile();
  },
  async pushProfile() {
    if (!this.me) return;
    const D = Store.data, acts = Game.acts().filter((a) => a.mode !== 'sim');
    await this.sb.from('profiles').update({
      level: Game.level(D.xp), xp: D.xp, total_km: Math.round(Game.km(acts) * 10) / 10, medals: Object.keys(D.medals).length,
      league: Game.league(Game.monthXp()).id, frame: Shop.val('frame'), avatar: Shop.val('avatar'), updated_at: new Date().toISOString(),
    }).eq('id', this.user.id);
  },

  /* ---------- sincronização do estado completo (backup na nuvem) ---------- */
  queuePush() { if (!this.loggedIn() || this._pulling) return; clearTimeout(this._pt); this._pt = setTimeout(() => this.push(), 4000); },
  async push() {
    if (!this.loggedIn()) return;
    const { error } = await this.sb.from('user_state').upsert({ user_id: this.user.id, data: Store.data, updated_at: new Date().toISOString() });
    if (!error) this.lastSync = Date.now();
  },
  // junta o que está na nuvem com o que está no aparelho (nada é perdido)
  async pull() {
    this._pulling = true;
    try {
      const { data } = await this.sb.from('user_state').select('data').eq('user_id', this.user.id).maybeSingle();
      if (!data || !data.data) { this._pulling = false; return this.push(); }
      const C = data.data, L = Store.data;
      const ids = new Set(L.activities.map((a) => a.id));
      (C.activities || []).forEach((a) => { if (!ids.has(a.id)) L.activities.push(a); });
      ['unlocked', 'medals', 'missionsDone', 'owned', 'seasons', 'territory'].forEach((k) => { L[k] = { ...(C[k] || {}), ...(L[k] || {}) }; });
      const gids = new Set(L.gear.map((g) => g.id)); (C.gear || []).forEach((g) => { if (!gids.has(g.id)) L.gear.push(g); });
      const zids = new Set((L.zones || (L.zones = [])).map((z) => z.id)); (C.zones || []).forEach((z) => { if (!zids.has(z.id)) L.zones.push(z); });
      const rids = new Set(L.routes.map((g) => g.id)); (C.routes || []).forEach((g) => { if (!rids.has(g.id)) L.routes.push(g); });
      if ((C.xp || 0) > L.xp) { L.xp = C.xp; L.coins = C.coins; L.xpLog = C.xpLog || L.xpLog; L.records = { ...L.records, ...(C.records || {}) }; }
      if (!L.plan && C.plan) L.plan = C.plan;
      L.dailyDoneCount = Math.max(L.dailyDoneCount || 0, C.dailyDoneCount || 0);
      L.profile.onboarded = true;
      this._pulling = false; Store.save(); this.push();
    } catch (e) { this._pulling = false; console.error(e); }
  },

  /* ---------- atividades públicas ---------- */
  async publish(act) {
    if (!this.loggedIn() || !this.me || act.mode === 'sim' || act.private) return;
    const pts = Privacy.trim(act.points || []), step = Math.max(1, Math.floor(pts.length / 300));
    // mantém as quebras de trecho (pausas) marcadas com 1 na 5ª posição
    const route = pts.filter((p, i) => i % step === 0 || i === pts.length - 1 || p[4] || (pts[i + 1] && pts[i + 1][4])).map((p) => (p[4] ? [p[0], p[1], null, null, 1] : [p[0], p[1]]));
    const { error } = await this.sb.from('activities').upsert({
      id: act.id, user_id: this.user.id, sport: act.sport, start: new Date(act.start).toISOString(), distance: act.distance, duration: act.duration,
      elapsed: act.elapsed, title: UI.actTitle(act), route, xp: act.xp || 0, flagged: !!act.flagged,
      stats: { elev: Geo.elevationGain(act.points), pool: act.pool || null, weather: act.weather || null },
    });
    if (!error && !act.pub) { act.pub = 1; Store.save(); }
    this.pushProfile();
  },
  // treinos feitos antes de entrar na conta (ou que falharam sem internet) vão para o feed
  async backfill() {
    if (!this.loggedIn() || !this.me || this._backfilled) return; this._backfilled = true;
    const D = Store.data, all = !D.pubAllDone; // 1ª vez: publica todo o histórico
    const since = all ? 0 : Date.now() - 60 * 864e5;
    const todo = D.activities.filter((a) => !a.pub && !a.private && !a.flagged && a.mode !== 'sim' && a.start >= since);
    for (const a of all ? todo : todo.slice(-20)) { try { await this.publish(a); } catch (e) {} }
    if (all && todo.every((a) => a.pub)) { D.pubAllDone = 1; Store.save(); }
  },
  async unpublish(id) { const a = Store.data.activities.find((x) => x.id === id); if (a) delete a.pub; if (this.loggedIn()) await this.sb.from('activities').delete().eq('id', id); },
  async publishAll() {
    for (const a of Store.data.activities) await this.publish(a);
  },

  /* ---------- amigos e feed ---------- */
  async following() { const { data } = await this.sb.from('follows').select('following').eq('follower', this.user.id); return (data || []).map((x) => x.following); },
  async follow(id) { await this.sb.from('follows').insert({ follower: this.user.id, following: id }); },
  async unfollow(id) { await this.sb.from('follows').delete().eq('follower', this.user.id).eq('following', id); },
  async search(q) {
    const { data } = await this.sb.from('profiles').select('id,username,name,city,level,total_km,frame,avatar').or(`username.ilike.%${q}%,name.ilike.%${q}%`).limit(20);
    return data || [];
  },
  async profileOf(id) {
    const { data: p } = await this.sb.from('profiles').select('*').eq('id', id).single();
    const a = await this.acts(this.sb.from('activities').select('*').eq('user_id', id).order('start', { ascending: false }).limit(10));
    const { count: followers } = await this.sb.from('follows').select('*', { count: 'exact', head: true }).eq('following', id);
    return { p, acts: a || [], followers: followers || 0 };
  },
  async feed() {
    const ids = [...(await this.following()), this.user.id];
    const data = await this.acts(this.sb.from('activities').select('*').in('user_id', ids).order('start', { ascending: false }).limit(30));
    return this.withReactions(data);
  },
  // Descobrir: treinos públicos de quem você ainda não segue
  async discover() {
    const fol = await this.following(), skip = new Set([this.user.id]); this._fol = new Set(fol);
    const data = await this.acts(this.sb.from('activities').select('*').or('flagged.is.null,flagged.eq.false').order('start', { ascending: false }).limit(80));
    const mine = (this.me && this.me.city || '').toLowerCase();
    const list = (data || []).filter((a) => !skip.has(a.user_id));
    // primeiro quem é da sua cidade
    if (mine) list.sort((a, b) => ((b.profiles && (b.profiles.city || '').toLowerCase() === mine) - (a.profiles && (a.profiles.city || '').toLowerCase() === mine)) || (Date.parse(b.start) - Date.parse(a.start)));
    return this.withReactions(list.slice(0, 30));
  },
  // busca treinos e depois os perfis (sem "join": não quebra se faltar coluna ou houver relação ambígua)
  async acts(q) {
    const { data, error } = await q;
    if (error) { console.warn('JustGo atividades:', error.message); this.lastErr = error.message; } else this.lastErr = '';
    return this.attachProfiles(data || []);
  },
  async attachProfiles(list) {
    const ids = [...new Set(list.map((a) => a.user_id).filter(Boolean))];
    if (!ids.length) return list;
    const { data, error } = await this.sb.from('profiles').select('*').in('id', ids);
    if (error) console.warn('JustGo perfis:', error.message);
    const M = new Map((data || []).map((p) => [p.id, p]));
    list.forEach((a) => { a.profiles = M.get(a.user_id) || { name: 'Atleta' }; });
    return list;
  },
  async withReactions(list) {
    if (!list.length) return [];
    const aids = list.map((a) => a.id);
    const [{ data: likes }, { data: comments }] = await Promise.all([
      this.sb.from('likes').select('activity_id,user_id').in('activity_id', aids),
      this.sb.from('comments').select('activity_id').in('activity_id', aids),
    ]);
    list.forEach((a) => {
      const l = (likes || []).filter((x) => x.activity_id === a.id);
      a.likes = l.length; a.liked = l.some((x) => x.user_id === this.user.id);
      a.comments = (comments || []).filter((x) => x.activity_id === a.id).length;
    });
    return list;
  },
  async like(id, on) { if (on) await this.sb.from('likes').insert({ activity_id: id, user_id: this.user.id }); else await this.sb.from('likes').delete().eq('activity_id', id).eq('user_id', this.user.id); },
  async comments(id) { const { data } = await this.sb.from('comments').select('*, profiles(name)').eq('activity_id', id).order('created_at'); return data || []; },
  async comment(id, text) { await this.sb.from('comments').insert({ activity_id: id, user_id: this.user.id, text: text.slice(0, 500) }); },

  /* ---------- rankings ---------- */
  async leaderboard({ since, sport = null, scope = 'all', metric = 'km', ids = null }) {
    let only = ids;
    if (scope === 'friends') only = [...(await this.following()), this.user.id];
    const { data, error } = await this.sb.rpc('leaderboard', {
      since: new Date(since).toISOString(), sp: sport, only_city: scope === 'city' && this.me ? this.me.city : null, only_ids: only, metric,
    });
    if (error) throw error;
    return data || [];
  },

  /* ---------- clubes ---------- */
  async myClubs() { const { data } = await this.sb.from('club_members').select('clubs(*)').eq('user_id', this.user.id); return (data || []).map((x) => x.clubs).filter(Boolean); },
  async createClub(name, goal) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await this.sb.from('clubs').insert({ name, goal_km: +goal || 500, invite_code: code, created_by: this.user.id }).select().single();
    if (error) throw error;
    await this.sb.from('club_members').insert({ club_id: data.id, user_id: this.user.id, role: 'admin' });
    return data;
  },
  async joinClub(code) {
    const { data } = await this.sb.rpc('join_club', { code: code.trim().toUpperCase() });
    if (!data) throw new Error('Código não encontrado');
    return data;
  },
  async club(id) {
    const { data: c } = await this.sb.from('clubs').select('*').eq('id', id).single();
    const { data: m } = await this.sb.from('club_members').select('user_id').eq('club_id', id);
    const ids = (m || []).map((x) => x.user_id);
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    const board = ids.length ? await this.leaderboard({ since, ids }) : [];
    return { c, members: ids.length, board, total: board.reduce((s, x) => s + Number(x.value), 0) };
  },

  /* ---------- clube: membros, atividades e administração ---------- */
  async clubFull(id) {
    const { data: c, error } = await this.sb.from('clubs').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: m } = await this.sb.from('club_members').select('user_id, role, profiles(*)').eq('club_id', id);
    const mem = m || [], ids = mem.map((x) => x.user_id);
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const week = new Date(Game.weekStart(Date.now()));
    const [board, wboard, acts] = ids.length ? await Promise.all([
      this.leaderboard({ since: month, ids }),
      this.leaderboard({ since: week, ids }),
      this.acts(this.sb.from('activities').select('*').in('user_id', ids).or('flagged.is.null,flagged.eq.false').order('start', { ascending: false }).limit(20)),
    ]) : [[], [], []];
    const km = {}; board.forEach((x) => (km[x.user_id] = Number(x.value)));
    return { c, members: mem.map((x) => ({ ...x, km: km[x.user_id] || 0 })).sort((a, b) => b.km - a.km), board, wboard, acts, total: board.reduce((s, x) => s + Number(x.value), 0), admin: c.created_by === this.user.id };
  },
  async clubUpdate(id, f) { const { error } = await this.sb.from('clubs').update(f).eq('id', id); if (error) throw error; },
  async clubLeave(id) { const { error } = await this.sb.from('club_members').delete().eq('club_id', id).eq('user_id', this.user.id); if (error) throw error; },

  /* ---------- seguidores ---------- */
  async followCounts(id) {
    const [a, b] = await Promise.all([
      this.sb.from('follows').select('*', { count: 'exact', head: true }).eq('following', id),
      this.sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower', id),
    ]);
    return { followers: a.count || 0, following: b.count || 0 };
  },
  async followList(id, which) {
    const col = which === 'followers' ? 'follower' : 'following', by = which === 'followers' ? 'following' : 'follower';
    const { data, error } = await this.sb.from('follows').select(`${col}, created_at, p:profiles!follows_${col}_fkey(id,name,username,city,frame,avatar)`).eq(by, id).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map((x) => x.p).filter(Boolean);
  },

  /* ---------- notificações (montadas a partir do que já existe no banco) ---------- */
  async notifications() {
    const me = this.user.id, out = [];
    const safe = (p) => p.then((r) => r).catch(() => ({ data: [] }));
    const { data: mine } = await this.sb.from('activities').select('id,title,sport').eq('user_id', me).order('start', { ascending: false }).limit(60);
    const ids = (mine || []).map((a) => a.id), title = {}; (mine || []).forEach((a) => (title[a.id] = a.title));
    const [fol, likes, cms, chal, zon] = await Promise.all([
      safe(this.sb.from('follows').select('follower, created_at, p:profiles!follows_follower_fkey(id,name,frame,avatar)').eq('following', me).order('created_at', { ascending: false }).limit(30)),
      ids.length ? this.sb.from('likes').select('activity_id, user_id, created_at, profiles(*)').in('activity_id', ids).neq('user_id', me).limit(60).then((r) => (r.error ? this.sb.from('likes').select('activity_id, user_id, profiles(*)').in('activity_id', ids).neq('user_id', me).limit(60) : r)).catch(() => ({ data: [] })) : { data: [] },
      ids.length ? safe(this.sb.from('comments').select('activity_id, user_id, text, created_at, profiles(*)').in('activity_id', ids).neq('user_id', me).order('created_at', { ascending: false }).limit(40)) : { data: [] },
      safe(this.sb.from('challenges').select('id, status, sport, days, created_at, starts_at, from_user, to_user, a:profiles!challenges_from_user_fkey(id,name,frame,avatar), b:profiles!challenges_to_user_fkey(id,name,frame,avatar)').or(`to_user.eq.${me},and(from_user.eq.${me},status.eq.active)`).order('created_at', { ascending: false }).limit(20)),
      safe(this.sb.from('zones').select('id, area, owner, owner_name, captured_at').eq('prev_owner', me).neq('owner', me).order('captured_at', { ascending: false }).limit(20)),
    ]);
    (fol.data || []).forEach((x) => x.p && out.push({ k: 'follow', t: Date.parse(x.created_at), u: x.p }));
    (likes.data || []).forEach((x) => x.profiles && out.push({ k: 'like', t: x.created_at ? Date.parse(x.created_at) : 0, u: x.profiles, act: x.activity_id, title: title[x.activity_id] }));
    (cms.data || []).forEach((x) => x.profiles && out.push({ k: 'comment', t: Date.parse(x.created_at), u: x.profiles, act: x.activity_id, text: x.text, title: title[x.activity_id] }));
    (chal.data || []).forEach((x) => {
      if (x.to_user === me && x.a) out.push({ k: x.status === 'pending' ? 'chal' : 'chalOn', t: Date.parse(x.status === 'pending' ? x.created_at : x.starts_at || x.created_at), u: x.a, id: x.id, status: x.status });
      else if (x.from_user === me && x.b && x.status === 'active') out.push({ k: 'chalOk', t: Date.parse(x.starts_at || x.created_at), u: x.b, id: x.id });
    });
    (zon.data || []).forEach((x) => out.push({ k: 'zone', t: Date.parse(x.captured_at), u: { id: x.owner, name: x.owner_name || 'Alguém' }, area: x.area }));
    out.sort((a, b) => b.t - a.t);
    return out.slice(0, 60);
  },
  seenKey() { return 'justgo_notif_seen_' + (this.user ? this.user.id : ''); },
  unreadOf(list) { let seen = 0; try { seen = +localStorage.getItem(this.seenKey()) || 0; } catch (e) {} return list.filter((n) => n.t > seen).length; },
  markSeen() { try { localStorage.setItem(this.seenKey(), String(Date.now())); } catch (e) {} this.unread = 0; UI.bellBadge && UI.bellBadge(); },
  async refreshNotifs(force) {
    if (!this.loggedIn() || (!force && this._nAt && Date.now() - this._nAt < 60000)) return this._notifs || [];
    this._nAt = Date.now();
    try { this._notifs = await this.notifications(); this.unread = this.unreadOf(this._notifs); UI.bellBadge && UI.bellBadge(); } catch (e) { console.error(e); }
    return this._notifs || [];
  },

  /* ---------- desafio em detalhe ---------- */
  async challengeDetail(id) {
    const { data: c, error } = await this.sb.from('challenges').select('*, a:profiles!challenges_from_user_fkey(id,name,username,frame,avatar), b:profiles!challenges_to_user_fkey(id,name,username,frame,avatar)').eq('id', id).single();
    if (error) throw error;
    let acts = [];
    if (c.status === 'active' && c.starts_at) {
      let q = this.sb.from('activities').select('id,user_id,sport,start,distance,duration,title,route,flagged').in('user_id', [c.from_user, c.to_user]).gte('start', c.starts_at).lte('start', c.ends_at).eq('flagged', false).order('start', { ascending: false });
      if (c.sport) q = q.eq('sport', c.sport);
      const r = await q; acts = r.data || [];
    }
    return { c, acts };
  },

  /* ---------- desafios entre amigos ---------- */
  async challenges() {
    const { data } = await this.sb.from('challenges').select('*, a:profiles!challenges_from_user_fkey(name), b:profiles!challenges_to_user_fkey(name)').or(`from_user.eq.${this.user.id},to_user.eq.${this.user.id}`).order('created_at', { ascending: false }).limit(20);
    const list = data || [];
    await Promise.all(list.filter((c) => c.status === 'active' && c.starts_at).map(async (c) => {
      // só conta o que foi feito dentro do período do desafio
      let q = this.sb.from('activities').select('user_id,distance').in('user_id', [c.from_user, c.to_user]).gte('start', c.starts_at).lte('start', c.ends_at).eq('flagged', false);
      if (c.sport) q = q.eq('sport', c.sport);
      const { data } = await q;
      c.scores = {}; (data || []).forEach((x) => (c.scores[x.user_id] = (c.scores[x.user_id] || 0) + x.distance / 1000));
      c.over = Date.now() > new Date(c.ends_at).getTime();
    }));
    return list;
  },
  async challenge(toId, sport, days) {
    await this.sb.from('challenges').insert({ from_user: this.user.id, to_user: toId, sport, days: +days, status: 'pending' });
  },
  async answerChallenge(id, ok) {
    const now = new Date(), end = new Date();
    const { data: c } = await this.sb.from('challenges').select('days').eq('id', id).single();
    end.setDate(end.getDate() + (c ? c.days : 7));
    await this.sb.from('challenges').update(ok ? { status: 'active', starts_at: now.toISOString(), ends_at: end.toISOString() } : { status: 'declined' }).eq('id', id);
  },

  /* ---------- território online ---------- */
  /* ---------- território por circuito ---------- */
  async zonesNear(lat, lng, km) {
    const dl = km / 110.574, dg = km / (111.32 * Math.cos((lat * Math.PI) / 180));
    const { data, error } = await this.sb.from('zones').select('id,owner,owner_name,poly,area,lat,lng,captured_at,prev_owner_name,steals')
      .gte('lat', lat - dl).lte('lat', lat + dl).gte('lng', lng - dg).lte('lng', lng + dg).order('area', { ascending: false }).limit(500);
    if (error) throw error;
    return data || [];
  },
  async addZone(z, name) {
    const { data, error } = await this.sb.from('zones').insert({ ...z, owner: this.user.id, owner_name: name }).select().single();
    if (error) { console.error(error); return null; }
    return data;
  },
  async stealZone(id, name) { const { error } = await this.sb.rpc('steal_zone', { zid: id, uname: name }); if (error) console.error(error); },
  async territoryOwners(hexes) {
    const out = {};
    for (let i = 0; i < hexes.length; i += 300) {
      const { data } = await this.sb.from('territory_owners').select('*').in('hex', hexes.slice(i, i + 300));
      (data || []).forEach((r) => (out[r.hex] = r));
    }
    return out;
  },

  /* ---------- localização ao vivo ---------- */
  async liveStart(sport) {
    const { data, error } = await this.sb.from('live_sessions').insert({ user_id: this.user.id, name: Store.data.profile.name, sport, points: [], active: true }).select('id').single();
    if (error) throw error;
    this.liveId = data.id; return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}live.html?id=${data.id}`;
  },
  async liveUpdate(tr) {
    if (!this.liveId) return;
    const pts = tr.points.filter((_, i) => i % 3 === 0).slice(-400).map((p) => [p[0], p[1]]);
    const last = tr.points[tr.points.length - 1]; if (last) pts.push([last[0], last[1]]);
    await this.sb.from('live_sessions').update({ points: pts, distance: Math.round(tr.distance), moving: Math.round(tr.moving / 1000), updated_at: new Date().toISOString() }).eq('id', this.liveId);
  },
  async liveStop() { if (!this.liveId) return; await this.sb.from('live_sessions').update({ active: false }).eq('id', this.liveId); this.liveId = null; },
};
window.Cloud = Cloud;

/* =========================================================
   Card compartilhável da atividade (imagem 1080 × 1350)
   ========================================================= */
const ShareCard = {
  async render(act) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), sp = CONFIG.sports[act.sport], color = Shop.lineColor(act.sport);
    try { await document.fonts.load('800 80px Inter'); } catch (e) {}
    const F = (w, s) => `${w} ${s}px Inter, -apple-system, Segoe UI, sans-serif`;
    // fundo
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0D0D0F'); g.addColorStop(1, '#1A1A1D'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W * 0.5, 520, 50, W * 0.5, 520, 620); glow.addColorStop(0, color + '33'); glow.addColorStop(1, '#0000'); x.fillStyle = glow; x.fillRect(0, 0, W, H);
    // marca: quadrado azul + trajeto que vira seta
    const tg = x.createLinearGradient(80, 70, 152, 142); tg.addColorStop(0, '#5B9BFF'); tg.addColorStop(.52, '#1F6BFF'); tg.addColorStop(1, '#0F47D6');
    x.fillStyle = tg; x.beginPath(); x.roundRect(80, 70, 72, 72, 17); x.fill();
    x.save(); x.translate(80, 70); x.scale(72 / 64, 72 / 64); x.translate(32, 32); x.transform(1, 0, Math.tan(-14 * Math.PI / 180), 1, 0, 0); x.translate(-30, -32); x.fillStyle = '#fff';
    x.fill(new Path2D('M29 15.5h11.5L56 32 40.5 48.5H29L44.5 32z'));
    [[11, 21.5, 15, .7], [5, 29.2, 21, 1], [13, 36.9, 13, .7]].forEach(([rx, ry, rw, o]) => { x.globalAlpha = o; x.beginPath(); x.roundRect(rx, ry, rw, 5.6, 2.8); x.fill(); });
    x.globalAlpha = 1; x.restore();
    x.font = 'italic ' + F(900, 54); x.fillStyle = '#fff'; x.fillText('Just', 172, 126); const jw = x.measureText('Just').width; x.fillStyle = '#1F6BFF'; x.fillText('Go', 172 + jw, 126);
    x.fillStyle = '#8E8E93'; x.font = F(500, 30); x.textAlign = 'right'; x.fillText(Fmt.date(act.start), W - 80, 130); x.textAlign = 'left';
    // trajeto
    const pts = Privacy.trim(act.points || []);
    if (pts.length > 1) {
      const lat0 = (pts[0][0] * Math.PI) / 180, P = pts.map((p) => [p[1] * Math.cos(lat0), -p[0]]);
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
      const bw = W - 200, bh = 640, sc = Math.min(bw / (mxx - mnx || 1e-9), bh / (mxy - mny || 1e-9));
      const ox = 100 + (bw - (mxx - mnx) * sc) / 2, oy = 210 + (bh - (mxy - mny) * sc) / 2;
      x.lineJoin = x.lineCap = 'round';
      const draw = () => { x.beginPath(); P.forEach((p, i) => { const X = ox + (p[0] - mnx) * sc, Y = oy + (p[1] - mny) * sc; i && !pts[i][4] ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); };
      x.strokeStyle = color + '40'; x.lineWidth = 34; draw();
      x.strokeStyle = color; x.lineWidth = 12; draw();
    } else {
      x.fillStyle = color; x.globalAlpha = 0.15; x.beginPath(); x.arc(W / 2, 530, 230, 0, 7); x.fill(); x.globalAlpha = 1;
      x.strokeStyle = color; x.lineWidth = 10; [0, 1, 2].forEach((k) => { x.beginPath(); for (let i = 0; i <= 40; i++) { const X = W / 2 - 150 + i * 7.5, Y = 470 + k * 60 + Math.sin(i / 3) * 14; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); });
    }
    // título e números
    x.fillStyle = '#fff'; x.font = F(700, 58); x.fillText(UI.actTitle(act), 80, 980);
    const avg = act.duration ? act.distance / act.duration : 0;
    const cols = [['Distância', Fmt.km(act.distance) + ' km'], [Fmt.isSpeed(act.sport) ? 'Vel. média' : 'Ritmo', Fmt.pace(act.sport, avg) + (act.sport === 'ride' ? ' km/h' : act.sport === 'swim' ? ' /100m' : ' /km')], ['Tempo', Fmt.time(act.duration)]];
    cols.forEach(([l, v], i) => {
      const X = 80 + i * 320;
      x.fillStyle = '#8E8E93'; x.font = F(600, 26); x.fillText(l.toUpperCase(), X, 1070);
      x.fillStyle = '#fff'; x.font = F(800, i === 0 ? 70 : 58); x.fillText(v, X, 1150);
    });
    x.fillStyle = '#2C2C2E'; x.fillRect(80, 1210, W - 160, 2);
    x.fillStyle = color; x.font = F(700, 30); x.fillText(`${sp.name.toUpperCase()}  ·  NÍVEL ${Game.level(Store.data.xp)}`, 80, 1270);
    x.fillStyle = '#6E6E73'; x.textAlign = 'right'; x.font = F(500, 28); x.fillText(Store.data.profile.name, W - 80, 1270);
    return c;
  },
  async open(act) {
    const c = await this.render(act), url = c.toDataURL('image/png');
    const v = await FX.modal(`<div class="share-prev"><img src="${url}" alt="Card da atividade"></div><div class="col"><button class="btn primary" data-m="share">${I('share')} Compartilhar</button><button class="btn ghost" data-m="save">${I('download')} Baixar imagem</button><button class="btn ghost" data-m="no">Fechar</button></div>`);
    if (v === 'no') return;
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], `justgo-${act.sport}.png`, { type: 'image/png' });
    if (v === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'JustGo', text: `${UI.actTitle(act)} · ${Fmt.km(act.distance)} km no JustGo` }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    FX.download(file.name, blob, 'image/png');
    if (v === 'share') FX.toast('Imagem salva. Agora é só postar no Instagram ou WhatsApp.');
  },
};
