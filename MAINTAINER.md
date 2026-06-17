# 旅團轉駁中心 (Troop Service Hub) — 維護手冊（僅供作者）

> ⚠️ 給你自己維護用，不對外。對各旅團來說，他們只是用了你的某些系統，不知道背後連著這個中心。
> schema 3 / 與「區轉駁器」同等 level、同一套 schema。

* * *

## 一、這是什麼

整個「旅團 Portal」系統的運轉核心 / 轉駁器。
本質：一份 **registry.json**（外掛清單 + 接入名單），透過 Vercel 包成乾淨 API 端點供各旅團平台讀取。

```
你開發新系統 ──► 在 registry.json 加一段 ──► 推上 GitHub ──► Vercel 自動部署
                                                                    │
        各旅團 Portal 讀 /api/registry ◄────────────────────────────┘
                                                                    │
        旅團在「外掛市集」看到 ──► 自行決定安裝 / 給誰看
```

* * *

## 二、分級系統（核心）★

| 級別 | 意思 | 誰部署 | 網址放哪 | 佔誰額度 | 旅團要幹什麼 |
| --- | --- | --- | --- | --- | --- |
| **第 2 級** | 即插即用（共用系統） | **你**（1 份完整系統） | `plugins[].url` | 你 | 啟用即用，什麼都不做 |
| **第 3 級** | 需單位自設後台（接法B） | **你**（共用前端）+ **各旅團**（各設後端） | `plugins[].url` 留空；`units[].endpoints` 填你的共用前端 URL | 你（前端）+ 各旅團（後端） | 只須建後端（如 GAS / Sheet），不交給你 URL |

- `tier`：2 或 3（主欄位）。
- `needsUnitBackend`：tier2=false、tier3=true（validate 強制一致）。
- **第2級**：你部署一份完整系統（前端+後端），所有旅團共用，`plugins.url` 填那條共用網址。
- **第3級（接法B）**：你部署一份**共用前端**（Vercel），每個旅團只須部署自己的**後端**（如 GAS / Google Sheet / 資料庫）。前端的 Vercel 專案透過私密方式（環境變數 / 配置表）內部連接到各旅團的後端。`plugins.url` 留空，`units.endpoints` 填你的共用前端網址。

> 為何用接法B：後端資料量大、需要獨立帳號、或後端免費（GAS）但前端統一控制。前端共用由你維護更新，後端各旅團自設不佔你額度。
> 
> 第3級的**前端**是 1 份共用（你部署），不是每個旅團各自部署一份。旅團只須建後端。

* * *

## 三、檔案結構

```
troop-router/
  public/
    index.html            維護面板（noindex；分級顯示 + 接入總覽 + 內建維護指引）
    api/registry.json     ★ 你唯一要維護的檔案（plugins + units）
  scripts/validate.js     驗證格式 / 分級一致 / 第3級 endpoint 是否齊全
  vercel.json             把 /api/registry 包成乾淨 API + CORS + 快取
  package.json
  MAINTAINER.md           本檔
```

對外端點（部署後）：`https://你的專案.vercel.app/api/registry` ← 各旅團 Portal 的 `REGISTRY_URL` 填這個。

* * *

## 四、兩級系統的詳細架構

### 第 2 級：即插即用（你部署 1 份完整系統）

```
你部署 1 份完整系統（前端 + 後端）
    │
    ▼ 所有旅團共用這條 URL
各旅團 Portal 帶 ?u=82 或 ?u=83 進入
    │
    ▼ 同一套後台用 ?u= 分流資料
你的共用後端（Vercel / GAS / DB）
```

**Registry 填法**：
```json
{
  "plugins": [
    { "id": "troop_lib", "tier": 2, "needsUnitBackend": false,
      "url": "https://scout-circulars.vercel.app/" }
  ],
  "units": [
    { "id": "82", "installs": ["troop_lib"] }  // 只需 install，不需要 endpoints
  ]
}
```

- `plugins.url` 必填（共用網址）
- `units` 中不需要 `endpoints`（因為網址在 `plugins.url` 已指定）
- 所有旅團共用一份後端，你負責維護和額度

---

### 第 3 級：接法B（你部署共用前端 + 各旅團自設後端）

```
你部署 1 份共用前端（Vercel）
    │
    ▼ 所有旅團共用這個 URL
各旅團 Portal 帶 ?u=82 進入 → 打開你的共用前端
    │
    ▼ 前端內部透過私密方式找到 82 的後端
Vercel 環境變數 / 配置表 / 代理 API
    │
    ▼ 內部連接（用戶永遠看不到）
82 旅自己的後端（GAS / Sheet / DB）
83 旅自己的後端（GAS / Sheet / DB）
```

**Registry 填法**：
```json
{
  "plugins": [
    { "id": "troop_attendance", "tier": 3, "needsUnitBackend": true,
      "url": "" }  // 第3級 plugins.url 留空！
  ],
  "units": [
    { "id": "82", "name": "第82旅",
      "installs": ["troop_attendance"],
      "endpoints": {
        "troop_attendance": "https://troop-attendance.vercel.app"
      }
    }
  ]
}
```

- `plugins.url` **必須留空**（網址跟著單位走，但跟的是**共用前端**網址）
- `units.endpoints[插件id]` 填你的**共用前端** URL（不是旅團的後端 URL！）
- 各旅團的後端 URL 由你的共用前端內部管理（Vercel 環境變數、私密配置表等），**絕對不要**放在 Registry 中
- 旅團只須建後端（如 GAS），不須部署 Vercel

---

### 兩級速查

| 決策點 | 選第 2 級 | 選第 3 級（接法B） |
|--------|----------|-------------------|
| 所有旅團共用同一套資料？ | ✅ | ❌ |
| 旅團只需啟用，什麼都不做？ | ✅ | ❌ |
| 每個旅團需要獨立後台 / 獨立資料？ | ❌ | ✅ |
| 後端佔額度大（Vercel / DB）？ | ❌ | 可選 GAS 免費 |
| 前端需要統一控制 / 頻繁更新？ | — | ✅（你控制） |
| 旅團只會建後端（不會前端）？ | — | ✅ |

* * *

## 五、日後維護：常見動作怎麼做 ★（這是你最常翻的一節）

### A) 新增一個第2級（即插即用）插件

1. 你部署好完整系統（前端+後端），拿到一條共用網址。
2. `public/api/registry.json` 的 `plugins` 加：

```json
{
  "id": "games",
  "title": "旅團遊戲庫",
  "icon": "🎲",
  "url": "https://your-games.example.com",
  "tier": 2,
  "needsUnitBackend": false,
  "embed": true,
  "type": "jump",
  "status": "active"
}
```

3. `npm run validate` → `git push`。旅團啟用即用。

---

### B) 新增一個第3級（接法B）插件

1. 你開發**共用前端**（Vercel 靜態/SSR），並設計好「如何內部連接各旅團後端」的機制（如 Vercel 環境變數、代理 API）。
2. 寫好「旅團後端部署教學」（旅團只須建後端，不碰前端）。
3. `plugins` 先登記「插件存在」（ **url 留空**）：

```json
{
  "id": "troop_attendance",
  "title": "集會點名系統",
  "icon": "📝",
  "url": "",
  "tier": 3,
  "needsUnitBackend": true,
  "embed": false,
  "type": "jump",
  "status": "active"
}
```

4. 部署你的共用前端，取得網址如 `https://troop-attendance.vercel.app`。
5. `validate` → `push`。此時還沒有旅團能用，要等 C)。

---

### C) 某旅團要用某個第3級插件（例：82 旅要用 troop_attendance）

1. **82 旅** 按你的教學部署自己的後端（如新建 GAS + Sheet）→ 交給你**後端 URL**，例如 `https://script.google.com/macros/s/.../exec`。
2. 你更新**共用前端**的內部配置（如 Vercel 環境變數），把 82 旅的後端 URL 私密登記進去：
   ```
   GAS_MAP = {"82":"https://script.google.com/...exec", ...}
   ```
3. 你在 `units` 找到 82（沒有就新增），更新 `installs` 與 `endpoints`：

```json
{
  "id": "82",
  "name": "第82旅",
  "installs": ["troop_lib", "troop_attendance"],
  "endpoints": {
    "troop_attendance": "https://troop-attendance.vercel.app"
  }
}
```

> ⚠️ `endpoints` 填的是**你的共用前端** URL，不是旅團的後端 URL！後端 URL 只存在你的 Vercel 環境變數 / 私密配置中。

4. `validate` → `push`。（validate 會擋：接入了第3級卻沒填 endpoint 會報錯。）

---

### D) 某旅團要用第2級插件

不用碰轉駁器（他啟用即用）。若你想在面板「接入總覽」看到，就在該旅團 `installs` 加上插件 id（第2級不需 endpoint）。

---

### E) 下架 / 隱藏一個插件（不刪）

把該插件 `"status": "active"` 改成 `"disabled"` → push。各旅團市集不再顯示。

---

### F) 緊急停服 / 搬家（保命）

轉駁器純靜態、不追蹤。後門已取消，策略＝全停 + 搬家：

- **全停**：Vercel 刪專案；或把 registry 改成 `{"schema":3,"plugins":[],"units":[]}` 再 push。
- **搬家**：新 repo / 新 Vercel 部署 → 拿新 `/api/registry` → 各旅團 Portal 改 `REGISTRY_URL` → 舊網址作廢。

* * *

## 六、Registry 欄位字典

### `plugins[]`（外掛清單）

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | ✓ | 唯一代號（英數 - _），永不更名（= cardId） |
| `title` | ✓ | 顯示名稱 |
| `icon` | | 表情符號，如 📝 |
| `url` | tier2 必填，tier3 留空 | **第2級**：填共用網址。**第3級**：留空（網址在 `units.endpoints`） |
| `tier` | ✓ | 2 或 3 |
| `needsUnitBackend` | ✓ | tier2=false，tier3=true（validate 強制一致） |
| `embed` | | 能在 iframe 跑才 true；需 OAuth/cookie 跳轉填 false |
| `type` | | `jump` / `builtin` / `resource`（第三方一律 jump） |
| `status` | | `active` 或 `disabled` |
| `roles` | | 哪些角色能看到這張卡片 |
| `scopes` | | `["troop"]` / `["district"]` / `["district","troop"]`（共用） |

### `units[]`（接入名單）

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | ✓ | 旅團代碼（純數字） |
| `name` | | 旅團名稱，如「第82旅」 |
| `installs` | | 已安裝的插件 id 列表 |
| `endpoints` | tier3 必填 | **第3級**：插件 id → 你的共用前端 URL。第2級不需要。 |

> ⚠️ **絕對不要** 在 `units` 或 `plugins` 中放旅團的後端 URL（如 GAS URL、資料庫密鑰）。Registry 是公開 API，任何人都能 `fetch` 讀取。後端 URL 必須藏在你的共用前端內部（Vercel 環境變數、私密配置表等）。

* * *

## 七、安全設計規範（設計第3級插件前必讀）

### 1. 後端 URL 絕對不進 Registry

Registry 是公開 API（CORS `*`），任何人都能：
```javascript
fetch('https://troop-router.vercel.app/api/registry').then(r => r.json())
// 能看到所有 plugins 和 units 的內容
```

所以 `units.endpoints` 只能放**你的共用前端 URL**，不能放旅團的後端 URL。後端 URL 必須由你的共用前端內部管理：
- **Vercel 環境變數**（最推薦）：`GAS_MAP = {"82":"https://..."}`，只有你能看到
- **私密配置表**：共用前端內部的加密配置檔

### 2. 後端必須驗證 `?u=` 參數

每個旅團的後端（如 GAS）必須驗證請求帶來的 `u` 參數是否匹配該旅團的代碼（如 `TROOP_CODE`），防止資料混亂：
```javascript
// GAS 範例
if (e.parameter.u !== Config.TROOP_CODE) {
  throw new Error('Unauthorized: unit mismatch');
}
```

### 3. 可選雙重驗證（API_KEY）

若後端是 GAS 且 URL 可能被猜到，可在 Vercel 代理和 GAS 之間設定共用密鑰：
- Vercel 代理自動附加 `?api_key=secret`
- GAS 驗證 `api_key` 是否匹配 `Config.API_KEY`

### 4. 設計新插件前的檢查清單

- [ ] 確認分級：第2級（完整共用）或 第3級（共用前端 + 各旅團後端）
- [ ] 若第3級：確定後端 URL 不會放在 Registry 中（用 Vercel 環境變數或私密配置）
- [ ] 若後端是 GAS：在 GAS 中驗證 `?u=` 參數匹配 `TROOP_CODE`
- [ ] 旅團後端部署教學是否完整（旅團只須建後端，不碰前端）
- [ ] Registry 的 `units` 範例是否正確（`endpoints` 只填共用前端 URL）

* * *

## 八、設計新插件的決策流程

```
開始設計新插件
    │
    ▼
所有旅團共用同一套資料？
    │
    ├── 是（如通告、圖書館）→ 選 第2級：你部署1份完整共用系統
    │
    └── 否（每個旅團獨立資料）
        │
        ▼
        選 第3級：接法B（你部署共用前端 + 各旅團自設後端）
        │
        ├── 你控制前端 Vercel 專案
        ├── 寫好旅團後端部署教學（只建後端，不交前端）
        ├── 後端 URL 由你內部管理（環境變數），不進 Registry
        └── 旅團完成後交後端 URL 給你，你登記到環境變數
```
