import {
  LenexRaw,
  Meet as LenexMeet,
  Session as LenexSession,
  Event as LenexEvent,
  Heat as LenexHeat,
  _Club,
  MeetAthlete as LenexAthlete,
  Entry as LenexEntry,
  MeetRelay as LenexRelay,
  MeetRelayPosition as LenexRelayPosition,
  Swimstyle as LenexSwimStyle,
  Gender,
  Course,
  Nation,
  Stroke,
} from 'js-lenex/build/src/lenex-type';

// Re-export Lenex enums for use in the application
export {
  Gender,
  Course,
  Nation,
  Stroke,
};

// Type alias for _Club to maintain backwards compatibility
export type LenexClub = _Club;

/**
 * Our application's core types with strict requirements.
 * Each type includes an 'original' field to access the full Lenex data when needed.
 */

// CompetitionData represents the root structure of our application
export interface CompetitionData {
  meets: CompetitionMeet[];
  original?: LenexRaw;
}

// CompetitionMeet with required fields for our application
export interface CompetitionMeet {
  name: string;
  sessions: CompetitionSession[];
  clubs: CompetitionClub[];
  city?: string;
  nation?: Nation;
  original?: LenexMeet;
}

// CompetitionSession with required fields
export interface CompetitionSession {
  date: string;
  events: CompetitionEvent[];
  original?: LenexSession;
}

// CompetitionEvent with required fields and original data
export interface CompetitionEvent {
  number: number;
  order: number;
  eventid: string;
  gender: Gender;
  swimstyle: CompetitionSwimStyle;
  heats: CompetitionHeat[];
  original?: LenexEvent;
}

// CompetitionSwimStyle with required fields
export interface CompetitionSwimStyle {
  relaycount: number;
  stroke: Stroke;
  distance: number;
  original?: LenexSwimStyle;
}

// CompetitionHeat with required fields
export interface CompetitionHeat {
  heatid: string;
  number: number;
  order: number;
  daytime?: string;
  original?: LenexHeat;
}

// CompetitionClub with required fields
export interface CompetitionClub {
  name: string;
  athletes: CompetitionAthlete[];
  relays?: CompetitionRelay[];
  original?: _Club;
}

// CompetitionAthlete with required fields
export interface CompetitionAthlete {
  athleteid: number;
  firstname: string;
  lastname: string;
  birthdate: string;
  entries: CompetitionEntry[];
  gender: Gender;
  original?: LenexAthlete;
}

// CompetitionEntry with required fields
export interface CompetitionEntry {
  eventid: string;
  heatid: string;
  entrytime: string;
  lane: number;
  original?: LenexEntry;
}

// CompetitionRelay with required fields
export interface CompetitionRelay {
  relayid: string;
  entries: CompetitionRelayEntry[];
  original?: LenexRelay;
}

// CompetitionRelayEntry with required fields
export interface CompetitionRelayEntry extends CompetitionEntry {
  relaypositions: CompetitionRelayPosition[];
  original?: LenexEntry;
}

// CompetitionRelayPosition with required fields
export interface CompetitionRelayPosition {
  athleteid: number;
  original?: LenexRelayPosition;
}

// Type aliases for external use
export type {
  LenexRaw as LenexRoot,
  LenexMeet,
  LenexSession,
  LenexEvent,
  LenexHeat,
  LenexAthlete,
  LenexEntry,
  LenexRelay,
  LenexRelayPosition,
  LenexSwimStyle,
};
