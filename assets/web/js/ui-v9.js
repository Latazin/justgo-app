(()=>{const MN=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"],DW=["S","T","Q","Q","S","S","D"];UI.v9Week=function(){const D=Store.data,now=Date.now(),ws=Game.weekStart(now),week=Game.scope("week",now),todayI=(new Date().getDay()+6)%7,goal=D.profile.goalWeek||10,days=Array.from({length:7},(_,i)=>{const d=new Date(ws);d.setDate(d.getDate()+i);const k=Game.dayKey(d),L=week.filter(a=>Game.dayKey(a.start)===k),by={};L.forEach(a=>by[a.sport]=(by[a.sport]||0)+a.distance);const top=Object.keys(by).sort((x,y)=>by[y]-by[x])[0];return{km:L.reduce((x,a)=>x+a.distance,0)/1e3,c:top&&CONFIG.sports[top]?CONFIG.sports[top].color:""}}),max=Math.max(...days.map(d=>d.km),goal/5,1),km=Game.km(week),time=week.reduce((x,a)=>x+a.duration,0),gp=Math.min(100,km/goal*100),elev=week.reduce((x,a)=>x+(Geo.elevationGain(a.points||[])||0),0);return`<section class="v9-week tap" data-act="go" data-v="stats">
      <div class="v9-wk-top">
        <div class="v9-big"><b class="num">${Fmt.num(km)}</b><span>km nesta semana</span></div>
        <div class="v9-goal"><b class="num">${Math.round(gp)}%</b><span>da meta de ${goal} km</span></div>
      </div>
      <div class="v9-bar"><i style="width:${gp}%"></i></div>
      <dl class="v9-kv"><div><dt>Tempo</dt><dd class="num">${Fmt.time(time)}</dd></div><div><dt>Treinos</dt><dd class="num">${week.length}</dd></div><div><dt>Subida</dt><dd class="num">${Math.round(elev)}<small> m</small></dd></div></dl>
      <div class="v9-chart">${days.map((d,i)=>`<div class="${i===todayI?"td":""} ${i>todayI?"fu":""}"><span><i style="height:${d.km?Math.max(6,d.km/max*100):0}%;${d.c?`--c:${d.c}`:""}"></i></span><small>${DW[i]}</small></div>`).join("")}</div>
    </section>`},UI.v9Progress=function(){const lv=this.levelLine(),streak=Game.streakDays(),L=Game.league(Game.monthXp()),zones=Zones.mine();let un=0,tot=0,done=0,nd=0;try{Game.syncUnlocks&&Game.syncUnlocks();const U=CONFIG.unlocks.filter(u=>Game.relevant(u));tot=U.length,un=U.filter(u=>Store.data.unlocked[u.id]).length;const now=Date.now(),day=Game.dailyMissions(now),sc=Game.scope("day",now);nd=day.length,done=day.filter(m=>Game.mProgress(m,sc).cur>=m.value).length}catch{}return`<section class="v9-sec">
      <div class="v9-strip">
        <button data-act="sub" data-v="progress:tree"><small>N\xEDvel</small><b class="num">${lv.l}</b><span>${Game.title(lv.l)}</span><i class="v9-mini"><i style="width:${lv.pct}%"></i></i></button>
        <button data-act="go" data-v="progress"><small>Ofensiva</small><b class="num">${streak}</b><span>${streak===1?"dia":"dias"}</span></button>
        <button data-act="sub" data-v="progress:season"><small>Liga</small><b>${L.name}</b><span class="num">${Game.monthXp()} XP</span></button>
        <button data-act="go" data-v="mapa"><small>Territ\xF3rio</small><b class="num">${zones.length?Zones.areaTxt(Zones.totalArea(zones)):"0"}</b><span>${zones.length} ${zones.length===1?"\xE1rea":"\xE1reas"}</span></button>
      </div>
      <div class="v9-links">
        <button data-act="sub" data-v="progress:missions">${I("target")}<span class="grow">Miss\xF5es</span><em class="num">${done}/${nd} hoje</em>${I("chevronRight","xs")}</button>
        <button data-act="sub" data-v="progress:tree">${I("zap")}<span class="grow">Desbloqueios</span><em class="num">${un}/${tot}</em>${I("chevronRight","xs")}</button>
      </div>
    </section>`},UI.home=function(){this.setSportColor(App.sport);const D=Store.data,now=Date.now(),recent=[...D.activities].sort((a,b)=>b.start-a.start),daily=Game.dailyMissions(now),dDone=daily.filter(m=>D.missionsDone[Game.mKey("d",m,now)]).length,plan=Plans.today(),d=new Date,first=esc((D.profile.name||"").split(" ")[0]);this.render(`${this.header("","",{brand:!0})}
    <main class="screen home v9h">
      <section class="v9-hello"><div class="grow"><span>${this.today()}</span><h1>${this.greeting()}${first?`, ${first}`:""}</h1></div><div id="hWx" class="wx-chip" hidden></div></section>
      ${this.v9Week()}
      ${this.loginCard()}
      <div id="hTorch"></div>
      ${this.retroCard()}
      ${this.v9Progress()}

      ${plan?`<section class="v9-sec tap" data-act="go" data-v="plans"><header class="v9-h"><h2>Plano de treino</h2></header><div class="v9-plan"><b>${plan.session?`${esc(plan.session.type)} \xB7 ${Fmt.num(plan.session.km)} km`:plan.P.finished?"Plano conclu\xEDdo":"Semana completa"}</b><small>${esc(plan.def.name)}</small></div></section>`:""}

      <section class="v9-sec v9-last">
        <header class="v9-h"><h2>Seu \xFAltimo treino</h2>${recent.length?'<button data-act="go" data-v="history">Ver todos</button>':""}</header>
        ${recent.length?this.postCard(recent[0],esc(D.profile.name)):'<div class="v9-empty"><b>Seu primeiro treino come\xE7a aqui</b><p>Toque em Gravar, escolha o esporte e o GPS registra o percurso.</p><button class="btn primary" data-act="go" data-v="record">Gravar treino</button></div>'}
      </section>
      <section class="v9-sec">
        <header class="v9-h"><h2>Miss\xF5es de hoje</h2><span class="num">${dDone}/${daily.length}</span></header>
        <div class="list flat">${daily.map(m=>this.missionRow(m,"d","day")).join("")}</div>
        <button class="v9-more" data-act="sub" data-v="progress:missions">Ver todas as miss\xF5es</button>
      </section>
      ${Cloud.loggedIn()?'<section class="v9-sec"><header class="v9-h"><h2>Da comunidade</h2><button data-act="go" data-v="social">Ver mais</button></header><div class="comm-strip" id="hComm"><div class="comm-card sk"></div><div class="comm-card sk"></div></div></section>':""}

      <section class="v9-sec v9-cal">${this.homeMonth()}</section>
      <section class="v9-sec v9-med">${this.homeMedals()}</section>
      ${this.avatarHome?`<section class="v9-sec v9-av">${this.avatarHome()}</section>`:""}
    </main>`),this.homeWx(),this.homeComm(),Cloud.loggedIn()&&Cloud.torchHolding&&Cloud.torchHolding().then(L=>{const el=$("#hTorch");if(!el||App.tab!=="home")return;const t=L.find(x=>UI.torchLit(x));if(!t)return;const ready=!!t.pending_act;el.innerHTML=`<section class="th8-hold home" data-act="${ready?"torchChoose":"torchOpen"}" data-v="${t.id}">${UI.torchFlame("md")}<div class="grow"><span class="th8-k">${t.last_event==="return"?"A Tocha voltou para voc\xEA":"A Tocha est\xE1 com voc\xEA"}</span><b>${ready?"Escolha para quem passar":"Treine para passar adiante"}</b><small>${ready?`Faltam <b>${UI.hoursLeft(t.deadline)}</b> para escolher.`:`${t.legs} ${t.legs===1?"pessoa":"pessoas"} \xB7 ${Fmt.num(t.total_m/1e3)} km \xB7 faltam <b>${UI.hoursLeft(t.deadline)}</b>`}</small></div><span class="th8-go">${ready?"Passar":"Ver"}${I("chevronRight","xs")}</span></section>`}).catch(()=>{})}})();
