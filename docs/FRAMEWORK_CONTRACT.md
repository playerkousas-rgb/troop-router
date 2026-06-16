# 端到端框架契約 (Framework Contract) — 推出前对标基准

> 目的：在主系统正式推出前，把「转驳器 ↔ 各单位 Apps Script ↔ 主系统前端 ↔ 元件」四层之间的资料结构与责任**钉死**，之后接元件、接单位都照这份，不用推倒重来。
> 版本：schema 3 / 接法B。区 = `scout-district-portal` + `scout-portal-hub`；旅团 = 旅团 Portal + `troop-service-hub`。

---

## 0. 资料流全景（必须先懂）

```
①转驳器 registry.json（GitHub→Vercel，纯静态）
     plugins[] + units[].endpoints   ← 你维护
        │  各单位 Apps Script 用 REGISTRY_URL fetch
        ▼
②各单位 Apps Script  getRegistry(token)        ← 责任最重的一层
     - 认得「我是哪个单位」(本地常量 UNIT_CODE)
     - 第3级：把 plugins[].url 空值换成 units[本单位].endpoints[id]
     - tier → needsDistrictBackend 映射
     - 标记 installed（对照本单位已安装卡片表）
        │  回传 RegistryBundle 给前端
        ▼
③主系统前端  外掛市集 /plugins
     - 显示元件；按「安装」→ installPlugin(plugin)
     - Apps Script 把该 plugin 写进「卡片表」（含解析后的 url）
        │  getCards(token)
        ▼
④主系统前端  主控台 CardItem / /embed
     - 开 card.url，自动加 ?u=单位码&role=&from=portal(&embed=1)
        ▼
⑤你的元件   读 ?u= 认单位（纯数字=旅团/否则=区）、按 embed 收敛 UI
```

**一句话定责任：**
- **转驳器**＝资料源（清单 + 各单位 endpoint）。
- **Apps Script `getRegistry`**＝翻译官（解析第3级 url、做 tier 映射、补 installed）。← 第3级能不能用，全看这层。
- **前端**＝展示与安装，尽量不碰解析逻辑。
- **元件**＝照 §元件合约 收参数。

---

## 1. 转驳器 registry（①）— 权威结构 schema 3

```jsonc
{
  "schema": 3,
  "scope": "district",          // 或 "troop"
  "unitParam": "u",             // 统一参数名 u；区=字母码、旅团=数字码
  "unitLabel": "区",
  "plugins": [
    { "id":"events","title":"区际活动","icon":"🎪","url":"https://events.example.com",
      "tier":2,"needsUnitBackend":false,"embed":true,"type":"jump","status":"active" },
    { "id":"dbs","title":"专章系统 DBS","icon":"🎗","url":"",            // 第3级 url 留空
      "tier":3,"needsUnitBackend":true,"embed":true,"type":"jump","status":"active" }
  ],
  "units": [
    { "id":"SKW","name":"筲箕湾区","installs":["events","dbs"],
      "endpoints": { "dbs":"https://dbs-skw.vercel.app" } }   // 第3级本单位网址在这
  ]
}
```

权威规则（validate.js 已强制）：
- 第2级：`plugins.url` 必填（共用网址）、`needsUnitBackend:false`。
- 第3级：`plugins.url` 留空；某单位 `installs` 含此插件 → 必须有 `units.endpoints[id]`。
- `id` 全域唯一、不可改名。

---

## 2. Apps Script getRegistry（②）— 翻译官的输出契约

`getRegistry(token)` 必须回传给前端这个形状（对应 `lib/types.ts`）：

```ts
RegistryBundle = {
  registryUrl: string,
  plugins: PluginItem[]
}
PluginItem = {
  id, title, icon, description, version, type,   // 直接来自 registry
  embed: boolean,
  url: string,                 // ★ 已解析：第2级=共用url；第3级=本单位endpoint；本单位没部署=""
  needsDistrictBackend: boolean,   // ★ 由 tier 映射：tier3→true、tier2→false
  installed: boolean,          // ★ 对照本单位卡片表
  // 建议附带（前端可选用，向后兼容）：
  tier?: 2|3,
  available?: boolean          // 第3级且本单位无endpoint → false（前端显示「需先部署」并禁止安装）
}
```

**翻译官三件事（缺一第3级就坏）：**
1. **解析 url**：`tier===3` 时 `url = endpoints[id] || ""`；`available = !!url`。第2级 `url = plugin.url`，`available = true`。
2. **映射**：`needsDistrictBackend = (tier===3)`。
3. **标 installed**：查本单位「卡片表」有无该 id。

> 参考实作见 `framework/reference/getRegistry.gs`。

---

## 3. 安装写卡（③）— installPlugin 的存储契约

`installPlugin(token, plugin)` 时，Apps Script 写进「卡片表」一行：

| 卡片栏位 | 来源 | 说明 |
|---|---|---|
| `cardId` | `plugin.id` | 等于元件 id，唯一 |
| `title`/`icon`/`description` | plugin | |
| `type` | plugin（第三方一律 `jump`） | |
| `url` | **已解析的 url** | ★ 存「解析后」的真实网址，不要存空值/不要存 tier3 占位 |
| `embed` | plugin.embed | |
| `source` | `"plugin"` | 区分 core / plugin |
| `enabled` | true | |
| `order` | 自动接在最后 | |

**护栏：** 第3级若 `available=false`（本单位没 endpoint）→ 前端禁止点安装；后端 installPlugin 也应拒绝写入空 url，回 `{ok:false,error:"此第3级元件尚未为本单位部署后台"}`。

---

## 4. 开启元件（④）— 前端已实作，元件要接的合约

主系统开 `card.url` 时自动附加（**这是元件的输入合约，已实作于 CardItem/embed**）：

| 参数 | 值 | 何时 |
|---|---|---|
| `u` | 单位码（区=字母 / 旅团=数字） | 永远 |
| `role` | 使用者角色（明文，无签章） | 永远 |
| `from` | `portal` | 永远 |
| `embed` | `1` | 仅 iframe 模式 |

> 区与旅团统一送 `u`；插件靠「`u` 是否纯数字」分辨区/旅团，不需 scope 参数。

---

## 5. 元件合约（⑤）— 见 `COMPONENT_SPEC.md`

重点：读 `?u=` 认单位（纯数字=旅团、否则=区）；`embed=1` 收敛 UI 且允许被 iframe 嵌；`role` 不可当权限凭证；第2级交共用URL、第3级交可自部署范本+回报本单位URL；registry 登名片。

---

## 6. 前端需要的小对齐（建议，非必须就能跑）

主系统前端目前已能跑（靠 Apps Script 映射 `needsDistrictBackend`）。建议两点强化，让框架更稳（补丁见 `framework/reference/frontend-patch.md`）：
1. `PluginItem` 增 `tier?` 与 `available?`；市集对 `available===false` 的第3级显示「需先部署」并禁安装。
2. `CardItem`/`embed` 对 `card.url` 为空做防御（理论上 §3 护栏已挡，双保险）。

---

## 7. 推出前 To-Do 对标清单

- [ ] 转驳器（区/旅团）schema 3 + validate 通过 ✅（已完成）
- [ ] 各单位 Apps Script 套用 `getRegistry.gs` 参考实作（解析+映射+installed）
- [ ] `installPlugin` 存「解析后 url」+ 第3级空 url 护栏
- [ ] 前端（区+旅团）：单位参数名统一用 `u`
- [ ] （建议）前端补 `tier`/`available` 展示
- [ ] 用一个真实第3级元件（如 DBS）端到端走一遍：registry→getRegistry→安装→开卡→元件收到 `?u=&role=&from=portal`

---

## 7.5 常见误会澄清：Portal 不存插件资料，插件后端完全独立 ★

> 「钉死契约」锁的是**接口**（参数名、URL 登记位置），**不锁实作**。插件后端怎么做完全自由。

- **Portal 自己的 Sheet** 只存：使用者、角色、权限、**卡片清单（书签）**。卡片表一个插件一行，栏位仅 `cardId/title/icon/url/embed/enabled/order`，**不存任何插件的业务资料**。
- **插件的后端**是独立的：
  - 第2级 = 你托管的一份共用后端（你自己的 Sheet/DB）。
  - 第3级 = 各单位自部署的**独立 Apps Script 专案 + 自己的 Sheet**（接法B）。
- 插件要用**另一张 Sheet / 另一个帐号 / 另一个 DB / Firebase** 做后端 → **完全可以，而且第3级本来就该这样**。契约没有任何一条限制这点。

**装 N 个插件的负担：**
```
单位 Portal（1 个 Sheet）
  └ Cards 表：N 行书签   ← Portal 唯一负担，仅此而已（不会变慢/爆额度）
       ├ dbs       → https://dbs-<unit>.vercel.app       （插件A：自己的 Sheet/专案）
       ├ campsite  → https://campsite-<unit>.vercel.app  （插件B：自己的 Sheet/专案）
       └ …第N个     → 各自独立后端，互不相干
```
- Portal 只多 N 行书签，零额外负担；**不需要**连任何插件的 Sheet（零耦合）。
- N 个第3级插件 = N 个独立专案，**各有各的额度配额** → 接法B 正是用来分散负载，不是全挤一张 Sheet。

> 类比：契约像「插头规格」——插头形状统一（`?u=`、id 唯一、url 登记位置），但插头后面接什么电器（几张 Sheet、什么后端）完全随你。

---

## 8. 不变量（钉死，日后别改）

1. 单位码参数统一为 `u`；值规则：区=字母码、旅团=纯数字码（全域唯一，靠纯数字判别旅团）。
2. 元件 `id` = 卡片 `cardId`，全域唯一、永不更名。
3. 第3级网址只住在 `units.endpoints`，url 解析只发生在 Apps Script 那一层。
4. `role`/`u` 是明文输入，安全决策一律由各单位后台再验证。
5. 分级语义：tier2=共用即插即用、tier3=各单位自部署接法B。

> 不变量只锁「接口」，不锁「实作」：插件后端用几张 Sheet、什么数据库、用不用 Apps Script，完全自由（见 §7.5）。
