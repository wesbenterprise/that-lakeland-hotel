import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { parseMcKibbonPDF } from '../src/lib/pdf-parser';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qrryydgpujoumgotemfk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

const DOWNLOADS = '/Users/wrbopenclaw/Downloads';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY!);

  const allFiles = fs.readdirSync(DOWNLOADS)
    .filter(f => f.toLowerCase().includes('income statement') && f.endsWith('.pdf'))
    .sort();

  const groups: Record<string, string[]> = {};
  for (const f of allFiles) {
    const base = f.replace(/_\d+\.pdf$/, '.pdf');
    if (!groups[base]) groups[base] = [];
    groups[base].push(f);
  }

  const toLoad = Object.values(groups).map(g => g[g.length - 1]);
  console.log(`Found ${allFiles.length} PDFs → ${toLoad.length} unique after dedup\n`);

  let inserted = 0, failed = 0;
  const failures: string[] = [];

  for (const filename of toLoad.sort()) {
    const filePath = path.join(DOWNLOADS, filename);
    try {
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      const record = parseMcKibbonPDF(data.text, filename);
      if (!record) { console.log(`  ⚠️  ${filename} — parse returned null`); failed++; failures.push(filename); continue; }
      const { error } = await supabase.from('monthly_periods').upsert(record, { onConflict: 'period' });
      if (error) { console.log(`  ❌ ${filename} — ${error.message}`); failed++; failures.push(`${filename}: ${error.message}`); }
      else { console.log(`  ✅ ${record.period}  rev=$${((record.total_revenue||0)/100).toLocaleString()}  nop=$${((record.nop_hotel||0)/100).toLocaleString()}`); inserted++; }
    } catch (e: any) { console.log(`  ❌ ${filename} — ${e.message}`); failed++; failures.push(`${filename}: ${e.message}`); }
  }

  console.log(`\n✅ Inserted: ${inserted}  ❌ Failed: ${failed}`);
  if (failures.length) failures.forEach(f => console.log(`  ${f}`));
  const { data: rows } = await supabase.from('monthly_periods').select('period').order('period');
  if (rows?.length) console.log(`\nDB: ${rows.length} rows, ${rows[0].period} → ${rows[rows.length-1].period}`);
}
main().catch(console.error);
