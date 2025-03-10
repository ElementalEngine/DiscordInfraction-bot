import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { findOrCreateSuspensionByDiscordId, unsuspend, clearSuspendedRoles } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildUnsuspensionNotice, buildUnsuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('unsuspend')
  .setDescription('Unsuspend a member.')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('Select the user to unsuspend.')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for unsuspension.')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Unsuspend Command] Execution started.');

  // Ensure the command is used in the suspended channel.
  if (interaction.channel?.id !== config.discord.channels.suspendedChannel) {
    console.log('[Unsuspend Command] Incorrect channel.');
    return interaction.editReply('This command can only be used in the suspended channel.');
  }

  // Check mod permissions.
  const invoker = interaction.member as GuildMember;
  const hasPermission = invoker.roles.cache.has(config.discord.roles.moderator) ||
                        invoker.roles.cache.has(config.discord.roles.cplBackend);
  if (!hasPermission) {
    console.log('[Unsuspend Command] Insufficient permissions.');
    return interaction.editReply('You do not have permission to use this command.');
  }

  // Retrieve target user and reason.
  const targetUser: User = interaction.options.getUser('target')!;
  const targetMember = interaction.options.getMember('target') as GuildMember | null;
  const reason = interaction.options.getString('reason')!;
  console.log(`[Unsuspend Command] Target user: ${targetUser.id}.`);

  try {
    // Retrieve the suspension record.
    const record = await findOrCreateSuspensionByDiscordId(targetUser.id);
    if (!record.suspended) {
      console.log(`[Unsuspend Command] <@${targetUser.id}> is not suspended.`);
      return interaction.editReply(`<@${targetUser.id}> is not currently suspended.`);
    }

    // If member is found in guild, restore roles.
    if (targetMember) {
      await RoleHandler.unsuspendMember(targetMember, record.suspendedRoles);
      console.log(`[Unsuspend Command] Restored roles for <@${targetUser.id}>.`);
    } else {
      console.warn(`[Unsuspend Command] <@${targetUser.id}> not found in guild; proceeding with DB update only.`);
    }

    // Update the suspension record in the database.
    await unsuspend(targetUser.id);
    await clearSuspendedRoles(targetUser.id);
    console.log(`[Unsuspend Command] Updated suspension record for <@${targetUser.id}>.`);

    // Build messages using unsuspension message functions.
    const dmMessage = buildUnsuspensionNotice(reason);
    const channelMessage = buildUnsuspensionChannelMessage(targetUser.id, reason);

    // Attempt to send a DM if the member is available.
    if (targetMember) {
      try {
        await targetMember.user.send(dmMessage);
        console.log(`[Unsuspend Command] DM sent to <@${targetUser.id}>.`);
      } catch (err) {
        console.error(`[Unsuspend Command] Failed to DM <@${targetUser.id}>:`, err);
      }
    }

    await interaction.editReply(channelMessage);
    console.log('[Unsuspend Command] Execution complete.');
  } catch (error) {
    console.error(`[Unsuspend Command] Error executing unsuspend command for <@${targetUser.id}>:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
