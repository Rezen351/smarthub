const { buildSync } = require('esbuild')
const { writeFileSync } = require('node:fs')
buildSync({
  stdin: { contents: `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import Label from './src/components/operator/LabelPreview';
const render = props => renderToStaticMarkup(React.createElement(Label, props));
const receipt = render({type:'receipt',code:'SECRET',farmerId:'FMR-SECRET',farmerName:'Ada',stationName:'STATION-SECRET',commodity:'Kentang',weightKg:999,items:[{code:'WRG-SECRET-1',weightKg:2},{code:'WRG-SECRET-2',weightKg:3}],date:'2026-11-26',time:'10:00'});
for (const text of ['BUKTI PENERIMAAN','Petani:','Ada','Hasil panen:','Kentang','Jumlah waring:','Waring 1','Waring 2','5 kg','Total berat','Terima kasih']) assert(receipt.includes(text),text);
for (const text of ['SECRET','999','BUFFER_WAITING','<svg']) assert(!receipt.includes(text),text);
for (const type of ['pouch','export']) for (const weightKg of [1,5,10,50]) {
  const html=render({type,code:'PKG-1',gtin:'8994477090010',barcodeValue:'010899447709101721PKG-1',commodity:'Tomato',grade:'B',weightKg});
  assert(html.includes('GS1 EAN-13 8994477091017'));
  assert(!html.includes('8994477090010'));
  assert.equal((html.match(/<svg/g)||[]).length,1);
  assert(html.includes(Math.round(weightKg)+' kg'));
}
console.log('Rendered receipt and all Packaging sizes match expected label content');
`, resolveDir: '/app', loader:'tsx' },
  bundle:true, platform:'node', format:'cjs', outfile:'/tmp/label-render-check.cjs', jsx:'automatic'
})
require('/tmp/label-render-check.cjs')
