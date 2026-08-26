// Conteudo do site de documentacao interna (docs.html), no formato usado por
// documentacoes de API de verdade: categorias > artigos > blocos (paragrafo,
// titulo de secao, lista, bloco de codigo). Pra adicionar um novo artigo, basta
// acrescentar um objeto em "artigos" (ou uma nova categoria) - a arvore lateral,
// o breadcrumb e o indice "Nesta pagina" sao todos gerados a partir daqui.
window.DOCS = {
  categorias: [
    {
      id: "primeiros-passos",
      titulo: "Primeiros passos",
      artigos: [
        {
          id: "como-rodar",
          titulo: "Como rodar a aplicação",
          atualizado: "26 de ago de 2026",
          aviso:
            "Comandos testados no Windows com Docker Desktop. Se algo mudar no " +
            "docker-compose.yml ou no .env.example, valide aqui de novo antes de confiar cegamente.",
          blocos: [
            {
              tipo: "p",
              html:
                "Este artigo cobre <strong>tudo</strong> que é preciso pra subir a AutoSeguro do zero: " +
                "pré-requisitos, variáveis de ambiente, o comando de subir com Docker, as portas de " +
                "cada serviço, os usuários de teste, a alternativa sem Docker e como forçar o " +
                "<code>quote-service</code> a falhar pra testar o retry do agente.",
            },
            { tipo: "h2", id: "pre-requisitos", titulo: "Pré-requisitos" },
            {
              tipo: "lista",
              itens: [
                "<strong>Docker Desktop</strong> instalado e rodando (traz o Docker Compose junto).",
                "Uma <strong>chave da Anthropic</strong> válida — crie em " +
                  "<code>https://console.anthropic.com/</code>. Sem ela o agente sobe, mas não " +
                  "consegue entender nem responder mensagem nenhuma.",
                "Opcional: <strong>Python 3.12 + uv</strong>, só se quiser rodar sem Docker (ver seção própria abaixo).",
              ],
            },
            { tipo: "h2", id: "variaveis-de-ambiente", titulo: "Variáveis de ambiente (.env)" },
            {
              tipo: "p",
              html:
                "O repositório nunca guarda o <code>.env</code> real (está no <code>.gitignore</code>) — " +
                "só o <code>.env.example</code>, que é o ponto de partida:",
            },
            {
              tipo: "codigo",
              linguagem: "bash",
              codigo: "cp .env.example .env",
            },
            {
              tipo: "lista",
              itens: [
                "<code>ANTHROPIC_API_KEY</code> — obrigatória, sem ela o agente não funciona.",
                "<code>CLAUDE_MODEL</code> / <code>CLAUDE_EFFORT</code> — opcionais, trocam o modelo/effort " +
                  "padrão (também dá pra mudar depois pelo painel Admin, em runtime).",
                "<code>HANDOFF_MODE</code> / <code>WHATSAPP_BUSINESS_NUMBER</code> — opcionais, controlam " +
                  "se o handoff humano fica só no site ou encaminha pro WhatsApp real (idem, também " +
                  "configurável pelo Admin depois).",
                "<code>MONGO_ROOT_USER</code> / <code>MONGO_ROOT_PASSWORD</code> / <code>MONGO_DB</code> — " +
                  "credenciais do MongoDB local (usadas só entre os containers).",
                "<code>MONGO_ENCRYPTION_KEY</code> — sem essa chave a persistência cifrada no Mongo fica " +
                  "desativada automaticamente (o agente continua funcionando normal, só não grava lá). " +
                  "Gerar com:",
              ],
            },
            {
              tipo: "codigo",
              linguagem: "bash",
              codigo:
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"",
            },
            { tipo: "h2", id: "subindo-com-docker", titulo: "Subindo com Docker (recomendado)" },
            {
              tipo: "codigo",
              linguagem: "bash",
              codigo: "docker compose up --build",
            },
            {
              tipo: "p",
              html:
                "Isso sobe 4 containers: <code>web-ui</code>, <code>agent-service</code>, " +
                "<code>quote-api</code> e <code>mongo</code> (o Mongo tem healthcheck — o " +
                "<code>agent-service</code> só inicia depois que ele está de verdade pronto, não só " +
                "\"iniciado\").",
            },
            { tipo: "h2", id: "servicos-e-portas", titulo: "Serviços e portas" },
            {
              tipo: "lista",
              itens: [
                "<code>http://localhost:3000</code> — <strong>web-ui</strong>: site da AutoSeguro (landing " +
                  "+ widget de chat) e todo o painel interno (login, atendente, admin, usuários, " +
                  "relatórios, documentação, meus dados).",
                "<code>http://localhost:8001</code> — <strong>agent-service</strong>: API do agente (FastAPI).",
                "<code>http://localhost:8000</code> — <strong>quote-api</strong>: API de cotação (insumo " +
                  "do desafio, não modificada).",
                "<code>localhost:27017</code> — <strong>mongo</strong>: só exposto pra inspeção local " +
                  "(<code>mongosh</code>, MongoDB Compass) — não é assim que deveria ficar em produção.",
              ],
            },
            { tipo: "h2", id: "usuarios-de-teste", titulo: "Usuários de teste" },
            {
              tipo: "p",
              html:
                "Semente inicial do painel interno (<code>http://localhost:3000/login.html</code>), " +
                "definida em <code>agent-service/app/auth.py</code> — sobrescrita assim que alguém " +
                "cadastra um usuário de verdade pelo menu Usuários:",
            },
            {
              tipo: "lista",
              itens: [
                "<code>admin</code> / <code>admin123</code> — perfil admin (acessa Configurações e Usuários).",
                "<code>atendente</code> / <code>atendente123</code> — perfil atendente.",
              ],
            },
            { tipo: "h2", id: "sem-docker", titulo: "Alternativa sem Docker" },
            {
              tipo: "codigo",
              linguagem: "bash",
              codigo:
                "cd quote-service && uv run uvicorn app.main:app --port 8000\n" +
                "cd agent-service && uv run uvicorn app.main:app --port 8001   # precisa ANTHROPIC_API_KEY no ambiente\n" +
                "# servir web-ui: qualquer servidor estatico, ex. `python -m http.server 3000` dentro de web-ui/",
            },
            {
              tipo: "p",
              html:
                "Sem MongoDB configurado o agente funciona normalmente — a persistência cifrada só " +
                "fica desativada (ver o artigo sobre onde as respostas são gravadas).",
            },
            { tipo: "h2", id: "simulando-falha", titulo: "Simulando falha de infraestrutura" },
            {
              tipo: "p",
              html:
                "O <code>quote-service</code> já simula instabilidade de propósito " +
                "(<code>QUOTE_FAILURE_RATE</code> / <code>QUOTE_SLOW_RATE</code> / " +
                "<code>QUOTE_SLOW_SECONDS</code>, configuráveis em <code>docker-compose.yml</code>). " +
                "Pra forçar falha sempre e ver o retry/backoff do agente na prática, edite " +
                "<code>QUOTE_FAILURE_RATE: \"1.0\"</code> no serviço <code>quote-api</code> e recrie só ele:",
            },
            {
              tipo: "codigo",
              linguagem: "bash",
              codigo: "docker compose up -d quote-api",
            },
            {
              tipo: "p",
              html: "Depois volte pra <code>\"0.20\"</code> pra testar o caminho feliz de novo.",
            },
            { tipo: "h2", id: "roteiro-de-teste", titulo: "Roteiro rápido de teste ponta a ponta" },
            {
              tipo: "lista",
              itens: [
                "Abra <code>http://localhost:3000</code>, clique no chat e informe plano, idade, ano do " +
                  "veículo, CEP e data de início válidos — a cotação sai com preço vindo direto do " +
                  "<code>quote-service</code>.",
                "Force falha de infra (seção acima) e repita — o agente avisa que está instável e " +
                  "tenta de novo sozinho, sem inventar preço.",
                "Dê uma idade fora da faixa aceita (ver <code>GET /planos</code> no " +
                  "<code>quote-service</code>) — recusa de negócio, sem retry, com explicação clara.",
                "Peça \"falar com atendente\" ou relate um sinistro — o agente pergunta nome e " +
                  "problema, confere a base de conhecimento e só então escala.",
                "Entre em <code>login.html</code> como <code>admin</code>/<code>admin123</code>, assuma o " +
                  "atendimento, finalize e veja o lead ser convidado a avaliar de 1 a 10.",
                "Confira <code>agent-service/logs/events.jsonl</code> (ou o MongoDB, cifrado) para a " +
                  "rastreabilidade completa dessa conversa.",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>README.md</code> — decisões de engenharia do projeto, versão resumida deste artigo incluída.",
                "<code>docker-compose.yml</code> — definição completa dos 4 serviços.",
                "<code>.env.example</code> — todas as variáveis de ambiente comentadas.",
              ],
            },
          ],
        },
        {
          id: "tecnologias",
          titulo: "Tecnologias utilizadas",
          atualizado: "26 de ago de 2026",
          blocos: [
            {
              tipo: "p",
              html:
                "Resumo de cada tecnologia usada no projeto e <strong>para que</strong> ela foi usada — " +
                "sem framework de frontend, sem ORM, sem banco vetorial: o mínimo de peças que resolve o " +
                "problema, seguindo o mesmo princípio de simplicidade do resto da arquitetura.",
            },
            { tipo: "h2", id: "backend", titulo: "Backend — agent-service" },
            {
              tipo: "lista",
              itens: [
                "<strong>Python 3.12</strong> — linguagem de todo o backend do agente.",
                "<strong>FastAPI</strong> — framework web; expõe a API REST consumida pelo <code>web-ui</code> " +
                  "(conversas, autenticação, relatórios, base de conhecimento, config).",
                "<strong>Uvicorn</strong> — servidor ASGI que roda a aplicação FastAPI.",
                "<strong>Pydantic</strong> — validação e parsing dos corpos de requisição/resposta da API.",
                "<strong>httpx</strong> — cliente HTTP usado pra chamar o <code>quote-service</code> " +
                  "(<code>quote_client.py</code>), com retry/backoff manual para falha de infra.",
                "<strong>SDK oficial da Anthropic (<code>anthropic</code>)</strong> — chama a API do Claude " +
                  "pra extrair dados estruturados da mensagem do lead (tool use forçado) e gerar o texto " +
                  "das respostas (<code>llm.py</code>).",
                "<strong>pymongo</strong> — driver do MongoDB, usado só em <code>mongo_client.py</code> pra " +
                  "gravar a cópia cifrada de cada evento.",
                "<strong>cryptography (Fernet/AES)</strong> — cifra o payload de cada evento antes de " +
                  "gravar no Mongo, com uma chave que nunca sai da variável de ambiente do agent-service.",
                "<strong><code>hashlib</code> (biblioteca padrão do Python)</strong> — hash salgado " +
                  "PBKDF2-HMAC-SHA256 das senhas dos usuários do painel interno; nunca senha em texto puro.",
              ],
            },
            { tipo: "h2", id: "quote-service", titulo: "API de cotação — quote-service" },
            {
              tipo: "p",
              html:
                "Também <strong>Python + FastAPI</strong> — mas é insumo do desafio, não foi escrito por " +
                "este projeto (só consumido pelo agente). Simula um sistema legado instável de propósito, " +
                "pra forçar o agente a lidar direito com falha de infraestrutura.",
            },
            { tipo: "h2", id: "frontend", titulo: "Frontend — web-ui" },
            {
              tipo: "lista",
              itens: [
                "<strong>HTML5 + CSS3 + JavaScript puro (vanilla)</strong> — sem React, Vue, Angular nem " +
                  "nenhum framework; sem build step (nenhum bundler, nenhum <code>npm install</code>). " +
                  "Cada página é um HTML servido direto, com seus próprios CSS/JS.",
                "<strong>Fetch API</strong> — toda comunicação com o <code>agent-service</code> (enviar " +
                  "mensagem, login, relatórios, upload de foto etc).",
                "<strong>Web Speech API (<code>SpeechRecognition</code>)</strong> — botão de microfone " +
                  "no chat e nos campos de texto (<code>speech.js</code>), fala vira texto direto no navegador.",
                "<strong>Web Audio API</strong> — sininho de notificação sintetizado na hora (oscillator + " +
                  "envelope de ganho), sem nenhum arquivo de áudio (<code>tab-badge.js</code>).",
                "<strong>Canvas API</strong> — desenha o favicon com a bolinha de notificação (contagem de " +
                  "não lidas) dinamicamente, também em <code>tab-badge.js</code>.",
                "<strong>SVG gerado por JavaScript</strong> — o gráfico de atendimentos por dia em " +
                  "Relatórios é montado na mão (barras + eixo), sem biblioteca de gráficos.",
                "<strong>FileReader API</strong> — converte a foto escolhida (upload de usuário) em data " +
                  "URI no navegador antes de mandar pro backend (<code>avatar.js</code>).",
                "<strong>sessionStorage</strong> — guarda a sessão de quem está logado no painel interno " +
                  "(token, nome, perfil, foto); some ao fechar a aba, por design.",
                "<strong>localStorage</strong> — só pra preferência local do navegador (URL base do " +
                  "agent-service, configurável em Admin), nunca dado sensível.",
                "<strong>Google reCAPTCHA v2</strong> — opcional; carregado dinamicamente só quando o " +
                  "Admin cadastra uma site key real, pra travar o botão de handoff via WhatsApp real.",
              ],
            },
            { tipo: "h2", id: "infra", titulo: "Infraestrutura" },
            {
              tipo: "lista",
              itens: [
                "<strong>Docker + Docker Compose</strong> — orquestra os 4 serviços (<code>web-ui</code>, " +
                  "<code>agent-service</code>, <code>quote-api</code>, <code>mongo</code>) com um único " +
                  "<code>docker compose up --build</code>.",
                "<strong>Nginx (imagem <code>nginx:alpine</code>)</strong> — serve os arquivos estáticos " +
                  "do <code>web-ui</code>; configurado (<code>nginx.conf</code>) pra nunca deixar o " +
                  "navegador cachear HTML/JS/CSS agressivamente, pra evitar ficar vendo versão antiga " +
                  "depois de um deploy.",
                "<strong>MongoDB</strong> — persistência das interações que sobrevive a reinício de " +
                  "container, sempre cifrada do lado da aplicação antes de gravar (ver artigo sobre onde " +
                  "as respostas são gravadas).",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>agent-service/pyproject.toml</code> — lista exata de dependências Python e versões.",
                "<code>README.md</code> — decisões de engenharia por trás de cada escolha de tecnologia.",
              ],
            },
          ],
        },
        {
          id: "estrutura-de-arquivos",
          titulo: "Estrutura de pastas e arquivos",
          atualizado: "26 de ago de 2026",
          aviso:
            "Árvore curada à mão a partir do repositório real (ver web-ui/docs-arvore.js) — se " +
            "arquivos forem adicionados/removidos depois, pode ficar desatualizada.",
          blocos: [
            {
              tipo: "p",
              html:
                "Clique numa pasta para abrir/fechar. Em cada <strong>arquivo</strong>, passe o mouse e " +
                "clique no ícone <strong>📋</strong> para copiar um prompt pronto sobre aquele arquivo — " +
                "cole numa IA (Claude, ChatGPT etc.) junto com o conteúdo do arquivo para pedir uma " +
                "explicação com contexto do projeto.",
            },
            { tipo: "arvore", dados: window.ARVORE_PROJETO },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>web-ui/docs-arvore.js</code> — fonte de dados desta árvore (nome, caminho e " +
                  "descrição de cada arquivo).",
                "Artigo <strong>Tecnologias utilizadas</strong> — o que cada tecnologia faz, agrupado " +
                  "por área em vez de por arquivo.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "fluxograma",
      titulo: "Fluxograma",
      artigos: [
        {
          id: "fluxograma-do-agente",
          titulo: "Fluxograma do agente",
          atualizado: "26 de ago de 2026",
          aviso:
            "Este é o desenho conceitual original (docs/fluxograma-agente.drawio). A maioria dos " +
            "passos bate exatamente com o código; alguns (marcados na explicação de cada passo) " +
            "descrevem uma versão mais ambiciosa do que existe hoje — ex.: retry assíncrono agendado, " +
            "que na implementação atual é síncrono, dentro do próprio request. Nunca escondido, sempre " +
            "dito explicitamente passo a passo.",
          blocos: [
            {
              tipo: "p",
              html:
                "Clique em qualquer passo do diagrama (ou no ícone <strong>?</strong> no canto dele) pra " +
                "ver a explicação — o que aquele passo faz de verdade no código. Use " +
                "<strong>◀ Anterior</strong> / <strong>Próximo ▶</strong> pra um passeio guiado por todo " +
                "o fluxo, passo a passo, na ordem. O diagrama tem scroll — arraste pra ver as partes " +
                "fora da tela.",
            },
            { tipo: "fluxograma", dados: window.FLUXOGRAMA },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>docs/fluxograma-agente.drawio</code> — arquivo original, abrir em " +
                  "<code>app.diagrams.net</code> pra editar visualmente.",
                "<code>web-ui/docs-fluxograma.js</code> — os dados deste diagrama interativo (nós, " +
                  "setas e as explicações).",
                "Artigo <strong>De onde vêm as perguntas? E onde são gravadas as respostas?</strong> — " +
                  "aprofunda os passos de coleta de dados e persistência.",
                "Artigo <strong>Base de conhecimento e uso da Anthropic</strong> — aprofunda os passos " +
                  "roxos (consulta e escrita na base de conhecimento).",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "arquitetura",
      titulo: "Arquitetura do agente",
      artigos: [
        {
          id: "perguntas-respostas",
          titulo: "De onde vêm as perguntas? E onde são gravadas as respostas?",
          atualizado: "26 de ago de 2026",
          aviso:
            "Esta página descreve o comportamento real do código nesta versão do projeto. " +
            "Se orchestrator.py ou llm.py mudarem depois, o texto abaixo pode ficar " +
            "desatualizado — em caso de dúvida, confira o código-fonte para validar.",
          blocos: [
            {
              tipo: "p",
              html:
                "Este artigo explica duas coisas sobre o agente da AutoSeguro: quem decide " +
                "<strong>qual pergunta fazer</strong> a cada mensagem do lead, e " +
                "<strong>onde cada resposta</strong> dada pelo lead fica gravada depois.",
            },
            { tipo: "h2", id: "de-onde-vem-as-perguntas", titulo: "De onde vêm as perguntas" },
            {
              tipo: "p",
              html:
                "A ordem e quais dados pedir <strong>nunca são decididos pela IA</strong> — são " +
                "fixos no código, em <code>REQUIRED_SLOTS</code> " +
                "(<code>agent-service/app/orchestrator.py</code>): plano, idade, ano do veículo, " +
                "CEP e data de início, nessa ordem. A cada mensagem do lead, o código escolhe o " +
                "<em>próximo</em> dado que falta e só pergunta esse — nunca a lista toda de uma vez.",
            },
            {
              tipo: "lista",
              itens: [
                "A pergunta do <strong>plano</strong> é um texto fixo com botões (chips: " +
                  "Essencial/Completo/Premium) — nunca é gerada pela IA, para garantir que bate " +
                  "exatamente com os planos que existem de verdade no quote-service.",
                "As demais perguntas (idade, ano do veículo, CEP, data de início) são fraseadas " +
                  "pelo Claude a cada vez (função <code>gerar_resposta</code> em <code>llm.py</code>), " +
                  "com instrução para variar a forma de perguntar — mas o <em>quê</em> perguntar e a " +
                  "<em>ordem</em> continuam sempre decididos pelo código, nunca pela IA.",
                "Na triagem de handoff (quando o lead pede atendente humano), a mesma lógica se " +
                  "aplica: primeiro o nome, depois o problema — sequência fixa em código, texto " +
                  "gerado pela IA.",
              ],
            },
            {
              tipo: "codigo",
              linguagem: "python",
              codigo:
                'REQUIRED_SLOTS = ["plano", "idade", "ano_veiculo", "cep", "data_inicio"]\n\n' +
                "def _proximo_slot_faltando(conv):\n" +
                "    for slot in REQUIRED_SLOTS:\n" +
                "        if slot not in conv.slots:\n" +
                "            return slot\n" +
                "    return None",
            },
            { tipo: "h2", id: "onde-respostas-sao-gravadas", titulo: "Onde as respostas são gravadas" },
            {
              tipo: "lista",
              itens: [
                "<strong>Em memória (dura enquanto o container estiver rodando):</strong> cada " +
                  "mensagem trocada fica em <code>Conversation.messages</code>; os dados já " +
                  "confirmados (plano, idade, etc.) ficam em <code>Conversation.slots</code>. " +
                  "Reinicia com o <code>agent-service</code> — não é um banco de dados.",
                "<strong>Log de auditoria (arquivo, sobrevive a reinícios):</strong> todo evento " +
                  "relevante — mensagem recebida, tentativa de cotação, handoff, resolução, " +
                  "avaliação — é gravado em uma linha de <code>agent-service/logs/events.jsonl</code>, " +
                  'no formato "append-only" (nunca apaga, só acrescenta). É a fonte de ' +
                  "rastreabilidade completa de uma conversa.",
                "<strong>Base de conhecimento (arquivo):</strong> as resoluções de atendentes " +
                  "aprovadas por um admin ficam em <code>agent-service/data/knowledge_base.json</code>, " +
                  "usada para o agente resolver sozinho casos parecidos no futuro.",
                "<strong>MongoDB (cifrado, sobrevive a reinício de container):</strong> toda vez que " +
                  "algo é gravado no log de eventos, uma cópia também vai para uma coleção no " +
                  "MongoDB — mas <strong>o conteúdo (payload) é cifrado antes de sair do processo do " +
                  "agent-service</strong>, com uma chave simétrica (Fernet/AES) que existe só na " +
                  "variável de ambiente <code>MONGO_ENCRYPTION_KEY</code>, nunca dentro do banco. Só " +
                  "<code>conversation_id</code>, <code>type</code> e <code>timestamp</code> ficam em texto " +
                  "puro (para dar para filtrar/consultar); o campo <code>payload_cifrado</code> é " +
                  "opaco para qualquer um que tenha só acesso de admin ao MongoDB. Se a chave não " +
                  "estiver configurada, a gravação no Mongo é desativada automaticamente — o agente " +
                  "nunca grava texto em claro lá.",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>agent-service/app/orchestrator.py</code> — máquina de estados e critério de handoff.",
                "<code>agent-service/app/llm.py</code> — extração estruturada e geração de texto.",
                "<code>agent-service/app/store.py</code> — armazenamento em memória e log de eventos.",
                "<code>agent-service/app/mongo_client.py</code> — persistência cifrada das interações no MongoDB.",
              ],
            },
          ],
        },
        {
          id: "base-de-conhecimento-e-anthropic",
          titulo: "Base de conhecimento e uso da Anthropic",
          atualizado: "26 de ago de 2026",
          blocos: [
            {
              tipo: "p",
              html:
                "Duas perguntas frequentes num artigo só: <strong>como e em que momento a base de " +
                "conhecimento é usada</strong>, e <strong>em que momento a Anthropic (Claude) é chamada</strong> " +
                "dentro da plataforma — e, tão importante quanto, em quais decisões ela " +
                "<strong>nunca</strong> é chamada.",
            },
            { tipo: "h2", id: "o-que-e-a-base-de-conhecimento", titulo: "O que é a base de conhecimento" },
            {
              tipo: "p",
              html:
                "Um arquivo JSON simples (<code>agent-service/data/knowledge_base.json</code>, gerido por " +
                "<code>knowledge_base.py</code>) com casos resolvidos por atendentes humanos: motivo, " +
                "tags, a solução em texto, e um sinalizador <code>aprovado</code>. Casamento é por " +
                "<strong>sobreposição de palavras-chave</strong> (tags do caso × palavras da mensagem do " +
                "lead) — MVP deliberado, sem embeddings; ver a nota sobre isso no artigo de Segurança.",
            },
            { tipo: "h2", id: "quando-e-consultada", titulo: "Quando ela é consultada" },
            {
              tipo: "p",
              html:
                "<strong>Só num momento específico:</strong> durante a triagem de handoff " +
                "(<code>_avancar_triagem_handoff</code> em <code>orchestrator.py</code>), depois que o " +
                "agente já sabe o <em>nome</em> do lead e acabou de receber a descrição do " +
                "<em>problema</em> — e <strong>antes</strong> de decidir se escala para um humano.",
            },
            {
              tipo: "lista",
              itens: [
                "<code>buscar_caso_similar(motivo, problema)</code> só considera entradas com " +
                  "<code>aprovado: true</code>, e só retorna um caso se o número de palavras em comum " +
                  "for <code>&gt;= MIN_OVERLAP_SCORE</code> (hoje 2).",
                "<strong>Achou um caso parecido:</strong> o agente resolve sozinho ali mesmo — gera a " +
                  "resposta usando a solução conhecida como fato (grounded), nunca escala, e registra o " +
                  "evento <code>kb_aplicado</code> com o id do caso e o score.",
                "<strong>Não achou nada com confiança suficiente:</strong> só então escala de verdade " +
                  "para um atendente humano (<code>_escalar_para_handoff</code>).",
                "Fora desse momento (coletando dados, cotação, fechamento etc.) a base de conhecimento " +
                  "não é consultada — não faz sentido buscar solução pra problema relatado quando ainda " +
                  "não há problema relatado nenhum.",
              ],
            },
            { tipo: "h2", id: "quando-e-alimentada", titulo: "Quando ela é alimentada" },
            {
              tipo: "p",
              html:
                "Um atendente pode registrar \"como resolveu\" em qualquer conversa, a qualquer momento " +
                "(painel do atendente, card \"Registrar resolução\") — não precisa ser exatamente durante " +
                "um handoff. Isso chama <code>registrar_resolucao_pendente</code>, que gera as tags " +
                "automaticamente a partir do motivo + problema (sem digitação manual) e grava a entrada " +
                "com <code>aprovado: false</code>.",
            },
            {
              tipo: "p",
              html:
                "Fica <strong>pendente até um admin aprovar</strong> (ou reprovar, o que remove a entrada " +
                "de vez) no painel Base de Conhecimento — só entradas aprovadas entram no casamento " +
                "acima. Esse degrau existe de propósito: evita que uma resolução ruim \"vire verdade\" " +
                "sozinha e o agente passe a repetir um conselho errado pra outros leads.",
            },
            { tipo: "h2", id: "quando-a-anthropic-e-usada", titulo: "Quando a Anthropic (Claude) é usada" },
            {
              tipo: "p",
              html:
                "Toda chamada à API da Anthropic passa por <code>agent-service/app/llm.py</code>, e só " +
                "existem duas funções: <code>extrair()</code> (dados estruturados, tool use forçado) e " +
                "<code>gerar_resposta()</code> (texto livre, mas sempre com fatos passados explicitamente " +
                "— nunca \"invente o que achar melhor\").",
            },
            {
              tipo: "lista",
              itens: [
                "<strong><code>extrair()</code> roda em <em>toda</em> mensagem do lead</strong>, sem " +
                  "exceção — é a primeira coisa que <code>handle_message()</code> faz. Extrai sinais " +
                  "(pedido de humano, fora de escopo, reclamação/sinistro, pedido de desconto, confiança " +
                  "da interpretação) e valores de slot (idade, CEP etc.) da mensagem, usando o histórico " +
                  "recente como contexto.",
                "<strong><code>gerar_resposta()</code> roda toda vez que o agente precisa escrever uma " +
                  "frase</strong> — a lista completa de situações: pedir o próximo dado que falta " +
                  "(idade/ano/CEP/data — nunca o plano, que é chip fixo), pedir correção de um dado " +
                  "inválido, explicar uma recusa de negócio (422), avisar que a cotação está instável " +
                  "(erro de infra), pedir nome e depois o problema na triagem de handoff, responder " +
                  "usando uma solução da base de conhecimento, avisar que vai encaminhar para humano, " +
                  "confirmar aceite ou recusa de uma cotação, responder quando não ficou claro o que o " +
                  "lead quis dizer sobre a cotação, se despedir após uma recusa de negócio aceita, " +
                  "responder mensagens que chegam com a conversa já fechada/em handoff/aguardando " +
                  "avaliação, e o agradecimento final elaborado depois da nota de 1 a 10.",
              ],
            },
            { tipo: "h2", id: "quando-nao-e-usada", titulo: "Quando ela NUNCA é usada" },
            {
              tipo: "p",
              html:
                "Tão importante quanto saber onde a IA fala é saber onde ela <strong>não decide nada</strong> " +
                "— essa separação é a decisão central do projeto:",
            },
            {
              tipo: "lista",
              itens: [
                "<strong>O preço da cotação</strong> — sempre um template Python direto do JSON do " +
                  "<code>quote-service</code> (<code>_apresentar_cotacao</code>), nunca escrito pelo LLM.",
                "<strong>Quais dados pedir e em que ordem</strong> — fixo em <code>REQUIRED_SLOTS</code>, " +
                  "código puro.",
                "<strong>Se escala para humano ou não</strong> — <code>_motivo_handoff</code> é uma " +
                  "função determinística; o LLM só sinaliza \"o lead parece estar pedindo isso\", quem " +
                  "decide é o código.",
                "<strong>Se repete a tentativa de cotação</strong> — retry/backoff em " +
                  "<code>quote_client.py</code>, sem nenhuma chamada à IA envolvida.",
                "<strong>Qual usuário pode acessar o quê</strong> — controle de acesso é " +
                  "<code>exigir_papel</code> no backend, código puro.",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>agent-service/app/knowledge_base.py</code> — matching por palavras-chave e o " +
                  "ciclo de aprovação.",
                "<code>agent-service/app/llm.py</code> — as duas únicas funções que chamam a Anthropic.",
                "<code>agent-service/app/orchestrator.py</code> — todo call site de " +
                  "<code>extrair()</code>/<code>gerar_resposta()</code>, com o contexto de cada um.",
                "Modelo do Claude e effort são configuráveis em Admin, sem precisar mexer em código — " +
                  "ver o artigo <strong>Como rodar a aplicação</strong>.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "produto-e-integracoes",
      titulo: "Produto e integrações",
      artigos: [
        {
          id: "whatsapp-vs-site",
          titulo: "WhatsApp Business vs. site: quando vale a pena",
          atualizado: "26 de ago de 2026",
          blocos: [
            {
              tipo: "p",
              html:
                "Por padrão, o lead conversa com o agente <strong>dentro do próprio site</strong> " +
                "(widget embutido, não é o WhatsApp de verdade) até sair a cotação. Só na hora de um " +
                "atendimento humano é que a plataforma decide se continua no site ou encaminha pro " +
                "WhatsApp Business real — e isso é <strong>configurável em Admin, sem mexer em código</strong> " +
                "(<code>handoff_mode</code>): <code>site</code>, <code>whatsapp</code> ou <code>misto</code>.",
            },
            { tipo: "h2", id: "vantagem-de-usar-o-whatsapp-real", titulo: "Vantagem de usar o WhatsApp Business real" },
            {
              tipo: "lista",
              itens: [
                "O lead continua a conversa no <strong>app que ele já usa no dia a dia</strong>, sem " +
                  "precisar manter a aba do site aberta — reduz o atrito de \"sumir\" no meio do " +
                  "atendimento.",
                "Para quem já confia mais no WhatsApp do que num chat de site desconhecido, pode " +
                  "aumentar a taxa de resposta/conversão.",
                "Abre caminho pra usar recursos nativos do WhatsApp Business (catálogo, mensagens de " +
                  "template aprovadas etc.) — nenhum desses está implementado neste projeto, mas o " +
                  "encaminhamento (<code>criarAreaHandoffWhatsapp</code> em <code>widget.js</code>) já " +
                  "deixa o caminho pronto pra isso no futuro.",
              ],
            },
            { tipo: "h2", id: "vantagem-de-nao-usar", titulo: "Vantagem de não usar (ficar só no site)" },
            {
              tipo: "lista",
              itens: [
                "<strong>Custo zero de WhatsApp Business Cloud API</strong> — a API oficial da Meta " +
                  "cobra por conversa iniciada (categorias diferentes de preço conforme o tipo de " +
                  "mensagem), então toda a etapa de qualificação e cotação — que é a maior parte do " +
                  "volume de mensagens — sai de graça acontecendo só no widget do site.",
                "Não precisa de <strong>verificação de negócio na Meta</strong> nem de manter um número " +
                  "comercial aprovado só pra essa etapa.",
                "Controle total da experiência (visual, comportamento, notificações) sem depender de " +
                  "política/rate limit de uma API de terceiro.",
                "Nenhuma dependência de infraestrutura externa da Meta para o caminho mais importante " +
                  "(cotar) — só o handoff humano, que é uma fração bem menor das conversas, toca o " +
                  "WhatsApp real.",
              ],
            },
            { tipo: "h2", id: "por-que-misto-existe", titulo: "Por que o modo \"misto\" existe" },
            {
              tipo: "p",
              html:
                "É o meio-termo: o lead <em>escolhe</em> continuar no site ou ir para o WhatsApp real " +
                "na hora do handoff. Serve pra medir na prática qual opção os leads preferem antes de " +
                "comprometer com uma das duas — e o custo de WhatsApp só existe para quem realmente " +
                "escolher essa opção, não para todo mundo.",
            },
            {
              tipo: "p",
              html:
                "Detalhe de proteção de custo: o botão que leva pro WhatsApp real fica atrás de uma " +
                "verificação \"não sou um robô\" (reCAPTCHA) — evita que um bot gere custo real de " +
                "WhatsApp Business API só clicando o botão repetidamente. Ver artigo " +
                "<strong>Segurança: o que foi implementado</strong>.",
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "Painel <strong>Configurações</strong> (admin) — onde <code>handoff_mode</code> e o " +
                  "número do WhatsApp Business são cadastrados.",
                "<code>web-ui/widget.js</code> — <code>criarAvisoAguardando</code> (modo site) e " +
                  "<code>criarAreaHandoffWhatsapp</code>/<code>criarGateSimulado</code> (modo whatsapp/misto).",
              ],
            },
          ],
        },
        {
          id: "trocar-provedor-de-ia",
          titulo: "Dá pra trocar a Anthropic por outra IA (ChatGPT, Gemini, DeepSeek)?",
          atualizado: "26 de ago de 2026",
          blocos: [
            {
              tipo: "p",
              html:
                "Pergunta direta: sim, dá pra trocar — mas primeiro uma correção importante de onde " +
                "isso se aplica, porque o nome \"base de conhecimento\" confunde.",
            },
            { tipo: "h2", id: "a-base-de-conhecimento-nao-usa-ia", titulo: "A base de conhecimento em si NÃO usa IA" },
            {
              tipo: "p",
              html:
                "<code>knowledge_base.py</code> casa casos por <strong>sobreposição de palavras-chave</strong> " +
                "— nenhuma chamada de IA acontece ali. Então \"trocar a IA da base de conhecimento\" não " +
                "se aplica hoje, porque não tem IA nenhuma para trocar nesse arquivo específico. Quem usa " +
                "IA de verdade é o <strong>agente</strong> (entender a mensagem do lead e escrever as " +
                "respostas) — é aí que a troca de provedor faria sentido.",
            },
            { tipo: "h2", id: "onde-a-ia-do-agente-fica-isolada", titulo: "Onde a IA do agente fica isolada" },
            {
              tipo: "p",
              html:
                "Toda chamada à Anthropic passa por <strong>um único arquivo</strong>: " +
                "<code>agent-service/app/llm.py</code>, com só duas funções (<code>extrair()</code> e " +
                "<code>gerar_resposta()</code>). Essa concentração foi decisão de design deliberada — " +
                "ver o artigo <strong>Base de conhecimento e uso da Anthropic</strong> — e é exatamente " +
                "o que torna a troca de provedor viável sem reescrever o projeto inteiro.",
            },
            { tipo: "h2", id: "o-que-mudaria", titulo: "O que mudaria" },
            {
              tipo: "lista",
              itens: [
                "<code>agent-service/app/llm.py</code> — trocar o cliente (SDK <code>anthropic</code> → " +
                  "<code>openai</code>, <code>google-generativeai</code>, SDK da DeepSeek etc.).",
                "A extração estruturada (<code>extrair()</code>) usa <em>tool use forçado</em> — cada " +
                  "provedor tem uma sintaxe própria pra isso (a Anthropic usa <code>tools</code> + " +
                  "<code>tool_choice</code>; OpenAI é parecido mas com schema diferente; Gemini usa " +
                  "<code>function_declarations</code>) — precisa reescrever essa parte especificamente " +
                  "pro formato do novo provedor.",
                "Tratamento de erro/retry específico do novo SDK (cada um tem suas próprias exceções).",
                "Variável de ambiente/config nova para a chave do novo provedor (mesmo padrão de " +
                  "<code>ANTHROPIC_API_KEY</code> hoje).",
              ],
            },
            { tipo: "h2", id: "o-que-nao-mudaria", titulo: "O que NÃO mudaria" },
            {
              tipo: "p",
              html:
                "Isso é o que faz a resposta ser \"simples\" e não \"reescrita\": <code>orchestrator.py</code> " +
                "inteiro (a máquina de estados, o critério de handoff, os slots), " +
                "<code>knowledge_base.py</code>, <code>quote_client.py</code>, todos os modelos de dados, " +
                "toda a API FastAPI e o frontend inteiro continuam <strong>exatamente iguais</strong> — " +
                "nenhum deles sabe (nem precisa saber) qual provedor de IA está por trás de " +
                "<code>llm.py</code>.",
            },
            { tipo: "h2", id: "qual-o-esforco-real", titulo: "Qual o esforço real" },
            {
              tipo: "lista",
              itens: [
                "<strong>Trocar de um provedor fixo para outro fixo</strong> (ex.: sair da Anthropic e " +
                  "ir só para OpenAI): esforço <strong>pequeno a médio</strong> — um arquivo concentra " +
                  "tudo, é um trabalho de um dia focado, não um projeto.",
                "<strong>Suportar vários provedores ao mesmo tempo</strong>, com o admin escolhendo qual " +
                  "usar (como já existe hoje pra escolher entre os modelos do Claude): esforço " +
                  "<strong>médio a grande</strong> — precisaria de uma camada de \"adapter\" (uma " +
                  "interface comum que cada provedor implementa à sua maneira) e de validar que o " +
                  "comportamento de extração/geração continua consistente entre provedores diferentes, " +
                  "já que cada modelo interpreta os mesmos prompts de um jeito ligeiramente diferente.",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>agent-service/app/llm.py</code> — onde a troca aconteceria.",
                "Artigo <strong>Base de conhecimento e uso da Anthropic</strong> — todos os call sites " +
                  "de <code>extrair()</code>/<code>gerar_resposta()</code> que continuariam funcionando " +
                  "iguais depois da troca.",
              ],
            },
          ],
        },
        {
          id: "potencial-da-plataforma",
          titulo: "Potencial da plataforma: múltiplos negócios e próximos passos",
          atualizado: "26 de ago de 2026",
          blocos: [
            {
              tipo: "p",
              html:
                "Resposta direta pra pergunta principal: <strong>dá pra adaptar pra outro negócio, mas " +
                "hoje não é \"trocar uma configuração\" — é um fork com esforço moderado</strong>. A " +
                "arquitetura já separa bem o que é genérico do que é específico de seguro de carro; o " +
                "que falta é <em>externalizar</em> essa parte específica pra virar configuração de " +
                "verdade. Este artigo mapeia os dois lados e fecha com sugestões de melhoria.",
            },
            { tipo: "h2", id: "o-que-ja-e-generico", titulo: "O que já é genérico (reaproveitável sem mudar nada)" },
            {
              tipo: "lista",
              itens: [
                "O <strong>padrão arquitetural</strong> em si — LLM só entende e fala, código decide " +
                  "tudo — não tem nada de específico de seguro. Qualquer negócio que qualifica um lead, " +
                  "consulta um sistema externo (preço, disponibilidade, elegibilidade) e decide entre " +
                  "resolver sozinho ou escalar pra humano se encaixa no mesmo desenho.",
                "Autenticação, perfis (admin/atendente), painel do atendente, relatórios com gráfico e " +
                  "filtros, sistema de fotos — nada disso menciona seguro em lugar nenhum.",
                "O <strong>loop de aprendizado</strong> da base de conhecimento (handoff → resolução → " +
                  "aprovação → consulta) é genérico — funciona pra qualquer tipo de dúvida recorrente, " +
                  "não só sinistro/apólice.",
                "A persistência cifrada no MongoDB, o widget de chat, o encaminhamento pro WhatsApp " +
                  "real, a documentação interna — toda a infraestrutura é agnóstica de domínio.",
              ],
            },
            { tipo: "h2", id: "o-que-e-especifico-da-autoseguro", titulo: "O que é específico da AutoSeguro (precisaria mudar)" },
            {
              tipo: "lista",
              itens: [
                "<code>REQUIRED_SLOTS</code> e <code>_NOMES_SLOT</code> em <code>orchestrator.py</code> " +
                  "— hoje é uma lista Python fixa (plano, idade, ano do veículo, CEP, data de início), " +
                  "não um dado configurável.",
                "<code>_PERGUNTA_PLANO</code>/<code>_OPCOES_PLANO</code> — texto e chips " +
                  "Essencial/Completo/Premium hardcoded.",
                "<code>quote_client.py</code> e <code>_apresentar_cotacao</code> — o formato do payload " +
                  "enviado e o texto do preço apresentado são moldados exatamente na resposta do " +
                  "<code>quote-service</code> deste desafio.",
                "O próprio <code>quote-service</code> — é 100% a lógica de precificação de seguro auto; " +
                  "pra outro negócio, seria <strong>substituído inteiro</strong> pela API de " +
                  "preço/elegibilidade daquele negócio.",
                "Gatilhos de handoff específicos (\"reclamação ou sinistro\", \"fora do escopo de seguro " +
                  "auto\") em <code>_motivo_handoff</code>.",
                "Marca \"AutoSeguro\" espalhada em vários arquivos do <code>web-ui</code> (nome, cores, " +
                  "textos da landing) — hoje não está centralizada num único lugar de branding.",
              ],
            },
            { tipo: "h2", id: "caminho-para-multi-negocio", titulo: "O caminho para virar multi-negócio de verdade" },
            {
              tipo: "p",
              html:
                "Pra um cliente novo <strong>hoje</strong>: forkar o repo, trocar o " +
                "<code>quote-service</code> pela API do negócio novo, reescrever " +
                "<code>REQUIRED_SLOTS</code>/opções de plano/template de preço, ajustar os gatilhos de " +
                "handoff e trocar a marca no <code>web-ui</code>. Esforço de dias, não de meses — porque " +
                "a máquina de estados, auth, relatórios e toda a infraestrutura continuam de pé.",
            },
            {
              tipo: "p",
              html:
                "Pra <strong>uma instalação só atender vários negócios ao mesmo tempo</strong> " +
                "(multi-tenant de verdade, escolhido por configuração): precisaria mover " +
                "<code>REQUIRED_SLOTS</code>, as opções de plano e o template de preço pra um arquivo de " +
                "configuração por \"tenant\" (mesmo padrão já usado em <code>config.py</code> pra " +
                "<code>handoff_mode</code>), tornar a URL do serviço de cotação configurável por tenant, " +
                "e parametrizar a marca (nome, cor, logo) do <code>web-ui</code>. É um passo de " +
                "engenharia real, não uma mudança pequena — mas a base já está desenhada de um jeito " +
                "que não exige reescrever o coração do sistema pra chegar lá.",
            },
            { tipo: "h2", id: "dicas-de-melhoria", titulo: "Dicas de melhoria e melhor aproveitamento" },
            {
              tipo: "lista",
              itens: [
                "<strong>Testes automatizados:</strong> já existem — 51 testes com <code>pytest</code> " +
                  "em <code>agent-service/tests/</code> (<code>cd agent-service &amp;&amp; uv run --group " +
                  "dev pytest</code>), cobrindo <code>_motivo_handoff</code>, validação de slots, o " +
                  "retry infra-vs-negócio, a base de conhecimento, hash de senha e os filtros dos " +
                  "relatórios — sem precisar de <code>ANTHROPIC_API_KEY</code>, Mongo nem " +
                  "<code>quote-service</code> rodando. Ainda faltam testes de integração ponta a ponta " +
                  "(via <code>TestClient</code> do FastAPI) e da camada de frontend.",
                "<strong>Base de conhecimento com embeddings</strong> em vez de palavras-chave — já " +
                  "documentado como próximo passo natural (ver artigo sobre a base de conhecimento), " +
                  "generaliza melhor pra paráfrases distantes.",
                "<strong>Fila de mensageria</strong> (RabbitMQ ou similar) se o volume real justificar — " +
                  "ver artigo de Segurança pra quando isso vale a pena.",
                "<strong>Persistir conversas ativas</strong>, não só o log de auditoria — hoje uma " +
                  "conversa em andamento se perde se o <code>agent-service</code> reiniciar no meio; " +
                  "mover <code>Conversation</code>/<code>Message</code> pro Mongo (decifrando sob " +
                  "demanda) resolveria isso.",
                "<strong>Configuração multi-negócio</strong> — externalizar slots/planos/template de " +
                  "preço como descrito acima, se o objetivo for reaproveitar a plataforma pra outros " +
                  "clientes.",
                "<strong>Auth de produção</strong> — 2FA, expiração de sessão, rate limit de tentativas " +
                  "de login (já listado em Segurança, reforçando aqui como prioridade se isso for além " +
                  "de um desafio técnico).",
                "<strong>Observabilidade técnica</strong> — hoje os relatórios medem atendimento humano " +
                  "(quem atendeu, nota), mas não há painel de saúde do próprio agente (taxa de " +
                  "<code>erro_infra</code> por hora, latência média do Claude, quantas conversas ficam " +
                  "presas em <code>aguardando_retry</code>) — útil pra saber se o sistema está saudável " +
                  "sem precisar ler o log bruto.",
                "<strong>Multi-canal</strong> — a mesma separação orchestrator/LLM que já atende site e " +
                  "WhatsApp poderia estender pra outros canais (Instagram, Telegram) sem tocar na lógica " +
                  "de negócio, só na camada de transporte.",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>README.md</code>, seção \"Próximos passos / limitações conhecidas\".",
                "Artigo <strong>Segurança: o que foi implementado</strong> — limitações conhecidas e a " +
                  "análise de RabbitMQ.",
                "Artigo <strong>Dá pra trocar a Anthropic por outra IA?</strong> — mesmo raciocínio de " +
                  "\"o que é genérico vs. o que é específico\", aplicado ao provedor de IA.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "seguranca",
      titulo: "Segurança",
      artigos: [
        {
          id: "seguranca-geral",
          titulo: "Segurança: o que foi implementado",
          atualizado: "26 de ago de 2026",
          aviso:
            "Este é um desafio técnico, não um sistema em produção real - a seção \"Limitações " +
            "conhecidas\" no fim deste artigo é tão importante quanto o resto: lista honestamente o " +
            "que NÃO foi feito e por quê.",
          blocos: [
            {
              tipo: "p",
              html:
                "Resumo de tudo que foi implementado para tornar o sistema mais seguro, o que evita o " +
                "problema de instabilidade da <code>/quote</code>, e uma avaliação de quando (se algum " +
                "dia) valeria a pena introduzir uma fila de mensageria como o RabbitMQ.",
            },
            { tipo: "h2", id: "senhas-e-autenticacao", titulo: "Senhas e autenticação" },
            {
              tipo: "lista",
              itens: [
                "Senha <strong>nunca fica em texto puro</strong>: cada usuário grava um hash salgado " +
                  "PBKDF2-HMAC-SHA256 (200 mil iterações) em <code>agent-service/app/auth.py</code>, " +
                  "comparado com <code>secrets.compare_digest</code> (evita timing attack).",
                "Cadastro de usuário é <strong>menu interno, só para admin</strong> — não existe " +
                  "autocadastro público; ninguém escolhe o próprio perfil sozinho.",
                "Sessão é um token opaco gerado com <code>secrets.token_hex</code>, guardado em memória " +
                  "no servidor (não é um JWT — não dá pra forjar nem decodificar do lado do cliente).",
              ],
            },
            { tipo: "h2", id: "controle-de-acesso", titulo: "Controle de acesso por perfil" },
            {
              tipo: "p",
              html:
                "O controle de verdade é <strong>sempre no backend</strong> — esconder um botão no " +
                "front é só conveniência de interface, nunca a barreira real:",
            },
            {
              tipo: "lista",
              itens: [
                "<code>exigir_papel(*papeis)</code> em <code>main.py</code> é uma dependency do FastAPI " +
                  "que roda em toda rota interna: sem token válido dá <strong>401</strong>, com token " +
                  "mas perfil errado dá <strong>403</strong> — verificado no servidor, não dá pra burlar " +
                  "editando o HTML.",
                "Rotas administrativas (criar usuário, aprovar base de conhecimento, salvar " +
                  "configuração) exigem <code>exigir_papel(\"admin\")</code> explicitamente.",
                "<code>_garantir_conversa_disponivel</code> impede um atendente mexer numa conversa que " +
                  "outro atendente já assumiu (evita dois atendentes atropelando o mesmo lead) — admin " +
                  "sempre pode.",
                "No frontend, cada página some com os links de Usuários/Configurações pra quem não é " +
                  "admin (<code>sessao.papel !== \"admin\"</code>) — reforço de UX, não é a barreira em si.",
              ],
            },
            { tipo: "h2", id: "dados-sensiveis", titulo: "Dados sensíveis: criptografia no MongoDB" },
            {
              tipo: "p",
              html:
                "Toda interação persistida no Mongo é cifrada <strong>do lado da aplicação</strong> " +
                "(Fernet/AES) antes de sair do processo do <code>agent-service</code>, com uma chave que " +
                "só existe na variável de ambiente — nunca no banco. Mesmo alguém com acesso de " +
                "admin/root ao MongoDB só vê ciphertext. Detalhes completos no artigo " +
                "<strong>De onde vêm as perguntas? E onde são gravadas as respostas?</strong>",
            },
            { tipo: "h2", id: "segredos-e-chaves", titulo: "Segredos e chaves de API" },
            {
              tipo: "lista",
              itens: [
                "<code>.env</code> real nunca é commitado (está no <code>.gitignore</code>); só o " +
                  "<code>.env.example</code>, sem valores reais, vai pro repositório público.",
                "<code>GET /config</code> <strong>nunca devolve o valor</strong> de uma chave secreta " +
                  "(Anthropic, WhatsApp, reCAPTCHA secret) — só um booleano <code>&lt;nome&gt;_configurada</code> " +
                  "(<code>config.py</code>, conjunto <code>_CHAVES_SECRETAS</code>). Deixar o campo em " +
                  "branco no Admin preserva o valor atual, nunca apaga sem querer.",
                "Fotos de usuário (data URI) são validadas por tipo e tamanho (até ~500KB) tanto no " +
                  "navegador quanto no backend, pra não virar vetor de payload gigante.",
              ],
            },
            { tipo: "h2", id: "verificacao-anti-bot", titulo: "Verificação \"não sou um robô\" antes do WhatsApp real" },
            {
              tipo: "p",
              html:
                "O botão que encaminha pro WhatsApp Business de verdade fica atrás de um gate reCAPTCHA " +
                "v2 (real, se configurado em Admin, ou uma simulação visual em modo demonstração) — " +
                "evita bot gerando custo real de WhatsApp Business API. O widget do site (onde o lead " +
                "conversa até a cotação) nunca passa por esse gate — só o encaminhamento final.",
            },
            { tipo: "h2", id: "validacao-de-entrada", titulo: "Validação de entrada" },
            {
              tipo: "p",
              html:
                "Todo corpo de requisição da API passa por modelos <strong>Pydantic</strong> (tipo, " +
                "formato, obrigatoriedade) antes de chegar em qualquer lógica de negócio — requisição " +
                "malformada nunca chega no orchestrator.",
            },
            { tipo: "h2", id: "o-que-evita-o-problema-da-quote", titulo: "O que evita o problema da instabilidade da /quote" },
            {
              tipo: "p",
              html:
                "O <code>quote-service</code> falha e demora de propósito (é o desafio). O que protege o " +
                "sistema — e principalmente o <strong>lead</strong> — dessa instabilidade:",
            },
            {
              tipo: "lista",
              itens: [
                "<strong>Nunca inventa preço:</strong> o valor mostrado é sempre montado por template " +
                  "Python direto do JSON devolvido pela <code>/quote</code>, nunca escrito pelo LLM — " +
                  "mesmo se o Claude alucinar, o preço exibido não pode estar errado.",
                "<strong>Só repete em falha de infra:</strong> timeout/erro de conexão/5xx entram em " +
                  "retry com backoff exponencial (até <code>QUOTE_MAX_ATTEMPTS</code>); recusa de negócio " +
                  "(422) e payload inválido (400) <em>nunca</em> são repetidos, porque repetir não muda " +
                  "o resultado — só atrasaria uma resposta que já é definitiva.",
                "<strong>Transparência com o lead:</strong> se esgotar as tentativas, o agente avisa que " +
                  "o sistema está instável em vez de travar ou fingir que deu certo.",
                "Detalhes completos (com o código) no artigo <strong>Como rodar a aplicação</strong> e no " +
                  "<code>README.md</code>, seção \"O que ele faz quando a /quote falha\".",
              ],
            },
            { tipo: "h2", id: "fila-rabbitmq", titulo: "Fila de mensageria (RabbitMQ) — vale a pena?" },
            {
              tipo: "p",
              html:
                "Não para este projeto, na escala atual — e essa foi uma decisão deliberada, não uma " +
                "omissão. Hoje o retry da cotação acontece <strong>dentro do próprio request HTTP</strong> " +
                "do lead: o agente tenta, espera o backoff, tenta de novo, tudo antes de responder. Numa " +
                "fila mudaria pra: publicar um job de cotação, responder o lead na hora (\"já te aviso\"), " +
                "e um worker separado cuida do retry e escreve a resposta quando tiver.",
            },
            {
              tipo: "lista",
              itens: [
                "<strong>Quando valeria a pena:</strong> volume real (muitos leads simultâneos batendo " +
                  "no <code>quote-service</code> ao mesmo tempo), necessidade de desacoplar a latência " +
                  "do lead do tempo de retry, ou querer um <em>dead-letter</em> automático — transformar " +
                  "\"falhou depois de todas as tentativas\" em handoff pra humano sem depender da próxima " +
                  "mensagem do lead pra tentar de novo (hoje isso não existe: veja a limitação em " +
                  "<code>aguardando_retry</code> no artigo sobre a <code>/quote</code>).",
                "<strong>O custo de introduzir agora:</strong> mais um serviço no <code>docker-compose.yml</code>, " +
                  "mais um ponto de falha pra monitorar, e o fluxo vira assíncrono — o widget já faz " +
                  "polling a cada 4s (encaixaria bem), mas ainda é complexidade real pra uma escala que " +
                  "hoje é um único <code>quote-service</code> mock.",
                "<strong>Conclusão:</strong> arquitetura atual já separa corretamente infra-vs-negócio e " +
                  "nunca inventa preço — isso resolve o requisito do desafio. RabbitMQ (ou similar) é o " +
                  "passo natural de evolução se isso um dia virar produção com volume de verdade, não " +
                  "algo que este projeto precisa hoje.",
              ],
            },
            { tipo: "h2", id: "limitacoes-conhecidas", titulo: "Limitações conhecidas (honestidade, não descuido)" },
            {
              tipo: "lista",
              itens: [
                "<strong>CORS liberado (<code>allow_origins=[\"*\"]</code>)</strong> em " +
                  "<code>agent-service/app/main.py</code> — aceitável pra um desafio local, não é assim " +
                  "que deveria ficar em produção (restringir aos domínios reais do front-end).",
                "<strong>Sem 2FA, sem expiração de sessão, sem rate limit de tentativas de login</strong> " +
                  "— autenticação suficiente pra restringir o painel interno neste desafio, não é auth " +
                  "de produção.",
                "<strong>MongoDB exposto na porta 27017</strong> no <code>docker-compose.yml</code> — só " +
                  "para inspeção local (<code>mongosh</code>, Compass), documentado no próprio arquivo " +
                  "que isso não deveria acontecer assim em produção.",
                "<strong>Sem rate limiting</strong> na API do agente — nada impede alguém de mandar " +
                  "mensagens em loop (custaria créditos da Anthropic de verdade).",
              ],
            },
            { tipo: "h2", id: "saiba-mais", titulo: "Saiba mais" },
            {
              tipo: "lista",
              itens: [
                "<code>agent-service/app/auth.py</code> — hash de senha e sessão.",
                "<code>agent-service/app/mongo_client.py</code> — criptografia das interações.",
                "<code>agent-service/app/quote_client.py</code> — retry/backoff e classificação de falha.",
                "<code>README.md</code>, seção \"Próximos passos / limitações conhecidas\".",
              ],
            },
          ],
        },
      ],
    },
  ],
};
