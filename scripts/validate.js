const fs = require('fs');
const path = require('path');

try {
  const registryPath = path.join(__dirname, '../public/api/registry.json');
  const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  
  if (!data.plugins || !Array.isArray(data.plugins)) throw new Error('缺少 plugins 陣列');
  
  data.plugins.forEach((p, i) => {
    if (!p.id || !p.title || !p.url) throw new Error(`索引 ${i} 的外掛缺少必要欄位 (id, title, url)`);
  });

  console.log('✅ 驗證通過！registry.json 格式正確。');
} catch (err) {
  console.error('❌ 驗證失敗：', err.message);
  process.exit(1);
}
