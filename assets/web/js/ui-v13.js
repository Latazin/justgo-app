(()=>{const topo=(seed,W,H)=>typeof V11<"u"?V11.topo(seed,W,H):"";UI.gateBg=function(extra=""){return`<div class="gate-bg g13 ${extra}"><svg class="g13-topo" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path d="${topo(91,400,800)}"/><path d="${topo(377,400,800)}" transform="translate(0 380)"/></svg></div>`};const LOOP="M84 196C58 156 66 96 124 78S250 54 288 98s16 104-40 124-122 22-164-26Z",art=()=>`<svg class="g13-art" viewBox="0 0 360 280" aria-hidden="true">
      <g class="st"><path d="M0 52h360M0 118h360M0 184h360M0 250h360M58 0v280M150 0v280M242 0v280M318 0v280"/></g>
      <path class="zone" d="${LOOP}"/>
      <path class="route" d="${LOOP}" pathLength="1000"/>
      <circle class="start" cx="84" cy="196" r="8"/>
      <g transform="translate(186 148)"><g class="pin"><path d="M0 0v-42" /><path class="fl" d="M0-42h30l-7 9 7 9H0z"/><circle r="5"/></g></g>
      <g transform="translate(186 176)"><g class="tag"><rect x="-66" y="-15" width="132" height="30" rx="15"/><text y="5">Sua \xE1rea \xB7 0,42 km\xB2</text></g></g>
    </svg>`;UI.welcome=function(){App.tab="gate",App.gateStep="welcome";const st=Cloud.settings||{};this.render(`<main class="gate wel13">
      ${this.gateBg()}
      <div class="wel13-top">${this.brand()}</div>
      <div class="wel13-hero">
        ${art()}
        <h1>Seu treino<br>vira <em>territ\xF3rio</em>.</h1>
        <p>Corra ou pedale, feche um circuito e a \xE1rea de dentro \xE9 sua no mapa da cidade. Suba de liga e dispute com a sua galera.</p>
      </div>
      <section class="wel13-sheet">
        <button class="btn primary wel13-main" data-act="gateAuth" data-v="signup">Criar conta gr\xE1tis ${I("chevronRight")}</button>
        ${st.google!==!1?`<button class="btn wel13-g" data-act="loginGoogle">${this.GOOGLE_G}Continuar com Google</button>`:""}
        <button class="wel13-in" data-act="gateAuth" data-v="signin">J\xE1 tem conta? <b>Entrar</b></button>
        <p class="wel13-legal">Ao continuar, voc\xEA aceita os <button data-act="legal" data-v="terms">Termos de Uso</button> e a <button data-act="legal" data-v="privacy">Pol\xEDtica de Privacidade</button>.</p>
      </section>
    </main>`,!1)};const ax0=UI.authx.bind(UI);UI.authx=function(...a){const r=ax0(...a),m=$("main.gate.ax");return m&&m.classList.add("ax13"),r}})();
