import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { TuiSceneProps } from '@deepseek-harness-tui/dsh-tui/scenes'
import type { TuiThemeDescriptor } from '@deepseek-harness-tui/dsh-tui/extensions'
import { readFileSync } from 'node:fs'
import { createScene, type GraphicsMode } from './scene.js'

export const name = 'dsh-theme-mls-tui'
export const inject = ['tuiScenes', 'tuiThemes']

export interface Config {
  autoTheme: boolean
  autoBoot: boolean
  motion: 'full' | 'reduced' | 'off'
  graphics: GraphicsMode
  cellAspect: number
  nativeWhale: boolean
}

export const Config: Schema<Config> = Schema.object({
  autoTheme: Schema.boolean().default(true).description('Select MLS Terminal once on activation'),
  autoBoot: Schema.boolean().default(true).description('Play the MLS opening once at startup'),
  motion: Schema.union(['full', 'reduced', 'off']).default('full').description('Animation intensity'),
  graphics: Schema.union(['cells', 'auto']).default('cells').description('Native cells; auto optionally uses a host image for the central logo'),
  cellAspect: Schema.number().min(0).max(4).default(0).description('Cell height / width; 0 uses host measurements, then a 2:1 fallback'),
  nativeWhale: Schema.boolean().default(false).description('Keep the stock blue whale, whose palette is not themeable'),
})

export function apply(ctx: Context, config: Config): void {
  for (const [file, name, displayName] of [
    ['mls-terminal', 'mls:terminal', 'MLS · Acid Rain'],
    ['mls-terminal-256', 'mls:terminal-256', 'MLS · Acid Rain · 256'],
  ]) {
    const theme = JSON.parse(readFileSync(new URL(`../themes/${file}.json`, import.meta.url), 'utf8')) as TuiThemeDescriptor
    ctx.tuiThemes.register({ ...theme, name, displayName }, ctx)
  }

  let channel: TuiSceneProps['channel'] | undefined
  let themeSelected = false
  const activateTheme = (select: (name: string) => boolean): void => {
    if (!themeSelected && config.autoTheme) themeSelected = select('mls:terminal')
  }
  let unbind: (() => void) | undefined
  const bind = (next: TuiSceneProps['channel']): void => {
    if (channel === next) return
    unbind?.()
    channel = next
    // The stock sprite has hardcoded blue pixels. Hide it through the public
    // preference method, without writing settings files or replacing Chat.
    if (!config.nativeWhale && next.whale) {
      next.setWhale(false)
      unbind = () => { if (!next.whale) next.setWhale(true) }
    } else unbind = undefined
  }
  ctx.effect(() => () => { unbind?.(); channel = undefined })
  ctx.tuiScenes.register({ id: 'mls-boot', title: 'MLS opening',
    component: createScene({ motion: config.motion, graphics: config.graphics, cellAspect: config.cellAspect, bind, activateTheme }) }, ctx)
  // A one-commit scene binds the foreground channel when the opening is off.
  ctx.tuiScenes.register({ id: 'mls-bind',
    component: createScene({ motion: 'off', graphics: 'cells', bind, activateTheme }) }, ctx)

  const shortcuts = ctx.get('tuiShortcuts')
  if (shortcuts !== undefined) {
    shortcuts.register('alt+m', { description: 'MLS: replay full-screen opening', handler: () => {
      if (channel?.pluginScene === undefined) ctx.tuiScenes.open('mls-boot')
    } }, ctx)
  }
  ctx.tuiScenes.open(config.autoBoot && config.motion !== 'off' ? 'mls-boot' : 'mls-bind')
}
