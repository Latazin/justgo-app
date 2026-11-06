/* =========================================================
   JustGo — CONFIGURAÇÃO DE BALANCEAMENTO
   Edite metas, recompensas, ícones e limites aqui.
   Nada neste arquivo exige mexer no resto do código.
   ========================================================= */
const CONFIG = {
  version: '2.25.1',

  /* ---------- Esportes ----------
     xpPerKm: peso do XP por km (natação vale mais que pedal)
     maxKmh: limite antitrapaça (média acima disso = não conta)
     met: usado na estimativa de calorias
     simSpeed: velocidade (m/s) do modo teste */
  sports: {
    run:   { name: 'Corrida',    icon: 'run',      color: '#1F6BFF', xpPerKm: 10, coinsPerKm: 2,   maxKmh: 25, met: 9.8, verb: 'Corra',   simSpeed: 3.0, g: 'f', gps: true, foot: true },
    ride:  { name: 'Pedalada',   icon: 'bike',     color: '#12B886', xpPerKm: 3,  coinsPerKm: 1,   maxKmh: 75, met: 7.5, verb: 'Pedale',  simSpeed: 7.5, g: 'm', gps: true, speed: true, title: 'Pedal' },
    swim:  { name: 'Natação',    icon: 'swim',     color: '#14C2D6', xpPerKm: 40, coinsPerKm: 8,   maxKmh: 8,  met: 8.0, verb: 'Nade',    simSpeed: 0.9, g: 'f' },
    walk:  { name: 'Caminhada',  icon: 'walk',     color: '#F59E0B', xpPerKm: 6,  coinsPerKm: 1.5, maxKmh: 10, met: 3.8, verb: 'Caminhe', simSpeed: 1.4, g: 'f', gps: true, foot: true },
    hike:  { name: 'Trilha',     icon: 'mountain', color: '#65A30D', xpPerKm: 9,  coinsPerKm: 2,   maxKmh: 14, met: 6.5, verb: 'Faça trilha', simSpeed: 1.2, g: 'f', gps: true, foot: true },
    skate: { name: 'Patins',     icon: 'skate',    color: '#EC4899', xpPerKm: 4,  coinsPerKm: 1,   maxKmh: 40, met: 7.0, verb: 'Patine',  simSpeed: 4.5, g: 'm', gps: true, speed: true },
    board: { name: 'Skate',      icon: 'board',    color: '#F97316', xpPerKm: 4,  coinsPerKm: 1,   maxKmh: 40, met: 5.0, verb: 'Ande de skate', simSpeed: 4.0, g: 'm', gps: true, speed: true },
    paddle:{ name: 'Remo/Caiaque', icon: 'paddle', color: '#0EA5E9', xpPerKm: 15, coinsPerKm: 3,   maxKmh: 18, met: 5.0, verb: 'Reme',    simSpeed: 2.0, g: 'm', gps: true, speed: true, title: 'Remada', tg: 'f' },
  },


  /* ---------- GPS ---------- */
  gps: {
    maxAccuracy: 30,      // descarta pontos com precisão pior que isso (metros)
    minMoveM: 3,          // ignora micro-movimentos (ruído do GPS)
    jumpFactor: 1.6,      // ponto com velocidade > maxKmh × fator = salto impossível
    autoPauseSpeed: 0.7,  // m/s — abaixo disso conta como parado
    autoPauseSecs: 6,     // segundos parado até pausar sozinho
    simStart: [-23.5874, -46.6576], // ponto inicial do modo teste (Parque Ibirapuera)
  },

  /* ---------- XP e níveis ----------
     XP necessário para o nível N = levelBase × (N-1) × N / 2
     (nível 2 = 100, nível 3 = 300, nível 4 = 600...) */
  xp: { perMinute: 0.5, perRecord: 50, levelBase: 100 },
  levelTitles: [ [1, 'Iniciante'], [5, 'Em evolução'], [10, 'Atleta'], [20, 'Elite'] ],

  /* ---------- Árvore de desbloqueios ----------
     req.type: km | workouts | dayStreak | weekStreak | dailyDone
     req.sport: all | run | ride | swim (só para km)
     ready: true = função já funciona nesta versão
     stage: em qual etapa do desenvolvimento a função chega (se ready=false) */
  tiers: [
    { id: 1, name: 'Iniciante' },
    { id: 2, name: 'Em evolução' },
    { id: 3, name: 'Atleta' },
    { id: 4, name: 'Elite' },
    { id: 5, name: 'Lenda' },
  ],
  unlocks: [
    // Nível 1
    { id: 'autopause',  tier: 1, icon: 'pause', name: 'Pausa automática',          desc: 'O cronômetro pausa sozinho quando você para.',              req: { type: 'km', sport: 'all', value: 5 },  reward: { xp: 50,  coins: 20 },  ready: true },
    { id: 'splits',     tier: 1, icon: 'timer', name: 'Parciais por km',           desc: 'Tempo de cada quilômetro no resumo do treino.',            req: { type: 'workouts', value: 3 },          reward: { xp: 50,  coins: 20 },  ready: true },
    { id: 'paceChart',  tier: 1, icon: 'trending', name: 'Análise de ritmo',          desc: 'Gráfico de pace da sua corrida.',                          req: { type: 'km', sport: 'run', value: 10 }, reward: { xp: 80,  coins: 30 },  ready: true },
    { id: 'rideChart',  tier: 1, icon: 'mountain', name: 'Velocidade e elevação',     desc: 'Gráficos de velocidade e altimetria do pedal.',            req: { type: 'km', sport: 'ride', value: 20 },reward: { xp: 80,  coins: 30 },  ready: true },
    { id: 'swimTools',  tier: 1, icon: 'hash', name: 'Braçadas e ritmo /100 m',   desc: 'Registre braçadas por volta e veja o ritmo por 100 m.',     req: { type: 'km', sport: 'swim', value: 1 }, reward: { xp: 80,  coins: 30 },  ready: true },
    // Nível 2
    { id: 'voice',      tier: 2, icon: 'mic', name: 'Treinador por voz',          desc: 'Aviso falado a cada km com tempo e ritmo.',                req: { type: 'km', sport: 'all', value: 25 }, reward: { xp: 120, coins: 50 },  ready: true },
    { id: 'goals',      tier: 2, icon: 'target', name: 'Metas personalizadas',      desc: 'Defina metas semanais e mensais de km.',                   req: { type: 'weekStreak', value: 2 },        reward: { xp: 120, coins: 50 },  ready: true },
    { id: 'routes',     tier: 2, icon: 'route', name: 'Rotas salvas',              desc: 'Salve percursos de pedal e repita depois.',                req: { type: 'km', sport: 'ride', value: 50 },reward: { xp: 120, coins: 50 },  ready: true },
    { id: 'swimSets',   tier: 2, icon: 'repeat', name: 'Treinos de série',          desc: 'Séries como 10×100 m com descanso.',                       req: { type: 'km', sport: 'swim', value: 5 }, reward: { xp: 120, coins: 50 },  ready: true },
    // Nível 3
    { id: 'intervals',  tier: 3, icon: 'zap', name: 'Treino intervalado',         desc: 'Tiros com alertas sonoros.',                               req: { type: 'km', sport: 'run', value: 50 }, reward: { xp: 200, coins: 80 },  ready: true },
    { id: 'ghost',      tier: 3, icon: 'ghost', name: 'Corrida contra o Fantasma', desc: 'Corra contra seu melhor tempo no percurso.',               req: { type: 'km', sport: 'all', value: 100 },reward: { xp: 200, coins: 80 },  ready: true },
    { id: 'heatmap',    tier: 3, icon: 'flame', name: 'Mapa de calor',             desc: 'Todos os seus percursos sobrepostos em um mapa.',          req: { type: 'dailyDone', value: 5 },         reward: { xp: 200, coins: 80 },  ready: true },
    { id: 'segments',   tier: 3, icon: 'flag', name: 'Segmentos e recordes',      desc: 'Recordes pessoais por trecho.',                            req: { type: 'km', sport: 'ride', value: 150 },reward: { xp: 200, coins: 80 }, ready: true },
    // Nível 4
    { id: 'plans',      tier: 4, icon: 'clipboard', name: 'Planos de treino guiados',  desc: '5K, 10K, 21K, 42K, pedal de 100 km, travessia.',          req: { type: 'km', sport: 'all', value: 200 },reward: { xp: 400, coins: 150 }, ready: true },
    { id: 'racePredict',tier: 4, icon: 'gauge', name: 'Previsão de tempo de prova',desc: 'Estimativa para 5K, 10K, 21K e 42K.',                      req: { type: 'dayStreak', value: 30 },        reward: { xp: 400, coins: 150 }, ready: true },
    { id: 'swolf',      tier: 4, icon: 'activity', name: 'Eficiência (SWOLF)',        desc: 'Tempo + braçadas por volta: quanto menor, melhor.',        req: { type: 'km', sport: 'swim', value: 25 },reward: { xp: 400, coins: 150 }, ready: true },
    // Análises (2.24)
    { id: 'weekCompare',tier: 1, icon: 'trending', name: 'Comparativo semanal',     desc: 'Esta semana contra a passada, na mesma altura da semana.',  req: { type: 'workouts', value: 2 },          reward: { xp: 40,  coins: 15 },  ready: true },
    { id: 'sportMix',   tier: 1, icon: 'activity', name: 'Mix de esportes',          desc: 'Quanto cada esporte pesou nos seus últimos 30 dias.',       req: { type: 'km', sport: 'all', value: 15 }, reward: { xp: 60,  coins: 20 },  ready: true },
    { id: 'calendar',   tier: 2, icon: 'calendar', name: 'Calendário de treinos',    desc: 'Seis meses de treinos num quadro, dia a dia.',             req: { type: 'workouts', value: 10 },         reward: { xp: 120, coins: 50 },  ready: true },
    { id: 'bestHours',  tier: 2, icon: 'clock', name: 'Seu melhor horário',          desc: 'Em que período do dia você mais treina.',                  req: { type: 'workouts', value: 15 },         reward: { xp: 120, coins: 50 },  ready: true },
    { id: 'trainLoad',  tier: 3, icon: 'gauge', name: 'Carga de treino',             desc: 'Compara a última semana com a sua média para evitar lesão.',req: { type: 'weekStreak', value: 3 },       reward: { xp: 200, coins: 80 },  ready: true },
    { id: 'paceTrend',  tier: 5, icon: 'trending', name: 'Evolução do ritmo',        desc: 'Seu ritmo médio de corrida mês a mês.',                    req: { type: 'km', sport: 'run', value: 150 },reward: { xp: 600, coins: 250 }, ready: true },
    { id: 'yearGoal',   tier: 5, icon: 'target', name: 'Projeção do ano',            desc: 'Quantos km você fecha o ano mantendo o ritmo atual.',      req: { type: 'km', sport: 'all', value: 400 },reward: { xp: 600, coins: 250 }, ready: true },
  ],

  /* ---------- Missões diárias (3 sorteadas por dia) ----------
     type: km | minutes | workouts | before (treino antes da hora X) | sports */
  daily: [
    { id: 'run2',    text: 'Corra 2 km',                       type: 'km',       sport: 'run',  value: 2,   xp: 40, coins: 10 },
    { id: 'run4',    text: 'Corra 4 km',                       type: 'km',       sport: 'run',  value: 4,   xp: 60, coins: 15 },
    { id: 'run20m',  text: 'Corra 20 minutos',                 type: 'minutes',  sport: 'run',  value: 20,  xp: 40, coins: 10 },
    { id: 'ride10',  text: 'Pedale 10 km',                     type: 'km',       sport: 'ride', value: 10,  xp: 40, coins: 10 },
    { id: 'ride20m', text: 'Pedale 20 minutos',                type: 'minutes',  sport: 'ride', value: 20,  xp: 35, coins: 10 },
    { id: 'swim500', text: 'Nade 500 m',                       type: 'km',       sport: 'swim', value: 0.5, xp: 50, coins: 15 },
    { id: 'walk3',   text: 'Caminhe 3 km',                     type: 'km',       sport: 'walk', value: 3,   xp: 30, coins: 8 },
    { id: 'walk40m', text: 'Caminhe 40 minutos',               type: 'minutes',  sport: 'walk', value: 40,  xp: 35, coins: 10 },
    { id: 'hike5',   text: 'Faça 5 km de trilha',              type: 'km',       sport: 'hike', value: 5,   xp: 50, coins: 15 },
    { id: 'hike60m', text: 'Fique 1 hora na trilha',           type: 'minutes',  sport: 'hike', value: 60,  xp: 50, coins: 15 },
    { id: 'skate8',  text: 'Patine 8 km',                      type: 'km',       sport: 'skate', value: 8,  xp: 40, coins: 10 },
    { id: 'skate30m',text: 'Patine 30 minutos',                type: 'minutes',  sport: 'skate', value: 30, xp: 35, coins: 10 },
    { id: 'board5',  text: 'Ande 5 km de skate',               type: 'km',       sport: 'board', value: 5,  xp: 35, coins: 10 },
    { id: 'board30m',text: 'Ande de skate por 30 minutos',     type: 'minutes',  sport: 'board', value: 30, xp: 35, coins: 10 },
    { id: 'paddle3', text: 'Reme 3 km',                        type: 'km',       sport: 'paddle', value: 3, xp: 45, coins: 12 },
    { id: 'paddle30m',text: 'Reme 30 minutos',                 type: 'minutes',  sport: 'paddle', value: 30, xp: 40, coins: 12 },
    { id: 'swim30m', text: 'Nade 30 minutos',                  type: 'minutes',  sport: 'swim', value: 30,  xp: 45, coins: 12 },
    { id: 'run5',    text: 'Corra 5 km',                       type: 'km',       sport: 'run',  value: 5,   xp: 70, coins: 18 },
    { id: 'ride20',  text: 'Pedale 20 km',                     type: 'km',       sport: 'ride', value: 20,  xp: 60, coins: 15 },
    { id: 'early',   text: 'Faça um treino antes das 8h',      type: 'before',   hour: 8,       value: 1,   xp: 40, coins: 15 },
    { id: 'any3',    text: 'Some 3 km em qualquer esporte',    type: 'km',       sport: 'all',  value: 3,   xp: 30, coins: 8  },
    { id: 'move30',  text: 'Treine 30 minutos (qualquer esporte)', type: 'minutes', sport: 'all', value: 30, xp: 35, coins: 10 },
    { id: 'any1',    text: 'Conclua 1 treino',                 type: 'workouts', value: 1,      xp: 25, coins: 5 },
  ],

  /* ---------- Missões semanais (renovam na segunda) ---------- */
  weekly: [
    { id: 'w15',      text: 'Some 15 km na semana',          type: 'km',       sport: 'all', value: 15, xp: 150, coins: 50 },
    { id: 'w3sports', text: 'Treine 3 esportes diferentes',  type: 'sports',   value: 3,     xp: 200, coins: 80 },
    { id: 'w4work',   text: 'Faça 4 treinos na semana',      type: 'workouts', value: 4,     xp: 120, coins: 40 },
    { id: 'wrun20',   text: 'Corra 20 km na semana',         type: 'km', sport: 'run',    value: 20, xp: 180, coins: 60 },
    { id: 'wride80',  text: 'Pedale 80 km na semana',        type: 'km', sport: 'ride',   value: 80, xp: 180, coins: 60 },
    { id: 'wswim3',   text: 'Nade 3 km na semana',           type: 'km', sport: 'swim',   value: 3,  xp: 180, coins: 60 },
    { id: 'wwalk20',  text: 'Caminhe 20 km na semana',       type: 'km', sport: 'walk',   value: 20, xp: 150, coins: 50 },
    { id: 'whike15',  text: 'Faça 15 km de trilha na semana',type: 'km', sport: 'hike',   value: 15, xp: 180, coins: 60 },
    { id: 'wskate30', text: 'Patine 30 km na semana',        type: 'km', sport: 'skate',  value: 30, xp: 160, coins: 55 },
    { id: 'wboard20', text: 'Ande 20 km de skate na semana', type: 'km', sport: 'board',  value: 20, xp: 160, coins: 55 },
    { id: 'wpaddle10',text: 'Reme 10 km na semana',          type: 'km', sport: 'paddle', value: 10, xp: 180, coins: 60 },
  ],

  /* ---------- Missões especiais do mês (chave = número do mês) ---------- */
  seasonal: {
    1:  { id: 'verao',   icon: 'sunrise', text: 'Verão em movimento: 40 km no mês',  type: 'km', sport: 'all', value: 40, xp: 300, coins: 150 },
    10: { id: 'rosa',    icon: 'heart', text: 'Outubro Rosa: 31 km no mês',        type: 'km', sport: 'all', value: 31, xp: 300, coins: 150 },
    11: { id: 'azul',    icon: 'heart', text: 'Novembro Azul: 30 km no mês',       type: 'km', sport: 'all', value: 30, xp: 300, coins: 150 },
    12: { id: 'natal',   icon: 'sparkles', text: 'Fecha o ano: 50 km em dezembro',    type: 'km', sport: 'all', value: 50, xp: 400, coins: 200 },
  },
  dailyBonus: { xp: 60, coins: 25 }, // completar as 3 diárias
  seasonalDefault: { id: 'mes', icon: 'calendar', text: 'Desafio do mês: 40 km', type: 'km', sport: 'all', value: 40, xp: 300, coins: 150 },

  /* ---------- Medalhas ----------
     type: single (num treino) | before | after | monthKm | record | weekSports | dayStreak */
  medals: [
    { id: 'first5k',  icon: 'medal', name: 'Primeiro 5K',        desc: 'Correr 5 km em um treino',          type: 'single', sport: 'run',  value: 5 },
    { id: 'first10k', icon: 'medal', name: 'Primeiro 10K',       desc: 'Correr 10 km em um treino',         type: 'single', sport: 'run',  value: 10 },
    { id: 'half',     icon: 'trophy', name: 'Meia maratona',      desc: 'Correr 21,1 km em um treino',       type: 'single', sport: 'run',  value: 21.1 },
    { id: 'ride50',   icon: 'bike', name: 'Pedal de 50 km',     desc: 'Pedalar 50 km em um treino',        type: 'single', sport: 'ride', value: 50 },
    { id: 'century',  icon: 'trophy', name: 'Pedal de 100 km',    desc: 'Pedalar 100 km em um treino',       type: 'single', sport: 'ride', value: 100 },
    { id: 'swim1k',   icon: 'swim', name: 'Nadou 1 km',         desc: 'Nadar 1 km em um treino',           type: 'single', sport: 'swim', value: 1 },
    { id: 'early',    icon: 'sunrise', name: 'Madrugador',         desc: 'Treinar antes das 6h',              type: 'before', hour: 6 },
    { id: 'night',    icon: 'moon', name: 'Coruja',             desc: 'Treinar depois das 21h',            type: 'after',  hour: 21 },
    { id: 'month100', icon: 'calendar', name: '100 km no mês',      desc: 'Somar 100 km em um mês',            type: 'monthKm', value: 100 },
    { id: 'record',   icon: 'zap', name: 'Recorde quebrado',   desc: 'Bater um recorde pessoal',          type: 'record' },
    { id: 'tri',      icon: 'layers', name: 'Triatleta',          desc: 'Os 3 esportes na mesma semana',     type: 'weekSports', value: 3 },
    { id: 'streak7',  icon: 'flame', name: 'Ofensiva de 7 dias', desc: 'Treinar 7 dias seguidos',           type: 'dayStreak', value: 7 },
    { id: 'rain',     icon: 'cloudRain', name: 'Treino na chuva', desc: 'Treinar enquanto chove (clima automático)', type: 'rain' },
    { id: 'plan',     icon: 'clipboard', name: 'Plano concluído', desc: 'Terminar um plano de treino guiado',  type: 'plan' },
    { id: 'conquer',  icon: 'flag',    name: 'Conquistador',      desc: 'Dominar 5 áreas fechando circuitos',  type: 'territory', value: 5 },
  ],
  medalReward: { xp: 30, coins: 10 },

  /* ---------- Equipamentos ----------
     aviso: quilometragem em que o app sugere trocar */
  gear: { shoe: { warn: 600, max: 800 }, bike: { warn: 8000, max: 20000 } },

  /* ---------- Treino intervalado (modelos prontos) ----------
     tempos em segundos, distâncias em metros */
  intervals: [
    { id: 'i400',  name: '8 × 400 m',          warm: 600, reps: 8,  work: { dist: 400 },  rest: 90,  cool: 300 },
    { id: 'i1k',   name: '5 × 1 km',           warm: 600, reps: 5,  work: { dist: 1000 }, rest: 120, cool: 300 },
    { id: 'i200',  name: '10 × 200 m',         warm: 480, reps: 10, work: { dist: 200 },  rest: 60,  cool: 300 },
    { id: 'i3030', name: '10 × 30 s / 30 s',   warm: 300, reps: 10, work: { dur: 30 },    rest: 30,  cool: 300 },
    { id: 'i3m',   name: '6 × 3 min',          warm: 600, reps: 6,  work: { dur: 180 },   rest: 90,  cool: 300 },
  ],

  /* ---------- Séries de natação ---------- */
  swimSets: [
    { id: 's10x100', name: '10 × 100 m', reps: 10, dist: 100, rest: 20 },
    { id: 's8x50',   name: '8 × 50 m',   reps: 8,  dist: 50,  rest: 15 },
    { id: 's5x200',  name: '5 × 200 m',  reps: 5,  dist: 200, rest: 30 },
    { id: 's20x25',  name: '20 × 25 m',  reps: 20, dist: 25,  rest: 10 },
  ],

  /* ---------- Planos de treino guiados ----------
     base: distância do treino longo na semana 1 · goal: distância da prova */
  plans: [
    { id: 'p5k',     sport: 'run',  name: 'Primeiros 5K',        weeks: 6,  perWeek: 3, base: 2,   goal: 5,    desc: 'Do zero aos 5 km em 6 semanas.' },
    { id: 'p10k',    sport: 'run',  name: 'Rumo aos 10K',        weeks: 8,  perWeek: 3, base: 4,   goal: 10,   desc: 'Para quem já corre 5 km.' },
    { id: 'p21k',    sport: 'run',  name: 'Meia maratona',       weeks: 12, perWeek: 4, base: 8,   goal: 21.1, desc: 'Para quem já corre 10 km.' },
    { id: 'p42k',    sport: 'run',  name: 'Maratona',            weeks: 16, perWeek: 4, base: 14,  goal: 42.2, desc: 'Para quem já completou uma meia.' },
    { id: 'pride',   sport: 'ride', name: 'Pedal de 100 km',     weeks: 8,  perWeek: 3, base: 30,  goal: 100,  desc: 'Seu primeiro centenário de bike.' },
    { id: 'pswim',   sport: 'swim', name: 'Travessia de 2 km',   weeks: 8,  perWeek: 3, base: 0.8, goal: 2,    desc: 'Preparação para águas abertas.' },
  ],
  planReward: { session: 40, finish: 500 },

  /* ---------- Mapas (OpenFreeMap: grátis, sem chave e sem limite) ---------- */
  maps: {
    color: 'https://tiles.openfreemap.org/styles/liberty',   // colorido: parques, água, ruas (padrão dos percursos)
    dark: 'https://tiles.openfreemap.org/styles/dark',       // escuro: usado no mapa de calor
    fallback: 'https://tiles.openfreemap.org/styles/bright', // reserva se algum estilo falhar
    attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  },

  /* ---------- Território ---------- */
  territory: { hexSize: 120 }, // raio do hexágono em metros

  /* ---------- Temporadas (XP do mês) ---------- */
  leagues: [
    { id: 'bronze',   name: 'Bronze',   min: 0,    reward: 50,  color: '#C9824F' },
    { id: 'prata',    name: 'Prata',    min: 400,  reward: 150, color: '#B8C0CC' },
    { id: 'ouro',     name: 'Ouro',     min: 1200, reward: 300, color: '#F5B841' },
    { id: 'diamante', name: 'Diamante', min: 2500, reward: 600, color: '#7FD8F5' },
  ],

  /* ---------- Loja (só cosméticos, nada dá vantagem) ----------
     cat: line (cor do traçado) | frame (moldura) | avatar | theme | finish (efeito de chegada) */
  shop: [
    { id: 'line-ice',    cat: 'line',   name: 'Traçado Gelo',      price: 150, value: '#7FD8F5' },
    { id: 'line-lime',   cat: 'line',   name: 'Traçado Lima',      price: 150, value: '#B5F23D' },
    { id: 'line-violet', cat: 'line',   name: 'Traçado Violeta',   price: 200, value: '#A78BFA' },
    { id: 'line-gold',   cat: 'line',   name: 'Traçado Ouro',      price: 400, value: '#F5B841' },
    { id: 'frame-silver',cat: 'frame',  name: 'Moldura Prata',     price: 200, value: 'linear-gradient(135deg,#F1F3F6,#8B95A5)' },
    { id: 'frame-gold',  cat: 'frame',  name: 'Moldura Ouro',      price: 450, value: 'linear-gradient(135deg,#FDE68A,#D99A1E)' },
    { id: 'frame-fire',  cat: 'frame',  name: 'Moldura Fogo',      price: 600, value: 'conic-gradient(#FFB020,#FC5200,#B91C1C,#FFB020)' },
    { id: 'av-ocean',    cat: 'avatar', name: 'Avatar Oceano',     price: 120, value: 'linear-gradient(145deg,#1C9BEF,#0A3D6B)' },
    { id: 'av-forest',   cat: 'avatar', name: 'Avatar Floresta',   price: 120, value: 'linear-gradient(145deg,#12B886,#064E3B)' },
    { id: 'av-sunset',   cat: 'avatar', name: 'Avatar Pôr do sol', price: 180, value: 'linear-gradient(145deg,#FFB020,#E1306C)' },
    { id: 'theme-midnight', cat: 'theme', name: 'Tema Meia-noite', price: 300, value: 'midnight' },
    { id: 'theme-graphite', cat: 'theme', name: 'Tema Grafite',    price: 300, value: 'graphite' },
    { id: 'fx-fireworks',cat: 'finish', name: 'Chegada: Fogos',    price: 350, value: 'fireworks' },
    { id: 'fx-pulse',    cat: 'finish', name: 'Chegada: Pulso',    price: 150, value: 'pulse' },
  ],

  /* ---------- Nuvem e social (Supabase) ----------
     Cole aqui a URL e a chave "anon public" do seu projeto
     (Supabase → Project Settings → API). Veja supabase/schema.sql */
  supabase: {
    url: 'https://wgorplmmlghjsyscrbki.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb3JwbG1tbGdoanN5c2NyYmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjU0NDMsImV4cCI6MjEwODk0MTQ0M30.PFr85oD-vlStZBDgVRmFBQd2PPoAQPhNf1htl-uLiUs',
  },
};
