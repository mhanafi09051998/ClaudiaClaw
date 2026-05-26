/**
 * FileStore — persistent memory backend using JSON files
 * Zero dependencies, works everywhere.
 * 
 * Data disimpan per konversasi sebagai file JSON di folder data/.
 * TurboQuant nuggets juga ikut persist.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs"
import { join, resolve } from "path"
import type { Message, Conversation } from "@claudiaclaw/core"
import type { MemoryStore } from "./index.js"

export interface FileStoreOptions {
  /** Directory to store data files (default: ./data/claudiaclaw/) */
  dataDir?: string
  /** Auto-save after every write (default: true) */
  autoSave?: boolean
}

interface StoredData {
  conversations: Record<string, Conversation>
  nuggets: Record<string, Array<{
    id: string
    type: string
    content: string
    keywords: string[]
    importance: number
    createdAt: number
    lastReferenced: number
    sourceConvId: string
    sourceMessageId?: string
  }>>
  metadata: {
    version: number
    createdAt: number
    updatedAt: number
  }
}

const CURRENT_VERSION = 1

export class FileStore implements MemoryStore {
  private data: StoredData
  private dataDir: string
  private filePath: string
  private autoSave: boolean
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options?: FileStoreOptions) {
    this.dataDir = resolve(options?.dataDir ?? "./data/claudiaclaw")
    this.autoSave = options?.autoSave ?? true
    this.filePath = join(this.dataDir, "memory.json")

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }

    this.data = this.load()
  }

  // ─── Persistence ───────────────────────────────────

  private load(): StoredData {
    if (!existsSync(this.filePath)) {
      return {
        conversations: {},
        nuggets: {},
        metadata: {
          version: CURRENT_VERSION,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }
    }

    try {
      const raw = readFileSync(this.filePath, "utf-8")
      const data = JSON.parse(raw) as StoredData
      return data
    } catch {
      console.warn("[FileStore] Corrupted data file, starting fresh")
      return {
        conversations: {},
        nuggets: {},
        metadata: {
          version: CURRENT_VERSION,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }
    }
  }

  save(): void {
    this.data.metadata.updatedAt = Date.now()
    const tmpPath = this.filePath + ".tmp"
    writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf-8")
    // Atomic rename
    try {
      unlinkSync(this.filePath)
    } catch { /* ignore if not exists */ }
    renameSync(tmpPath, this.filePath)
  }

  private scheduleSave(): void {
    if (!this.autoSave) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 500)
  }

  // ─── MemoryStore implementation ────────────────────

  async saveConversation(conv: Conversation): Promise<void> {
    this.data.conversations[conv.id] = conv
    this.scheduleSave()
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.data.conversations[id] ?? null
  }

  async addMessage(convId: string, msg: Message): Promise<void> {
    const conv = this.data.conversations[convId]
    if (!conv) throw new Error(`Conversation ${convId} not found`)
    conv.messages.push(msg)
    conv.updatedAt = Date.now()
    this.scheduleSave()
  }

  async getRecentMessages(convId: string, limit = 50): Promise<Message[]> {
    const conv = this.data.conversations[convId]
    if (!conv) return []
    return conv.messages.slice(-limit)
  }

  async search(query: string, limit = 10): Promise<Array<{ conversationId: string; message: Message; score: number }>> {
    const results: Array<{ conversationId: string; message: Message; score: number }> = []
    const q = query.toLowerCase()
    for (const [convId, conv] of Object.entries(this.data.conversations)) {
      for (const msg of conv.messages) {
        if (msg.content.toLowerCase().includes(q)) {
          results.push({ conversationId: convId, message: msg, score: 1 })
          if (results.length >= limit) return results
        }
      }
    }
    return results
  }

  async deleteConversation(id: string): Promise<void> {
    delete this.data.conversations[id]
    delete this.data.nuggets[id]
    this.scheduleSave()
  }

  async listConversations(): Promise<string[]> {
    return Object.keys(this.data.conversations)
  }

  // ─── Nugget persistence ────────────────────────────

  /** Save nuggets for a conversation */
  saveNuggets(convId: string, nuggets: Array<{
    id: string
    type: string
    content: string
    keywords: string[]
    importance: number
    createdAt: number
    lastReferenced: number
    sourceConvId: string
    sourceMessageId?: string
  }>): void {
    this.data.nuggets[convId] = nuggets
    this.scheduleSave()
  }

  /** Load nuggets for a conversation */
  loadNuggets(convId: string): Array<{
    id: string
    type: string
    content: string
    keywords: string[]
    importance: number
    createdAt: number
    lastReferenced: number
    sourceConvId: string
    sourceMessageId?: string
  }> {
    return this.data.nuggets[convId] ?? []
  }

  /** Force immediate save (for shutdown) */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.save()
  }

  /** Get storage stats */
  getStats(): { conversations: number; messages: number; nuggets: number; fileSize: string } {
    let messages = 0
    let nuggets = 0
    for (const conv of Object.values(this.data.conversations)) {
      messages += conv.messages.length
    }
    for (const nug of Object.values(this.data.nuggets)) {
      nuggets += nug.length
    }

    let fileSize = "0 B"
    try {
      const stat = existsSync(this.filePath) ? readFileSync(this.filePath).length : 0
      fileSize = stat > 1024 * 1024
        ? `${(stat / 1024 / 1024).toFixed(1)} MB`
        : stat > 1024
          ? `${(stat / 1024).toFixed(1)} KB`
          : `${stat} B`
    } catch { /* ignore */ }

    return {
      conversations: Object.keys(this.data.conversations).length,
      messages,
      nuggets,
      fileSize,
    }
  }
}

// Fallback rename for cross-device support
function renameSync(oldPath: string, newPath: string): void {
  try {
    // Try atomic rename first
    writeFileSync(newPath, readFileSync(oldPath))
    unlinkSync(oldPath)
  } catch {
    // Fallback: just write directly
    writeFileSync(newPath, readFileSync(oldPath))
    try { unlinkSync(oldPath) } catch { /* ignore */ }
  }
}
