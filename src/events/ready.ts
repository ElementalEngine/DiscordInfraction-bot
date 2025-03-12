import { Client, Events } from 'discord.js';
import { checkExpiredSuspensions } from '../database/mongo';
import { processSuspensionEvents } from '../controllers/suspensionDueHandler';
import { processUnsuspensionEvents } from '../controllers/unsuspensionDueHandler';
import { processTierDecays } from '../controllers/tierDecayHandler';

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: Client) => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);

  const fastCycleDelay = 2 * 60 * 1000; 
  const slowCycleDelay = 5 * 60 * 1000; 
  
  // Fast cycle: Runs every 2 minutes.
  const runFastCycle = async (): Promise<void> => {
    try {
      console.log('[Fast Cycle] Starting fast cycle of background tasks.');
      await checkExpiredSuspensions();
      await processUnsuspensionEvents(client);
      console.log('[Fast Cycle] Fast cycle tasks complete.');
    } catch (error) {
      console.error('[Fast Cycle] Error during fast cycle:', error);
    } finally {
      setTimeout(runFastCycle, fastCycleDelay);
    }
  };
  
  // Slow cycle: Runs every 5 minutes.
  const runSlowCycle = async (): Promise<void> => {
    try {
      console.log('[Slow Cycle] Starting slow cycle of background tasks.');
      await processSuspensionEvents(client);
      await processTierDecays();
      console.log('[Slow Cycle] Slow cycle tasks complete.');
    } catch (error) {
      console.error('[Slow Cycle] Error during slow cycle:', error);
    } finally {
      setTimeout(runSlowCycle, slowCycleDelay);
    }
  };
  
  // Start both cycles
  runFastCycle();
  runSlowCycle();
};  