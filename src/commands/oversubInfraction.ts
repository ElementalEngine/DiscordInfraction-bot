import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordSuspensionDue, subSuspension } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('oversub')
  .setDescription('Record an oversub infraction for a member (adds 3 days suspension).')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user to be suspended for an oversub infraction.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the oversub infraction (optional).')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Oversub Command] Execution started.');

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

  // Retrieve target user and reason.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  console.log(`[Oversub Command] Target user: ${targetUser.id}.`);

  try {
    // Process an oversub punishment (adds 3 days).
    const newEnd = await subSuspension(targetUser.id);

    if (targetMember) {
      // If target is in the guild, apply suspension roles.
      await RoleHandler.applySuspensionRoles(targetMember);
      const dmMessage = buildSuspensionNotice('oversub', 1, newEnd, reason, false);
      const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'oversub', 1, newEnd, reason, false);
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
      await interaction.editReply(channelMessage);
    } else {
      // If not in the guild, record a SuspensionDue document for later processing.
      await recordSuspensionDue(targetUser.id, 'oversub');
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their oversub suspension has been recorded for processing when they rejoin.`
      );
    }
    console.log('[Oversub Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing oversub command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
