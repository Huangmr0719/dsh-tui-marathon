import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.HOME = await mkdtemp(join(tmpdir(), 'mls-stock-'))
process.env.USERPROFILE = process.env.HOME
process.env.NODE_ENV = 'production'
process.env.DSH_TUI_LANG = 'en'
process.env.DSH_TUI_ADAPTER_MODE = 'new'
process.env.FORCE_COLOR = '3'
process.env.DSH_TUI_THEME = 'mls:terminal'
const { activate, makeTerminal, hostImport, until, sleep } = await import('./harness.mjs')
const { Chat } = await hostImport('screens/Chat.js')
const { PageMargin } = await hostImport('components/PageMargin.js')
const { applyPageMargin } = await hostImport('tuiDisplayPrefs.js')
const { QuestionStore } = await hostImport('dsh-adapter/questions.js')
let checks = 0
const check = (label, result) => { assert.ok(result, label); checks++; process.stdout.write(`PASS ${label}\n`) }
for (const [cols, rows, fullscreen, margin] of [[120, 36, true, 'normal'], [80, 24, false, 'roomy'], [48, 20, true, '3x1']]) {
  applyPageMargin(margin)
  const runtime = await activate({ autoBoot: false })
  const { React, ui, channel, scenes, themes, shortcuts, renderScene } = runtime
  channel.pageMargin = margin
  const { term, stdout, stdin, screen } = await makeTerminal(cols, rows)
  const h = React.createElement
  const chat = h(Chat, { channel, questionStore: new QuestionStore(), onExit() {}, fullscreen, trajectorySeen: true, renderScene, extensionShortcuts: shortcuts })
  const page = h(PageMargin, null, chat)
  const app = await ui.render(h(ui.ThemeProvider, { theme: 'mls:terminal', themeHost: themes }, fullscreen ? h(ui.AlternateScreen, null, page) : page), { stdout, stdin, stderr: stdout, patchConsole: false, exitOnCtrlC: false })
  const label = `${cols}×${rows} ${fullscreen ? 'full' : 'inline'} margin=${margin}`
  try {
    await until(() => channel.pluginScene === undefined && screen().includes('LIVE CONVERSATION'))
    check(`${label}: stock blue whale is hidden without editing settings`, channel.whale === false)
    stdin.write('keep-this-draft')
    await until(() => screen().includes('keep-this-draft'))
    stdin.write('\x1bm')
    await until(() => screen().includes('INTO THE UNKNOWN'))
    stdin.write(' ')
    await sleep(200)
    const corners = [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]].map(([x, y]) => term.buffer.active.getLine(y)?.getCell(x))
    check(`${label}: animation reaches all four physical screen corners`, corners.every(cell => cell?.isBgRGB() && cell.getBgColor() === 0))
    check(`${label}: original conversation is replaced during opening`, !screen().includes('LIVE CONVERSATION'))
    check(`${label}: default animation uses solid glyphs, not sampled Braille`, !/[\u2800-\u28ff]/u.test(screen()))
    const frozen = screen()
    await sleep(250)
    check(`${label}: paused screen is stable`, frozen === screen())
    for (const [width, height] of [[48, 20], [150, 42], [150, 28], [60, 44], [cols, rows]]) {
      term.resize(width, height)
      stdout.columns = width
      stdout.rows = height
      stdout.emit('resize')
      const coversViewport = () => [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].every(([x, y]) => {
        const cell = term.buffer.active.getLine(term.buffer.active.baseY + y)?.getCell(x)
        return cell?.isBgRGB() && cell.getBgColor() === 0
      })
      await until(() => coversViewport() && screen().includes('INTO THE UNKNOWN'))
      check(`${label}: paused resize to ${width}×${height} fills the new viewport`, coversViewport())
    }
    stdin.write(' ')
    for (const [width, height] of [[64, 22], [132, 38], [cols, rows]]) {
      term.resize(width, height)
      stdout.columns = width
      stdout.rows = height
      stdout.emit('resize')
      const coversViewport = () => [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].every(([x, y]) => {
        const cell = term.buffer.active.getLine(term.buffer.active.baseY + y)?.getCell(x)
        return cell?.isBgRGB() && cell.getBgColor() === 0
      })
      await until(() => coversViewport() && screen().includes('INTO THE UNKNOWN'))
      check(`${label}: running resize to ${width}×${height} fills the new viewport`, coversViewport())
    }
    stdin.write('\x1b')
    await until(() => channel.pluginScene === undefined && screen().includes('LIVE CONVERSATION'))
    check(`${label}: skip returns to the native conversation`, screen().includes('LIVE CONVERSATION'))
    check(`${label}: terminal buffer restored`, term.buffer.active.type === (fullscreen ? 'alternate' : 'normal'))
    check(`${label}: scene round-trip preserves the draft`, screen().includes('keep-this-draft'))
    channel.complete('aborted')
    check(`${label}: cancelled turns do not celebrate`, channel.pluginScene === undefined)
    channel.complete()
    await sleep(150)
    check(`${label}: successful turn keeps the native conversation and draft visible`, channel.pluginScene === undefined && screen().includes('LIVE CONVERSATION') && screen().includes('keep-this-draft'))
    check(`${label}: no completion scene or shortcut is installed`, !scenes.list().some(scene => scene.id === 'mls-complete') && shortcuts.list().length === 1)
    await runtime.fiber.dispose()
    check(`${label}: unload removes themes, scenes and shortcuts`, themes.getSnapshot().length === 0 && scenes.list().length === 0 && shortcuts.list().length === 0)
    check(`${label}: unload restores the stock decoration preference`, channel.whale === true)
  } finally {
    app.unmount(); runtime.unsub(); await runtime.root.fiber.dispose(); term.dispose()
  }
}
process.stdout.write(`Unmodified-host verification: ${checks} checks passed\n`)
