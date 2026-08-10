export interface PurchaseCandidate {
  id: string;
  selected: boolean;
  priority?: string;
  location: string;
  circleName?: string;
  productName: string;
  unitPrice?: number;
  quantity: number;
  totalPrice?: number;
  memo1?: string;
  memo2?: string;
  url?: string;
}

export interface PurchaseCandidateSource {
  load(): Promise<PurchaseCandidate[]>;
}
