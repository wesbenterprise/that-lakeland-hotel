import fs from 'fs';
import pdfParse from 'pdf-parse';

async function main() {
  // Check Feb 2022 (old format, still showing rev=$0)
  const buf = fs.readFileSync('/Users/wrbopenclaw/Downloads/SHS Lakeland Income Statement 02-2022_1.pdf');
  const d = await pdfParse(buf);
  const rawLines = d.text.split('\n').map((l:string)=>l.trim()).filter((l:string)=>l.length>0);
  console.log(`Lines: ${rawLines.length} (isOldFormat: ${rawLines.length > 3000})`);
  const collapsed = rawLines.join('');
  
  // Find all "Total" occurrences
  const salesIdx = collapsed.indexOf('Total Sales');
  const revIdx = collapsed.indexOf('Total Revenue');
  console.log('Total Sales idx:', salesIdx);
  console.log('Total Revenue idx:', revIdx);
  
  if (salesIdx >= 0) {
    const ctx = collapsed.substring(Math.max(0, salesIdx-200), salesIdx+20);
    console.log('\nAround Total Sales:', ctx);
  }
}
main().catch(console.error);
