// src/controllers/roleHandler.ts
import { GuildMember } from 'discord.js';
import { config } from '../config';
import { recordSuspensionDue, updateSuspension } from '../database/mongo';

export class RoleHandler {
  static get moderatorRole(): string {
    return config.discord.roles.moderator;
  }
  static get backendRole(): string {
    return config.discord.roles.cplBackend;
  }
  static get civ6RankRole(): string {
    return config.discord.roles.civ6Rank;
  }
  static get civ7RankRole(): string {
    return config.discord.roles.civ7Rank;
  }
  static get civ6NoviceRole(): string {
    return config.discord.roles.civ6Novice;
  }
  static get tournamentRole(): string {
    return config.discord.roles.cplTournament;
  }
  static get cloudRole(): string {
    return config.discord.roles.cplCloud;
  }
  static get suspendedRole(): string {
    return config.discord.roles.suspended;
  }

  /**
   * Checks if a role exists in the guild.
   */
  static roleExists(member: GuildMember, roleId: string): boolean {
    return !!member.guild.roles.cache.get(roleId);
  }

  /**
   * Returns true if the member has the moderator role.
   */
  static isModerator(member: GuildMember): boolean {
    return member.roles.cache.has(RoleHandler.moderatorRole);
  }

  /**
   * Returns true if the member is suspended.
   */
  static isSuspended(member: GuildMember): boolean {
    if (!RoleHandler.suspendedRole) return false;
    return member.roles.cache.has(RoleHandler.suspendedRole);
  }

  /**
   * Adds a role to a member if they don't already have it.
   */
  static async addRole(member: GuildMember, roleId: string): Promise<boolean> {
    try {
      if (!this.roleExists(member, roleId)) {
        console.warn(`Role ${roleId} does not exist in guild ${member.guild.id}`);
        return false;
      }
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to add role ${roleId} to member ${member.id}:`, error);
      return false;
    }
  }

  /**
   * Removes a role from a member if they have it.
   */
  static async removeRole(member: GuildMember, roleId: string): Promise<boolean> {
    try {
      if (!this.roleExists(member, roleId)) {
        console.warn(`Role ${roleId} does not exist in guild ${member.guild.id}`);
        return false;
      }
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to remove role ${roleId} from member ${member.id}:`, error);
      return false;
    }
  }

  /**
   * Toggles a role on a member.
   */
  static async toggleRole(member: GuildMember, roleId: string): Promise<boolean> {
    try {
      if (!this.roleExists(member, roleId)) {
        console.warn(`Role ${roleId} does not exist in guild ${member.guild.id}`);
        return false;
      }
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
      } else {
        await member.roles.add(roleId);
      }
      return true;
    } catch (error) {
      console.error(`Failed to toggle role ${roleId} for member ${member.id}:`, error);
      return false;
    }
  }

  /**
   * Checks if the member has any role from the provided list.
   */
  static hasAnyRole(member: GuildMember, roleIds: string[]): boolean {
    return roleIds.some(roleId => member.roles.cache.has(roleId));
  }

  /**
   * Adds multiple roles to a member.
   */
  static async addRoles(member: GuildMember, roleIds: string[]): Promise<void> {
    for (const roleId of roleIds) {
      await this.addRole(member, roleId);
    }
  }

  /**
   * Removes multiple roles from a member.
   */
  static async removeRoles(member: GuildMember, roleIds: string[]): Promise<void> {
    for (const roleId of roleIds) {
      await this.removeRole(member, roleId);
    }
  }

  /**
   * Suspends a member by removing specific roles and adding the suspended role.
   * Also records the roles removed in the DB (in suspendedRoles).
   * If the member is already suspended, it simply records a suspension due.
   */
  static async suspendMember(member: GuildMember): Promise<boolean> {
    try {
      if (!RoleHandler.suspendedRole) {
        console.error('Suspended role is not configured.');
        return false;
      }

      if (this.isSuspended(member)) {
        console.log(`Member ${member.id} is already suspended.`);
        await recordSuspensionDue(member.id);
        return true;
      }

      // Roles to remove on suspension.
      const rolesToRemove = [
        config.discord.roles.civ6Rank,
        config.discord.roles.civ7Rank,
        config.discord.roles.civ6Novice,
        config.discord.roles.cplTournament,
        config.discord.roles.cplCloud,
      ];

      // Filter for roles the member currently has.
      const rolesFound: string[] = rolesToRemove.filter(roleId => member.roles.cache.has(roleId));
      if (rolesFound.length > 0) {
        await this.removeRoles(member, rolesFound);
        // Record the removed roles for restoration later.
        await updateSuspension(member.id, { suspendedRoles: rolesFound });
      }

      // Add the suspended role.
      await this.addRole(member, this.suspendedRole);
      return true;
    } catch (error) {
      console.error(`Error suspending member ${member.id}:`, error);
      return false;
    }
  }
}
