import fs from 'fs';
import pdfParse from 'pdf-parse';
import { parseMcKibbonPDF } from '../src/lib/pdf-parser';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qrryydgpujoumgotemfk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

const pdfs = [
  '/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 12-2025.pdf',
  '/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 01-2026.pdf',
  '/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 02-2026.pdf',
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY!);
  for (const filePath of pdfs) {
    const filename = filePath.split('/').pop()!;
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    const record = parseMcKibbonPDF(data.text, filename);
    if (!record) { console.log(`❌ ${filename} parse failed`); continue; }
    console.log(`period=${record.period} rev=$${(record.total_revenue!/100).toLocaleString()}`);
    const { error } = await supabase.from('monthly_periods').upsert(record, { onConflict: 'period' });
    if (error) console.log(`❌ ${error.message}`); else console.log(`✅ ${record.period}`);
  }
}
main().catch(console.error);
