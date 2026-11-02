import {
  calculatePackagingAllocation,
  PackagingValidationError,
} from './packaging.validation'

describe('calculatePackagingAllocation', () => {
  it('rejects a quantity whose total weight exceeds the pallet', () => {
    expect(() =>
      calculatePackagingAllocation({
        quantity: 10,
        totalNetWeightKg: 10,
        remainingKg: 9.5,
      }),
    ).toThrow('exceeds the pallet remaining weight')
  })

  it('allocates the requested total weight into every package unit', () => {
    const allocation = calculatePackagingAllocation({
      quantity: 3,
      totalNetWeightKg: 3.002,
      remainingKg: 4,
    })

    expect(allocation.quantity).toBe(3)
    expect(allocation.unitWeightsKg).toEqual([1.001, 1.001, 1])
    expect(allocation.unitWeightsKg.reduce((sum, weight) => sum + weight, 0)).toBe(3.002)
  })

  it('rejects zero and fractional quantities', () => {
    expect(() =>
      calculatePackagingAllocation({ quantity: 0, totalNetWeightKg: 1, remainingKg: 2 }),
    ).toThrow(PackagingValidationError)
    expect(() =>
      calculatePackagingAllocation({ quantity: 1.5, totalNetWeightKg: 1, remainingKg: 2 }),
    ).toThrow('Quantity must be a positive integer')
  })
})
