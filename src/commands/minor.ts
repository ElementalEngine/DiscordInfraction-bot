import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordMinorInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('minor')
  .setDescription('Record a minor infraction for a member.')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user receiving a minor infraction.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the minor infraction.')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Minor Command] Execution started.');

  // Validate the channel and permissions.
  if (interaction.channel?.id !== config.discord.channels.suspendedChannel) {
    return interaction.editReply('This command can only be used in the suspended channel.');
  }

  const invoker = interaction.member as GuildMember;
  if (
    !invoker.roles.cache.has(config.discord.roles.moderator) &&
    !invoker.roles.cache.has(config.discord.roles.cplBackend)
  ) {
    return interaction.editReply('You do not have permission to use this command.');
  }

  // Retrieve target user, member (if present), and reason.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!;
  console.log(`[Minor Command] Target user: ${targetUser.id}.`);

  try {
    // Record a minor infraction.
    const result = await recordMinorInfraction(targetUser.id);

    // If the target is present in the guild...
    if (targetMember) {
      let dmMessage: string, channelMessage: string;
      if (result.tier === 1) {
        // Tier 1 minor infraction is a warning; no suspension roles applied.
        dmMessage = `Warning Notice:\nMember: <@${targetUser.id}>\nInfraction: **[TIER 1 MINOR]**\nResult: **Warning**\nReason: ${reason}`;
        channelMessage = `Suspension Notice:\nMember: <@${targetUser.id}>\nInfraction: **[TIER 1 MINOR]**\nResult: **Warning**\nReason: ${reason}`;
      } else if (result.tier < 7) {
        // For tiers above 1 (but below ban threshold), apply suspension roles.
        await RoleHandler.applySuspensionRoles(targetMember);
        dmMessage = buildSuspensionNotice('minor', result.tier, result.ends, reason, false);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'minor', result.tier, result.ends, reason, false);
      } else {
        // For tier 6 or above, process as a ban.
        await RoleHandler.applySuspensionRoles(targetMember);
        await recordBanDue(targetUser.id);
        dmMessage = buildSuspensionNotice('minor', result.tier, result.ends, reason, true);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'minor', result.tier, result.ends, reason, true);
      }
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
      await interaction.editReply(channelMessage);
    } else {
      // If the user is not in the guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'minor', reason);
      console.log(`[Minor Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their minor infraction has been recorded for processing when they rejoin.`
      );
    }
    console.log('[Minor Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing minor command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
