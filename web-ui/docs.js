(() => {
  const sessao = window.exigirLogin(["atendente", "admin"]);
  if (!sessao) return;

  const dados = window.DOCS || { categorias: [] };

  const el = {
    topbarUsuario: document.getElementById("topbar-usuario"),
    filtro: document.getElementById("docs-filtro"),
    arvore: document.getElementById("docs-arvore"),
    conteudo: document.getElementById("docs-conteudo"),
    tocLista: document.getElementById("docs-toc-lista"),
  };

  el.topbarUsuario.textContent = `${sessao.nome} (${sessao.papel})`;
  if (sessao.papel !== "admin") {
    document.getElementById("link-usuarios")?.setAttribute("hidden", "");
    document.getElementById("link-admin")?.setAttribute("hidden", "");
  }

  let modoMarkdown = false;
  let observadorScroll = null;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function textoPuro(html) {
    const div = document.createElement("div");
    div.innerHTML = html ?? "";
    return div.textContent || "";
  }

  function todosArtigos() {
    return dados.categorias.flatMap((cat) =>
      cat.artigos.map((art) => ({ ...art, categoria: cat }))
    );
  }

  function idAtual() {
    return location.hash.slice(1) || todosArtigos()[0]?.id;
  }

  // --- arvore lateral --------------------------------------------------

  function renderArvore(filtroTexto = "") {
    const termo = filtroTexto.trim().toLowerCase();
    el.arvore.innerHTML = "";
    dados.categorias.forEach((cat) => {
      const artigosVisiveis = cat.artigos.filter(
        (a) => !termo || a.titulo.toLowerCase().includes(termo)
      );
      if (!artigosVisiveis.length) return;

      const grupo = document.createElement("div");
      grupo.className = "docs-arvore__grupo";

      const tituloCat = document.createElement("div");
      tituloCat.className = "docs-arvore__categoria";
      tituloCat.textContent = cat.titulo;
      grupo.appendChild(tituloCat);

      artigosVisiveis.forEach((art) => {
        const link = document.createElement("a");
        link.className = "docs-arvore__item";
        link.href = `#${art.id}`;
        link.textContent = art.titulo;
        link.dataset.id = art.id;
        grupo.appendChild(link);
      });

      el.arvore.appendChild(grupo);
    });
    if (!el.arvore.children.length) {
      el.arvore.innerHTML = '<p class="docs-arvore__vazio">Nenhum artigo encontrado.</p>';
    }
    marcarItemAtivo();
  }

  function marcarItemAtivo() {
    const atual = idAtual();
    el.arvore.querySelectorAll(".docs-arvore__item").forEach((a) => {
      a.classList.toggle("docs-arvore__item--ativo", a.dataset.id === atual);
    });
  }

  // --- corpo do artigo ---------------------------------------------------

  function renderBloco(bloco) {
    switch (bloco.tipo) {
      case "p":
        return `<p>${bloco.html}</p>`;
      case "h2":
        return `<h2 id="${bloco.id}" class="docs-heading">${escapeHtml(bloco.titulo)}<a class="docs-heading__anchor" href="#${bloco.id}" aria-label="Link para esta seção">🔗</a></h2>`;
      case "lista":
        return `<ul>${bloco.itens.map((i) => `<li>${i}</li>`).join("")}</ul>`;
      case "codigo":
        return `<pre class="docs-code"><code>${escapeHtml(bloco.codigo)}</code></pre>`;
      case "arvore":
        // Preenchido depois via montarArvoreArquivos() - construir a arvore
        // interativa como string HTML seria inviavel (precisa de listener por
        // botao). So suporta um bloco "arvore" por artigo por enquanto.
        return `<div class="docs-arvore-fs" id="docs-arvore-arquivos"></div>`;
      case "fluxograma":
        // Idem - preenchido depois via montarFluxograma().
        return `<div class="docs-fluxo" id="docs-fluxograma"></div>`;
      default:
        return "";
    }
  }

  // --- fluxograma interativo do agente (bloco tipo "fluxograma") -----------

  const FLUXO_ESTILO = {
    inicio: { fill: "#d5e8d4", stroke: "#82b366", forma: "pilula" },
    fim: { fill: "#f5f5f5", stroke: "#666666", forma: "pilula" },
    processo: { fill: "#dae8fc", stroke: "#6c8ebf", forma: "retangulo" },
    subprocesso: { fill: "#dae8fc", stroke: "#6c8ebf", forma: "retangulo" },
    decisao: { fill: "#ffe6cc", stroke: "#d79b00", forma: "diamante" },
    perigo: { fill: "#f8cecc", stroke: "#b85450", forma: "retangulo" },
    sucesso: { fill: "#d5e8d4", stroke: "#82b366", forma: "retangulo" },
    kb: { fill: "#e1d5e7", stroke: "#9673a6", forma: "retangulo" },
    armazenamento: { fill: "#e1d5e7", stroke: "#9673a6", forma: "retangulo" },
    nota: { fill: "#fff2cc", stroke: "#d6b656", forma: "retangulo" },
  };

  function pontoNaBorda(no, alvoCentroX, alvoCentroY) {
    const cx = no.x + no.w / 2;
    const cy = no.y + no.h / 2;
    const dx = alvoCentroX - cx;
    const dy = alvoCentroY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const halfW = no.w / 2;
    const halfH = no.h / 2;
    const escalas = [];
    if (dx !== 0) escalas.push(halfW / Math.abs(dx));
    if (dy !== 0) escalas.push(halfH / Math.abs(dy));
    const escala = Math.min(...escalas);
    return { x: cx + dx * escala, y: cy + dy * escala };
  }

  function svgNo(no) {
    const estilo = FLUXO_ESTILO[no.tipo] || FLUXO_ESTILO.processo;
    let forma = "";
    if (estilo.forma === "diamante") {
      const cx = no.x + no.w / 2;
      const cy = no.y + no.h / 2;
      const pontos = `${cx},${no.y} ${no.x + no.w},${cy} ${cx},${no.y + no.h} ${no.x},${cy}`;
      forma = `<polygon points="${pontos}" fill="${estilo.fill}" stroke="${estilo.stroke}" stroke-width="1.5" />`;
    } else {
      const rx = estilo.forma === "pilula" ? Math.min(28, no.h / 2) : 6;
      forma = `<rect x="${no.x}" y="${no.y}" width="${no.w}" height="${no.h}" rx="${rx}" ry="${rx}" fill="${estilo.fill}" stroke="${estilo.stroke}" stroke-width="1.5" />`;
    }
    const padding = 10;
    const textoW = Math.max(10, no.w - padding * 2);
    const textoH = Math.max(10, no.h - padding * 2);
    return `
      <g class="docs-fluxo__no" data-id="${no.id}" tabindex="0" role="button" aria-label="${escapeHtml(no.rotulo)}">
        ${forma}
        <foreignObject x="${no.x + padding}" y="${no.y + padding}" width="${textoW}" height="${textoH}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="docs-fluxo__texto">${escapeHtml(no.rotulo)}</div>
        </foreignObject>
        <circle class="docs-fluxo__duvida" cx="${no.x + no.w - 4}" cy="${no.y + 4}" r="11" />
        <text class="docs-fluxo__duvida-marca" x="${no.x + no.w - 4}" y="${no.y + 4}" text-anchor="middle" dominant-baseline="central">?</text>
      </g>`;
  }

  function svgAresta(aresta, porId) {
    const origem = porId[aresta.de];
    const destino = porId[aresta.para];
    if (!origem || !destino) return "";
    const centroOrigem = { x: origem.x + origem.w / 2, y: origem.y + origem.h / 2 };
    const centroDestino = { x: destino.x + destino.w / 2, y: destino.y + destino.h / 2 };
    const p1 = pontoNaBorda(origem, centroDestino.x, centroDestino.y);
    const p2 = pontoNaBorda(destino, centroOrigem.x, centroOrigem.y);
    const tracejado = aresta.tracejada ? ' stroke-dasharray="5,4"' : "";
    let rotuloSvg = "";
    if (aresta.rotulo) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const largura = Math.min(220, aresta.rotulo.length * 6.4 + 10);
      rotuloSvg = `
        <rect x="${mx - largura / 2}" y="${my - 9}" width="${largura}" height="18" fill="var(--md-surface)" opacity="0.92" />
        <text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" class="docs-fluxo__rotulo-aresta">${escapeHtml(aresta.rotulo)}</text>`;
    }
    return `
      <g class="docs-fluxo__aresta">
        <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" marker-end="url(#docs-fluxo-seta)"${tracejado} />
        ${rotuloSvg}
      </g>`;
  }

  function montarFluxograma(containerId, dados) {
    const container = document.getElementById(containerId);
    if (!container || !dados) return;

    const porId = {};
    dados.nos.forEach((no) => { porId[no.id] = no; });

    const svgNos = dados.nos.map(svgNo).join("\n");
    const svgArestas = dados.arestas.map((a) => svgAresta(a, porId)).join("\n");

    container.innerHTML = `
      <div class="docs-fluxo__controles">
        <button type="button" class="docs-util-btn" id="fluxo-anterior">◀ Anterior</button>
        <span class="docs-fluxo__passo" id="fluxo-passo-atual">Clique num passo do diagrama, ou use os botões para um passeio guiado.</span>
        <button type="button" class="docs-util-btn" id="fluxo-proximo">Próximo ▶</button>
      </div>
      <div class="docs-fluxo__canvas">
        <svg viewBox="${dados.viewBox}" width="1650" height="1850" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="docs-fluxo-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" class="docs-fluxo__seta" />
            </marker>
          </defs>
          <g id="docs-fluxo-arestas">${svgArestas}</g>
          <g id="docs-fluxo-nos">${svgNos}</g>
        </svg>
      </div>
      <div class="docs-fluxo__detalhe" id="fluxo-detalhe">
        <p class="hint">Clique num passo do fluxograma (ou no ícone ?) pra ver a explicação de verdade — o que aquele passo faz no código, e onde a implementação atual diverge do desenho original quando é o caso.</p>
      </div>`;

    const svgEl = container.querySelector("svg");
    const detalheEl = document.getElementById("fluxo-detalhe");
    const passoAtualEl = document.getElementById("fluxo-passo-atual");
    let indicePasseio = -1;

    function mostrarNo(id, { doPasseio = false } = {}) {
      const no = porId[id];
      if (!no) return;
      container.querySelectorAll(".docs-fluxo__no--ativo").forEach((g) => g.classList.remove("docs-fluxo__no--ativo"));
      const grupo = svgEl.querySelector(`.docs-fluxo__no[data-id="${id}"]`);
      if (grupo) {
        grupo.classList.add("docs-fluxo__no--ativo");
        grupo.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
      detalheEl.innerHTML = `
        <div class="docs-fluxo__detalhe-rotulo">${escapeHtml(no.rotulo)}</div>
        <p>${escapeHtml(no.explicacao)}</p>`;
      if (doPasseio) {
        indicePasseio = dados.passeio.indexOf(id);
        passoAtualEl.textContent = `Passo ${indicePasseio + 1} de ${dados.passeio.length}`;
      } else {
        indicePasseio = dados.passeio.indexOf(id);
      }
    }

    svgEl.querySelectorAll(".docs-fluxo__no").forEach((grupo) => {
      grupo.addEventListener("click", () => mostrarNo(grupo.dataset.id, { doPasseio: true }));
      grupo.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          mostrarNo(grupo.dataset.id, { doPasseio: true });
        }
      });
    });

    document.getElementById("fluxo-proximo").addEventListener("click", () => {
      const proximo = (indicePasseio + 1 + dados.passeio.length) % dados.passeio.length;
      mostrarNo(dados.passeio[proximo], { doPasseio: true });
    });
    document.getElementById("fluxo-anterior").addEventListener("click", () => {
      const anterior = (indicePasseio - 1 + dados.passeio.length) % dados.passeio.length;
      mostrarNo(dados.passeio[anterior], { doPasseio: true });
    });
  }

  // --- arvore de pastas/arquivos do projeto (bloco tipo "arvore") ----------

  function montarPromptArquivo(no) {
    return (
      "Você é uma IA ajudando a entender um projeto chamado AutoSeguro (agente de vendas " +
      "de seguro auto por WhatsApp; backend em Python/FastAPI, frontend em HTML/CSS/JS puro).\n\n" +
      `Arquivo: ${no.caminho}\n` +
      `Papel deste arquivo no projeto: ${no.descricao}\n\n` +
      "Vou colar o conteúdo do arquivo abaixo. Por favor explique: (1) o que ele faz, " +
      "(2) suas principais responsabilidades/funções, e (3) como ele se conecta com o resto do sistema.\n\n" +
      `--- conteúdo do arquivo (${no.caminho}) ---\n` +
      "[cole aqui o conteúdo do arquivo]"
    );
  }

  function criarNoArvoreFs(no, nivel) {
    const wrapper = document.createElement("div");
    wrapper.className = "docs-arvore-fs__no";

    const linha = document.createElement("div");
    linha.className = "docs-arvore-fs__linha";
    linha.style.paddingLeft = `${nivel * 16}px`;
    wrapper.appendChild(linha);

    if (no.tipo === "pasta") {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "docs-arvore-fs__pasta";
      botao.innerHTML =
        '<span class="docs-arvore-fs__chevron">▸</span>' +
        '<span class="docs-arvore-fs__icone">📁</span>' +
        `<span class="docs-arvore-fs__nome">${escapeHtml(no.nome)}</span>`;
      linha.appendChild(botao);

      const filhos = document.createElement("div");
      filhos.className = "docs-arvore-fs__filhos";
      (no.filhos || []).forEach((filho) => filhos.appendChild(criarNoArvoreFs(filho, nivel + 1)));
      wrapper.appendChild(filhos);

      if (nivel === 0) {
        botao.classList.add("docs-arvore-fs__pasta--aberta");
      } else {
        filhos.hidden = true;
      }
      botao.addEventListener("click", () => {
        filhos.hidden = !filhos.hidden;
        botao.classList.toggle("docs-arvore-fs__pasta--aberta", !filhos.hidden);
      });
    } else {
      linha.innerHTML =
        '<span class="docs-arvore-fs__icone">📄</span>' +
        `<span class="docs-arvore-fs__nome" title="${escapeHtml(no.descricao || "")}">${escapeHtml(no.nome)}</span>` +
        '<button type="button" class="docs-arvore-fs__copiar" title="Copiar prompt sobre este arquivo" aria-label="Copiar prompt sobre este arquivo">📋</button>';
      const botaoCopiar = linha.querySelector(".docs-arvore-fs__copiar");
      botaoCopiar.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(montarPromptArquivo(no));
          avisoTemporario(botaoCopiar, "✅");
        } catch {
          avisoTemporario(botaoCopiar, "⚠️");
        }
      });
    }
    return wrapper;
  }

  function montarArvoreArquivos(containerId, raiz) {
    const container = document.getElementById(containerId);
    if (!container || !raiz) return;
    container.innerHTML = "";

    const controles = document.createElement("div");
    controles.className = "docs-arvore-fs__controles";
    const btnExpandir = document.createElement("button");
    btnExpandir.type = "button";
    btnExpandir.className = "docs-util-btn";
    btnExpandir.textContent = "Expandir tudo";
    const btnRecolher = document.createElement("button");
    btnRecolher.type = "button";
    btnRecolher.className = "docs-util-btn";
    btnRecolher.textContent = "Recolher tudo";
    controles.appendChild(btnExpandir);
    controles.appendChild(btnRecolher);
    container.appendChild(controles);
    container.appendChild(criarNoArvoreFs(raiz, 0));

    btnExpandir.addEventListener("click", () => {
      container.querySelectorAll(".docs-arvore-fs__filhos").forEach((f) => { f.hidden = false; });
      container.querySelectorAll(".docs-arvore-fs__pasta").forEach((b) => b.classList.add("docs-arvore-fs__pasta--aberta"));
    });
    btnRecolher.addEventListener("click", () => {
      container.querySelectorAll(".docs-arvore-fs__filhos").forEach((f) => { f.hidden = true; });
      container.querySelectorAll(".docs-arvore-fs__pasta").forEach((b) => b.classList.remove("docs-arvore-fs__pasta--aberta"));
    });
  }

  function arvoreParaTexto(no, prefixo) {
    if (no.tipo === "arquivo") return `${prefixo}- ${no.caminho}\n`;
    let saida = `${prefixo}- ${no.nome}/\n`;
    (no.filhos || []).forEach((filho) => {
      saida += arvoreParaTexto(filho, prefixo + "  ");
    });
    return saida;
  }

  function paraMarkdown(art) {
    const linhas = [`# ${art.titulo}`, "", `_Atualizado: ${art.atualizado}_`, ""];
    if (art.aviso) linhas.push(`> ${art.aviso}`, "");
    art.blocos.forEach((b) => {
      if (b.tipo === "p") linhas.push(textoPuro(b.html), "");
      else if (b.tipo === "h2") linhas.push(`## ${b.titulo}`, "");
      else if (b.tipo === "lista") {
        b.itens.forEach((i) => linhas.push(`- ${textoPuro(i)}`));
        linhas.push("");
      } else if (b.tipo === "codigo") {
        linhas.push("```" + (b.linguagem || ""), b.codigo, "```", "");
      } else if (b.tipo === "arvore") {
        linhas.push("```", arvoreParaTexto(b.dados, "").trimEnd(), "```", "");
      } else if (b.tipo === "fluxograma") {
        b.dados.passeio.forEach((id) => {
          const no = b.dados.nos.find((n) => n.id === id);
          if (no) linhas.push(`- **${no.rotulo}** — ${no.explicacao}`);
        });
        linhas.push("");
      }
    });
    return linhas.join("\n");
  }

  function avisoTemporario(elemento, texto) {
    const original = elemento.textContent;
    elemento.textContent = texto;
    setTimeout(() => {
      elemento.textContent = original;
    }, 1800);
  }

  function renderArtigo(art) {
    document.title = `${art.titulo} — Documentação AutoSeguro`;

    const breadcrumb = `
      <nav class="docs-breadcrumb">
        <span>Documentação</span>
        <span class="docs-breadcrumb__sep">›</span>
        <span>${escapeHtml(art.categoria.titulo)}</span>
        <span class="docs-breadcrumb__sep">›</span>
        <span>${escapeHtml(art.titulo)}</span>
      </nav>`;

    const utilitarios = `
      <div class="docs-utilitarios">
        <button class="docs-util-btn" id="docs-btn-copiar" type="button">📋 Copiar para IA</button>
        <button class="docs-util-btn" id="docs-btn-markdown" type="button">&lt;/&gt; ${modoMarkdown ? "Ver artigo" : "Ver como Markdown"}</button>
      </div>`;

    if (modoMarkdown) {
      el.conteudo.innerHTML = `
        ${breadcrumb}
        <h1 class="docs-titulo">${escapeHtml(art.titulo)}</h1>
        <div class="docs-meta">Atualizado: ${escapeHtml(art.atualizado)}</div>
        ${utilitarios}
        <pre class="docs-code docs-markdown-preview">${escapeHtml(paraMarkdown(art))}</pre>`;
      el.tocLista.innerHTML = '<p class="docs-toc__vazio">Sem seções no modo Markdown.</p>';
    } else {
      const aviso = art.aviso
        ? `<div class="docs-callout docs-callout--info">${escapeHtml(art.aviso)}</div>`
        : "";
      const corpo = art.blocos.map(renderBloco).join("\n");
      el.conteudo.innerHTML = `
        ${breadcrumb}
        <h1 class="docs-titulo">${escapeHtml(art.titulo)}</h1>
        <div class="docs-meta">Atualizado: ${escapeHtml(art.atualizado)}</div>
        ${utilitarios}
        ${aviso}
        <div class="docs-corpo" id="docs-corpo">${corpo}</div>
        <div class="docs-feedback">
          <span>Isso foi útil?</span>
          <button class="docs-feedback__btn" data-valor="sim" title="Sim" aria-label="Sim">👍</button>
          <button class="docs-feedback__btn" data-valor="nao" title="Não" aria-label="Não">👎</button>
          <span class="docs-feedback__msg" id="docs-feedback-msg"></span>
        </div>`;
      const blocoArvore = art.blocos.find((b) => b.tipo === "arvore");
      if (blocoArvore) montarArvoreArquivos("docs-arvore-arquivos", blocoArvore.dados);
      const blocoFluxo = art.blocos.find((b) => b.tipo === "fluxograma");
      if (blocoFluxo) montarFluxograma("docs-fluxograma", blocoFluxo.dados);
      renderToc();
    }

    wireUtilitarios(art);
    marcarItemAtivo();
  }

  function wireUtilitarios(art) {
    document.getElementById("docs-btn-copiar").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const texto = modoMarkdown
        ? paraMarkdown(art)
        : `${art.titulo}\n\n${textoPuro(document.getElementById("docs-corpo").innerHTML)}`;
      try {
        await navigator.clipboard.writeText(texto);
        avisoTemporario(btn, "✅ Copiado!");
      } catch {
        avisoTemporario(btn, "Não foi possível copiar");
      }
    });

    document.getElementById("docs-btn-markdown").addEventListener("click", () => {
      modoMarkdown = !modoMarkdown;
      renderArtigo(art);
    });

    document.querySelectorAll(".docs-feedback__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msg = document.getElementById("docs-feedback-msg");
        msg.textContent =
          btn.dataset.valor === "sim" ? "Obrigado pelo retorno!" : "Anotado, vamos melhorar este artigo.";
      });
    });
  }

  // --- indice "Nesta pagina" com scroll-spy -------------------------------

  function renderToc() {
    const headings = el.conteudo.querySelectorAll(".docs-heading");
    el.tocLista.innerHTML = "";
    if (!headings.length) {
      el.tocLista.innerHTML = '<p class="docs-toc__vazio">Sem seções nesta página.</p>';
      return;
    }
    headings.forEach((h) => {
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.childNodes[0].textContent.trim();
      a.className = "docs-toc__item";
      a.dataset.id = h.id;
      el.tocLista.appendChild(a);
    });
    observarScroll(headings);
  }

  function observarScroll(headings) {
    if (observadorScroll) observadorScroll.disconnect();
    observadorScroll = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          el.tocLista
            .querySelectorAll(".docs-toc__item")
            .forEach((a) => a.classList.remove("docs-toc__item--ativo"));
          const link = el.tocLista.querySelector(`[data-id="${entry.target.id}"]`);
          if (link) link.classList.add("docs-toc__item--ativo");
        });
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    headings.forEach((h) => observadorScroll.observe(h));
  }

  // --- roteamento por hash -------------------------------------------------

  function carregarPorHash() {
    const id = idAtual();
    const art = todosArtigos().find((a) => a.id === id) || todosArtigos()[0];
    if (!art) {
      el.conteudo.innerHTML = "<p>Nenhum artigo de documentação cadastrado ainda.</p>";
      el.tocLista.innerHTML = "";
      return;
    }
    modoMarkdown = false;
    renderArtigo(art);
    el.conteudo.scrollTo({ top: 0 });
  }

  window.addEventListener("hashchange", carregarPorHash);
  el.filtro.addEventListener("input", () => renderArvore(el.filtro.value));

  renderArvore();
  carregarPorHash();
})();
