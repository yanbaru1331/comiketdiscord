import { randomBytes } from 'node:crypto';
import type { PurchaseCandidate } from '../domain/purchase-candidate.js';

export type PurchaseCandidateRow = Record<string, string | undefined>;

const ITEM_ID_PATTERN = /^[0-9a-f]{16}$/i;

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalNumber(
  value: string | undefined,
  columnName: string,
): number | undefined {
  const normalized = optionalText(value)?.replaceAll(',', '');
  if (normalized === undefined) return undefined;

  const result = Number(normalized);
  if (!Number.isFinite(result)) {
    throw new Error(`${columnName} must be a number: ${value}`);
  }
  return result;
}

function requiredText(value: string | undefined, columnName: string): string {
  const normalized = optionalText(value);
  if (!normalized) throw new Error(`${columnName} is required`);
  return normalized;
}

export function mapPurchaseCandidateRow(row: PurchaseCandidateRow): PurchaseCandidate {
  const id = (optionalText(row.ID) ?? randomBytes(8).toString('hex')).toLowerCase();
  if (!ITEM_ID_PATTERN.test(id)) {
    throw new Error(`ID must be a 16-digit hexadecimal string: ${id}`);
  }

  const quantity = parseOptionalNumber(row['冊数'], '冊数') ?? 1;
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`冊数 must be a non-negative integer: ${row['冊数']}`);
  }

  return {
    id,
    selected: ['TRUE', '✔', '✓', '☑'].includes(
      (row['購入対象'] ?? row.FALSE ?? '').trim().toUpperCase(),
    ),
    priority: optionalText(row['優先度']),
    location: requiredText(row['場所'], '場所'),
    circleName: optionalText(row['サークル名']),
    productName: requiredText(row['買うもの'], '買うもの'),
    unitPrice: parseOptionalNumber(row['金額/冊'], '金額/冊'),
    quantity,
    totalPrice: parseOptionalNumber(row['合計金額'], '合計金額'),
    requester: optionalText(row['希望者']),
    memo1: optionalText(row['メモ-1']),
    memo2: optionalText(row['メモ-2']),
    url: optionalText(row.URL),
  };
}
