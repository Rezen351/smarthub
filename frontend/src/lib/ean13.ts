export function validGTIN13(value: string): boolean {
  return /^\d{13}$/.test(value) && Array.from(value).reduce((sum, c, i) => sum + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0
}

const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const parity = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

export function encodeEAN13(value: string): string {
	if (!validGTIN13(value)) throw new Error('Invalid GTIN-13')
  const right = (digit: string) => Array.from(left[Number(digit)], bit => bit === '0' ? '1' : '0').join('')
  const first = Array.from(value.slice(1, 7), (digit, i) => parity[Number(value[0])][i] === 'L'
    ? left[Number(digit)] : Array.from(right(digit)).reverse().join('')).join('')
  return '0'.repeat(11) + '101' + first + '01010' + Array.from(value.slice(7), right).join('') + '101' + '0'.repeat(7)
}
