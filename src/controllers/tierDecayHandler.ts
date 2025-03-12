import { Suspension } from '../database/mongo';

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
          const decayDate = new Date(infraction.decays);
          if (now > decayDate) {

            infraction.tier = Math.max(infraction.tier - 1, 0);

            if (infraction.tier === 0) {
              infraction.decays = null;
            } else {
              const daysToAdd = category === 'extreme' ? 1460 : 90;
              const newDecay = new Date(now.getTime());
              newDecay.setDate(newDecay.getDate() + daysToAdd);
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
