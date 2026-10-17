  function parseMercadoLivreCsv(text) {
    var linhas = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (linhas.length < 2) return { novas: [], ignoradas: 0 };
    var header = linhas[0].split(';');
    var idxTipo = header.indexOf('TRANSACTION_TYPE');
    var idxData = header.indexOf('TRANSACTION_DATE');
    var idxValor = header.indexOf('REAL_AMOUNT');
    var idxSource = header.indexOf('SOURCE_ID');
    if (idxTipo === -1 || idxValor === -1) return { novas: [], ignoradas: 0, erro: true };
    var novas = [];
    var ignoradas = 0;
    for (var i = 1; i < linhas.length; i++) {
      var cols = linhas[i].split(';');
      var tipoRaw = (cols[idxTipo] || '').trim();
      var valor = parseFloat(cols[idxValor]);
      var dataRaw = (cols[idxData] || '').trim();
      var data = dataRaw ? dataRaw.split('T')[0] : '';
      var sourceId = (cols[idxSource] || '').trim();
      var origemId = 'ml-' + sourceId + '-' + tipoRaw + '-' + i;
      if (isNaN(valor) || !data) { continue; }
      var tipoFinal = null;
      if (tipoRaw === 'SETTLEMENT' || tipoRaw === 'SETTLEMENT_SHIPPING') tipoFinal = 'venda';
      else if (tipoRaw === 'REFUND') tipoFinal = 'reembolso';
      else if (tipoRaw === 'DISPUTE') tipoFinal = 'devolucao';
      if (!tipoFinal) { ignoradas++; continue; }
      if (jaImportado(origemId)) { ignoradas++; continue; }
      novas.push({
        id: uid(), origemId: origemId, data: data, tipo: tipoFinal,
        descricao: 'Mercado Livre - pedido ' + sourceId + ' (' + tipoRaw + ')',
        valor: Math.abs(valor)
      });
    }
    return { novas: novas, ignoradas: ignoradas };
  }

  function parseShopeeRows(rows) {
    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].indexOf('Tipo de transação') !== -1) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return { novas: [], ignoradas: 0, erro: true };
    var novas = [];
    var ignoradas = 0;
    for (var i = headerIdx + 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || r.length < 6) continue;
      var dataRaw = String(r[0] || '').trim();
      var tipoRaw = String(r[1] || '').trim();
      var descricao = String(r[2] || '').trim();
      var idPedido = String(r[3] || '').trim();
      var direcao = String(r[4] || '').trim();
      var valor = parseFloat(r[5]);
      if (!dataRaw || isNaN(valor)) continue;
      var data = dataRaw.split(' ')[0];
      var origemId = 'shopee-' + idPedido + '-' + tipoRaw + '-' + i;
      var tipoFinal = null;
      var descLower = descricao.toLowerCase();
      if (tipoRaw === 'Saques' || tipoRaw === 'Shopee Acelera') {
        ignoradas++; continue;
      } else if (tipoRaw === 'Renda do pedido') {
        tipoFinal = direcao === 'Entrada' ? 'venda' : 'despesa';
      } else if (tipoRaw === 'Ajuste') {
        tipoFinal = (descLower.indexOf('reembolso') !== -1 || descLower.indexOf('devolução') !== -1 || descLower.indexOf('devolucao') !== -1) ? 'reembolso' : 'despesa';
      } else if (tipoRaw === 'Saldo da Carteira - Pagamento') {
        tipoFinal = 'despesa';
      } else {
        ignoradas++; continue;
      }
      if (jaImportado(origemId)) { ignoradas++; continue; }
      novas.push({
        id: uid(), origemId: origemId, data: data, tipo: tipoFinal,
        descricao: 'Shopee - ' + (descricao || tipoRaw) + (idPedido && idPedido !== '-' ? ' (' + idPedido + ')' : ''),
        valor: Math.abs(valor)
      });
    }
    return { novas: novas, ignoradas: ignoradas };
  }

  function processarArquivo(file, onDone) {
    var nome = file.name.toLowerCase();
    if (nome.endsWith('.json')) {
      var readerJson = new FileReader();
      readerJson.onload = function (e) { onDone(parseApiJson(e.target.result, 'api-ml-', 'Mercado Livre'), 'Mercado Livre (API)'); };
      readerJson.onerror = function () { onDone({ novas: [], ignoradas: 0, erro: true }, '—'); };
      readerJson.readAsText(file);
    } else if (nome.endsWith('.csv')) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var texto = e.target.result;
        if (texto.indexOf('TRANSACTION_TYPE') !== -1) {
          onDone(parseMercadoLivreCsv(texto), 'Mercado Livre');
        } else {
          // tenta como planilha shopee exportada em csv (linhas separadas por vírgula)
          var linhas = texto.split(/\r?\n/).map(function (l) { return l.split(','); });
          onDone(parseShopeeRows(linhas), 'Shopee');
        }
      };
      reader.onerror = function () { onDone({ novas: [], ignoradas: 0, erro: true }, '—'); };
      reader.readAsText(file);
    } else {
      var reader2 = new FileReader();
      reader2.onload = function (e) {
        try {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: 'array' });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
          onDone(parseShopeeRows(rows), 'Shopee');
        } catch (err) {
          onDone({ novas: [], ignoradas: 0, erro: true }, '—');
        }
      };
      reader2.onerror = function () { onDone({ novas: [], ignoradas: 0, erro: true }, '—'); };
      reader2.readAsArrayBuffer(file);
    }
  }

  function renderImportarTab(wrap) {
    var pendentesEstoque = state.transacoes.filter(function (t) { return t.tipo === 'venda' && Array.isArray(t.itens) && !t.estoqueAplicado; });
    if (pendentesEstoque.length > 0) {
      var pendCard = el('div', { class: 'pml-card' });
      pendCard.appendChild(el('p', { class: 'pml-section-title', text: 'Baixa de estoque pendente' }));
      pendCard.appendChild(el('p', { style: 'font-size:13px; color:var(--muted); margin:0 0 12px; line-height:1.6;', text: 'Existem ' + pendentesEstoque.length + ' venda(s) já registradas que ainda não descontaram o estoque (normalmente porque o produto foi cadastrado ou ligado ao código do anúncio depois da venda ter sido importada). Clique para aplicar agora.' }));
      var resultPend = el('div', {});
      pendCard.appendChild(el('button', {
        class: 'pml-btn', text: 'Aplicar baixa de estoque agora',
        onclick: function () {
          salvarSnapshotUndo();
          var baixas = baixarEstoquePorVendas(pendentesEstoque);
          saveProdutos();
          saveTransacoes();
          resultPend.innerHTML = '';
          resultPend.appendChild(el('div', { class: 'pml-import-summary', style: 'margin-top:10px;', html: baixas.length > 0 ? ('<b>Estoque atualizado:</b><br>' + baixas.join('<br>')) : 'Nenhum produto cadastrado corresponde ao código dessas vendas ainda.' }));
          render();
        }
      }));
      pendCard.appendChild(resultPend);
      wrap.appendChild(pendCard);
    }

    var syncCard = el('div', { class: 'pml-card' });
    syncCard.appendChild(el('p', { class: 'pml-section-title', text: 'Sincronização automática (Mercado Livre)' }));
    syncCard.appendChild(el('p', { style: 'font-size:13px; color:var(--muted); margin:0 0 12px; line-height:1.6;', text: 'Cole aqui a URL do seu arquivo na nuvem (gist) uma única vez. Toda vez que você abrir esse painel, ele busca sozinho os dados mais recentes, sem precisar importar arquivo.' }));
    var urlInput = el('input', { type: 'text', placeholder: 'https://gist.githubusercontent.com/.../pedidos_classificados.json', value: state.gistUrl, style: 'width:100%; padding:8px 10px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; margin-bottom:10px;' });
    syncCard.appendChild(urlInput);
    var btnRow = el('div', { style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;' });
    var salvarBtn = el('button', {
      class: 'pml-btn', text: 'Salvar e sincronizar agora',
      onclick: function () {
        salvarGistUrl(urlInput.value.trim());
        sincronizarGist(false);
      }
    });
    btnRow.appendChild(salvarBtn);
    if (state.gistUrl) {
      var atualizarBtn = el('button', {
        class: 'pml-btn secondary', style: 'color:var(--good); border-color:var(--line);', text: state.sincronizando ? 'Sincronizando...' : 'Sincronizar agora',
        onclick: function () { sincronizarGist(false); }
      });
      btnRow.appendChild(atualizarBtn);
    }
    syncCard.appendChild(btnRow);
    if (state.ultimaSincronizacao) {
      syncCard.appendChild(el('p', { style: 'font-size:12px; color:var(--muted); margin-top:10px;', text: 'Última sincronização: ' + state.ultimaSincronizacao }));
    }
    if (state.ultimaBaixaEstoque && state.ultimaBaixaEstoque.length > 0) {
      syncCard.appendChild(el('div', { class: 'pml-import-summary', style: 'margin-top:10px;', html: '<b>Estoque atualizado na última sincronização:</b><br>' + state.ultimaBaixaEstoque.join('<br>') }));
    }
    wrap.appendChild(syncCard);

    var syncCardShopee = el('div', { class: 'pml-card' });
    syncCardShopee.appendChild(el('p', { class: 'pml-section-title', text: 'Sincronização automática (Shopee)' }));
    syncCardShopee.appendChild(el('p', { style: 'font-size:13px; color:var(--muted); margin:0 0 12px; line-height:1.6;', text: 'Cole aqui a URL do arquivo pedidos_shopee.json do seu gist. Funciona igual à sincronização do Mercado Livre, só que pros dados da Shopee.' }));
    var urlInputShopee = el('input', { type: 'text', placeholder: 'https://gist.githubusercontent.com/.../pedidos_shopee.json', value: state.gistUrlShopee, style: 'width:100%; padding:8px 10px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; margin-bottom:10px;' });
    syncCardShopee.appendChild(urlInputShopee);
    var btnRowShopee = el('div', { style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;' });
    var salvarBtnShopee = el('button', {
      class: 'pml-btn', text: 'Salvar e sincronizar agora',
      onclick: function () {
        salvarGistUrlShopee(urlInputShopee.value.trim());
        sincronizarGistShopee(false);
      }
    });
    btnRowShopee.appendChild(salvarBtnShopee);
    if (state.gistUrlShopee) {
      var atualizarBtnShopee = el('button', {
        class: 'pml-btn secondary', style: 'color:var(--good); border-color:var(--line);', text: state.sincronizandoShopee ? 'Sincronizando...' : 'Sincronizar agora',
        onclick: function () { sincronizarGistShopee(false); }
      });
      btnRowShopee.appendChild(atualizarBtnShopee);
    }
    syncCardShopee.appendChild(btnRowShopee);
    if (state.ultimaSincronizacaoShopee) {
      syncCardShopee.appendChild(el('p', { style: 'font-size:12px; color:var(--muted); margin-top:10px;', text: 'Última sincronização: ' + state.ultimaSincronizacaoShopee }));
    }
    wrap.appendChild(syncCardShopee);

    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Importar relatório manualmente' }));
    card.appendChild(el('p', { style: 'font-size:13px; color:var(--muted); margin:0 0 12px; line-height:1.6;', text: 'Envie o arquivo pedidos_classificados.json ou pedidos_shopee.json gerados pelo script de integração automática, o relatório financeiro do Mercado Livre (CSV de settlement) ou o relatório de transações da Shopee (XLSX ou CSV). O painel identifica o formato sozinho.' }));

    var drop = el('div', { class: 'pml-drop' });
    drop.appendChild(el('span', { text: '📄 Selecione o arquivo (.json, .csv, .xlsx ou .xls)' }));
    var fileInput = el('input', { type: 'file', accept: '.json,.csv,.xlsx,.xls' });
    drop.appendChild(fileInput);
    var resultBox = el('div', { style: 'display:none' });
    drop.appendChild(resultBox);
    card.appendChild(drop);

    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      resultBox.style.display = 'block';
      resultBox.innerHTML = '';
      resultBox.appendChild(el('div', { class: 'pml-import-summary', text: 'Lendo arquivo...' }));
      processarArquivo(file, function (resultado, origem) {
        resultBox.innerHTML = '';
        if (resultado.erro) {
          resultBox.appendChild(el('div', { class: 'pml-import-summary', text: 'Não consegui reconhecer o formato desse arquivo. Confere se é o relatório de settlement do Mercado Livre ou o relatório de transações da Shopee.' }));
          return;
        }
        if (resultado.novas.length > 0) {
          salvarSnapshotUndo();
          state.transacoes = state.transacoes.concat(resultado.novas);
          state.transacoes.sort(function (a, b) { return b.data.localeCompare(a.data); });
          saveTransacoes();
        }
        var baixas = baixarEstoquePorVendas(resultado.novas);
        if (baixas.length > 0) { saveProdutos(); }
        var summary = el('div', { class: 'pml-import-summary' });
        summary.appendChild(el('div', { html: '<b>' + origem + '</b>: ' + resultado.novas.length + ' movimentações importadas, ' + resultado.ignoradas + ' ignoradas (saques, adiantamentos ou já importadas anteriormente).' }));
        if (baixas.length > 0) {
          summary.appendChild(el('div', { style: 'margin-top:8px; font-size:12px;', html: '<b>Estoque atualizado:</b><br>' + baixas.join('<br>') }));
        }
        resultBox.appendChild(summary);
        render();
      });
    });

    wrap.appendChild(card);

    var noteCard = el('div', { class: 'pml-card' });
    noteCard.appendChild(el('p', { class: 'pml-section-title', text: 'Como cada tipo é classificado' }));
    var lista = el('div', { class: 'pml-note' });
    lista.innerHTML = '<b>Mercado Livre:</b> SETTLEMENT → venda · REFUND → reembolso · DISPUTE → devolução<br><b>Shopee (API automática):</b> pedido COMPLETED → venda · pedido CANCELLED → cancelamento<br><b>Shopee (planilha importada manualmente):</b> Renda do pedido (entrada) → venda · Ajuste com reembolso/devolução → reembolso · Saldo da Carteira - Pagamento → despesa (ex: anúncios) · Saques e Shopee Acelera → ignorados (não afetam lucro)';
    noteCard.appendChild(lista);
    wrap.appendChild(noteCard);

    var riscoCard = el('div', { class: 'pml-card', style: 'border-color:var(--bad-line);' });
    riscoCard.appendChild(el('p', { class: 'pml-section-title', style: 'color:var(--bad);', text: 'Zona de risco' }));
    if (!state.confirmarLimpeza) {
      riscoCard.appendChild(el('p', { style: 'font-size:13px; color:var(--muted); margin:0 0 12px;', text: 'Apaga todas as ' + state.transacoes.length + ' movimentações financeiras registradas (útil ao trocar de fonte de dados, como agora). O estoque não é afetado.' }));
      riscoCard.appendChild(el('button', {
        class: 'pml-btn secondary', style: 'padding:9px 18px; font-size:14px;', text: 'Limpar dados financeiros',
        onclick: function () { state.confirmarLimpeza = true; render(); }
      }));
    } else {
      riscoCard.appendChild(el('p', { style: 'font-size:13px; color:var(--bad); margin:0 0 12px; font-weight:600;', text: 'Tem certeza? Isso vai apagar as ' + state.transacoes.length + ' movimentações financeiras. Dá pra desfazer logo em seguida com Ctrl+Z, se precisar.' }));
      var confirmRow = el('div', { style: 'display:flex; gap:8px;' });
      confirmRow.appendChild(el('button', {
        class: 'pml-btn', style: 'background:var(--bad);', text: 'Sim, apagar tudo',
        onclick: function () {
          salvarSnapshotUndo();
          state.transacoes = [];
          saveTransacoes();
          state.confirmarLimpeza = false;
          render();
        }
      }));
      confirmRow.appendChild(el('button', {
        class: 'pml-btn secondary', text: 'Cancelar',
        onclick: function () { state.confirmarLimpeza = false; render(); }
      }));
      riscoCard.appendChild(confirmRow);
    }
    wrap.appendChild(riscoCard);
  }

