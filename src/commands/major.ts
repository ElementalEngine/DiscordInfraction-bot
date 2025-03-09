import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordMajorInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('major')
  .setDescription('Record a major infraction for a member.')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('Select the user for a major infraction.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the major infraction.')
      .setRequired(true)
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

  // Get target user and try to get the GuildMember.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!;

  try {
    // Update the suspension record by recording a major infraction.
    const result = await recordMajorInfraction(targetUser.id);

    if (targetMember) {
      if (result.tier < 4) {  // Assuming major infraction ban threshold is tier 4.
        await RoleHandler.suspendMember(targetMember);
        const dmMessage = buildSuspensionNotice('major', result.tier, result.ends, reason, false);
        const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'major', result.tier, result.ends, reason, false);
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      } else {
        // Tier 4 reached: record ban due and notify moderators.
        await RoleHandler.suspendMember(targetMember);
        await recordBanDue(targetUser.id);
        const dmMessage = buildSuspensionNotice('major', result.tier, result.ends, reason, true);
        const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'major', result.tier, result.ends, reason, true);
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      }
    } else {
      // If the user is not in the guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'major');
      console.log(`[Major Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(`<@${targetUser.id}> is not in the guild. Their major infraction has been recorded for processing when they rejoin.`);
    }
  } catch (error) {
    console.error('Error executing major command:', error);
    await interaction.editReply('There was an error processing the command.');
  }
}
