import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from 'discord.js';
import { config } from '../config';
import { recordQuitInfraction, recordBanDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('quit')
  .setDescription('Record a quit infraction for a member.')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('Select the user who is quitting suspension.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the quit infraction (optional).')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  if (interaction.channel?.id !== config.discord.channels.suspendedChannel) {
    return interaction.editReply('This command can only be used in the suspended channel.');
  }

  const invoker = interaction.member as GuildMember;
  const hasPermission =
    invoker.roles.cache.has(config.discord.roles.moderator) ||
    invoker.roles.cache.has(config.discord.roles.cplBackend);
  if (!hasPermission) {
    return interaction.editReply('You do not have permission to use this command.');
  }

  const targetMember = interaction.options.getMember('target') as GuildMember;
  if (!targetMember) {
    return interaction.editReply('User not found!');
  }

  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  try {
    // Pre-check: fetch the current suspension record.
    const currentRecord = await findOrCreateSuspensionByDiscordId(targetMember.id);
    if (currentRecord.quit.tier >= 6) {
      return interaction.editReply(`<@${targetMember.id}> is already due to be banned.`);
    }

    const result = await recordQuitInfraction(targetMember.id);

    if (result.tier < 6) {
      await RoleHandler.suspendMember(targetMember);

      const dmMessage = buildSuspensionNotice('quit', result.tier, result.ends, reason, false);
      const channelMessage = buildSuspensionChannelMessage(targetMember.id, 'quit', result.tier, result.ends, reason, false);

      try {
        await targetMember.user.send(dmMessage);
      } catch (err) {
        console.error(`Failed to DM <@${targetMember.id}> about suspension.`);
      }

      await interaction.editReply(channelMessage);
    } else {
      // Tier 6 reached: record ban due and notify moderators.
      await RoleHandler.suspendMember(targetMember);
      await recordBanDue(targetMember.id);
      const dmMessage = buildSuspensionNotice('quit', result.tier, result.ends, reason, true);
      const channelMessage = buildSuspensionChannelMessage(targetMember.id, 'quit', result.tier, result.ends, reason, true);

      try {
        await targetMember.user.send(dmMessage);
      } catch (err) {
        console.error(`Failed to DM <@${targetMember.id}> about ban recommendation.`);
      }

      await interaction.editReply(channelMessage);
    }
  } catch (error) {
    console.error('Error executing quit command:', error);
    await interaction.editReply('There was an error processing the command.');
  }
}
