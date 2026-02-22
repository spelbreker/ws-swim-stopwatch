import type WebSocket from 'ws';

// Competition & device message types (matches swimwatch-hardware protocol)
export type Message =
  | { type: 'ping'; time: number }
  | { type: 'pong'; client_ping_time: number; server_time: number }
  | { type: 'start'; timestamp: number; timestamp_us?: number; event?: number | string; heat?: number | string }
  | { type: 'reset'; timestamp: number }
  | { type: 'split'; lane: number; elapsed_ms: number; timestamp: number }
  | { type: 'event-heat'; event: number | string; heat: number | string; session?: number | string }
  | { type: 'clear' }
  | { type: 'time_sync'; server_time: number }
  | { type: 'device_register'; ip: string; mac: string; role: 'starter' | 'lane'; lane?: number }
  | { type: 'device_update_role'; mac: string; role: 'starter' | 'lane' }
  | { type: 'device_update_lane'; mac: string; lane: number }
  | { type: string; [key: string]: unknown };

// Training interval message types (separate concern from competition)
export type TrainingMessage =
  | { type: 'add-interval'; newInterval: unknown }
  | { type: 'start-interval'; uid: string; interval: unknown }
  | { type: 'delete-interval'; uid: string };

// Combined type for WebSocket message parsing
export type WebSocketMessage = Message | TrainingMessage;

// Device information interface
export interface DeviceInfo {
  mac: string;
  ip: string;
  role: 'starter' | 'lane';
  lane?: number;
  connected: boolean;
  lastSeen: number;
  ws?: WebSocket;
}

// Device information for API responses (without WebSocket)
export interface DeviceInfoResponse {
  mac: string;
  ip: string;
  role: 'starter' | 'lane';
  lane?: number;
  connected: boolean;
  lastSeen: number;
}
