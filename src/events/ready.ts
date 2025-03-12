import { Client, Events } from 'discord.js';
import { processSuspensionEvents } from '../controllers/suspensionDueHandler';
import { processUnsuspensionEvents } from '../controllers/unsuspensionDueHandler';
import { processTierDecays } from '../controllers/tierDecayHandler';
import { queueExpiredUnsuspensions } from '../database/mongo';

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: Client) => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);

  const fastCycleDelay = 2 * 60 * 1000; // 2 minutes
  const slowCycleDelay = 5 * 60 * 1000; // 5 minutes

  // Fast cycle: runs queueExpiredUnsuspensions every 2 minutes.
  const runFastCycle = async (): Promise<void> => {
    try {
      console.log('[Fast Cycle] Starting queueExpiredUnsuspensions.');
      await queueExpiredUnsuspensions();
      console.log('[Fast Cycle] queueExpiredUnsuspensions complete.');
    } catch (error) {
      console.error('[Fast Cycle] Error in queueExpiredUnsuspensions:', error);
    } finally {
      setTimeout(runFastCycle, fastCycleDelay);
    }
  };

  // Slow cycle: runs suspension and unsuspension events and tier decays every 5 minutes.
  const runSlowCycle = async (): Promise<void> => {
    try {
      console.log('[Slow Cycle] Starting background tasks.');
      await processSuspensionEvents(client);
      await processUnsuspensionEvents(client);
      await processTierDecays();
      console.log('[Slow Cycle] Background tasks complete.');
    } catch (error) {
      console.error('[Slow Cycle] Error during background tasks:', error);
    } finally {
      setTimeout(runSlowCycle, slowCycleDelay);
    }
  };

  runFastCycle();
  runSlowCycle();
};
