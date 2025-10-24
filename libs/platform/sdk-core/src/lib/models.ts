import { Temporal } from '@js-temporal/polyfill';
import { ISODateTimeString } from './types';

// --- RICH DOMAIN MODELS (for use in the application) ---

export interface Location {
  id: string;
  name: string;
  category: string;
  createdAt: Temporal.Instant;
}

export interface Person {
  id: string;
  name: string;
  createdAt: Temporal.Instant;
}

export interface Meta {
  version: number;
  createdAt: Temporal.Instant;
}

export interface Intention {
  id: string;
  user: string;
  action: string;
  targets: any[]; // Assuming Target type is defined elsewhere
  startTime: Temporal.Instant;
  endTime: Temporal.Instant;
  createdAt: Temporal.Instant;
}

export interface User {
  id: string;
  name: string;
}

export interface ApplicationState {
  locations: Location[];
  people: Person[];
  intentions: Intention[];
  user: User;
  meta: Meta;
}


// --- RAW DATA TRANSFER OBJECTS (for serialization) ---

export interface RawLocation {
  id: string;
  name: string;
  category: string;
  createdAt: ISODateTimeString;
}

export interface RawPerson {
  id: string;
  name: string;
  createdAt: ISODateTimeString;
}

export interface RawMeta {
  version: number;
  createdAt: ISODateTimeString;
}

export interface RawIntention {
  id: string;
  user: string;
  action: string;
  targets: any[];
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  createdAt: ISODateTimeString;
}

export interface RawApplicationState {
  locations: RawLocation[];
  people: RawPerson[];
  intentions: RawIntention[];
  user: User; // User object is simple, no date fields to transform
  meta: RawMeta;
}
