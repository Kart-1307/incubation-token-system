import { EventEmitter } from 'events';

export interface TerminalEventPayload {
  type: 'TOKEN_ISSUED' | 'DUPLICATE' | 'NOT_FOUND' | 'INELIGIBLE' | 'ERROR';
  studentId: string;
  studentName?: string;
  department?: string;
  project?: string;
  tokenNumber?: string;
  session?: string;
  date?: string;
  time?: string;
  message: string;
  timestamp: string;
}

// In-memory global event emitter singleton to survive HMR in dev
const globalWithEmitter = globalThis as unknown as {
  _terminalEmitter?: EventEmitter;
};

if (!globalWithEmitter._terminalEmitter) {
  globalWithEmitter._terminalEmitter = new EventEmitter();
  globalWithEmitter._terminalEmitter.setMaxListeners(100);
}

export const terminalEmitter = globalWithEmitter._terminalEmitter;

export function broadcastTerminalEvent(payload: TerminalEventPayload) {
  terminalEmitter.emit('scan_event', payload);
}

export function subscribeTerminalEvents(callback: (payload: TerminalEventPayload) => void) {
  terminalEmitter.on('scan_event', callback);
  return () => {
    terminalEmitter.off('scan_event', callback);
  };
}
