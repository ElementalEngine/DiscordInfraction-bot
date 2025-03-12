import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordQuitInfraction, recordBanDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('quit')
  .setDescription('Record a quit infraction for a member.')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user receiving a quit infraction.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the quit infraction (optional).')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Quit Command] Execution started.');

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
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  console.log(`[Quit Command] Target user: ${targetUser.id}.`);

  try {
    // Update the suspension record by recording a quit infraction.
    const result = await recordQuitInfraction(targetUser.id);

    if (targetMember) {
      let dmMessage: string, channelMessage: string;
      if (result.tier < 6) {
        await RoleHandler.applySuspensionRoles(targetMember);
        dmMessage = buildSuspensionNotice('quit', result.tier, result.ends, reason, false);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'quit', result.tier, result.ends, reason, false);
      } else {
        await RoleHandler.applySuspensionRoles(targetMember);
        await recordBanDue(targetUser.id);
        dmMessage = buildSuspensionNotice('quit', result.tier, result.ends, reason, true);
        channelMessage = buildSuspensionChannelMessage(targetUser.id, 'quit', result.tier, result.ends, reason, true);
      }
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
      await interaction.editReply(channelMessage);
    } else {
      // If the user is not in the guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'quit');
      console.log(`[Quit Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their punishment has been recorded for processing when they rejoin.`
      );
    }
    console.log('[Quit Command] Execution complete.');
  } catch (error) {
    console.error(`Error executing quit command for ${targetUser.id}:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}