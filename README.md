# Amazon Tracking Assistant

Tampermonkey userscript for Amazon US order history. It reads every package page linked from the loaded order cards and presents:

- tracking numbers read exactly from `.pt-delivery-card-trackingId`;
- all order IDs exposed by that package page (so a package can have multiple orders);
- a package item total only when the package items can be uniquely matched to order-detail items with an explicit item price.

`TBA...SEE` is normalized to the underlying `TBA...` number. Other text or URLs are never used to invent a tracking number. If product identity, quantity, or unit price cannot be confirmed, the value is **待识别**; an order total is never used as a substitute.

## Install

1. Install Tampermonkey in your browser.
2. Create a new script and paste the content of `amazon-tracking-assistant.user.js`.
3. Save, open Amazon US order history, wait for the desired orders to load, and select **提取物流号及商品金额**.

The script only reads pages with same-origin authenticated `fetch` requests. It does not place orders, change order data, or submit forms.

## Scope and verification

The script was checked for JavaScript syntax and has fixture tests for the critical parsing rules. Amazon can change its page markup; before relying on price totals, compare a few output rows against the package and order-detail pages. Amounts marked **待识别** require manual review.
