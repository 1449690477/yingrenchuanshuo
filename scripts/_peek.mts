import { readFileSync } from 'node:fs';
const c = readFileSync('scripts/simulate.ts', 'utf8');
const i = c.indexOf('// G3：逐日');
console.log(c.slice(i - 1500, i));