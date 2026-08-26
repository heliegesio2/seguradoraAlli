(() => {
  const sessao = window.exigirLogin(["atendente", "admin"]);
  if (!sessao) return;

  const API = window.AGENT_API_BASE;

  const el = {
    topbarUsuario: document.getElementById("topbar-usuario"),
    filtroInicio: document.getElementById("filtro-inicio"),
    filtroFim: document.getElementById("filtro-fim"),
    filtroNotaMin: document.getElementById("filtro-nota-min"),
    filtroNotaMax: document.getElementById("filtro-nota-max"),
    filtroAtendente: document.getElementById("filtro-atendente"),
    btnAplicar: document.getElementById("btn-aplicar-filtros"),
    btnLimpar: document.getElementById("btn-limpar-filtros"),
    relHoje: document.getElementById("rel-hoje"),
    relTotal: document.getElementById("rel-total"),
    grafico: document.getElementById("rel-grafico"),
    rankingVolume: document.getElementById("rel-ranking-volume"),
    rankingNotas: document.getElementById("rel-ranking-notas"),
  };

  el.topbarUsuario.textContent = `${sessao.nome} (${sessao.papel})`;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function hojeIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function isoMenosDias(dias) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10);
  }

  // Período padrão: últimos 30 dias - da pra ampliar pelos filtros.
  el.filtroInicio.value = isoMenosDias(29);
  el.filtroFim.value = hojeIso();

  function renderRanking(elemento, itens, formatarValor) {
    elemento.innerHTML = "";
    if (!itens.length) {
      elemento.textContent = "sem dados no período/filtro selecionado";
      return;
    }
    itens.forEach((item) => {
      const row = document.createElement("div");
      row.className = "rel-row";
      row.innerHTML = `
        <span class="rel-row__principal">
          ${window.avatarHtml(item.atendente, item.foto, 28)}
          <span class="rel-row__nome">${escapeHtml(item.atendente)}</span>
        </span>
        <span class="rel-row__valor">${formatarValor(item)}</span>
      `;
      elemento.appendChild(row);
    });
  }

  function renderGrafico(serie) {
    if (!serie.length) {
      el.grafico.innerHTML = '<p class="hint">Sem atendimentos no período selecionado.</p>';
      return;
    }
    const largura = 860;
    const altura = 220;
    const padding = 28;
    const n = serie.length;
    const max = Math.max(1, ...serie.map((p) => p.total));
    const larguraUtil = largura - padding * 2;
    const passoX = larguraUtil / n;
    const barW = Math.max(1.5, passoX - 2);
    const escalaY = (altura - padding * 2) / max;
    const passoLabel = Math.max(1, Math.ceil(n / 12)); // no maximo ~12 labels no eixo X

    let barras = "";
    let labels = "";
    serie.forEach((ponto, i) => {
      const x = padding + i * passoX;
      const h = ponto.total * escalaY;
      const y = altura - padding - h;
      barras += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" style="fill:var(--md-primary)"><title>${ponto.data}: ${ponto.total} atendimento(s)</title></rect>`;
      if (i % passoLabel === 0 || i === n - 1) {
        const dataFmt = ponto.data.slice(5).split("-").reverse().join("/");
        labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${altura - padding + 14}" font-size="9" text-anchor="middle" style="fill:var(--md-on-surface-variant)">${dataFmt}</text>`;
      }
    });

    el.grafico.innerHTML = `
      <svg viewBox="0 0 ${largura} ${altura}" class="rel-grafico__svg" preserveAspectRatio="none">
        <line x1="${padding}" y1="${altura - padding}" x2="${largura - padding}" y2="${altura - padding}"
          style="stroke:var(--md-outline)" stroke-width="1" />
        ${barras}
        ${labels}
      </svg>`;
  }

  function construirQuery() {
    const params = new URLSearchParams();
    if (el.filtroInicio.value) params.set("data_inicio", el.filtroInicio.value);
    if (el.filtroFim.value) params.set("data_fim", el.filtroFim.value);
    if (el.filtroNotaMin.value) params.set("nota_min", el.filtroNotaMin.value);
    if (el.filtroNotaMax.value) params.set("nota_max", el.filtroNotaMax.value);
    if (el.filtroAtendente.value.trim()) params.set("atendente", el.filtroAtendente.value.trim());
    return params.toString();
  }

  async function carregar() {
    el.grafico.innerHTML = "carregando…";
    try {
      const resp = await fetch(`${API}/reports/summary?${construirQuery()}`, {
        headers: window.authHeaders(),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.detail || "Falha ao carregar relatórios.");

      el.relHoje.textContent = dados.atendimentos_hoje;
      el.relTotal.textContent = dados.total_atendimentos;
      renderGrafico(dados.serie_temporal);
      renderRanking(el.rankingVolume, dados.ranking_volume, (item) => `${item.total} atendimento(s)`);
      renderRanking(el.rankingNotas, dados.ranking_notas, (item) => `${item.media_nota}/10 (${item.avaliacoes})`);
    } catch (err) {
      el.grafico.innerHTML = '<p class="hint">Não foi possível carregar os relatórios.</p>';
      console.error(err);
    }
  }

  el.btnAplicar.addEventListener("click", carregar);
  el.btnLimpar.addEventListener("click", () => {
    el.filtroInicio.value = isoMenosDias(29);
    el.filtroFim.value = hojeIso();
    el.filtroNotaMin.value = "";
    el.filtroNotaMax.value = "";
    el.filtroAtendente.value = "";
    carregar();
  });

  carregar();
})();
