import type { PurchaseCandidate } from '../domain/purchase-candidate.js';

export interface PurchaseCandidateSummary {
  ID: string;
  優先度: string;
  場所: string;
  サークル: string;
  購入品: string;
  冊数: number;
}

export function summarizePurchaseCandidates(
  items: readonly PurchaseCandidate[],
  limit = 5,
): PurchaseCandidateSummary[] {
  return items.slice(0, limit).map((item) => ({
    ID: item.id,
    優先度: item.priority ?? '',
    場所: item.location,
    サークル: item.circleName ?? '',
    購入品: item.productName,
    冊数: item.quantity,
  }));
}
