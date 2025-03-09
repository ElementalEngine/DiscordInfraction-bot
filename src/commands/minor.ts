import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordMinorInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('minor')
  .setDescription('Record a minor infraction for a member.')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('Select the user who is receiving a minor infraction.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the minor infraction (required).')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  // Ensure the command is used in the suspended channel.
  if (interaction.channel?.id !== config.discord.channels.suspendedChannel) {
    return interaction.editReply('This command can only be used in the suspended channel.');
  }

  // Check moderator permissions.
  const invoker = interaction.member as GuildMember;
  const hasPermission =
    invoker.roles.cache.has(config.discord.roles.moderator) ||
    invoker.roles.cache.has(config.discord.roles.cplBackend);
  if (!hasPermission) {
    return interaction.editReply('You do not have permission to use this command.');
  }

  // Always get the target as a User, then try to get the GuildMember.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!; // required

  try {
    // Record a minor infraction for the target user.
    const result = await recordMinorInfraction(targetUser.id);

    if (targetMember) {
      if (result.tier === 1) {
        // Tier 1 for minor infraction is a warning; do not suspend the member.
        const dmMessage = `Warning Notice:\n` +
                          `Member: <@${targetUser.id}>\n` +
                          `Infraction: **[TIER 1 MINOR]**\n` +
                          `Result: **Warning**\n` +
                          `Reason: ${reason}`;
        const channelMessage = `Suspension Notice:\n` +
                          `Member: <@${targetUser.id}>\n` +
                          `Infraction: **[TIER 1 MINOR]**\n` +
                          `Result: **Warning**\n` +
                          `Reason: ${reason}`;
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      } else if (result.tier < 7) {
        // For tiers above 1 (but below ban threshold), suspend the member.
        await RoleHandler.suspendMember(targetMember);
        const dmMessage = buildSuspensionNotice('minor', result.tier, result.ends, reason, false);
        const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'minor', result.tier, result.ends, reason, false);
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      } else {
        // Tier 6 or above: process as a ban due.
        await RoleHandler.suspendMember(targetMember);
        await recordBanDue(targetUser.id);
        const dmMessage = buildSuspensionNotice('minor', result.tier, result.ends, reason, true);
        const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'minor', result.tier, result.ends, reason, true);
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      }
    } else {
      // If the user is not in the guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'minor', reason);
      console.log(`[Minor Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their punishment has been recorded for processing when they rejoin.`
      );
    }
  } catch (error) {
    console.error('Error executing minor command:', error);
    await interaction.editReply('There was an error processing the command.');
  }
}
