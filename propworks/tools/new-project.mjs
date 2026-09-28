#!/usr/bin/env node
/* =========================================================
   Scaffolds a new three.js + UWP (PC & Xbox) game project.

     node new-project.mjs --out ../MyGame --config game.json

   Every token in the template is replaced from the config, so the
   generated project builds and packages without further edits:

     app          "MyGame"                    display name + C# namespace
     host         "mygame.local"              WebView2 virtual host
     identity     "Publisher.MyGame"          Partner Center Package/Identity/Name
     publisher    "CN=<GUID>"                 Partner Center Package/Identity/Publisher
     pubDisplay   "My Studio"                 PublisherDisplayName
     description  "One line for the tile."

   identity / publisher / pubDisplay come from
   Partner Center > your app > Product management > Product identity.
   ========================================================= */
import { readFile, writeFile, mkdir, cp, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..');

/* ----------------------------------------------------- args */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const outDir = resolve(arg('out', ''));
const configPath = arg('config', '');

if (!arg('out', '') || !configPath) {
  console.error('kullanim: node new-project.mjs --out <klasor> --config <game.json>');
  process.exit(1);
}

const cfg = JSON.parse(await readFile(configPath, 'utf8'));
const REQUIRED = ['app', 'host', 'identity', 'publisher', 'pubDisplay', 'description'];
const missing = REQUIRED.filter((k) => !cfg[k]);
if (missing.length) {
  console.error('config eksik alan: ' + missing.join(', '));
  process.exit(1);
}
if (!/^CN=/.test(cfg.publisher)) {
  console.error('publisher "CN=" ile baslamali (Partner Center > Product identity)');
  process.exit(1);
}
if (!/^[A-Za-z][A-Za-z0-9]*$/.test(cfg.app)) {
  console.error('app yalnizca harf/rakam olmali — C# namespace ve assembly adi olarak kullaniliyor');
  process.exit(1);
}

/* ----------------------------------------------------- tokens */
const TOKENS = {
  Propworks: cfg.app,
  PROPWORKS: cfg.app.toUpperCase(),
  propworks.game: cfg.host,
  PLACEHOLDER.Propworks: cfg.identity,
  CN=00000000-0000-0000-0000-000000000000: cfg.publisher,
  PLACEHOLDER Publisher: cfg.pubDisplay,
  A story-driven physics sandbox: grab, weld, build and survive the Workshop.: cfg.description,
};
const TEXT = /\.(cs|xaml|csproj|appxmanifest|json|js|mjs|css|html|md|ps1|pubxml)$/i;

const stamp = (s) => {
  for (const [k, v] of Object.entries(TOKENS)) s = s.split(k).join(v);
  return s;
};

/* ----------------------------------------------------- copy */
async function walk(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const name of await readdir(src)) {
    if (name === 'node_modules' || name === '.git') continue;
    const from = join(src, name);
    const info = await stat(from);
    // shell/ is unpacked into the project root, not kept as a folder
    const to = join(dst, stamp(name));
    if (info.isDirectory()) { await walk(from, to); continue; }
    if (TEXT.test(name)) await writeFile(to, stamp(await readFile(from, 'utf8')));
    else await cp(from, to);
  }
}

if (existsSync(outDir)) {
  console.error(`hedef zaten var: ${outDir}`);
  process.exit(1);
}

console.log(`sablon  : ${TEMPLATE}`);
console.log(`hedef   : ${outDir}\n`);

const appDir = join(outDir, cfg.app);

// www + shell land inside the app folder; tools/test stay at the root
await walk(join(TEMPLATE, 'www'), join(appDir, 'www'));
await walk(join(TEMPLATE, 'shell'), appDir);
await walk(join(TEMPLATE, 'tools'), join(outDir, 'tools'));
await walk(join(TEMPLATE, 'test'), join(outDir, 'test'));

// App.csproj -> <App>.csproj
const { rename } = await import('fs/promises');
await rename(join(appDir, 'App.csproj'), join(appDir, `${cfg.app}.csproj`));

/* ----------------------------------------------------- solution */
const guid = (seed) => {
  // Deterministic GUID from the app name so re-scaffolding is stable.
  let h = 0x811c9dc5;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const hex = (n) => (h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0, h.toString(16).padStart(8, '0').slice(0, n));
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(8)}${hex(4)}`.toUpperCase();
};
const PG = guid(cfg.app);
const plats = ['x86', 'x64', 'arm64'];
const cfgLines = [];
for (const c of ['Debug', 'Release']) {
  for (const p of plats) {
    cfgLines.push(`\t\t{${PG}}.${c}|${p}.ActiveCfg = ${c}|${p}`);
    cfgLines.push(`\t\t{${PG}}.${c}|${p}.Build.0 = ${c}|${p}`);
    cfgLines.push(`\t\t{${PG}}.${c}|${p}.Deploy.0 = ${c}|${p}`);
  }
}
await writeFile(join(outDir, `${cfg.app}.sln`), `
Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.14.36623.8
MinimumVisualStudioVersion = 10.0.40219.1
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "${cfg.app}", "${cfg.app}\\${cfg.app}.csproj", "{${PG}}"
EndProject
Global
\tGlobalSection(SolutionConfigurationPlatforms) = preSolution
${['Debug', 'Release'].flatMap((c) => plats.map((p) => `\t\t${c}|${p} = ${c}|${p}`)).join('\n')}
\tEndGlobalSection
\tGlobalSection(ProjectConfigurationPlatforms) = postSolution
${cfgLines.join('\n')}
\tEndGlobalSection
\tGlobalSection(SolutionProperties) = preSolution
\t\tHideSolutionNode = FALSE
\tEndGlobalSection
EndGlobal
`.trimStart());

/* ----------------------------------------------------- package.json */
await writeFile(join(outDir, 'package.json'), JSON.stringify({
  name: cfg.app.toLowerCase(),
  private: true,
  type: 'module',
  scripts: {
    serve: 'node tools/serve.mjs',
    icons: 'node tools/make-icons.mjs',
    bundle: 'node tools/build-single.mjs',
    covers: 'node tools/make-covers.mjs',
    shots: 'node tools/make-screenshots.mjs',
    storeart: 'node tools/make-store-art.mjs',
    test: 'node test/keyboard.mjs && node test/tv.mjs && node test/layout.mjs',
  },
  devDependencies: { esbuild: '^0.24.0', playwright: '^1.48.0' },
}, null, 2) + '\n');

await writeFile(join(outDir, '.gitignore'),
  ['bin/', 'obj/', 'AppPackages/', 'BundleArtifacts/', 'node_modules/', '.vs/',
   '*.user', 'dist/'].join('\n') + '\n');

/* ----------------------------------------------------- report */
console.log('olusturuldu:');
for (const f of [`${cfg.app}.sln`, `${cfg.app}/${cfg.app}.csproj`,
                 `${cfg.app}/Package.appxmanifest`, `${cfg.app}/www/src/main.js`,
                 'tools/', 'test/', 'package.json']) {
  console.log('  ' + f);
}
console.log(`
SIRADAKI ADIMLAR
  1. Imzalama sertifikasi uret — subject Publisher ile BIREBIR ayni olmali:

     $c = New-SelfSignedCertificate -Type Custom -Subject "${cfg.publisher}" \`
          -KeyUsage DigitalSignature -CertStoreLocation "Cert:\\CurrentUser\\My" \`
          -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}")
     Export-PfxCertificate -Cert "Cert:\\CurrentUser\\My\\$($c.Thumbprint)" \`
          -FilePath "${cfg.app}\\${cfg.app}_TemporaryKey.pfx" \`
          -Password (ConvertTo-SecureString "pw" -Force -AsPlainText)

  2. npm install
  3. npm run icons        # 75 dosyalik ikon setini uret (once yer tutucu)
  4. npm run serve        # tarayicida gelistir
  5. ${cfg.app}.sln'i ac, Release|x64 derle
  6. .\\tools\\Make-StoreUpload.ps1     # paketi uretir VE dogrular
`);
