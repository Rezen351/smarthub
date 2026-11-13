import fs from 'fs';
import path from 'path';
import {
  generateLabelHtml,
  generateLabelTspl,
  generateLabelZpl,
  generateLabelEscPos,
  sendToNetworkPrinter,
  LabelPayload,
} from '../backend/src/services/labelPrinter.service';

const OUTPUT_DIR = path.join(__dirname, 'output', '50x80');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('====================================================');
console.log('🧪 TESTING 50x80 THERMAL LABEL PRINT GENERATOR');
console.log('====================================================');

const testCases: { name: string; payload: LabelPayload }[] = [
  {
    name: '1. Retail Pouch 1 kg (Station 03)',
    payload: {
      type: 'pouch',
      code: 'PCH-20261110-0001',
      title: 'SMARTGEULIS',
      subtitle: '1 KG RETAIL POUCH',
      grade: 'A',
      weightKg: 1.000,
      commodity: 'Kentang Granola',
      farmerName: 'Ahmad Santoso',
      farmerCode: 'FMR-001',
      sourcePalletCode: 'PLT-GRD-A-01',
      barcode: '8991234567890',
      traceabilityUrl: 'https://id.smartgeulis.id/traceability/PCH-20261110-0001',
    },
  },
  {
    name: '2. Raw Harvest Waring (Station 01)',
    payload: {
      type: 'waring',
      code: 'WRG-20261110-0001',
      title: 'SMARTGEULIS',
      subtitle: 'RAW HARVEST WARING',
      badge: 'INTAKE',
      grossWeightKg: 42.50,
      commodity: 'Kentang Granola',
      farmerName: 'Ahmad Santoso',
      farmerCode: 'FMR-001',
      destination: 'Buffer Warehouse / Zone: Raw Queue',
      barcode: 'WRG-20261110-0001',
      qrContent: 'WRG-20261110-0001',
    },
  },
  {
    name: '3. Sorted Pallet (Station 02)',
    payload: {
      type: 'pallet',
      code: 'PLT-GRD-A-01',
      title: 'SMARTGEULIS',
      subtitle: 'SORTED PALLET',
      grade: 'A',
      weightKg: 100.00,
      commodity: 'Grade A Premium',
      farmerName: 'Ahmad Santoso',
      barcode: 'PLT-GRD-A-01',
      qrContent: 'PLT-GRD-A-01',
    },
  },
  {
    name: '4. Farmer ID Badge',
    payload: {
      type: 'farmer',
      code: 'FMR-001',
      title: 'SMARTGEULIS',
      subtitle: 'REGISTERED FARMER',
      badge: 'PRODUCER',
      farmerName: 'Ahmad Santoso',
      farmerCode: 'FMR-001',
      village: 'Cisurupan, Garut',
      barcode: 'FMR-001',
      qrContent: 'FMR-001',
    },
  },
];

let allPassed = true;

async function run() {
  for (const tc of testCases) {
    console.log(`\n▶ Checking: ${tc.name}`);

    // 1. Generate 50x80 mm Portrait HTML
    const html50x80 = generateLabelHtml(tc.payload, '50x80');
    const baseFilename = tc.payload.type;
    const htmlPath = path.join(OUTPUT_DIR, `${baseFilename}_50x80.html`);
    fs.writeFileSync(htmlPath, html50x80, 'utf-8');

    // Assertions for HTML
    const hasPage50x80 = html50x80.includes('size: 50mm 80mm;');
    const hasQrSvg = html50x80.includes('<svg') && html50x80.includes('viewBox');
    const hasCode = html50x80.includes(tc.payload.code);

    if (hasPage50x80 && hasQrSvg && hasCode) {
      console.log(`  ✅ HTML (50x80mm) generated -> ${htmlPath}`);
    } else {
      console.error(`  ❌ HTML generation failed assertion!`);
      allPassed = false;
    }

    // 2. Generate 80x50 mm Landscape HTML
    const html80x50 = generateLabelHtml(tc.payload, '80x50');
    const htmlLandPath = path.join(OUTPUT_DIR, `${baseFilename}_80x50_landscape.html`);
    fs.writeFileSync(htmlLandPath, html80x50, 'utf-8');
    console.log(`  ✅ HTML (80x50mm Landscape) generated -> ${htmlLandPath}`);

    // 3. Generate TSPL Command Stream
    const tsplCmd = generateLabelTspl(tc.payload, '50x80');
    const tsplPath = path.join(OUTPUT_DIR, `${baseFilename}_50x80.tspl`);
    fs.writeFileSync(tsplPath, tsplCmd, 'utf-8');

    const hasTsplSize = tsplCmd.includes('SIZE 50 mm, 80 mm');
    const hasTsplPrint = tsplCmd.includes('PRINT 1');

    if (hasTsplSize && hasTsplPrint) {
      console.log(`  ✅ TSPL 50x80 Commands generated -> ${tsplPath}`);
    } else {
      console.error(`  ❌ TSPL generation failed assertion!`);
      allPassed = false;
    }

    // 4. Generate ZPL Command Stream
    const zplCmd = generateLabelZpl(tc.payload, '50x80');
    const zplPath = path.join(OUTPUT_DIR, `${baseFilename}_50x80.zpl`);
    fs.writeFileSync(zplPath, zplCmd, 'utf-8');

    const hasZplHeader = zplCmd.includes('^XA') && zplCmd.includes('^PW400');
    if (hasZplHeader) {
      console.log(`  ✅ ZPL 50x80 Commands generated -> ${zplPath}`);
    } else {
      console.error(`  ❌ ZPL generation failed assertion!`);
      allPassed = false;
    }

    // 5. Generate ESC/POS Binary Stream
    const escposBin = generateLabelEscPos(tc.payload, '50x80');
    const escposPath = path.join(OUTPUT_DIR, `${baseFilename}_50x80.bin`);
    fs.writeFileSync(escposPath, escposBin);
    console.log(`  ✅ ESC/POS 50x80 Binary generated -> ${escposPath} (${escposBin.length} bytes)`);
  }

  // Check if printer IP argument was passed
  const args = process.argv.slice(2);
  const ipIdx = args.indexOf('--printer-ip');
  if (ipIdx !== -1 && args[ipIdx + 1]) {
    const printerIp = args[ipIdx + 1];
    const portIdx = args.indexOf('--printer-port');
    const printerPort = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 9100;
    const protoIdx = args.indexOf('--protocol');
    const protocol = protoIdx !== -1 ? args[protoIdx + 1].toLowerCase() : 'escpos';

    const typeIdx = args.indexOf('--type');
    const selectedType = typeIdx !== -1 ? args[typeIdx + 1].toLowerCase() : 'pouch';
    const targetTc = testCases.find(t => t.payload.type === selectedType) || testCases[0];

    console.log(`\n🖨️ Dispatching [${targetTc.payload.subtitle || targetTc.name}] to physical printer at ${printerIp}:${printerPort} using [${protocol.toUpperCase()}]...`);
    
    let printBuffer: Buffer | string;
    if (protocol === 'tspl') {
      printBuffer = generateLabelTspl(targetTc.payload, '50x80');
    } else if (protocol === 'zpl') {
      printBuffer = generateLabelZpl(targetTc.payload, '50x80');
    } else {
      printBuffer = generateLabelEscPos(targetTc.payload, '50x80');
    }

    try {
      const res = await sendToNetworkPrinter(printerIp, printerPort, printBuffer, 5000);
      console.log(`  Result: ${res.success ? '✅ SUCCESS' : '❌ FAILED'} - ${res.message}`);
    } catch (err: any) {
      console.error(`  Error sending to printer:`, err.message || err);
    }
  } else {
    console.log('\n💡 Tip: To send directly to a thermal printer on your LAN, run:');
    console.log('   tsx scripts/test_print_50x80.ts --printer-ip 192.168.1.xxx --printer-port 9100 --protocol escpos');
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 ALL 50x80 PRINT TESTS PASSED (100% SUCCESS)');
    console.log(`📁 Sample output files saved in: ${OUTPUT_DIR}`);
    console.log('====================================================');
    process.exit(0);
  } else {
    console.error('💥 SOME TESTS FAILED');
    console.log('====================================================');
    process.exit(1);
  }
}

run();

