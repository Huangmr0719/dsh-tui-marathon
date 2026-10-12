# Validation · 2026-10-12 · 0.4.2

## 0.4.2 normal launcher

- Installed the official `dsh` CLI 0.2.0-rc.2 and dsh-TUI 0.14.0 commands, then added the theme to the normal `dsh-tui` profile with `dsh plugin --profile dsh-tui add`. The stock host source is unchanged.
- Reproduced a startup stall through the actual `dsh-tui` command: the opening waited for an asynchronous channel's readiness and remained on its first frame. A new real-renderer regression failed before the fix and passed afterward. Opening motion and automatic close now follow the host clock independently of session readiness.
- TypeScript build, all twelve automated tests and all sixty-three stock-host integration checks passed. The new test advances through visible scan frames and returns to the host while the session remains unready.
- A 120×36 PTY run of the installed `dsh-tui` command produced 266 terminal paint buffers: opening, refined green scan frames, all 4,320 cells red at the sweep peak, and the Acid Rain native landing page. No Braille or stock blue whale pixels were detected. Only onboarding dismissal and exit keys were sent; no prompt or model inference was submitted. Test credentials were process-local placeholders.
- Both READMEs now start with one theme-install command followed by normal `dsh-tui` startup. Source builds and `npm start` are confined to the development instructions. Raw local captures and profile files stay out of Git.
- Refined the green scans to heavy box-drawing strokes after the solid half-row version proved too thick. The build, twelve tests and sixty-three integration checks passed again; a fresh default-launcher recording supplies the startup GIF in both READMEs.
- The GIF replays real 120×36 ANSI output at 24 fps for 9.54 seconds (229 frames, about 663 KiB). It includes the scan and red panel exit, excludes the native page and personal paths, and preserves wall-clock timing. This presentation encoding is separate from live terminal frame cadence.

## 0.4.1 scan visibility

- Replaced hairline box glyphs with solid half-row horizontal strokes and cell-aspect-adjusted vertical strokes. The timing, center logo and red sweep are unchanged.
- TypeScript build, all eleven tests and all sixty-three stock-host integration checks passed again. ANSI cell renders were inspected at 48×20, 120×36 and 180×54, including the expanding scan frames. Captures are in `evidence/scan-before-*.png` and `evidence/scan-after-*.png`.
- Performance and full CLI capture results below were measured on 0.4.0; those measurements were not repeated for this stroke-only update.

## 0.4.0 baseline

- Strict TypeScript build. Stock host Git `1d832df3f97e828b1aaea8376657d6b6ecf30b86` remains unchanged.
- Eleven automated tests: physical logo proportions, measured-metric updates in a paused stock scene, unsupported-image fallback, host clock subscription, both native header palettes, static reduced motion and automatic close, complete red coverage, viewport margins, pause/resume, optional logo decoding and preference restoration.
- The new proportion and scene-clock checks failed against 0.3.0 before the fix. Rendered logo bounds are compared with the original vector contours across cell height/width ratios 1.5, 2, 2.4 and 3; tolerance accounts for half-cell quantization.
- Sixty-three checks through the original Chat, PageMargin, shortcuts, registries and terminal renderer. Cases: 120×36 fullscreen / normal margins; 80×24 inline / roomy; 48×20 fullscreen / custom 3×1. Checks cover four-corner coverage, resize during pause/playback, input, draft restoration, successful/cancelled turns staying in native Chat, no completion scene or shortcut, and unload cleanup.
- Successful turns cannot re-enable completion animation, including an old `completion: true` option. The completion observer and scene were removed.
- Original host `LogoV2` renders Acid Rain from both palettes. RGB color strings prevent the former HEX-to-blue gradient fallback. The unthemeable blue whale is hidden via the public preference method and restored on unload; retaining it is tested.
- Official Harness CLI 0.2.0-rc.2 launch with the original TUI, a placeholder key, localhost API address and no input: startup, full-screen red coverage of all 4,320 cells, then the themed native landing page. The capture has 260 painted frames, no sampled Braille, Acid Rain native colors and no stock blue whale pixels.
- Three compact artwork files replace the 222 full-frame rasters. Source hashes and licenses are retained. Default runtime rendering does not decode pictures; optional `auto` decodes one cached central logo.
- Official `dsh plugin add` installs the 0.4.0 tarball, reconciles the bundle list and imports its installed entry. This check ran offline in an isolated profile with existing framework/host dependencies linked. Package inspection confirms 35 files, retained asset licenses and no host patches, private profiles or legacy full-frame assets.

## Motion measurement

`npm run measure:motion` runs the stock clock and renderer against a model-free fixture. Renderer log timestamps count completed terminal paint buffers; the moving interval is 3.0–5.6 seconds. Results are stored in `evidence/motion-before.json` and `evidence/motion-after.json`.

| Viewport | 0.3.0 moving output | 0.4.0 moving output | 0.4.0 median clock interval |
| --- | --- | --- | --- |
| 120×36 | 18.37 fps | 58.71 fps | 16.74ms |
| 180×54 | 18.07 fps | 57.94 fps | 16.75ms |

The old 50ms subscription sometimes waited four host ticks (approximately 66ms). Native geometry now follows 16ms updates without 50ms time quantization. Static holds produce no redundant paint buffers.

## Boundaries

These rates measure software clock and terminal output cadence, not optical display refresh. Slow terminals, remote connections and load can lower frame rate. Screenshots in `evidence/adaptive-stock-host-{opening,red-sweep,red-panels}.png` rasterize captured ANSI cells; they are not browser mockups or direct OS screenshots. Native landing-page captures and local terminal logs are excluded from the public repository.

Ordinary terminals may not expose physical cell metrics through stock 0.14.0. The plugin uses measured values when available, a height/width fallback of 2 otherwise, and optional `cellAspect` calibration. Detail remains limited by character count and font rendering. Real Kitty/Sixel placement is delegated to the host and has not been verified on a graphics terminal here.

Native conversation block reveal remains unavailable through the original public scene API. Startup panel masks exit within a replacement scene, then the native UI returns.
