import { contextFor } from "../lib/harness";
import { liveSources } from "../../src/server/sources/index";
const run = async () => {
  const res = await contextFor("residence");
  const leases = (await liveSources["residence.leases"].list(res)) as any[];
  for (const l of leases.slice(0, 30)) console.log("lease", l.id, l.status, JSON.stringify(l.filing), l.record?.filingSample);
  const units = (await liveSources["residence.units"].list(res)) as any[];
  for (const u of units) if (/filing|amend|signed|Renewal/i.test(u.note)) console.log("unit", u.id, u.note);
  for (const name of ["residence.homeKpis", "residence.attention", "residence.accepted", "residence.payouts"]) {
    if (!liveSources[name]) { console.log("no source", name); continue; }
    const docs = (await liveSources[name].list(res)) as any[];
    for (const d of docs) console.log(name, JSON.stringify(d).slice(0, 220));
  }
  const pub = await contextFor("guest");
  const props = (await liveSources["market.properties"].list(pub)) as any[];
  for (const p of props) console.log("prop", p.id, p.name, JSON.stringify(p.business).slice(0, 200));
  const sup = await contextFor("supervisor");
  const rooms = (await liveSources["staff.inspectionRooms"].list(sup)) as any[];
  for (const r of rooms) console.log("insp", r.no, r.type, r.task);
};
run().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
