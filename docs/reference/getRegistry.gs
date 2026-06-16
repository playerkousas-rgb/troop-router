/**
 * 参考实作：各单位 Apps Script 的「翻译官」端点
 * ===============================================================
 * 这是「框架契约 §2」的落地范例。每个单位（区/旅团）的 Apps Script 都放这段。
 * 职责：fetch 转驳器 registry → 解析第3级 url → tier 映射 → 标 installed → 回传前端。
 *
 * 前端 lib/api.ts 会呼叫：GET ?action=getRegistry&token=...
 * 回传形状必须符合 RegistryBundle（见 lib/types.ts）。
 */

// ── 本单位常量（每个单位部署时改这两个） ──────────────────
var UNIT_CODE  = 'SKW';                                  // 本单位码：区=字母码(如 SKW)，旅团=纯数字码(如 0082)
var REGISTRY_URL = 'https://scout-hub.vercel.app/api/registry';   // 转驳器端点

// 卡片表（已安装元件）名称，依你的 Sheet 实际命名
var CARDS_SHEET = 'Cards';

/** action=getRegistry 主入口 */
function handleGetRegistry(token) {
  // TODO: 这里照你现有方式验 token / 取得呼叫者；失败回 { ok:false, error:'...' }
  // var user = verifyToken_(token); if (!user) return resErr_('unauthorized');

  var reg = fetchRegistry_();
  if (!reg) return resErr_('无法读取转驳器 registry');

  var unit = findUnit_(reg, UNIT_CODE);            // 本单位在 units[] 的纪录（可能 null）
  var installedIds = getInstalledCardIds_();        // 本单位已安装的 cardId 集合

  var plugins = (reg.plugins || [])
    .filter(function (p) { return String(p.status || 'active') !== 'disabled'; })
    .map(function (p) { return resolvePlugin_(p, unit, installedIds); });

  return resOk_({ registryUrl: REGISTRY_URL, plugins: plugins });
}

/** 解析单一 plugin → 前端要的 PluginItem */
function resolvePlugin_(p, unit, installedIds) {
  var tier = (p.tier === 3) ? 3 : 2;
  var needsBackend = (tier === 3);

  // ★ 第3级：url 来自本单位 endpoints；第2级：用共用 url
  var url = '';
  var available = true;
  if (tier === 3) {
    url = (unit && unit.endpoints && unit.endpoints[p.id]) ? String(unit.endpoints[p.id]) : '';
    available = !!url;                 // 本单位没部署 → 不可安装
  } else {
    url = p.url || '';
    available = !!url;
  }

  return {
    id: p.id,
    title: p.title,
    icon: p.icon || '🧩',
    description: p.description || '',
    version: p.version || '',
    type: p.type || 'jump',
    embed: !!p.embed,
    url: url,                                  // 已解析
    needsDistrictBackend: needsBackend,       // tier → 布林（前端现读这个）
    installed: installedIds.indexOf(p.id) >= 0,
    // 向后兼容附带，前端可选用：
    tier: tier,
    available: available
  };
}

/** 安装护栏：installPlugin 前用，挡掉第3级未部署 */
function canInstall_(pluginItem) {
  if (pluginItem.tier === 3 && !pluginItem.url) {
    return { ok: false, error: '此第3级元件尚未为本单位部署后台，请先部署并登记 endpoint。' };
  }
  if (!pluginItem.url) return { ok: false, error: '元件网址为空，无法安装。' };
  return { ok: true };
}

// ── 工具函式 ───────────────────────────────────────────
function fetchRegistry_() {
  try {
    var res = UrlFetchApp.fetch(REGISTRY_URL + '?cb=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    return JSON.parse(res.getContentText());
  } catch (e) { return null; }
}

function findUnit_(reg, code) {
  var units = reg.units || [];
  for (var i = 0; i < units.length; i++) {
    if (String(units[i].id) === String(code)) return units[i];
  }
  return null;
}

function getInstalledCardIds_() {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(CARDS_SHEET);
    if (!sh) return [];
    var values = sh.getDataRange().getValues();      // 假设第一列是表头，含 cardId 栏
    var header = values.shift() || [];
    var idx = header.indexOf('cardId');
    if (idx < 0) return [];
    return values.map(function (r) { return String(r[idx]); }).filter(String);
  } catch (e) { return []; }
}

function resOk_(data)  { return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data })).setMimeType(ContentService.MimeType.JSON); }
function resErr_(msg)  { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON); }

/* ── 接到你的 doGet/doPost 路由范例 ──
function doGet(e) {
  var action = e.parameter.action;
  if (action === 'getRegistry') return handleGetRegistry(e.parameter.token);
  // ... 其余 action
}
*/
