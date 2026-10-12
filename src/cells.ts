import { pixelWhale, whaleContours } from './artwork.js'
import { openingLayout, resolveCellAspect } from './geometry.js'

export const cellPalette = ['0;0;0', '77;108;254', '215;255;0', '255;0;60', '25;240;23'] as const
const BLACK = 0, BLUE = 1, ACID = 2, RED = 3, GREEN = 4
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const ease = (v: number) => 1 - (1 - clamp(v)) ** 3

export interface CellFrame {
  columns: number
  rows: number
  lines: string[]
  phase: 'opening' | 'maze' | 'sweep' | 'clear'
}

/** Integer cell geometry. No decoded image frames, opacity, antialiasing or Braille. */
class Canvas {
  chars: string[]
  fg: Uint8Array
  bg: Uint8Array
  bold: Uint8Array
  constructor(readonly columns: number, readonly rows: number) {
    this.chars = Array(columns * rows).fill(' ')
    this.fg = new Uint8Array(columns * rows)
    this.bg = new Uint8Array(columns * rows)
    this.bold = new Uint8Array(columns * rows)
  }
  put(x: number, y: number, char: string, fg: number, bg?: number, bold = false) {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return
    const i = y * this.columns + x
    this.chars[i] = char; this.fg[i] = fg; this.bold[i] = Number(bold)
    if (bg !== undefined) this.bg[i] = bg
  }
  rect(x: number, y: number, w: number, h: number, color: number) {
    const right = Math.min(this.columns, Math.round(x + w)), bottom = Math.min(this.rows, Math.round(y + h))
    for (let row = Math.max(0, Math.round(y)); row < bottom; row++) {
      for (let col = Math.max(0, Math.round(x)); col < right; col++) this.put(col, row, ' ', color, color)
    }
  }
  outline(x: number, y: number, w: number, h: number, color: number) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
    if (w <= 0 || h <= 0) return
    // Heavy box strokes keep the scan visible without filling half a text row.
    for (let col = Math.max(0, x + 1); col < Math.min(this.columns, x + w - 1); col++) {
      this.put(col, y, '━', color)
      this.put(col, y + h - 1, '━', color)
    }
    for (let row = Math.max(0, y + 1); row < Math.min(this.rows, y + h - 1); row++) {
      this.put(x, row, '┃', color)
      this.put(x + w - 1, row, '┃', color)
    }
    this.put(x, y, '┏', color); this.put(x + w - 1, y, '┓', color)
    this.put(x, y + h - 1, '┗', color); this.put(x + w - 1, y + h - 1, '┛', color)
  }
  text(value: string, y: number, fg: number, bold = false) {
    const x = Math.floor((this.columns - value.length) / 2)
    for (let i = 0; i < value.length; i++) this.put(x + i, y, value[i], fg, undefined, bold)
  }
  half(x: number, y: number, top: number | undefined, bottom: number | undefined) {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return
    const bg = this.bg[y * this.columns + x]
    top ??= bg; bottom ??= bg
    this.put(x, y, top === bottom ? ' ' : '▀', top, bottom)
  }
  lines() {
    return Array.from({ length: this.rows }, (_, y) => {
      let line = '', previous = ''
      for (let x = 0; x < this.columns; x++) {
        const i = y * this.columns + x, style = `${this.fg[i]}:${this.bg[i]}:${this.bold[i]}`
        if (style !== previous) {
          line += `\x1b[${this.bold[i] ? 1 : 22};38;2;${cellPalette[this.fg[i]]};48;2;${cellPalette[this.bg[i]]}m`
          previous = style
        }
        line += this.chars[i]
      }
      return line + '\x1b[0m'
    })
  }
}

function insideWhale(x: number, y: number) {
  let winding = 0
  for (const points of whaleContours) {
    for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
      const ax = points[j], ay = points[j + 1], bx = points[i], by = points[i + 1]
      const side = (bx - ax) * (y - ay) - (x - ax) * (by - ay)
      if (ay <= y && by > y && side > 0) winding++
      else if (ay > y && by <= y && side < 0) winding--
    }
  }
  return winding !== 0
}
const logoMasks = new Map<string, Uint8Array>()
function logoMask(width: number, height: number, aspect: number, paddingY: number) {
  const key = `${width}:${height}:${aspect}`
  let mask = logoMasks.get(key)
  if (mask) return mask
  const stride = width * 2
  mask = Uint8Array.from({ length: stride * height * 2 }, (_, i) => Number(insideWhale(
    (i % stride + .5) / 2 / width * 50,
    ((Math.floor(i / stride) + .5) / 2 * aspect - paddingY) / width * 50)))
  logoMasks.set(key, mask)
  if (logoMasks.size > 8) logoMasks.delete(logoMasks.keys().next().value!)
  return mask
}

function logo(c: Canvas, aspect: number) {
  const { width, height, left, top, paddingY } = openingLayout(c.columns, c.rows, aspect)
  const mask = logoMask(width, height, aspect, paddingY), stride = width * 2
  const quadrants = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█']
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * 2 * stride + x * 2
    const bits = mask[i] | mask[i + 1] << 1 | mask[i + stride] << 2 | mask[i + stride + 1] << 3
    if (bits === 15) c.put(left + x, top + y, ' ', ACID, ACID)
    else if (bits) c.put(left + x, top + y, quadrants[bits], ACID)
  }
}

function pixelZoom(c: Canvas, size: number, aspect: number) {
  const left = (c.columns - size) / 2, top = (c.rows * aspect - size) / 2
  const color = (x: number, y: number) => {
    const sx = Math.floor((x - left) / size * 64), sy = Math.floor((y - top) / size * 64)
    return sx >= 0 && sy >= 0 && sx < 64 && sy < 64 && pixelWhale[sy][sx] === '1' ? BLUE : undefined
  }
  for (let y = 0; y < c.rows; y++) for (let x = 0; x < c.columns; x++) {
    const a = color(x + .5, (y + .25) * aspect), b = color(x + .5, (y + .75) * aspect)
    if (a !== undefined || b !== undefined) c.half(x, y, a, b)
  }
}

function opening(c: Canvas, t: number, reduced: boolean, aspect: number, drawLogo: boolean) {
  if (t >= 5730 && !reduced) c.rect(0, 0, c.columns, c.rows, BLUE)
  else if (!reduced) {
    const giant = Math.min(c.columns, c.rows * aspect) * 1.4
    if (t >= 1200 && t < 1450 && Math.floor((t - 1200) / 35) % 2 === 0) pixelZoom(c, giant, aspect)
    if (t >= 1850) {
      const v = clamp((t - 2880) / 2850), scale = 1 + 39 * (.01 * v + .99 * v ** 30)
      pixelZoom(c, giant * scale, aspect)
      if (t >= 3060) {
        const side = Math.max(2, c.columns * 80 / 1440 * scale)
        c.rect((c.columns - side) / 2, (c.rows - side / aspect) / 2, side, side / aspect, BLUE)
      }
    }
    const ratios = [[.88, .65], [.642, .477], [.505, .375], [.415, .307], [.354, .261]]
    for (let i = 0; i < ratios.length; i++) {
      if (t < [2350, 2450, 2550, 2750, 2650][i]) continue
      const v = clamp((t - 2860) / 2800), scale = 1 + (7 * (1 + (4 - i) * .3) - 1) * (.03 * v + .97 * v ** 6)
      const w = c.columns * ratios[i][0] * scale, h = c.rows * ratios[i][1] * scale
      c.outline((c.columns - w) / 2, (c.rows - h) / 2, w, h, GREEN)
    }
  }
  if (t >= 6730 && !reduced) return
  const { top, height } = openingLayout(c.columns, c.rows, aspect)
  if (drawLogo) logo(c, aspect)
  const title = Math.min(c.rows - 3, top + height + 1)
  c.text(c.columns >= 20 ? 'DEEPSEEK HARNESS' : 'DEEPSEEK', title, ACID, true)
  c.text(c.columns >= 20 ? 'INTO THE UNKNOWN' : 'UNKNOWN', title + 2, ACID)
}

interface Panel { x: number; y: number; w: number; h: number; order: number; z: number }
function panels(columns: number, rows: number): Panel[] {
  const out: Panel[] = []
  for (let z = 0; z < 3; z++) {
    const edges = z === 0 ? [0, .2, .375, 1] : z === 1 ? [0, .2, .4, .6, .8, 1] : [0, .1, .725, 1]
    const zone = edges.slice(0, -1).map((edge, i) => ({
      x: Math.round(edge * columns), y: Math.round(z * rows / 3),
      w: Math.round(edges[i + 1] * columns) - Math.round(edge * columns),
      h: Math.round((z + 1) * rows / 3) - Math.round(z * rows / 3), z, order: 0,
    }))
    if (z === 1) zone.reverse()
    for (const panel of zone) { panel.order = out.length; out.push(panel) }
  }
  return out
}

const mazeCache = new Map<string, string[]>()
function maze(columns: number, rows: number): string[] {
  const key = `${columns}:${rows}`, cached = mazeCache.get(key)
  if (cached) return cached
  const w = Math.max(3, Math.ceil(columns / 5)), h = Math.max(3, Math.ceil(rows / 3))
  const roads = Array.from({ length: h }, () => new Uint8Array(w)), stack = [[1, 1]]
  let seed = 20260830
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  roads[1][1] = 1
  while (stack.length) {
    const [x, y] = stack[stack.length - 1]
    const choices = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => x + dx > 0 && y + dy > 0 && x + dx < w && y + dy < h && !roads[y + dy][x + dx])
    if (!choices.length) { stack.pop(); continue }
    const [dx, dy] = choices[Math.floor(random() * choices.length)]
    roads[y + dy / 2][x + dx / 2] = 1; roads[y + dy][x + dx] = 1
    stack.push([x + dx, y + dy])
  }
  const pattern = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => {
    const tx = Math.floor(x / 5), ty = Math.floor(y / 3)
    return roads[ty]?.[tx] ? '●' : (tx * 7 + ty * 13) % 3 ? '×' : '·'
  }).join(''))
  mazeCache.set(key, pattern)
  if (mazeCache.size > 4) mazeCache.delete(mazeCache.keys().next().value!)
  return pattern
}

function sweep(c: Canvas, t: number) {
  const regions = panels(c.columns, c.rows), pattern = maze(c.columns, c.rows)
  for (const p of regions) {
    const order = p.order / (regions.length - 1)
    const age = t - (900 + order * 500)
    const exitAt = 580, exitSpan = 280
    if (age >= exitAt + exitSpan) continue
    const dotAge = t - (400 + order * 600)
    c.rect(p.x, p.y, p.w, p.h, dotAge < 20 ? BLUE : BLACK)
    if (dotAge >= 20) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) c.put(x, y, pattern[y][x], BLUE)
    if (age < 0) continue
    const amount = age < exitAt ? ease(age / 50) : 1 - ease((age - exitAt) / exitSpan)
    const width = Math.round(p.w * amount)
    if (age >= exitAt) c.rect(p.x, p.y, p.w, p.h, BLACK)
    c.rect(p.z === 1 ? p.x + p.w - width : p.x, p.y, width, p.h, RED)
  }
}

export function cellFrame(ms: number, columns: number, rows: number, reduced = false, options: { aspect?: number; logo?: boolean } = {}): CellFrame {
  columns = Math.max(1, Math.floor(columns)); rows = Math.max(1, Math.floor(rows))
  const c = new Canvas(columns, rows), t = Math.max(0, ms)
  let phase: CellFrame['phase'] = 'clear'
  if (reduced || t < 7130) {
    opening(c, t, reduced, resolveCellAspect(options.aspect), options.logo !== false); phase = 'opening'
  } else if (t < 9400) {
    sweep(c, t - 7130); phase = t < 8030 ? 'maze' : 'sweep'
  }
  return { columns, rows, lines: c.lines(), phase }
}
