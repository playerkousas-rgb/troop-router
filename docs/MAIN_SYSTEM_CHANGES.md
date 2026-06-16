# 主系统改动指南 — 推出前要改什么（区 + 旅团）

> 对象：你（改主系统的人）。这份把「主系统需要动的地方」整理成一张可执行清单。
> 主系统 = `scout-district-portal`（区）+ 未来的旅团 Portal。两者同一套程式。
> **单位码规则（关键简化）**：区 = 字母码（如 `SKW`），旅团 = 纯数字码（如 `0082`）。
> 两者天然不会撞车，单位码本身就是全域唯一 key → 统一用**一个参数 `u`**，插件靠「是否纯数字」分辨区/旅团，**不需要 scope 参数**。
> 配套参考码：`framework/reference/getRegistry.gs`、`framework/reference/frontend-patch.md`。

---

## 改动总览（5 项，按优先级）

| # | 改哪层 | 改什么 | 必要性 | 影响 |
|---|---|---|---|---|
| 1 | 各单位 Apps Script | `getRegistry` 解析第3级 url + tier 映射 + installed | **必须** | 第3级能不能用全靠它 |
| 2 | 各单位 Apps Script | `installPlugin` 加「空 url / 未部署」护栏 | **必须** | 防止装到空网址 |
| 3 | 前端 lib/types.ts + plugins/page.tsx | 认 `tier`/`available`，未部署第3级禁安装 | 建议 | 体验更好、防呆 |
| 4 | 前端（区+旅团） | 单位参数名统一用 `u`（值：区=字母码、旅团=数字码） | 必须 | 统一、简化 |
| 5 | 前端 CardItem/embed | 防空 url（双保险） | 建议 | 防呆 |

---

## 1. Apps Script：getRegistry（必须）★

**问题**：转驳器 registry 里第3级 `plugins[].url` 是空的，真正网址在 `units[本单位].endpoints[id]`。前端不知道「我是哪个单位」，所以**解析必须发生在 Apps Script 这层**。

**做法**：把 `framework/reference/getRegistry.gs` 整段贴进每个单位的 Apps Script，改两个常量：
```js
var UNIT_CODE   = 'SKW';   // 本单位代码（旅团填旅团号，如 '82'）
var REGISTRY_URL = 'https://scout-hub.vercel.app/api/registry';
```
它会自动：
- 第3级 `url = endpoints[id] || ''`，并标 `available`；第2级 `url = plugin.url`。
- `needsDistrictBackend = (tier===3)`（前端现读这个）。
- 对照本单位卡片表标 `installed`。

> 接到你现有 `doGet` 路由：`if (action==='getRegistry') return handleGetRegistry(e.parameter.token);`

---

## 2. Apps Script：installPlugin 护栏（必须）

安装写卡前，挡掉「第3级但本单位没部署」与「空 url」：
```js
function installPlugin(token, plugin) {
  // ...验 token...
  var gate = canInstall_(plugin);            // 见 getRegistry.gs
  if (!gate.ok) return resErr_(gate.error);  // 例：「此第3级元件尚未为本单位部署后台」
  // 写入卡片表：cardId=plugin.id, url=plugin.url(已解析), source='plugin' ...
}
```
**卡片表只存书签**：`cardId / title / icon / description / type / url(已解析) / embed / source='plugin' / enabled / order`。**不存插件业务资料**。

---

## 3. 前端：认 tier / available（建议）

照 `framework/reference/frontend-patch.md`：
- **补丁1**：`lib/types.ts` 的 `PluginItem` 加可选 `tier?: 2|3`、`available?: boolean`。
- **补丁2**：`app/plugins/page.tsx` 对 `tier===3 && available===false` 显示「需先为本单位部署后台」并禁安装。

都向后兼容，旧后台没回也不会坏。

---

## 4. 前端：单位参数名统一用 u（必须）★

区与旅团**用同一个参数名 `u`**，值不同即可分辨：
- 区：`u=SKW`（字母码）
- 旅团：`u=0082`（纯数字码）

要改的地方（区版与旅团版同样改，只是单位目录内容不同）：
- `lib/district.ts`：`resolveDistrictCode()` 读 `params.get('u')`；`withDistrictParam()` set `'u'`。
- `components/CardItem.tsx` 的 `buildExternalUrl()`、`app/embed/page.tsx` 的 `buildTarget()`：`params.set('u', unitCode)`。

```ts
// CardItem.buildExternalUrl() / embed.buildTarget()
const params = new URLSearchParams();
params.set('u', unitCode);     // 区=字母码 / 旅团=数字码
params.set('role', role);
params.set('from', 'portal');
// embed 模式再 params.set('embed','1')
```

> 不变量：**单位码区=字母、旅团=数字，全域唯一**。插件靠「纯数字 → 旅团；否则 → 区」分辨，不需 scope 参数（框架契约 §8）。

---

## 5. 前端：防空 url（建议，双保险）

理论上 Apps Script 护栏已挡住空 url 入卡片表，前端再加一层不亏：
```ts
// CardItem.handleClick 开头
if (!card.url && card.type !== 'builtin') { alert('此元件尚未设定网址。'); return; }
// embed.buildTarget 开头
if (!card || !session || !card.url) return '';
```

---

## 套用顺序

1. Apps Script `getRegistry.gs`（#1）+ installPlugin 护栏（#2）← 先做，第3级靠这层。
2. 前端补丁 tier/available（#3）。
3. 前端单位参数名统一用 `u`（#4）。
4. 前端防空 url（#5）。
5. 端到端测一个第3级元件（DBS）：registry → getRegistry → 安装 → 开卡 → 元件收到 `?u=SKW&role=...&from=portal`（旅团则 `?u=0082&...`）。

---

## 验收标准（做完逐项打勾）

- [ ] 第2级元件：市集看得到、能装、点开带正确参数。
- [ ] 第3级元件（本单位有 endpoint）：能装、url 是本单位那条。
- [ ] 第3级元件（本单位无 endpoint）：市集显示「需先部署」、装不了。
- [ ] 卡片表只存书签，不含插件业务资料。
- [ ] 区带 `u=字母码`、旅团带 `u=数字码`。
- [ ] 元件收到 `u`（单位码）+ `role` + `from=portal`。
- [ ] 元件能用「u 是否纯数字」正确分辨区/旅团。
- [ ] 空 url 不会开出空白 iframe。
