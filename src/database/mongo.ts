import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../config';

/* ========================================================
    0. DATABASE CONNECTION
   ======================================================== */
// Connects to the MongoDB database.
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoDb);
    console.log(`Connected to MongoDB at ${config.mongoDb}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

/* ========================================================
    1. INFRACTION DEFINITIONS
   ======================================================== */
// Infraction model – holds tier and decay date.
export interface IInfraction extends Document {
  tier: number;
  decays: Date | null;
}

export const InfractionSchema = new Schema<IInfraction>(
  {
    tier: { type: Number, default: 0 },
    decays: { type: Date, default: null },
  },
  { _id: false }
);

/* ========================================================
    2. MODELS
   ======================================================== */
// Suspension model – holds infraction details, suspended flag, end date, cached roles,
// and our new flag pendingUnsuspension to track if unsuspension processing is pending.
export interface ISuspension extends Document {
  discord_id: string;
  suspended: boolean;
  ends: Date | null;
  pendingUnsuspension: boolean;
  suspendedRoles: string[];
  quit: IInfraction;
  minor: IInfraction;
  moderate: IInfraction;
  major: IInfraction;
  extreme: IInfraction;
}
// Disable minimization so that fields with default values (like pendingUnsuspension) are explicitly stored.
const SuspensionSchema: Schema = new Schema({
  discord_id: { type: String, required: true, unique: true },
  suspended: { type: Boolean, default: false },
  ends: { type: Date, default: null },
  pendingUnsuspension: { type: Boolean, default: false },
  suspendedRoles: { type: [String], default: [] },
  quit: { type: InfractionSchema, default: { tier: 0, decays: null } },
  minor: { type: InfractionSchema, default: { tier: 0, decays: null } },
  moderate: { type: InfractionSchema, default: { tier: 0, decays: null } },
  major: { type: InfractionSchema, default: { tier: 0, decays: null } },
  extreme: { type: InfractionSchema, default: { tier: 0, decays: null } },
}, { minimize: false });

export const Suspension: Model<ISuspension> = mongoose.model<ISuspension>('Suspension', SuspensionSchema);

// Minimal model for "due" collections (storing only the Discord ID)
export interface IMinimal extends Document {
  _id: string;
  createdAt?: Date;
}

const MinimalSchema: Schema = new Schema({
  _id: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const BanDue: Model<IMinimal> = mongoose.model<IMinimal>('BanDue', MinimalSchema, 'bans_due');
export const SuspensionDue: Model<IMinimal> = mongoose.model<IMinimal>('SuspensionDue', MinimalSchema, 'suspensions_due');
export const UnsuspensionDue: Model<IMinimal> = mongoose.model<IMinimal>('UnsuspensionDue', MinimalSchema, 'unsuspensions_due');

/* ========================================================
    3. QUERIES & HELPER FUNCTIONS
   ======================================================== */
/**
 * Finds a suspension record by Discord ID.
 * If it doesn't exist, creates one with default values.
 */
export const findOrCreateSuspensionByDiscordId = async (discordId: string): Promise<ISuspension> => {
  let suspension = await Suspension.findOne({ discord_id: discordId });
  if (!suspension) {
    suspension = await Suspension.create({
      discord_id: discordId,
      suspended: false,
      ends: null,
      pendingUnsuspension: false, 
      suspendedRoles: [],
      quit: { tier: 0, decays: null },
      minor: { tier: 0, decays: null },
      moderate: { tier: 0, decays: null },
      major: { tier: 0, decays: null },
      extreme: { tier: 0, decays: null },
    });
  }
  return suspension;
};

// Updates a suspension record.
export const updateSuspension = async (discordId: string, update: Record<string, any>) => {
  return await Suspension.updateOne({ discord_id: discordId }, { $set: update });
};

// Records a ban due by inserting a minimal document.
export const recordBanDue = async (discordId: string): Promise<void> => {
  try {
    await BanDue.create({ _id: discordId });
  } catch (err: any) {
    if (err.code !== 11000) console.error(`Error recording ban due for ${discordId}:`, err);
  }
};

/**
 * Records a suspension due.
 * Now accepts punishmentType and reason to store additional details.
 */
export const recordSuspensionDue = async (
  discordId: string,
  punishmentType: string,
  reason?: string
): Promise<void> => {
  try {
    await SuspensionDue.updateOne(
      { _id: discordId },
      { $set: { _id: discordId, punishmentType, reason } },
      { upsert: true }
    );
  } catch (err: any) {
    if (err.code !== 11000) console.error(`Error recording suspension due for ${discordId}:`, err);
  }
};

// Records an unsuspension due.
export const recordUnsuspensionDue = async (discordId: string): Promise<void> => {
  try {
    await UnsuspensionDue.create({ _id: discordId });
  } catch (err: any) {
    if (err.code !== 11000) console.error(`Error recording unsuspension due for ${discordId}:`, err);
  }
};

/* ========================================================
    4. SUSPENSION & INFRACTION OPERATIONS
   ======================================================== */
// Adds a number of days to the suspension end date and marks the player as suspended.
export const addDays = async (discordId: string, num: number): Promise<Date> => {
  try {
    const record: ISuspension = await findOrCreateSuspensionByDiscordId(discordId);
    const now = new Date();
    const currentEnd = record.ends && new Date(record.ends) > now ? new Date(record.ends) : now;
    currentEnd.setDate(currentEnd.getDate() + num);
    await updateSuspension(discordId, { suspended: true, ends: currentEnd });
    return currentEnd;
  } catch (error) {
    console.error(`Error adding ${num} days for ${discordId}:`, error);
    throw error;
  }
};

// Removes a number of days from the suspension end date.
export const rmDays = async (discordId: string, num: number): Promise<Date | null> => {
  try {
    const record: ISuspension = await findOrCreateSuspensionByDiscordId(discordId);
    if (!record.ends) return null;
    const newEnd = new Date(record.ends);
    newEnd.setDate(newEnd.getDate() - num);
    await updateSuspension(discordId, { ends: newEnd });
    return newEnd;
  } catch (error) {
    console.error(`Error removing ${num} days for ${discordId}:`, error);
    throw error;
  }
};

export const removeTierInfraction = async (
  discordId: string,
  category: 'quit' | 'minor' | 'moderate' | 'major' | 'extreme'
): Promise<{ tier: number; decays: Date | null }> => {
  try {
    // Fetch or create the suspension record.
    const record = await findOrCreateSuspensionByDiscordId(discordId);
    const currentTier: number = record[category]?.tier ?? 0;
    
    // If already at tier 0, return current state.
    if (currentTier <= 0) {
      console.log(`[removeTierInfraction] ${discordId} already has 0 tier for ${category}.`);
      return { tier: 0, decays: null };
    }
    
    const newTier = currentTier - 1;
    const now = new Date();
    
    // Reset decay date: if newTier > 0, set to 90 days from now; otherwise, clear it.
    const newDecay = newTier > 0 ? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) : null;
    
    // Build the update object.
    const updateObj: Record<string, any> = {
      [`${category}.tier`]: newTier,
      [`${category}.decays`]: newDecay
    };
    
    await updateSuspension(discordId, updateObj);
    console.log(`[removeTierInfraction] Updated ${discordId} ${category} tier to ${newTier}.`);
    return { tier: newTier, decays: newDecay };
  } catch (error) {
    console.error(`Error removing tier for ${discordId} in category ${category}:`, error);
    throw error;
  }
};

// Applies a sub-suspension by adding 3 days.
export const subSuspension = async (discordId: string): Promise<Date> => {
  try {
    return await addDays(discordId, 3);
  } catch (error) {
    console.error(`Error applying sub-suspension for ${discordId}:`, error);
    throw error;
  }
};

// Applies a smurf suspension by adding 30 days.
export const smurfSuspension = async (discordId: string): Promise<Date> => {
  try {
    return await addDays(discordId, 30);
  } catch (error) {
    console.error(`Error applying smurf suspension for ${discordId}:`, error);
    throw error;
  }
};

// Applies a competition suspension by adding 7 days.
export const compSuspension = async (discordId: string): Promise<Date> => {
  try {
    return await addDays(discordId, 7);
  } catch (error) {
    console.error(`Error applying competition suspension for ${discordId}:`, error);
    throw error;
  }
};

// Unsuspends the player by clearing the suspended flag and end date.
// This function is called by the unsuspension event process.
export const unsuspend = async (discordId: string): Promise<void> => {
  try {
    await updateSuspension(discordId, { suspended: false, ends: null, pendingUnsuspension: false });
  } catch (error) {
    console.error(`Error unsuspending ${discordId}:`, error);
    throw error;
  }
};

// Updates the suspended roles in the record.
export const updateSuspendedRoles = async (discordId: string, rolesArray: string[]): Promise<void> => {
  try {
    await updateSuspension(discordId, { suspendedRoles: rolesArray });
  } catch (error) {
    console.error(`Error updating suspended roles for ${discordId}:`, error);
    throw error;
  }
};

// Retrieves the suspended roles from the record.
export const getSuspendedRoles = async (discordId: string): Promise<string[]> => {
  try {
    const record: ISuspension = await findOrCreateSuspensionByDiscordId(discordId);
    return record.suspendedRoles || [];
  } catch (error) {
    console.error(`Error retrieving suspended roles for ${discordId}:`, error);
    throw error;
  }
};

// Clears the suspended roles in the record.
export const clearSuspendedRoles = async (discordId: string): Promise<void> => {
  try {
    await updateSuspension(discordId, { $unset: { suspendedRoles: "" } });
  } catch (error) {
    console.error(`Error clearing suspended roles for ${discordId}:`, error);
    throw error;
  }
};

// Records an infraction and updates the suspension record.
async function recordInfraction(
  discordId: string,
  category: 'quit' | 'minor' | 'moderate' | 'major' | 'extreme'
): Promise<{ tier: number; ends: Date }> {
  try {
    const caps: { [key in 'quit' | 'minor' | 'moderate' | 'major' | 'extreme']: number } = {
      quit: 6,
      minor: 7,
      moderate: 6,
      major: 4,
      extreme: 2,
    };

    // Define suspension durations (in days) for each tier.
    const durations: { [key in 'quit' | 'minor' | 'moderate' | 'major' | 'extreme']: number[] } = {
      quit: [1, 3, 7, 14, 30],
      minor: [0, 1, 2, 4, 7, 14],
      moderate: [1, 4, 7, 14, 30],
      major: [7, 14, 30],
      extreme: [30],
    };

    const record = await findOrCreateSuspensionByDiscordId(discordId);
    const currentTier: number = record[category]?.tier ?? 0;
    let newTier: number = Math.min(currentTier + 1, caps[category]);

    const now = new Date();
    const currentEnd = record.ends && new Date(record.ends) > now ? new Date(record.ends) : now;
    
    let daysToAdd = 0;
    if (newTier <= durations[category].length) {
      daysToAdd = durations[category][newTier - 1];
    }
    currentEnd.setDate(currentEnd.getDate() + daysToAdd);

    // Set decay period.
    const decays = new Date();
    decays.setDate(decays.getDate() + (category === 'extreme' ? 1460 : 90));

    // For minor infractions (warning), do not mark as suspended.
    const suspended = !(category === 'minor' && newTier === 1);

    const updateObj: Record<string, any> = {
      [`${category}.tier`]: newTier,
      [`${category}.decays`]: decays,
      suspended: suspended,
    };

    let retEnds: Date;
    if (category === 'minor' && newTier === 1) {
      updateObj.ends = null;
      retEnds = now;
    } else {
      updateObj.ends = currentEnd;
      retEnds = currentEnd;
      updateObj.pendingUnsuspension = false;
    }

    await updateSuspension(discordId, updateObj);
    return { tier: newTier, ends: retEnds };
  } catch (error) {
    console.error(`Error recording ${category} infraction for ${discordId}:`, error);
    throw error;
  }
}

export const recordQuitInfraction = async (discordId: string) => {
  return await recordInfraction(discordId, 'quit');
};

export const recordMinorInfraction = async (discordId: string) => {
  return await recordInfraction(discordId, 'minor');
};

export const recordModerateInfraction = async (discordId: string) => {
  return await recordInfraction(discordId, 'moderate');
};

export const recordMajorInfraction = async (discordId: string) => {
  return await recordInfraction(discordId, 'major');
};

export const recordExtremeInfraction = async (discordId: string) => {
  return await recordInfraction(discordId, 'extreme');
};

/* ========================================================
    5. EXPIRED SUSPENSION CHECK
   ======================================================== */
/**
  * Checks for expired suspensions and moves them into UnsuspensionDue.
 */
export const checkExpiredSuspensions = async (): Promise<void> => {
  try {
    console.log('[Expired Suspensions] Starting expired suspension check.');
    const now = new Date();
    const expiredRecords = await Suspension.find({ 
      suspended: true, 
      pendingUnsuspension: true, 
      ends: { $lte: now } 
    });
    if (expiredRecords.length === 0) {
      console.log('[Expired Suspensions] No expired suspensions found.');
      console.log('[Expired Suspensions] Expired suspension check complete.');
      return;
    }
    for (const record of expiredRecords) {
      try {
        await UnsuspensionDue.updateOne(
          { _id: record.discord_id },
          { $set: { _id: record.discord_id } },
          { upsert: true }
        );
        const doc = await UnsuspensionDue.findOne({ _id: record.discord_id });
        console.log(`[Expired Suspensions] Moved ${record.discord_id} into UnsuspensionDue. Document created at: ${doc?.createdAt}`);
      } catch (upsertError: any) {
        console.error(`[Expired Suspensions] Error upserting UnsuspensionDue for ${record.discord_id}:`, upsertError);
      }
    }
    console.log('[Expired Suspensions] Expired suspension check complete.');
  } catch (error) {
    console.error('[Expired Suspensions] Error checking expired suspensions:', error);
  }
};