import type {
  PurchaseCandidate,
  PurchaseCandidateSource,
} from '../domain/purchase-candidate.js';
import {
  mapPurchaseCandidateTable,
  type PurchaseCandidateTable,
} from './purchase-candidate-table.js';

export interface GoogleSheetLocation {
  spreadsheetId: string;
  sheetName: string;
}

/**
 * Port implemented later by the selected Google authentication/API library.
 * It should return values including the header row, like sheets.values.get().
 */
export interface GoogleSheetsValuesReader {
  read(location: GoogleSheetLocation): Promise<PurchaseCandidateTable>;
}

export class GoogleSheetsPurchaseCandidateSource implements PurchaseCandidateSource {
  public constructor(
    private readonly location: GoogleSheetLocation,
    private readonly reader: GoogleSheetsValuesReader,
  ) {}

  public async load(): Promise<PurchaseCandidate[]> {
    const table = await this.reader.read(this.location);
    return mapPurchaseCandidateTable(
      table,
      `Google Sheets ${this.location.spreadsheetId}/${this.location.sheetName}`,
    );
  }
}
