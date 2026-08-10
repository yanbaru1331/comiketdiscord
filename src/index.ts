import { resolve } from 'node:path';
import { Client, GatewayIntentBits, Message, Partials } from 'discord.js';
import { CsvPurchaseCandidateSource } from './input/csv-purchase-candidate-source.js';
import { buildPurchaseCandidateEmbeds } from './presentation/purchase-candidate-embeds.js';

const purchaseCandidateSource = new CsvPurchaseCandidateSource(
  resolve(process.cwd(), 'test.csv'),
);
const purchaseListTitle = '東456';

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once('ready', () => {
  console.log('Ready!');
  if (client.user) console.log(client.user.tag);
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;
  if (message.content !== '!list') return;
  if (!message.channel.isSendable()) return;

  const items = await purchaseCandidateSource.load();
  const embeds = buildPurchaseCandidateEmbeds(items, purchaseListTitle);

  for (const e of embeds) {
    await message.channel.send({ embeds: [e] });
  }
});

client.login(process.env.DISCORD_TOKEN);
