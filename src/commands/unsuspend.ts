import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { config } from '../config';
import { findOrCreateSuspensionByDiscordId, unsuspend, UnsuspensionDue, recordSuspensionDue } from '../database/mongo';
import { RoleHandler } from '../controllers/roleHandler';
import { buildUnsuspensionNotice, buildUnsuspensionChannelMessage } from '../controllers/messageHandler';

export const data = new SlashCommandBuilder()
  .setName('unsuspend')
  .setDescription('Manually unsuspend a member (override).')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Select the user to unsuspend.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for unsuspension.')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  console.log('[Unsuspend Command] Execution started.');

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
  const reason = interaction.options.getString('reason') || 'No reason provided';
  console.log(`[Unsuspend Command] Target user: ${targetUser.id}.`);

  try {
    // Check if the target is already processed for unsuspension (exists in UnsuspensionDue).
    const unsuspRecord = await UnsuspensionDue.findOne({ _id: targetUser.id });
    if (unsuspRecord) {
      return interaction.editReply(`<@${targetUser.id}> has already been processed for unsuspension.`);
    }

    // Retrieve the suspension record.
    const record = await findOrCreateSuspensionByDiscordId(targetUser.id);
    if (!record.suspended) {
      return interaction.editReply(`<@${targetUser.id}> is not currently suspended.`);
    }

    // If the member is in the guild, restore their roles.
    if (targetMember) {
      await RoleHandler.restoreMemberRoles(targetMember, record.suspendedRoles);
      console.log(`[Unsuspend Command] Restored roles for <@${targetUser.id}>.`);
    } else {
      console.warn(`<@${targetUser.id}> not found in guild; proceeding with DB update only.`);
    }

    // Clear the suspension record.
    await unsuspend(targetUser.id);

    // Optionally, remove any leftover override document (shouldn't be present if the check passed).
    await UnsuspensionDue.deleteOne({ _id: targetUser.id });
    console.log(`[Unsuspend Command] Updated suspension record for <@${targetUser.id}>.`);

    const dmMessage = buildUnsuspensionNotice(reason);
    const channelMessage = buildUnsuspensionChannelMessage(targetUser.id, reason);
    if (targetMember) {
      targetMember.user.send(dmMessage).catch(err => console.error(`Failed to DM <@${targetUser.id}>:`, err));
    }

    await interaction.editReply(channelMessage);
    console.log('[Unsuspend Command] Execution complete.');
  } catch (error) {
    console.error(`[Unsuspend Command] Error processing unsuspend for <@${targetUser.id}>:`, error);
    await interaction.editReply('There was an error processing the command.');
  }
}
