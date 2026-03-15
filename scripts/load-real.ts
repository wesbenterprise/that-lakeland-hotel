import fs from 'fs';
import pdfParse from 'pdf-parse';
import { parseMcKibbonPDF } from '../src/lib/pdf-parser';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qrryydgpujoumgotemfk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycnl5ZGdwdWpvdW1nb3RlbWZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1NDA2MywiZXhwIjoyMDg5MTMwMDYzfQ._tTWB1eFqDAUwYtWsaDqTW1CsnTJ6qU_MmX_xiS2GRo';

const pdfs = [
  '/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 12-2025.pdf',
  '/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 01-2026.pdf',
  '/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 02-2026.pdf',
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  for (const filePath of pdfs) {
    const filename = filePath.split('/').pop()!;
    console.log(`\nParsing ${filename}...`);
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    const record = parseMcKibbonPDF(data.text, filename);
    if (!record) { console.log('  ❌ Parse failed'); continue; }
    console.log(`  period=${record.period} revenue=$${(record.total_revenue!/100).toLocaleString()} nop=$${record.nop_hotel ? (record.nop_hotel/100).toLocaleString() : 'null'} gop=$${record.gross_operating_profit ? (record.gross_operating_profit/100).toLocaleString() : 'null'}`);
    
    const { error } = await supabase.from('monthly_periods').upsert(record, { onConflict: 'period' });
    if (error) console.log(`  ❌ ${error.message}`);
    else console.log(`  ✅ Upserted ${record.period}`);
  }
  console.log('\nDone.');
}

main().catch(console.error);
