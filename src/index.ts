import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  LabelBuilder,
  Message,
  MessageFlags,
  MessageReaction,
  ModalBuilder,
  Partials,
  type PartialMessageReaction,
  PartialUser,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  User,
} from 'discord.js';
import { GoogleSheetsPurchaseCandidateSource } from './input/google-sheets-purchase-candidate-source.js';
import { PublicGoogleSheetsValuesReader } from './input/public-google-sheets-values-reader.js';
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
  exception?: PurchaseExceptionNote;
}

interface PublishedListMessage {
  message: Message;
  page: PurchaseCandidatePage;
  states: Map<string, MutableCircleState>;
}

const publishedMessages = new Map<string, PublishedListMessage>();
const defaultSpreadsheetId = '1Nl_CxmDBM_RYGt0x6wFJpupeN0Y1ExGFYwS0AW5GyWQ';
const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim() || defaultSpreadsheetId;
const sheetsReader = new PublicGoogleSheetsValuesReader();
const channelEnvironmentNames = {
  east123: 'DISCORD_CHANNEL_EAST_123_ID',
  east7: 'DISCORD_CHANNEL_EAST_7_ID',
  west12: 'DISCORD_CHANNEL_WEST_12_ID',
  south12: 'DISCORD_CHANNEL_SOUTH_12_ID',
  corporate: 'DISCORD_CHANNEL_CORPORATE_ID',
} as const;

interface PurchaseListTarget {
  sheetName: string;
  channelEnvironmentName: string;
}

const day1Targets: readonly PurchaseListTarget[] = [
  { sheetName: '1日目-東123', channelEnvironmentName: channelEnvironmentNames.east123 },
  { sheetName: '1日目-東7', channelEnvironmentName: channelEnvironmentNames.east7 },
  { sheetName: '1日目-西12', channelEnvironmentName: channelEnvironmentNames.west12 },
  { sheetName: '1日目-南12', channelEnvironmentName: channelEnvironmentNames.south12 },
];
const day2Targets: readonly PurchaseListTarget[] = [
  { sheetName: '2日目-東123', channelEnvironmentName: channelEnvironmentNames.east123 },
  { sheetName: '2日目-東7', channelEnvironmentName: channelEnvironmentNames.east7 },
  { sheetName: '2日目-西12', channelEnvironmentName: channelEnvironmentNames.west12 },
  { sheetName: '2日目-南12', channelEnvironmentName: channelEnvironmentNames.south12 },
];
const corporateTargets: readonly PurchaseListTarget[] = [
  { sheetName: '企業', channelEnvironmentName: channelEnvironmentNames.corporate },
];
const listCommands = new Map<string, readonly PurchaseListTarget[]>([
  ['!list', [...day1Targets, ...day2Targets]],
  ['!list1', day1Targets],
  ['!list2', day2Targets],
  ['!list企業', corporateTargets],
]);

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
  reaction: MessageReaction | PartialMessageReaction,
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

function buildExceptionModal(
  messageId: string,
  page: PurchaseCandidatePage,
): ModalBuilder {
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId('field-number')
    .setPlaceholder('対象を選択')
    .setRequired(true)
    .addOptions(
      page.circles.map((circle, index) => ({
        label: `${index + 1}. ${circle.location} - ${circle.circleName}`.slice(0, 100),
        value: String(index + 1),
      })),
    );

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('exception-type')
    .setPlaceholder('種別を選択')
    .setRequired(true)
    .addOptions(
      { label: '売り切れ', value: '売り切れ' },
      { label: '限数不足', value: '限数不足' },
      { label: 'その他', value: 'その他' },
    );

  return new ModalBuilder()
    .setCustomId(`${exceptionModalPrefix}${messageId}`)
    .setTitle('報連相フォーム')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('サークル')
        .setStringSelectMenuComponent(fieldSelect),
      new LabelBuilder()
        .setLabel('どうした？')
        .setStringSelectMenuComponent(typeSelect),
      new LabelBuilder()
        .setLabel('備考（任意）')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('memo')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
    );
}

client.once('clientReady', () => {
  console.log('Ready!');
  if (client.user) console.log(client.user.tag);
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;
  const targets = listCommands.get(message.content.trim());
  if (!targets) return;

  try {
    for (const target of targets) {
      const channelId = process.env[target.channelEnvironmentName]?.trim();
      if (!channelId) {
        throw new Error(`${target.channelEnvironmentName} is not configured`);
      }

      const destinationChannel = await client.channels.fetch(channelId);
      if (!destinationChannel?.isSendable()) {
        throw new Error(`${target.channelEnvironmentName} is not a sendable channel`);
      }

      const source = new GoogleSheetsPurchaseCandidateSource(
        { spreadsheetId, sheetName: target.sheetName },
        sheetsReader,
      );
      const items = await source.load();
      const pages = buildPurchaseCandidatePages(items, target.sheetName);

      for (const page of pages) {
        const states = new Map<string, MutableCircleState>();
        const sentMessage = await destinationChannel.send({
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

      const published = publishedMessages.get(interaction.message.id);
      if (!published) return;
      await interaction.showModal(
        buildExceptionModal(interaction.message.id, published.page),
      );
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
      interaction.fields.getStringSelectValues('field-number')[0],
    );
    const circle = published.page.circles[fieldNumber - 1];
    if (!Number.isInteger(fieldNumber) || !circle) {
      await interaction.reply({
        content: 'Field番号が正しくありません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const type = interaction.fields.getStringSelectValues('exception-type')[0];
    if (!type) return;

    const state = getCircleState(published, circle.key);
    state.exception = {
      type,
      memo: interaction.fields.getTextInputValue('memo').trim() || undefined,
      updatedBy: interaction.user.id,
    };

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshPublishedMessage(published);
    await interaction.editReply('備考を反映しました。');
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
