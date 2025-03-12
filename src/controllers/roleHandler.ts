import { GuildMember } from 'discord.js';
import { config } from '../config';
import { updateSuspendedRoles, clearSuspendedRoles } from '../database/mongo';

export class RoleHandler {
  static get suspendedRole(): string {
    return config.discord.roles.suspended;
  }
  static get rolesToRemoveOnSuspension(): string[] {
    return [
      config.discord.roles.civ6Rank,
      config.discord.roles.civ7Rank,
      config.discord.roles.civ6Novice,
      config.discord.roles.cplTournament,
      config.discord.roles.cplCloud,
      config.discord.roles.cplNoviceManager,
      config.discord.roles.cplCoach
    ];
  }

  // Applies suspension roles by removing specific roles and adding the suspended role.
  static async applySuspensionRoles(member: GuildMember): Promise<string[]> {
    console.log(`[RoleHandler] Applying suspension roles for ${member.id}.`);
    const rolesToRemove = RoleHandler.rolesToRemoveOnSuspension.filter(roleId =>
      member.roles.cache.has(roleId)
    );

    try {
      await Promise.all(
        rolesToRemove.map(roleId => member.roles.remove(roleId))
      );
      if (!member.roles.cache.has(RoleHandler.suspendedRole)) {
        await member.roles.add(RoleHandler.suspendedRole);
      }
      await updateSuspendedRoles(member.id, rolesToRemove);
      console.log(`[RoleHandler] Suspension roles applied for ${member.id}.`);
    } catch (error) {
      console.error(`[RoleHandler] Error applying suspension roles for ${member.id}:`, error);
    }

    return rolesToRemove;
  }

  // Restores a member's roles by adding back previous roles, removing the suspended role,
  static async restoreMemberRoles(member: GuildMember, rolesToRestore: string[]): Promise<void> {
    console.log(`[RoleHandler] Restoring roles for member ${member.id}.`);
    try {
      await Promise.all(
        rolesToRestore.map(async (roleId) => {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
          }
        })
      );
      if (member.roles.cache.has(RoleHandler.suspendedRole)) {
        await member.roles.remove(RoleHandler.suspendedRole);
      }
      await clearSuspendedRoles(member.id);
      console.log(`[RoleHandler] Roles restored and suspension cleared for ${member.id}.`);
    } catch (error) {
      console.error(`[RoleHandler] Error restoring roles for ${member.id}:`, error);
    }
  }
}
