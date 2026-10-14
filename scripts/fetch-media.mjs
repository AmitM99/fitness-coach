/**
 * Downloads exercise media locally so the running app makes zero external
 * requests (coach-app-vision.md #1 — full privacy).
 *
 *   npm run data:media        thumbnails only  (~1,324 files, ~8 MB)
 *   npm run data:media:gifs   thumbnails + animations (~123 MB)
 *
 * Media © Gym visual (gymvisual.com), redistributed by the upstream dataset
 * with permission at reduced resolution. Personal use only.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'public', 'data', 'exercises.json');
const MEDIA = path.join(ROOT, 'public', 'exercise-media');
const BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

const wantGifs = process.argv.includes('--gifs');
const CONCURRENCY = 12;

if (!fs.existsSync(DATA)) {
  console.error('public/data/exercises.json missing — run `npm run data:build` first.');
  process.exit(1);
}

const exercises = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const jobs = [];
for (const e of exercises) {
  if (e.image) jobs.push(e.image);
  if (wantGifs && e.gif) jobs.push(e.gif);
}

fs.mkdirSync(path.join(MEDIA, 'images'), { recursive: true });
if (wantGifs) fs.mkdirSync(path.join(MEDIA, 'videos'), { recursive: true });

let done = 0;
let skipped = 0;
let failed = 0;

async function fetchOne(rel) {
  const dest = path.join(MEDIA, rel);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    skipped++;
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(BASE + rel);
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(dest, buf);
      done++;
      return;
    } catch (err) {
      if (attempt === 3) {
        failed++;
        console.warn(`  ! ${rel}: ${err.message}`);
      } else {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
}

console.log(`downloading ${jobs.length} files (${wantGifs ? 'thumbnails + gifs' : 'thumbnails'})…`);

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const rel = queue.pop();
      if (!rel) return;
      await fetchOne(rel);
      const n = done + skipped + failed;
      if (n % 200 === 0) console.log(`  ${n}/${jobs.length}`);
    }
  })
);

console.log(`done — ${done} downloaded, ${skipped} already present, ${failed} failed`);
if (failed) process.exitCode = 1;
