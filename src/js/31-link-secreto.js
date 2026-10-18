  // ===================== PROTECAO DO LINK DO GIST =====================
  // O link do Gist da acesso a todos os dados (vendas, CPF, contas, custos). Na tela ele fica
  // escondido como senha, com botao de mostrar; ao copiar algo que contenha o link, aparece um
  // aviso. Nao bloqueia: so lembra.

  function pareceLinkSecreto(texto) {
    var t = String(texto || '');
    if (/gist\.github(usercontent)?\.com/i.test(t)) return true;
    var id = state.gistUrl && (String(state.gistUrl).match(/\/([0-9a-f]{20,})\//i) || [])[1];
    return !!(id && t.indexOf(id) !== -1);
  }

  function avisoLinkSecreto() {
    if (document.getElementById('aviso-link')) return;
    var fundo = el('div', { id: 'aviso-link', class: 'aviso-link-fundo', role: 'alertdialog', 'aria-label': 'Cuidado com o link' }, [
      el('div', { class: 'aviso-link-caixa' }, [
        el('div', { style: 'font-size:34px;', text: '🔒' }),
        el('p', { class: 'aviso-link-titulo', text: 'Cuidado: esse é o link secreto dos seus dados' }),
        el('p', { class: 'pml-margin', style: 'line-height:1.6;', text: 'Quem tiver esse link vê suas vendas, seu CPF, suas contas e seus custos. Não cole em grupo, conversa, print, vídeo ou site. Só use para configurar o painel num computador seu.' }),
        el('button', { class: 'pml-btn', text: 'Entendi', onclick: function () { fundo.remove(); } })
      ])
    ]);
    document.body.appendChild(fundo);
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    ['copy', 'cut'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        var alvo = e.target;
        var sel = '';
        if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) sel = String(alvo.value || '').slice(alvo.selectionStart || 0, alvo.selectionEnd || 0) || alvo.value;
        else if (window.getSelection) sel = String(window.getSelection());
        if (pareceLinkSecreto(sel)) setTimeout(avisoLinkSecreto, 50);
      }, true);
    });
    // Botao "mostrar" ao lado dos campos do link (ficam escondidos como senha)
    document.addEventListener('dblclick', function (e) {
      var a = e.target;
      if (a && a.getAttribute && a.getAttribute('data-link-secreto')) { a.type = a.type === 'password' ? 'text' : 'password'; if (a.type === 'text') avisoLinkSecreto(); }
    }, true);
  }
