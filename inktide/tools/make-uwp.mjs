// Stamp the team's UWP shell (PC + Xbox, .NET 9 Native AOT, WebView2) around www/.
//   node tools/make-uwp.mjs [--config uwp/game.json]
// Output: uwp/INKTIDE.sln + uwp/INKTIDE/ (shell files + a COPY of www — never a symlink: a POSIX
// symlink inside the project makes MSBuild throw "Illegal characters in path" on Windows).
// The .msixupload itself must be built on Windows: open uwp/INKTIDE.sln → Release|x64 → build,
// then run tools/Make-StoreUpload.ps1 from the kit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = '/root/.claude/skills/synced/2b84aaf1-a174-4de1-8b94-f154d5640988_1a80ab26-b4e7-4ddf-838f-a9f0a696a7e0/uwp-three-game/template';
const args = process.argv.slice(2);
const cfgPath = args.includes('--config') ? args[args.indexOf('--config') + 1] : path.join(root, 'uwp/game.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const shellSrc = fs.existsSync(path.join(root, 'uwp/shell-template')) ? path.join(root, 'uwp/shell-template') : path.join(KIT, 'shell');

const TOKENS = {
  __APP__: cfg.app, __APP_UPPER__: cfg.app.toUpperCase(), __HOST__: cfg.host, __IDENTITY__: cfg.identity,
  __PUBLISHER__: cfg.publisher, __PUBDISPLAY__: cfg.pubDisplay, __DESC__: cfg.description,
};
const TEXT = /\.(cs|xaml|csproj|appxmanifest|json|pubxml|md)$/i;
const stamp = (s) => Object.entries(TOKENS).reduce((a, [k, v]) => a.split(k).join(v), s);

function copyTree(src, dst, filter = () => true, stampText = false) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const st = fs.lstatSync(from);
    if (st.isSymbolicLink()) throw new Error(`refusing to copy symlink ${from}`);
    if (!filter(from)) continue;
    const to = path.join(dst, stampText ? stamp(name) : name);
    if (st.isDirectory()) copyTree(from, to, filter, stampText);
    else if (stampText && TEXT.test(name)) fs.writeFileSync(to, stamp(fs.readFileSync(from, 'utf8')));
    else fs.copyFileSync(from, to);
  }
}

const out = path.join(root, 'uwp');
const appDir = path.join(out, cfg.app);
// keep a copy of the shell template inside the repo so the build does not depend on the skill path
if (!fs.existsSync(path.join(out, 'shell-template'))) copyTree(path.join(KIT, 'shell'), path.join(out, 'shell-template'));
fs.rmSync(appDir, { recursive: true, force: true });
copyTree(shellSrc, appDir, () => true, true);
fs.renameSync(path.join(appDir, 'App.csproj'), path.join(appDir, `${cfg.app}.csproj`));
copyTree(path.join(root, 'www'), path.join(appDir, 'www'), (p) => !p.includes(`${path.sep}node_modules`));
// tile / icon set referenced by Package.appxmanifest (tools/make-icons.mjs writes uwp/assets/)
const icons = path.join(out, 'assets');
if (!fs.existsSync(path.join(icons, 'Square150x150Logo.png'))) throw new Error('uwp/assets/ is missing the tile set: run node tools/make-icons.mjs first');
copyTree(icons, path.join(appDir, 'Assets'));
const manifest = fs.readFileSync(path.join(appDir, 'Package.appxmanifest'), 'utf8');
const missing = [...manifest.matchAll(/Assets\\([A-Za-z0-9]+)\.png/g)].map((m) => m[1]).filter((n) => !fs.existsSync(path.join(appDir, 'Assets', n + '.png')));
if (missing.length) throw new Error('manifest references missing tiles: ' + missing.join(', '));

// solution file
let h = 0x811c9dc5;
for (const ch of cfg.app) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
const hex = (n) => (h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0, h.toString(16).padStart(8, '0').slice(0, n));
const G = `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(8)}${hex(4)}`.toUpperCase();
const plats = ['x86', 'x64', 'arm64'];
const cfgs = ['Debug', 'Release'];
fs.writeFileSync(path.join(out, `${cfg.app}.sln`), `Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.14.36623.8
MinimumVisualStudioVersion = 10.0.40219.1
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "${cfg.app}", "${cfg.app}\\${cfg.app}.csproj", "{${G}}"
EndProject
Global
\tGlobalSection(SolutionConfigurationPlatforms) = preSolution
${cfgs.flatMap((c) => plats.map((p) => `\t\t${c}|${p} = ${c}|${p}`)).join('\n')}
\tEndGlobalSection
\tGlobalSection(ProjectConfigurationPlatforms) = postSolution
${cfgs.flatMap((c) => plats.flatMap((p) => ['ActiveCfg', 'Build.0', 'Deploy.0'].map((k) => `\t\t{${G}}.${c}|${p}.${k} = ${c}|${p}`))).join('\n')}
\tEndGlobalSection
EndGlobal
`);

// hygiene: no symlinks anywhere, no Windows-illegal file names
const bad = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) bad.push('symlink: ' + p);
    if (/[<>:"|?*]/.test(n)) bad.push('illegal name: ' + p);
    if (st.isDirectory()) walk(p);
  }
})(out);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`UWP project written to ${path.relative(root, out)}/ (${cfg.app}.sln). Symlinks: 0.`);
console.log('Next (on Windows): create the signing certificate whose subject equals the Publisher, open the .sln, Release|x64, build, then run the kit\'s Make-StoreUpload.ps1.');
