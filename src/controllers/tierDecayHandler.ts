import { Suspension } from '../database/mongo';

// Processes tier decay for all suspension records for each infraction category
export const processTierDecays = async (): Promise<void> => {
  try {
    console.log('[Tier Decay] Starting tier decay processing.');
    const records = await Suspension.find({});
    const now = new Date();
    const categories: Array<'quit' | 'minor' | 'moderate' | 'major' | 'extreme'> = [
      'quit', 'minor', 'moderate', 'major', 'extreme'
    ];

    for (const record of records) {
      let updated = false;
      for (const category of categories) {
        const infraction = record[category];
        if (infraction.tier > 0 && infraction.decays) {
          if (now > new Date(infraction.decays)) {
            infraction.tier = Math.max(infraction.tier - 1, 0);
            if (infraction.tier === 0) {
              infraction.decays = null;
            } else {
              // 1460 days for extreme infractions, 90 days for others.
              const newDecay = new Date();
              newDecay.setDate(newDecay.getDate() + (category === 'extreme' ? 1460 : 90));
              infraction.decays = newDecay;
            }
            updated = true;
            console.log(`[Tier Decay] Decayed ${category} for ${record.discord_id} to tier ${infraction.tier}.`);
          }
        }
      }
      if (updated) {
        await record.save();
      }
    }
    console.log('[Tier Decay] Tier decay processing complete.');
  } catch (error) {
    console.error('[Tier Decay] Error processing tier decays:', error);
  }
};
