/* Textos legais do JustGo: Política de Privacidade e Termos de Uso.
   Usados no app (modal) e nas páginas públicas privacidade.html / termos.html
   (os links dessas páginas vão na ficha da Play Store). */
const Legal = {
  UPDATED: '6 de novembro de 2026',
  SITE: 'https://tejustgo.netlify.app',
  // e-mail público de contato (opcional). Se vazio, o contato é pelo próprio app.
  EMAIL: '',

  contact() {
    return this.EMAIL
      ? `pelo e-mail <b>${this.EMAIL}</b> ou pelo próprio app`
      : 'pelo próprio app (Perfil &gt; Conta) ou pela página do JustGo na Google Play';
  },

  privacy() {
    return `
<p class="lg-date">Última atualização: ${this.UPDATED}</p>
<p>O JustGo é um aplicativo para registrar corrida, pedal e natação, com missões, ranking, amigos e territórios. Esta política explica quais dados usamos, por quê, e quais são os seus direitos (Lei Geral de Proteção de Dados, LGPD).</p>

<h2>1. Dados que coletamos</h2>
<ul>
<li><b>Conta:</b> e-mail e senha (ou conta Google, se você escolher entrar com ela), nome, nome de usuário (@), cidade e foto de perfil (opcional).</li>
<li><b>Localização precisa (GPS):</b> usada <b>somente durante a gravação de um treino</b> (com o app aberto ou com a notificação de treino ativa) para traçar o percurso, calcular distância, ritmo e velocidade, e conquistar territórios. O JustGo não rastreia você fora de um treino.</li>
<li><b>Dados de treino:</b> percursos, tempos, distâncias, ritmo, esporte, calorias estimadas, metas, missões, XP, moedas e conquistas.</li>
<li><b>Conteúdo social:</b> publicações, comentários, curtidas, quem você segue, clubes e desafios dos quais participa.</li>
<li><b>Dados do aparelho no app:</b> preferências (tema, voz, unidades) e cópia local dos treinos, guardadas no próprio aparelho.</li>
</ul>

<h2>2. Para que usamos</h2>
<ul>
<li>Criar e manter a sua conta e sincronizar seus treinos entre aparelhos.</li>
<li>Gravar treinos, mostrar estatísticas, mapas, missões, ligas, rankings e territórios.</li>
<li>Permitir o feed, as curtidas, os comentários e os amigos.</li>
<li>Mostrar o clima do dia e mapas.</li>
<li>Manter a segurança, evitar fraudes e corrigir erros.</li>
</ul>
<p>Não vendemos seus dados e não usamos sua localização para publicidade.</p>

<h2>3. O que fica visível para outras pessoas</h2>
<p>Seu nome, @, cidade, foto, nível, ranking, publicações de treino (incluindo o percurso mostrado no mapa), territórios conquistados e atividade social podem ser vistos por outros usuários do JustGo. Antes de publicar um treino, escolha com cuidado percursos que passem perto da sua casa ou do seu trabalho.</p>

<h2>4. Com quem compartilhamos</h2>
<p>Usamos prestadores que processam dados em nome do JustGo:</p>
<ul>
<li><b>Supabase</b>: banco de dados, login e armazenamento de fotos.</li>
<li><b>Google</b>: somente se você escolher "Continuar com Google" para entrar.</li>
<li><b>OpenFreeMap / OpenStreetMap</b>: imagens de mapa (recebem o seu endereço IP e a região exibida no mapa).</li>
<li><b>Open-Meteo</b>: previsão do tempo (recebe a localização aproximada).</li>
<li><b>Netlify</b>: hospedagem das páginas do app.</li>
</ul>
<p>Esses serviços podem armazenar dados em servidores fora do Brasil. Também podemos divulgar dados se houver obrigação legal.</p>

<h2>5. Por quanto tempo guardamos</h2>
<p>Mantemos os dados enquanto a sua conta existir. Ao excluir a conta, os seus dados são apagados dos nossos sistemas (veja o item 7).</p>

<h2>6. Segurança</h2>
<p>Os dados trafegam com criptografia (HTTPS) e o acesso ao banco é protegido por regras de segurança por usuário. Nenhum sistema é 100% seguro, mas trabalhamos para proteger suas informações.</p>

<h2>7. Seus direitos e como excluir a conta</h2>
<p>Você pode, a qualquer momento: acessar e corrigir seus dados em <b>Perfil &gt; Conta</b>; sair da conta; e <b>excluir a conta e todos os dados</b> em <b>Perfil &gt; Conta &gt; Excluir minha conta</b>. A exclusão é imediata e não pode ser desfeita.</p>
<p>Se não conseguir acessar o app, peça a exclusão ${this.contact()}, informando o e-mail da conta. Atendemos em até 15 dias.</p>
<p>Você também pode pedir confirmação do tratamento, portabilidade, anonimização e revogar consentimentos, conforme a LGPD.</p>

<h2>8. Crianças e adolescentes</h2>
<p>O JustGo é destinado a pessoas com 13 anos ou mais. Menores de 18 anos devem usar o app com conhecimento e autorização de um responsável. Se soubermos que uma criança menor de 13 anos criou uma conta, vamos excluí-la.</p>

<h2>9. Anúncios</h2>
<p>Hoje o JustGo não exibe anúncios. Se isso mudar, esta política será atualizada antes e você será avisado.</p>

<h2>10. Mudanças nesta política</h2>
<p>Podemos atualizar este texto. Mudanças importantes serão avisadas no app. A data no topo mostra a versão atual.</p>

<h2>11. Contato</h2>
<p>Dúvidas sobre privacidade: ${this.contact()}.</p>`;
  },

  terms() {
    return `
<p class="lg-date">Última atualização: ${this.UPDATED}</p>
<p>Ao criar uma conta ou usar o JustGo, você concorda com estes Termos de Uso e com a <a href="privacidade.html" data-lg="privacy">Política de Privacidade</a>. Se não concordar, não use o app.</p>

<h2>1. O que é o JustGo</h2>
<p>Um aplicativo para registrar treinos de corrida, pedal e natação, com missões, ranking, amigos, clubes e conquista de territórios.</p>

<h2>2. Quem pode usar</h2>
<p>Você precisa ter 13 anos ou mais. Se tiver menos de 18, use com autorização de um responsável. Você é responsável por manter a sua senha em segurança e pelo que acontece na sua conta.</p>

<h2>3. Saúde e segurança (importante)</h2>
<ul>
<li>O JustGo <b>não é aplicativo médico</b>. Calorias, ritmo, metas e dicas são estimativas e não substituem orientação de médico ou profissional de educação física.</li>
<li>Consulte um médico antes de iniciar ou aumentar atividade física intensa.</li>
<li>Treine com atenção ao trânsito e ao ambiente. <b>Não mexa no celular enquanto corre, pedala ou dirige.</b> Respeite as leis de trânsito, use capacete na bicicleta e evite locais perigosos ou proibidos.</li>
<li>Os territórios e missões são um jogo: <b>nunca invada propriedade privada ou áreas restritas</b> para conquistá-los.</li>
</ul>

<h2>4. Regras da comunidade</h2>
<p>É proibido: assediar, ofender ou ameaçar pessoas; publicar conteúdo ilegal, sexual, violento ou discriminatório; usar a conta de outra pessoa; enviar spam; <b>fraudar treinos</b> (GPS falso, simuladores, carro ou moto como se fosse corrida/pedal) ou tentar burlar rankings e territórios; explorar falhas ou tentar invadir o sistema.</p>
<p>Podemos remover conteúdo, anular treinos suspeitos, suspender ou excluir contas que descumpram estas regras.</p>

<h2>5. Seu conteúdo</h2>
<p>Você continua dono do que publica (fotos, textos, treinos). Ao publicar, você nos dá permissão gratuita para armazenar e exibir esse conteúdo dentro do JustGo para os outros usuários, conforme as suas configurações. Você garante que tem direito de publicar o que enviar.</p>

<h2>6. Nossa propriedade</h2>
<p>O app, a marca JustGo, o design e o código pertencem aos seus criadores. Você não pode copiá-los, revendê-los ou fazer engenharia reversa.</p>

<h2>7. Disponibilidade e mudanças</h2>
<p>Fazemos o possível para o app funcionar bem, mas ele é oferecido "como está", podendo ter erros, instabilidade, GPS impreciso ou ficar indisponível. Podemos alterar, incluir ou remover funções, inclusive criar planos pagos no futuro, avisando antes.</p>

<h2>8. Limitação de responsabilidade</h2>
<p>Na máxima extensão permitida pela lei, o JustGo não se responsabiliza por lesões, acidentes, perdas ou danos decorrentes da prática de atividade física, do uso do celular durante o treino, de informações imprecisas ou da perda de dados. Isso não afasta direitos que a lei do consumidor garante a você.</p>

<h2>9. Encerrar a conta</h2>
<p>Você pode excluir a conta quando quiser em <b>Perfil &gt; Conta &gt; Excluir minha conta</b>. Também podemos encerrar contas que violem estes termos.</p>

<h2>10. Lei aplicável</h2>
<p>Estes termos seguem as leis do Brasil. Fica eleito o foro do domicílio do consumidor para resolver qualquer disputa.</p>

<h2>11. Contato</h2>
<p>Dúvidas sobre estes termos: ${this.contact()}.</p>`;
  },

  // abre dentro do app (tela cheia com rolagem)
  show(kind) {
    const t = kind === 'terms' ? 'Termos de Uso' : 'Política de Privacidade';
    const body = kind === 'terms' ? this.terms() : this.privacy();
    setTimeout(() => document.querySelectorAll('.lg-body a[href]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); Legal.show('privacy'); }; }), 0);
    return FX.modal(`<div class="lg-modal"><h3>${t}</h3><div class="lg-body">${body}</div><button class="btn primary" data-m="ok">Entendi</button></div>`);
  },
};
