export interface Category {
  id: string      // slug — stored as the `category` value on materials (e.g. 'glassware')
  name: string    // display name
  emoji: string   // optional emoji prefix; empty string means none
  order: number   // ascending sort order
}
