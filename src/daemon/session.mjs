import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { STATE } from '../shared/protocol.mjs'
import { NotificationQueue } from './notificationQueue.mjs'

/**
 * A single Pomodoro session with its own timer and notification queue.
 */
export class Session extends EventEmitter {
  id
  projectDir
  projectHash
  task
  plannedMs
  decisionStrategy
  startedAt

  #state = STATE.RUNNING
  #overtimeAt = null
  #interval = null
  #queue = new NotificationQueue()

  constructor({ projectDir, projectHash, task, plannedMs, decisionStrategy }) {
    super()
    this.id = randomUUID()
    this.projectDir = projectDir
    this.projectHash = projectHash
    this.task = task
    this.plannedMs = plannedMs
    this.decisionStrategy = decisionStrategy
    this.startedAt = Date.now()

    this.#interval = setInterval(() => this.#tick(), 1000)
    this.#tick()
  }

  get state() { return this.#state }

  get remaining() {
    if (this.#state === STATE.OVERTIME || this.#state === STATE.ENDED) return 0
    return Math.max(0, this.plannedMs - (Date.now() - this.startedAt))
  }

  get overtime() {
    if (!this.#overtimeAt) return 0
    return Date.now() - this.#overtimeAt
  }

  get actualMs() {
    return Date.now() - this.startedAt
  }

  get queueSize() {
    return this.#queue.size
  }

  snapshot() {
    return {
      sessionId: this.id,
      projectDir: this.projectDir,
      projectHash: this.projectHash,
      task: this.task,
      plannedMs: this.plannedMs,
      state: this.#state,
      remaining: this.remaining,
      overtime: this.overtime,
      queuedNotifications: this.#queue.size,
      startedAt: this.startedAt,
    }
  }

  enqueueNotification(notification) {
    this.#queue.enqueue(notification)
  }

  flushNotifications(onItem) {
    this.#queue.onFlush(onItem)
    this.#queue.flush()
  }

  /** User pressed [E] End Session */
  end() { this.#finish('completed') }

  /** User pressed [B] Break */
  break() { this.#finish('broken') }

  #tick() {
    if (this.#state === STATE.RUNNING && this.remaining === 0) {
      this.#state = STATE.OVERTIME
      this.#overtimeAt = Date.now()
      this.emit('overtime')
    }
    if (this.#state !== STATE.ENDED) {
      this.emit('tick', {
        sessionId: this.id,
        state: this.#state,
        remaining: this.remaining,
        overtime: this.overtime,
        queuedNotifications: this.#queue.size,
      })
    }
  }

  #finish(status) {
    if (this.#state === STATE.ENDED) return
    clearInterval(this.#interval)
    this.#state = STATE.ENDED
    this.emit('ended', { sessionId: this.id, status, actualMs: this.actualMs })
  }
}
