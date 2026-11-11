const Legal={UPDATED:"6 de novembro de 2026 (v2)",SITE:"https://tejustgo.netlify.app",EMAIL:"",contact(){return this.EMAIL?`pelo e-mail <b>${this.EMAIL}</b> ou pelo pr\xF3prio app`:"pelo pr\xF3prio app (Perfil &gt; Conta) ou pela p\xE1gina do JustGo na Google Play"},privacy(){return`
<p class="lg-date">\xDAltima atualiza\xE7\xE3o: ${this.UPDATED}</p>
<p>O JustGo \xE9 um aplicativo para registrar corrida, pedal e nata\xE7\xE3o, com miss\xF5es, ranking, amigos e territ\xF3rios. Esta pol\xEDtica explica quais dados usamos, por qu\xEA, e quais s\xE3o os seus direitos (Lei Geral de Prote\xE7\xE3o de Dados, LGPD).</p>

<h2>1. Dados que coletamos</h2>
<ul>
<li><b>Conta:</b> e-mail e senha (ou conta Google, se voc\xEA escolher entrar com ela), nome, nome de usu\xE1rio (@), cidade e foto de perfil (opcional).</li>
<li><b>Localiza\xE7\xE3o precisa (GPS):</b> usada <b>somente durante a grava\xE7\xE3o de um treino</b> (com o app aberto ou com a notifica\xE7\xE3o de treino ativa) para tra\xE7ar o percurso, calcular dist\xE2ncia, ritmo e velocidade, e conquistar territ\xF3rios. O JustGo n\xE3o rastreia voc\xEA fora de um treino.</li>
<li><b>Dados de treino:</b> percursos, tempos, dist\xE2ncias, ritmo, esporte, calorias estimadas, metas, miss\xF5es, XP, moedas e conquistas.</li>
<li><b>Conte\xFAdo social:</b> publica\xE7\xF5es, coment\xE1rios, curtidas, quem voc\xEA segue, clubes e desafios dos quais participa.</li>
<li><b>Identificador de publicidade (s\xF3 no app Android):</b> usado pelo Google AdMob quando voc\xEA <b>escolhe</b> assistir a um an\xFAncio para ganhar uma recompensa.</li>
<li><b>Dados do aparelho no app:</b> prefer\xEAncias (tema, voz, unidades) e c\xF3pia local dos treinos, guardadas no pr\xF3prio aparelho.</li>
</ul>

<h2>2. Para que usamos</h2>
<ul>
<li>Criar e manter a sua conta e sincronizar seus treinos entre aparelhos.</li>
<li>Gravar treinos, mostrar estat\xEDsticas, mapas, miss\xF5es, ligas, rankings e territ\xF3rios.</li>
<li>Contar, de forma an\xF4nima, quantas pessoas abrem o app, se cadastram e treinam (s\xF3 um c\xF3digo aleat\xF3rio do aparelho, sem nome, e-mail ou conta), para melhorar o app.</li>
<li>Permitir o feed, as curtidas, os coment\xE1rios e os amigos.</li>
<li>Mostrar o clima do dia e mapas.</li>
<li>Manter a seguran\xE7a, evitar fraudes e corrigir erros.</li>
</ul>
<p>N\xE3o vendemos seus dados e n\xE3o usamos sua localiza\xE7\xE3o para publicidade.</p>

<h2>3. O que fica vis\xEDvel para outras pessoas</h2>
<p>Seu nome, @, cidade, foto, n\xEDvel, ranking, publica\xE7\xF5es de treino (incluindo o percurso mostrado no mapa), territ\xF3rios conquistados e atividade social podem ser vistos por outros usu\xE1rios do JustGo. Antes de publicar um treino, escolha com cuidado percursos que passem perto da sua casa ou do seu trabalho.</p>

<h2>4. Com quem compartilhamos</h2>
<p>Usamos prestadores que processam dados em nome do JustGo:</p>
<ul>
<li><b>Supabase</b>: banco de dados, login e armazenamento de fotos.</li>
<li><b>Google</b>: somente se voc\xEA escolher "Continuar com Google" para entrar.</li>
<li><b>OpenFreeMap / OpenStreetMap</b>: imagens de mapa (recebem o seu endere\xE7o IP e a regi\xE3o exibida no mapa).</li>
<li><b>Open-Meteo</b>: previs\xE3o do tempo (recebe a localiza\xE7\xE3o aproximada).</li>
<li><b>Netlify</b>: hospedagem das p\xE1ginas do app.</li>
<li><b>Google AdMob</b>: exibe os an\xFAncios opcionais com recompensa. Pode usar o identificador de publicidade do aparelho, endere\xE7o IP e informa\xE7\xF5es do dispositivo, conforme a <a href="https://policies.google.com/technologies/ads?hl=pt-BR" target="_blank" rel="noopener">pol\xEDtica do Google</a>.</li>
</ul>
<p>Esses servi\xE7os podem armazenar dados em servidores fora do Brasil. Tamb\xE9m podemos divulgar dados se houver obriga\xE7\xE3o legal.</p>

<h2>5. Por quanto tempo guardamos</h2>
<p>Mantemos os dados enquanto a sua conta existir. Ao excluir a conta, os seus dados s\xE3o apagados dos nossos sistemas (veja o item 7).</p>

<h2>6. Seguran\xE7a</h2>
<p>Os dados trafegam com criptografia (HTTPS) e o acesso ao banco \xE9 protegido por regras de seguran\xE7a por usu\xE1rio. Nenhum sistema \xE9 100% seguro, mas trabalhamos para proteger suas informa\xE7\xF5es.</p>

<h2>7. Seus direitos e como excluir a conta</h2>
<p>Voc\xEA pode, a qualquer momento: acessar e corrigir seus dados em <b>Perfil &gt; Conta</b>; sair da conta; e <b>excluir a conta e todos os dados</b> em <b>Perfil &gt; Conta &gt; Excluir minha conta</b>. A exclus\xE3o \xE9 imediata e n\xE3o pode ser desfeita.</p>
<p>Se n\xE3o conseguir acessar o app, pe\xE7a a exclus\xE3o ${this.contact()}, informando o e-mail da conta. Atendemos em at\xE9 15 dias.</p>
<p>Voc\xEA tamb\xE9m pode pedir confirma\xE7\xE3o do tratamento, portabilidade, anonimiza\xE7\xE3o e revogar consentimentos, conforme a LGPD.</p>

<h2>8. Crian\xE7as e adolescentes</h2>
<p>O JustGo \xE9 destinado a pessoas com 13 anos ou mais. Menores de 18 anos devem usar o app com conhecimento e autoriza\xE7\xE3o de um respons\xE1vel. Se soubermos que uma crian\xE7a menor de 13 anos criou uma conta, vamos exclu\xED-la.</p>

<h2>9. An\xFAncios</h2>
<p>No app Android, o JustGo oferece an\xFAncios <b>opcionais</b>: voc\xEA s\xF3 v\xEA um an\xFAncio quando toca para ganhar uma recompensa (por exemplo, salvar a ofensiva, proteger seu territ\xF3rio, dobrar o XP de um treino ou testar uma fun\xE7\xE3o por 24 h). N\xE3o h\xE1 an\xFAncios durante o treino. Voc\xEA pode redefinir ou desativar o identificador de publicidade nas configura\xE7\xF5es do Android (Google &gt; An\xFAncios).</p>

<h2>10. Mudan\xE7as nesta pol\xEDtica</h2>
<p>Podemos atualizar este texto. Mudan\xE7as importantes ser\xE3o avisadas no app. A data no topo mostra a vers\xE3o atual.</p>

<h2>11. Contato</h2>
<p>D\xFAvidas sobre privacidade: ${this.contact()}.</p>`},terms(){return`
<p class="lg-date">\xDAltima atualiza\xE7\xE3o: ${this.UPDATED}</p>
<p>Ao criar uma conta ou usar o JustGo, voc\xEA concorda com estes Termos de Uso e com a <a href="privacidade.html" data-lg="privacy">Pol\xEDtica de Privacidade</a>. Se n\xE3o concordar, n\xE3o use o app.</p>

<h2>1. O que \xE9 o JustGo</h2>
<p>Um aplicativo para registrar treinos de corrida, pedal e nata\xE7\xE3o, com miss\xF5es, ranking, amigos, clubes e conquista de territ\xF3rios.</p>

<h2>2. Quem pode usar</h2>
<p>Voc\xEA precisa ter 13 anos ou mais. Se tiver menos de 18, use com autoriza\xE7\xE3o de um respons\xE1vel. Voc\xEA \xE9 respons\xE1vel por manter a sua senha em seguran\xE7a e pelo que acontece na sua conta.</p>

<h2>3. Sa\xFAde e seguran\xE7a (importante)</h2>
<ul>
<li>O JustGo <b>n\xE3o \xE9 aplicativo m\xE9dico</b>. Calorias, ritmo, metas e dicas s\xE3o estimativas e n\xE3o substituem orienta\xE7\xE3o de m\xE9dico ou profissional de educa\xE7\xE3o f\xEDsica.</li>
<li>Consulte um m\xE9dico antes de iniciar ou aumentar atividade f\xEDsica intensa.</li>
<li>Treine com aten\xE7\xE3o ao tr\xE2nsito e ao ambiente. <b>N\xE3o mexa no celular enquanto corre, pedala ou dirige.</b> Respeite as leis de tr\xE2nsito, use capacete na bicicleta e evite locais perigosos ou proibidos.</li>
<li>Os territ\xF3rios e miss\xF5es s\xE3o um jogo: <b>nunca invada propriedade privada ou \xE1reas restritas</b> para conquist\xE1-los.</li>
</ul>

<h2>4. Regras da comunidade</h2>
<p>\xC9 proibido: assediar, ofender ou amea\xE7ar pessoas; publicar conte\xFAdo ilegal, sexual, violento ou discriminat\xF3rio; usar a conta de outra pessoa; enviar spam; <b>fraudar treinos</b> (GPS falso, simuladores, carro ou moto como se fosse corrida/pedal) ou tentar burlar rankings e territ\xF3rios; explorar falhas ou tentar invadir o sistema.</p>
<p>Podemos remover conte\xFAdo, anular treinos suspeitos, suspender ou excluir contas que descumpram estas regras.</p>

<h2>5. Seu conte\xFAdo</h2>
<p>Voc\xEA continua dono do que publica (fotos, textos, treinos). Ao publicar, voc\xEA nos d\xE1 permiss\xE3o gratuita para armazenar e exibir esse conte\xFAdo dentro do JustGo para os outros usu\xE1rios, conforme as suas configura\xE7\xF5es. Voc\xEA garante que tem direito de publicar o que enviar.</p>

<h2>6. Nossa propriedade</h2>
<p>O app, a marca JustGo, o design e o c\xF3digo pertencem aos seus criadores. Voc\xEA n\xE3o pode copi\xE1-los, revend\xEA-los ou fazer engenharia reversa.</p>

<h2>7. Disponibilidade e mudan\xE7as</h2>
<p>Fazemos o poss\xEDvel para o app funcionar bem, mas ele \xE9 oferecido "como est\xE1", podendo ter erros, instabilidade, GPS impreciso ou ficar indispon\xEDvel. Podemos alterar, incluir ou remover fun\xE7\xF5es, inclusive criar planos pagos no futuro, avisando antes.</p>

<h2>8. Limita\xE7\xE3o de responsabilidade</h2>
<p>Na m\xE1xima extens\xE3o permitida pela lei, o JustGo n\xE3o se responsabiliza por les\xF5es, acidentes, perdas ou danos decorrentes da pr\xE1tica de atividade f\xEDsica, do uso do celular durante o treino, de informa\xE7\xF5es imprecisas ou da perda de dados. Isso n\xE3o afasta direitos que a lei do consumidor garante a voc\xEA.</p>

<h2>9. Encerrar a conta</h2>
<p>Voc\xEA pode excluir a conta quando quiser em <b>Perfil &gt; Conta &gt; Excluir minha conta</b>. Tamb\xE9m podemos encerrar contas que violem estes termos.</p>

<h2>10. Lei aplic\xE1vel</h2>
<p>Estes termos seguem as leis do Brasil. Fica eleito o foro do domic\xEDlio do consumidor para resolver qualquer disputa.</p>

<h2>11. Contato</h2>
<p>D\xFAvidas sobre estes termos: ${this.contact()}.</p>`},show(kind){const t=kind==="terms"?"Termos de Uso":"Pol\xEDtica de Privacidade",body=kind==="terms"?this.terms():this.privacy();return setTimeout(()=>document.querySelectorAll(".lg-body a[href]").forEach(a=>{a.onclick=e=>{e.preventDefault(),Legal.show("privacy")}}),0),FX.modal(`<div class="lg-modal"><h3>${t}</h3><div class="lg-body">${body}</div><button class="btn primary" data-m="ok">Entendi</button></div>`)}};
