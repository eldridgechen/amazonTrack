// ==UserScript==
// @name         Amazon 物流号与包裹商品金额助手
// @namespace    https://github.com/eldridgechen/amazonTrack
// @version      1.1.2
// @description  从 Amazon 物流详情页精确读取运单号，提供本地复核、导出与报单状态工作台。
// @match        https://www.amazon.com/your-orders/*
// @match        https://www.amazon.com/gp/css/order-history*
// @match        https://www.amazon.com/progress-tracker/*
// @match        https://www.amazon.com/gp/progress-tracker/*
// @match        https://www.amazon.com/gp/your-account/order-details*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const BUTTON_ID = 'amazon-tracking-assistant-button';
  const PANEL_ID = 'amazon-tracking-assistant-panel';
  const STORAGE_KEY = 'amazon-tracking-assistant-submissions-v1';
  const SCRIPT_VERSION = '1.1.2';
  const ORDER_RE = /\b\d{3}-\d{7}-\d{7}\b/g;

  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const unique = values => [...new Set(values.filter(Boolean))];
  const orderIds = value => unique(String(value || '').match(ORDER_RE) || []);

  // Amazon 有时会把界面附加的 SEE 一并放进 TBA 单号；只移除严格的末尾后缀。
  function normalizeTracking(value) {
    return text(value).toUpperCase().replace(/^(TBA\d+)SEE$/, '$1');
  }

  // 这是参考脚本成功使用的字段。不得用页面上其他文本或链接猜测单号。
  function trackingFromDeliveryCard(doc) {
    const field = doc.querySelector('.pt-delivery-card-trackingId');
    if (!field) return '';

    const raw = text(field.textContent);
    const labelled = raw.match(/(?:tracking\s*(?:id|number|#)?|运单号|追踪号)\s*[:#-]\s*([^\s]+)/i);
    // 未带标签时仅采用该专用字段的完整文本，不能从链接、订单号或其他页面文字推测。
    return normalizeTracking(labelled ? labelled[1] : raw.replace(/^[^:：]+[:：]\s*/, ''));
  }

  function absoluteUrl(value) {
    try { return new URL(value, location.href); } catch (_) { return null; }
  }

  function sameOrigin(url) {
    const parsed = absoluteUrl(url);
    return parsed && parsed.origin === location.origin ? parsed.href : '';
  }

  function isTrackingLink(link) {
    const href = link.href || '';
    const label = `${link.innerText || ''} ${link.getAttribute('aria-label') || ''}`;
    return /track_package|progress-tracker|tracking|track/i.test(`${href} ${label}`);
  }

  function findOrderCards() {
    const cards = [...document.querySelectorAll('[data-order-id], .yohtmlc-order-card, .a-box-group')];
    return cards.filter(card => !cards.some(parent => parent !== card && parent.contains(card)));
  }

  function packageLinks() {
    const seen = new Map();
    for (const card of findOrderCards()) {
      const fallbackOrder = orderIds(card.innerText)[0] || card.getAttribute('data-order-id') || '';
      for (const link of card.querySelectorAll('a[href]')) {
        if (!isTrackingLink(link)) continue;
        const url = sameOrigin(link.href);
        if (url && !seen.has(url)) seen.set(url, { url, fallbackOrder });
      }
    }
    // Supports running directly on an individual progress-tracker page.
    if (!seen.size && /progress-tracker/i.test(location.pathname)) {
      seen.set(location.href, { url: location.href, fallbackOrder: '' });
    }
    return [...seen.values()].slice(0, 80);
  }

  function packageOrderLinks(doc) {
    const links = new Map();
    for (const link of doc.querySelectorAll('a[href*="order-details"]')) {
      const url = sameOrigin(link.href);
      const id = orderIds(`${link.href} ${link.innerText}`)[0];
      if (url && id) links.set(id, url);
    }
    return links;
  }

  function packageOrders(doc, fallbackOrder) {
    const explicit = [...packageOrderLinks(doc).keys()];
    // 页面全文可能包含推荐或历史订单；详情链接是唯一高置信度来源。
    // 无显式链接时仅使用发起订单卡的回退值，并强制标为待复核。
    return explicit.length ? { ids: explicit, confidence: '已确认' } : {
      ids: fallbackOrder ? [fallbackOrder] : [],
      confidence: '待复核'
    };
  }

  function asinFromElement(element) {
    if (!element) return '';
    const link = element.matches?.('a[href]') ? element : element.querySelector?.('a[href*="/dp/"],a[href*="/gp/product/"]');
    const source = `${link?.href || ''} ${element.getAttribute?.('data-asin') || ''}`;
    return (source.match(/(?:\/dp\/|\/gp\/product\/|data-asin[=:/]?)([A-Z0-9]{10})/i) || [])[1]?.toUpperCase() || '';
  }

  function imageKey(image) {
    const source = image?.currentSrc || image?.src || '';
    return (source.match(/\/images\/I\/([^._/]+)/i) || [])[1]?.toLowerCase() || '';
  }

  function compactProductName(value) {
    const title = text(value);
    if (!title) return '待识别';
    if (/\biPad Air\b/i.test(title)) {
      const chip = title.match(/\bM\d+\b/i)?.[0]?.toUpperCase();
      return chip ? `iPad Air ${chip}` : 'iPad Air';
    }
    if (/\bMacBook Air\b/i.test(title)) {
      const size = title.match(/\b(\d{2})(?:\.\d+)?-inch\b/i)?.[1];
      return size ? `MacBook Air ${size}` : 'MacBook Air';
    }
    return title.length > 36 ? `${title.slice(0, 35)}…` : title;
  }

  function packageItems(doc) {
    const scope = doc.querySelector('.pt-delivery-card') || doc.body;
    const items = new Map();
    for (const image of scope.querySelectorAll('img')) {
      const key = imageKey(image);
      const asin = asinFromElement(image.closest('a, [data-asin], li, div'));
      if (!asin && !key) continue;
      const container = image.closest('[data-asin], li, .a-section, div') || image.parentElement;
      const nearby = text(container?.innerText);
      const quantity = Number((nearby.match(/(?:qty|quantity)\s*:?\s*(\d+)/i) || [])[1] || 1);
      const identity = asin ? `asin:${asin}` : `image:${key}`;
      const productLink = container?.querySelector?.('a[href*="/dp/"],a[href*="/gp/product/"]');
      const title = compactProductName(productLink?.innerText || productLink?.getAttribute('aria-label') || '');
      if (!items.has(identity)) items.set(identity, { asin, key, quantity, title });
    }
    return [...items.values()];
  }

  function amountFromItem(container) {
    const value = text(container?.innerText);
    // Deliberately require an item-level price label; totals, tax and order subtotals are excluded.
    const match = value.match(/(?:item\s*price|price)\s*:?\s*\$\s*([\d,]+\.\d{2})/i);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }

  function orderItems(doc, orderId) {
    const found = new Map();
    for (const image of doc.querySelectorAll('img')) {
      const key = imageKey(image);
      const container = image.closest('[data-asin], .a-box, .a-section, li, div');
      const asin = asinFromElement(container) || asinFromElement(image.closest('a'));
      if (!asin && !key) continue;
      const price = amountFromItem(container);
      const quantity = Number((text(container?.innerText).match(/(?:qty|quantity)\s*:?\s*(\d+)/i) || [])[1] || 1);
      const identity = asin ? `asin:${asin}` : `image:${key}`;
      if (!found.has(identity)) found.set(identity, { asin, key, price, quantity, orderId });
    }
    return [...found.values()];
  }

  async function fetchDocument(url) {
    const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }

  async function resolveAmount(doc, orders) {
    const packageProductList = packageItems(doc);
    const links = packageOrderLinks(doc);
    const products = [];
    for (const [id, url] of links) {
      try { products.push(...orderItems(await fetchDocument(url), id)); } catch (_) { /* pending */ }
    }
    if (!packageProductList.length || !products.length) return { amount: null, state: '待识别' };

    let total = 0;
    const matched = [];
    for (const pkg of packageProductList) {
      const candidates = products.filter(product =>
        (pkg.asin && product.asin === pkg.asin) || (!pkg.asin && pkg.key && product.key === pkg.key)
      );
      // Ambiguous identity, missing unit price, or incompatible quantities must not be charged to the package.
      if (candidates.length !== 1 || candidates[0].price === null || pkg.quantity > candidates[0].quantity) {
        return { amount: null, state: '待识别' };
      }
      total += candidates[0].price * pkg.quantity;
      matched.push(candidates[0]);
    }
    return { amount: total, state: '已确认', matched };
  }

  function loadSubmissionState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  }

  function saveSubmissionState(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) { /* Storage unavailable. */ }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function itemSummary(items) {
    return items.map(item => `${item.title || '待识别'} ×${item.quantity}`).join('；');
  }

  function mergeItems(first, second) {
    const merged = new Map();
    for (const item of [...(first || []), ...(second || [])]) {
      const identity = item.asin ? `asin:${item.asin}` : item.key ? `image:${item.key}` : `title:${item.title}`;
      const old = merged.get(identity);
      merged.set(identity, old ? { ...old, quantity: Math.max(old.quantity, item.quantity) } : item);
    }
    return [...merged.values()];
  }

  function downloadCsv(rows) {
    const header = ['tracking_number', 'items', 'order_ids', 'amount_usd', 'amount_state', 'order_state', 'submission_state'];
    const body = rows.map(row => [row.tracking, itemSummary(row.items || []), row.orders.join(','), row.state === '已确认' ? row.amount.toFixed(2) : '', row.state, row.orderConfidence, row.submissionState].map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${header.join(',')}\r\n${body}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `amazon-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function runExtraction() {
    const button = document.getElementById(BUTTON_ID);
    button.disabled = true;
    button.textContent = '正在读取物流页…';
    const links = packageLinks();
    const byTracking = new Map();
    let visited = 0;
    let missingTrackingField = 0;
    const errors = [];
    for (const link of links) {
      try {
        const doc = await fetchDocument(link.url);
        visited += 1;
        const tracking = trackingFromDeliveryCard(doc);
        if (!tracking) { missingTrackingField += 1; continue; }
        const orderResult = packageOrders(doc, link.fallbackOrder);
        const products = packageItems(doc);
        const value = await resolveAmount(doc, orderResult.ids);
        const old = byTracking.get(tracking);
        byTracking.set(tracking, {
          tracking,
          items: mergeItems(old?.items, products),
          orders: unique([...(old?.orders || []), ...orderResult.ids]),
          orderConfidence: old?.orderConfidence === '待复核' || orderResult.confidence === '待复核' ? '待复核' : '已确认',
          amount: old?.state === '待识别' || value.state === '待识别' ? null : value.amount,
          state: old?.state === '待识别' || value.state === '待识别' ? '待识别' : value.state
        });
      } catch (error) {
        errors.push(error?.message || '读取或解析失败');
      }
    }
    showPanel([...byTracking.values()], {
      candidateLinks: links.length,
      visited,
      missingTrackingField,
      errors,
      orderCards: findOrderCards().length
    });
    button.disabled = false;
    button.textContent = '重新提取物流号';
  }

  function copy(value) {
    return navigator.clipboard?.writeText(value).catch(() => {
      const area = document.createElement('textarea'); area.value = value; document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    });
  }

  function showPanel(rows, summary) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) { panel = document.createElement('div'); panel.id = PANEL_ID; document.body.append(panel); }
    Object.assign(panel.style, { position: 'fixed', top: '60px', right: '18px', width: 'min(920px,94vw)', maxHeight: '82vh', overflow: 'auto', zIndex: 999999, background: '#fff', color: '#111', padding: '14px', border: '1px solid #aaa', borderRadius: '8px', font: '13px Arial,sans-serif' });
    const saved = loadSubmissionState();
    const selected = new Set(rows.map(row => row.tracking));
    const make = (tag, value) => { const element = document.createElement(tag); if (value !== undefined) element.textContent = value; return element; };
    let query = '';

    const render = () => {
      const visible = rows.filter(row => !query || `${row.tracking} ${row.orders.join(' ')}`.toUpperCase().includes(query));
      const selectedRows = () => visible.filter(row => selected.has(row.tracking)).map(row => ({ ...row, submissionState: saved[row.tracking]?.status || '待报单' }));
      panel.replaceChildren();
      const header = make('div'); Object.assign(header.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
      const close = make('button', '关闭'); close.onclick = () => panel.remove(); header.append(make('strong', 'Amazon 物流工作台'), close); panel.append(header);
      panel.append(make('p', `已读取 ${summary.visited} 个物流页面，识别 ${rows.length} 个单号；异常 ${summary.errors.length} 个。`));
      const warning = make('p', '仅从 .pt-delivery-card-trackingId 读取单号。“待复核”表示只能从订单卡回退关联；“已报单（本地）”不是平台成功回执。'); warning.style.color = '#8a4b00'; panel.append(warning);
      const controls = make('div'); Object.assign(controls.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' });
      const filter = document.createElement('input'); filter.placeholder = '筛选物流号或订单号'; filter.value = query; filter.oninput = () => { query = filter.value.trim().toUpperCase(); render(); };
      const copyNumbers = make('button', '复制单号'); copyNumbers.onclick = () => copy(selectedRows().map(row => row.tracking).join('\n'));
      const copyTable = make('button', '复制 TSV'); copyTable.onclick = () => copy(selectedRows().map(row => `${row.tracking}\t${itemSummary(row.items || [])}\t${row.state === '已确认' ? `$${row.amount.toFixed(2)}` : '待识别'}\t${row.orders.join(',')}\t${row.orderConfidence}\t${row.submissionState}`).join('\n'));
      const exportCsv = make('button', '导出 CSV'); exportCsv.onclick = () => downloadCsv(selectedRows());
      const diagnostic = make('button', '复制诊断报告');
      diagnostic.onclick = () => copy([
        `Amazon Tracking Assistant ${SCRIPT_VERSION}`,
        `页面路径: ${location.pathname}`,
        `订单卡: ${summary.orderCards}`,
        `候选物流链接: ${summary.candidateLinks}`,
        `已读取物流页: ${summary.visited}`,
        `识别物流号: ${rows.length}`,
        `缺少 .pt-delivery-card-trackingId: ${summary.missingTrackingField}`,
        `读取异常: ${summary.errors.length}`,
        '数据策略: 仅从 .pt-delivery-card-trackingId 读取物流号；页面全文不用于推测订单关联。'
      ].join('\n'));
      controls.append(filter, copyNumbers, copyTable, exportCsv, diagnostic); panel.append(controls);
      const table = make('table'); Object.assign(table.style, { width: '100%', borderCollapse: 'collapse' });
      const head = make('thead'); const headRow = make('tr'); const all = document.createElement('input'); all.type = 'checkbox'; all.checked = visible.length > 0 && visible.every(row => selected.has(row.tracking));
      all.onchange = () => { visible.forEach(row => all.checked ? selected.add(row.tracking) : selected.delete(row.tracking)); render(); };
      const allCell = make('th'); allCell.append(all); headRow.append(allCell); ['物流号', '物品', '关联订单', '商品金额', '订单关联', '报单状态'].forEach(label => headRow.append(make('th', label))); head.append(headRow); table.append(head);
      const body = make('tbody');
      for (const row of visible) {
        const tr = make('tr'); tr.style.borderTop = '1px solid #ddd';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(row.tracking); checkbox.onchange = () => checkbox.checked ? selected.add(row.tracking) : selected.delete(row.tracking);
        const choice = make('td'); choice.append(checkbox); tr.append(choice, make('td', row.tracking), make('td', itemSummary(row.items || [])), make('td', row.orders.join(', ') || '未找到'), make('td', row.state === '已确认' ? `$${row.amount.toFixed(2)}` : '待识别'));
        const confidence = make('td', row.orderConfidence); if (row.orderConfidence === '待复核') confidence.style.color = '#8a4b00'; tr.append(confidence);
        const statusCell = make('td'); statusCell.append(make('span', saved[row.tracking]?.status || '待报单'), document.createElement('br'));
        const mark = make('button', saved[row.tracking]?.status === '已报单（本地）' ? '标为待报单' : '标为已报单（本地）');
        mark.onclick = () => { saved[row.tracking] = { status: saved[row.tracking]?.status === '已报单（本地）' ? '待报单' : '已报单（本地）', updatedAt: new Date().toISOString() }; saveSubmissionState(saved); render(); };
        statusCell.append(mark); tr.append(statusCell); body.append(tr);
      }
      table.append(body); panel.append(table);
      if (summary.errors.length) { const details = make('details'); details.append(make('summary', `读取异常（${summary.errors.length}）`)); summary.errors.forEach(error => details.append(make('div', error))); panel.append(details); }
    };
    render();
  }

  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID; button.textContent = '提取物流号及商品金额'; button.onclick = runExtraction;
    Object.assign(button.style, { position: 'fixed', right: '18px', bottom: '18px', zIndex: 999999, padding: '12px 16px', background: '#1768ac', color: '#fff', border: 0, borderRadius: '8px', cursor: 'pointer' });
    document.body.append(button);
  }

  addButton();
  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
})();
