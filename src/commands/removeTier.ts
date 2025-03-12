import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { findOrCreateSuspensionByDiscordId, removeTierInfraction } from '../database/mongo';

export const data = new SlashCommandBuilder()
  .setName('removetier')
  .setDescription('Remove one tier from a user’s suspension record (only if not actively suspended).')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user whose tier will be reduced.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Select the punishment category (quit, minor, moderate, major, extreme).')
      .setRequired(true)
      .addChoices(
        { name: 'quit', value: 'quit' },
        { name: 'minor', value: 'minor' },
        { name: 'moderate', value: 'moderate' },
        { name: 'major', value: 'major' },
        { name: 'extreme', value: 'extreme' }
      ));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[RemoveTier Command] Execution started.');

  // Validate channel.
  if (interaction.channel?.id !== config.discord.channels.suspendedChannel) {
    return interaction.editReply('This command can only be used in the suspended channel.');
  }

  // Validate permissions.
  const invoker = interaction.member as GuildMember;
  if (
    !invoker.roles.cache.has(config.discord.roles.moderator) &&
    !invoker.roles.cache.has(config.discord.roles.cplBackend)
  ) {
    return interaction.editReply('You do not have permission to use this command.');
  }

  // Retrieve target user and category.
  const targetUser: User = interaction.options.getUser('target')!;
  const category = interaction.options.getString('category') as 'quit' | 'minor' | 'moderate' | 'major' | 'extreme';
  console.log(`[RemoveTier Command] Target user: ${targetUser.id}, Category: ${category}.`);

  try {
    const record = await findOrCreateSuspensionByDiscordId(targetUser.id);
    if (record.suspended) {
      return interaction.editReply(`<@${targetUser.id}> is currently suspended. Tier removal is only allowed if the user is not actively suspended.`);
    }

    const result = await removeTierInfraction(targetUser.id, category);
    const newDecay = result.decays 
      ? `${result.decays.toLocaleDateString()}, ${result.decays.toLocaleTimeString()}`
      : 'none';

    const replyMessage = result.removed
      ? `<@${targetUser.id}> now has **Tier ${result.tier} ${category.toUpperCase()}**.\nNew decay date: **${newDecay}**.`
      : `<@${targetUser.id}> is already at Tier 0 for ${category.toUpperCase()}. No changes made.`;

    await interaction.editReply(replyMessage);
    console.log('[RemoveTier Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing removetier command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
