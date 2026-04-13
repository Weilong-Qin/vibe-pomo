/**
 * IPC message type constants and builders.
 * All messages are newline-delimited JSON over Unix domain socket.
 */

// Client → Daemon
export const MSG = {
  QUERY:               'query',          // get daemon state + all sessions
  SESSION_QUERY:       'sessionQuery',   // get single session state
  SESSION_CREATE:      'sessionCreate',  // start a new session
  SESSION_END:         'sessionEnd',     // user ends session (End button)
  SESSION_BREAK:       'sessionBreak',   // user breaks session (Break button)
  AGENT_STOPPING:      'agentStopping',  // stop hook: agent finished
  QUEUE_NOTIFICATION:  'queueNotification',
  SUBSCRIBE:                'subscribe',
  SUBSCRIBE_SESSION:        'subscribeSession',
  SESSION_UPDATE_ACTIVITY:  'sessionUpdateActivity', // save user's own activity note
}

// Daemon → Client (push)
export const EVT = {
  TICK:         'tick',          // { sessionId, state, remaining, overtime }
  NOTIFICATION: 'notification',  // { sessionId, notification, receivedAt, releasedAt }
  SESSION_ENDED:'sessionEnded',  // { sessionId, status, actualMs }
  SNAPSHOT:     'snapshot',      // full daemon state (on subscribe)
}

// Timer states
export const STATE = {
  IDLE:     'idle',
  RUNNING:  'running',
  OVERTIME: 'overtime',
  ENDED:    'ended',
}

// Decision strategies
export const DECISION = {
  WAIT:  'wait',   // block agent silently until user ends session
  BREAK: 'break',  // immediately end session
}

export function encode(obj) {
  return JSON.stringify(obj) + '\n'
}
