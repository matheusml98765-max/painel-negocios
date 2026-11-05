  // ===================== OFERTAS DO BOT =====================
  // Alertas do bot de ofertas Amazon -> ML (roda no PC do vendedor; manda ofertas.json para o Gist a cada ~20 min).
  // Mostra o que foi alertado, o que virou compra (botões do Telegram), o que acabou e o que espalhou.
  // Só dados de produto: título, preços, margem e links. Nada de número inventado: campo que falta vira "—".

  var filtroOfertas = 'tudo';

  function dadosOfertas() {
    return state.ofertasRemotas || lerLocal('ml-ofertas-remotas', null) || null;
  }

  function quandoCurto(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 16);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function linhaOferta(o) {
    var bug = o.tipo === 'bug';
    var selos = [];
    selos.push(el('span', { class: 'pml-badge ' + (bug ? 'compra' : 'venda'), text: bug ? 'Possível bug' : 'Oferta' }));
    if (o.resultado === 'comprei') selos.push(el('span', { class: 'pml-badge venda', text: '✅ Comprei' }));
    if (o.resultado === 'não comprei') selos.push(el('span', { class: 'pml-badge', text: 'Não comprei' }));
    if (o.acabou) selos.push(el('span', { class: 'pml-badge', text: '❌ Acabou' }));
    if (o.espalhou) selos.push(el('span', { class: 'pml-badge', text: '📈 Espalhou' }));
    if (o.giro === 'baixo') selos.push(el('span', { class: 'pml-badge', text: '🐢 Giro baixo' }));

    var nums = [];
    nums.push('Amazon ' + fmtMoney(Number(o.preco_amazon) || 0));
    if (!bug && o.preco_ml) nums.push('ML ' + fmtMoney(Number(o.preco_ml)));
    if (!bug && o.margem !== undefined && o.margem !== null) nums.push('margem ' + fmtPct(Number(o.margem)));
    if (!bug && o.lucro) nums.push('lucro ' + fmtMoney(Number(o.lucro)));
    if (!bug && o.vendas_dia) nums.push(Number(o.vendas_dia).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' vendas/dia');
    if (bug && o.normal) nums.push('normal ' + fmtMoney(Number(o.normal)));
    if (bug && o.pct) nums.push(fmtPct(Number(o.pct)) + ' abaixo');

    var extras = [quandoCurto(o.data)];
    if (o.fonte) extras.push('fonte: ' + String(o.fonte).replace(/^tg_/, 'Telegram @').replace(/^ml_alta:/, 'mais vendidos do ML: '));
    if (o.risco) extras.push(String(o.risco));
    if (o.atencao) extras.push('⚠️ ' + String(o.atencao));
    if (o.acabou) extras.push('acabou: ' + String(o.acabou));

    var links = el('div', { style: 'display:flex; gap:12px; flex-wrap:wrap; margin-top:4px;' });
    var seguro = function (u) { return /^https:\/\/(www\.)?(amazon\.com\.br|mercadolivre\.com\.br)\//.test(String(u || '')); };
    if (!seguro(o.link_amazon)) o.link_amazon = null;
    if (!seguro(o.link_ml)) o.link_ml = null;
    if (o.link_amazon) links.appendChild(el('a', { href: o.link_amazon, target: '_blank', rel: 'noopener', text: 'Abrir na Amazon' }));
    if (o.link_ml) links.appendChild(el('a', { href: o.link_ml, target: '_blank', rel: 'noopener', text: 'Ver no ML' }));

    return el('div', { class: 'conq-item' }, [
      el('span', { class: 'conq-icone', text: bug ? '🐛' : '🛒' }),
      el('div', { style: 'flex:1; min-width:0;' }, [
        el('div', { style: 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px;' }, selos),
        el('div', { class: 'tarefa-titulo', text: o.titulo || o.asin }),
        el('div', { class: 'pml-margin', text: nums.join(' · ') }),
        el('div', { class: 'pml-margin', text: extras.filter(Boolean).join(' · ') }),
        links
      ])
    ]);
  }

  function renderOfertasTab(wrap) {
    var d = dadosOfertas();
    if (!d || !d.itens) {
      wrap.appendChild(el('div', { class: 'pml-card' }, [
        el('p', { class: 'pml-section-title', text: 'Ofertas do bot' }),
        el('div', { class: 'pml-empty', text: 'Ainda não chegaram dados do bot de ofertas. Ele manda o arquivo ofertas.json para o Gist a cada 20 minutos (precisa das variáveis OFERTAS_GIST_TOKEN e OFERTAS_GIST_ID no PC do bot).' })
      ]));
      return;
    }
    var r = d.resumo_7d || {};
    var respondidos = (r.comprei || 0) + (r.nao_comprei || 0);
    wrap.appendChild(el('div', { class: 'pml-metrics' }, [
      metricaFicha('Ofertas (7 dias)', String(r.alertas || 0), 'aprovadas e enviadas no Telegram', 'pos'),
      metricaFicha('Possíveis bugs (7 dias)', String(r.bugs || 0), 'preço muito abaixo do normal'),
      metricaFicha('Virou compra', respondidos ? (r.comprei || 0) + ' de ' + respondidos : '—', respondidos ? 'pelos botões do Telegram' : 'toque nos botões dos alertas para medir'),
      metricaFicha('Acabaram / espalharam', (r.acabaram || 0) + ' / ' + (r.espalharam || 0), 'preço voltou ou o catálogo lotou')
    ]));

    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Alertas dos últimos ' + (d.dias || 14) + ' dias' }));
    card.appendChild(el('p', { class: 'pml-margin', text: 'Atualizado ' + quandoCurto(d.atualizado) }));
    var filtros = el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin:8px 0;' });
    [['tudo', 'Tudo'], ['oferta', 'Ofertas'], ['bug', 'Bugs'], ['comprei', 'Comprei']].forEach(function (f) {
      filtros.appendChild(el('button', {
        class: 'pml-btn' + (filtroOfertas === f[0] ? '' : ' secondary'), text: f[1],
        onclick: function () { filtroOfertas = f[0]; render(); }
      }));
    });
    card.appendChild(filtros);
    var lista = d.itens.filter(function (o) {
      if (filtroOfertas === 'tudo') return true;
      if (filtroOfertas === 'comprei') return o.resultado === 'comprei';
      return o.tipo === filtroOfertas;
    });
    if (!lista.length) card.appendChild(el('div', { class: 'pml-empty', text: 'Nada aqui ainda.' }));
    lista.slice(0, 120).forEach(function (o) { card.appendChild(linhaOferta(o)); });
    wrap.appendChild(card);
  }
