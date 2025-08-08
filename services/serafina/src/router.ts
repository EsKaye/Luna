import 'dotenv/config';
import {
  Client,
  SlashCommandBuilder,
  GatewayIntentBits,
  Routes,
  REST,
} from 'discord.js';
import { relayToUnity } from './unityBridge.js';
import {
  scheduleNightlyCouncilReport,
  sendCouncilReport,
} from './nightlyReport.js';
import { announceHandshake } from './handshake.js';

// Initialize Discord client with minimal intents
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const GUILD_ID = process.env.GUILD_ID!;
const COUNCIL_CH = process.env.CHN_COUNCIL!;

// Register slash commands on startup
client.once('ready', async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('council-report')
      .setDescription('Dispatch the council report immediately'),
  ].map((cmd) => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user!.id, GUILD_ID), {
    body: commands,
  });

  scheduleNightlyCouncilReport(client); // Start daily schedule
  await announceHandshake(); // Inform peer services of our presence
  console.log(`Serafina online as ${client.user?.tag}`);
});

// Listen for slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'council-report') {
    await interaction.reply({ content: 'Summoning report...', ephemeral: true });
    await sendCouncilReport(client);
    await interaction.followUp({
      content: 'Council report dispatched.',
      ephemeral: true,
    });
  }
});

// Forward messages from the council channel to the Unity ops bus
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (msg.channelId === COUNCIL_CH) {
    await relayToUnity('*', msg.content);
  }
});

client.login(DISCORD_TOKEN);
