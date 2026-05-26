import type { Message, Conversation } from "@claudiaclaw/core"

/** Memory store interface — implemented by SQLiteStore */
export interface MemoryStore {
  saveConversation(conv: Conversation): Promise<void>
  getConversation(id: string): Promise<Conversation | null>
  addMessage(convId: string, msg: Message): Promise<void>
  getRecentMessages(convId: string, limit?: number): Promise<Message[]>
  search(query: string, limit?: number): Promise<Array<{ conversationId: string; message: Message; score: number }>>
  deleteConversation(id: string): Promise<void>
  listConversations(): Promise<string[]>
  /** Optional: save/load nuggets for TurboQuant */
  saveNuggets?(convId: string, nuggets: unknown[]): void
  loadNuggets?(convId: string): unknown[]
  getStats?(): Record<string, unknown>
  close?(): void
}

/** Base conversation manager */
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
