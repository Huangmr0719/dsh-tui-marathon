// Bounded, model-free measurement through the stock host clock and renderer.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.HOME = await mkdtemp(join(tmpdir(), 'mls-motion-'))
process.env.USERPROFILE = process.env.HOME
process.env.NODE_ENV = 'production'
process.env.DSH_TUI_LANG = 'en'
process.env.DSH_TUI_ADAPTER_MODE = 'new'
process.env.FORCE_COLOR = '3'
const renderLog = join(process.env.HOME, 'paint.log')
process.env.DSH_TUI_RENDER_LOG = renderLog
const { activate, makeTerminal, until } = await import('./harness.mjs')
const { hostImport } = await import('./harness.mjs')
const { PageMargin } = await hostImport('components/PageMargin.js')
const results = []
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0
for (const [columns, rows] of [[120, 36], [180, 54]]) {
  const runtime = await activate({ autoBoot: true })
  const { React, ui, channel, scenes } = runtime
  channel.pageMargin = 'normal'
  const samples = []
  const measuredUi = { ...ui, useAnimationFrame(interval) {
    const result = ui.useAnimationFrame(interval)
    samples.push({ wall: performance.now(), clock: result[1], interval })
    return result
  } }
  const { stdout, stdin, term } = await makeTerminal(columns, rows)
  function Scene() {
    React.useSyncExternalStore(channel.subscribe, () => channel.version)
    const scene = scenes.list().find(scene => scene.id === channel.pluginScene?.id)
    return scene ? React.createElement(scene.component, { React, ui: measuredUi, channel, close: channel.closePluginScene }) : React.createElement(ui.Text, null, 'RETURNED')
  }
  await writeFile(renderLog, '')
  const start = performance.now(), startedAt = Date.now()
  const app = await ui.render(React.createElement(ui.ThemeProvider, { theme: 'mls:terminal', themeHost: runtime.themes }, React.createElement(ui.AlternateScreen, null, React.createElement(PageMargin, null, React.createElement(Scene)))), {
    stdout, stdin, stderr: stdout, patchConsole: false, exitOnCtrlC: false,
  })
  try {
    await until(() => channel.pluginScene === undefined, 14000)
    const unique = samples.filter((sample, i) => i === 0 || sample.clock !== samples[i - 1].clock)
    const intervals = unique.slice(1).map((sample, i) => sample.wall - unique[i].wall)
    const elapsed = performance.now() - start
    const paints = [...(await readFile(renderLog, 'utf8')).matchAll(/^===== frame (\S+) /gm)].map(match => Date.parse(match[1]) - startedAt)
    const moving = paints.filter(ms => ms >= 3000 && ms < 5600)
    results.push({ columns, rows, requestedInterval: samples[0]?.interval, elapsedMs: Math.round(elapsed), clockUpdates: unique.length,
      effectiveClockFps: +(1000 / (intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length)).toFixed(2),
      medianIntervalMs: +percentile(intervals, .5).toFixed(2), p95IntervalMs: +percentile(intervals, .95).toFixed(2), terminalPaints: paints.length,
      motionPaintFps: +((moving.length - 1) * 1000 / (moving.at(-1) - moving[0])).toFixed(2) })
  } finally { app.unmount(); runtime.unsub(); await runtime.root.fiber.dispose(); term.dispose() }
}
await writeFile(process.env.MLS_MEASURE_OUTPUT ?? 'evidence/motion-current.json', JSON.stringify({ date: '2026-10-12', backend: 'deterministic fixture; stock clock and renderer', results }, null, 2) + '\n')
process.stdout.write(JSON.stringify(results) + '\n')
