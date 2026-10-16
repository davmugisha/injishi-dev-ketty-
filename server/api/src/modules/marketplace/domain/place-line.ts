/** "Gisenyi, Rubavu": the sector, then the district. A sector named like its district is said once. */
export function placeLine(sector: string | null, district: string | null): string {
  if (sector && district && sector.toLowerCase() === district.toLowerCase()) return district;
  return [sector, district].filter(Boolean).join(', ');
}
