import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { recordSuspensionDue, smurfSuspension } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildSuspensionNotice, buildSuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('smurf')
  .setDescription('Record a smurf infraction for a member (adds 30 days suspension).')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('Select the user to be suspended for a smurf infraction.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the smurf infraction (optional).')
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

  // Retrieve target user and (if available) the GuildMember.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  try {
    // Process a smurf suspension (flat 30-day hit).
    const newEnd = await smurfSuspension(targetUser.id);

    if (targetMember) {
      // If target is in the guild, process suspension via RoleHandler.
      await RoleHandler.suspendMember(targetMember);
      const dmMessage = buildSuspensionNotice('smurf', 1, newEnd, reason, false);
      const channelMessage = buildSuspensionChannelMessage(targetUser.id, 'smurf', 1, newEnd, reason, false);
      try {
        await targetMember.user.send(dmMessage);
      } catch (err) {
        console.error(`Failed to DM <@${targetUser.id}>:`, err);
      }
      await interaction.editReply(channelMessage);
    } else {
      // If target is not in the guild, record a suspension due document for later processing.
      await recordSuspensionDue(targetUser.id, 'smurf');
      console.log(`[Smuf Command] Recorded suspension due for absent user ${targetUser.id}.`);
      await interaction.editReply(
        `<@${targetUser.id}> is not in the guild. Their smurf suspension has been recorded for processing when they rejoin.`
      );
    }
  } catch (error) {
    console.error('Error executing smuf command:', error);
    await interaction.editReply('There was an error processing the command.');
  }
}
