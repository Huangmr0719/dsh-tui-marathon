import { readFile } from 'node:fs/promises'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'

export interface LogoImage { readonly width: number; readonly height: number; readonly data: Uint8Array }
const unzip = promisify(gunzip)
let cached: Promise<LogoImage> | undefined

/** Only the central logo uses pixels; borders, text and sweeps remain native cells. */
export function loadLogo(): Promise<LogoImage> {
  return cached ??= readFile(new URL('../assets/logo.rgba.gz', import.meta.url)).then(unzip).then(data => {
    if (data.length !== 256 * 256 * 4) throw new Error('Corrupt MLS logo')
    return { width: 256, height: 256, data }
  }).catch(error => { cached = undefined; throw error })
}
