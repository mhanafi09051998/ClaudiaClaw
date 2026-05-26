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

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs"
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

// ─── File-based Allowlist ───────────────────────────

const ALLOWLIST_FILE = "allowlist.json"

/**
 * Allowlist with file persistence.
 * Otomatis baca/tulis ke file agar perubahan langsung生效 tanpa restart.
 */
export class AllowlistFile extends Allowlist {
  private dataDir: string

  constructor(dataDir?: string, config?: Partial<AllowlistConfig>) {
    super(config)
    this.dataDir = resolve(dataDir ?? "./data/claudiaclaw")
    this.load()
  }

  /** Load allowlist from file */
  load(): void {
    const filePath = join(this.dataDir, ALLOWLIST_FILE)
    if (!existsSync(filePath)) return
    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"))
      if (data.users) (this as any).config.users = data.users
      if (data.groups) (this as any).config.groups = data.groups
      if (data.owners) (this as any).config.owners = data.owners
    } catch { /* ignore corrupt file */ }
  }

  /** Save allowlist to file */
  save(): void {
    const filePath = join(this.dataDir, ALLOWLIST_FILE)
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })
    writeFileSync(filePath, JSON.stringify({
      users: (this as any).config.users,
      groups: (this as any).config.groups,
      owners: (this as any).config.owners,
    }, null, 2), "utf-8")
  }

  /** Add user + auto-save */
  addUser(userId: string): void {
    super.addUser(userId)
    this.save()
  }

  /** Add group + auto-save */
  addGroup(groupId: string): void {
    super.addGroup(groupId)
    this.save()
  }

  /** Remove user + auto-save */
  removeUser(userId: string): void {
    super.removeUser(userId)
    this.save()
  }

  /** Remove group + auto-save */
  removeGroup(groupId: string): void {
    super.removeGroup(groupId)
    this.save()
  }
}

// ─── Pairing Manager ────────────────────────────────

interface PendingPairing {
  code: string
  userId: string
  username?: string
  chatType: string
  chatId: string
  createdAt: number
}

const PAIRING_FILE = "pairings.json"

export class PairingManager {
  private dataDir: string
  private pairings: PendingPairing[] = []

  constructor(dataDir?: string) {
    this.dataDir = resolve(dataDir ?? "./data/claudiaclaw")
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })
    this.load()
  }

  /** Generate pairing code untuk user */
  generate(userId: string, chatType: string, chatId: string, username?: string): PendingPairing {
    // Cek existing pending
    const existing = this.pairings.find(p => p.userId === userId && !this.isExpired(p))
    if (existing) return existing

    // Generate 8-char code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]

    const pairing: PendingPairing = {
      code,
      userId,
      username: username,
      chatType,
      chatId,
      createdAt: Date.now(),
    }

    this.pairings.push(pairing)
    this.save()
    return pairing
  }

  /** Approve pairing by code */
  approve(code: string): PendingPairing | null {
    const idx = this.pairings.findIndex(p => p.code === code && !this.isExpired(p))
    if (idx === -1) return null
    const pairing = this.pairings[idx]
    this.pairings.splice(idx, 1)
    this.save()
    return pairing
  }

  /** List pending pairings */
  list(): PendingPairing[] {
    this.cleanup()
    return [...this.pairings]
  }

  private isExpired(p: PendingPairing): boolean {
    // Expired after 24 hours
    return Date.now() - p.createdAt > 24 * 60 * 60 * 1000
  }

  private cleanup(): void {
    const before = this.pairings.length
    this.pairings = this.pairings.filter(p => !this.isExpired(p))
    if (this.pairings.length !== before) this.save()
  }

  private load(): void {
    const filePath = join(this.dataDir, PAIRING_FILE)
    if (!existsSync(filePath)) return
    try {
      this.pairings = JSON.parse(readFileSync(filePath, "utf-8"))
    } catch { /* ignore */ }
  }

  private save(): void {
    const filePath = join(this.dataDir, PAIRING_FILE)
    writeFileSync(filePath, JSON.stringify(this.pairings, null, 2), "utf-8")
  }
}
