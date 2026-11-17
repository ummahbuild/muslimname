import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const renderer = Object.keys(manifest).find(key => key.includes('html2canvas'));
const detail = Object.keys(manifest).find(key => key.endsWith('/NameDetail.tsx'));
assert.ok(renderer && manifest[renderer].isDynamicEntry, 'Keep the image renderer behind an explicit dynamic import');
assert.ok(detail, 'Retain the name-detail route');
for (const [entry, maxRaw, maxGzip] of [['index.html', 1750000, 475000], [detail, 1800000, 500000]]) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    for (const child of manifest[key].imports ?? []) visit(child);
  }
  visit(entry);
  assert.ok(!seen.has(renderer), `${entry} must not eagerly fetch the image renderer`);
  const files = [...seen].map(key => manifest[key].file).filter(file => file.endsWith('.js'));
  let rawBytes = 0, gzipBytes = 0;
  for (const file of files) {
    const bytes = readFileSync('dist/' + file);
    rawBytes += bytes.length; gzipBytes += gzipSync(bytes).length;
  }
  assert.ok(rawBytes <= maxRaw && gzipBytes <= maxGzip, `Review ${entry} static JS budget`);
  console.log(JSON.stringify({ entry, files, rawBytes, gzipBytes, rendererDeferred: true }));
}
