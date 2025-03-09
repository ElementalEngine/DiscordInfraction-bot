import { GuildMember } from 'discord.js';
import { config } from '../config';
import { updateSuspendedRoles } from '../database/mongo';

export class RoleHandler {
  static get suspendedRole(): string {
    return config.discord.roles.suspended;
  }

  // Returns the list of role IDs to remove during suspension.
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

  /**
   * Suspends a member:
   * - Removes configured roles and adds the suspended role.
   * - Sorts and stores the removed role IDs in the DB.
   * - Returns the sorted array of removed role IDs.
   */
  static async suspendMember(member: GuildMember): Promise<string[]> {
    try {
      const rolesToRemove = RoleHandler.rolesToRemoveOnSuspension.filter(roleId =>
        member.roles.cache.has(roleId)
      );

      for (const roleId of rolesToRemove) {
        try {
          await member.roles.remove(roleId);
        } catch (error) {
          console.error(`Error removing ${roleId} from ${member.id}:`, error);
        }
      }

      if (!member.roles.cache.has(RoleHandler.suspendedRole)) {
        try {
          await member.roles.add(RoleHandler.suspendedRole);
        } catch (error) {
          console.error(`Error adding suspended role to ${member.id}:`, error);
        }
      }

      const sortedRoles = rolesToRemove.sort();
      await updateSuspendedRoles(member.id, sortedRoles);
      console.log(`Suspended ${member.id} and stored roles: [${sortedRoles.join(', ')}].`);

      return sortedRoles;
    } catch (error) {
      console.error(`Error suspending ${member.id}:`, error);
      return [];
    }
  }

  /**
   * Unsuspends a member:
   * - Restores each cached role if missing.
   * - Removes the suspended role.
   */
  static async unsuspendMember(member: GuildMember, rolesToRestore: string[]): Promise<void> {
    try {
      for (const roleId of rolesToRestore) {
        try {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
          }
        } catch (error) {
          console.error(`Error restoring ${roleId} to ${member.id}:`, error);
        }
      }
      if (member.roles.cache.has(RoleHandler.suspendedRole)) {
        try {
          await member.roles.remove(RoleHandler.suspendedRole);
        } catch (error) {
          console.error(`Error removing suspended role from ${member.id}:`, error);
        }
      }
      console.log(`Unsuspended ${member.id}.`);
    } catch (error) {
      console.error(`Error unsuspending ${member.id}:`, error);
    }
  }
}
