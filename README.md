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

## 产品与设计文档（中文）

本仓库当前是保守提取脚本；可视化工作台和报单辅助功能尚处于设计阶段。设计明确区分“已提取”和“平台已报单”，不会假设 BFMR/MOD 存在可用接口。

- [执行简报](docs/01-执行简报.md)：需求边界、交付及验证方式。
- [竞品与工作流调研](docs/02-竞品与工作流调研.md)：公开证据、推断与待确认事项。
- [产品需求文档（PRD）](docs/03-产品需求文档.md)：目标、功能优先级、规则、验收与路线图。
- [技术与交互设计](docs/04-技术与交互设计.md)：页面、数据模型、架构、可靠性、集成和安全。

## Scope and verification

The script was checked for JavaScript syntax and has fixture tests for the critical parsing rules. Amazon can change its page markup; before relying on price totals, compare a few output rows against the package and order-detail pages. Amounts marked **待识别** require manual review.
