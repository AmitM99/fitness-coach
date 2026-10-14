/**
 * Removes the bundled exercise media from a build.
 *
 * The images and GIFs are © Gym visual and redistributed upstream by
 * permission — that permission does not obviously extend to us re-publishing
 * 177 MB of them on a public host. This produces a ~5 MB deployable build for
 * cases where the media should stay on the local machine, or be loaded from
 * the upstream dataset via VITE_MEDIA_BASE.
 */
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2] ?? 'dist';
const dir = path.resolve(import.meta.dirname, '..', target, 'exercise-media');

if (!fs.existsSync(dir)) {
  console.log(`no media in ${target}/ — nothing to strip`);
  process.exit(0);
}

const before = fs.readdirSync(path.join(dir, 'images')).length
  + (fs.existsSync(path.join(dir, 'videos')) ? fs.readdirSync(path.join(dir, 'videos')).length : 0);

fs.rmSync(dir, { recursive: true, force: true });
console.log(`stripped ${before} media files from ${target}/`);
