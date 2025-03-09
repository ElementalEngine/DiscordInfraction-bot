import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { SuspensionDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from './roleHandler';

const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000; // Approximate 3 months

export async function processSuspensionEvents(client: Client): Promise<void> {
  console.log('[Suspension Events] Starting suspension event check.');

  // Retrieve all SuspensionDue documents (now storing only the Discord ID).
  const docs = await SuspensionDue.find({});
  if (docs.length === 0) {
    console.log('[Suspension Events] No suspension due records found.');
    console.log('[Suspension Events] Suspension event check complete.');
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
    // Fetch the suspension record for this user.
    const record = await findOrCreateSuspensionByDiscordId(discordId);
    if (record.suspended) {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        // If the member is found, process suspension normally.
        await RoleHandler.suspendMember(member);
        console.log(`[Suspension Events] Processed suspension for ${discordId} (member found).`);
        const channel = client.channels.cache.get(config.discord.channels.suspendedChannel) as TextChannel;
        if (channel) {
          await channel.send(`<@${discordId}> has been suspended (due suspension).`);
        }
        await SuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Suspension Events] Removed suspension due document for ${discordId}.`);
      } else {
        // If the member is not found and the suspension end date is older than 3 months, clear the document.
        if (record.ends && (now.getTime() - new Date(record.ends).getTime() > THREE_MONTHS_MS)) {
          await SuspensionDue.deleteOne({ _id: discordId });
          console.log(`[Suspension Events] Cleared suspension record for ${discordId} (absent > 3 months).`);
        } else {
          console.warn(`[Suspension Events] ${discordId} not in guild; record remains for later processing.`);
        }
      }
    } else {
      // If the record shows the user is no longer suspended, remove the due document.
      await SuspensionDue.deleteOne({ _id: discordId });
      console.log(`[Suspension Events] Removed suspension due document for ${discordId} (record not suspended).`);
    }
  }

  console.log('[Suspension Events] Suspension event check complete.');
}
