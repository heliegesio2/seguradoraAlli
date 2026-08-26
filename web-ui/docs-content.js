// Conteudo do site de documentacao interna (docs.html), no formato usado por
// documentacoes de API de verdade: categorias > artigos > blocos (paragrafo,
// titulo de secao, lista, bloco de codigo). Pra adicionar um novo artigo, basta
// acrescentar um objeto em "artigos" (ou uma nova categoria) - a arvore lateral,
// o breadcrumb e o indice "Nesta pagina" sao todos gerados a partir daqui.
window.DOCS = {
  categorias: [
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
