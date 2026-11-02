export interface PackagingAllocationInput {
  quantity: number
  totalNetWeightKg: number
  remainingKg: number
}

export interface PackagingAllocation {
  quantity: number
  totalNetWeightKg: number
  unitWeightsKg: number[]
}

export class PackagingValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'INSUFFICIENT_PALLET_WEIGHT',
  ) {
    super(message)
    this.name = 'PackagingValidationError'
  }
}

export function calculatePackagingAllocation(input: PackagingAllocationInput): PackagingAllocation {
  const quantity = Number(input.quantity)
  const totalWeightGrams = Math.round(Number(input.totalNetWeightKg) * 1000)
  const remainingWeightGrams = Math.round(Number(input.remainingKg) * 1000)

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new PackagingValidationError('Quantity must be a positive integer', 'VALIDATION_ERROR')
  }

  if (!Number.isFinite(totalWeightGrams) || totalWeightGrams < 1) {
    throw new PackagingValidationError('Total net weight must be greater than zero', 'VALIDATION_ERROR')
  }

  if (!Number.isFinite(remainingWeightGrams) || remainingWeightGrams < 0) {
    throw new PackagingValidationError('Pallet remaining weight must be zero or greater', 'VALIDATION_ERROR')
  }

  if (totalWeightGrams > remainingWeightGrams) {
    throw new PackagingValidationError(
      `Requested packaging weight of ${(totalWeightGrams / 1000).toFixed(3)} kg exceeds the pallet remaining weight of ${(remainingWeightGrams / 1000).toFixed(3)} kg`,
      'INSUFFICIENT_PALLET_WEIGHT',
    )
  }

  const baseUnitWeightGrams = Math.floor(totalWeightGrams / quantity)
  const remainderGrams = totalWeightGrams % quantity
  const unitWeightsKg = Array.from({ length: quantity }, (_, index) => {
    const unitWeightGrams = baseUnitWeightGrams + (index < remainderGrams ? 1 : 0)
    return unitWeightGrams / 1000
  })

  return {
    quantity,
    totalNetWeightKg: totalWeightGrams / 1000,
    unitWeightsKg,
  }
}
