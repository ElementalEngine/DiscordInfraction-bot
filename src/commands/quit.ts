import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordQuitInfraction, recordBanDue, recordSuspensionDue} from '../database/mongo';
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

  // Ensure command is used in the suspended channel.
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

  // Always get the target as a User, then try to get the GuildMember.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  try {
    // Update the suspension record by recording a quit infraction.
    const result = await recordQuitInfraction(targetUser.id);

    if (targetMember) {
      // If the target is in the guild, process the suspension normally.
      if (result.tier < 6) {
        await RoleHandler.suspendMember(targetMember);
        const dmMessage = buildSuspensionNotice('quit', result.tier, result.ends, reason, false);
        const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'quit', result.tier, result.ends, reason, false);
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      } else {
        // If tier 6 is reached, record ban due and process accordingly.
        await RoleHandler.suspendMember(targetMember);
        await recordBanDue(targetUser.id);
        const dmMessage = buildSuspensionNotice('quit', result.tier, result.ends, reason, true);
        const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'quit', result.tier, result.ends, reason, true);
        try {
          await targetMember.user.send(dmMessage);
        } catch (err) {
          console.error(`Failed to DM <@${targetUser.id}>:`, err);
        }
        await interaction.editReply(channelMessage);
      }
    } else {
      // If the user is not in the guild, record a SuspensionDue document.
      await recordSuspensionDue(targetUser.id, 'quit');
      console.log(`[Quit Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(`<@${targetUser.id}> is not in the guild. Their punishment has been recorded for processing when they rejoin.`);
    }
  } catch (error) {
    console.error('Error executing quit command:', error);
    await interaction.editReply('There was an error processing the command.');
  }
}