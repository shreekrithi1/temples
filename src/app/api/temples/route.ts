import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

// Read the current local catalog, so a completed import appears without rebuilding.
// The large research archives and API credentials are never included in this response.
export async function GET() {
  const [catalog, metadata] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/data/temples.json'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/data/catalog-meta.json'), 'utf8'),
  ]);
  return new Response(`{"success":true,"data":${catalog},"metadata":${metadata}}`, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
