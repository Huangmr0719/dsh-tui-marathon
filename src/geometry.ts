export interface CellSize { width: number; height: number }

/** Physical cell height / width. Zero selects host measurements or a portable fallback. */
export function resolveCellAspect(config = 0, measured?: CellSize): number {
  const valid = (n: number) => Number.isFinite(n) && n >= .5 && n <= 4
  if (config !== 0 && valid(config)) return config
  const ratio = measured === undefined ? NaN : measured.height / measured.width
  return measured !== undefined && measured.width > 0 && measured.height > 0 && valid(ratio) ? ratio : 2
}

/** One physical scale for both source axes; cell rounding adds padding, never stretching. */
export function openingLayout(columns: number, rows: number, aspect: number) {
  const width = Math.max(1, Math.floor(Math.min(26, columns * .25, rows * aspect * .325, (rows - 5) * aspect)))
  const height = Math.max(1, Math.ceil(width / aspect))
  return { width, height, left: Math.floor((columns - width) / 2),
    top: Math.max(0, Math.floor(rows * .43 - height / 2)),
    paddingY: (height * aspect - width) / 2 }
}
