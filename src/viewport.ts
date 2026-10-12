/** Public page-margin values plus the scene's size describe the full terminal. */
export function fullViewport(size: { columns: number; rows: number; screenRows?: number }, setting: unknown) {
  const presets: Record<string, readonly [number, number]> = {
    none: [0, 0], slim: [1, 1], normal: [2, 1], roomy: [4, 2],
  }
  const match = typeof setting === 'string' ? /^(\d{1,2})(?:[x×,，](\d{1,2}))?$/u.exec(setting) : null
  const custom = match && Number(match[1]) <= 8 && Number(match[2] ?? 1) <= 4
    ? [Number(match[1]), Number(match[2] ?? 1)] : undefined
  const [x, y] = (typeof setting === 'string' ? presets[setting] : undefined) ?? custom ?? presets.normal
  return { columns: size.columns + x * 2, rows: size.screenRows ?? size.rows + y * 2, x, y }
}
