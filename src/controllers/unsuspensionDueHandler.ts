import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { UnsuspensionDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from './roleHandler';

const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000;

/**
 * Processes unsuspensions based solely on the UnsuspensionDue table.
 */
export async function processUnsuspensionEvents(client: Client): Promise<void> {
  try {
    console.log('[Unsuspension Check] Starting unsuspension check.');
    
    const unsuspDueDocs = await UnsuspensionDue.find({});
    if (unsuspDueDocs.length === 0) {
      console.log('[Unsuspension Check] No unsuspension due records found.');
      return;
    }
    
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      console.error('[Unsuspension Check] Guild not found in cache.');
      return;
    }
    
    const now = new Date();
    for (const doc of unsuspDueDocs) {
      const discordId = doc._id;
      const suspensionRecord = await findOrCreateSuspensionByDiscordId(discordId);
      
      if (suspensionRecord.suspended) {
        const member = await guild.members.fetch(discordId).catch(() => null);
        
        if (member) {
          // Unsuspend the member immediately.
          await RoleHandler.unsuspendMember(member, suspensionRecord.suspendedRoles);
          suspensionRecord.suspended = false;
          suspensionRecord.suspendedRoles = [];
          suspensionRecord.ends = null;
          await suspensionRecord.save();
          
          const channel = client.channels.cache.get(config.discord.channels.suspendedChannel) as TextChannel;
          if (channel) {
            await channel.send(`<@${discordId}> unsuspended.`);
          }
          console.log(`[Unsuspension Check] Unsuspended user ${discordId} (member found).`);
          await UnsuspensionDue.deleteOne({ _id: discordId });
          console.log(`[Unsuspension Check] Removed unsuspension due document for ${discordId}.`);
        } else {
          // Member not found in the guild; check if the record is >3 months old.
          if (suspensionRecord.ends && now.getTime() - new Date(suspensionRecord.ends).getTime() > THREE_MONTHS_MS) {
            suspensionRecord.suspended = false;
            suspensionRecord.suspendedRoles = [];
            suspensionRecord.ends = null;
            await suspensionRecord.save();
            console.log(`[Unsuspension Check] Cleared suspension record for ${discordId} (absent > 3 months).`);
            await UnsuspensionDue.deleteOne({ _id: discordId });
            console.log(`[Unsuspension Check] Removed unsuspension due document for ${discordId}.`);
          }
        }
      } else {
        // Already unsuspended; remove the due document.
        await UnsuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Unsuspension Check] Removed unsuspension due document for ${discordId} (already unsuspended).`);
      }
    }
    
    console.log('[Unsuspension Check] Unsuspension check complete.');
  } catch (err) {
    console.error('[Unsuspension Check] Error processing unsuspensions:', err);
  }
}