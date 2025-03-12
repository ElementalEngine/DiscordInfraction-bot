import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordExtremeInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('extreme')
  .setDescription('Record an extreme infraction for a member.')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user for an extreme infraction.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the extreme infraction.')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Extreme Command] Execution started.');

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

  // Retrieve target user and reason.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!;
  console.log(`[Extreme Command] Target user: ${targetUser.id}.`);

  try {
    // Record an extreme infraction.
    const result = await recordExtremeInfraction(targetUser.id);

    if (targetMember) {
      let dmMessage: string, channelMessage: string;
      if (result.tier < 2) {
        // Normal suspension processing for extreme infraction.
        await RoleHandler.applySuspensionRoles(targetMember);
        dmMessage = buildSuspensionNotice('extreme', result.tier, result.ends, reason, false);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'extreme', result.tier, result.ends, reason, false);
      } else {
        // Tier 2 or above: trigger ban processing.
        await RoleHandler.applySuspensionRoles(targetMember);
        await recordBanDue(targetUser.id);
        dmMessage = buildSuspensionNotice('extreme', result.tier, result.ends, reason, true);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'extreme', result.tier, result.ends, reason, true);
      }
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
      await interaction.editReply(channelMessage);
    } else {
      // If target not in guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'extreme');
      console.log(`[Extreme Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their extreme infraction has been recorded for processing when they rejoin.`
      );
    }
    console.log('[Extreme Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing extreme command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}