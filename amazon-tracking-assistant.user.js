// ==UserScript==
// @name         Amazon 物流号与包裹商品金额助手
// @namespace    https://github.com/eldridgechen/amazonTrack
// @version      1.2.3
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
  const SCRIPT_VERSION = '1.2.3';
  const ORDER_RE = /\b\d{3}-\d{7}-\d{7}\b/g;

  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const unique = values => [...new Set(values.filter(Boolean))];
  const orderIds = value => unique(String(value || '').match(ORDER_RE) || []);

  const LANGUAGE_KEY = 'amazon-tracking-assistant-language-v1';
  const MESSAGES = {
    en: {
      extract: 'Extract packages & amounts', extracting: 'Reading package pages…', again: 'Extract again',
      title: 'Amazon Package Workbench', close: 'Close', language: 'Language', system: 'System language',
      overview: 'Read {visited} package pages; found {count} tracking numbers; {errors} errors.',
      warning: 'Tracking numbers come only from .pt-delivery-card-trackingId. Review means fallback order association. Submitted (local) is not a platform receipt.',
      amountHelp: 'Package item total = confirmed item unit prices × package quantities (USD); excludes tax, shipping and order-level adjustments. Missing prices or ambiguous matches remain unidentified.',
      groupingHelp: 'Items are grouped by model, ignoring recognized colors and storage sizes. Expand to review original names and quantities. Unknown models keep their original names.',
      filter: 'Filter tracking, order or item', copyNumbers: 'Copy tracking numbers', copyTable: 'Copy TSV', csv: 'Export CSV', diagnostic: 'Copy diagnostics',
      tracking: 'Tracking number', orders: 'Linked orders', items: 'Associated items', amount: 'Package item total (USD)', orderState: 'Order association', submission: 'Submission status',
      confirmed: 'Confirmed', review: 'Needs review', unknown: 'Unidentified', notFound: 'Not found',
      pending: 'Pending submission', submitted: 'Submitted (local)', markPending: 'Mark pending', markSubmitted: 'Mark submitted (local)',
      details: 'Original items', errors: 'Read errors ({count})', selectAll: 'Select all visible packages', selectRow: 'Select package {tracking}',
      partial: 'Some items or quantities need review', failed: 'Read or parse failed',
      diagPath: 'Page path', diagCards: 'Order cards', diagLinks: 'Candidate links', diagVisited: 'Pages read', diagFound: 'Tracking numbers found', diagMissing: 'Missing tracking field', diagErrors: 'Read errors',
      diagPolicy: 'Policy: dedicated tracking field only; no whole-page guesses for order associations.'
    },
    'zh-CN': {
      extract: '提取物流号及商品金额', extracting: '正在读取物流页…', again: '重新提取物流号',
      title: 'Amazon 物流工作台', close: '关闭', language: '语言', system: '跟随系统',
      overview: '已读取 {visited} 个物流页面，识别 {count} 个单号；异常 {errors} 个。',
      warning: '仅从 .pt-delivery-card-trackingId 读取单号。“待复核”表示订单卡回退关联；“已报单（本地）”不是平台成功回执。',
      amountHelp: '运单商品总额＝已确认商品单价 × 本包裹数量（USD）；不含税费、运费及订单级调整。缺价或匹配不唯一时显示待识别。',
      groupingHelp: '物品按型号合并，忽略已识别的颜色和容量；展开可复核原始名称及数量。无法识别型号时保留原名。',
      filter: '筛选物流号、订单号或物品', copyNumbers: '复制单号', copyTable: '复制 TSV', csv: '导出 CSV', diagnostic: '复制诊断报告',
      tracking: '物流号', orders: '关联订单', items: '关联物品', amount: '运单商品总额（USD）', orderState: '订单关联', submission: '报单状态',
      confirmed: '已确认', review: '待复核', unknown: '待识别', notFound: '未找到',
      pending: '待报单', submitted: '已报单（本地）', markPending: '标为待报单', markSubmitted: '标为已报单（本地）',
      details: '原始物品', errors: '读取异常（{count}）', selectAll: '选择所有可见运单', selectRow: '选择运单 {tracking}',
      partial: '部分物品或数量待复核', failed: '读取或解析失败',
      diagPath: '页面路径', diagCards: '订单卡', diagLinks: '候选物流链接', diagVisited: '已读取物流页', diagFound: '识别物流号', diagMissing: '缺少物流号字段', diagErrors: '读取异常',
      diagPolicy: '数据策略：仅从专用字段读取物流号；页面全文不用于推测订单关联。'
    },
    'zh-TW': {
      extract: '擷取物流號及商品金額', extracting: '正在讀取物流頁…', again: '重新擷取物流號',
      title: 'Amazon 物流工作台', close: '關閉', language: '語言', system: '跟隨系統',
      overview: '已讀取 {visited} 個物流頁面，識別 {count} 個單號；異常 {errors} 個。',
      warning: '僅從 .pt-delivery-card-trackingId 讀取單號。「待複核」表示訂單卡回退關聯；「已報單（本機）」不是平台成功回執。',
      amountHelp: '運單商品總額＝已確認商品單價 × 本包裹數量（USD）；不含稅費、運費及訂單級調整。缺價或配對不唯一時顯示待識別。',
      groupingHelp: '物品按型號合併，忽略已識別的顏色和容量；展開可複核原始名稱及數量。無法識別型號時保留原名。',
      filter: '篩選物流號、訂單號或物品', copyNumbers: '複製單號', copyTable: '複製 TSV', csv: '匯出 CSV', diagnostic: '複製診斷報告',
      tracking: '物流號', orders: '關聯訂單', items: '關聯物品', amount: '運單商品總額（USD）', orderState: '訂單關聯', submission: '報單狀態',
      confirmed: '已確認', review: '待複核', unknown: '待識別', notFound: '未找到',
      pending: '待報單', submitted: '已報單（本機）', markPending: '標為待報單', markSubmitted: '標為已報單（本機）',
      details: '原始物品', errors: '讀取異常（{count}）', selectAll: '選擇所有可見運單', selectRow: '選擇運單 {tracking}',
      partial: '部分物品或數量待複核', failed: '讀取或解析失敗',
      diagPath: '頁面路徑', diagCards: '訂單卡', diagLinks: '候選物流連結', diagVisited: '已讀取物流頁', diagFound: '識別物流號', diagMissing: '缺少物流號欄位', diagErrors: '讀取異常',
      diagPolicy: '資料策略：僅從專用欄位讀取物流號；頁面全文不用於推測訂單關聯。'
    }
  };

  function chooseLanguage(preferences) {
    for (const value of preferences || []) {
      const tag = String(value).toLowerCase();
      if (/^zh(?:-|$)/.test(tag)) return /(?:hant|tw|hk|mo)/.test(tag) ? 'zh-TW' : 'zh-CN';
      if (/^en(?:-|$)/.test(tag)) return 'en';
    }
    return 'en';
  }
  function loadLanguage() {
    try { const saved = localStorage.getItem(LANGUAGE_KEY); return saved === 'system' || Object.hasOwn(MESSAGES, saved) ? saved : 'system'; } catch (_) { return 'system'; }
  }
  let languagePreference = loadLanguage();
  let refreshPanel = null;
  let extractionState = 'extract';
  function locale() { return languagePreference === 'system' ? chooseLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]) : languagePreference; }
  function t(key, values = {}) { return (MESSAGES[locale()][key] || MESSAGES.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')); }
  function setLanguage(value) {
    languagePreference = value === 'system' || Object.hasOwn(MESSAGES, value) ? value : 'system';
    try { localStorage.setItem(LANGUAGE_KEY, languagePreference); } catch (_) { /* Keep in memory. */ }
    updateButton(); if (refreshPanel) refreshPanel();
  }
  function money(amount) { return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD' }).format(amount); }
  function stateLabel(value) { return t(({ '已确认': 'confirmed', '待复核': 'review', '待识别': 'unknown', pending: 'pending', submitted: 'submitted' })[value] || 'unknown'); }
  function submissionCode(value) { return value === 'submitted' || value === '已报单（本地）' ? 'submitted' : 'pending'; }

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
    const direct = element.getAttribute?.('data-asin');
    if (/^[A-Z0-9]{10}$/i.test(direct || '')) return direct.toUpperCase();
    const source = `${link?.href || ''}`;
    return (source.match(/(?:\/dp\/|\/gp\/product\/|data-asin[=:/]?)([A-Z0-9]{10})/i) || [])[1]?.toUpperCase() || '';
  }

  function imageKey(image) {
    const source = image?.currentSrc || image?.src || '';
    return (source.match(/\/images\/I\/([^._/]+)/i) || [])[1]?.toLowerCase() || '';
  }

  function itemName(image, container) {
    const link = container?.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
    return text(link?.getAttribute('title') || link?.textContent || image.getAttribute('alt') || image.getAttribute('title'));
  }
  function itemQuantity(container) {
    const match = text(container?.textContent).match(/(?:qty|quantity|数量|數量)\s*[:：]?\s*(\d+)/i);
    const value = match ? Number(match[1]) : 1;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  function readItems(scope, orderId) {
    const found = [], seen = new Map();
    for (const image of scope.querySelectorAll('img')) {
      const productLink = image.closest('a[href*="/dp/"],a[href*="/gp/product/"]') || image.closest('[data-asin]')?.querySelector('a[href*="/dp/"],a[href*="/gp/product/"]');
      const directAsin = image.closest('[data-asin]')?.getAttribute('data-asin') || '';
      // Decorative images, badges and recommendation thumbnails have neither a product link
      // nor a valid ASIN. Never turn them into package items.
      if (!productLink && !/^[A-Z0-9]{10}$/i.test(directAsin)) continue;
      const container = productLink?.closest('[data-asin], li, .a-box, .a-section') || image.closest('[data-asin]') || productLink?.parentElement;
      const key = imageKey(image), asin = asinFromElement(container) || asinFromElement(productLink);
      if (!asin && !productLink) continue;
      const identity = asin ? `asin:${asin}` : `image:${key}`;
      // Repeated thumbnails in one item container do not represent extra units.
      const containers = seen.get(identity) || new Set();
      if (containers.has(container)) continue;
      containers.add(container); seen.set(identity, containers);
      found.push({ asin, key, identity, name: text(productLink?.getAttribute('title') || productLink?.textContent || itemName(image, container)), quantity: itemQuantity(container),
        price: orderId ? amountFromItem(container) : null, orderId });
    }
    return found;
  }
  function packageItems(doc) {
    const trackingField = doc.querySelector('.pt-delivery-card-trackingId');
    // Never fall back to doc.body: that merges recommendations and other package cards into this shipment.
    const scope = trackingField?.closest('.pt-delivery-card') || doc.querySelector('.pt-delivery-card');
    return scope ? readItems(scope) : [];
  }
  function amountFromItem(container) {
    // Explicit USD item UNIT price only. Never use tax, shipping or order totals.
    const value = text(container?.textContent);
    const match = value.match(/(?:^|[^a-z])(?:item\s*price|price)\s*:?\s*(?:US\$|USD\s*\$?|\$)\s*([\d,]+\.\d{2})(?!\d)/i);
    if (!match || /(?:CAD|AUD|NZD|HKD|CNY|EUR|GBP)\s*\$/i.test(value)) return null;
    const cents = Number(match[1].replace(/[, .]/g, ''));
    return Number.isSafeInteger(cents) ? cents / 100 : null;
  }
  function orderItems(doc, orderId) { return readItems(doc.body, orderId); }

  function modelName(value) {
    const original = text(value).normalize('NFKC');
    if (!original) return '';
    // Recognize device titles conservatively; accessories mentioning a device keep their names.
    if (!/^(?:(?:Apple\s+)?(?:\d{4}\s+)?(?:iPad|iPhone|MacBook|Mac\s+mini)|Samsung\s+Galaxy|Google\s+Pixel|Microsoft\s+Surface|Nintendo\s+Switch|Sony\s+PlayStation)\b/i.test(original)) {
      const concise = text(original.split(/[:：|]/)[0]);
      return concise.length > 48 ? `${concise.slice(0, 47)}…` : concise;
    }
    // Stable short forms for common Apple device titles. Marketing text, colour, storage and chip
    // details are intentionally excluded so that identical models group into a concise report row.
    if (/\biPad Air\b/i.test(original)) {
      const chip = original.match(/\bM\d+\b/i)?.[0]?.toUpperCase();
      return chip ? `iPad Air ${chip}` : 'iPad Air';
    }
    if (/\bMacBook Air\b/i.test(original)) {
      const size = original.match(/\b(13|15)(?:\.\d+)?-inch\b/i)?.[1];
      return size ? `MacBook Air ${size}` : 'MacBook Air';
    }
    if (/\bMac\s+mini\b/i.test(original)) {
      const chip = original.match(/\bM\d+\b/i)?.[0]?.toUpperCase();
      return chip ? `Mac mini ${chip}` : 'Mac mini';
    }
    let name = original.split(/[:：;]/)[0].replace(/^Apple\s+/i, '');
    name = name.replace(/\b\d+(?:\.\d+)?\s*(?:TB|GB)\b/gi, '')
      .replace(/\b(?:space\s+gr[ae]y|space\s+black|rose\s+gold|starlight|silver|pink|blue|purple|yellow|gold|gray|grey|black|white)\b/gi, '')
      .replace(/(?:银色|銀色|粉色|蓝色|藍色|紫色|深空灰色?|太空灰色?|星光色)/g, '')
      .replace(/\b(\d+)(?:st|nd|rd|th)\s+(?:generation|gen)\b/gi, '$1')
      .replace(/[()[\]]/g, ' ').replace(/[、,，|]/g, ' ')
      .replace(/\s*[-–]\s*$/g, '');
    // Preserve family, generation/chip, screen size, connectivity and unknown qualifiers.
    return text(name).replace(/^ipad\s*(mini|pro|air)?\s*/i, (_, family) => 'iPad' + (family ? ' ' + ({ mini: 'mini', pro: 'Pro', air: 'Air' })[family.toLowerCase()] : '') + ' ').trim();
  }
  function groupItems(items) {
    const groups = new Map();
    for (const item of items || []) {
      const name = modelName(item.name);
      const key = name ? name.toLowerCase() : item.identity;
      const group = groups.get(key) || { name, quantity: 0, uncertain: false };
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) group.uncertain = true;
      else group.quantity += item.quantity;
      groups.set(key, group);
    }
    return [...groups.values()];
  }
  function itemsSummary(items) {
    const groups = groupItems(items);
    const visible = groups.slice(0, 4).map(g => `${g.name || t('unknown')} ×${g.uncertain ? '?' : g.quantity}`);
    if (groups.length > 4) visible.push(`+${groups.length - 4}`);
    return visible.join('; ') || t('unknown');
  }
  function reconcileItems(packageProductList, products) {
    let cents = 0, complete = packageProductList.length > 0;
    const used = new Map();
    const items = packageProductList.map(pkg => {
      const candidates = products.filter(p => (pkg.asin && p.asin === pkg.asin) || (!pkg.asin && pkg.key && p.key === pkg.key));
      const product = candidates.length === 1 ? candidates[0] : null;
      const item = { ...pkg, name: pkg.name || product?.name || '', price: null };
      const validQty = Number.isSafeInteger(pkg.quantity) && pkg.quantity > 0;
      const consumed = product ? (used.get(product) || 0) + (validQty ? pkg.quantity : 0) : 0;
      if (product) used.set(product, consumed);
      if (!product || !validQty || !Number.isSafeInteger(product.quantity) || consumed > product.quantity || !Number.isFinite(product.price) || product.price < 0) complete = false;
      else { item.price = product.price; cents += Math.round(product.price * 100) * pkg.quantity; }
      return item;
    });
    return { items, amount: complete ? cents / 100 : null, state: complete ? '已确认' : '待识别' };
  }
  async function fetchDocument(url) {
    const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!sameOrigin(response.url || url) || /(?:signin|captcha)/i.test(response.url || '')) throw new Error(t('failed'));
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }
  async function resolveAmount(doc) {
    const packages = packageItems(doc), products = [];
    let failed = false;
    for (const [id, url] of packageOrderLinks(doc)) {
      try { products.push(...orderItems(await fetchDocument(url), id)); } catch (_) { failed = true; }
    }
    const result = reconcileItems(packages, products);
    if (failed) return { ...result, amount: null, state: '待识别' };
    return result;
  }
  function mergePackageRow(old, row) {
    if (!old) return row;
    // Same tracking page reached from multiple orders: do not double count snapshots.
    const fingerprint = r => JSON.stringify((r.items || []).map(i => [i.identity, i.quantity, i.price]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const agrees = fingerprint(old) === fingerprint(row) && old.state === row.state && old.amount === row.amount;
    return { ...old, orders: unique([...old.orders, ...row.orders]),
      orderConfidence: old.orderConfidence === '待复核' || row.orderConfidence === '待复核' ? '待复核' : '已确认',
      state: agrees ? old.state : '待识别', amount: agrees ? old.amount : null,
      itemConflict: old.itemConflict || !agrees };
  }

  function loadSubmissionState() {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch (_) { return {}; }
  }

  function saveSubmissionState(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) { /* Storage unavailable. */ }
  }

  function csvCell(value) {
    const raw = String(value ?? '');
    const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function exportValues(row) {
    return [row.tracking, row.orders.join(','), itemsSummary(row.items),
      row.state === '已确认' ? row.amount.toFixed(2) : '', 'USD', stateLabel(row.state),
      stateLabel(row.orderConfidence), stateLabel(row.submissionState), row.itemConflict ? t('partial') : ''];
  }
  function csvContent(rows) {
    const header = ['tracking_number', 'order_ids', 'associated_items', 'package_item_total', 'currency', 'amount_state', 'order_state', 'submission_state', 'item_review'];
    return '\uFEFF' + header.map(csvCell).join(',') + '\r\n' + rows.map(row => exportValues(row).map(csvCell).join(',')).join('\r\n');
  }
  function tsvContent(rows) { return rows.map(row => exportValues(row).map(v => String(v).replace(/[\t\r\n]/g, ' ')).join('\t')).join('\n'); }
  function downloadCsv(rows) {
    const url = URL.createObjectURL(new Blob([csvContent(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `amazon-tracking-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function runExtraction() {
    const button = document.getElementById(BUTTON_ID);
    button.disabled = true;
    extractionState = 'extracting'; updateButton();
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
        const value = await resolveAmount(doc, orderResult.ids);
        byTracking.set(tracking, mergePackageRow(byTracking.get(tracking), {
          tracking, orders: orderResult.ids, orderConfidence: orderResult.confidence, ...value
        }));
      } catch (error) {
        errors.push(error?.message || t('failed'));
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
    extractionState = 'again'; updateButton();
  }

  async function copy(value) {
    try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(value); }
    catch (_) { const area = document.createElement('textarea'); area.value = value; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
  }
  function showPanel(rows, summary) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) { panel = document.createElement('div'); panel.id = PANEL_ID; document.body.append(panel); }
    Object.assign(panel.style, { position: 'fixed', top: '60px', right: '18px', width: 'min(1160px,94vw)', maxHeight: '82vh', overflow: 'auto', zIndex: 999999, background: '#fff', color: '#111', padding: '14px', border: '1px solid #aaa', borderRadius: '8px', font: '13px Arial,sans-serif' });
    const saved = loadSubmissionState(), selected = new Set(rows.map(row => row.tracking));
    const make = (tag, value) => { const e = document.createElement(tag); if (value !== undefined) e.textContent = value; return e; };
    let query = '';
    const render = () => {
      if (!panel.isConnected) { refreshPanel = null; return; }
      const visible = rows.filter(row => !query || `${row.tracking} ${row.orders.join(' ')} ${itemsSummary(row.items)} ${(row.items || []).map(i => i.name).join(' ')}`.toUpperCase().includes(query));
      const selectedRows = () => visible.filter(row => selected.has(row.tracking)).map(row => ({ ...row, submissionState: submissionCode(saved[row.tracking]?.status) }));
      const focusedFilter = !!document.activeElement && panel.querySelector('[data-role="filter"]') === document.activeElement;
      const caret = focusedFilter ? document.activeElement.selectionStart : null;
      panel.replaceChildren(); panel.lang = locale();
      const header = make('div'); Object.assign(header.style, { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' });
      const languageLabel = make('label', t('language') + ' '), languages = make('select'); languages.setAttribute('aria-label', t('language'));
      for (const [value, label] of [['system', t('system')], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English']]) {
        const option = make('option', label); option.value = value; option.selected = languagePreference === value; languages.append(option);
      }
      languages.onchange = () => setLanguage(languages.value); languageLabel.append(languages);
      const close = make('button', t('close')); close.onclick = () => { refreshPanel = null; panel.remove(); };
      header.append(make('strong', t('title')), languageLabel, close); panel.append(header);
      panel.append(make('p', t('overview', { visited: summary.visited, count: rows.length, errors: summary.errors.length })));
      const warning = make('p', t('warning')); warning.style.color = '#8a4b00'; panel.append(warning, make('p', t('groupingHelp')), make('p', t('amountHelp')));
      const controls = make('div'); Object.assign(controls.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' });
      const filter = make('input'); filter.dataset.role = 'filter'; filter.placeholder = t('filter'); filter.setAttribute('aria-label', t('filter')); filter.value = query;
      filter.oninput = () => { query = filter.value.toUpperCase(); render(); };
      const copyNumbers = make('button', t('copyNumbers')); copyNumbers.onclick = () => copy(selectedRows().map(row => row.tracking).join('\n'));
      const copyTable = make('button', t('copyTable')); copyTable.onclick = () => copy(tsvContent(selectedRows()));
      const exportCsv = make('button', t('csv')); exportCsv.onclick = () => downloadCsv(selectedRows());
      const diagnostic = make('button', t('diagnostic'));
      diagnostic.onclick = () => copy([
        `Amazon Tracking Assistant ${SCRIPT_VERSION}`,
        `${t('diagPath')}: ${location.pathname}`,
        `${t('diagCards')}: ${summary.orderCards}`, `${t('diagLinks')}: ${summary.candidateLinks}`,
        `${t('diagVisited')}: ${summary.visited}`, `${t('diagFound')}: ${rows.length}`,
        `${t('diagMissing')}: ${summary.missingTrackingField}`, `${t('diagErrors')}: ${summary.errors.length}`, t('diagPolicy')
      ].join('\n'));
      controls.append(filter, copyNumbers, copyTable, exportCsv, diagnostic); panel.append(controls);
      const table = make('table'); Object.assign(table.style, { width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left' });
      const head = make('thead'), headRow = make('tr'), all = make('input'); all.type = 'checkbox'; all.setAttribute('aria-label', t('selectAll'));
      all.checked = visible.length > 0 && visible.every(row => selected.has(row.tracking));
      all.indeterminate = visible.some(row => selected.has(row.tracking)) && !all.checked;
      all.onchange = () => { visible.forEach(row => all.checked ? selected.add(row.tracking) : selected.delete(row.tracking)); render(); };
      const allCell = make('th'); allCell.append(all); headRow.append(allCell);
      ['tracking', 'orders', 'items', 'amount', 'orderState', 'submission'].forEach(key => headRow.append(make('th', t(key)))); head.append(headRow); table.append(head);
      const body = make('tbody');
      for (const row of visible) {
        const tr = make('tr'); tr.style.borderTop = '1px solid #ddd';
        const checkbox = make('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(row.tracking); checkbox.setAttribute('aria-label', t('selectRow', { tracking: row.tracking }));
        checkbox.onchange = () => { checkbox.checked ? selected.add(row.tracking) : selected.delete(row.tracking); render(); };
        const choice = make('td'); choice.append(checkbox);
        const itemsCell = make('td', itemsSummary(row.items));
        if (row.items?.length) {
          const details = make('details'); details.append(make('summary', t('details')));
          for (const item of row.items) details.append(make('div', `${item.name || t('unknown')} ×${item.quantity ?? '?'}${item.price === null ? '' : ' · ' + money(item.price)}`));
          itemsCell.append(details);
        }
        if (row.itemConflict) itemsCell.append(make('p', t('partial')));
        tr.append(choice, make('td', row.tracking), make('td', row.orders.join(', ') || t('notFound')), itemsCell, make('td', row.state === '已确认' ? money(row.amount) : t('unknown')));
        const confidence = make('td', stateLabel(row.orderConfidence)); if (row.orderConfidence === '待复核') confidence.style.color = '#8a4b00'; tr.append(confidence);
        const status = submissionCode(saved[row.tracking]?.status), statusCell = make('td'); statusCell.append(make('span', stateLabel(status)), make('br'));
        const mark = make('button', t(status === 'submitted' ? 'markPending' : 'markSubmitted'));
        mark.onclick = () => { saved[row.tracking] = { status: status === 'submitted' ? 'pending' : 'submitted', updatedAt: new Date().toISOString() }; saveSubmissionState(saved); render(); };
        statusCell.append(mark); tr.append(statusCell); body.append(tr);
      }
      table.append(body); panel.append(table);
      if (summary.errors.length) { const details = make('details'); details.append(make('summary', t('errors', { count: summary.errors.length }))); summary.errors.forEach(error => details.append(make('div', error))); panel.append(details); }
      if (focusedFilter) { filter.focus(); if (caret !== null) filter.setSelectionRange(caret, caret); }
    };
    refreshPanel = render; render();
  }
  function updateButton() { const button = document.getElementById(BUTTON_ID); if (button) button.textContent = t(extractionState); }
  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button'); button.id = BUTTON_ID; button.textContent = t(extractionState); button.onclick = runExtraction;
    Object.assign(button.style, { position: 'fixed', right: '18px', bottom: '18px', zIndex: 999999, padding: '12px 16px', background: '#1768ac', color: '#fff', border: 0, borderRadius: '8px', cursor: 'pointer' });
    document.body.append(button);
  }
  window.addEventListener('languagechange', () => { if (languagePreference === 'system') { updateButton(); if (refreshPanel) refreshPanel(); } });
  addButton();
  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
})();
