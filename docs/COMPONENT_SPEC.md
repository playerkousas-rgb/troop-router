# 元件（外掛）開發對接規範 — 任何人都可以設計插件！

> **任何人**（學生、領袖、義工、開發者、甚至只是有想法的人）都可以做出插件，讓全香港的童軍區和旅團使用。
> 這份文件就是為了讓你**不用等官方**，也能輕鬆做出實用的插件。
> 依據：主系統 `scout-district-portal`（Next.js，統一前端 + 各單位獨立 Apps Script 後台）+ 轉駁器 registry (schema 3)。


---

## 🚀 任何人 5 分鐘快速開始

**你不需要寫很複雜的東西。**

1. 看 §2（主系統會自動傳 `u=` 單位碼）
2. 複製上面的「最小可用元件骨架」
3. 改幾行文字，部署一份（Vercel / Netlify 都行）
4. 告訴我們把插件登記進 registry

→ 登記後，所有使用這套系統的區和旅團**馬上就能安裝**你的插件。

小工具也很好。點名、活動報名、文件庫、圖書借還… 任何有用的小東西都很歡迎。

---


---


---


---


---

---

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


## 5.5. API 鎖（僅適用於第 3 級）

本平台對 API 鎖的要求依元件等級而定：

- **第 2 級（即插即用）**
  這類元件通常不處理個人資料，或甚至完全沒有後端。
  **不需要實作 API 鎖**。
  只要以 `u` 作為資料隔離依據即可。

- **第 3 級（需單位自設後台）**
  這類元件會處理該旅團或該區自己的資料。
  **必須實作 API 鎖**，以保護各單位專屬資料。

### 第 3 級應滿足的基本條件

1. 前端所有 API 請求經由 proxy 轉發（不直接呼叫後端）。
2. API 金鑰僅存放於 server 端（Vercel 環境變數或後端設定）。
3. 後端必須驗證：
   - 驗證 `u` 單位碼（確保只操作該單位的資料）
   - 驗證 API Key / Token
4. 在元件提供的**部署說明**中清楚告知單位需實作 API 鎖，並附上後端範例。

**建議在 registry 描述中標註：**
> 第 3 級元件，處理單位專屬資料。後端需實作 API 鎖。

### 開發時請確認

- 第 2 級：確認不涉及個人資料 → 無需 API 鎖。
- 第 3 級：已規劃 proxy + 後端驗證機制，並寫入部署文件。

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


---

## 10. 歡迎任何人一起設計插件！

這套系統最大的價值，不是我們做了多少功能，而是**開放給任何人貢獻**。

### 你不需要是官方

- 學生、領袖、義工、獨立開發者、甚至只是有想法的人，都可以參與。
- 不需要寫很複雜的程式。
- 即使只是一個小工具，只要對童軍有幫助，就值得做。

### 貢獻門檻很低

**最推薦新手從第 2 級開始**：
- 你只部署一份系統
- 所有區、所有旅團都能直接使用
- 只要讀取 `?u=` 就能知道現在是哪個單位
- 資料用單位碼自然隔離

很多實用的插件，其實只需要簡單的前端 + 讀 `u` 參數就能完成。

### 怎麼開始？

1. 看完這份文件（重點看 §2 接收參數、§4 iframe 要求、§5.5 API 鎖規則）
2. 做出一個最小可用的版本（上面有提供骨架）
3. 決定好是第 2 級還是第 3 級
4. 把插件資料提供給轉駁器維護者，登記到 registry

一旦登記完成，所有使用這個平台的區和旅團，**馬上就能在「外掛市集」看到你的插件**，並一鍵安裝。

### 我們歡迎各種插件

- 活動報名
- 點名系統
- 文件 / 通告庫
- 營地預訂
- 制服團購
- 財務管理
- 進度追蹤
- 家長溝通
- ……任何你覺得有意義的東西

---

**一句話：**

> 你現在就可以開始設計插件。  
> 做出來登記上去，就是在幫助全香港的童軍。

有想法就去做吧！我們非常歡迎你的貢獻。



**想現在就開始？**

→ 直接跳到上面「最小可用元件骨架」  
→ 做出一個最簡單的版本  
→ 告訴我們登記進 registry

你做的插件，馬上就能讓很多單位使用。























































## 這是一個開放的插件市場（上架主要是幫忙登記）

我們的核心理念是：

**讓未來任何人寫插件，**  
**讓旅團和區覺得好用，**  
**就自己把插件插回他們的主系統，**  
**令他們的主系統越來越貼合他們真正的需要。**

### 實際上架方式

- **開發完全開放**：任何人（不管是不是官方）都可以自由開發插件。
- **要被大家看到，需要登記**：想讓區和旅團在「元件市場」看到你的插件，需要把插件資訊提供給這個轉駁器登記。
- **主要是幫忙登記**：我原則上是不會卡的，只要基本資訊齊全，會協助把插件登記上架。
- **只有設計有漏洞才會暫時不上架**：除非他們在設計上有漏洞，才有可能暫時不上架。

簡單來說：
> 寫插件誰都可以，**上架主要是幫忙登記**，我原則上是不會卡的，除非他們在設計上有漏洞，才有可能暫時不上架。
