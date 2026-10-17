  // ===================== COPIA AUTOMATICA NA NUVEM =====================
  // Custos, Calculadora 3D, metas e o que o vendedor lanca aqui (tarefas, CPF, contas, falhas)
  // ficam no navegador. Com um token do GitHub so de "gist", o painel guarda uma copia no
  // mesmo Gist secreto da automacao (backup_painel.json) sempre que algo muda, e a automacao
  // guarda o historico dessa copia no repositorio privado. Tokens nunca entram na copia.

  var CHAVES_NUVEM = CHAVES_BACKUP.concat(['ml-tarefas-local', 'ml-cpf-local', 'ml-contas-local', 'ml-producao-local']);
  var ARQ_BACKUP = 'backup_painel.json';

  function idDoGist(url) {
    var m = String(url || '').match(/gist\.githubusercontent\.com\/[^\/]+\/([0-9a-f]+)/i) || String(url || '').match(/gist\.github\.com\/(?:[^\/]+\/)?([0-9a-f]{20,})/i);
    return m ? m[1] : null;
  }
  function tokenGist() { try { return localStorage.getItem('pml_ml-gist-token') || ''; } catch (e) { return ''; } }

  function montarCopia() {
    var dados = { tipo: 'backup-painel-top-brasil-shop', versao: 2, criadoEm: new Date().toISOString(), chaves: {} };
    CHAVES_NUVEM.forEach(function (k) { try { var v = localStorage.getItem('pml_' + k); if (v !== null) dados.chaves[k] = v; } catch (e) {} });
    return dados;
  }
  function assinatura(d) { return JSON.stringify(d.chaves); }

  async function salvarNaNuvem(forcar) {
    var tk = tokenGist(), id = idDoGist(state.gistUrl);
    if (!tk || !id) return false;
    var d = montarCopia(), ass = assinatura(d);
    if (!forcar && ass === state.ultimaCopiaNuvem) return true;
    try {
      var r = await fetch('https://api.github.com/gists/' + id, {
        method: 'PATCH',
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tk, 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ files: (function () { var f = {}; f[ARQ_BACKUP] = { content: JSON.stringify(d) }; return f; })() })
      });
      if (r.status === 401 || r.status === 403 || r.status === 404) { state.erroNuvem = 'O GitHub recusou o token (venceu ou não tem permissão de gist). Cole um novo.'; return false; }
      if (!r.ok) { state.erroNuvem = 'Não consegui salvar a cópia agora (' + r.status + '). Tento de novo em instantes.'; return false; }
      state.ultimaCopiaNuvem = ass; state.erroNuvem = '';
      try { localStorage.setItem('pml_ml-copia-nuvem-em', d.criadoEm); } catch (e) {}
      return true;
    } catch (e) { state.erroNuvem = 'Sem internet para salvar a cópia agora.'; return false; }
  }

  async function lerCopiaNuvem() {
    if (!state.gistUrl) return null;
    try {
      var r = await fetch(urlArquivoIrmao(state.gistUrl, ARQ_BACKUP) + '?_=' + Date.now());
      if (!r.ok) return null;
      var d = await r.json();
      return d && d.tipo === 'backup-painel-top-brasil-shop' && d.chaves ? d : null;
    } catch (e) { return null; }
  }

  async function restaurarDaNuvem() {
    var d = await lerCopiaNuvem();
    if (!d) { state.erroNuvem = 'Não achei cópia na nuvem ainda.'; render(); return; }
    Object.keys(d.chaves).forEach(function (k) { if (CHAVES_NUVEM.indexOf(k) !== -1) { try { localStorage.setItem('pml_' + k, d.chaves[k]); } catch (e) {} } });
    location.reload();
  }

  // A cada 1 minuto: se algo mudou, salva
  if (typeof setInterval === 'function' && typeof document !== 'undefined' && document.addEventListener) {
    setInterval(function () { if (tokenGist()) salvarNaNuvem(false); }, 60 * 1000);
    window.addEventListener && window.addEventListener('beforeunload', function () { if (tokenGist()) salvarNaNuvem(false); });
  }

  function renderBackupNuvemCard(wrap) {
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Cópia automática na nuvem' })]);
    var em = null; try { em = localStorage.getItem('pml_ml-copia-nuvem-em'); } catch (e) {}
    var tk = tokenGist();
    card.appendChild(el('p', { class: 'pml-margin', style: 'line-height:1.6;', text: tk
      ? 'Ligada. Seus custos, a Calculadora 3D, as metas e o que você lança aqui são copiados para a nuvem sempre que algo muda.' + (em ? ' Última cópia: ' + new Date(em).toLocaleString('pt-BR') + '.' : '')
      : 'Desligada: tudo o que você cadastrou aqui (custos, Calculadora 3D, estoque, metas, falhas) existe só neste navegador. Se limpar os dados do Chrome ou trocar de computador, perde. Para ligar, crie um token do GitHub só com a permissão "gist" e cole abaixo.' }));
    if (state.erroNuvem) card.appendChild(el('p', { class: 'pml-margin', style: 'color:var(--bad); font-weight:700;', text: state.erroNuvem }));
    var inp = el('input', { type: 'password', placeholder: tk ? 'trocar o token (ghp_...)' : 'ghp_...', autocomplete: 'off', style: 'min-width:240px;' });
    card.appendChild(el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;' }, [
      inp,
      el('button', { class: 'pml-btn', text: tk ? 'Trocar token' : 'Ligar cópia', onclick: async function () {
        if (!inp.value.trim()) return;
        try { localStorage.setItem('pml_ml-gist-token', inp.value.trim()); } catch (e) {}
        state.erroNuvem = ''; var ok = await salvarNaNuvem(true); if (!ok) { try { localStorage.removeItem('pml_ml-gist-token'); } catch (e) {} } render();
      } }),
      tk ? el('button', { class: 'pml-btn secondary', text: 'Salvar agora', onclick: async function () { await salvarNaNuvem(true); render(); } }) : null,
      el('button', { class: 'pml-btn secondary', text: 'Restaurar da nuvem', onclick: function () { restaurarDaNuvem(); } }),
      el('a', { href: 'https://github.com/settings/tokens/new?scopes=gist&description=Painel%20Top%20Brasil%20-%20copia%20dos%20custos', target: '_blank', rel: 'noopener', class: 'pml-margin', text: 'Criar o token no GitHub ↗' })
    ].filter(Boolean)));
    card.appendChild(el('p', { class: 'pml-note', text: 'Em outro computador ou no celular: configure a URL do Gist, cole o mesmo token e clique em "Restaurar da nuvem". O token fica só neste navegador e nunca vai para a cópia.' }));
    wrap.appendChild(card);
  }
