import { cellPalette } from '../dist/cells.js'

const quadrants = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█']

// Inspect the rendered subcells, rather than trusting the layout's dimensions.
export function whaleBounds(lines, aspect) {
  const points = []
  for (const [y, line] of lines.entries()) {
    let x = 0, fg = '', bg = ''
    for (const match of line.matchAll(/\x1b\[([0-9;]*)m|([^\x1b])/gu)) {
      if (match[1] !== undefined) {
        const style = match[1]
        fg = style.match(/38;2;(\d+;\d+;\d+)/)?.[1] ?? ''
        bg = style.match(/48;2;(\d+;\d+;\d+)/)?.[1] ?? ''
        continue
      }
      const bits = match[2] === ' ' && bg === cellPalette[2] ? 15 : fg === cellPalette[2] ? Math.max(0, quadrants.indexOf(match[2])) : 0
      for (let q = 0; q < 4; q++) if (bits & 1 << q) points.push([x + q % 2 / 2, (y + Math.floor(q / 2) / 2) * aspect])
      x++
    }
  }
  const xs = points.map(point => point[0]), ys = points.map(point => point[1])
  const left = Math.min(...xs), top = Math.min(...ys)
  const width = Math.max(...xs) - left + .5, height = Math.max(...ys) - top + aspect / 2
  return { left, top, width, height, ratio: width / height }
}

export function terminalWhaleBounds(term, aspect) {
  const rgb = value => [(value >> 16) & 255, (value >> 8) & 255, value & 255].join(';')
  const lines = Array.from({ length: term.rows }, (_, y) => Array.from({ length: term.cols }, (_, x) => {
    const cell = term.buffer.active.getLine(term.buffer.active.baseY + y)?.getCell(x)
    return `\x1b[38;2;${rgb(cell?.getFgColor() ?? 0)};48;2;${rgb(cell?.getBgColor() ?? 0)}m${cell?.getChars() || ' '}`
  }).join(''))
  return whaleBounds(lines, aspect)
}
