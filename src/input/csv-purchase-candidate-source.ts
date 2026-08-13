import { readFile } from 'node:fs/promises';
import type {
  PurchaseCandidate,
  PurchaseCandidateSource,
} from '../domain/purchase-candidate.js';
import { mapPurchaseCandidateTable } from './purchase-candidate-table.js';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
    rows.push(row);
  }
  return rows;
}

export class CsvPurchaseCandidateSource implements PurchaseCandidateSource {
  public constructor(private readonly filePath: string) {}

  public async load(): Promise<PurchaseCandidate[]> {
    const rows = parseCsv(await readFile(this.filePath, 'utf8'));
    return mapPurchaseCandidateTable(rows, this.filePath);
  }
}
