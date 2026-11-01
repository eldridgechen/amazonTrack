const assert = require('node:assert/strict');

function normalizeTracking(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase().replace(/^(TBA\d+)SEE$/, '$1');
}

function trackingFromField(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  const labelled = raw.match(/(?:tracking\s*(?:id|number|#)?|运单号|追踪号)\s*[:#-]\s*([^\s]+)/i);
  return normalizeTracking(labelled ? labelled[1] : raw.replace(/^[^:：]+[:：]\s*/, ''));
}

function compactProductName(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
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

assert.equal(trackingFromField('Tracking ID: TBA334859946912SEE'), 'TBA334859946912');
assert.equal(trackingFromField('Tracking ID: 1Z999AA10123456784'), '1Z999AA10123456784');
assert.equal(trackingFromField('TBA334859946912SEE'), 'TBA334859946912');
assert.equal(normalizeTracking('1Z999AA10123456784SEE'), '1Z999AA10123456784SEE');
assert.equal(compactProductName('iPad Air 11-inch M4'), 'iPad Air M4');
assert.equal(compactProductName('Apple 2026 MacBook Air 13-inch Laptop with M5 chip'), 'MacBook Air 13');
assert.deepEqual([...new Set('Order 111-2222222-3333333 and 444-5555555-6666666'.match(/\b\d{3}-\d{7}-\d{7}\b/g))], ['111-2222222-3333333', '444-5555555-6666666']);
console.log('critical parsing checks passed');
