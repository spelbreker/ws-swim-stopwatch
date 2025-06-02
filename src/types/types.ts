// Types for competition data structures

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
