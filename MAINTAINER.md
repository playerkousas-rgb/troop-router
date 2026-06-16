# 旅團轉駁中心 (Troop Service Hub) — 維護手冊（僅供作者）

> ⚠️ 給你自己維護用，不對外。對各旅團來說，他們只是用了你的某些系統，不知道背後連著這個中心。
> schema 3 / 接法B（第3級各旅團自部署一條URL）。與「區轉駁器」同等 level、同一套 schema。

---

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

---

## 二、分級系統（核心）★

| 級別 | 意思 | 誰部署 | 網址放哪 | 佔誰額度 | 能否即用 |
|---|---|---|---|---|---|
| **第 2 級** | 即插即用（共用系統） | **你**（1 份共用） | `plugins[].url` | 你 | 旅團啟用即用 |
| **第 3 級** | 需單位自設後台（接法B） | **各旅團自己** | `units[].endpoints[插件id]` | 各旅團 | 該旅團先自部署 + 給你 URL |

- `tier`：2 或 3（主欄位）。
- `needsUnitBackend`：tier2=false、tier3=true（validate 強制一致）。
- **第2級**：一份系統服務所有旅團，`plugins.url` 填那條共用網址。
- **第3級（接法B）**：插件本身不放固定網址（`plugins.url` 留空），每個旅團各自部署一份、把自己的網址登記在 `units.endpoints`。**這樣額度算各旅團頭上，不佔你額度。**

> 為何用接法B 而非「單一URL + ?t=」：後者一個帳號的後台要扛全部旅團，額度會先爆。
> 接法B 每個旅團跑在自己帳號上，零負擔在你身上。

---

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

對外端點（部署後）：`https://你的專案.vercel.app/api/registry` ← 各旅團 Portal 的 REGISTRY_URL 填這個。

---

## 四、日後維護：常見動作怎麼做 ★（這是你最常翻的一節）

### A) 新增一個第2級（即插即用）插件
1. 你部署好插件，拿到一條共用網址。
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

### B) 新增一個第3級（需自設後台）插件
1. 把插件做成可被各旅團自行部署的範本。
2. `plugins` 先登記「插件存在」（**url 留空**）：
```json
{
  "id": "attendance",
  "title": "旅團點名系統",
  "icon": "✅",
  "url": "",
  "tier": 3,
  "needsUnitBackend": true,
  "embed": false,
  "type": "jump",
  "status": "active"
}
```
3. `validate` → `push`。此時還沒有旅團能用，要等 C)。

### C) 某旅團要用某個第3級插件（例：82 旅要用 attendance）
1. **82 旅自己**用他的帳號部署一份 attendance → 給你網址，例如 `https://attendance-82.vercel.app`。
2. 你在 `units` 找到 82（沒有就新增），更新 `installs` 與 `endpoints`：
```json
{
  "id": "82",
  "name": "第82旅",
  "installs": ["troop_lib", "troop_dbs", "attendance"],
  "endpoints": {
    "troop_dbs": "https://dbs-82.vercel.app",
    "attendance": "https://attendance-82.vercel.app"
  }
}
```
3. `validate` → `push`。（validate 會擋：接入了第3級卻沒填 endpoint 會報錯。）

### D) 某旅團要用第2級插件
不用碰轉駁器（他啟用即用）。若你想在面板「接入總覽」看到，就在該旅團 `installs` 加上插件 id（第2級不需 endpoint）。

### E) 下架 / 隱藏一個插件（不刪）
把該插件 `"status": "active"` 改成 `"disabled"` → push。各旅團市集不再顯示。

### F) 緊急停服 / 搬家（保命）
轉駁器純靜態、不追蹤。後門已取消，策略＝全停 + 搬家：
- **全停**：Vercel 刪專案；或把 registry 改成 `{"schema":3,"plugins":[],"units":[]}` 再 push。
- **搬家**：新 repo / 新 Vercel 部署 → 拿新 `/api/registry` → 各旅團 Portal 改 `REGISTRY_URL` → 舊網址作廢。

---

## 五、欄位字典

**plugins[]**

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | ✓ | 唯一代號（英數 - _），安裝後即 cardId，不要事後改 |
| `title` | ✓ | 卡片名稱 |
| `tier` | ✓ | 2=即插即用 / 3=需單位自設後台 |
| `url` | 第2級✓ | 第2級填共用網址；第3級留空（網址在 units.endpoints） |
| `needsUnitBackend` | | tier2=false / tier3=true |
| `icon` `description` `version` `embed` `type` `status` `roles` | | 顯示 / 行為用 |

**units[]**

| 欄位 | 說明 |
|---|---|
| `id` | 旅團代碼（唯一） |
| `name` | 旅團名稱（顯示用） |
| `installs` | 已接入的插件 id 清單（要對得上 plugins） |
| `endpoints` | 物件：`{ "插件id": "該旅團自己的網址" }`，**第3級必填、第2級不需要** |

> ⚠️ units 是**手動維護**的紀錄表——轉駁器純靜態、無法自動得知誰裝了什麼。旅團裝/退時你自己更新。
> 要「即時自動」統計需另加回報端點（破壞純靜態原則），暫不做。

---

## 六、部署到 Vercel（一次性）

1. repo 推到 GitHub（建議 private）。
2. Vercel → Add New Project → 匯入 repo。
3. Framework Preset 選 **Other**（純靜態，無 build）。
4. Deploy → 拿到網址，例如 `https://troop-hub.vercel.app`。
5. 測試 `https://troop-hub.vercel.app/api/registry` 應回傳 JSON。
6. 把 `/api/registry` 填入各旅團 Portal 的 `REGISTRY_URL`。

> 純靜態 = 零維護、零 serverless 額度。vercel.json 已處理 CORS 與快取（5 分鐘）。
