# 插件统一格式 — 未来所有插件照这份做（含区/旅团共用）

> 对象：日后开发任何插件的人（含你自己）。这份是「插件出厂规格」，照做就能同时被区 Portal、旅团 Portal 接入，必要时一份插件**区旅团共用**。
> 配套：`COMPONENT_SPEC.md`（详细对接规范）、`FRAMEWORK_CONTRACT.md`（整体框架）。

---

## 0. 单位码规则（地基，先记住）★

- **区 = 字母码**（如 `SKW`、`CHW`）。
- **旅团 = 纯数字码**（如 `0082`、`0083`）。
- 两者天然不会撞车 → **单位码本身就是全域唯一 key**。
- 插件用一句话分辨现在服务谁：**纯数字 → 旅团；否则 → 区**。
- 因此**不需要 scope 参数、不需要复合 key**，直接拿单位码当 key 即可。

```js
const isTroop = /^\d+$/.test(unit);     // 纯数字 = 旅团
const kind = isTroop ? 'troop' : 'district';
```

---

## 1. 插件三种「适用范围」— 出厂先选

| 范围 | 意思 | registry 放哪 | 例子 |
|---|---|---|---|
| **district-only** | 只给区用 | 只登记在区 hub | 区年度文件、区议会 |
| **troop-only** | 只给旅团用 | 只登记在旅团 hub | 旅团点名、旅团团费 |
| **shared（共用）** | 区和旅团都能用 | **两个 hub 都登记** | 通告图书馆、活动报名、DBS |

> 共用插件 = **同一份程式/部署**，靠「单位码是数字还是字母」分辨现在服务谁。不是做两套。

---

## 2. 插件接收的参数（统一输入合约）

主系统开插件时一定带这些 query（见主系统改动 #4）：

| 参数 | 值 | 说明 |
|---|---|---|
| `u` | 单位码 | 区给 `u=SKW`，旅团给 `u=0082` |
| `role` | 角色（明文无签章） | 不可当权限凭证 |
| `from` | `portal` | 来源标记 |
| `embed` | `1`（仅 iframe） | 收敛 UI |

**统一读取（每个插件开头都这样）：**
```js
const q = new URLSearchParams(location.search);
const unit  = q.get('u');                       // 单位码（唯一）
const role  = q.get('role') || 'guest';
const embed = q.get('embed') === '1';
const isTroop = /^\d+$/.test(unit || '');       // 纯数字 = 旅团，否则 = 区
const kind = isTroop ? 'troop' : 'district';

if (!unit) { /* 提示「请从 Portal 进入」 */ }

// ★ 资料隔离 key 直接用单位码（全域唯一，不会撞车）
const tenantKey = unit;                          // 例：'SKW' / '0082'
```

---

## 3. 资料隔离规则（共用插件必读）★

| 做法 | 是否允许 | 说明 |
|---|---|---|
| 用 `unit`（单位码）当资料 key / 工作表名 / 资料夹 | ✅ 推荐 | 区=字母、旅团=数字，全域唯一，永不撞车 |
| 把所有单位资料混在一起、前端过滤 | ❌ 禁止 | 越权风险 |
| 用 `role` 决定能不能写 | ❌ 禁止 | role 明文可伪造，要后端再验 |

第3级共用插件（各单位自部署）：每个部署本来就只服务一个单位，仍建议把 `tenantKey`（单位码）写进设定，避免被带错参数污染。

---

## 4. registry「名片」统一栏位

每个插件交付时给这张名片（填进 hub 的 `plugins[]`）：

```json
{
  "id": "library",
  "title": "通告图书馆",
  "icon": "📚",
  "url": "https://circulars.example.com",
  "description": "搜罗各区/地域/总会通告。",
  "version": "1.0.0",
  "tier": 2,
  "needsUnitBackend": false,
  "embed": true,
  "type": "jump",
  "status": "active",
  "scopes": ["district", "troop"]
}
```

| 栏位 | 规则 |
|---|---|
| `id` | 全域唯一、英数 `-_`、永不更名（= cardId） |
| `tier` | 2=即插即用（共用后端） / 3=各单位自部署（接法B） |
| `url` | 第2级填共用网址；第3级留空（网址在 `units.endpoints`） |
| `embed` | 能在 iframe 跑才 `true`；需 OAuth/cookie 跳转填 `false` |
| `scopes` | **新增**：`["district"]` / `["troop"]` / `["district","troop"]`（共用） |
| `status` | `active` / `disabled` |

> **共用插件**：把**同一份名片**分别登记进区 hub 和旅团 hub（id 相同），`scopes` 写 `["district","troop"]`。
> 两个 hub 各自的 `units` 仍独立管理（区的单位是 SKW/CHW…，旅团的是 82/83…）。

---

## 5. 四种组合速查（适用范围 × tier）

| | 第2级（即插即用） | 第3级（各单位自部署） |
|---|---|---|
| **只区** | 你部署1份共用，区 hub 填 url；`scopes:["district"]` | 各区自部署，区 hub `units.endpoints` 填各区 url |
| **只旅团** | 你部署1份共用，旅团 hub 填 url；`scopes:["troop"]` | 各旅团自部署，旅团 hub `units.endpoints` 填各旅团 url |
| **共用** | 你部署**1份共用**服务区+旅团；两 hub 都填同一 url；`scopes:["district","troop"]`；靠单位码（字母/数字）隔离 | 各单位自部署；两 hub 各自 `units.endpoints` 登记；每份只服务一个单位 |

> 注：`scopes` 只是「这插件该登记进哪个 hub」的标记；插件执行时分辨区/旅团一律靠**单位码是否纯数字**，不靠 `scopes`、也不需要 scope 参数。

---

## 6. iframe / 安全（重点回顾）

- `embed=1`：不要画自己的返回列/大标题（外层已有）；RWD；可滚动。
- 允许被嵌：勿送 `X-Frame-Options: DENY`；用 CSP 则 `frame-ancestors` 放行 Portal 网域。
- 别靠第三方 cookie（iframe 常被封）；登入态用 URL/token/postMessage。
- 需 Google OAuth 等会被 iframe 挡的流程 → 该插件设 `embed:false` 走新分页。
- HTTPS；敏感操作后端再验身分，**不信前端的 `role`**。

---

## 7. 出厂自检清单

- [ ] 选好适用范围：district-only / troop-only / shared。
- [ ] 读单一参数 `u`，缺少时有提示。
- [ ] 用 `/^\d+$/` 判断纯数字→旅团、否则→区。
- [ ] 资料隔离直接用单位码 `u` 当 key（全域唯一）。
- [ ] 内部跳页保留 `u`。
- [ ] `embed:true` 者：可被嵌、RWD、无重复顶栏、不靠第三方 cookie。
- [ ] 不拿 `role` 当权限；敏感操作后端验证。
- [ ] registry 名片齐全：`id` 唯一、`tier`、`scopes`、`url` 规则正确。
- [ ] 共用插件：同一 id 登记进两个 hub，`scopes:["district","troop"]`。
- [ ] 第3级：附可自部署范本 + 部署后回报本单位 URL。
- [ ] 提供测试连结（带 `u=测试码`）验证可跑。

---

## 8. 一句话总结

> 插件统一读单一参数 `u`；用「纯数字→旅团、否则→区」分辨；直接拿单位码当资料 key（区字母/旅团数字，永不撞车）；共用插件同一 id 登进两个 hub；其余照 tier 决定一份共用还是各单位自部署。这样一份插件就能区旅团通吃，且免 scope、免复合 key。
