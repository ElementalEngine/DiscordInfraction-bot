import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { addDays, rmDays, findOrCreateSuspensionByDiscordId } from '../database/mongo';

export const data = new SlashCommandBuilder()
  .setName('modifydays')
  .setDescription('Add or remove days from an active suspension.')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('Select the user whose suspension will be modified.')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('days')
      .setDescription('Number of days to add (positive) or remove (negative).')
      .setRequired(true)
      .setMinValue(-1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  // Ensure the command is used in the suspended channel.
  if (interaction.channel?.id !== config.discord.channels.suspendedChannel) {
    return interaction.editReply('This command can only be used in the suspended channel.');
  }

  // Check mod permissions.
  const invoker = interaction.member as GuildMember;
  const hasPermission =
    invoker.roles.cache.has(config.discord.roles.moderator) ||
    invoker.roles.cache.has(config.discord.roles.cplBackend);
  if (!hasPermission) {
    return interaction.editReply('You do not have permission to use this command.');
  }

  // Retrieve the target user and the integer number of days.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const days = interaction.options.getInteger('days')!;

  try {
    // First, ensure the user is currently suspended.
    const record = await findOrCreateSuspensionByDiscordId(targetUser.id);
    if (!record.suspended || !record.ends) {
      return interaction.editReply(`<@${targetUser.id}> is not currently suspended.`);
    }

    let newEnd: Date | null = null;
    let action = '';
    if (days > 0) {
      newEnd = await addDays(targetUser.id, days);
      action = `added **${days}** day${days === 1 ? '' : 's'}`;
    } else if (days < 0) {
      newEnd = await rmDays(targetUser.id, Math.abs(days));
      action = `removed **${Math.abs(days)}** day${Math.abs(days) === 1 ? '' : 's'}`;
    } else {
      return interaction.editReply('No changes made since the value is 0.');
    }

    const formattedEnd = newEnd ? `${newEnd.toLocaleDateString()}, ${newEnd.toLocaleTimeString()}` : 'N/A';
    const dmMessage = `Suspension modification: ${action}.\nNew suspension end date: **${formattedEnd}**.`;
    const channelMessage = `<@${targetUser.id}>: Suspension modification completed (${action}).\nNew suspension end date: **${formattedEnd}**.`;

    if (targetMember) {
      try {
        await targetMember.user.send(dmMessage);
      } catch (err) {
        console.error(`Failed to DM <@${targetUser.id}>:`, err);
      }
    }

    await interaction.editReply(channelMessage);
  } catch (error) {
    console.error('Error executing modifydays command:', error);
    await interaction.editReply('There was an error processing the command.');
  }
}
