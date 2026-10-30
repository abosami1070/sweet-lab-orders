// يتحقق أن ملفي الترجمة متطابقان في المفاتيح، وأن كل مفتاح ERR_* في قاعدة البيانات مترجم
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const load = (l) => JSON.parse(readFileSync(join(root, 'messages', `${l}.json`), 'utf8'));
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

const ar = new Set(flatten(load('ar')));
const en = new Set(flatten(load('en')));
const problems = [];
for (const k of ar) if (!en.has(k)) problems.push(`missing in en: ${k}`);
for (const k of en) if (!ar.has(k)) problems.push(`missing in ar: ${k}`);

const sqlDir = join(root, 'supabase', 'migrations');
const dbKeys = new Set(
  readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .flatMap((f) => readFileSync(join(sqlDir, f), 'utf8').match(/ERR_[A-Z_]+/g) ?? [])
);
for (const k of dbKeys) if (!ar.has(`errors.${k}`)) problems.push(`DB error not translated: ${k}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n OK — ${ar.size} keys in each locale, ${dbKeys.size} DB error codes translated`);
