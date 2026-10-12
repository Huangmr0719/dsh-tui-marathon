# Sources and credits

The native renderer uses terminal text and integer geometry. Both axes of the central mark share one physical scale; no full-screen video frames are shipped.

- `assets/deepseek.svg`: the favicon from `apps/web/public/favicon.svg` in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), copied unchanged. Its MIT license is retained in `LICENSE-DeepSeek`. `src/artwork.ts` contains flattened path contours; `assets/logo.rgba.gz` is a recolored, transparent 256×256 raster used only by optional host-image rendering.
- `assets/blue-pixel.png`: unchanged from [ALPDM00/dsh-theme-mls-desktop](https://github.com/ALPDM00/dsh-theme-mls-desktop/blob/main/assets/boot/blue-pixel.png). Its MIT license is retained in `LICENSE-reference`. `src/artwork.ts` contains its nearest-neighbor 64×64 binary sprite.
- Maze geometry and panel timing follow the locally approved prototype and credited desktop reference. Motion direction also references the user's local demonstration and 00:30–01:00 of [the Marathon gameplay video](https://www.bilibili.com/video/BV14FfEBGE5V/). The plugin includes no video footage, audio or Maratype font files.

Original file identifiers and SHA-256 hashes are in `assets/SOURCE.json`. DeepSeek and Marathon branding remains attributed to its respective owners.

Regenerate constants and the optional logo with `node scripts/build-cell-assets.cjs` after making `@napi-rs/canvas` available, or pass its module path as the first argument. Runtime rendering requires no native image dependency. The original SVG and pixel source are included; regeneration does not depend on the separate design-kit directory.

The stock host is [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI). Runtime components use its injected React and public UI; the plugin bundles no second React or host source.
