import net from 'node:net'
import { encode } from './protocol.mjs'
import { getSocketPath } from './lockfile.mjs'

const DEFAULT_TIMEOUT_MS = 500

/**
 * Send one message, receive one JSON response.
 * Used by hook scripts and CLI commands.
 */
export function sendAndReceive(msgObj, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const socketPath = getSocketPath()
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath)
    let buffer = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('IPC timeout')) }
    }, timeoutMs)

    client.once('connect', () => client.write(encode(msgObj)))

    client.on('data', (chunk) => {
      buffer += chunk.toString()
      const newline = buffer.indexOf('\n')
      if (newline !== -1 && !settled) {
        settled = true
        clearTimeout(timer)
        client.destroy()
        try { resolve(JSON.parse(buffer.slice(0, newline))) }
        catch { reject(new Error('Invalid JSON response')) }
      }
    })

    client.on('error', (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(err) }
    })
  })
}

/**
 * Subscribe to daemon push events (for TUI clients).
 * Returns { send(msg), close() }.
 */
export function subscribe(onEvent, onError) {
  const socketPath = getSocketPath()
  const client = net.createConnection(socketPath)
  let buffer = ''

  client.once('connect', () => {
    client.write(encode({ type: 'subscribe' }))
  })

  client.on('data', (chunk) => {
    buffer += chunk.toString()
    let newline
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      try { onEvent(JSON.parse(line)) } catch {}
    }
  })

  client.on('error', (err) => { if (onError) onError(err) })
  client.on('close', () => { if (onError) onError(new Error('Connection closed')) })

  return {
    send(msgObj) { try { client.write(encode(msgObj)) } catch {} },
    close() { client.destroy() },
  }
}
