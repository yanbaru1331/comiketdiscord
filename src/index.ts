//必要なパッケージをインポートする
import { GatewayIntentBits, Client, Partials, Message } from 'discord.js'


//Botで使うGatewayIntents、partials
const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
})

//Botがきちんと起動したか確認
client.once('ready', () => {
    console.log('Ready!')
    if(client.user){
        console.log(client.user.tag)
    }
})

//!timeと入力すると現在時刻を返信するように
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    if (message.content !== '!time') return;
    if (!message.channel.isSendable()) return;

    const now = new Date();

    await message.channel.send(
        now.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
        }),
    );
});

//ボット作成時のトークンでDiscordと接続
client.login(process.env.DISCORD_TOKEN)