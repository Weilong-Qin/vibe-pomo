import { subscribe, sendAndReceive } from '../shared/ipcClient.mjs'
import { EVT } from '../shared/protocol.mjs'

/**
 * TUI-specific IPC client.
 * Connects to daemon, subscribes to push events, and emits them via callbacks.
 */
export class TuiIpcClient {
  #conn = null
  #socketPath

  constructor(socketPath) {
    this.#socketPath = socketPath
  }

  connect({ onTick, onNotification, onEnded, onError }) {
    this.#conn = subscribe(
      this.#socketPath,
      (event) => {
        switch (event.type) {
          case EVT.TICK:
          case EVT.STATE:
            onTick?.(event)
            break
          case EVT.NOTIFICATION:
            onNotification?.(event)
            break
          case EVT.ENDED:
            onEnded?.(event)
            break
        }
      },
      onError,
    )
  }

  async sendEnd() {
    try {
      await sendAndReceive(this.#socketPath, { type: 'end' })
    } catch {}
  }

  async sendBreak() {
    try {
      await sendAndReceive(this.#socketPath, { type: 'break' })
    } catch {}
  }

  close() {
    this.#conn?.close()
  }
}
