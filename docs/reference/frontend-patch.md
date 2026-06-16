# 主系统前端 对齐补丁（建议，非必须）

> 现况：前端靠 Apps Script 回的 `needsDistrictBackend` 即可运作。
> 以下两个小补丁让框架对第3级「未部署」情况更稳，并原生认识 tier。改动很小、向后兼容。
> 你说主系统可自行改，这里给精确位置与差异，方便你或 Codex 直接套。

---

## 补丁 1：types.ts 增加 tier / available（向后兼容）

`lib/types.ts` 的 `PluginItem` 增两个可选栏位：

```ts
export interface PluginItem {
  id: string;
  title: string;
  icon: string;
  url: string;
  description: string;
  version: string;
  embed: boolean;
  type: CardType;
  installed: boolean;
  needsDistrictBackend?: boolean;
  tier?: 2 | 3;          // ＋ 新增：来自转驳器
  available?: boolean;   // ＋ 新增：第3级且本单位无 endpoint → false
}
```

> 都是可选，旧后台没回也不会坏。

---

## 补丁 2：plugins/page.tsx 对「未部署的第3级」禁安装

在卡片渲染区，安装按钮前加判断（`available === false` 时显示提示、禁按）：

```tsx
{/* 在 version/embed 标签那一行下方、安装按钮处 */}
{p.tier === 3 && p.available === false ? (
  <span className="ver" style={{ background:'#fff3e0', color:'#e65100', marginLeft:'auto' }}>
    需先为本区部署后台
  </span>
) : p.installed ? (
  <button className="mini-btn danger" disabled={busy === p.id}
    onClick={() => uninstall(p)} style={{ marginLeft: 'auto' }}>
    {busy === p.id ? '处理中…' : '解除安装'}
  </button>
) : (
  <button className="mini-btn" disabled={busy === p.id || (p.tier===3 && p.available===false)}
    onClick={() => install(p)} style={{ marginLeft: 'auto' }}>
    {busy === p.id ? '安装中…' : '➕ 安装'}
  </button>
)}
```

---

## 补丁 3：CardItem.tsx / embed/page.tsx 防空 url（双保险）

理论上 Apps Script 护栏已挡住空 url 入卡片表，但前端再加一层不亏。

`components/CardItem.tsx` 的 `handleClick` 开头：

```ts
function handleClick() {
  if (!card.url && card.type !== 'builtin') {
    alert('此元件尚未设定网址（可能第3级未部署）。');
    return;
  }
  // ...原逻辑
}
```

`app/embed/page.tsx` 的 `buildTarget()` 开头：

```ts
function buildTarget(): string {
  if (!card || !session || !card.url) return '';
  // ...原逻辑
}
```
并在 render 时，`!target` 显示「此元件未设定网址」错误，而非空白 iframe。

---

## 补丁 4：单位参数名统一用 u（区+旅团都改）

区与旅团**用同一个参数名 `u`**，值不同即可分辨（区=字母码、旅团=纯数字码）：
- `lib/district.ts`：`resolveDistrictCode()` 读 `params.get('u')`；`withDistrictParam()` set `'u'`。
- `CardItem` / `embed` 的 `buildExternalUrl` / `buildTarget` set `'u'`。

> 不变量：单位码区=字母、旅团=数字、全域唯一；插件靠「`u` 是否纯数字」分辨区/旅团，不需 scope 参数（框架契约 §8）。

---

## 套用顺序建议

1. 先套 Apps Script `getRegistry.gs`（这层最关键，第3级靠它）。
2. 再套补丁 1+2（前端认 available，体验更好）。
3. 补丁 3 双保险随手加。
4. 区+旅团前端套补丁 4（统一参数名 `u`）。
5. 端到端测一个第3级元件（DBS）跑通。
