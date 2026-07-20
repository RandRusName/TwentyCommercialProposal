import { ApplicationError } from 'src/domain/commercial-proposal';

type DecimalSpec = {
  fieldName: string;
  maxScale: number;
  min?: bigint;
  max?: bigint;
};

type DecimalInput = string | number;

const DECIMAL_REGEX = /^(0|[1-9]\d*)(\.\d+)?$/;

const pow10 = (scale: number) => 10n ** BigInt(scale);

const parseScaledDecimal = (
  value: DecimalInput,
  { fieldName, maxScale, min, max }: DecimalSpec,
) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} must be a positive decimal string or number`,
    );
  }

  const normalizedValue =
    typeof value === 'number' && Number.isFinite(value) ? String(value) : value;

  if (typeof normalizedValue !== 'string' || !DECIMAL_REGEX.test(normalizedValue)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} must be a positive decimal string or number`,
    );
  }

  const [, integerPart, fractionalWithDot] =
    /^(0|[1-9]\d*)(\.(\d+))?$/.exec(normalizedValue) ?? [];
  const fractionalPart = fractionalWithDot?.slice(1) ?? '';

  if (fractionalPart.length > maxScale) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} has too many decimal places`,
    );
  }

  const scaled =
    BigInt(integerPart) * pow10(maxScale) +
    BigInt(fractionalPart.padEnd(maxScale, '0') || '0');

  if (min !== undefined && scaled < min) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} is below the allowed minimum`,
    );
  }

  if (max !== undefined && scaled > max) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} is above the allowed maximum`,
    );
  }

  return scaled;
};

const roundHalfUpDiv = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;

const centsToNumber = (cents: bigint) => Number(cents) / 100;

export type NormalizedMoneyLine = {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineAmount: number;
};

export const calculateProposalLineAmount = ({
  quantity,
  unitPrice,
  discountPercent,
}: {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  discountPercent: DecimalInput;
}): NormalizedMoneyLine => {
  const quantityScaled = parseScaledDecimal(quantity, {
    fieldName: 'quantity',
    maxScale: 4,
    min: 1n,
  });
  const unitPriceCents = parseScaledDecimal(unitPrice, {
    fieldName: 'unitPrice',
    maxScale: 2,
    min: 0n,
  });
  const discountBasisPoints = parseScaledDecimal(discountPercent, {
    fieldName: 'discountPercent',
    maxScale: 2,
    min: 0n,
    max: 10_000n,
  });

  const quantityScale = pow10(4);
  const discountScale = pow10(4);
  const numerator =
    quantityScaled * unitPriceCents * (discountScale - discountBasisPoints);
  const denominator = quantityScale * discountScale;
  const lineAmountCents = roundHalfUpDiv(numerator, denominator);

  return {
    quantity: Number(quantityScaled) / Number(quantityScale),
    unitPrice: centsToNumber(unitPriceCents),
    discountPercent: Number(discountBasisPoints) / 100,
    lineAmount: centsToNumber(lineAmountCents),
  };
};

export const sumLineAmounts = (lineAmounts: number[]) =>
  centsToNumber(
    lineAmounts.reduce(
      (total, amount) => total + BigInt(Math.round(amount * 100)),
      0n,
    ),
  );
