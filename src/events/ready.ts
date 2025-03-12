import { Client, Events } from 'discord.js';
import { processSuspensionEvents } from '../controllers/suspensionDueHandler';
import { processUnsuspensionEvents } from '../controllers/unsuspensionDueHandler';
import { processTierDecays } from '../controllers/tierDecayHandler';

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: Client) => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);

  const cycleDelay = 2 * 60 * 1000; // 2 minutes

  const runCycle = async (): Promise<void> => {
    try {
      console.log('[Cycle] Starting background tasks.');
      await processUnsuspensionEvents(client);
      await processSuspensionEvents(client);
      await processTierDecays();
      console.log('[Cycle] Background tasks complete.');
    } catch (error) {
      console.error('[Cycle] Error during background tasks:', error);
    } finally {
      setTimeout(runCycle, cycleDelay);
    }
  };

  // Start the cycle.
  runCycle();
};
