import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
const root = fileURLToPath(new URL('../.runtime/cli/', import.meta.url))
await mkdir(root, { recursive: true })
await writeFile(join(root, 'package.json'), JSON.stringify({
  name: 'mls-local-host', private: true, type: 'module', packageManager: 'pnpm@11.21.0',
  dependencies: { '@deepseek-ai/dsh': '0.2.0-rc.2' },
}, null, 2) + '\n')
const child = spawn('pnpm', ['install', '--ignore-scripts'], { cwd: root, stdio: 'inherit' })
child.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
