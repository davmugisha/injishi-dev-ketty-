import sharp from "sharp";
import { readdirSync } from "node:fs";
import path from "node:path";
const dir = "apps/web/public/assets/sourced";
const files = readdirSync(dir).filter(f=>/\.(jpe?g|png)$/i.test(f)).sort();
const W=300,H=200,COLS=4;
const perSheet=12;
for (let s=0; s*perSheet<files.length; s++){
  const batch=files.slice(s*perSheet,(s+1)*perSheet);
  const rows=Math.ceil(batch.length/COLS);
  const tiles=await Promise.all(batch.map(async(f,i)=>({
    input: await sharp(path.join(dir,f)).resize(W,H,{fit:"cover"}).jpeg().toBuffer(),
    left:(i%COLS)*W, top:Math.floor(i/COLS)*H
  })));
  await sharp({create:{width:W*COLS,height:H*rows,channels:3,background:"#fff"}})
    .composite(tiles).jpeg({quality:82}).toFile(`C:/Users/sshami/AppData/Local/Temp/claude/c--Users-sshami-Desktop-shami-ai-git-injishi/e448e40f-7bbf-4589-8481-492ef1e750e7/scratchpad/sheet-${s}.jpg`);
  console.log(`sheet-${s}: ` + batch.map((f,i)=>`${i+1}=${f.replace(/\.(jpe?g|png)$/,"")}`).join("  "));
}
