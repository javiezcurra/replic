export interface Discipline {
  id: string      // slug — stored as the `discipline` value on designs
  name: string    // display name
  emoji: string   // optional emoji prefix; empty string means none
  order: number   // ascending sort order
}
