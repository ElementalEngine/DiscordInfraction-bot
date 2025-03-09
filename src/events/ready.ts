import { Client, Events } from 'discord.js';
import { checkExpiredSuspensions } from '../database/mongo';
import { processSuspensionEvents } from '../controllers/suspensionDueHandler';
import { processUnsuspensionEvents } from '../controllers/unsuspensionDueHandler';
import { processTierDecays } from '../controllers/tierDecayHandler';

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: Client) => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);

  const cycleDelay = 9 * 60 * 1000; 

  // Asynchronous loop that runs all background tasks sequentially.
  const runCycle = async (): Promise<void> => {
    try {
      console.log('[Cycle] Starting cycle of background tasks.');
      await checkExpiredSuspensions();
      await processUnsuspensionEvents(client);
      await processSuspensionEvents(client);
      await processTierDecays();
      console.log('[Cycle] Background tasks cycle complete.');
    } catch (error) {
      console.error('[Cycle] Error during background task cycle:', error);
    } finally {
      setTimeout(runCycle, cycleDelay);
    }
  };

  runCycle();
};
