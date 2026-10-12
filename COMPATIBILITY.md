# 原版插件接口核对

基线：`@deepseek-harness-tui/dsh-tui` 0.14.0，Git `1d832df3f97e828b1aaea8376657d6b6ecf30b86`，Harness CLI 0.2.0-rc.2。

| 要求 | 原版接口 | 结论 |
| --- | --- | --- |
| 配色 | `tuiThemes.register`、场景注入的 `ui.useTheme` | 可注册、选择与保存主题 |
| 原生标题酸雨黄 | 主题 `accent` / `activity` | 使用 `rgb(...)`，兼容宿主渐变解析 |
| 原生像素鲸鱼换色 | `Whale.tsx` 内固定 RGB 调色板 | 无公开换色接口；通过 `channel.setWhale(false)` 隐藏，卸载恢复 |
| 全屏开场、红扫 | `tuiScenes.register/open`、宿主 `React` / `ui` | 可实现，插件必须自行填满画布 |
| 按块退出动画 | 场景内 `Box` / `Image` 与动画时钟 | 可实现动画图形的遮罩变化 |
| 逐块露出原生对话 | 没有 scene overlay / native view slot | 当前公开接口不能实现 |
| 状态组件替代覆盖层 | `tuiStatus.registerView` | 最多三行且裁切，不能全屏 |
| 托管对话框替代覆盖层 | `tuiDialogs` | 确认、选择、输入请求；没有任意 React 覆盖层 |
| 控制入口 | `tuiShortcuts.register` | 只使用 Alt+M 重播开场，不依赖命令准入 |
| 字符格比例 | `ui.useTerminalImageCellSize` / `useTerminalImages` | 优先读取测量值；缺失时通用回退，可选校准 |
| 动画时钟 | `ui.useAnimationFrame` | 使用宿主 16ms 更新，取消 50ms 整帧采样 |

源码证据：

- [`TuiSceneDescriptor` / `TuiSceneProps`](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/dsh-adapter/scenes.ts)：只接收场景组件、channel 与 close，没有原对话子树。
- [`Chat.tsx` 第 5879–5892 行](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/screens/Chat.tsx#L5879-L5892)：场景打开后 early return，原对话子树不在该帧中。
- [`PageMargin.tsx`](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/components/PageMargin.tsx#L81-L87)：传给插件的尺寸扣除了页边距。插件通过公开的 `channel.pageMargin` 与 `screenRows` 补偿位置和尺寸，未修改用户边距设置。
- [`status.ts`](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/dsh-adapter/status.ts)、[`dialogs.ts`](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/dsh-adapter/dialogs.ts)：状态视图有高度上限，对话框没有自定义组件入口。
- [`Whale.tsx`](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/components/Whale.tsx)：像素鲸鱼调色板固定，未读取主题；插件不替换该组件。
- [`spinnerUtils.ts`](https://github.com/ccch1mneyyy/dsh-TUI/blob/1d832df3f97e828b1aaea8376657d6b6ecf30b86/src/components/Spinner/spinnerUtils.ts)：`parseRGB` 只接受 `rgb(...)`，HEX / `ansi256(...)` 会使标题渐变回退到蓝色。256 主题的渐变入口也采用 RGB 表示。

## 跨终端边界

中心图形在物理坐标中等比缩放，外围几何分别按行列数铺满。`cells` 全程使用字符；`auto` 只将中心标识交给宿主 `Image`，不再缩放整屏位图。两种模式均不依赖额外 React、原生图形模块或插件自己的终端查询。

0.14.0 仅在图片能力探测成功时保存字符格测量；inline、部分终端、tmux/screen 和禁用图片时可能没有测量值。插件通过公开 `useTerminalImages` 请求探测，并使用 `useTerminalImageCellSize` 读取结果。没有值时回退到高宽比 2；`cellAspect` 可显式设置字符格高度 / 宽度。当前公开接口无法保证所有终端都自动得到精确比例。

0.4.0 已移除回合完成场景、监听和快捷键；旧配置中的 `completion: true` 不会重新启用动画。

判断：不修改宿主即可交付全屏外观插件；若要求真实对话持续挂载并在红扫下逐块出现，需要宿主将覆盖层能力公开。当前版本没有通过覆盖 stdout、修改宿主原型、私有模块导入或重绘对话绕过此边界。
