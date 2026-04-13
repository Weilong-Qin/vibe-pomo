/**
 * Holds notifications intercepted during a Pomodoro session.
 * Released all at once when the session enters overtime or ends.
 */
export class NotificationQueue {
  #queue = []
  #onFlush = null

  /** Register callback invoked with each notification when flushed */
  onFlush(cb) {
    this.#onFlush = cb
  }

  enqueue(notification) {
    this.#queue.push({
      notification,
      receivedAt: Date.now(),
    })
  }

  flush() {
    const items = [...this.#queue]
    this.#queue = []
    if (this.#onFlush) {
      for (const item of items) {
        this.#onFlush(item)
      }
    }
    return items
  }

  get size() {
    return this.#queue.length
  }

  toArray() {
    return [...this.#queue]
  }
}
