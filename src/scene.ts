import type { TuiSceneProps, TuiSceneDescriptor } from '@deepseek-harness-tui/dsh-tui/scenes'
import { loadLogo, type LogoImage } from './image.js'
import { Timeline } from './timeline.js'
import { fullViewport } from './viewport.js'
import { cellFrame } from './cells.js'
import { openingLayout, resolveCellAspect } from './geometry.js'

export type GraphicsMode = 'cells' | 'auto'

export interface SceneOptions {
  motion: 'full' | 'reduced' | 'off'
  graphics: GraphicsMode
  cellAspect?: number
  bind?(channel: TuiSceneProps['channel']): void
  activateTheme?(select: (name: string) => boolean): void
}

export function createScene(options: SceneOptions): TuiSceneDescriptor['component'] {
  return function MlsScene({ React, ui, channel, close }: TuiSceneProps) {
    const { Box, Ansi, Image, useAnimationFrame, useTerminalSize, useInput, useTerminalImages, useTerminalImageCellSize } = ui
    React.useSyncExternalStore(channel.subscribe, () => channel.version)
    const size = useTerminalSize()
    const [, selectTheme] = ui.useTheme()
    const { columns, rows, x, y } = fullViewport(size, channel.pageMargin)
    const [paused, setPaused] = React.useState(false)
    // Use the public host probe for metrics; never query stdout ourselves.
    const images = useTerminalImages(options.motion !== 'off' && (options.graphics === 'auto' || !options.cellAspect))
    const aspect = resolveCellAspect(options.cellAspect, useTerminalImageCellSize())
    const reduced = options.motion !== 'full'
    // Session startup is asynchronous in the normal dsh-tui launcher. Visual
    // motion must keep ticking even before that channel reports readiness.
    const [ref, clock] = useAnimationFrame(paused || options.motion === 'off' ? null : reduced ? 100 : 16)
    const timeline = React.useRef(new Timeline())
    const time = timeline.current.read(clock, !paused)
    const at = reduced ? 0 : time
    const [image, setImage] = React.useState<LogoImage>()
    const showImage = !reduced && options.graphics === 'auto' && images && image !== undefined && at < 6730

    React.useEffect(() => { options.bind?.(channel) }, [channel])
    React.useEffect(() => { options.activateTheme?.(selectTheme) }, [selectTheme])
    React.useEffect(() => {
      if (channel.startupFailure !== undefined || options.motion === 'off') close()
    }, [channel.startupFailure, close])
    React.useEffect(() => {
      if (time >= (reduced ? 650 : 9450)) close()
    }, [time, close])
    React.useEffect(() => {
      if (options.graphics !== 'auto' || !images || reduced) return
      let active = true
      void loadLogo().then(source => { if (active) setImage(source) }).catch(error => {
        if (active) channel.notify(`MLS logo: ${String(error)}`, { color: 'error' })
      })
      return () => { active = false }
    }, [images, reduced])
    // The native conversation returns on close; the host owns its input and state.
    useInput((input, key, event) => {
      event.stopImmediatePropagation()
      if (key.escape || input === 'q' || key.return) { close(); return }
      if (input === ' ') {
        if (!paused) timeline.current.read(clock, false)
        setPaused(!paused)
      } else if (input || key.ctrl) close()
    }, { prepend: true })

    const native = React.useMemo(() => cellFrame(at, columns, rows, reduced, { aspect, logo: !showImage }), [at, columns, rows, reduced, aspect, showImage])
    const center = openingLayout(columns, rows, aspect)
    const h = React.createElement
    if (options.motion === 'off') return null
    return h(Box, { ref, width: size.columns, height: size.rows, flexShrink: 0 },
      h(Box, { position: 'absolute', left: -x, top: -y, width: columns, height: rows,
        backgroundColor: '#000000', overflow: 'hidden', onClick: () => close() },
      ...native.lines.map((line, y) => h(Box, { key: y, position: 'absolute', left: 0, top: y }, h(Ansi, null, line))),
      showImage ? h(Box, { position: 'absolute', left: center.left, top: center.top, width: center.width, height: center.height },
        h(Image, { source: image, width: center.width, height: center.height, alt: '', transparent: true, lineArt: true, presentation: 'preview' })) : null))
  }
}
