/**
 * User & Group Isolation Manager
 * 
 * Setiap user/grup yang menghubungi ClaudiaClaw otomatis mendapat
 * direktori terisolasi berisi memory, notes, projects, dll.
 * 
 * Struktur:
 *   data/users/<user-id>/
 *   ├── memory.db
 *   ├── identity.md
 *   ├── soul.md
 *   ├── notes/
 *   └── projects/
 *   
 *   data/groups/<group-id>/
 *   ├── memory.db
 *   ├── notes/
 *   └── projects/
 */

import { existsSync, mkdirSync, writeFileSync } from "fs"
import { join, resolve } from "path"

export interface IsolatedContext {
  type: "user" | "group"
  id: string
  dir: string
  memoryDbPath: string
  notesDir: string
  projectsDir: string
}

const DEFAULT_IDENTITY = `# IDENTITY — Who Am I?

- **Name:** Claudia
- **Creature:** Virtual assistant
- **Vibe:** Helpful, professional, friendly
`

const DEFAULT_SOUL = `# SOUL — Core Personality

- Panggil user dengan sopan
- Responsif dan cekatan
- Jujur dan transparan
- Gunakan bahasa yang sesuai dengan user
- Prioritaskan membantu dengan akurat
`

export class IsolationManager {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = resolve(baseDir ?? "./data")
  }

  /** Get or create isolated directory for a user */
  resolveUser(userId: string): IsolatedContext {
    const dir = join(this.baseDir, "users", userId)
    return this.ensure(dir, "user", userId)
  }

  /** Get or create isolated directory for a group */
  resolveGroup(groupId: string): IsolatedContext {
    const dir = join(this.baseDir, "groups", groupId)
    return this.ensure(dir, "group", groupId)
  }

  /** Auto-detect: user for private chat, group for group chat */
  resolve(chatType: string, chatId: string, userId?: string): IsolatedContext {
    if (chatType === "group" || chatType === "supergroup") {
      return this.resolveGroup(chatId)
    }
    return this.resolveUser(userId ?? chatId)
  }

  private ensure(dir: string, type: "user" | "group", id: string): IsolatedContext {
    // Create directory structure
    const notesDir = join(dir, "notes")
    const projectsDir = join(dir, "projects")
    const memoryDir = dir

    for (const d of [dir, notesDir, projectsDir]) {
      if (!existsSync(d)) {
        mkdirSync(d, { recursive: true })
      }
    }

    // Create default identity/soul for users
    if (type === "user") {
      const identityPath = join(dir, "identity.md")
      const soulPath = join(dir, "soul.md")
      if (!existsSync(identityPath)) {
        writeFileSync(identityPath, DEFAULT_IDENTITY, "utf-8")
      }
      if (!existsSync(soulPath)) {
        writeFileSync(soulPath, DEFAULT_SOUL, "utf-8")
      }
    }

    return {
      type,
      id,
      dir,
      memoryDbPath: join(memoryDir, "memory.db"),
      notesDir,
      projectsDir,
    }
  }
}

// ─── Allowlist ────────────────────────────────────────

export interface AllowlistConfig {
  /** User IDs that are allowed (empty = allow all) */
  users: string[]
  /** Group IDs that are allowed (empty = allow all) */
  groups: string[]
  /** Owner IDs (always allowed, can manage allowlist) */
  owners: string[]
  /** Default policy when list is empty */
  defaultAllow: boolean
}

const DEFAULT_ALLOWLIST: AllowlistConfig = {
  users: [],
  groups: [],
  owners: [],
  defaultAllow: true,
}

export class Allowlist {
  private config: AllowlistConfig

  constructor(config?: Partial<AllowlistConfig>) {
    this.config = { ...DEFAULT_ALLOWLIST, ...config }
  }

  /** Check if a user is allowed */
  isUserAllowed(userId: string): boolean {
    // Owner always allowed
    if (this.config.owners.includes(userId)) return true
    // If list is empty, use default policy
    if (this.config.users.length === 0) return this.config.defaultAllow
    // Check allowlist
    return this.config.users.includes(userId)
  }

  /** Check if a group is allowed */
  isGroupAllowed(groupId: string): boolean {
    if (this.config.groups.length === 0) return this.config.defaultAllow
    return this.config.groups.includes(groupId)
  }

  /** Check all access */
  isAllowed(chatType: string, chatId: string, userId: string): boolean {
    if (chatType === "group" || chatType === "supergroup") {
      return this.isGroupAllowed(chatId)
    }
    return this.isUserAllowed(userId)
  }

  /** Get allowlist status */
  get status(): { users: string; groups: string; owners: string; policy: string } {
    return {
      users: this.config.users.length === 0 ? "all" : this.config.users.join(", "),
      groups: this.config.groups.length === 0 ? "all" : this.config.groups.join(", "),
      owners: this.config.owners.join(", "),
      policy: this.config.defaultAllow ? "allow by default" : "deny by default",
    }
  }

  /** Add a user to allowlist */
  addUser(userId: string): void {
    if (!this.config.users.includes(userId)) {
      this.config.users.push(userId)
    }
  }

  /** Remove a user from allowlist */
  removeUser(userId: string): void {
    this.config.users = this.config.users.filter((id) => id !== userId)
  }

  /** Add a group to allowlist */
  addGroup(groupId: string): void {
    if (!this.config.groups.includes(groupId)) {
      this.config.groups.push(groupId)
    }
  }

  /** Remove a group from allowlist */
  removeGroup(groupId: string): void {
    this.config.groups = this.config.groups.filter((id) => id !== groupId)
  }
}
