import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { cellFrame } from '../dist/cells.js'
import { whaleContours } from '../dist/artwork.js'
import { whaleBounds, terminalWhaleBounds } from './artwork-helpers.mjs'

const xs = whaleContours.flatMap(points => points.filter((_, i) => i % 2 === 0))
const ys = whaleContours.flatMap(points => points.filter((_, i) => i % 2 === 1))
const sourceRatio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys))

test('rendered whale keeps the source proportion across physical cell ratios and viewport shapes', () => {
  for (const aspect of [1.5, 2, 2.4, 3]) {
    for (const [columns, rows] of [[120, 36], [180, 36], [100, 54]]) {
      const frame = cellFrame(0, columns, rows, false, { aspect })
      const bounds = whaleBounds(frame.lines, aspect)
      assert.ok(Math.abs(bounds.ratio / sourceRatio - 1) < .12, `aspect=${aspect}, ${columns}×${rows}: rendered ratio ${bounds.ratio}, source ${sourceRatio}`)
    }
  }
})

test('stock scene consumes measured geometry, follows the host clock and never celebrates a result', async () => {
  process.env.HOME = await mkdtemp(join(tmpdir(), 'mls-adaptation-'))
  process.env.USERPROFILE = process.env.HOME
  process.env.NODE_ENV = 'production'
  process.env.DSH_TUI_ADAPTER_MODE = 'new'
  process.env.FORCE_COLOR = '3'
  const { activate, makeTerminal, hostImport, until, sleep } = await import('../scripts/harness.mjs')
  const { PageMargin } = await hostImport('components/PageMargin.js')
  const runtime = await activate({ autoBoot: true, completion: true, graphics: 'auto' }) // A saved option must not re-enable completion.
  const { React, ui, channel, scenes } = runtime
  channel.pageMargin = 'normal'
  const { stdout, stdin, term, screen } = await makeTerminal(120, 36)
  let pixels = { width: 10, height: 15 }
  const requests = []
  const measuredUi = { ...ui,
    useAnimationFrame(interval) { requests.push(interval); return ui.useAnimationFrame(interval) },
    useTerminalImageCellSize() { ui.useTerminalImageCellSize(); return pixels },
  }
  const descriptor = scenes.list().find(scene => scene.id === 'mls-boot')
  const h = React.createElement
  const Scene = () => h(descriptor.component, { React, ui: measuredUi, channel, close: channel.closePluginScene })
  const app = await ui.render(h(ui.ThemeProvider, { theme: 'mls:terminal', themeHost: runtime.themes }, h(ui.AlternateScreen, null, h(PageMargin, null, h(Scene)))), { stdout, stdin, stderr: stdout, patchConsole: false, exitOnCtrlC: false })
  try {
    await until(() => screen().includes('INTO THE UNKNOWN'))
    assert.equal(channel.whale, false, 'unthemeable blue decoration is hidden through the public preference')
    assert.ok(Math.abs(terminalWhaleBounds(term, 1.5).ratio / sourceRatio - 1) < .12, 'unsupported image protocols retain a proportionate native logo')
    assert.ok(requests.some(interval => interval !== null && interval <= 16), 'native geometry advances with the host frame clock')
    stdin.write(' ')
    await sleep(100)
    const before = screen()
    pixels = { width: 10, height: 30 }
    channel.publish()
    await until(() => screen() !== before)
    assert.ok(Math.abs(terminalWhaleBounds(term, 3).ratio / sourceRatio - 1) < .12, 'measured metrics update the actual scene while paused')
    assert.equal(scenes.list().some(scene => scene.id === 'mls-complete'), false, 'no completion scene is registered')
    scenes.close()
    channel.complete()
    await sleep(100)
    assert.equal(channel.pluginScene, undefined, 'successful results leave the conversation visible')
    await runtime.fiber.dispose()
    assert.equal(channel.whale, true, 'unloading restores the previous decoration setting')
  } finally { app.unmount(); runtime.unsub(); await runtime.root.fiber.dispose(); term.dispose() }
})

test('native host header resolves both plugin palettes into Acid Rain rather than falling back to blue', async () => {
  const { activate, makeTerminal, hostImport, until } = await import('../scripts/harness.mjs')
  const { LogoV2 } = await hostImport('components/LogoV2.js')
  for (const theme of ['mls:terminal', 'mls:terminal-256']) {
  const runtime = await activate({ autoBoot: false, motion: 'off' })
  const { React, ui } = runtime
  const { stdout, stdin, term, screen } = await makeTerminal(120, 36)
  const h = React.createElement
  const app = await ui.render(h(ui.ThemeProvider, { theme, themeHost: runtime.themes }, h(LogoV2, {
    whale: false, whaleIdle: false, skipIntro: true, fontId: 'bold', drift: null, egg: null, starChance: 0,
  })), { stdout, stdin, stderr: stdout, patchConsole: false, exitOnCtrlC: false })
  try {
    await until(() => screen().includes('dsh-TUI'))
    const cells = Array.from({ length: term.rows }, (_, y) => Array.from({ length: term.cols }, (_, x) => term.buffer.active.getLine(term.buffer.active.baseY + y)?.getCell(x))).flat()
    assert.ok(cells.some(cell => cell?.getChars() === 'd' && cell.isFgRGB() && cell.getFgColor() === 0xd7ff00), 'native wordmark is Acid Rain')
    assert.ok(cells.filter(cell => cell?.getChars() === '█' && cell.isFgRGB() && (cell.getFgColor() & 255) < 80).length > 25, 'native big lettering uses the yellow gradient')
  } finally { app.unmount(); runtime.unsub(); await runtime.root.fiber.dispose(); term.dispose() }
  }
})

test('reduced startup closes automatically and retaining the stock whale is optional', async () => {
  const { activate, makeTerminal, until } = await import('../scripts/harness.mjs')
  const runtime = await activate({ motion: 'reduced', nativeWhale: true })
  const { React, ui, channel, scenes } = runtime
  const { stdout, stdin, term, screen } = await makeTerminal(80, 24)
  const h = React.createElement
  function Scene() {
    React.useSyncExternalStore(channel.subscribe, () => channel.version)
    const descriptor = scenes.list().find(scene => scene.id === channel.pluginScene?.id)
    return descriptor ? h(descriptor.component, { React, ui, channel, close: channel.closePluginScene }) : h(ui.Text, null, 'RETURNED')
  }
  const app = await ui.render(h(ui.ThemeProvider, { theme: 'mls:terminal', themeHost: runtime.themes }, h(Scene)), { stdout, stdin, stderr: stdout, patchConsole: false, exitOnCtrlC: false })
  try {
    await until(() => screen().includes('INTO THE UNKNOWN'))
    assert.equal(channel.whale, true)
    await until(() => channel.pluginScene === undefined && screen().includes('RETURNED'), 1800)
    assert.equal(channel.whale, true)
  } finally { app.unmount(); runtime.unsub(); await runtime.root.fiber.dispose(); term.dispose() }
})
