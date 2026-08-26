// Reconhecimento de voz (Web Speech API) reutilizavel: liga um botao de microfone
// a um campo de texto. Usado pelo widget do lead e pelo painel do atendente.
(() => {
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

  window.attachMic = function attachMic(botao, campo) {
    if (!SpeechRecognitionImpl) {
      botao.disabled = true;
      botao.title = "Reconhecimento de voz não suportado neste navegador";
      return;
    }

    const reconhecedor = new SpeechRecognitionImpl();
    reconhecedor.lang = "pt-BR";
    // continuous=true evita que o navegador encerre sozinho so por causa de uma
    // pausa curta na fala - quem decide quando parar e o usuario, no clique.
    reconhecedor.continuous = true;
    reconhecedor.interimResults = true;
    reconhecedor.maxAlternatives = 1;
    let gravando = false;

    function aplicarEstado(estado) {
      botao.classList.remove("is-recording", "is-stopped");
      if (estado) botao.classList.add(estado);
    }

    reconhecedor.onresult = (event) => {
      let textoCompleto = "";
      for (let i = 0; i < event.results.length; i++) {
        textoCompleto += event.results[i][0].transcript;
      }
      campo.value = textoCompleto;
    };

    reconhecedor.onerror = () => {
      gravando = false;
      aplicarEstado(null);
    };

    reconhecedor.onend = () => {
      // Alguns navegadores encerram a sessao de reconhecimento por conta propria
      // (limite interno de tempo) mesmo com continuous=true. Se o usuario ainda
      // nao clicou para parar, reinicia sozinho - quem decide e sempre o clique.
      if (gravando) {
        try {
          reconhecedor.start();
        } catch {
          // ja estava rodando ou o navegador recusou reiniciar - sem problema,
          // o proximo clique do usuario tenta de novo do zero.
        }
      }
    };

    botao.addEventListener("click", () => {
      if (gravando) {
        gravando = false;
        reconhecedor.stop();
        aplicarEstado("is-stopped");
        setTimeout(() => aplicarEstado(null), 600);
        campo.focus();
        return;
      }
      try {
        reconhecedor.start();
        gravando = true;
        aplicarEstado("is-recording");
      } catch (err) {
        console.error(err);
      }
    });
  };
})();
