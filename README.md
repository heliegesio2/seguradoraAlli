# AutoSeguro — agente de vendas via WhatsApp

Desafio técnico (FDE / AI Engineer — Namastex). Cenário: a "AutoSeguro" atende leads
por WhatsApp e vende seguro de veículo. Este repo entrega um **agente** que conversa,
qualifica os dados do lead, cota um plano na API de cotação (`quote-service/`, insumo do
desafio) e decide entre resolver sozinho ou encaminhar para um humano — sem travar nem
inventar preço quando a infraestrutura falha.

O desafio original está em [`CHALLENGE.md`](CHALLENGE.md) (não alterado). Este README
documenta como rodar e **as decisões de engenharia tomadas — e por quê**.

## Como rodar

### Com Docker (recomendado)

```bash
cp .env.example .env
# edite o .env: cole sua ANTHROPIC_API_KEY (https://console.anthropic.com/)
# gere uma MONGO_ENCRYPTION_KEY (comando sugerido dentro do próprio .env.example)

docker compose up --build
```

| Serviço | URL | O que é |
|---|---|---|
| `web-ui` | http://localhost:3000 | Site da AutoSeguro (landing + widget de chat) e painel interno |
| `agent-service` | http://localhost:8001 | API do agente (FastAPI) |
| `quote-api` | http://localhost:8000 | API de cotação (insumo do desafio, não modificada) |
| `mongo` | localhost:27017 | Persistência cifrada das interações (só para inspeção local — ver [Dados sensíveis](#5-dados-sensíveis-mongodb-com-criptografia-do-lado-da-aplicação)) |

Painel interno (atendente/admin): abra http://localhost:3000/login.html.
Usuários de teste (semente inicial, ver [Autenticação](#7-autenticação-perfis-e-fotos)):
`admin` / `admin123` e `atendente` / `atendente123`.

### Sem Docker

```bash
cd quote-service && uv run uvicorn app.main:app --port 8000
cd agent-service && uv run uvicorn app.main:app --port 8001   # precisa ANTHROPIC_API_KEY no ambiente
# servir web-ui: qualquer servidor estático, ex. `python -m http.server 3000` dentro de web-ui/
```

Sem MongoDB configurado, o agente funciona normalmente — a persistência cifrada só fica
desativada (ver [Dados sensíveis](#5-dados-sensíveis-mongodb-com-criptografia-do-lado-da-aplicação)).

### Simulando falha de infraestrutura

O `quote-service` já simula instabilidade de propósito (`QUOTE_FAILURE_RATE` /
`QUOTE_SLOW_RATE` / `QUOTE_SLOW_SECONDS` em `docker-compose.yml`). Para forçar falha
sempre e ver o retry/backoff na prática, edite `QUOTE_FAILURE_RATE: "1.0"` em
`docker-compose.yml` (serviço `quote-api`) e recrie só esse serviço:

```bash
docker compose up -d quote-api
```

Volte para `"0.20"` depois para testar o caminho feliz de novo.

## Arquitetura

```
lead (navegador, web-ui) --HTTP--> agent-service (FastAPI)
atendente/admin (painel)  --HTTP-->      |
                                          |-- Claude API (NLU + geração de texto)
                                          |-- quote-service (FastAPI mock, instável de propósito)
                                          |-- data/knowledge_base.json (base de conhecimento)
                                          |-- data/usuarios.json (usuários, senha com hash)
                                          |-- logs/events.jsonl (rastreabilidade local, em claro)
                                          |-- MongoDB (rastreabilidade persistente, CIFRADA)
```

`web-ui/` é HTML/CSS/JS puro (sem build step): a landing page com o widget de chat
embutido (estilo WhatsApp, mas conversando direto com o `agent-service`) e um painel
interno (`atendente.html` + páginas satélite: `admin.html`, `usuarios.html`,
`relatorios.html`, `docs.html`, `meus-dados.html`) para quem atende.

## Decisões de engenharia

### 1. LLM só fala/entende, código decide

A decisão central do projeto: o Claude **nunca decide nada de negócio** — ele só (a)
extrai dados estruturados da mensagem do lead via tool use forçado e (b) gera o texto
das respostas. Tudo que é decisão (quais dados faltam, qual pergunta fazer a seguir,
quando cotar, quando repetir uma tentativa, quando escalar para humano) é **código
determinístico** em `agent-service/app/orchestrator.py`. Isso é o que permite responder
com confiança as duas perguntas mais importantes da avaliação do desafio (abaixo) sem
depender do LLM "se comportar bem".

A ordem das perguntas também é fixa em código (`REQUIRED_SLOTS` em `models.py`: plano,
idade, ano do veículo, CEP, data de início) — o agente pergunta **um dado por vez**,
nunca a lista toda; só a *frase* de cada pergunta varia (gerada pelo Claude, com
instrução para soar natural em vez de repetir sempre o mesmo texto). A pergunta do
plano é sempre um template fixo com botões (chips: Essencial/Completo/Premium), nunca
gerada pelo LLM, para garantir que bate exatamente com os planos que existem de verdade
no `quote-service`.

### 2. O que ele faz quando a `/quote` falha

`agent-service/app/quote_client.py` distingue três casos pelo status HTTP:

- **422 (recusa de negócio)** — a política de subscrição do `quote-service` recusou
  (ex.: idade ou ano do veículo fora da faixa aceita). **Nunca é repetido** — é
  definitivo, tentar de novo com os mesmos dados não muda o resultado. O lead recebe
  uma explicação honesta e a opção de falar com um atendente para verificar exceções.
- **400 (payload inválido)** — bug nosso, não do lead. Também não repete; vai direto
  para handoff, sem passar pela triagem normal (não faz sentido perguntar "qual seu
  problema" para um bug interno).
- **Timeout / erro de conexão / 5xx (infra)** — só esse caso entra em **retry com
  backoff exponencial** (`QUOTE_MAX_ATTEMPTS`, padrão 3 tentativas). Se esgotar as
  tentativas, a conversa vai para o estado `aguardando_retry` e o agente avisa o lead
  com transparência ("sistema instável, vou tentar de novo") — **sem nunca inventar um
  preço**. A próxima mensagem do lead dispara uma nova rodada de tentativas.

O preço apresentado (`_apresentar_cotacao` em `orchestrator.py`) é **sempre montado por
template Python direto do JSON devolvido pelo `quote-service`, nunca escrito pelo
LLM** — isso é o que garante que o agente nunca alucina um valor, mesmo em cima de uma
falha parcial ou de um modelo que erre.

> Limitação conhecida: `aguardando_retry` hoje não tem teto entre *rodadas* — se o
> `quote-service` ficar fora do ar por muito tempo, o agente retenta a cada nova
> mensagem do lead indefinidamente, sem escalar sozinho para um humano. Numa versão de
> produção com volume real, isso pediria uma fila (ex. RabbitMQ) com dead-letter para
> transformar "falhou depois de todas as tentativas" em handoff automático — ver
> [Próximos passos](#próximos-passos--limitações-conhecidas).

### 3. Critério de handoff explícito e defensável

Função `_motivo_handoff` em `orchestrator.py`, testável isoladamente, dispara escalonamento quando:

1. O lead pede atendimento humano explicitamente;
2. A mensagem está fora do escopo de seguro auto;
3. Há reclamação ou sinistro relatado;
4. O lead pede desconto/negociação de preço fora da tabela;
5. Três mensagens seguidas não foram compreendidas com confiança (`MISUNDERSTANDING_LIMIT`).

Antes de escalar de verdade, o agente entra em **triagem** (`triagem_handoff`): pede o
nome do lead, depois pede para descrever o problema, e **consulta a base de
conhecimento** com esse problema — se já existe uma solução aprovada parecida, o agente
resolve sozinho ali mesmo e nunca chega a escalar. Só encaminha para humano se a base
não tiver nada aplicável.

### 4. Rastreabilidade

Toda ocorrência relevante (mensagem recebida/enviada, tentativa de cotação com id e
status, decisão de handoff, resolução humana, avaliação) é registrada como um evento
com id próprio, timestamp e payload — tanto no log local (`agent-service/logs/events.jsonl`,
append-only) quanto no MongoDB (ver a seguir). O painel do atendente também expõe isso
ao vivo: dados coletados, cada tentativa de cotação (id/status/latência) e o histórico
completo da conversa.

### 5. Dados sensíveis: MongoDB com criptografia do lado da aplicação

O dataset do desafio já avisa para cuidar de dados sensíveis. Fui além do log local e
adicionei MongoDB (`docker-compose.yml`, serviço `mongo`) como persistência que
sobrevive a reinício de container — mas com um requisito extra: **mesmo alguém com
acesso de admin/root ao banco não pode ler o conteúdo das interações**.

"Encryption at rest" nativo do banco não resolveria isso — um admin logado via
`mongosh`/Compass ainda veria os dados decifrados pelo próprio servidor. Por isso a
cifra é **client-side**: `agent-service/app/mongo_client.py` cifra o `payload` inteiro
de cada evento com Fernet (AES simétrico autenticado) **antes de sair do processo do
agent-service**, usando uma chave (`MONGO_ENCRYPTION_KEY`) que só existe na variável de
ambiente do próprio serviço, nunca no banco. Só `conversation_id`, `type` e `timestamp`
ficam em texto puro no documento (metadados não sensíveis, úteis para filtrar); o campo
`payload_cifrado` é opaco para qualquer um com só acesso ao Mongo.

Design defensivo: sem `MONGO_ENCRYPTION_KEY` válida a gravação no Mongo **desativa
sozinha** (nunca grava em claro por engano); se o Mongo cair, a gravação falha
silenciosamente (só loga um aviso) sem afetar a resposta ao lead — é persistência de
melhor esforço, o mesmo princípio de resiliência aplicado ao `quote-service`.

### 6. Base de conhecimento com loop de aprendizado

`agent-service/app/knowledge_base.py` — JSON simples com casamento por sobreposição de
palavras-chave (MVP deliberado; trocar por embeddings é o passo óbvio de evolução).
Resoluções registradas por um atendente entram como pendentes (`aprovado: false`) até
um admin aprovar pelo painel — isso evita que uma solução ruim "vire verdade" sozinha.
Uma vez aprovada, entra no casamento por palavras-chave e o agente passa a resolver
casos parecidos sem precisar escalar.

### 7. Autenticação, perfis e fotos

Login simples com sessão em memória (token opaco) — deliberadamente não é auth de
produção (sem 2FA, sem expiração, sem rate limit de tentativas), mas cadastro e senha
são levados a sério: cada usuário tem hash salgado PBKDF2-HMAC-SHA256 (200 mil
iterações) em `data/usuarios.json`, nunca a senha em claro. Criar usuário é um **menu
interno, só para admin** (`usuarios.html`) — não existe autocadastro público; quem
cadastra escolhe o perfil (`admin` ou `atendente`) de quem está sendo criado. Qualquer
pessoa logada pode trocar a própria foto em "Meus dados" (`meus-dados.html`), guardada
como imagem (data URI, até ~500KB) direto no próprio registro do usuário — sem storage
externo.

### 8. Chat embutido no site vs. WhatsApp real (custo controlado)

O lead conversa num widget embutido no próprio site (`web-ui/widget.js`), não no
WhatsApp de verdade — assim a conversa inteira até a cotação não gera nenhum custo de
WhatsApp Business API. Só quando o agente decide escalar para humano é que o modo
configurado em Admin entra em jogo: `site` (padrão — o atendimento continua dentro do
próprio chat, um atendente assume via painel), `whatsapp` (encaminha para o número real
via `wa.me`) ou `misto` (o lead escolhe). O botão que leva ao WhatsApp real fica atrás
de uma verificação "não sou um robô" (reCAPTCHA v2 real se configurado em Admin, ou uma
simulação visual quando não há chave — evita bot gerando custo real de WhatsApp Business
API mesmo em modo de demonstração).

### 9. Documentação viva

`web-ui/docs.html` é uma página de documentação interna (layout inspirado nos docs de
API da Meta: árvore de artigos + índice "nesta página" com scroll-spy) que explica, para
quem for avaliar, exatamente de onde vêm as perguntas do agente e onde cada resposta
fica gravada — é a resposta oficial em produto, não só em texto solto, para uma das
perguntas centrais do desafio.

### 10. Relatórios com filtros e gráfico

`relatorios.html` — atendimentos humanos filtráveis por período, faixa de nota e nome
do atendente (todos combináveis), com um gráfico de atendimentos por dia (SVG desenhado
à mão, sem biblioteca externa, consistente com o resto do projeto) e rankings de quem
mais atendeu / melhores notas, cada um com o avatar do atendente.

## Próximos passos / limitações conhecidas

- **Estado da conversa é em memória** (`agent-service/app/store.py`) — reinicia com o
  container. O MongoDB guarda o **histórico cifrado** de tudo que aconteceu (auditoria
  sobrevive), mas não re-hidrata conversas em andamento após um restart; isso exigiria
  mover `Conversation`/`Message` para o próprio Mongo (decifrando sob demanda), não só
  logar eventos.
- **Sem fila de mensageria.** Hoje o retry da cotação acontece dentro do próprio
  request HTTP do lead (bloqueia a resposta pelo tempo do backoff). Em volume real, uma
  fila (RabbitMQ ou similar) desacoplaria essa latência e daria um dead-letter natural
  para escalar automaticamente para humano depois de esgotar as tentativas — avaliado
  nesta sessão e adiado deliberadamente por ser prematuro para a escala do desafio (um
  único `quote-service` mock).
- **Base de conhecimento por palavras-chave**, não embeddings — suficiente para o MVP,
  mas não generaliza para paráfrases distantes.
- **Auth não é de produção**: sem 2FA, sem expiração de sessão, sem rate limit de
  tentativas de login.

## Estrutura do repo

```
agent-service/   API do agente (FastAPI) - orchestrator, LLM, cliente de cotação,
                 auth, relatórios, persistência (JSONL + Mongo cifrado)
quote-service/   API de cotação (insumo do desafio, não modificada)
web-ui/          Site + painel interno, HTML/CSS/JS puro (sem build step)
dataset/         Histórico de conversas sintéticas (insumo do desafio)
docs/            Fluxograma do agente (docs/fluxograma-agente.drawio)
scripts/         generate_dataset.py (insumo do desafio)
ai-logs/         Conversas com IA usadas neste desafio (transparência - ver CHALLENGE.md)
CHALLENGE.md     Enunciado original do desafio (não alterado)
CLAUDE.md        Notas de continuidade do projeto para sessões de IA futuras
```

## Roteiro rápido para testar de ponta a ponta

1. Abra http://localhost:3000, clique no botão de chat e informe plano, idade, ano do
   veículo, CEP e data de início válidos — a cotação sai no fim, com preço vindo direto
   do `quote-service`.
2. Force falha de infra (`QUOTE_FAILURE_RATE=1`, ver acima) e repita — o agente avisa
   que está instável, tenta de novo automaticamente, sem inventar preço.
3. Dê uma idade fora da faixa aceita (ver `GET /planos` no `quote-service`) — recusa de
   negócio, sem retry, com explicação clara.
4. Peça "falar com atendente" ou relate um sinistro — o agente pede nome e problema,
   confere a base de conhecimento e só então escala.
5. Entre em http://localhost:3000/login.html como `admin`/`admin123`, assuma o
   atendimento no painel, finalize e veja o lead ser convidado a avaliar de 1 a 10.
6. No painel, registre como o caso foi resolvido, aprove na Base de conhecimento e
   inicie uma conversa nova com problema parecido — o agente resolve sozinho.
7. Confira `agent-service/logs/events.jsonl` (ou o MongoDB, cifrado) para a
   rastreabilidade completa dessa conversa.

## Transparência de uso de IA

Este projeto foi construído com Claude Code de ponta a ponta. As conversas ficam em
`ai-logs/` (ver [`CHALLENGE.md`](CHALLENGE.md#transparência-de-uso-de-ia-obrigatório) para
o formato exigido) — segredos removidos antes do commit.
