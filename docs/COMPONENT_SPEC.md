# 元件（外掛）開發對接規範 — Scout Portal × 轉駁器

> 對象：日後任何要接入「童軍區 Portal / 旅團 Portal」的元件開發者（包括你自己）。
> 目的：寫元件前先照這份做，元件就能無痛被主系統載入、嵌入、帶入單位資訊。
> 依據：主系統 `scout-district-portal`（Next.js，統一前端 + 各單位獨立 Apps Script 後台）+ 轉駁器 registry (schema 3)。

---

## 0. 名詞對照（先看這個）

| 概念 | 區系統 | 旅團系統 |
|---|---|---|
| 單位碼 query 參數 | 統一用 `u`，值=字母碼（如 `u=SKW`） | 統一用 `u`，值=純數字碼（如 `u=0082`） |
| 轉駁器 registry | `scout-portal-hub` | `troop-service-hub` |
| 第2級 | 即插即用（你部署一份共用） | 同 |
| 第3級 | 各單位自部署一條 URL（接法B） | 同 |

**單位碼規則（地基）**：區=字母碼、旅團=純數字碼，全域唯一、永不撞車。插件用一句話分辨：**`u` 純數字 → 旅團；否則 → 區**（`/^\d+$/.test(u)`）。不需要 scope 參數，直接拿 `u` 當資料 key。
本文用「**單位**」泛指 區 / 旅團。

---

## 1. 主系統怎麼載入並開啟你的元件（你必須先懂的流程）

1. 元件先在**轉駁器 registry** 登記（見 §6）。
2. 單位管理員在「外掛市集」按**安裝** → 元件變成主控台的一張**卡片**。
3. 使用者點卡片時，主系統依 `type` / `embed` 決定開法：

| 情況 | 主系統行為 | 你的元件被怎麼開 |
|---|---|---|
| `type: "builtin"` | 內部路由 | （保留給官方內建，第三方元件**不要用**） |
| `embed: true` | 進 `/embed` → 用 **iframe** 包住你的網址 | 你的頁面在 iframe 內顯示 |
| 其他（`embed:false`） | `window.open(url)` | 你的頁面在**新分頁**開啟 |

> 第3級（各單位自部署）：主系統實際打開的是**該單位自己那條 endpoint URL**（轉駁器 `units.endpoints` 登記的那條），不是一條共用網址。

---

## 2. 主系統會自動附加到你 URL 的參數（★ 核心合約）

無論新分頁或 iframe，主系統都會在你的元件 URL 後面接上這些 query 參數：

| 參數 | 範例 | 何時有 | 意義 |
|---|---|---|---|
| `u` | `u=SKW` / `u=0082` | 永遠 | **目前單位碼**（你最重要的輸入；純數字=旅團，否則=區） |
| `role` | `role=leader` | 永遠 | 使用者在該單位的角色（明文，**勿作安全憑證**，見 §5） |
| `from` | `from=portal` | 永遠 | 來源標記＝由 Portal 進入 |
| `embed` | `embed=1` | 僅 iframe 模式 | 代表你正被嵌入，UI 要收斂（見 §4） |

**你的元件最少要做到：**
```js
const q = new URLSearchParams(location.search);
const unit  = q.get('u');                 // 單位碼（唯一）
const role  = q.get('role') || 'guest';
const embed = q.get('embed') === '1';
const isTroop = /^\d+$/.test(unit || ''); // 純數字=旅團，否則=區
if (!unit) { /* 顯示「請從 Portal 進入」或讓使用者手動選單位 */ }
```

- 收到 `u` 後請**沿用並傳遞**（自己內部跳頁時保留它），不要弄丟。
- 不要假設一定有人登入；但若 `from=portal` 且有 `role`，可視為由平台帶入的情境。

---

## 3. 第2級 vs 第3級：你要交付什麼

### 第2級（即插即用 / 共用系統）
- **你部署一份**，服務所有單位（額度算你頭上）。
- 必須**靠 `?u=` 自行分流**同一份系統內不同單位的資料（直接以單位碼為 key 做資料隔離；區字母/旅團數字永不撞車）。
- 交付給轉駁器：**一條共用 URL** → 填 `plugins[].url`。

### 第3級（需單位自設後台 / 接法B）
- 做成**可被各單位自行部署的範本**（每個單位用自己的帳號部署、連自己的後台，額度算各單位頭上）。
- 該份部署天生只服務那一個單位（單位碼可寫死或仍由 `?u=` 帶入做雙重確認）。
- 交付：①一份可複製部署的範本＋部署說明；②每個單位部署後把**它自己的 URL** 給轉駁器維護者登記到 `units.endpoints`。
- 轉駁器 `plugins[].url` **留空**（網址跟著單位走）。

---

## 4. 嵌入（iframe）模式要求（embed:true 必讀）

當 `embed=1`：
- **不要**自己再畫一條頂部返回列 / 大標題 / 你自己的全站導覽 —— 外層 Portal 已有返回列與標題，重複會醜且擠。
- 版面要**自適應寬度**（RWD），能在較窄的 iframe 內正常用；高度可滾動。
- **不要禁止被 iframe 嵌入**：
  - 不要送 `X-Frame-Options: DENY/SAMEORIGIN`；
  - 若用 CSP，需允許上層來源，例如
    `Content-Security-Policy: frame-ancestors 'self' https://scout-district-portal.vercel.app https://*.vercel.app;`
- iframe 由平台開 `allow="clipboard-write"`，需要複製功能可用；其他特殊權限（攝影機等）平台預設沒給，別依賴。
- 第三方 cookie 在 iframe 中常被瀏覽器封鎖：**登入態請用 URL 參數 / token-in-URL / postMessage，不要只靠 cookie**。

> 若你的系統一定要 cookie / 跳轉登入（如 Google OAuth 在 iframe 內會被擋），請設 `embed:false` 走新分頁，別硬塞 iframe。

---

## 5. 安全與信任邊界（★ 別踩雷）

- 主系統傳來的 `role` / `u` 都是**明文 query，沒有簽章**，使用者可竄改。
  - ⇒ **不可**只憑 `role=dc` 就給管理權限。
  - 第2級若涉及敏感操作，請在你自己後端**再驗證一次身分**（例如要求登入 / 驗證 token）。
  - 第3級因為是單位自設後台，身分以你自己後台為準，`?u=` 僅作情境輔助。
- HTTPS 必須。混合內容（http 資源）在 iframe 會被擋。
- 若提供 API，CORS 自理；要被 Portal 前端直接讀的話需允許其來源。
- 不要在前端硬編任何單位的私密金鑰；單位後台金鑰只放各單位自己的 Apps Script / 後端。

---

## 6. 登記到轉駁器 registry 的欄位（你要交的「元件名片」）

主系統前端目前讀的欄位（見 `lib/types.ts` 的 `PluginItem`）：
`id, title, icon, url, description, version, embed, type, needsDistrictBackend`。

對應到新 hub schema 3 的填法：

**第2級範例（共用，url 必填）**
```json
{
  "id": "events",
  "title": "區際活動報名",
  "icon": "🎪",
  "url": "https://your-events.example.com",
  "description": "區際活動報名、分組、計分。",
  "version": "1.0.0",
  "tier": 2,
  "needsUnitBackend": false,
  "embed": true,
  "type": "jump",
  "status": "active"
}
```

**第3級範例（各單位自部署，url 留空）**
```json
{
  "id": "dbs",
  "title": "專章系統 DBS",
  "icon": "🎗",
  "url": "",
  "description": "獨立考核系統，每單位自部署。",
  "version": "2.0.0",
  "tier": 3,
  "needsUnitBackend": true,
  "embed": true,
  "type": "jump",
  "status": "active"
}
```

> 相容性提醒：主系統前端用的是 `needsDistrictBackend`（布林）。轉駁器 → 主系統之間若有 Apps Script 代理，請確保它把 `tier:3 → needsDistrictBackend:true`、`tier:2 → false` 對映出去（或同時保留兩個欄位）。`type` 第三方元件一律填 `jump`。

**欄位給值規則**
| 欄位 | 規則 |
|---|---|
| `id` | 全域唯一、英數 `-_`，安裝後即 cardId，**永不更名** |
| `title` / `icon` / `description` | 顯示用，icon 用單一 emoji |
| `tier` | 2 或 3 |
| `url` | 第2級填共用網址；第3級留空 |
| `embed` | 能在 iframe 正常運作才填 `true`；需 OAuth/cookie 跳轉就填 `false` |
| `version` | 顯示用版本號 |
| `status` | `active` 顯示 / `disabled` 下架 |

---

## 7. 交付前自我檢查清單（Checklist）

- [ ] 從 `?u=` 正確讀到單位碼；缺少時有合理提示，不會直接壞掉。
- [ ] 內部跳頁會保留單位碼（不弄丟 `u`）。
- [ ] HTTPS；無混合內容。
- [ ] 若 `embed:true`：能被 iframe 嵌入（無 X-Frame-Options/CSP 阻擋）、RWD、無重複頂欄、不靠第三方 cookie。
- [ ] 若需 OAuth/cookie 登入：改用 `embed:false`（新分頁）。
- [ ] 不把 `role` 當權限憑證；敏感操作有自己的身分驗證。
- [ ] 第2級：同一份系統能用單位碼正確隔離各單位資料。
- [ ] 第3級：提供可複製的部署範本 + 部署說明；部署後回報自己的 URL。
- [ ] registry 名片欄位齊全且 `id` 唯一、不重名。
- [ ] （建議）提供一個 `?from=portal` 進來的測試連結，附 `u=測試碼` 驗證能跑。

---

## 8. 最小可用元件骨架（純前端範例）

```html
<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- 允許被 Portal 嵌入；按需收窄來源 -->
</head><body>
<div id="app">載入中…</div>
<script>
  const q = new URLSearchParams(location.search);
  const unit  = q.get('u');
  const role  = q.get('role') || 'guest';
  const embed = q.get('embed') === '1';
  const fromPortal = q.get('from') === 'portal';
  const isTroop = /^\d+$/.test(unit || '');  // 純數字=旅團，否則=區

  if (!unit) {
    document.getElementById('app').innerHTML = '請從 Portal 進入（缺少單位碼）。';
  } else {
    // 用 unit 去抓該單位資料；embed 時收斂 UI（不畫返回列/大標題）
    document.body.classList.toggle('embedded', embed);
    document.getElementById('app').textContent =
      `單位=${unit}｜角色=${role}｜${embed ? '嵌入模式' : '獨立分頁'}`;
    // ⚠️ 敏感操作：別只信 role，請呼叫自己的後端再驗證身分
  }
</script>
</body></html>
```

---

## 9. 一句話總結

> 讀 `?u=` 認單位（純數字=旅團、否則=區）、`embed=1` 就收斂 UI 並允許被嵌、別把 `role` 當權限、第2級交一條共用 URL、第3級交可自部署範本＋各單位回報自己的 URL，最後在 registry 登好名片即可。
