import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { PassThrough, Writable } from 'node:stream'

export const hostDir = resolve(process.env.MLS_TUI_HOST ?? fileURLToPath(new URL('../../dsh-TUI', import.meta.url)))
const requireHost = createRequire(resolve(hostDir, 'package.json'))
export const hostImport = path => import(pathToFileURL(resolve(hostDir, 'lib/types', path)).href)
export const dependency = name => import(pathToFileURL(requireHost.resolve(name)).href)
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export async function until(predicate, ms = 4000) {
  const deadline = Date.now() + ms
  while (!predicate() && Date.now() < deadline) await sleep(25)
  if (!predicate()) throw new Error('Timed out waiting for terminal state')
}

/** Deterministic backend fixture; Chat, registries, hooks and renderer are real. */
export function makeChannel() {
  const listeners = new Set()
  const events = []
  const channel = {
    version: 0, ready: true, sessionColor: 'accent', agentBindingGeneration: 0, cancelPending: false,
    rows: [{ id: 1, kind: 'user', text: 'Inspect the terminal plugin.' },
      { id: 2, kind: 'assistant', text: 'LIVE CONVERSATION\nThis native transcript returns after the animation.' }],
    status: 'idle', splashFont: 'bold', sessionTitle: 'MLS local validation', agentId: 'mls-local',
    model: 'deepseek-v4-flash', provider: 'deepseek-official', cwd: hostDir, displayCwd: '~/dsh', gitBranch: 'local',
    tokens: { input: 600, output: 120 }, working: false, spinnerMode: 'idle', responseChars: 0,
    activeToolCount: 0, mode: { id: 'default', plan: false }, modeIndex: 0, turnStart: Date.now(),
    lastUserText: '', pending: [], commandList: [], notifications: [],
    whale: true, whaleIdle: false, whaleGirl: false,
    setWhale(whale) { channel.publish({ whale }) },
    activityEnabled: false, contextBarEnabled: true, activityFrames: [], todos: [], subagents: [], backend: 'dsh',
    statusBar: { compact: true, model: true, thinking: true, cwd: true, contextUsage: true,
      cache: true, trajectory: false, shortcutHint: false, tokens: false, tps: false, gitBranch: false },
    traceEvents: () => events,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    submit: () => {}, cancel: () => {}, clear: () => {}, cycleMode: () => {},
    notify(text) { channel.notifications.push({ text }); channel.publish() },
    listModels: async () => [], listSessions: () => [], setResumeTarget: () => {},
    lastUsage: { input: 600, cacheRead: 40, cacheWrite: 0, output: 120 },
    contextWindow: 1000000, contextSegments: [], tpsSamples: [], reasoningEffort: 'max', agentPreset: 'standard',
    publish(changes = {}) { Object.assign(channel, changes); channel.version++; for (const listener of listeners) listener() },
    complete(reason = 'completed') {
      events.push({ seq: events.length + 1, type: 'turn/start', data: {} })
      channel.publish({ working: true })
      events.push({ seq: events.length + 1, type: 'turn/end', data: { reason: { kind: reason } } })
      channel.publish({ working: false })
    },
    listenerCount: () => listeners.size,
  }
  return channel
}

export async function makeTerminal(cols, rows) {
  const xterm = await dependency('@xterm/headless')
  const { Terminal } = xterm.default ?? xterm
  const term = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 500 })
  const writes = []
  class Output extends Writable {
    columns = cols; rows = rows; isTTY = true
    _write(chunk, _, done) { writes.push(String(chunk)); term.write(String(chunk), done) }
  }
  class Input extends PassThrough {
    isTTY = true
    setRawMode() { return this }
    ref() { return this }
    unref() { return this }
  }
  const stdout = new Output(), stdin = new Input()
  const screen = () => Array.from({ length: term.rows }, (_, y) => term.buffer.active.getLine(term.buffer.active.baseY + y)?.translateToString(true) ?? '').join('\n')
  return { term, stdout, stdin, writes, screen }
}

export async function activate(config = {}) {
  const { Context } = await dependency('@deepseek-ai/cordis')
  const { default: Commands } = await dependency('@deepseek-ai/dsh-commands')
  const scenesModule = await hostImport('dsh-adapter/scenes.js')
  const themesModule = await hostImport('dsh-adapter/themes.js')
  const shortcutsModule = await hostImport('dsh-adapter/shortcuts.js')
  const hostModule = await hostImport('dsh-adapter/plugin-host.js')
  const { readFile } = await import('node:fs/promises')
  const plugin = await import('../dist/index.js')
  const root = new Context()
  const channel = makeChannel()
  const { registerTuiChannel } = await hostImport('adapter/channel/host-registry.js')
  await root.plugin(Commands).await()
  await root.plugin(scenesModule.default).await()
  await root.plugin(themesModule.TuiThemeRuntime).await()
  await root.plugin(shortcutsModule.TuiShortcutRuntime).await()
  const unchannel = registerTuiChannel(root, channel)
  const hostFiber = root.plugin({ name: hostModule.name, apply: hostModule.apply })
  await hostFiber.await()
  const host = root.get('tuiPluginHost')
  const ready = await hostModule.getHostInitialKernelRefreshForTest(host).awaitResult()
  if (ready.status !== 'completed') throw new Error(`Host kernel readiness: ${ready.status}`)
  const manifest = await readFile(new URL('../dsh-plugin.json', import.meta.url), 'utf8')
  let pluginContext
  const fiber = root.plugin({ name: 'mls-local-verification', inject: plugin.inject, apply(ctx) {
    hostModule.getHostAdmissionForTest(host).admit(ctx, manifest, { source: 'local:mls/dsh-plugin.json' })
    pluginContext = ctx
    plugin.apply(ctx, { autoTheme: true, autoBoot: true, motion: 'full', graphics: 'cells', cellAspect: 0, nativeWhale: false, ...config })
  } })
  await fiber.await()
  const scenes = scenesModule.getHostSceneRuntime(root.get('tuiScenes'))
  const themes = themesModule.getHostThemes(root.get('tuiThemes'))
  const shortcuts = shortcutsModule.getHostShortcuts(root.get('tuiShortcuts'))
  const unsub = scenes.subscribe(() => {
    const active = scenes.active
    channel.publish({ pluginScene: active && { id: active.id, title: active.title, presentation: active.presentation } })
  })
  const active = scenes.active
  channel.pluginScene = active && { id: active.id, title: active.title, presentation: active.presentation }
  channel.closePluginScene = () => scenes.close()
  const React = await dependency('react')
  const ui = await hostImport('ui.js')
  const renderScene = id => {
    const scene = scenes.list().find(scene => scene.id === id)
    return React.createElement(scene.component, { React, ui, channel, close: channel.closePluginScene })
  }
  return { root, fiber, pluginContext, scenes, themes, shortcuts, channel, React, ui, renderScene, unsub: () => { unsub(); unchannel() } }
}
