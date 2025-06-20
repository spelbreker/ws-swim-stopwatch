export interface AthleteResult {
  lane: number;
  entrytime: string;
  club: string;
  athletes: {
    athleteid: number;
    firstname: string;
    lastname: string;
    birthdate: string;
  }[];
}

export interface RelayResult {
  lane: number;
  entrytime: string;
  club: string;
  relayid: string;
  athletes: {
    athleteid: number;
    firstname: string;
    lastname: string;
  }[];
}
