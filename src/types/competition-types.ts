// Combined strict app types and Lenex (loose) types for competition data

// --- Strict App Types ---
export interface Entry {
  eventid: string;
  heatid: string;
  entrytime: string;
  lane: number;
}

export interface Athlete {
  athleteid: string;
  firstname: string;
  lastname: string;
  birthdate: string;
  entries: Entry[];
}

export interface Club {
  name: string;
  athletes: Athlete[];
  relays?: Relay[];
}

export interface RelayPosition {
  athleteid: string;
}

export interface RelayEntry {
  eventid: string;
  heatid: string;
  entrytime: string;
  lane: number;
  relaypositions: RelayPosition[];
}

export interface Relay {
  relayid: string;
  entries: RelayEntry[];
}

export interface Heat {
  heatid: string;
  number: number;
  order: number;
  daytime?: string;
}

export interface SwimStyle {
  relaycount: number;
  stroke: string;
  distance: number;
}

export interface Event {
  number: number;
  order: number;
  eventid: string;
  gender: string;
  swimstyle: SwimStyle;
  heats: Heat[];
}

export interface Session {
  date: string;
  events: Event[];
}

export interface Meet {
  name: string;
  sessions: Session[];
  clubs: Club[];
}

export interface CompetitionData {
  meets: Meet[];
}

// --- Lenex (Loose) Types ---
export interface LenexRelayPosition { athleteid?: string }
export interface LenexRelayEntry {
  eventid?: string | number;
  heatid?: string | number;
  entrytime?: string;
  lane?: number;
  relaypositions?: LenexRelayPosition[];
}
export interface LenexRelay { relayid?: string; entries?: LenexRelayEntry[] }
export interface LenexEntry {
  eventid?: string | number;
  heatid?: string | number;
  entrytime?: string;
  lane?: number;
}
export interface LenexAthlete {
  athleteid?: string;
  firstname?: string;
  lastname?: string;
  birthdate?: string;
  entries?: LenexEntry[];
}
export interface LenexClub {
  name?: string;
  athletes?: LenexAthlete[];
  relays?: LenexRelay[];
}
export interface LenexHeat {
  heatid?: string;
  number?: number;
  order?: number;
  daytime?: string;
}
export interface LenexSwimStyle { relaycount?: number; stroke?: string; distance?: number }
export interface LenexEvent {
  number?: number;
  order?: number;
  eventid?: string | number;
  gender?: string;
  swimstyle?: LenexSwimStyle;
  heats?: LenexHeat[];
}
export interface LenexSession {
  date?: string;
  events?: LenexEvent[];
}
export interface LenexMeet {
  name?: string;
  sessions?: LenexSession[];
  clubs?: LenexClub[];
}
export interface LenexRoot { meets?: LenexMeet[] }
