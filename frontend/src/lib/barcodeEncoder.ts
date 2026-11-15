// ISO/IEC 15417 symbol widths, indexed by Code 128 symbol value.
const code128Patterns = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
  '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112',
]

export function encodeCode128(value: string): string {
  if (!/^[\x20-\x7e]{1,40}$/.test(value)) throw new Error('Invalid operational barcode')
  const symbols = [104, ...Array.from(value, c => c.charCodeAt(0) - 32)]
  const checksum = symbols.reduce((sum, symbol, i) => sum + symbol * (i || 1), 0) % 103
  return '0'.repeat(10) + [...symbols, checksum, 106].map(symbol =>
    Array.from(code128Patterns[symbol], (width, i) => (i % 2 === 0 ? '1' : '0').repeat(Number(width))).join('')
  ).join('') + '0'.repeat(10)
}

export function validGTIN13(value: string): boolean {
  return /^\d{13}$/.test(value) && Array.from(value).reduce((sum, c, i) => sum + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0
}

const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const parity = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

export function encodeEAN13(value: string): string {
	if (!/^\d{13}$/.test(value)) throw new Error('Invalid GTIN-13')
  const right = (digit: string) => Array.from(left[Number(digit)], bit => bit === '0' ? '1' : '0').join('')
  const first = Array.from(value.slice(1, 7), (digit, i) => parity[Number(value[0])][i] === 'L'
    ? left[Number(digit)] : Array.from(right(digit)).reverse().join('')).join('')
  return '0'.repeat(11) + '101' + first + '01010' + Array.from(value.slice(7), right).join('') + '101' + '0'.repeat(7)
}
