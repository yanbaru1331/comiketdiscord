import type { PurchaseCandidate } from '../domain/purchase-candidate.js';
import {
  mapPurchaseCandidateRow,
  type PurchaseCandidateRow,
} from './purchase-candidate-row.js';

export type TableCell = string | number | boolean | null | undefined;
export type PurchaseCandidateTable = readonly (readonly TableCell[])[];

function cellToString(cell: TableCell): string {
  return cell === null || cell === undefined ? '' : String(cell);
}

/** Converts CSV or Google Sheets tabular values into the shared domain array. */
export function mapPurchaseCandidateTable(
  table: PurchaseCandidateTable,
  sourceName: string,
): PurchaseCandidate[] {
  const headerRowIndex = table.findIndex((cells) => {
    const values = cells.map((cell) => cellToString(cell).trim());
    const hasLocationColumn = values.includes('場所') || values[2] === '';
    return hasLocationColumn
      && ['優先度', 'サークル名', '買うもの'].every((header) =>
        values.includes(header),
      );
  });
  if (headerRowIndex < 0) throw new Error(`${sourceName}: header row is missing`);

  const headerCells = table[headerRowIndex];
  if (!headerCells) throw new Error(`${sourceName}: header row is missing`);
  let lastNamedColumn = -1;
  headerCells.forEach((cell, index) => {
    if (cellToString(cell).trim() !== '') lastNamedColumn = index;
  });
  const relevantColumnCount = Math.max(lastNamedColumn + 1, 11);
  const dataRows = table.slice(headerRowIndex + 1);

  const headers = headerCells.slice(0, relevantColumnCount).map((cell, index) => {
    const header = cellToString(cell).trim();
    const normalized = index === 0 ? header.replace(/^\uFEFF/, '') : header;
    if (index === 0 && ['', 'FALSE', '✗', 'チェック'].includes(normalized)) {
      return '購入対象';
    }
    if (index === 2 && normalized === '') return '場所';
    if (index === 5 && normalized === '') return '金額/冊';
    if (index === 6 && normalized === '') return '冊数';
    if (index === 7 && normalized === '') return '合計金額';
    return normalized;
  });

  if (headers.some((header) => header === '')) {
    throw new Error(`${sourceName}: header names must not be empty`);
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error(`${sourceName}: header names must be unique`);
  }

  let previousLocation: string | undefined;
  let previousCircleName: string | undefined;

  const candidates: PurchaseCandidate[] = [];
  dataRows.forEach((cells, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const row: PurchaseCandidateRow = Object.fromEntries(
      headers.map((header, column) => [header, cellToString(cells[column])]),
    );

    // The sheet has pre-filled checkbox/priority rows. They are not items yet.
    if (!row['買うもの']?.trim()) return;

    const explicitLocation = row['場所']?.trim();
    if (explicitLocation) {
      if (explicitLocation !== previousLocation) previousCircleName = undefined;
      previousLocation = explicitLocation;
    } else if (previousLocation) {
      row['場所'] = previousLocation;
    }

    const explicitCircleName = row['サークル名']?.trim();
    if (explicitCircleName) {
      previousCircleName = explicitCircleName;
    } else if (previousCircleName) {
      row['サークル名'] = previousCircleName;
    }

    try {
      candidates.push(mapPurchaseCandidateRow(row));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`${sourceName}:${rowNumber}: ${reason}`);
    }
  });

  return candidates;
}
