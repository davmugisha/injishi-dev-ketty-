/**
 * Where each of Rwanda's 30 districts is, roughly (its centre), for the homes map when a building has no
 * map point of its own: the home then sits on its district, drawn as an area, never as an address.
 */
export const DISTRICT_CENTRE: Readonly<Record<string, { lat: number; lng: number }>> = {
  Gasabo: { lat: -1.88, lng: 30.13 },
  Kicukiro: { lat: -1.99, lng: 30.12 },
  Nyarugenge: { lat: -1.96, lng: 30.04 },
  Burera: { lat: -1.47, lng: 29.83 },
  Gakenke: { lat: -1.7, lng: 29.78 },
  Gicumbi: { lat: -1.58, lng: 30.07 },
  Musanze: { lat: -1.5, lng: 29.6 },
  Rulindo: { lat: -1.73, lng: 30.02 },
  Gisagara: { lat: -2.6, lng: 29.84 },
  Huye: { lat: -2.6, lng: 29.74 },
  Kamonyi: { lat: -2.0, lng: 29.9 },
  Muhanga: { lat: -2.08, lng: 29.75 },
  Nyamagabe: { lat: -2.47, lng: 29.47 },
  Nyanza: { lat: -2.35, lng: 29.75 },
  Nyaruguru: { lat: -2.67, lng: 29.5 },
  Ruhango: { lat: -2.22, lng: 29.78 },
  Bugesera: { lat: -2.23, lng: 30.15 },
  Gatsibo: { lat: -1.58, lng: 30.43 },
  Kayonza: { lat: -1.9, lng: 30.5 },
  Kirehe: { lat: -2.27, lng: 30.65 },
  Ngoma: { lat: -2.17, lng: 30.47 },
  Nyagatare: { lat: -1.3, lng: 30.33 },
  Rwamagana: { lat: -1.95, lng: 30.43 },
  Karongi: { lat: -2.07, lng: 29.4 },
  Ngororero: { lat: -1.87, lng: 29.55 },
  Nyabihu: { lat: -1.65, lng: 29.5 },
  Nyamasheke: { lat: -2.33, lng: 29.1 },
  Rubavu: { lat: -1.68, lng: 29.33 },
  Rusizi: { lat: -2.5, lng: 29.0 },
  Rutsiro: { lat: -1.93, lng: 29.33 },
};

/** A district's centre by its name, whatever its case ("GASABO", "Gasabo"). */
export function districtCentre(name: string | null): { lat: number; lng: number } | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  const hit = Object.entries(DISTRICT_CENTRE).find(([n]) => n.toLowerCase() === key);
  return hit ? hit[1] : null;
}
