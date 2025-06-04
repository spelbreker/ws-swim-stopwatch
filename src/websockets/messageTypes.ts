// Type-safe WebSocket message definition for all frontend/backend communication
export type Message =
  | { type: 'ping'; time: number }
  | { type: 'pong'; time: number }
  | { type: 'start'; time?: number }
  | { type: 'reset' }
  | { type: 'split'; lane: number; time: string }
  | { type: 'event-heat'; event: number | string; heat: number | string }
  | { type: 'clear' }
  | { type: 'add-interval'; newInterval: any }
  | { type: 'start-interval'; uid: string; interval: any }
  | { type: 'delete-interval'; uid: string }
  | { type: string; [key: string]: unknown };
