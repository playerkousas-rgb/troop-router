# 旅團轉駁中心 (Troop Hub) 維護手冊

## 一、檔案結構
- `public/api/registry.json`: 你唯一要維護的外掛清單。
- `vercel.json`: 已處理 CORS 與 `/api/registry` 乾淨路徑。

## 二、更新流程
1. 修改 `public/api/registry.json`。
2. 執行 `npm run validate` 檢查。
3. Git Push，Vercel 自動更新。

## 三、API 端點
`https://你的專案.vercel.app/api/registry`
