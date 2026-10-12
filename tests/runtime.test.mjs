import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Timeline } from '../dist/timeline.js'
import { fullViewport } from '../dist/viewport.js'
import { cellFrame } from '../dist/cells.js'
import { openingLayout, resolveCellAspect } from '../dist/geometry.js'
import { loadLogo } from '../dist/image.js'

const plain = line => line.replace(/\x1b\[[0-9;]*m/g, '')

test('native opening keeps readable text and exact cell bounds at every viewport and aspect', () => {
  for (const [cols, rows] of [[1, 1], [16, 8], [48, 20], [80, 24], [120, 36], [180, 54], [150, 20], [48, 44]]) {
    for (const aspect of [1.5, 2, 2.4, 3]) for (const ms of [0, 1300, 2200, 3000, 5000, 6000, 7300, 8000, 8600, 9000, 9400]) {
      const frame = cellFrame(ms, cols, rows, false, { aspect })
      assert.equal(frame.lines.length, rows)
      assert.ok(frame.lines.every(line => plain(line).length === cols), 'each row has exactly the requested cell count')
      assert.ok(!/[\u2800-\u28ff]/u.test(frame.lines.join('')), 'no sampled Braille')
      if (ms < 6730 && cols >= 20 && rows >= 20) {
        assert.equal(frame.lines.map(plain).join('\n').split('DEEPSEEK HARNESS').length - 1, 1)
        assert.ok(frame.lines.some(line => plain(line).includes('INTO THE UNKNOWN')))
      }
    }
  }
})

test('opening sweep covers the complete viewport and retreats in separate panels', () => {
  for (const [cols, rows] of [[48, 20], [80, 24], [120, 36], [180, 54]]) {
    const frame = cellFrame(8600, cols, rows)
    assert.ok(frame.lines.every(line => line === '\x1b[22;38;2;255;0;60;48;2;255;0;60m' + ' '.repeat(cols) + '\x1b[0m'))
    const exit = cellFrame(8900, cols, rows).lines.join('')
    assert.ok(exit.includes('255;0;60') && exit.includes('0;0;0'))
    assert.ok(cellFrame(9400, cols, rows).lines.every(line => !line.includes('255;0;60')))
  }
})

test('reduced motion uses a static native label without a red sweep', () => {
  const initial = cellFrame(0, 48, 20, true)
  assert.deepEqual(cellFrame(9000, 48, 20, true), initial)
  assert.ok(initial.lines.some(line => plain(line).includes('INTO THE UNKNOWN')))
  assert.ok(initial.lines.every(line => !line.includes('255;0;60')))
})

test('geometry prefers calibration, then measured cells, then the portable fallback', () => {
  assert.equal(resolveCellAspect(), 2)
  assert.equal(resolveCellAspect(0, { width: 9, height: 20 }), 20 / 9)
  assert.equal(resolveCellAspect(1.8, { width: 9, height: 20 }), 1.8)
  for (const size of [{ width: 0, height: 20 }, { width: 10, height: 0 }, { width: NaN, height: 20 }, { width: 1, height: 200 }]) {
    assert.equal(resolveCellAspect(0, size), 2)
  }
  const compact = openingLayout(120, 36, 2), wide = openingLayout(240, 36, 2)
  assert.equal(compact.width, wide.width, 'extra horizontal space does not stretch the central mark')
  assert.equal(compact.height, wide.height)
  assert.equal(wide.left - compact.left, 60, 'central mark remains centered')
})

test('full-screen geometry compensates public margins without changing preferences', () => {
  assert.deepEqual(fullViewport({ columns: 116, rows: 34, screenRows: 36 }, 'normal'), { columns: 120, rows: 36, x: 2, y: 1 })
  assert.deepEqual(fullViewport({ columns: 72, rows: 20, screenRows: 24 }, 'roomy'), { columns: 80, rows: 24, x: 4, y: 2 })
  assert.deepEqual(fullViewport({ columns: 74, rows: 22 }, '3x1'), { columns: 80, rows: 24, x: 3, y: 1 })
  assert.deepEqual(fullViewport({ columns: 80, rows: 24 }, 'none'), { columns: 80, rows: 24, x: 0, y: 0 })
})

test('shared clock pauses and resumes without counting unsubscribed time', () => {
  const time = new Timeline()
  assert.equal(time.read(90000, false), 0)
  assert.equal(time.read(90000, true), 0)
  assert.equal(time.read(90050, true), 0)
  assert.equal(time.read(90100, true), 50)
  assert.equal(time.read(90100, false), 50)
  assert.equal(time.read(90100, true), 50)
  assert.equal(time.read(150000, true), 50)
  assert.equal(time.read(150050, true), 100)
})

test('optional central artwork decodes once, with transparent margins and Acid Rain pixels', async () => {
  const first = loadLogo(), second = loadLogo()
  assert.equal(first, second)
  const image = await first
  assert.equal(image.width, 256)
  assert.equal(image.data.length, 256 * 256 * 4)
  assert.equal(image.data[3], 0)
  let solid = 0
  for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3] === 255) {
    assert.deepEqual([...image.data.subarray(i, i + 3)], [215, 255, 0])
    solid++
  }
  assert.ok(solid > 10000)
})
