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
    reconhecedor.interimResults = false;
    reconhecedor.maxAlternatives = 1;
    let gravando = false;

    function pararGravacao() {
      gravando = false;
      botao.classList.remove("is-recording");
    }

    reconhecedor.onresult = (event) => {
      campo.value = event.results[0][0].transcript;
      campo.focus();
    };
    reconhecedor.onerror = pararGravacao;
    reconhecedor.onend = pararGravacao;

    botao.addEventListener("click", () => {
      if (gravando) {
        reconhecedor.stop();
        pararGravacao();
        return;
      }
      try {
        reconhecedor.start();
        gravando = true;
        botao.classList.add("is-recording");
      } catch (err) {
        console.error(err);
      }
    });
  };
})();
