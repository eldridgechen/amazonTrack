const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the production definitions, omitting only browser startup side effects.
const source = fs.readFileSync(path.join(__dirname, '../amazon-tracking-assistant.user.js'), 'utf8');
const boundary = source.lastIndexOf("  window.addEventListener('languagechange'");
assert.ok(boundary > 0);
const context = { localStorage: { getItem: () => null }, navigator: { languages: ['zh-CN'] } };
vm.createContext(context);
vm.runInContext(source.slice(0, boundary) + '\n globalThis.api = { itemName, itemQuantity, modelName, reconcileItems, itemDiagnostics, packageItems, orderItems, groupItems, mergePackageRow };\n})();', context);
const { itemName, itemQuantity, modelName, reconcileItems, itemDiagnostics } = context.api;
const image = (alt, label, title = '') => ({
  getAttribute: key => key === 'alt' ? alt : '',
  closest: () => ({ textContent: label, getAttribute: key => key === 'title' ? title : '' })
});
assert.equal(itemName(image('Apple iPad Air 11-inch (M4)', '2')), 'Apple iPad Air 11-inch (M4)');
assert.equal(itemName(image('Apple MacBook Air 15-inch', 'B012345678')), 'Apple MacBook Air 15-inch');
assert.equal(itemName(image('', '2')), '');
assert.equal(itemName(image('', 'B012345678')), '');
assert.equal(itemName(image('Climate Pledge Friendly', '')), '');
assert.equal(itemName(image('', '2', 'Apple MacBook Air 13-inch')), 'Apple MacBook Air 13-inch');
assert.equal(itemQuantity({ textContent: 'Quantity: 2' }), 2);
assert.equal(itemQuantity({ textContent: 'MacBook Air 13-inch 512GB' }), null);
assert.equal(itemQuantity({ textContent: 'Quantity: 0' }), null);
assert.equal(modelName('Apple 2026 MacBook Air 13-inch Laptop with M5 chip'), 'MacBook Air 13');
assert.equal(modelName('Apple iPad Air 11-inch (M4)'), 'iPad Air M4');
assert.equal(reconcileItems([{ asin: 'A', quantity: null }], [{ asin: 'A', quantity: 2, price: 10 }]).amount, null);
assert.equal(reconcileItems([{ asin: 'A', quantity: 2 }], [{ asin: 'A', quantity: 2, price: 10 }]).amount, 20);
const report = itemDiagnostics({ querySelectorAll: () => [], querySelector: () => null });
assert.equal(report.items.length, 0);
assert.equal(report.trackingFields, 0);
assert.equal(source.match(/@version\s+(\S+)/)[1], source.match(/SCRIPT_VERSION = '([^']+)'/)[1]);
console.log('Production item parsing regression checks passed');

// Synthetic HTML reproduces the supplied OL/LI/badge structure without personal data.
const { parseHTML } = require('linkedom');
const { packageItems, orderItems, groupItems, mergePackageRow } = context.api;
const doc = html => parseHTML(`<html><body>${html}</body></html>`).document;
const ids = ['B000000001', 'B000000002', 'B000000003', 'B000000004', 'B000000005'];
const names = ['Apple iPad Air 11-inch (M4) Purple', 'Apple MacBook Air 13-inch Silver',
  'Apple iPad 11-inch: A16 chip Pink', 'Apple MacBook Air 13-inch Starlight', 'Apple iPad Air 11-inch (M4) Starlight'];
const thumbnail = (id, name, qty, duplicate = false) => `<a href="https://www.amazon.com/dp/${id}"><img alt="${name}">${duplicate ? `<img alt="${name}">` : ''}${qty > 1 ? `<span>${qty}</span>` : ''}</a>`;
const packageDoc = doc(`<div><ol>${[[0, 2], [0, 1], [1, 2], [2, 2], [3, 1]].map(([i, qty]) =>
  `<li>${thumbnail(ids[i], ids[i], qty, true)}</li>`).join('')}</ol><section><div class="pt-delivery-card-trackingId">TBA000000000001</div></section></div>
  <aside><ol><li>${thumbnail(ids[4], names[4], 99)}</li></ol></aside>`);
const pkg = packageItems(packageDoc);
assert.equal(pkg.length, 5, 'duplicate images and recommendations must not add products');
assert.deepEqual(Array.from(pkg, p => p.quantity), [2, 1, 2, 2, 1]);
assert.ok(pkg.every(p => !p.name), 'ASIN is not a title');

const purchaseRow = (i, qty, price) => `<div class="purchase-row"><div class="image-column">${thumbnail(ids[i], ids[i], qty)}</div>
  <div><a href="https://www.amazon.com/dp/${ids[i]}">${names[i]}</a><p>Sold by: Amazon.com</p><p>Return window closed</p><span>$${price}</span></div></div>`;
const order = rows => doc(`<section>Order Summary Item(s) Subtotal: $99999.00</section><section>${rows}</section>
  <aside>${thumbnail(ids[4], names[4], 99)}<span>$9.99</span></aside>`);
const products = [
  ...orderItems(order(purchaseRow(3, 1, '1,099.00') + purchaseRow(0, 1, '749.00')), 'synthetic-a'),
  ...orderItems(order(purchaseRow(1, 2, '1,099.00')), 'synthetic-b'),
  ...orderItems(order(purchaseRow(4, 1, '749.00') + purchaseRow(0, 2, '749.00')), 'synthetic-c'),
  ...orderItems(order(purchaseRow(2, 2, '499.00')), 'synthetic-d')
];
assert.equal(products.length, 6);
const reconciled = reconcileItems(pkg, products);
assert.equal(reconciled.amount, 6542, 'exclude the separate shipment, do not sum whole-order totals');
assert.deepEqual(Array.from(groupItems(reconciled.items), g => [g.name, g.quantity]),
  [['iPad Air M4', 3], ['MacBook Air 13', 3], ['iPad A16', 2]]);
assert.equal(reconcileItems(pkg, products.map((p, i) => i === 1 ? { ...p, price: 700 } : p)).amount, null, 'conflicting unit prices');
assert.equal(reconcileItems([{ ...pkg[0], quantity: 4 }], products).amount, null, 'do not exceed purchased quantity');
assert.equal(reconcileItems(pkg, products.filter(p => p.asin !== ids[2])).amount, null, 'missing purchase row');
assert.equal(reconcileItems(pkg, products.map(p => ({ ...p, price: null }))).amount, null, 'missing prices');
assert.equal(orderItems(order(purchaseRow(0, 2, '749.00').replace('Return window closed', 'Grand Total')), 'x').length, 0);
const base = { items: pkg, orders: ['synthetic-a'], state: '待识别', amount: null, orderConfidence: '已确认' };
const enriched = mergePackageRow(base, { ...base, items: pkg.map(p => ({ ...p, name: 'Apple iPad Air M4' })) });
assert.equal(enriched.items.length, 5);
assert.equal(enriched.items[0].name, 'Apple iPad Air M4');
console.log('Synthetic split/consolidated package DOM checks passed ($6542, 8 units)');
