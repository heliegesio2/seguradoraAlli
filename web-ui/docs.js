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
      default:
        return "";
    }
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
