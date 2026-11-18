// news-image-20261118 entry (Node 22, standard library only).
// The image is entry.png beside this file: a newspaper front page summing up
// Wednesday 18 November 2026's world news, rendered from news.html by render.mjs.
// This program copies it to the output directory. The copy is byte-for-byte
// and the file never changes at run time, so repeated runs write identical
// bytes (run_deterministic holds by construction: no timestamps, no randomness).
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
copyFileSync(
  new URL('./entry.png', import.meta.url),
  join(outDir, 'entry.png'),
);
