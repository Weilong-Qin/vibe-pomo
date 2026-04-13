import net from 'node:net'
import { existsSync, unlinkSync } from 'node:fs'
import { encode, EVT } from '../shared/protocol.mjs'

/**
 * Unix domain socket server for daemon IPC.
 * Handles message routing between hooks/TUI and the daemon.
 */
export class IpcServer {
  #server = null
  #subscribers = new Set()
  #handlers = {}

  /**
   * Register a handler for incoming message type.
   * Handler receives (parsedMsg, socket) and should return a response object or null.
   */
  on(type, handler) {
    this.#handlers[type] = handler
  }

  async listen(socketPath) {
    // Clean up stale socket file
    if (existsSync(socketPath)) {
      unlinkSync(socketPath)
    }

    return new Promise((resolve, reject) => {
      this.#server = net.createServer((socket) => {
        this.#handleConnection(socket)
      })

      this.#server.once('error', reject)
      this.#server.listen(socketPath, () => {
        this.#server.removeListener('error', reject)
        this.#server.on('error', (err) => {
          console.error('[ipc] server error:', err.message)
        })
        resolve()
      })
    })
  }

  #handleConnection(socket) {
    let buffer = ''

    socket.on('data', async (chunk) => {
      buffer += chunk.toString()
      let newline
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (!line) continue

        let msg
        try { msg = JSON.parse(line) } catch { continue }

        if (msg.type === 'subscribe') {
          this.#subscribers.add(socket)
          socket.once('close', () => this.#subscribers.delete(socket))
          // Send current state immediately on subscribe
          const handler = this.#handlers['query']
          if (handler) {
            const state = await handler(msg, socket)
            if (state) socket.write(encode({ type: EVT.STATE, ...state }))
          }
          continue
        }

        const handler = this.#handlers[msg.type]
        if (handler) {
          const response = await handler(msg, socket)
          if (response !== null && response !== undefined) {
            socket.write(encode(response))
          }
        }
      }
    })

    socket.on('error', () => {
      this.#subscribers.delete(socket)
    })
  }

  /** Broadcast an event to all subscribed clients (TUI) */
  broadcast(event) {
    const data = encode(event)
    for (const socket of this.#subscribers) {
      try { socket.write(data) } catch {}
    }
  }

  close() {
    this.#server?.close()
  }
}
