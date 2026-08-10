import { EmbedBuilder, hyperlink } from 'discord.js';
import type { PurchaseCandidate } from '../domain/purchase-candidate.js';

const ITEMS_PER_EMBED = 10;

function formatYen(value: number): string {
  return `${value.toLocaleString('ja-JP')}円`;
}

function renderProduct(item: PurchaseCandidate): string {
  const details = [`- ${item.productName}` ];
  details.push(`${item.unitPrice !== undefined ? formatYen(item.unitPrice) : '価格未設定'}-${item.quantity}冊`);
  return details.join('\n');
}
interface CircleGroup {
  location: string;
  circleName: string;
  items: PurchaseCandidate[];
}
function groupByCircle(items: readonly PurchaseCandidate[]): CircleGroup[] {
  const groups = new Map<string, CircleGroup>();

  for (const item of items) {
    const circleName = item.circleName ?? 'サークル名未設定';
    const key = `${item.location}\u0000${circleName}`;
    const group = groups.get(key) ?? {
      location: item.location,
      circleName,
      items: [],
    };

    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function renderCircleValue(items: readonly PurchaseCandidate[]): string {
  const products = items.map(renderProduct);
  const urls = [
    ...new Set(
      items
        .map((item) => item.url)
        .filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url))),
    ),
  ];
  const links = urls.map((url, index) =>
    hyperlink(urls.length === 1 ? '詳細を開く' : `詳細を開く (${index + 1})`, url),
  );

  return [...products, ...links].join('\n');
}

export function buildPurchaseCandidateEmbeds(
  items: readonly PurchaseCandidate[],
  title: string,
): EmbedBuilder[] {
  const circles = groupByCircle(items);
  const embeds: EmbedBuilder[] = [];
  const totalPages = Math.ceil(circles.length / ITEMS_PER_EMBED);

  for (let offset = 0; offset < circles.length; offset += ITEMS_PER_EMBED) {
    const page = circles.slice(offset, offset + ITEMS_PER_EMBED);
    const pageNumber = offset / ITEMS_PER_EMBED + 1;
    const embed = new EmbedBuilder().setTitle(
      totalPages > 1 ? `${title}（${pageNumber}/${totalPages}）` : title,
    );

    page.forEach((circle, index) => {
      embed.addFields({
        name: `${offset + index + 1}. ${circle.location} - ${circle.circleName}`,
        value: renderCircleValue(circle.items),
      });
    });

    embeds.push(embed);
  }

  return embeds;
}
