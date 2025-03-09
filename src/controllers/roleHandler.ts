import { GuildMember } from 'discord.js';
import { config } from '../config';
import { updateSuspendedRoles } from '../database/mongo';

export class RoleHandler {
  // Returns the suspended role ID from configuration.
  static get suspendedRole(): string {
    return config.discord.roles.suspended;
  }

  // Returns the list of role IDs to remove when suspending a member.
  static get rolesToRemoveOnSuspension(): string[] {
    return [
      config.discord.roles.civ6Rank,
      config.discord.roles.civ7Rank,
      config.discord.roles.civ6Novice,
      config.discord.roles.cplTournament,
      config.discord.roles.cplCloud,
    ];
  }

  // Checks if the member already has the suspended role.
  static isMemberSuspended(member: GuildMember): boolean {
    return member.roles.cache.has(RoleHandler.suspendedRole);
  }

  // Suspends a member by:
  static async suspendMember(member: GuildMember): Promise<string[]> {
    console.log(`[RoleHandler] Suspending member ${member.id}.`);

    // Determine which roles the member currently has from the removal list.
    const rolesToRemove = RoleHandler.rolesToRemoveOnSuspension.filter(roleId =>
      member.roles.cache.has(roleId)
    );

    // Remove each role.
    for (const roleId of rolesToRemove) {
      try {
        await member.roles.remove(roleId);
        console.log(`[RoleHandler] Removed role ${roleId} from ${member.id}.`);
      } catch (error) {
        console.error(`[RoleHandler] Error removing role ${roleId} from ${member.id}:`, error);
      }
    }

    // Add the suspended role if not already present.
    if (!member.roles.cache.has(RoleHandler.suspendedRole)) {
      try {
        await member.roles.add(RoleHandler.suspendedRole);
        console.log(`[RoleHandler] Added suspended role to ${member.id}.`);
      } catch (error) {
        console.error(`[RoleHandler] Error adding suspended role to ${member.id}:`, error);
      }
    }

    // Update the DB with the removed roles.
    const sortedRoles = rolesToRemove.sort();
    try {
      await updateSuspendedRoles(member.id, sortedRoles);
      console.log(`[RoleHandler] Updated DB for ${member.id} with suspended roles: [${sortedRoles.join(', ')}].`);
    } catch (error) {
      console.error(`[RoleHandler] Error updating suspended roles for ${member.id}:`, error);
    }
    return sortedRoles;
  }

  // Unsuspends a member by:
  static async unsuspendMember(member: GuildMember, rolesToRestore: string[]): Promise<void> {
    console.log(`[RoleHandler] Unsuspending member ${member.id}.`);
    for (const roleId of rolesToRestore) {
      try {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
          console.log(`[RoleHandler] Restored role ${roleId} to ${member.id}.`);
        }
      } catch (error) {
        console.error(`[RoleHandler] Error restoring role ${roleId} to ${member.id}:`, error);
      }
    }
    if (member.roles.cache.has(RoleHandler.suspendedRole)) {
      try {
        await member.roles.remove(RoleHandler.suspendedRole);
        console.log(`[RoleHandler] Removed suspended role from ${member.id}.`);
      } catch (error) {
        console.error(`[RoleHandler] Error removing suspended role from ${member.id}:`, error);
      }
    }
  }
}
