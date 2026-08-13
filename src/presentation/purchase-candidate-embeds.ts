import { EmbedBuilder, hyperlink } from 'discord.js';
import type { PurchaseCandidate } from '../domain/purchase-candidate.js';

const ITEMS_PER_EMBED = 10;

export interface PurchaseExceptionNote {
  type: string;
  memo?: string;
  updatedBy: string;
}

export interface PurchaseCircleGroup {
  key: string;
  location: string;
  circleName: string;
  items: PurchaseCandidate[];
}

export interface PurchaseCandidatePage {
  title: string;
  pageNumber: number;
  totalPages: number;
  circles: PurchaseCircleGroup[];
}

export interface PurchaseCircleDisplayState {
  purchaserIds: readonly string[];
  exception?: PurchaseExceptionNote;
}

function formatYen(value: number): string {
  return `${value.toLocaleString('ja-JP')}円`;
}

function renderException(note: PurchaseExceptionNote): string {
  const details = [note.type];
  if (note.memo) details.push(note.memo);
  return `備考: ${details.join(' / ')}`;
}

function renderProduct(
  item: PurchaseCandidate,
  productNumber: number | undefined,
): string {
  const label = productNumber === undefined
    ? item.productName
    : `${productNumber}. ${item.productName}`;
  const details = [`> - ${label}`];
  details.push(
    `${item.unitPrice !== undefined ? formatYen(item.unitPrice) : '価格未設定'}-${item.quantity}冊`,
  );
  return details.join('\n');
}

export function groupPurchaseCandidatesByCircle(
  items: readonly PurchaseCandidate[],
): PurchaseCircleGroup[] {
  const groups = new Map<string, PurchaseCircleGroup>();

  for (const item of items) {
    const circleName = item.circleName ?? 'サークル名未設定';
    const key = `${item.location}\u0000${circleName}`;
    const group = groups.get(key) ?? {
      key,
      location: item.location,
      circleName,
      items: [],
    };

    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function renderCircleValue(
  circle: PurchaseCircleGroup,
  state: PurchaseCircleDisplayState | undefined,
): string {
  const showProductNumbers = circle.items.length > 1;
  const products = circle.items.map((item, index) =>
    renderProduct(
      item,
      showProductNumbers ? index + 1 : undefined,
    ),
  );
  const urls = [
    ...new Set(
      circle.items
        .map((item) => item.url)
        .filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url))),
    ),
  ];
  const links = urls.map((url, index) =>
    hyperlink(urls.length === 1 ? '詳細を開く' : `詳細を開く (${index + 1})`, url),
  );
  const purchasers = state?.purchaserIds.length
    ? [`購入数: ${state.purchaserIds.length}`]
    : [];
  const exception = state?.exception ? [renderException(state.exception)] : [];

  return [...products, ...exception, ...purchasers, ...links].join('\n');
}

export function buildPurchaseCandidatePages(
  items: readonly PurchaseCandidate[],
  title: string,
): PurchaseCandidatePage[] {
  const circles = groupPurchaseCandidatesByCircle(items);
  const totalPages = Math.ceil(circles.length / ITEMS_PER_EMBED);
  const pages: PurchaseCandidatePage[] = [];

  for (let offset = 0; offset < circles.length; offset += ITEMS_PER_EMBED) {
    pages.push({
      title,
      pageNumber: offset / ITEMS_PER_EMBED + 1,
      totalPages,
      circles: circles.slice(offset, offset + ITEMS_PER_EMBED),
    });
  }

  return pages;
}

export function renderPurchaseCandidatePage(
  page: PurchaseCandidatePage,
  states: ReadonlyMap<string, PurchaseCircleDisplayState> = new Map(),
): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(
    page.totalPages > 1
      ? `${page.title}（${page.pageNumber}/${page.totalPages}）`
      : page.title,
  );

  page.circles.forEach((circle, index) => {
    const state = states.get(circle.key);
    const soldOut = state?.exception?.type === '売り切れ';
    const status = soldOut
      ? '❌'
      : state?.purchaserIds.length
        ? '✅'
        : '⬜';
    const name = `${index + 1}. ${circle.location} - ${circle.circleName}`;
    embed.addFields({
      name: `${soldOut ? `~~${name}~~` : name} ${status}`,
      value: renderCircleValue(circle, state),
    });
  });

  return embed;
}

export function buildPurchaseCandidateEmbeds(
  items: readonly PurchaseCandidate[],
  title: string,
): EmbedBuilder[] {
  return buildPurchaseCandidatePages(items, title).map((page) =>
    renderPurchaseCandidatePage(page),
  );
}
