#!/usr/bin/env node
/**
 * 驗證 registry.json（schema 3 / 接法B）— 維護完跑：npm run validate
 *
 * 規則：
 *  - JSON 可解析、plugins 必填欄位、id 唯一、tier 只能 2/3。
 *  - 第2級(tier2)：共用系統，plugins.url 必填（一條共用網址），needsUnitBackend=false。
 *  - 第3級(tier3)：各單位自部署（接法B），plugins.url 可留空；
 *                 真正網址放在 units[].endpoints[pluginId]，needsUnitBackend=true。
 *  - units：單位 id 唯一、installs 對得上 plugins；
 *           凡 installs 含某個第3級插件，就必須在該單位 endpoints 填它的 URL（http/https）。
 *
 * 目的：避免改壞清單導致各單位讀不到，或第3級漏填單位自己的後台網址。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'public', 'api', 'registry.json');
const REQUIRED = ['id', 'title', 'tier'];
const VALID_STATUS = ['active', 'disabled'];
const VALID_TYPE = ['jump', 'builtin', 'resource'];
const VALID_TIER = [2, 3];

let errors = [];
let warnings = [];

let raw;
try {
  raw = fs.readFileSync(FILE, 'utf8');
} catch (e) {
  console.error('❌ 找不到 registry.json：' + FILE);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('❌ JSON 格式錯誤，無法解析：' + e.message);
  process.exit(1);
}

if (!Array.isArray(data.plugins)) {
  console.error('❌ 缺少 plugins 陣列。');
  process.exit(1);
}

const ULABEL = data.unitLabel || '單位';
const ids = new Set();
const tierOf = {};

data.plugins.forEach((p, i) => {
  const tag = `plugins[${i}] (${p.id || '無 id'})`;
  REQUIRED.forEach((k) => {
    if (p[k] === undefined || p[k] === null || String(p[k]).trim() === '')
      errors.push(`${tag}: 缺少必填欄位「${k}」`);
  });
  if (p.id) {
    if (ids.has(p.id)) errors.push(`${tag}: id 重複「${p.id}」`);
    ids.add(p.id);
    tierOf[p.id] = p.tier;
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(p.id)) warnings.push(`${tag}: id 建議只用英數與 - _`);
  }

  // 分級檢查
  if (p.tier !== undefined && !VALID_TIER.includes(p.tier))
    errors.push(`${tag}: tier「${p.tier}」非法，只能是 2（即插即用）或 3（需單位自設後台）`);

  // tier 與 needsUnitBackend 一致性
  const shouldNeedBackend = p.tier === 3;
  if (p.needsUnitBackend === undefined) {
    warnings.push(`${tag}: 建議補上 needsUnitBackend（tier2=false / tier3=true）`);
  } else if (typeof p.needsUnitBackend !== 'boolean') {
    warnings.push(`${tag}: needsUnitBackend 應為 true/false`);
  } else if (p.needsUnitBackend !== shouldNeedBackend) {
    errors.push(`${tag}: tier ${p.tier} 與 needsUnitBackend=${p.needsUnitBackend} 不一致（tier2 應為 false、tier3 應為 true）`);
  }

  // url 規則：第2級必填共用URL；第3級可留空（網址在 units.endpoints）
  if (p.tier === 2) {
    if (!p.url || String(p.url).trim() === '')
      errors.push(`${tag}: 第2級為共用系統，url（共用網址）必填`);
    else if (!/^https?:\/\//i.test(p.url))
      errors.push(`${tag}: url 需以 http(s):// 開頭`);
  } else if (p.tier === 3) {
    if (p.url && String(p.url).trim() !== '' && !/^https?:\/\//i.test(p.url))
      warnings.push(`${tag}: 第3級 url 通常留空（網址放各單位 endpoints）；若要放說明頁請用 http(s)://`);
  }

  if (p.status && !VALID_STATUS.includes(p.status)) warnings.push(`${tag}: status「${p.status}」非 active/disabled`);
  if (p.type && !VALID_TYPE.includes(p.type)) warnings.push(`${tag}: type「${p.type}」非 jump/builtin/resource`);
  if (p.embed !== undefined && typeof p.embed !== 'boolean') warnings.push(`${tag}: embed 應為 true/false`);
});

// 接入名單 units 檢查
let uCount = 0;
if (data.units !== undefined) {
  if (!Array.isArray(data.units)) {
    errors.push('units 應為陣列');
  } else {
    uCount = data.units.length;
    const uIds = new Set();
    data.units.forEach((u, i) => {
      const tag = `units[${i}] (${u.id || '無 id'})`;
      if (!u.id) errors.push(`${tag}: 缺少 id`);
      else {
        if (uIds.has(u.id)) errors.push(`${tag}: ${ULABEL} id 重複「${u.id}」`);
        uIds.add(u.id);
      }
      const installs = Array.isArray(u.installs) ? u.installs : [];
      if (!Array.isArray(u.installs))
        warnings.push(`${tag}: 建議補上 installs 陣列（已接入哪些插件 id）`);
      const eps = (u.endpoints && typeof u.endpoints === 'object') ? u.endpoints : {};

      installs.forEach((pid) => {
        if (!ids.has(pid)) {
          errors.push(`${tag}: installs 內的「${pid}」在 plugins 找不到`);
          return;
        }
        // 第3級插件 → 必須有該單位自己的 endpoint URL
        if (tierOf[pid] === 3) {
          const ep = eps[pid];
          if (!ep || String(ep).trim() === '')
            errors.push(`${tag}: 接入了第3級插件「${pid}」，必須在 endpoints.${pid} 填該${ULABEL}自己的網址`);
          else if (!/^https?:\/\//i.test(ep))
            errors.push(`${tag}: endpoints.${pid} 需以 http(s):// 開頭`);
        }
      });

      // endpoints 多出來、但沒在 installs 的，提醒
      Object.keys(eps).forEach((pid) => {
        if (!installs.includes(pid))
          warnings.push(`${tag}: endpoints 有「${pid}」但 installs 沒列出，請確認`);
        if (tierOf[pid] === 2)
          warnings.push(`${tag}: 「${pid}」是第2級共用系統，不需在 endpoints 設網址`);
      });
    });
  }
}

const t2 = data.plugins.filter((p) => p.tier === 2).length;
const t3 = data.plugins.filter((p) => p.tier === 3).length;
console.log(`\n📋 共 ${data.plugins.length} 個外掛（第2級 ${t2} 個、第3級 ${t3} 個）、${uCount} 個${ULABEL}接入，schema=${data.schema}，updated=${data.updated}`);
if (warnings.length) {
  console.log('\n⚠️  警告：');
  warnings.forEach((w) => console.log('   - ' + w));
}
if (errors.length) {
  console.log('\n❌ 錯誤：');
  errors.forEach((e) => console.log('   - ' + e));
  console.log('\n驗證未通過，請修正後再部署。\n');
  process.exit(1);
}
console.log('\n✅ 驗證通過，可以部署。\n');
