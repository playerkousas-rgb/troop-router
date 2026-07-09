# Router 第 3 級元件雙軌制規範

> 所有第 3 級元件均支援「獨立使用」或「接入主系統」兩種模式
> Router 只需登記一次，之後新旅團透過申請流程接入即可使用

---

## 核心概念

```
Router（登記一次）
      │
      │ "有這個插件可用"
      │
      ├─ 旅團 A ──→ 填申請表單 → Scout Admin APP 審核 → 加入設定檔 → 完
      ├─ 旅團 B ──→ 填申請表單 → Scout Admin APP 審核 → 加入設定檔 → 完
      └─ 旅團 C ──→ 兩種使用模式都可用
```

**Router 不需要知道任何旅團的 backend URL 或 API Key。**
**旅團的申請由 Scout Admin APP 統一管理。**

---

## 雙軌制說明

每個第 3 級元件支援兩種使用模式：

### 軌道 A：獨立使用

```
旅團打開前端 URL（例如：vsbadge.vercel.app）
      ↓
顯示旅團選擇列表（從 troops.json 讀取）
      ↓
選擇旅團 → 自動帶入 u 參數
      ↓
前端根據 u 參數查找 troops.json，取得 backend + apikey
      ↓
連接旅團自己的 Google Sheet 後端
      ↓
完成。不需要主系統。
```

- 適合：不想用主系統的小型旅團
- 身份：選擇「領袖」或「成員」

### 軌道 B：接入主系統

```
主系統卡片 → iframe 帶入 ?u=0082&role=leader&ymis=1234567890
      ↓
前端根據 u 參數查找 troops.json，取得 backend + apikey
      ↓
連接旅團自己的 Google Sheet 後端
      ↓
身份自動帶入，零設定
      ↓
完成。
```

- 適合：使用完整主系統的旅團
- 身份：主系統自動帶入，不需要再設定

### 雙軌並存

兩種模式不衝突。同一個旅團可以：
- 領袖從主系統卡片進入（自動帶身份）
- 成員直接打開 `vsbadge.vercel.app/?u=0082`（設定頁填一次就好）

---

## 架構：共用前端 + troops.json 對照表

```
┌─────────────────────────────────────────┐
│       共用前端 (vsbadge.vercel.app)      │
│  - 所有旅團共用同一份前端                │
│  - 根據 ?u= 參數查找旅團設定             │
└─────────────┬───────────────────────────┘
              │
              │ 從 troops.json 查找
              │
              ▼
┌─────────────────────────────────────────┐
│         troops.json（旅團對照表）        │
│  {                                      │
│    "0082": {                            │
│      "name": "第 82 旅",               │
│      "backend": "https://script...",   │
│      "apikey": "vs_xxxxxxxx"           │
│    }                                    │
│  }                                      │
└─────────────┬───────────────────────────┘
              │
              │ 連接對應的後端
              │
              ▼
┌─────────────────────────────────────────┐
│    各旅團獨立的 Google Sheet 後端        │
│  - 旅團自己建立和維護                   │
│  - API Key 自動生成                     │
└─────────────────────────────────────────┘
```

---

## 旅團接入完整流程

### 第 1 步：旅團建立後端（約 10 分鐘）

1. **建立 Google Sheet**
2. **貼上 Code.gs**（元件提供）
3. **執行 `initializeSheets()`**
   - 系統會自動建立所需工作表
   - 自動生成 **API Key**（格式：`vs_` 或 `ak_` + 24位隨機字元）
   - 顯示在螢幕上，旅團複製
4. **部署 Apps Script** → 複製 URL（存取：所有人）

### 第 2 步：旅團提交申請表單

在旅團 APP 的設定頁面，填寫並提交接入申請：

| 欄位 | 說明 |
|------|------|
| 旅團號 | 如 `0082` |
| 旅團名稱 | 如 `第 82 旅` |
| Apps Script URL | 第1步部署後複製的 URL |
| API Key | 第1步自動生成的 Key |
| 接入 APP | 選擇需要接入的系統 |

提交後：
- 資料自動寫入管理員 Google Sheet
- 自動寄 Email 通知管理員

### 第 3 步：管理員在 Scout Admin APP 審核

管理員收到 Email 後，前往 **Scout Admin APP**（https://scout-admin-blue.vercel.app/）：

1. 「📥 新申請」分頁查看待處理申請
2. 確認資料正確 → 點「✅ 標記完成」
3. 展開申請卡片，複製並貼入對應設定檔：

```
接入 vsbadge    → 複製 troops.json 片段 → 貼入 vsbadge repo
接入 scoutsystem → 複製 troops.ts 片段  → 貼入 lib/troops.ts
                 → 複製 Vercel env var  → 到 Vercel Dashboard 設定
```

### 第 4 步：git push → 自動部署

```bash
git add troops.json   # 或 lib/troops.ts
git commit -m "接入：第82旅"
git push
```

Vercel 自動重新部署，旅團立即可用。

### 第 5 步：旅團開始使用

- **獨立使用**：打開 `https://vsbadge.vercel.app/` → 選擇旅團
- **接入主系統**：從 Dashboard 元件卡片進入

---

## Scout Admin APP 功能說明

> 管理員用的後台工具，統一管理所有旅團申請。

| 分頁 | 功能 |
|------|------|
| 📥 新申請 | 查看所有申請、標記完成/拒絕、展開查看 JSON/TS 輸出 |
| 📋 旅團總覽 | 已接入旅團列表、一鍵複製完整 `troops.json` / `troops.ts` |
| 🔧 JSON/TS 產生器 | 手動輸入資料產生各 APP 所需格式 |
| 📜 Apps Script | 備份代碼 + 前端申請表單代碼（可複製嵌入新 APP） |
| ⚙️ 設定 | 匯出/匯入備份 |

---

## 各 APP 設定格式規範

### vsbadge — `troops.json`
```json
{
  "troops": {
    "0082": {
      "name": "第 82 旅",
      "backend": "https://script.google.com/macros/s/XXXXXX/exec",
      "apikey": "vs_xxxxxxxxxxxxxxxxxxxxxxxx"
    },
    "0123": {
      "name": "第 123 旅",
      "backend": "https://script.google.com/macros/s/YYYYYY/exec",
      "apikey": "vs_yyyyyyyyyyyyyyyyyyyyyyyy"
    }
  }
}
```

### scoutsystem — `lib/troops.ts`
```typescript
export const APPROVED_TROOPS: ApprovedTroop[] = [
  {
    key: 'troop_0082',
    id: '0082',
    name: '第82旅',
    webAppUrl: 'https://script.google.com/macros/s/XXXXXX/exec',
    // API Key → Vercel env: TROOP_0082_APIKEY
    status: 'active',
  },
];
```

### scoutsystem — Vercel 環境變數
```
Name:  TROOP_0082_APIKEY
Value: ak_xxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ API Key 永遠不出現在 `troops.ts` 或任何 Git 追蹤的檔案中，只存在 Vercel 環境變數。

---

## 在新 APP 加入申請表單

開發新的第3級元件時，必須在 APP 設定頁面加入申請表單：

1. 前往 **Scout Admin APP → 📜 Apps Script 分頁**
2. 複製「前端申請表單代碼」
3. 直接貼入 APP 設定頁面

**申請表單已預設連接到 Apps Script Web App，無需修改任何 URL。**

---

## Router 登記（只做一次）

在 `registry.json` 加入插件：

```json
{
  "id": "vs_badge_tracker",
  "title": "深資童軍進度追蹤 (Tier 3)",
  "icon": "🔥",
  "tier": 3,
  "path": "https://vsbadge.vercel.app/",
  "roles": ["member", "leader"],
  "needsTroopBackend": true,
  "description": "基於第11版訓練綱要的四級進度追蹤系統。支援獨立使用或接入主系統。"
}
```

**之後有 100 個旅團要用，Router 也不需要再改任何東西。** 旅團透過申請流程接入，管理員在 Scout Admin APP 處理即可。

---

## 主系統需要配合的

### iframe 渲染時帶入的參數

```
前端 URL（從 Router 取得）
  ?u={旅團編號}     ← 主系統帶入
  &role={用戶角色}  ← 主系統帶入
  &ymis={成員YMIS}  ← 主系統帶入
  &from=portal      ← 固定
  &embed=1          ← 嵌入模式
```

**注意：主系統不需要帶入 backend 和 apikey，前端會自動從 troops.json 查找。**

---

## 各級元件比較

| | 第 2 級 | 第 3 級 |
|--|--------|--------|
| 前端 | 插件開發者管理（一份共用） | 插件開發者管理（一份共用） |
| 後端 | 不需要 | 各旅團獨立部署 |
| 旅團接入方式 | 什麼都不做（啟用即用） | 填申請表單 → Scout Admin APP 審核 |
| 管理員工具 | 不需要 | Scout Admin APP |
| Router 登記 | 一次 | 一次 |
| 獨立使用 | ✅ 直接打開 | ✅ 選擇旅團 |
| 接入主系統 | ✅ Router 轉駁 | ✅ 主系統卡片 |
| 雙軌制 | 天然支援 | 需插件支援（`dualTrack: true`） |

---

## 安全性

### 三層保護

| 層級 | 保護對象 | 機制 |
|------|---------|------|
| Google Sheet 密碼 | 擋人 | 只有 Sheet 擁有者能登入修改 |
| API Key | 擋 AI/爬虫 | 沒有 Key 就不能用 Apps Script API |
| troops.json | 系統管理員管理 | 旅團無法修改，只有管理員能更新 |
| Vercel 環境變數 | 保護 API Key | Key 不進 Git，只存 Vercel，只有你能看 |

### API Key 特性

- **自動生成**：旅團執行 `initializeSheets()` 時自動產生
- **隨機字串**：格式為 `vs_` 或 `ak_` + 24 位隨機字元
- **儲存方式**：存在 Google Apps Script 的 PropertiesService
- **旅團責任**：複製 API Key 填入申請表單
- **管理員責任**：在 Scout Admin APP 標記完成後，貼入 Vercel 環境變數

---

## 元件開發者完整檢查清單

**後端（Apps Script）**
- [ ] `initializeSheets()` 自動建立所需工作表
- [ ] `getApiKey()` 自動生成並儲存 API Key
- [ ] `showApiKey()` 讓旅團可以查看自己的 API Key
- [ ] 所有 API 端點驗證 `apiKey` 參數
- [ ] `doGet` 支援 `action=health` 健康檢查

**前端**
- [ ] 有旅團選擇功能（沒有 `u` 參數時顯示）
- [ ] 從 `troops.json` 讀取旅團列表
- [ ] 根據 `u` 參數自動查找 `backend` + `apikey`
- [ ] 支援從 URL 參數讀取 `u`、`role`、`ymis`
- [ ] `embed=1` 時隱藏頂部標題列

**申請接入**
- [ ] APP 設定頁面嵌入申請表單（從 Scout Admin APP 複製）
- [ ] 申請表單已連接 Apps Script Web App

**文件**
- [ ] `HOW_TO_ADD_TROOP.md`（管理員操作）
- [ ] `DEPLOY_GUIDE_FOR_TROOPS.md`（旅團建後端教學）
- [ ] README 說明兩種使用方式

---

## 一句話總結

> Router 登記一次 = 全平台可用
> 旅團填申請表單 = 管理員收 Email
> Scout Admin APP = 一鍵產生 JSON/TS
> git push = 旅團立即能用
> 獨立用或接入主系統 = 旅團自己選
> Router 什麼都不用再做了

---

*此規範適用於所有第 3 級元件。*
*Scout Admin APP：https://scout-admin-blue.vercel.app/*
