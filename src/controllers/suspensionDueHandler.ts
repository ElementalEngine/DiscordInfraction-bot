import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { SuspensionDue, findOrCreateSuspensionByDiscordId } from '../database/mongo';
import { RoleHandler } from './roleHandler';

export async function processSuspensionEvents(client: Client): Promise<void> {
  console.log('[Suspension Events] Starting suspension event check.');

  // Retrieve all documents from SuspensionDue.
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

  for (const doc of docs) {
    const discordId = doc._id;
    // Get additional punishment details if stored.
    const punishmentType = doc.punishmentType || 'unspecified';
    const reason = doc.reason || 'No reason provided';

    // Fetch the suspension record for this user.
    const record = await findOrCreateSuspensionByDiscordId(discordId);
    if (record.suspended) {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member) {
        // Process the suspension by updating roles.
        await RoleHandler.suspendMember(member);
        console.log(`[Suspension Events] Processed suspension for ${discordId} (member found).`);
        const channel = client.channels.cache.get(config.discord.channels.suspendedChannel) as TextChannel;
        if (channel) {
          await channel.send(`<@${discordId}> has been suspended for ${punishmentType}. Reason: ${reason}`);
        }
        await SuspensionDue.deleteOne({ _id: discordId });
        console.log(`[Suspension Events] Removed suspension due document for ${discordId}.`);
      } else {
        console.warn(`[Suspension Events] ${discordId} not in guild; record remains for later processing.`);
      }
    } else {
      // If the record shows the user is no longer suspended, remove the due document.
      await SuspensionDue.deleteOne({ _id: discordId });
      console.log(`[Suspension Events] Removed suspension due document for ${discordId} (record not suspended).`);
    }
  }
  console.log('[Suspension Events] Suspension event check complete.');
}
