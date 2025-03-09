import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { SuspensionDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from './roleHandler';

/**
 * Processes suspension events.
 * For each document in SuspensionDue:
 *  - Retrieve the suspension record.
 *  - If the record is still marked as suspended, attempt to fetch the member.
 *    • If the member is found, call RoleHandler.suspendMember and notify in the suspended channel.
 *    • If not found, leave the document for later processing.
 *  - If the record is not suspended, remove the SuspensionDue document.
 */
export async function processSuspensionEvents(client: Client): Promise<void> {
  try {
    console.log('[Suspension Events] Starting suspension event check.');
    const docs = await SuspensionDue.find({});
    if (docs.length === 0) {
      console.log('[Suspension Events] No suspension due records found.');
      return;
    }
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      console.error('[Suspension Events] Guild not found in cache.');
      return;
    }
    for (const doc of docs) {
      const discordId = doc._id;
      const record = await findOrCreateSuspensionByDiscordId(discordId);
      if (record.suspended) {
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (member) {
          // Process suspension.
          await RoleHandler.suspendMember(member);
          console.log(`[Suspension Events] Processed suspension for ${discordId} (member found).`);
          const channel = client.channels.cache.get(config.discord.channels.suspendedChannel) as TextChannel;
          if (channel) {
            // Here you can customize the message further if needed.
            await channel.send(`<@${discordId}> has been suspended as per pending suspension event.`);
          }
          await SuspensionDue.deleteOne({ _id: discordId });
          console.log(`[Suspension Events] Removed suspension due document for ${discordId}.`);
        } else {
          console.warn(`[Suspension Events] ${discordId} not in guild; record remains for later processing.`);
        }
      } else {
        await SuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Suspension Events] Removed suspension due document for ${discordId} (record not suspended).`);
      }
    }
    console.log('[Suspension Events] Suspension event check complete.');
  } catch (err) {
    console.error('[Suspension Events] Error processing suspension events:', err);
  }
}
