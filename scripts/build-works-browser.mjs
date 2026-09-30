// docs/assets/js/works.js を src/works-core.ts から生成する。
//
// tsc は classic script を直接出力できないため、ESM 出力 (import 文なし、
// `export ` 接頭辞のみ) を classic script に整形する。変換は機械的であり、
// 下記のアサーションで出力形状を保証する。想定外の形状になった場合は
// 大きな声で失敗する (静かに壊れた成果物を作らない)。
import { readFileSync, writeFileSync } from "node:fs";

const INPUT = new URL("../dist/browser/works-core.js", import.meta.url);
const OUTPUT = new URL("../docs/assets/js/works.js", import.meta.url);

function fail(message) {
  console.error(`build-works-browser: ${message}`);
  process.exit(1);
}

const compiled = readFileSync(INPUT, "utf8");

// 実行時 import が混入していたら classic script 化できないので失敗させる。
// (import type は tsc が消去済みのため、ここに現れるのはバグ)
for (const line of compiled.split("\n")) {
  if (/^import\b/.test(line)) {
    fail(`unexpected runtime import: ${line}`);
  }
}

let body = compiled.replace(/^export /gm, "");

for (const line of body.split("\n")) {
  if (/^(import|export)\b/.test(line)) {
    fail(`unexpected module syntax after transform: ${line}`);
  }
}

const matches = body.match(/^const WORKS =/gm) ?? [];
if (matches.length !== 1) {
  fail(`expected exactly one "const WORKS =", found ${matches.length}`);
}
body = body.replace(/^const WORKS =/m, "var WORKS =");

const header = `// このファイルは生成物です。直接編集しないでください。
// ソース: src/works-core.ts (\`npm run build:browser\` で再生成)。
`;
writeFileSync(OUTPUT, `${header}${body}`);
console.log("build-works-browser: docs/assets/js/works.js を生成しました");
