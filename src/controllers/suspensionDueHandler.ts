import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { SuspensionDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from './roleHandler';

const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000; // Approximate 3 months

export async function processSuspensionEvents(client: Client): Promise<void> {
  console.log('[Suspension Events] Starting suspension event check.');

  // Retrieve all SuspensionDue documents.
  const docs = await SuspensionDue.find({});
  if (!docs.length) {
    console.log('[Suspension Events] No suspension due records found.');
    return;
  }

  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) {
    console.error('[Suspension Events] Guild not found in cache.');
    return;
  }

  const now = new Date();
  for (const doc of docs) {
    const discordId = doc._id;
    const record = await findOrCreateSuspensionByDiscordId(discordId);

    if (record.suspended) {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        await RoleHandler.applySuspensionRoles(member);
        console.log(`[Suspension Events] Processed suspension for ${discordId} (member found).`);

        // Notify the designated channel.
        const channel = client.channels.cache.get(config.discord.channels.suspendedChannel) as TextChannel;
        if (channel) {
          await channel.send(`<@${discordId}> has been suspended (due suspension).`);
        }
        // Remove the due document.
        await SuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Suspension Events] Removed suspension due document for ${discordId}.`);
      } else if (record.ends && now.getTime() - new Date(record.ends).getTime() > THREE_MONTHS_MS) {
        await SuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Suspension Events] Cleared suspension record for ${discordId} (absent > 3 months).`);
      } else {
        console.warn(`[Suspension Events] ${discordId} not in guild; record remains for later processing.`);
      }
    } else {
      await SuspensionDue.deleteOne({ _id: discordId });
      console.log(`[Suspension Events] Removed suspension due document for ${discordId} (record not suspended).`);
    }
  }

  console.log('[Suspension Events] Suspension event check complete.');
}
