// Conteudo da aba "Documentacao" do painel do atendente. Cada item vira um
// card de sanfona (pergunta clicavel + resposta). Pra adicionar um novo
// subitem, so acrescentar um objeto {titulo, corpo} nesta lista - o corpo
// aceita HTML simples (paragrafos, <code>, <ul>).
window.DOCUMENTACAO_ITENS = [
  {
    titulo: "De onde vêm as perguntas? E onde são gravadas as respostas?",
    corpo: `
      <p><strong>De onde vêm as perguntas</strong></p>
      <p>A ordem e quais dados pedir nunca são decididos pela IA — são fixos no código,
      em <code>REQUIRED_SLOTS</code> (<code>agent-service/app/orchestrator.py</code>):
      plano, idade, ano do veículo, CEP e data de início, nessa ordem. A cada mensagem do
      lead, o código escolhe o <em>próximo</em> dado que falta e só pergunta esse — nunca
      a lista toda de uma vez.</p>
      <ul>
        <li>A pergunta do <strong>plano</strong> é um texto fixo com botões (chips:
        Essencial/Completo/Premium) — nunca é gerada pela IA, para garantir que bate
        exatamente com os planos que existem de verdade no quote-service.</li>
        <li>As demais perguntas (idade, ano do veículo, CEP, data de início) são
        fraseadas pelo Claude a cada vez (função <code>gerar_resposta</code> em
        <code>llm.py</code>), com instrução para variar a forma de perguntar — mas o
        <em>quê</em> perguntar e a <em>ordem</em> continuam sempre decididos pelo código,
        nunca pela IA.</li>
        <li>Na triagem de handoff (quando o lead pede atendente humano), a mesma lógica
        se aplica: primeiro o nome, depois o problema — sequência fixa em código, texto
        gerado pela IA.</li>
      </ul>
      <p><strong>Onde as respostas são gravadas</strong></p>
      <ul>
        <li><strong>Em memória (dura enquanto o container estiver rodando):</strong> cada
        mensagem trocada fica em <code>Conversation.messages</code>; os dados já
        confirmados (plano, idade, etc.) ficam em <code>Conversation.slots</code>. Reinicia
        com o <code>agent-service</code> — não é um banco de dados.</li>
        <li><strong>Log de auditoria (arquivo, sobrevive a reinícios):</strong> todo evento
        relevante — mensagem recebida, tentativa de cotação, handoff, resolução, avaliação —
        é gravado em uma linha de <code>agent-service/logs/events.jsonl</code>, no formato
        "append-only" (nunca apaga, só acrescenta). É a fonte de rastreabilidade completa
        de uma conversa.</li>
        <li><strong>Base de conhecimento (arquivo):</strong> as resoluções de atendentes
        aprovadas por um admin ficam em <code>agent-service/data/knowledge_base.json</code>,
        usada para o agente resolver sozinho casos parecidos no futuro.</li>
      </ul>
    `,
  },
];
