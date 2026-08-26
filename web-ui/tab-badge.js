// Badge na aba do navegador (favicon + titulo) e som de notificacao - usado
// tanto no site (novas respostas do atendente) quanto no painel do atendente
// (novos handoffs pendentes).
window.criarBadgeAba = function criarBadgeAba({ favicon, letra = "A", cor = "#5b4ff0", tituloBase }) {
  function desenhar(count) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letra, size / 2, size / 2 + 2);

    if (count > 0) {
      const label = count > 9 ? "9+" : String(count);
      const bx = size * 0.76, by = size * 0.24, br = size * 0.27;
      ctx.fillStyle = "#d32f2f";
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${label.length > 1 ? 18 : 24}px 'Segoe UI', sans-serif`;
      ctx.fillText(label, bx, by + 1);
    }
    return canvas.toDataURL("image/png");
  }

  return {
    atualizar(count) {
      favicon.href = desenhar(count);
      document.title = count > 0 ? `(${count > 9 ? "9+" : count}) ${tituloBase}` : tituloBase;
    },
  };
};

// Sininho sintetizado (sem arquivo de audio externo) - um "ding" curto.
window.tocarSininho = function tocarSininho() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (err) {
    console.error(err);
  }
};
