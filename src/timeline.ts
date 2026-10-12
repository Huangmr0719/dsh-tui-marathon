/** The host clock can jump while unsubscribed; discard that gap on resume. */
export class Timeline {
  private active = false
  private waiting: number | undefined
  private previous = 0
  private elapsed = 0

  read(clock: number, active: boolean): number {
    if (!active) { this.active = false; return this.elapsed }
    if (!this.active) {
      this.active = true
      this.waiting = clock
      return this.elapsed
    }
    if (this.waiting !== undefined) {
      if (clock === this.waiting) return this.elapsed
      this.waiting = undefined
      this.previous = clock
      return this.elapsed
    }
    this.elapsed += Math.max(0, clock - this.previous)
    this.previous = clock
    return this.elapsed
  }
}
