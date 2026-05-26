/**
 * SQLiteStore — persistent memory backend using SQLite (via sql.js)
 * 
 * sql.js is pure WASM — zero native dependencies, works everywhere.
 * Database disimpan ke file SQLite (.db) secara periodik.
 */

import initSqlJs, { Database as SqlJsDatabase } from "sql.js"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import type { Message, Conversation } from "@claudiaclaw/core"
import type { MemoryStore } from "./store.js"

export interface SQLiteStoreOptions {
  /** Path to SQLite database file (default: ./data/claudiaclaw/memory.db) */
  dbPath?: string
  /** Auto-save interval in ms (default: 5000) */
  saveInterval?: number
}

export class SQLiteStore implements MemoryStore {
  private db!: SqlJsDatabase
  private dbPath: string
  private initialized = false
  private saveTimer: ReturnType<typeof setInterval> | null = null

  constructor(options?: SQLiteStoreOptions) {
    this.dbPath = resolve(options?.dbPath ?? "./data/claudiaclaw/memory.db")
    this.initialized = false
  }

  /** Must be called before any operations — loads WASM and data */
  async init(): Promise<void> {
    if (this.initialized) return

    // Ensure directory exists
    const dir = resolve(this.dbPath, "..")
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const SQL = await initSqlJs()

    // Load existing database or create new
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
    }

    this.createTables()
    this.initialized = true

    // Auto-save every 5 seconds
    this.saveTimer = setInterval(() => this.save(), 5000)
  }

  private createTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_chat_id TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `)
    this.db.run("CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conversation_id)")
    this.db.run("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)")
    this.db.run(`
      CREATE TABLE IF NOT EXISTS nuggets (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT NOT NULL DEFAULT '[]',
        importance REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        last_referenced INTEGER NOT NULL,
        source_message_id TEXT
      )
    `)
    this.db.run("CREATE INDEX IF NOT EXISTS idx_nuggets_conv_id ON nuggets(conversation_id)")
    this.db.run("CREATE INDEX IF NOT EXISTS idx_nuggets_importance ON nuggets(importance DESC)")
  }

  /** Save database to disk */
  save(): void {
    if (!this.initialized) return
    try {
      const data = this.db.export()
      const tmpPath = this.dbPath + ".tmp"
      writeFileSync(tmpPath, data)
      // Atomic rename
      try { writeFileSync(this.dbPath, data) } catch { /* fallback */ }
      try { const { unlinkSync } = require("fs") as typeof import("fs"); unlinkSync(tmpPath) } catch { /* ignore */ }
    } catch (err) {
      console.error("[SQLiteStore] Save error:", err)
    }
  }

  // ─── Ensure initialized ────────────────────────────

  private ensureInit(): void {
    if (!this.initialized) {
      throw new Error("SQLiteStore not initialized. Call await store.init() first.")
    }
  }

  // ─── Conversations ──────────────────────────────────

  async saveConversation(conv: Conversation): Promise<void> {
    this.ensureInit()
    this.db.run(
      "INSERT OR REPLACE INTO conversations (id, platform, platform_chat_id, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [conv.id, conv.platform, conv.platformChatId, JSON.stringify(conv.metadata), conv.createdAt, conv.updatedAt],
    )
  }

  async getConversation(id: string): Promise<Conversation | null> {
    this.ensureInit()
    const result = this.db.exec("SELECT * FROM conversations WHERE id = ?", [id])
    if (result.length === 0 || result[0].values.length === 0) return null

    const row = result[0].values[0]
    const columns = result[0].columns

    const rowObj: Record<string, unknown> = {}
    columns.forEach((col: string, i: number) => { rowObj[col] = row[i] })

    // Load messages
    const msgResult = this.db.exec(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
      [id],
    )

    const messages: Message[] = []
    if (msgResult.length > 0) {
      const msgColumns = msgResult[0].columns
      for (const msgRow of msgResult[0].values) {
        const msgObj: Record<string, unknown> = {}
        msgColumns.forEach((col: string, i: number) => { msgObj[col] = msgRow[i] })
        messages.push(this.rowToMessage(msgObj))
      }
    }

    return {
      id: rowObj.id as string,
      platform: rowObj.platform as string,
      platformChatId: rowObj.platform_chat_id as string,
      messages,
      metadata: JSON.parse((rowObj.metadata as string) || "{}"),
      createdAt: rowObj.created_at as number,
      updatedAt: rowObj.updated_at as number,
    }
  }

  async addMessage(convId: string, msg: Message): Promise<void> {
    this.ensureInit()

    const toolCallsStr = msg.toolCalls ? JSON.stringify(msg.toolCalls) : null

    // Insert or ignore (avoid duplicates)
    const existing = this.db.exec("SELECT id FROM messages WHERE id = ?", [msg.id])
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        "INSERT INTO messages (id, conversation_id, role, content, name, tool_call_id, tool_calls, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          msg.id, convId, msg.role, msg.content,
          msg.name ?? null, msg.toolCallId ?? null,
          toolCallsStr, msg.timestamp,
          JSON.stringify(msg.metadata ?? {}),
        ],
      )
    }

    // Update conversation timestamp
    this.db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [Date.now(), convId])
  }

  async getRecentMessages(convId: string, limit = 50): Promise<Message[]> {
    this.ensureInit()
    const result = this.db.exec(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT ?",
      [convId, limit],
    )
    return this.parseQueryResult(result)
  }

  async search(query: string, limit = 10): Promise<Array<{ conversationId: string; message: Message; score: number }>> {
    this.ensureInit()
    const result = this.db.exec(
      "SELECT m.*, m.conversation_id as conv_id FROM messages m WHERE m.content LIKE ? LIMIT ?",
      [`%${query}%`, limit],
    )
    return this.parseQueryResult(result).map((msg) => ({
      conversationId: (msg as any).conversation_id || (msg as any).convId || "",
      message: msg,
      score: 1,
    }))
  }

  async deleteConversation(id: string): Promise<void> {
    this.ensureInit()
    this.db.run("DELETE FROM messages WHERE conversation_id = ?", [id])
    this.db.run("DELETE FROM nuggets WHERE conversation_id = ?", [id])
    this.db.run("DELETE FROM conversations WHERE id = ?", [id])
  }

  async listConversations(): Promise<string[]> {
    this.ensureInit()
    const result = this.db.exec("SELECT id FROM conversations ORDER BY updated_at DESC")
    if (result.length === 0) return []
    return result[0].values.map((row) => row[0] as string)
  }

  // ─── Nuggets ─────────────────────────────────────────

  saveNuggets(convId: string, nuggets: Array<{
    id: string; type: string; content: string; keywords: string[]
    importance: number; createdAt: number; lastReferenced: number
    sourceConvId: string; sourceMessageId?: string
  }>): void {
    this.ensureInit()

    this.db.run("BEGIN TRANSACTION")
    try {
      this.db.run("DELETE FROM nuggets WHERE conversation_id = ?", [convId])
      for (const n of nuggets) {
        this.db.run(
          "INSERT OR REPLACE INTO nuggets (id, conversation_id, type, content, keywords, importance, created_at, last_referenced, source_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [n.id, convId, n.type, n.content, JSON.stringify(n.keywords), n.importance, n.createdAt, n.lastReferenced, n.sourceMessageId ?? null],
        )
      }
      this.db.run("COMMIT")
    } catch (err) {
      this.db.run("ROLLBACK")
      throw err
    }
  }

  loadNuggets(convId: string): Array<{
    id: string; type: string; content: string; keywords: string[]
    importance: number; createdAt: number; lastReferenced: number
    sourceConvId: string; sourceMessageId?: string
  }> {
    this.ensureInit()
    const result = this.db.exec(
      "SELECT * FROM nuggets WHERE conversation_id = ? ORDER BY importance DESC",
      [convId],
    )
    if (result.length === 0) return []

    const columns = result[0].columns
    return result[0].values.map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col: string, i: number) => { obj[col] = row[i] })
      return {
        id: obj.id as string,
        type: obj.type as string,
        content: obj.content as string,
        keywords: JSON.parse((obj.keywords as string) || "[]"),
        importance: obj.importance as number,
        createdAt: obj.created_at as number,
        lastReferenced: obj.last_referenced as number,
        sourceConvId: obj.conversation_id as string,
        sourceMessageId: obj.source_message_id as string || undefined,
      }
    })
  }

  // ─── Utilities ───────────────────────────────────────

  getStats(): { conversations: number; messages: number; nuggets: number; fileSize: string; dbPath: string } {
    this.ensureInit()
    const convResult = this.db.exec("SELECT COUNT(*) as c FROM conversations")
    const msgResult = this.db.exec("SELECT COUNT(*) as c FROM messages")
    const nugResult = this.db.exec("SELECT COUNT(*) as c FROM nuggets")

    const convCount = convResult[0]?.values[0]?.[0] ?? 0
    const msgCount = msgResult[0]?.values[0]?.[0] ?? 0
    const nugCount = nugResult[0]?.values[0]?.[0] ?? 0

    let fileSize = "0 B"
    try {
      const { statSync } = require("fs") as typeof import("fs")
      const size = statSync(this.dbPath).size
      fileSize = size > 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(1)} MB`
        : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`
    } catch { /* ignore */ }

    return { conversations: convCount as number, messages: msgCount as number, nuggets: nugCount as number, fileSize, dbPath: this.dbPath }
  }

  /** Force save and clear auto-save timer */
  close(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
    this.save()
    this.db.close()
  }

  // ─── Private ─────────────────────────────────────────

  private parseQueryResult(result: any[]): Message[] {
    if (result.length === 0) return []
    const columns = result[0].columns
    return result[0].values.map((row: any[]) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col: string, i: number) => { obj[col] = row[i] })
      return this.rowToMessage(obj)
    })
  }

  private rowToMessage(row: Record<string, unknown>): Message {
    const msg: Message = {
      id: row.id as string,
      role: row.role as "user" | "assistant" | "system" | "tool",
      content: row.content as string,
      timestamp: row.timestamp as number,
    }
    if (row.name) msg.name = row.name as string
    if (row.tool_call_id) msg.toolCallId = row.tool_call_id as string
    if (row.tool_calls) msg.toolCalls = JSON.parse(row.tool_calls as string)
    if (row.metadata) msg.metadata = JSON.parse(row.metadata as string)
    return msg
  }
}
