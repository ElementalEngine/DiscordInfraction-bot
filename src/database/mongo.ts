import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../config';

/* ========================================================
    0. DATABASE CONNECTION
   ======================================================== */

/**
 * Connects to MongoDB using the URL from the configuration.
 * Example URL: mongodb://localhost:27017/players
 */
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

export interface IInfraction extends Document {
  tier: number;
  decays: Date | null;
}

export const InfractionSchema = new Schema<IInfraction>(
  {
    tier: { type: Number, default: 0 },
    decays: { type: Date, default: null },
  },
  { _id: false } // Disable automatic _id for subdocuments
);

/* ========================================================
    2. MODELS
   ======================================================== */

// Suspension model – holds infraction details, suspended flag, end date, and cached roles.
export interface ISuspension extends Document {
  discord_id: string;
  suspended: boolean;
  ends: Date | null;
  suspendedRoles: string[];
  quit: IInfraction;
  minor: IInfraction;
  moderate: IInfraction;
  major: IInfraction;
  extreme: IInfraction;
}

const SuspensionSchema: Schema = new Schema({
  discord_id: { type: String, required: true, unique: true },
  suspended: { type: Boolean, default: false },
  ends: { type: Date, default: null },
  suspendedRoles: { type: [String], default: [] },
  quit: { type: InfractionSchema, default: { tier: 0, decays: null } },
  minor: { type: InfractionSchema, default: { tier: 0, decays: null } },
  moderate: { type: InfractionSchema, default: { tier: 0, decays: null } },
  major: { type: InfractionSchema, default: { tier: 0, decays: null } },
  extreme: { type: InfractionSchema, default: { tier: 0, decays: null } },
});

export const Suspension: Model<ISuspension> = mongoose.model<ISuspension>('Suspension', SuspensionSchema);

// Minimal model for "due" collections (storing only the Discord ID)
export interface IMinimal extends Document {
  _id: string;
}

const MinimalSchema: Schema = new Schema({
  _id: { type: String, required: true }
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

/**
 * Updates a suspension record.
 */
export const updateSuspension = async (discordId: string, update: Record<string, any>) => {
  return await Suspension.updateOne({ discord_id: discordId }, { $set: update });
};

/**
 * Records a ban due by inserting a minimal document.
 */
export const recordBanDue = async (discordId: string): Promise<void> => {
  try {
    await BanDue.create({ _id: discordId });
  } catch (err: any) {
    if (err.code !== 11000) console.error(`Error recording ban due for ${discordId}:`, err);
  }
};

/**
 * Records a suspension due.
 */
export const recordSuspensionDue = async (discordId: string): Promise<void> => {
  try {
    await SuspensionDue.create({ _id: discordId });
  } catch (err: any) {
    if (err.code !== 11000) console.error(`Error recording suspension due for ${discordId}:`, err);
  }
};

/**
 * Records an unsuspension due.
 */
export const recordUnsuspensionDue = async (discordId: string): Promise<void> => {
  try {
    await UnsuspensionDue.create({ _id: discordId });
  } catch (err: any) {
    if (err.code !== 11000) console.error(`Error recording unsuspension due for ${discordId}:`, err);
  }
};

/**
 * Checks if a ban is due.
 */
export const isBanDue = async (discordId: string): Promise<boolean> => {
  try {
    const result = await BanDue.deleteOne({ _id: discordId });
    return result.deletedCount > 0;
  } catch (err) {
    console.error(`Error checking ban due for ${discordId}:`, err);
    return false;
  }
};

/**
 * Checks if a suspension is due.
 */
export const isSuspensionDue = async (discordId: string): Promise<boolean> => {
  try {
    const result = await SuspensionDue.deleteOne({ _id: discordId });
    return result.deletedCount > 0;
  } catch (err) {
    console.error(`Error checking suspension due for ${discordId}:`, err);
    return false;
  }
};

/**
 * Checks if an unsuspension is due.
 */
export const isUnsuspensionDue = async (discordId: string): Promise<boolean> => {
  try {
    const result = await UnsuspensionDue.deleteOne({ _id: discordId });
    return result.deletedCount > 0;
  } catch (err) {
    console.error(`Error checking unsuspension due for ${discordId}:`, err);
    return false;
  }
};

/* ========================================================
    4. SUSPENSION & INFRACTION OPERATIONS
   ======================================================== */

/**
 * Adds a number of days to the suspension end date and marks the player as suspended.
 */
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

/**
 * Removes a number of days from the suspension end date.
 */
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

/**
 * Applies a sub-suspension by adding 3 days.
 */
export const subSuspension = async (discordId: string): Promise<Date> => {
  try {
    return await addDays(discordId, 3);
  } catch (error) {
    console.error(`Error applying sub-suspension for ${discordId}:`, error);
    throw error;
  }
};

/**
 * Applies a smurf suspension by adding 30 days.
 */
export const smurfSuspension = async (discordId: string): Promise<Date> => {
  try {
    return await addDays(discordId, 30);
  } catch (error) {
    console.error(`Error applying smurf suspension for ${discordId}:`, error);
    throw error;
  }
};

/**
 * Applies a competition suspension by adding 7 days.
 */
export const compSuspension = async (discordId: string): Promise<Date> => {
  try {
    return await addDays(discordId, 7);
  } catch (error) {
    console.error(`Error applying competition suspension for ${discordId}:`, error);
    throw error;
  }
};

/**
 * Unsuspends the player by clearing the suspended flag and end date.
 */
export const unsuspend = async (discordId: string): Promise<void> => {
  try {
    await updateSuspension(discordId, { suspended: false, ends: null });
  } catch (error) {
    console.error(`Error unsuspending ${discordId}:`, error);
    throw error;
  }
};

/**
 * Updates the suspended roles in the record.
 */
export const updateSuspendedRoles = async (discordId: string, rolesArray: string[]): Promise<void> => {
  try {
    await updateSuspension(discordId, { suspendedRoles: rolesArray });
  } catch (error) {
    console.error(`Error updating suspended roles for ${discordId}:`, error);
    throw error;
  }
};

/**
 * Retrieves the suspended roles from the record.
 */
export const getSuspendedRoles = async (discordId: string): Promise<string[]> => {
  try {
    const record: ISuspension = await findOrCreateSuspensionByDiscordId(discordId);
    return record.suspendedRoles || [];
  } catch (error) {
    console.error(`Error retrieving suspended roles for ${discordId}:`, error);
    throw error;
  }
};

/**
 * Clears the suspended roles in the record.
 */
export const clearSuspendedRoles = async (discordId: string): Promise<void> => {
  try {
    await updateSuspension(discordId, { $unset: { suspendedRoles: "" } });
  } catch (error) {
    console.error(`Error clearing suspended roles for ${discordId}:`, error);
    throw error;
  }
};

/**
 * function to record an infraction.
 */
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

    // Define suspension durations (in days) for each tier (if the tier is below the ban threshold).
    const durations: { [key in 'quit' | 'minor' | 'moderate' | 'major' | 'extreme']: number[] } = {
      // quit: Tier 1: 1, Tier 2: 3, Tier 3: 7, Tier 4: 14, Tier 5: 30
      quit: [1, 3, 7, 14, 30],
      // minor: Tier 1: Warning (0), Tier 2: 1, Tier 3: 2, Tier 4: 4, Tier 5: 7, Tier 6: 14
      minor: [0, 1, 2, 4, 7, 14],
      // moderate: Tier 1: 1, Tier 2: 4, Tier 3: 7, Tier 4: 14, Tier 5: 30
      moderate: [1, 4, 7, 14, 30],
      // major: Tier 1: 7, Tier 2: 14, Tier 3: 30
      major: [7, 14, 30],
      // extreme: Tier 1: 30
      extreme: [30],
    };

    const record = await findOrCreateSuspensionByDiscordId(discordId);
    const currentTier: number = record[category]?.tier ?? 0;

    let newTier: number = Math.min(currentTier + 1, caps[category]);

    const now = new Date();
    const currentEnd = record.ends && new Date(record.ends) > now ? new Date(record.ends) : now;
    
    // Determine suspension duration based on new tier (if below the ban threshold).
    let daysToAdd = 0;
    if (newTier <= durations[category].length) {
      daysToAdd = durations[category][newTier - 1];
    }
    currentEnd.setDate(currentEnd.getDate() + daysToAdd);

    // Set decay period: for extreme infractions, 4 years (1460 days); otherwise, 90 days.
    const decays = new Date();
    decays.setDate(decays.getDate() + (category === 'extreme' ? 1460 : 90));

    // For minor infractions, if tier is 1 (warning) then do not mark as suspended.
    const suspended = !(category === 'minor' && newTier === 1);

    const updateObj: Record<string, any> = {
      [`${category}.tier`]: newTier,
      [`${category}.decays`]: decays,
      ends: currentEnd,
      suspended: suspended,
    };

    await updateSuspension(discordId, updateObj);
    return { tier: newTier, ends: currentEnd };
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
