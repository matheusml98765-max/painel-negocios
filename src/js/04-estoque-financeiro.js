  function renderEstoqueTab(wrap) {
    renderReposicaoCard(wrap);
    var formError = el('div', { class: 'pml-error', style: 'display:none' });
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Adicionar produto' }));

    var nomeInput = el('input', { placeholder: 'Ex: Fone bluetooth XYZ' });
    var custoInput = el('input', { type: 'number', step: '0.01', placeholder: '0,00' });
    var vendaInput = el('input', { type: 'number', step: '0.01', placeholder: '0,00' });
    var qtdInput = el('input', { type: 'number', step: '1', placeholder: '0' });
    var mlIdInput = el('input', { placeholder: 'Ex: MLB4887954295 (opcional)' });

    var grid = el('div', { class: 'pml-form-grid' }, [
      el('div', { class: 'pml-field' }, [el('label', { text: 'Produto' }), nomeInput]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Preço de custo' }), custoInput]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Preço de venda' }), vendaInput]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Quantidade' }), qtdInput]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Código do anúncio (Mercado Livre / Shopee)' }), mlIdInput])
    ]);
    card.appendChild(grid);
    card.appendChild(formError);

    var addBtn = el('button', {
      class: 'pml-btn', text: 'Adicionar produto',
      onclick: function () {
        var nome = nomeInput.value.trim();
        var custo = custoInput.value;
        var venda = vendaInput.value;
        var qtd = qtdInput.value;
        var mlId = mlIdInput.value.trim();
        if (!nome || custo === '' || venda === '' || qtd === '') {
          formError.textContent = 'Preencha todos os campos antes de adicionar.';
          formError.style.display = 'block';
          return;
        }
        formError.style.display = 'none';
        salvarSnapshotUndo();
        state.produtos.push({ id: uid(), nome: nome, custo: custo, venda: venda, quantidade: qtd, mlItemId: mlId || null });
        saveProdutos();
        render();
      }
    });
    card.appendChild(addBtn);
    wrap.appendChild(card);

    var listCard = el('div', { class: 'pml-card' });
    listCard.appendChild(el('p', { class: 'pml-section-title', text: 'Seus produtos' }));
    if (state.produtos.length === 0) {
      listCard.appendChild(el('div', { class: 'pml-empty', text: 'Nenhum produto cadastrado ainda.' }));
    } else {
      var table = el('table', { class: 'pml-table' });
      table.appendChild(el('tr', {}, [
        el('th', { text: 'Produto' }),
        el('th', { text: 'Custo' }),
        el('th', { text: 'Venda' }),
        el('th', { text: 'Qtd' }),
        el('th', { text: 'Margem' }),
        el('th', { text: 'Cód. anúncio' }),
        el('th', { text: '' })
      ]));
      state.produtos.forEach(function (p) {
        var custo = Number(p.custo) || 0;
        var venda = Number(p.venda) || 0;
        var margem = venda > 0 ? (((venda - custo) / venda) * 100).toFixed(1) : '0.0';

        if (state.editandoProdutoId === p.id) {
          var editNome = el('input', { value: p.nome, style: 'width:100%;' });
          var editCusto = el('input', { type: 'number', step: '0.01', value: p.custo, style: 'width:80px;' });
          var editVenda = el('input', { type: 'number', step: '0.01', value: p.venda, style: 'width:80px;' });
          var editQtd = el('input', { type: 'number', step: '1', value: p.quantidade, style: 'width:60px;' });
          var editMlId = el('input', { value: p.mlItemId || '', style: 'width:110px;' });
          var rowEdit = el('tr', {}, [
            el('td', {}, [editNome]),
            el('td', {}, [editCusto]),
            el('td', {}, [editVenda]),
            el('td', {}, [editQtd]),
            el('td', { class: 'pml-margin', text: '—' }),
            el('td', {}, [editMlId]),
            el('td', { style: 'white-space:nowrap;' }, [
              el('button', {
                class: 'pml-btn', style: 'padding:5px 10px; font-size:12px; margin-right:4px;', text: 'Salvar',
                onclick: function () {
                  salvarSnapshotUndo();
                  p.nome = editNome.value.trim() || p.nome;
                  p.custo = editCusto.value;
                  p.venda = editVenda.value;
                  p.quantidade = editQtd.value;
                  p.mlItemId = editMlId.value.trim() || null;
                  state.editandoProdutoId = null;
                  saveProdutos();
                  render();
                }
              }),
              el('button', {
                class: 'pml-btn secondary', style: 'padding:5px 10px; font-size:12px;', text: 'Cancelar',
                onclick: function () { state.editandoProdutoId = null; render(); }
              })
            ])
          ]);
          table.appendChild(rowEdit);
          return;
        }

        var row = el('tr', {}, [
          el('td', { text: p.nome }),
          el('td', { text: fmtMoney(custo) }),
          el('td', { text: fmtMoney(venda) }),
          el('td', { text: String(p.quantidade) }),
          el('td', { class: 'pml-margin', text: margem + '%' }),
          el('td', { class: 'pml-margin', text: p.mlItemId || '—' }),
          el('td', { style: 'white-space:nowrap;' }, [
            el('button', {
              class: 'pml-btn secondary', style: 'padding:5px 10px; font-size:12px; margin-right:4px;', text: 'Editar',
              onclick: function () { state.editandoProdutoId = p.id; render(); }
            }),
            el('button', {
              class: 'pml-btn secondary', style: 'padding:5px 10px; font-size:12px;', text: 'Remover',
              onclick: function () {
                salvarSnapshotUndo();
                state.produtos = state.produtos.filter(function (x) { return x.id !== p.id; });
                saveProdutos();
                render();
              }
            })
          ])
        ]);
        table.appendChild(row);
      });
      listCard.appendChild(table);
    }
    wrap.appendChild(listCard);
  }

  function renderFinanceiroTab(wrap) {
    var formError = el('div', { class: 'pml-error', style: 'display:none' });
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Lançar movimentação' }));

    var dataInput = el('input', { type: 'date' });
    var tipoSelect = el('select', {}, [
      el('option', { value: 'venda', text: 'Venda' }),
      el('option', { value: 'compra', text: 'Compra' }),
      el('option', { value: 'despesa', text: 'Despesa' }),
      el('option', { value: 'devolucao', text: 'Devolução' }),
      el('option', { value: 'cancelamento', text: 'Cancelamento' }),
      el('option', { value: 'reembolso', text: 'Reembolso' })
    ]);
    var descInput = el('input', { placeholder: 'Ex: Venda fone bluetooth' });
    var valorInput = el('input', { type: 'number', step: '0.01', placeholder: '0,00' });

    var grid = el('div', { class: 'pml-form-grid' }, [
      el('div', { class: 'pml-field' }, [el('label', { text: 'Data' }), dataInput]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Tipo' }), tipoSelect]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Descrição' }), descInput]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Valor' }), valorInput])
    ]);
    card.appendChild(grid);
    card.appendChild(formError);

    var addBtn = el('button', {
      class: 'pml-btn', text: 'Lançar',
      onclick: function () {
        var data = dataInput.value;
        var desc = descInput.value.trim();
        var valor = valorInput.value;
        if (!data || !desc || valor === '') {
          formError.textContent = 'Preencha data, descrição e valor.';
          formError.style.display = 'block';
          return;
        }
        formError.style.display = 'none';
        salvarSnapshotUndo();
        state.transacoes.push({ id: uid(), data: data, tipo: tipoSelect.value, descricao: desc, valor: valor });
        state.transacoes.sort(function (a, b) { return b.data.localeCompare(a.data); });
        saveTransacoes();
        render();
      }
    });
    card.appendChild(addBtn);
    wrap.appendChild(card);

    var listCard = el('div', { class: 'pml-card' });
    listCard.appendChild(el('p', { class: 'pml-section-title', text: 'Movimentações' }));
    if (state.transacoes.length === 0) {
      listCard.appendChild(el('div', { class: 'pml-empty', text: 'Nenhuma movimentação lançada ainda.' }));
    } else {
      var table = el('table', { class: 'pml-table' });
      table.appendChild(el('tr', {}, [
        el('th', { text: 'Data' }),
        el('th', { text: 'Tipo' }),
        el('th', { text: 'Descrição' }),
        el('th', { text: 'Valor' }),
        el('th', { text: 'Origem' }),
        el('th', { text: '' })
      ]));
      state.transacoes.forEach(function (t) {
        var dParts = t.data.split('-');
        var dispData = dParts.length === 3 ? dParts[2] + '/' + dParts[1] + '/' + dParts[0] : t.data;
        var row = el('tr', {}, [
          el('td', { text: dispData }),
          el('td', {}, [el('span', { class: 'pml-badge ' + t.tipo, text: t.tipo })]),
          el('td', { text: t.descricao }),
          el('td', { text: fmtMoney(t.valor) }),
          el('td', { class: 'pml-margin', text: origemLabel(t) }),
          el('td', {}, [el('button', {
            class: 'pml-btn secondary', text: 'Remover',
            onclick: function () {
              salvarSnapshotUndo();
              state.transacoes = state.transacoes.filter(function (x) { return x.id !== t.id; });
              saveTransacoes();
              render();
            }
          })])
        ]);
        table.appendChild(row);
      });
      listCard.appendChild(table);
    }
    wrap.appendChild(listCard);
  }

  function origemLabel(t) {
    if (!t.origemId) return 'Manual';
    if (t.origemId.indexOf('api-ml-') === 0) return 'API Mercado Livre';
    if (t.origemId.indexOf('api-shopee-') === 0) return 'API Shopee';
    if (t.origemId.indexOf('ml-') === 0) return 'Importado ML';
    if (t.origemId.indexOf('shopee-') === 0) return 'Importado Shopee';
    return 'Importado';
  }

  function jaImportado(origemId) {
    return state.transacoes.some(function (t) { return t.origemId === origemId; });
  }

  function baixarEstoquePorVendas(novas) {
    var relatorio = [];
    novas.forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens)) return;
      t.itens.forEach(function (item) {
        if (!item.item_id) return;
        var produto = state.produtos.find(function (p) { return p.mlItemId === item.item_id; });
        if (produto) {
          var qtdVendida = Number(item.quantidade) || 1;
          var qtdAntes = Number(produto.quantidade) || 0;
          produto.quantidade = Math.max(0, qtdAntes - qtdVendida);
          relatorio.push(produto.nome + ': -' + qtdVendida + ' (de ' + qtdAntes + ' para ' + produto.quantidade + ')');
        }
      });
      t.estoqueAplicado = true;
    });
    return relatorio;
  }

