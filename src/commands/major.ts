import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordMajorInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('major')
  .setDescription('Record a major infraction for a member.')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user for a major infraction.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the major infraction.')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Major Command] Execution started.');

  // Validate channel and permissions.
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

  // Retrieve target user, member, and reason.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!;
  console.log(`[Major Command] Target user: ${targetUser.id}.`);

  try {
    // Record the major infraction and retrieve the new tier and suspension end date.
    const result = await recordMajorInfraction(targetUser.id);

    if (targetMember) {
      let dmMessage: string, channelMessage: string;
      if (result.tier < 4) {
        // For tier less than 4, apply suspension normally.
        await RoleHandler.applySuspensionRoles(targetMember);
        dmMessage = buildSuspensionNotice('major', result.tier, result.ends, reason, false);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'major', result.tier, result.ends, reason, false);
      } else {
        // For tier 4 or above, record a ban.
        await RoleHandler.applySuspensionRoles(targetMember);
        await recordBanDue(targetUser.id);
        dmMessage = buildSuspensionNotice('major', result.tier, result.ends, reason, true);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'major', result.tier, result.ends, reason, true);
      }
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
      await interaction.editReply(channelMessage);
    } else {
      // If the user is not in the guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'major');
      console.log(`[Major Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their major infraction has been recorded for processing when they rejoin.`
      );
    }
    console.log('[Major Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing major command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
