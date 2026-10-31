// ==UserScript==
// @name         Amazon 物流号与包裹商品金额助手
// @namespace    https://github.com/eldridgechen/amazonTrack
// @version      1.0.0
// @description  从 Amazon 物流详情页精确读取运单号，并保守汇总已确认属于包裹的商品金额。
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
    return normalizeTracking(labelled ? labelled[1] : raw.split(':').slice(1).join(':'));
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
    // If the page does not expose detail links, retain IDs visible on this package page only.
    return unique([...explicit, ...orderIds(doc.body?.innerText || ''), fallbackOrder]);
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
      if (!items.has(identity)) items.set(identity, { asin, key, quantity });
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

  async function runExtraction() {
    const button = document.getElementById(BUTTON_ID);
    button.disabled = true;
    button.textContent = '正在读取物流页…';
    const byTracking = new Map();
    let visited = 0;
    for (const link of packageLinks()) {
      try {
        const doc = await fetchDocument(link.url);
        visited += 1;
        const tracking = trackingFromDeliveryCard(doc);
        if (!tracking) continue;
        const orders = packageOrders(doc, link.fallbackOrder);
        const value = await resolveAmount(doc, orders);
        const old = byTracking.get(tracking);
        byTracking.set(tracking, {
          tracking,
          orders: unique([...(old?.orders || []), ...orders]),
          amount: old?.state === '待识别' || value.state === '待识别' ? null : value.amount,
          state: old?.state === '待识别' || value.state === '待识别' ? '待识别' : value.state
        });
      } catch (_) { /* Continue with other packages. */ }
    }
    showPanel([...byTracking.values()], `已读取 ${visited} 个物流页面；仅显示从 .pt-delivery-card-trackingId 读取到的单号。`);
    button.disabled = false;
    button.textContent = '重新提取物流号';
  }

  function copy(value) {
    return navigator.clipboard?.writeText(value).catch(() => {
      const area = document.createElement('textarea'); area.value = value; document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    });
  }

  function showPanel(rows, status) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) { panel = document.createElement('div'); panel.id = PANEL_ID; document.body.append(panel); }
    Object.assign(panel.style, { position: 'fixed', top: '60px', right: '18px', width: 'min(760px,94vw)', maxHeight: '82vh', overflow: 'auto', zIndex: 999999, background: '#fff', color: '#111', padding: '14px', border: '1px solid #aaa', borderRadius: '8px', font: '13px Arial,sans-serif' });
    const numbers = rows.map(row => row.tracking).join('\n');
    const lines = rows.map(row => `${row.tracking}\t${row.state === '已确认' ? `$${row.amount.toFixed(2)}` : '待识别'}\t${row.orders.join(', ')}`).join('\n');
    panel.innerHTML = `<div style="display:flex;justify-content:space-between"><strong>Amazon 物流号与包裹商品金额</strong><button id="${PANEL_ID}-close">关闭</button></div><p>${status}</p><p><b>物流单号</b> <button id="${PANEL_ID}-copy-numbers">复制</button></p><textarea readonly style="width:100%;height:100px">${numbers}</textarea><p><b>物流号、商品金额、关联订单</b> <button id="${PANEL_ID}-copy-table">复制</button></p><textarea readonly style="width:100%;height:150px">${lines}</textarea><p style="color:#666">“待识别”表示无法唯一匹配包裹商品与订单商品，或没有明确的商品单价；脚本不会以订单总金额代替。</p>`;
    panel.querySelector(`#${PANEL_ID}-close`).onclick = () => panel.remove();
    panel.querySelector(`#${PANEL_ID}-copy-numbers`).onclick = () => copy(numbers);
    panel.querySelector(`#${PANEL_ID}-copy-table`).onclick = () => copy(lines);
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
