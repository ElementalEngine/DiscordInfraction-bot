import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordModerateInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('moderate')
  .setDescription('Record a moderate infraction for a member.')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user for a moderate infraction.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the moderate infraction.')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Moderate Command] Execution started.');

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

  // Retrieve target user, target member, and reason.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!;
  console.log(`[Moderate Command] Target user: ${targetUser.id}.`);

  try {
    // Record a moderate infraction.
    const result = await recordModerateInfraction(targetUser.id);

    // Process the infraction if the target is in the guild.
    if (targetMember) {
      await RoleHandler.applySuspensionRoles(targetMember);
      let dmMessage, channelMessage;
      if (result.tier < 6) {
        dmMessage = buildSuspensionNotice('moderate', result.tier, result.ends, reason, false);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'moderate', result.tier, result.ends, reason, false);
      } else {
        // If tier 6 reached, record ban and process accordingly.
        await recordBanDue(targetUser.id);
        dmMessage = buildSuspensionNotice('moderate', result.tier, result.ends, reason, true);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'moderate', result.tier, result.ends, reason, true);
      }
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
      await interaction.editReply(channelMessage);
    } else {
      // If the user is not in the guild, record a suspensionDue document.
      await recordSuspensionDue(targetUser.id, 'moderate');
      console.log(`[Moderate Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(`<@${targetUser.id}> is not in the guild. Their moderate infraction has been recorded for processing when they rejoin.`);
    }
    console.log('[Moderate Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing moderate command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
