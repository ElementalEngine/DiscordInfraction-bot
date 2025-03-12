import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { UnsuspensionDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from './roleHandler';

const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000; // Approximate 3 months

export async function processUnsuspensionEvents(client: Client): Promise<void> {
  console.log('[Unsuspension Check] Starting unsuspension check.');
  
  // Retrieve all documents from UnsuspensionDue
  const docs = await UnsuspensionDue.find({});
  if (docs.length === 0) {
    console.log('[Unsuspension Check] No unsuspension due records found.');
    console.log('[Unsuspension Check] Unsuspension check complete.');
    return;
  }
  
  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) {
    console.error('[Unsuspension Check] Guild not found in cache.');
    return;
  }
  
  const now = new Date();
  for (const doc of docs) {
    const discordId = doc._id;
    // Retrieve the suspension record for this user
    const record = await findOrCreateSuspensionByDiscordId(discordId);
    if (record.suspended) {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        await RoleHandler.unsuspendMember(member, record.suspendedRoles);
        record.suspended = false;
        record.suspendedRoles = [];
        record.ends = null;
        record.pendingUnsuspension = false; 
        await record.save();
        const channel = client.channels.cache.get(config.discord.channels.suspendedChannel) as TextChannel;
        if (channel) {
          await channel.send(`<@${discordId}> unsuspended.`);
        }
        console.log(`[Unsuspension Check] Unsuspended ${discordId}.`);
        await UnsuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Unsuspension Check] Removed unsuspension due document for ${discordId}.`);
      } else {
        // If member is not found and record is older than 3 months, clear the record.
        if (record.ends && now.getTime() - new Date(record.ends).getTime() > THREE_MONTHS_MS) {
          record.suspended = false;
          record.suspendedRoles = [];
          record.ends = null;
          record.pendingUnsuspension = false;
          await record.save();
          console.log(`[Unsuspension Check] Cleared record for ${discordId} (absent > 3 months).`);
          await UnsuspensionDue.deleteOne({ _id: discordId });
          console.log(`[Unsuspension Check] Removed unsuspension due document for ${discordId}.`);
        } else {
          console.warn(`[Unsuspension Check] ${discordId} not in guild; record remains for later processing.`);
        }
      }
    } else {
      await UnsuspensionDue.deleteOne({ _id: discordId });
      console.log(`[Unsuspension Check] Removed unsuspension due document for ${discordId} (already unsuspended).`);
    }
  }
  
  console.log('[Unsuspension Check] Unsuspension check complete.');
}