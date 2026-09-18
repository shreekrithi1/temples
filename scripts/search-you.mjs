/** Optional repeatable source discovery. Keys remain server-side and never enter research output. */
import { writeFile, mkdir } from 'node:fs/promises';
const key = process.env.YOU_API_KEY;
if (!key) {
  console.error('Set YOU_API_KEY in .env.local and run npm run data:search.');
  process.exit(1);
}
const query = process.argv.slice(2).join(' ') || 'Hindu temples worldwide India temple list Wikipedia';
const response = await fetch('https://ydc-index.io/v1/search', {
  method: 'POST',
  headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, count: 20 }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`You.com search failed: HTTP ${response.status}`);
const result = await response.json();
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/you-search-results.json', import.meta.url), JSON.stringify({
  searchedAt: new Date().toISOString(), provider: 'You.com', query,
  results: (result.results?.web || []).map(({ title, url, description, thumbnail_url }) => ({ title, url, description, thumbnail_url })),
}, null, 2) + '\n');
console.log(`Stored ${(result.results?.web || []).length} You.com source references locally.`);
