import { resolve } from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  Message,
  MessageFlags,
  MessageReaction,
  ModalBuilder,
  Partials,
  PartialUser,
  TextInputBuilder,
  TextInputStyle,
  User,
} from 'discord.js';
import { CsvPurchaseCandidateSource } from './input/csv-purchase-candidate-source.js';
import {
  buildPurchaseCandidatePages,
  type PurchaseCandidatePage,
  type PurchaseCircleDisplayState,
  type PurchaseExceptionNote,
  renderPurchaseCandidatePage,
} from './presentation/purchase-candidate-embeds.js';

const numberEmojis = [
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
] as const;
const emojiIndexes = new Map<string, number>(
  numberEmojis.map((emoji, index) => [emoji, index]),
);
const exceptionButtonId = 'purchase-exception';
const exceptionModalPrefix = 'purchase-exception-modal:';

interface MutableCircleState extends PurchaseCircleDisplayState {
  purchaserIds: string[];
  exceptions: Map<string, PurchaseExceptionNote>;
}

interface PublishedListMessage {
  message: Message;
  page: PurchaseCandidatePage;
  states: Map<string, MutableCircleState>;
}

const publishedMessages = new Map<string, PublishedListMessage>();
const purchaseCandidateSource = new CsvPurchaseCandidateSource(
  resolve(process.cwd(), 'test.csv'),
);
const purchaseListTitle = '東456';

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

function buildExceptionButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(exceptionButtonId)
      .setLabel('例外を入力')
      .setStyle(ButtonStyle.Secondary),
  );
}

function getCircleState(
  published: PublishedListMessage,
  circleKey: string,
): MutableCircleState {
  const current = published.states.get(circleKey);
  if (current) return current;

  const created: MutableCircleState = {
    purchaserIds: [],
    exceptions: new Map(),
  };
  published.states.set(circleKey, created);
  return created;
}

async function refreshPublishedMessage(
  published: PublishedListMessage,
): Promise<void> {
  await published.message.edit({
    embeds: [renderPurchaseCandidatePage(published.page, published.states)],
    components: [buildExceptionButton()],
  });
}

async function syncPurchaseReaction(
  reaction: MessageReaction,
  user: User | PartialUser,
): Promise<void> {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  const published = publishedMessages.get(reaction.message.id);
  if (!published) return;

  const emojiName = reaction.emoji.name;
  const fieldIndex = emojiName ? emojiIndexes.get(emojiName) : undefined;
  if (fieldIndex === undefined) return;

  const circle = published.page.circles[fieldIndex];
  if (!circle) return;

  const users = await reaction.users.fetch();
  const state = getCircleState(published, circle.key);
  state.purchaserIds = users
    .filter((reactionUser) => !reactionUser.bot)
    .map((reactionUser) => reactionUser.id);

  await refreshPublishedMessage(published);
}

function textInputRow(
  input: TextInputBuilder,
): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

function buildExceptionModal(messageId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${exceptionModalPrefix}${messageId}`)
    .setTitle('購入例外の入力')
    .addComponents(
      textInputRow(
        new TextInputBuilder()
          .setCustomId('field-number')
          .setLabel('Field番号（1〜10）')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      textInputRow(
        new TextInputBuilder()
          .setCustomId('product-number')
          .setLabel('商品番号（商品が1件なら1）')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('1'),
      ),
      textInputRow(
        new TextInputBuilder()
          .setCustomId('exception-type')
          .setLabel('種別（引継ぎ・売切れ・複数購入・削除など）')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      textInputRow(
        new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('例外数量（任意）')
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      textInputRow(
        new TextInputBuilder()
          .setCustomId('memo')
          .setLabel('備考（任意）')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );
}

client.once('ready', () => {
  console.log('Ready!');
  if (client.user) console.log(client.user.tag);
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;
  if (message.content !== '!list') return;
  if (!message.channel.isSendable()) return;

  try {
    const items = await purchaseCandidateSource.load();
    const pages = buildPurchaseCandidatePages(items, purchaseListTitle);

    for (const page of pages) {
      const states = new Map<string, MutableCircleState>();
      const sentMessage = await message.channel.send({
        embeds: [renderPurchaseCandidatePage(page, states)],
        components: [buildExceptionButton()],
      });
      publishedMessages.set(sentMessage.id, {
        message: sentMessage,
        page,
        states,
      });

      for (const emoji of numberEmojis.slice(0, page.circles.length)) {
        await sentMessage.react(emoji);
      }
    }
  } catch (error) {
    console.error('購入リストの送信に失敗しました:', error);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    await syncPurchaseReaction(reaction, user);
  } catch (error) {
    console.error('リアクション追加の反映に失敗しました:', error);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  try {
    await syncPurchaseReaction(reaction, user);
  } catch (error) {
    console.error('リアクション削除の反映に失敗しました:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === exceptionButtonId) {
      if (!publishedMessages.has(interaction.message.id)) {
        await interaction.reply({
          content: 'この購入リストは現在の起動セッションでは管理されていません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.showModal(buildExceptionModal(interaction.message.id));
      return;
    }

    if (
      !interaction.isModalSubmit()
      || !interaction.customId.startsWith(exceptionModalPrefix)
    ) return;

    const messageId = interaction.customId.slice(exceptionModalPrefix.length);
    const published = publishedMessages.get(messageId);
    if (!published) {
      await interaction.reply({
        content: 'この購入リストは現在の起動セッションでは管理されていません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const fieldNumber = Number(
      interaction.fields.getTextInputValue('field-number'),
    );
    const productNumber = Number(
      interaction.fields.getTextInputValue('product-number'),
    );
    const circle = published.page.circles[fieldNumber - 1];
    const item = circle?.items[productNumber - 1];
    if (!Number.isInteger(fieldNumber) || !Number.isInteger(productNumber) || !circle || !item) {
      await interaction.reply({
        content: 'Field番号または商品番号が正しくありません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const type = interaction.fields.getTextInputValue('exception-type').trim();
    const quantityText = interaction.fields.getTextInputValue('quantity').trim();
    const quantity = quantityText === '' ? undefined : Number(quantityText);
    if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
      await interaction.reply({
        content: '例外数量は1以上の整数で入力してください。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = getCircleState(published, circle.key);
    if (type === '削除') {
      state.exceptions.delete(item.id);
    } else {
      state.exceptions.set(item.id, {
        type,
        quantity,
        memo: interaction.fields.getTextInputValue('memo').trim() || undefined,
        updatedBy: interaction.user.id,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshPublishedMessage(published);
    await interaction.editReply(
      type === '削除' ? '備考を削除しました。' : '備考を反映しました。',
    );
  } catch (error) {
    console.error('例外入力の反映に失敗しました:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '例外入力の反映に失敗しました。',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
