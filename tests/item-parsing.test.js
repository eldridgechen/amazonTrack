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
vm.runInContext(source.slice(0, boundary) + '\n globalThis.api = { itemName, itemQuantity, modelName, reconcileItems, itemDiagnostics };\n})();', context);
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
