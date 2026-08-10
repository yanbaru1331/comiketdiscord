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
  const [headerCells, ...dataRows] = table;
  if (!headerCells) throw new Error(`${sourceName}: header row is missing`);

  const headers = headerCells.map((cell, index) => {
    const header = cellToString(cell).trim();
    return index === 0 ? header.replace(/^\uFEFF/, '') : header;
  });

  if (headers.some((header) => header === '')) {
    throw new Error(`${sourceName}: header names must not be empty`);
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error(`${sourceName}: header names must be unique`);
  }

  let previousLocation: string | undefined;
  let previousCircleName: string | undefined;

  return dataRows
    .filter((cells) => cells.some((cell) => cellToString(cell).trim() !== ''))
    .map((cells, index) => {
      const rowNumber = index + 2;
      if (cells.length > headers.length) {
        throw new Error(
          `${sourceName}:${rowNumber}: expected at most ${headers.length} columns, got ${cells.length}`,
        );
      }

      const row: PurchaseCandidateRow = Object.fromEntries(
        headers.map((header, column) => [header, cellToString(cells[column])]),
      );

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
        return mapPurchaseCandidateRow(row);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${sourceName}:${rowNumber}: ${reason}`);
      }
    });
}
