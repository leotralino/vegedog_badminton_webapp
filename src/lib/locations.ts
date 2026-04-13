export interface PresetLocation {
  name:    string
  address: string
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  { name: 'CBA (Synergy Mission)',  address: '46049 Warm Springs Blvd, Fremont, CA 94539' },
  { name: 'Synergy Menlo Park',     address: '190 Constitution Dr, Menlo Park, CA 94025' },
  { name: 'Happy Birdie Fremont',   address: '43921 Boscell Rd, Fremont, CA 94538' },
  { name: 'Canam',                  address: '691 Race St, San Jose, CA 95126' },
]

/** Return the address for a named preset, or null if not found */
export function presetAddress(name: string): string | null {
  return PRESET_LOCATIONS.find(p => p.name === name)?.address ?? null
}
