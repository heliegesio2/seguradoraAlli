# Execução do projeto — AutoSeguro (FDE / AI Engineer, Namastex)

Resumo do que foi entregue no desafio ([enunciado original](https://github.com/namastexlabs/namastex-fde-challenge),
copiado sem alterações em [`CHALLENGE.md`](CHALLENGE.md)), pra envio ao entrevistador. Detalhes completos de
como rodar e as decisões de engenharia estão no [`README.md`](README.md); decisões específicas também estão
documentadas dentro da própria aplicação, em **Documentação** (`web-ui/docs.html`, painel interno).

## O que o desafio pediu

| # | Item pedido | Concluído? | Evidência |
|---|---|---|---|
| 1 | **Agente de ponta a ponta**: conversa → qualifica → cota → decide (resolve sozinho ou encaminha pra humano, com critério claro) | ✅ Sim | `agent-service/app/orchestrator.py`; testado manualmente em vários cenários (caminho feliz, falha de infra, recusa de negócio, handoff) |
| 2 | **Repositório público no GitHub** com o código | ✅ Sim | https://github.com/heliegesio2/seguradoraAlli |
| 3 | **README** explicando como rodar e as decisões tomadas (e por quê) | ✅ Sim | [`README.md`](README.md) |
| 4 | **Log de uma execução completa** (conversa do início ao fim, com a cotação saindo) | ✅ Sim | [`docs/exemplo-conversa-completa.jsonl`](docs/exemplo-conversa-completa.jsonl) — transcrição abaixo |
| 5 | **Conversas com as IAs exportadas** no repo (`ai-logs/`) | ✅ Sim | [`ai-logs/`](ai-logs/) — sessões completas do Claude Code, com segredos removidos (ver `ai-logs/README.md`) |

### Critérios de avaliação ("Como a gente vai olhar", do próprio desafio)

| # | Critério | Concluído? | Evidência |
|---|---|---|---|
| 6 | Funciona de ponta a ponta, cota certo no caminho feliz | ✅ Sim | Ver log de exemplo (item 4) e o roteiro de teste no README |
| 7 | **O que ele faz quando a `/quote` falha** (o ponto que mais separa candidatos, segundo o próprio desafio) | ✅ Sim | Distingue infra (retry com backoff) de recusa de negócio (nunca repete); preço sempre vem de template, nunca do LLM — ver README, seção "Decisões de engenharia", item 2 |
| 8 | Critério de handoff explícito e defensável | ✅ Sim | `_motivo_handoff()` em `orchestrator.py` — função pura, testável isoladamente |
| 9 | Rastreabilidade (cada mensagem/cotação com id e status) | ✅ Sim | `logs/events.jsonl` local + cópia cifrada no MongoDB, cada evento com id próprio |
| 10 | Cuidado com dados sensíveis do dataset/conversas | ✅ Sim | Persistência no MongoDB cifrada do lado da aplicação (Fernet/AES) — nem um admin do banco lê o conteúdo; senhas com hash salgado |
| 11 | Qualidade — outro engenheiro entende as decisões | ✅ Sim | README + 9 artigos na Documentação interna cobrindo arquitetura, segurança, produto |
| 12 | Transparência de uso de IA (os `ai-logs/` entram na avaliação) | ✅ Sim | Item 5 |

**Log de execução completa (item 4), transcrição:**

```
Lead:   Oi! Quero cotar o plano Completo pro meu carro. Tenho 34 anos, o carro
        e um 2021, meu CEP e 04538-133, e queria comecar em 15/09/2026.

Agente: Cotacao pronta! Plano Completo: R$ 209.90/mes.
        Franquia: R$ 3000.00.
        Coberturas: colisao, roubo, furto, terceiros, vidros.
        Atencao: roubo, furto tem carencia de 30 dias a partir do inicio da vigencia.
        Como a vigencia comeca no meio do mes, o primeiro pagamento e proporcional:
        R$ 111.95 (16 de 30 dias).
        Quer seguir com essa cotacao?
```

Uma única mensagem do lead já continha todos os dados — o agente extraiu tudo, chamou o
`quote-service` (sucesso em 1 tentativa, 149ms) e respondeu com o preço exato devolvido pela API,
sem nenhuma palavra do preço escrita pelo LLM.

## O que foi feito além do que foi pedido

O desafio pedia um agente que funcione. O que segue foi construído por cima, sem ter sido
solicitado, pra explorar até onde a plataforma poderia ir:

| Item extra | O que é |
|---|---|
| **Site completo da AutoSeguro** | Landing page com plano/vantagens/FAQ + widget de chat embutido estilo WhatsApp (não é WhatsApp de verdade — conversa direto com o agente) |
| **Handoff configurável: site / WhatsApp real / misto** | Handoff humano pode ficar só no site (sem custo), encaminhar pro WhatsApp Business real, ou deixar o lead escolher — configurável em runtime, sem mexer em código |
| **Verificação "não sou um robô" antes do WhatsApp real** | reCAPTCHA v2 real (se configurado) ou simulado (demonstração), evitando bot gerar custo de WhatsApp Business API |
| **Painel do atendente** | Lista de conversas, detalhe completo, dados coletados, tentativas de cotação com latência, resolução de handoff |
| **Painel de Configurações (Admin)** | Modo de handoff, modelo do Claude, chaves de API (nunca devolvidas pela API, só um booleano "configurada"), chaves do reCAPTCHA — tudo editável em runtime |
| **Cadastro de usuários com perfis** | Menu interno (só admin) pra criar usuários escolhendo o perfil (admin/atendente); senha com hash salgado (PBKDF2), nunca em texto puro |
| **Fotos de perfil** | Upload de foto no cadastro e em "Meus dados" (autoatendimento); fallback pra um avatar padrão quando não há foto |
| **Base de conhecimento com loop de aprendizado** | Atendente registra como resolveu um caso → fica pendente → admin aprova → agente passa a resolver casos parecidos sozinho, sem precisar escalar de novo |
| **MongoDB com criptografia do lado da aplicação** | Toda interação persistida também no Mongo, mas cifrada (Fernet/AES) antes de sair do processo do agente — nem um admin do banco consegue ler o conteúdo |
| **Persistência real entre reinícios de container** | Volume Docker dedicado pra usuários/config/base de conhecimento — não se perdem a cada rebuild |
| **Relatórios com gráfico e filtros** | Atendimentos por dia (gráfico SVG feito à mão), filtráveis por período/nota/atendente, rankings com foto de cada atendente |
| **Notificações em tempo real** | Badge no favicon da aba + som sintetizado quando o atendente responde com o widget minimizado (ou quando chega uma nova conversa, no painel interno) |
| **Entrada por voz** | Microfone integrado ao chat (Web Speech API), tanto no widget do lead quanto no painel do atendente |
| **Documentação interna viva** | Site de documentação dentro da própria aplicação (`docs.html`) — 5 categorias, 9 artigos, árvore de arquivos do projeto interativa com botão de "copiar prompt sobre este arquivo" pra usar em qualquer IA |
| **Autenticação e controle de acesso real** | Todo endpoint sensível protegido no backend (401/403), não só escondido na tela; bloqueio de conversa entre atendentes simultâneos |

## Limitações conhecidas (documentadas, não escondidas)

Registradas com detalhe no [`README.md`](README.md) e no artigo **Segurança** da documentação interna:
estado de conversa em memória (não sobrevive a restart do `agent-service`, só o histórico cifrado no
Mongo sobrevive), sem fila de mensageria (RabbitMQ avaliado e adiado deliberadamente — não se justifica
na escala do desafio), base de conhecimento por palavras-chave em vez de embeddings, auth sem 2FA/rate
limit (adequado para o desafio, não para produção), e CORS liberado.

## Testes automatizados

51 testes com `pytest` em `agent-service/tests/` — cobrem o critério de handoff, a distinção
infra-vs-negócio no retry da cotação, a garantia de que o preço nunca vem do LLM, o loop de
aprovação da base de conhecimento, hash de senha e os filtros dos relatórios. Rodam sem
`ANTHROPIC_API_KEY`, MongoDB nem `quote-service` (Claude e o cliente de cotação são
substituídos por dublês). Ver seção "Rodando os testes" no [`README.md`](README.md).
