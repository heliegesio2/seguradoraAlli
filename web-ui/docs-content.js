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
      ],
    },
  ],
};
