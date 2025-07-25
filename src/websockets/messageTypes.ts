// Type-safe WebSocket message definition for all frontend/backend communication
export type Message =
  | { type: 'ping'; time: number }
  | { type: 'pong'; client_ping_time: number; server_time: number }
  | { type: 'start'; timestamp: number; event?: number | string; heat?: number | string }
  | { type: 'reset'; timestamp: number }
  | { type: 'stop'; timestamp: number }
  | { type: 'split'; lane: number; time: string }
  | { type: 'split'; lane: number; timestamp: string }
  | { type: 'event-heat'; event: number | string; heat: number | string; session?: number | string }
  | { type: 'select-event'; event: number | string; heat: number | string; session?: number | string }
  | { type: 'clear' }
  | { type: 'add-interval'; newInterval: unknown }
  | { type: 'start-interval'; uid: string; interval: unknown }
  | { type: 'delete-interval'; uid: string }
  | { type: 'time_sync'; server_time: number }
  | { type: string; [key: string]: unknown };
