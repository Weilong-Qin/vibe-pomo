import { EventEmitter } from 'node:events'
import { STATE } from '../shared/protocol.mjs'

/**
 * Timer state machine:
 *   idle → running → overtime → ended
 *
 * Transitions:
 *   start()  : idle → running
 *   (tick)   : running → overtime when remaining hits 0
 *   end()    : running|overtime → ended (user-initiated)
 *   break()  : running|overtime → ended (user pressed Break)
 *
 * Events emitted:
 *   'tick'     { state, remaining, overtime }  — every second
 *   'overtime' {}                              — first tick at 0
 *   'ended'    { status }                     — final state
 */
export class Timer extends EventEmitter {
  #state = STATE.IDLE
  #plannedMs
  #startedAt = null
  #overtimeAt = null
  #interval = null

  constructor(plannedMs) {
    super()
    this.#plannedMs = plannedMs
  }

  get state() { return this.#state }
  get startedAt() { return this.#startedAt }

  get remaining() {
    if (!this.#startedAt) return this.#plannedMs
    if (this.#state === STATE.OVERTIME || this.#state === STATE.ENDED) return 0
    const elapsed = Date.now() - this.#startedAt
    return Math.max(0, this.#plannedMs - elapsed)
  }

  get overtime() {
    if (!this.#overtimeAt) return 0
    return Date.now() - this.#overtimeAt
  }

  get actualMs() {
    if (!this.#startedAt) return 0
    return Date.now() - this.#startedAt
  }

  snapshot() {
    return {
      state: this.#state,
      remaining: this.remaining,
      overtime: this.overtime,
      plannedMs: this.#plannedMs,
      startedAt: this.#startedAt,
    }
  }

  start() {
    if (this.#state !== STATE.IDLE) return
    this.#state = STATE.RUNNING
    this.#startedAt = Date.now()
    this.#interval = setInterval(() => this.#tick(), 1000)
    this.#tick() // immediate first tick
  }

  /** User-initiated end (End Session button) */
  end() {
    this.#finish('completed')
  }

  /** User-initiated break (Break button) */
  break() {
    this.#finish('broken')
  }

  #tick() {
    if (this.#state === STATE.RUNNING && this.remaining === 0) {
      this.#state = STATE.OVERTIME
      this.#overtimeAt = Date.now()
      this.emit('overtime')
    }

    this.emit('tick', {
      state: this.#state,
      remaining: this.remaining,
      overtime: this.overtime,
    })
  }

  #finish(status) {
    if (this.#state === STATE.ENDED) return
    clearInterval(this.#interval)
    this.#interval = null
    this.#state = STATE.ENDED
    this.emit('ended', { status, actualMs: this.actualMs })
  }
}
