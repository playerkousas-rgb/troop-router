# ScoutSystem 旅團轉駁器 (Troop Router)

旅團系統的「中央市集 / 轉駁中心」。與區轉駁器同等 level、同一套 schema (v3)。

## 分級（接法B）
- **第 2 級｜即插即用**：`tier:2`、`needsUnitBackend:false`。你部署一份共用系統，所有旅團啟用即用，不佔旅團額度，網址放 `plugins.url`。
- **第 3 級｜需單位自設後台**：`tier:3`、`needsUnitBackend:true`。每個旅團各自部署一份（接法B），網址登記在 `units.endpoints[插件id]`，額度算各旅團頭上，不佔你額度。

## 維護速記
- 加第2級插件：`plugins` 加一段（帶共用 url）→ validate → push。
- 加第3級插件：`plugins` 先登記（url 留空）→ validate → push；等某旅團自部署後，把它的網址加進 `units.endpoints`。
- 詳見 `MAINTAINER.md`；維護面板（public/index.html）內也有簡化版指引。

## 部署
1. 上傳到 GitHub Repo。
2. 部署至 Vercel（Framework 選 Other）。
3. 對外端點 `https://<專案>.vercel.app/api/registry`，填入各旅團 Portal 的 `REGISTRY_URL`。

## 開發
`npm run validate` 驗證 registry.json（含第3級 endpoint 是否齊全）。
