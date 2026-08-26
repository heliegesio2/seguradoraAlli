# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto (leia antes de fazer qualquer coisa)

Este é um desafio técnico (take-home) para uma vaga de Forward Deployed Engineer / AI
Engineer na **Namastex** (repo original do desafio:
https://github.com/namastexlabs/namastex-fde-challenge, copiado como `CHALLENGE.md`
neste repo). Cenário: uma seguradora fictícia "AutoSeguro" cujo time de vendas atende
leads por WhatsApp. A missão é construir um **agente** que conversa, qualifica, cota
um plano via API de cotação, e decide entre resolver sozinho ou encaminhar para um
humano — sem travar nem inventar preço quando a infraestrutura falha.

O usuário está no controle do ritmo: ele briefa em etapas e só quer que eu avance
quando ele mandar explicitamente. **Commits e pushes no git já estão autorizados sem
precisar perguntar** (branch `main`, repo público
`https://github.com/heliegesio2/seguradoraAlli`). Ações destrutivas (force-push,
reset --hard, reiniciar/desligar a máquina) ainda exigem confirmação — só reiniciei o
Windows uma vez porque o usuário confirmou explicitamente.

## Estado atual (2026-08-25) — o que já foi feito

1. **`docs/fluxograma-agente.drawio`** — fluxograma completo do agente (abrir no
   draw.io). Cobre: recepção da mensagem → NLU → gate de handoff (pedido explícito |
   fora de escopo | reclamação/sinistro | pedido de desconto | 3+ falhas de
   compreensão) → consulta à base de conhecimento antes de escalar → qualificação de
   dados → validação → chamada da `/quote` com retry/backoff → **distinção entre erro
   de infra (retry) e recusa de negócio 422 (não repete, é definitivo)** → apresentação
   da cotação → reação do lead (fechado/perdido) → loop de aprendizado (atendente
   resolve handoff → registro pendente → aprovação → entra na base de conhecimento).

2. **Insumos do desafio importados**: `quote-service/` (API mock FastAPI, já pronta,
   não deve ser modificada — ela simula instabilidade de propósito via
   `QUOTE_FAILURE_RATE`/`QUOTE_SLOW_RATE`/`QUOTE_SLOW_SECONDS`), `dataset/` (parquet +
   dicionário de ~2500 conversas sintéticas), `scripts/generate_dataset.py`,
   `docker-compose.yml`. O README original do desafio virou `CHALLENGE.md` (não mexer
   nele; é referência).

3. **`agent-service/`** (FastAPI, Python) — o agente propriamente dito. Arquitetura
   híbrida deliberada: **o LLM (Claude) só faz duas coisas** — extrair dados
   estruturados da mensagem do lead (tool use forçado) e gerar texto natural para
   responder — e **todo o resto é código determinístico** em `orchestrator.py`:
   completude de dados, validação de formato, retry/backoff da cotação, classificação
   infra-vs-negócio, critério de handoff, consulta e uso da base de conhecimento.
   - `app/models.py` — `Conversation`, `Message`, `QuoteAttempt`, máquina de estados
     (`Status`: coletando_dados, aguardando_retry, cotado, recusa_negocio, handoff,
     fechado, perdido, perdido_recusa).
   - `app/store.py` — conversas em memória (reinicia com o container) + log de
     eventos append-only em `logs/events.jsonl` (cada evento com id, timestamp,
     tipo, payload) — é a fonte de rastreabilidade.
   - `app/quote_client.py` — chama o `quote-service`, distingue `sucesso` /
     `erro_infra` (retry com backoff exponencial, até `QUOTE_MAX_ATTEMPTS`) /
     `recusa_negocio` (422, nunca repete) / `payload_invalido` (400, bug nosso).
   - `app/knowledge_base.py` — JSON simples (`data/knowledge_base.json`) com
     casamento por sobreposição de palavras-chave (MVP deliberado, documentar como
     "trocar por embeddings" no README). Resoluções humanas entram como
     `aprovado: false` até alguém aprovar — evita "aprender" solução ruim.
   - `app/llm.py` — cliente Anthropic. Modelo default `claude-opus-5` (env
     `CLAUDE_MODEL`), effort default `low` (env `CLAUDE_EFFORT`). Duas funções:
     `extrair()` (tool use forçado) e `gerar_resposta()` (texto livre, mas sempre
     grounded em fatos passados explicitamente).
   - `app/orchestrator.py` — o coração: `handle_message()` implementa o fluxograma.
     **Decisão de design crítica**: o preço da cotação (`_apresentar_cotacao`) é
     **sempre montado por template Python direto do JSON do quote-service, nunca
     escrito pelo LLM** — isso é o que garante "nunca inventar preço" mesmo se o
     modelo alucinar.
   - `app/main.py` — endpoints: `POST /conversations`, `POST
     /conversations/{id}/messages`, `GET /conversations/{id}`, `POST
     /conversations/{id}/resolve-handoff` (simula atendente humano resolvendo),
     `GET /knowledge-base`, `POST /knowledge-base/{id}/approve`.

4. **`web-ui/`** — tela de chat estilo WhatsApp, HTML/CSS/JS puro (sem build step),
   Material Design 3 (tokens de cor com suporte a light/dark). Painel lateral de
   rastreamento (status, dados coletados, tentativas de cotação com id/status/latência)
   e um formulário inline para simular o atendente resolvendo um handoff (alimenta o
   ciclo de aprendizado da base de conhecimento, visível na mesma tela).

5. **`docker-compose.yml`** — liga `quote-api` (porta 8000) + `agent-service` (porta
   8001) + `web-ui` (porta 3000, nginx servindo estático). `.env.example` na raiz com
   `ANTHROPIC_API_KEY` (placeholder — nunca commitar a chave real).

### ⚠️ Incidente de segurança (resolvido, mas fique atento)

Em algum momento, um `Write` para `.env.example` resultou em um arquivo `.env.txt`
com conteúdo de **outro projeto completamente diferente** (uma `DATABASE_URL` de
Postgres e o que parecia ser uma chave real da Anthropic, projeto "mercadinho"). Foi
pego antes de commitar, movido para a scratchpad (não deletado) e o arquivo correto
foi reescrito e verificado. **Lição**: sempre releia (`Read`/`Get-Content`) qualquer
arquivo `.env*` logo depois de escrevê-lo, antes de `git add`, para confirmar que o
conteúdo é o esperado.

## Ambiente local (o que foi instalado nesta máquina)

- **Python 3.12.10** instalado via `winget install --id Python.Python.3.12` (o
  `python.exe` que já existia era só o stub da Microsoft Store, não funcional).
- **uv 0.12.5** instalado via `winget install --id astral-sh.uv`.
- **Docker Desktop 4.88.1** instalado via `winget install --id Docker.DockerDesktop`.
  WSL2 e Virtual Machine Platform já estavam habilitados no Windows, mas ficou
  **reboot pendente** — o Windows foi reiniciado a pedido do usuário para finalizar
  a ativação. **Depois do reboot, a primeira coisa a fazer é verificar se o Docker
  subiu**: `docker --version` e `docker compose version`. Se o Docker Desktop não
  abrir sozinho, pode precisar iniciar manualmente (procurar "Docker Desktop" no
  menu iniciar) na primeira vez, e aceitar o EULA/termos na janela do app.
- Não havia Docker nem Python funcionais antes desta sessão — nada foi testado
  rodando de verdade ainda (só revisão manual do código).

## Como testar depois do reboot

1. Confirmar Docker: `docker --version && docker compose version`.
2. Criar `.env` na raiz do repo (copiar de `.env.example`) com uma
   `ANTHROPIC_API_KEY` válida — perguntar ao usuário se ele tem uma, ou pedir para
   ele criar em https://console.anthropic.com/. **Nunca commitar o `.env` real.**
3. Subir tudo: `docker compose up --build` (na raiz `C:\entrevista`).
4. Testar caminho feliz: abrir `http://localhost:3000` no navegador, conversar como
   um lead (dar plano, idade, ano do veículo, CEP, data de início válidos) e
   verificar que a cotação sai certa e o painel de rastreamento mostra os dados.
5. Testar falha de infra: subir com `QUOTE_FAILURE_RATE=1` temporariamente (editar
   `docker-compose.yml` ou passar via `docker compose run -e QUOTE_FAILURE_RATE=1`)
   para forçar retry/backoff e depois o estado `aguardando_retry`.
6. Testar recusa de negócio: dar idade > 75 ou veículo com mais de 20 anos.
7. Testar handoff: pedir atendimento humano explicitamente, ou reclamar de sinistro.
8. Testar o ciclo de aprendizado: no painel, com a conversa em handoff, preencher
   "como o atendente resolveu" e aprovar a entrada na base; iniciar nova conversa
   com problema parecido e confirmar que o agente resolve sozinho.
9. Capturar um log completo de uma conversa (é entregável obrigatório do desafio) —
   pode ser o `agent-service/logs/events.jsonl` de uma sessão completa, ou um
   print/gravação da UI.

## O que falta (entregáveis do desafio ainda pendentes)

- **`README.md`** do projeto (raiz) explicando como rodar e as decisões de
  engenharia tomadas (e por quê) — ainda não escrito. Usar como base as decisões
  documentadas aqui e no fluxograma.
- **Log de uma execução completa** (conversa do início ao fim com cotação saindo) —
  depende de rodar de verdade primeiro.
- **`ai-logs/`** — exportar as conversas com IA usadas neste desafio (sessões do
  Claude Code ficam em `~/.claude/projects/<slug>/*.jsonl`). Tirar segredos antes de
  commitar (repo é público).
- Testar de fato via Docker (só foi revisado manualmente até agora).

## Comandos úteis

```bash
# Subir tudo via Docker (recomendado)
docker compose up --build

# Alternativa sem Docker (usa uv, já instalado)
cd quote-service && uv run uvicorn app.main:app --port 8000
cd agent-service && uv run uvicorn app.main:app --port 8001   # precisa ANTHROPIC_API_KEY no ambiente
# servir web-ui: qualquer servidor estatico, ex. `python -m http.server 3000` dentro de web-ui/
```

## Arquitetura (visão geral para entender rápido)

```
lead (navegador, web-ui) --HTTP--> agent-service (FastAPI)
                                        |
                                        |-- Claude API (NLU + geração de texto)
                                        |-- quote-service (FastAPI mock, instável de proposito)
                                        |-- data/knowledge_base.json (base de conhecimento)
                                        |-- logs/events.jsonl (rastreabilidade local, em claro)
                                        |-- MongoDB (rastreabilidade persistente, CIFRADA)
```

Decisão central de design: **separação rígida entre "entender/falar" (LLM) e
"decidir" (código)**. Isso é o que permite responder com confiança às perguntas de
avaliação do desafio: "o que ele faz quando a `/quote` falha" (retry determinístico,
nunca inventa preço) e "o critério de handoff é explícito e defensável" (função
`_motivo_handoff` em `orchestrator.py`, testável isoladamente).

## Persistência em MongoDB (adicionado em 2026-08-26)

Todo evento que já ia para `logs/events.jsonl` (mensagem do lead/agente/atendente,
tentativa de cotação, handoff, resolução, avaliação) agora também é gravado numa
coleção `interacoes` no MongoDB (serviço `mongo` no `docker-compose.yml`) — isso é o
que dá persistência real entre reinícios do container (o `logs/events.jsonl` e o
estado em memória continuam existindo, sem mudança de comportamento).

**Requisito do usuário**: um admin do banco (acesso root ao Mongo) não pode conseguir
ler o conteúdo das interações. Solução: criptografia **do lado da aplicação**, não do
banco — `agent-service/app/mongo_client.py` cifra o `payload` inteiro de cada evento
com Fernet (AES simétrico autenticado) antes de sair do processo, usando uma chave
(`MONGO_ENCRYPTION_KEY`) que só existe na variável de ambiente do `agent-service`,
nunca dentro do Mongo. Ficam em texto puro só `conversation_id`, `type` e
`timestamp` (metadados não sensíveis, úteis pra filtrar/consultar); o campo
`payload_cifrado` é opaco pra qualquer um com só acesso ao banco — inclusive um
"encryption at rest" nativo do Mongo não resolveria isso, porque um admin com
permissão de leitura via `mongosh`/Compass ainda veria os dados decifrados pelo
próprio servidor. Por isso a cifra tem que ser client-side.

Design defensivo: se `MONGO_ENCRYPTION_KEY` não estiver configurada (ou for
inválida), a gravação no Mongo fica **desativada automaticamente** — o agente nunca
grava payload em claro no banco por engano. E se o Mongo estiver fora do ar, a
gravação falha silenciosamente (só loga um aviso no stderr) sem quebrar a resposta
ao lead — é persistência de melhor esforço, igual ao resto do projeto (a
funcionalidade principal nunca depende de infra secundária estar 100% no ar).

Testado manualmente (verificação relatada ao usuário): conectei via `mongosh` com as
credenciais root e confirmei que só dá pra ver ciphertext; decifrei de dentro do
container do `agent-service` (que tem a chave) pra confirmar o roundtrip. Também
testei parar o container do Mongo, confirmar que a API do agente continua
respondendo normalmente, e reiniciar o Mongo sem precisar reiniciar o
`agent-service` (a próxima gravação já funciona — `pymongo` reconecta sozinho).

Variáveis novas em `.env` (ver `.env.example` para os comentários completos):
`MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `MONGO_DB`, `MONGO_ENCRYPTION_KEY` (gerar
com `python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"`
ou, se `cryptography` estiver instalado, `Fernet.generate_key()`). A porta 27017 do
Mongo está exposta no `docker-compose.yml` só para inspeção local (`mongosh`,
MongoDB Compass) — comentário no próprio arquivo avisando que isso não é para
produção.

A página `web-ui/docs.html` (seção "De onde vêm as perguntas? E onde são gravadas as
respostas?") já foi atualizada para explicar essa camada nova — é a resposta oficial
pra "onde os dados ficam gravados" nas perguntas de avaliação do desafio.
