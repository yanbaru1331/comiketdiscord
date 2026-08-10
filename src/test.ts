import { resolve } from 'node:path';
import { CsvPurchaseCandidateSource } from './input/csv-purchase-candidate-source.js';
import { summarizePurchaseCandidates } from './presentation/purchase-candidate-console.js';

const source = new CsvPurchaseCandidateSource(resolve(process.cwd(), 'test.csv'));

async function main(): Promise<void> {
  const items = await source.load();
  console.log(`購入候補を ${items.length} 件読み込みました。先頭5件を表示します。`);
  console.table(summarizePurchaseCandidates(items));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`購入候補を読み込めませんでした: ${message}`);
  process.exitCode = 1;
});
