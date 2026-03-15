import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { parseMcKibbonPDF } from '../src/lib/pdf-parser';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qrryydgpujoumgotemfk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycnl5ZGdwdWpvdW1nb3RlbWZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1NDA2MywiZXhwIjoyMDg5MTMwMDYzfQ._tTWB1eFqDAUwYtWsaDqTW1CsnTJ6qU_MmX_xiS2GRo';

const DOWNLOADS = '/Users/wrbopenclaw/Downloads';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Get all Income Statement PDFs, deduplicate by keeping highest-suffixed version per base name
  const allFiles = fs.readdirSync(DOWNLOADS)
    .filter(f => f.toLowerCase().includes('income statement') && f.endsWith('.pdf'))
    .sort();

  // Deduplicate: for each base name group, keep the last one (highest _N suffix = most recent download)
  const groups: Record<string, string[]> = {};
  for (const f of allFiles) {
    const base = f.replace(/_\d+\.pdf$/, '.pdf');
    if (!groups[base]) groups[base] = [];
    groups[base].push(f);
  }

  const toLoad = Object.values(groups).map(g => g[g.length - 1]); // last = highest suffix
  console.log(`Found ${allFiles.length} PDFs → ${toLoad.length} unique after dedup\n`);

  let inserted = 0, skipped = 0, failed = 0;
  const failures: string[] = [];

  for (const filename of toLoad.sort()) {
    const filePath = path.join(DOWNLOADS, filename);
    try {
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      const record = parseMcKibbonPDF(data.text, filename);
      if (!record) {
        console.log(`  ⚠️  ${filename} — parse returned null`);
        failed++;
        failures.push(filename);
        continue;
      }
      const { error } = await supabase.from('monthly_periods').upsert(record, { onConflict: 'period' });
      if (error) {
        console.log(`  ❌ ${filename} (${record.period}) — ${error.message}`);
        failed++;
        failures.push(`${filename}: ${error.message}`);
      } else {
        console.log(`  ✅ ${record.period}  rev=$${((record.total_revenue||0)/100).toLocaleString()}  nop=$${((record.nop_hotel||0)/100).toLocaleString()}`);
        inserted++;
      }
    } catch (e: any) {
      console.log(`  ❌ ${filename} — ${e.message}`);
      failed++;
      failures.push(`${filename}: ${e.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Inserted/updated: ${inserted}`);
  console.log(`❌ Failed:           ${failed}`);
  if (failures.length) { console.log(`\nFailures:`); failures.forEach(f => console.log(`  ${f}`)); }

  // Show DB range
  const { data: rows } = await supabase.from('monthly_periods').select('period').order('period');
  if (rows?.length) {
    console.log(`\nDB: ${rows.length} rows, ${rows[0].period} → ${rows[rows.length-1].period}`);
  }
}

main().catch(console.error);
