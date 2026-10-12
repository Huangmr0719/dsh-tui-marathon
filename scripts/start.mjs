#!/usr/bin/env node
import { mkdir, writeFile, symlink, lstat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, join, dirname, delimiter } from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

// Real Harness backend, isolated local profile; never reads personal settings.
const pluginDir = fileURLToPath(new URL('..', import.meta.url))
const hostDir = resolve(process.env.MLS_TUI_HOST ?? join(pluginDir, '../dsh-TUI'))
const runtimeDir = join(pluginDir, '.runtime')
const cliDir = join(runtimeDir, 'cli')
if (!existsSync(join(hostDir, 'lib/types/index.js')) || !existsSync(join(pluginDir, 'dist/index.js'))) {
  throw new Error('Build dsh-TUI and this plugin first. See README.zh-CN.md.')
}
const requireCli = createRequire(join(cliDir, 'package.json'))
let entry
try { entry = join(dirname(requireCli.resolve('@deepseek-ai/dsh/package.json')), 'lib/bin.js') } catch {
  throw new Error('Local Harness CLI is missing. Run npm run setup:local first.')
}
const home = join(runtimeDir, 'user')
const dshHome = join(runtimeDir, 'dsh')
const profileDir = join(dshHome, 'profiles/mls-local')
await mkdir(home, { recursive: true })
await mkdir(profileDir, { recursive: true })
await writeFile(join(profileDir, 'package.json'), JSON.stringify({
  name: 'dsh-profile-mls-local', private: true, type: 'module',
  dependencies: { '@deepseek-harness-tui/dsh-tui': `link:${hostDir}`, 'dsh-theme-mls-tui': `link:${pluginDir}` },
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-harness-tui/dsh-tui', 'dsh-theme-mls-tui'] } },
}, null, 2) + '\n')
for (const [name, target] of [['@deepseek-harness-tui/dsh-tui', hostDir], ['dsh-theme-mls-tui', pluginDir]]) {
  const link = join(profileDir, 'node_modules', name)
  await mkdir(dirname(link), { recursive: true })
  try { await lstat(link) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await symlink(target, link, 'dir')
  }
}
const args = process.argv.slice(2)
await writeFile(join(profileDir, 'cordis.patch.yml'), JSON.stringify([
  // Launch-generated profile files use explicit restarts for local changes.
  { id: 'hmr', disabled: true },
  { id: 'dsh-tui', config: { fullscreen: !args.includes('--inline') } },
  { id: 'theme-mls-tui', config: {
    motion: process.env.MLS_MOTION ?? 'full', graphics: process.env.MLS_GRAPHICS ?? 'cells',
    cellAspect: Number(process.env.MLS_CELL_ASPECT ?? 0), nativeWhale: process.env.MLS_NATIVE_WHALE === '1',
  } },
], null, 2) + '\n')
// Use Harness's supported profile launcher, with the installed TUI as a bundle.
const forwarded = args.filter(arg => arg !== '--inline')
const child = spawn(process.execPath, [entry, '--profile', 'mls-local', ...(forwarded.length ? ['--', '--', ...forwarded] : [])], {
  stdio: 'inherit', env: { ...process.env,
    PATH: join(cliDir, 'node_modules/.bin') + delimiter + process.env.PATH,
    HOME: home, USERPROFILE: home, DSH_HOME: dshHome,
    NODE_ENV: 'production', DSH_TUI_PROFILE: 'mls-local', DSH_TUI_BACKEND: 'dsh',
    DSH_TUI_THEME: process.env.DSH_TUI_THEME ?? 'mls:terminal',
    DSH_TUI_LANG: process.env.DSH_TUI_LANG ?? 'zh',
    DSH_TUI_SESSION_ROOT: join(runtimeDir, 'sessions'),
  },
})
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGHUP', () => child.kill('SIGHUP'))
process.on('SIGINT', () => {}) // The terminal process group delivers Ctrl+C.
child.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1) })
