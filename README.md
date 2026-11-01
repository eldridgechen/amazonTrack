# Amazon Tracking Assistant

### 1.2.5 调试版本

修正数量徽标、ASIN 被当作商品名的问题；名称优先来自商品图片描述，缺少明确数量时显示 `?`。包裹范围和数量徽标结构仍需真实页面诊断验证，不能视为已完成验收。

重新提取后点击“复制诊断报告”，报告增加逐页祖先节点计数、名称来源类型、明确数量与数字徽标线索，不输出页面 HTML、商品名、URL、订单号或物流号。窗口标题显示版本号，可确认是否更新成功。

回归测试：`node tests/item-parsing.test.js` 直接运行脚本内的实际解析函数；`node tests/critical-parsing.test.js` 是历史规则测试。

Tampermonkey userscript for Amazon US order history. It reads every package page linked from the loaded order cards and presents:

- tracking numbers read exactly from `.pt-delivery-card-trackingId`;
- all order IDs exposed by that package page (so a package can have multiple orders);
- a package item total only when the package items can be uniquely matched to order-detail items with an explicit item price.

`TBA...SEE` is normalized to the underlying `TBA...` number. Other text or URLs are never used to invent a tracking number. If product identity, quantity, or unit price cannot be confirmed, the value is **待识别**; an order total is never used as a substitute.

版本 1.1 新增本地物流工作台：可筛选和勾选包裹、复制单号或 TSV、导出 UTF-8 CSV，并把报单状态标记为“待报单”或“已报单（本地）”。物品名会压缩成便于报单核对的短名（如 `iPad Air M4 ×1`、`MacBook Air 13 ×4`），完整名称仍只在页面内用于匹配。该标记只保存在浏览器本地，不代表 BFMR、MOD 或任何平台已成功接收。

工作台的“复制诊断报告”只输出脚本版本、选择器和数量统计，不包含订单号、物流号、商品、地址或登录信息；页面结构变化时可将该报告用于排查。

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
