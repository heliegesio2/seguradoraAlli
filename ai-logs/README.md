# ai-logs/

Transparência de uso de IA (ver [`CHALLENGE.md`](../CHALLENGE.md#transparência-de-uso-de-ia-obrigatório)):
sessões completas do Claude Code usadas para construir este projeto, exportadas
direto de `~/.claude/projects/<slug-do-projeto>/*.jsonl`.

- `e2bab090-fd47-41f8-90b1-5af9c5add745.jsonl` — sessão inicial: instalação do
  Docker/Python/uv na máquina, verificação do ambiente.
- `c304fd84-41a8-465a-bcef-c52fd2846807.jsonl` — sessão principal: todo o
  resto do projeto (agente, painel interno, MongoDB, documentação, testes
  automatizados, etc.). **Reexportada em 26/ago/2026** (2ª exportação —
  a primeira foi feita mais cedo no mesmo dia). Se a sessão real continuar
  depois deste ponto, esta cópia deixa de ser o histórico 100% completo
  até a entrega final.

## Segredos removidos

Antes de commitar, os dois arquivos passaram por uma varredura automática que
substitui por `[NOME_DO_SEGREDO_REDACTED]`:

- A chave real da Anthropic (`ANTHROPIC_API_KEY`) que aparecia em texto puro
  nas duas sessões (ficou registrada sempre que o `.env` foi lido pra
  confirmar que estava salvo certo).
- Um `DATABASE_URL` e uma chave da Anthropic de **outro projeto**, que
  vazaram acidentalmente pra dentro deste repositório numa escrita errada de
  arquivo na sessão inicial (incidente documentado em `CLAUDE.md`) — nunca
  chegaram a ser commitados, mas ficaram registrados na transcrição da
  conversa até esta limpeza.
- As credenciais do MongoDB deste projeto (`MONGO_ROOT_PASSWORD`,
  `MONGO_ENCRYPTION_KEY`) usadas durante os testes.

Nenhum outro conteúdo foi alterado — são os `.jsonl` crus, como vieram do
Claude Code.
