import {readdir, readFile, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

for (const name of await readdir('dist')) {
  if (name.endsWith('.js')) execFileSync(process.execPath, ['--check', `dist/${name}`], {stdio: 'inherit'});
}
const html = await readFile('dist/index.html', 'utf8');
for (const [, path] of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) await access(`dist/${path}`);
console.log('JavaScript syntax and HTML asset references checked.');
