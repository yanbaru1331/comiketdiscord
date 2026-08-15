import { parseCsv } from './csv-purchase-candidate-source.js';
import type {
  GoogleSheetLocation,
  GoogleSheetsValuesReader,
} from './google-sheets-purchase-candidate-source.js';
import type { PurchaseCandidateTable } from './purchase-candidate-table.js';

/** Reads a Google Sheet shared as "Anyone with the link" without credentials. */
export class PublicGoogleSheetsValuesReader implements GoogleSheetsValuesReader {
  public async read(location: GoogleSheetLocation): Promise<PurchaseCandidateTable> {
    const query = new URLSearchParams({
      tqx: 'out:csv',
      sheet: location.sheetName,
    });
    const url =
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(location.spreadsheetId)}`
      + `/gviz/tq?${query.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Google Sheets request failed: ${response.status} ${response.statusText}`,
      );
    }

    const csv = await response.text();
    if (/^\s*<!doctype html/i.test(csv)) {
      throw new Error(
        `Google Sheet ${location.sheetName} is not publicly readable`,
      );
    }

    return parseCsv(csv);
  }
}
