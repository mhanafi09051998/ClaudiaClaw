import type { Message, Conversation } from "@claudiaclaw/core"

export interface MemoryStore {
  /** Save a conversation */
  saveConversation(conv: Conversation): Promise<void>
  /** Get conversation by ID */
  getConversation(id: string): Promise<Conversation | null>
  /** Add message to existing conversation */
  addMessage(convId: string, msg: Message): Promise<void>
  /** Get recent messages for a conversation */
  getRecentMessages(convId: string, limit?: number): Promise<Message[]>
  /** Search across conversations */
  search(query: string, limit?: number): Promise<Array<{ conversationId: string; message: Message; score: number }>>
  /** Delete conversation */
  deleteConversation(id: string): Promise<void>
  /** List all conversation IDs */
  listConversations(): Promise<string[]>
}

/** In-memory store — great for development, swap for SQLite/Redis/Postgres later */
export class InMemoryStore implements MemoryStore {
  private conversations: Map<string, Conversation> = new Map()

  async saveConversation(conv: Conversation): Promise<void> {
    this.conversations.set(conv.id, conv)
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null
  }

  async addMessage(convId: string, msg: Message): Promise<void> {
    const conv = this.conversations.get(convId)
    if (!conv) throw new Error(`Conversation ${convId} not found`)
    conv.messages.push(msg)
    conv.updatedAt = Date.now()
  }

  async getRecentMessages(convId: string, limit = 50): Promise<Message[]> {
    const conv = this.conversations.get(convId)
    if (!conv) return []
    return conv.messages.slice(-limit)
  }

  async search(_query: string, _limit = 10): Promise<Array<{ conversationId: string; message: Message; score: number }>> {
    const results: Array<{ conversationId: string; message: Message; score: number }> = []
    const q = _query.toLowerCase()
    for (const [convId, conv] of this.conversations) {
      for (const msg of conv.messages) {
        if (msg.content.toLowerCase().includes(q)) {
          results.push({
            conversationId: convId,
            message: msg,
            score: 1,
          })
          if (results.length >= _limit) return results
        }
      }
    }
    return results
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id)
  }

  async listConversations(): Promise<string[]> {
    return Array.from(this.conversations.keys())
  }
}

/** Conversation manager with configurable history limit */
export class ConversationManager {
  private store: MemoryStore
  private defaultHistoryLimit: number

  constructor(store: MemoryStore, defaultHistoryLimit = 100) {
    this.store = store
    this.defaultHistoryLimit = defaultHistoryLimit
  }

  async getOrCreate(id: string, platform: string, platformChatId: string): Promise<Conversation> {
    const existing = await this.store.getConversation(id)
    if (existing) return existing

    const conv: Conversation = {
      id,
      platform,
      platformChatId,
      messages: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await this.store.saveConversation(conv)
    return conv
  }

  async addMessage(convId: string, msg: Message): Promise<void> {
    await this.store.addMessage(convId, msg)
  }

  async getHistory(convId: string, limit?: number): Promise<Message[]> {
    return this.store.getRecentMessages(convId, limit ?? this.defaultHistoryLimit)
  }

  /** Build the message array to send to provider, respecting history limit */
  async buildContext(convId: string, systemPrompt?: string, limit?: number): Promise<Message[]> {
    const msgs = await this.getHistory(convId, limit)
    const context: Message[] = [...msgs]

    if (systemPrompt && !context.some((m) => m.role === "system")) {
      context.unshift({
        id: "system-prompt",
        role: "system",
        content: systemPrompt,
        timestamp: 0,
      })
    }

    return context
  }
}

// ─── TurboQuant Memory Engine ───────────────────────
export type {
  MemoryNugget,
  NuggetType,
  CompactedBlock,
  TurboQuantConfig,
} from "./turboquant.js"
export {
  TurboQuantEngine,
  AutoCompactManager,
  TurboQuantConversationManager,
} from "./turboquant.js"
