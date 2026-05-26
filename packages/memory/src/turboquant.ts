/**
 * TurboQuant Memory Engine
 *
 * Pendekatan memori compact cerdas yang memastikan Claudia
 * tidak pernah lupa informasi penting walaupun konteks sudah di-compact.
 *
 * Konsep:
 * - Setiap percakapan diekstrak menjadi "Memory Nuggets" (fakta, preferensi, keputusan)
 * - Nuggets diprioritaskan berdasarkan kepentingan
 * - Context lama di-compress jadi ringkasan + nuggets
 * - Saat reconstruksi: recent messages + nuggets + summaries
 */

import type { Message, Conversation } from "@claudiaclaw/core"
import { InMemoryStore, ConversationManager } from "./base.js"
import type { FileStore } from "./filestore.js"
import type { SQLiteStore } from "./sqlitestore.js"
import type { MemoryStore } from "./base.js"

// ─── Types ──────────────────────────────────────────

export interface MemoryNugget {
  id: string
  type: NuggetType
  content: string
  keywords: string[]
  importance: number       // 0-1, higher = more important
  createdAt: number
  lastReferenced: number
  sourceConvId: string
  sourceMessageId?: string
  expiryMs?: number        // optional auto-expiry
}

export type NuggetType =
  | "fact"           // factual information about user/project
  | "preference"     // user preferences, likes/dislikes
  | "decision"       // decisions made
  | "task"           // tasks, action items
  | "context"        // situational context
  | "personality"    // user's desired agent personality
  | "summary"        // compressed conversation summary

export interface CompactedBlock {
  type: "compacted"
  summary: string
  nuggets: string[]          // nugget IDs included
  messageCount: number
  timestamp: number
}

export interface TurboQuantConfig {
  /** Max messages before auto-compact triggers */
  compactThreshold: number
  /** Keep this many most recent messages intact during compact */
  keepRecentCount: number
  /** Nuggets below this importance get pruned during compact */
  minNuggetImportance: number
  /** Max nuggets to keep per conversation */
  maxNuggetsPerConv: number
  /** Use AI for extraction (requires provider) or rule-based */
  extractionMode: "ai" | "rule-based"
}

const DEFAULT_CONFIG: TurboQuantConfig = {
  compactThreshold: 40,
  keepRecentCount: 20,
  minNuggetImportance: 0.3,
  maxNuggetsPerConv: 100,
  extractionMode: "rule-based",
}

// ─── Nugget extraction (rule-based) ─────────────────

/** Extract potential nuggets from a message using patterns */
function extractNuggets(msg: Message, convId: string): MemoryNugget[] {
  const nuggets: MemoryNugget[] = []
  const content = msg.content.toLowerCase()
  const now = Date.now()

  // Skip very short messages
  if (msg.content.length < 10) return nuggets

  // ── Pattern: User preferences ──//
  const prefPatterns = [
    /\bsaya (suka|saya suka|lebih suka|tidak suka|gak suka|enggak suka)\b/i,
    /\bsaya (mau|ingin|pengen|kepingin)\b/i,
    /\baku (suka|lebih suka|gak suka|enggak suka)\b/i,
    /\baku (mau|ingin|pengen)\b/i,
    /\bpreferensi\b/i,
    /\blebih (suka|baik|senang)\b/i,
  ]
  for (const pat of prefPatterns) {
    if (pat.test(msg.content)) {
      nuggets.push({
        id: `nugget-${now}-${Math.random().toString(36).slice(2, 8)}`,
        type: "preference",
        content: msg.content.slice(0, 300),
        keywords: extractKeywords(msg.content),
        importance: 0.7,
        createdAt: now,
        lastReferenced: now,
        sourceConvId: convId,
        sourceMessageId: msg.id,
      })
      break
    }
  }

  // ── Pattern: Decisions ──//
  const decisionPatterns = [
    /\b(memutuskan|putuskan|keputusan|decide|decision)\b/i,
    /\bsaya (pilih|memilih|ambil)\b/i,
    /\baku (pilih|memilih|ambil)\b/i,
    /\b(setuju|deal|oke deal|done deal)\b/i,
    /\bkita (pakai|gunakan|pake|gunain)\b/i,
  ]
  for (const pat of decisionPatterns) {
    if (pat.test(msg.content)) {
      nuggets.push({
        id: `nugget-${now}-${Math.random().toString(36).slice(2, 8)}`,
        type: "decision",
        content: msg.content.slice(0, 300),
        keywords: extractKeywords(msg.content),
        importance: 0.8,
        createdAt: now,
        lastReferenced: now,
        sourceConvId: convId,
        sourceMessageId: msg.id,
      })
      break
    }
  }

  // ── Pattern: Tasks ──//
  const taskPatterns = [
    /\b(tolong|tolongin|bantu|help)\b/i,
    /\b(jangan lupa|ingatkan|remind|reminder)\b/i,
    /\b(kerjakan|selesaikan|buatkan|buatin|bikinin)\b/i,
    /\b(tugas|task|todo|to-do|pr)\b/i,
    /\bcoba (buat|bikin|cari|cek|check|lihat)\b/i,
  ]
  for (const pat of taskPatterns) {
    if (pat.test(msg.content)) {
      nuggets.push({
        id: `nugget-${now}-${Math.random().toString(36).slice(2, 8)}`,
        type: "task",
        content: msg.content.slice(0, 300),
        keywords: extractKeywords(msg.content),
        importance: 0.75,
        createdAt: now,
        lastReferenced: now,
        sourceConvId: convId,
        sourceMessageId: msg.id,
      })
      break
    }
  }

  // ── Pattern: Facts ──//
  const factPatterns = [
    /\b(nama saya|nama aku|panggil|nickname)\b/i,
    /\b(umur|usia|tahun)\b/i,
    /\b(tinggal di|rumah di|alamat|domisili)\b/i,
    /\b(kerja|bekerja|pekerjaan|profesi|job)\b/i,
    /\b(project|proyek|repo|repository)\b/i,
    /\b(sekolah|kuliah|universitas|pendidikan)\b/i,
  ]
  for (const pat of factPatterns) {
    if (pat.test(msg.content)) {
      nuggets.push({
        id: `nugget-${now}-${Math.random().toString(36).slice(2, 8)}`,
        type: "fact",
        content: msg.content.slice(0, 300),
        keywords: extractKeywords(msg.content),
        importance: 0.6,
        createdAt: now,
        lastReferenced: now,
        sourceConvId: convId,
        sourceMessageId: msg.id,
      })
      break
    }
  }

  // ── Pattern: Personality (system/user defining agent character) ──//
  if (
    msg.role === "assistant" &&
    (content.includes("jadilah") || content.includes("kamu adalah") || content.includes("bersikap"))
  ) {
    nuggets.push({
      id: `nugget-${now}-${Math.random().toString(36).slice(2, 8)}`,
      type: "personality",
      content: msg.content.slice(0, 300),
      keywords: extractKeywords(msg.content),
      importance: 0.9,
      createdAt: now,
      lastReferenced: now,
      sourceConvId: convId,
      sourceMessageId: msg.id,
    })
  }

  // ── Pattern: User personality request (first interaction) ──//
  if (
    msg.role === "user" &&
    nuggets.length === 0 &&
    msg.content.length > 20
  ) {
    const firstMsgNugget: MemoryNugget = {
      id: `nugget-${now}-${Math.random().toString(36).slice(2, 8)}`,
      type: "personality",
      content: msg.content.slice(0, 300),
      keywords: extractKeywords(msg.content),
      importance: 0.85,
      createdAt: now,
      lastReferenced: now,
      sourceConvId: convId,
      sourceMessageId: msg.id,
    }
    nuggets.push(firstMsgNugget)
  }

  return nuggets
}

// ─── Keyword extraction ─────────────────────────────

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "dan", "atau", "yang", "di", "ke", "dari", "dengan", "ini", "itu",
    "dan", "untuk", "pada", "adalah", "akan", "telah", "sudah", "bisa",
    "dapat", "tidak", "gak", "enggak", "juga", "saya", "aku", "kamu",
    "dia", "mereka", "kami", "kita", "ada", "oleh", "sebagai", "dalam",
    "the", "and", "or", "to", "in", "of", "for", "is", "are", "was",
    "were", "be", "been", "have", "has", "had", "do", "does", "did",
  ])

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 15)
}

// ─── TurboQuant Engine ──────────────────────────────

export class TurboQuantEngine {
  private nuggets: Map<string, MemoryNugget> = new Map()
  private config: TurboQuantConfig
  private persistentStore?: FileStore | SQLiteStore

  constructor(config?: Partial<TurboQuantConfig>, persistentStore?: FileStore | SQLiteStore) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.persistentStore = persistentStore
  }

  /** Update config */
  setConfig(config: Partial<TurboQuantConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): TurboQuantConfig {
    return { ...this.config }
  }

  /** Process a message and extract nuggets */
  processMessage(msg: Message, convId: string): MemoryNugget[] {
    const extracted = extractNuggets(msg, convId)

    for (const nugget of extracted) {
      this.addNugget(nugget)
    }

    return extracted
  }

  /** Add or merge a nugget */
  addNugget(nugget: MemoryNugget): void {
    // Check for similar existing nuggets (merge instead of duplicate)
    const similar = this.findSimilar(nugget)
    if (similar) {
      // Update existing — increase importance, refresh timestamp
      similar.importance = Math.max(similar.importance, nugget.importance)
      similar.lastReferenced = Date.now()
      similar.content = nugget.content // Use newer content
      similar.keywords = [...new Set([...similar.keywords, ...nugget.keywords])]
      this.persistConversationNuggets(similar.sourceConvId)
      return
    }

    this.nuggets.set(nugget.id, nugget)

    // Persist to file store
    this.persistConversationNuggets(nugget.sourceConvId)

    // Prune if over max
    if (this.nuggets.size > this.config.maxNuggetsPerConv) {
      this.prune()
    }
  }

  /** Get all nuggets for a conversation */
  getConversationNuggets(convId: string): MemoryNugget[] {
    return Array.from(this.nuggets.values())
      .filter((n) => n.sourceConvId === convId)
      .sort((a, b) => b.importance - a.importance)
  }

  /** Get high-importance nuggets that should survive compaction */
  getEssentialNuggets(convId: string, minImportance?: number): MemoryNugget[] {
    const threshold = minImportance ?? this.config.minNuggetImportance
    return this.getConversationNuggets(convId).filter((n) => n.importance >= threshold)
  }

  /** Get nuggets as a formatted string for context injection */
  getNuggetContext(convId: string, maxNuggets = 15): string {
    const nuggets = this.getEssentialNuggets(convId).slice(0, maxNuggets)
    if (nuggets.length === 0) return ""

    let context = "\n[TurboQuant Memory — Key Information]\n"
    for (const nugget of nuggets) {
      const icon = this.getNuggetIcon(nugget.type)
      const age = this.getAge(nugget.createdAt)
      context += `${icon} [${nugget.type}] ${nugget.content.slice(0, 200)} (${age})\n`
    }
    return context
  }

  /** Generate a compact summary from nuggets */
  generateSummary(convId: string, messages: Message[]): string {
    const nuggets = this.getEssentialNuggets(convId, 0.4)
    const personality = nuggets.filter((n) => n.type === "personality").map((n) => n.content).slice(0, 2)
    const decisions = nuggets.filter((n) => n.type === "decision").map((n) => n.content).slice(0, 5)
    const facts = nuggets.filter((n) => n.type === "fact").map((n) => n.content).slice(0, 5)
    const prefs = nuggets.filter((n) => n.type === "preference").map((n) => n.content).slice(0, 5)
    const tasks = nuggets.filter((n) => n.type === "task").map((n) => n.content).slice(0, 5)

    let summary = ""

    if (personality.length > 0) {
      summary += `\n[Personality] ${personality.join("; ")}`
    }
    if (facts.length > 0) {
      summary += `\n[Facts] ${facts.join("; ")}`
    }
    if (prefs.length > 0) {
      summary += `\n[Preferences] ${prefs.join("; ")}`
    }
    if (decisions.length > 0) {
      summary += `\n[Decisions] ${decisions.join("; ")}`
    }
    if (tasks.length > 0) {
      summary += `\n[Pending Tasks] ${tasks.join("; ")}`
    }

    // General conversation summary
    const msgs = messages.filter((m) => m.role !== "system")
    const userMsgs = msgs.filter((m) => m.role === "user").length
    const topics = this.extractTopics(messages)

    summary = `[Conversation Summary] ${userMsgs} user messages exchanged. Topics: ${topics.join(", ")}.${summary}`

    return summary
  }

  /** Extract general topics from messages */
  private extractTopics(messages: Message[]): string[] {
    const words = new Map<string, number>()
    const stopWords = new Set(["dan", "atau", "yang", "di", "ke", "dari", "ini", "itu", "dan", "untuk", "pada", "adalah", "akan", "telah", "sudah", "bisa", "dapat", "tidak", "gak", "juga", "saya", "aku", "kamu", "dia", "mereka", "kami", "kita", "ada", "oleh", "the", "and", "or", "to", "in", "of", "for", "is", "are"])

    for (const msg of messages) {
      const tokens = msg.content.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)
      for (const t of tokens) {
        if (t.length > 4 && !stopWords.has(t)) {
          words.set(t, (words.get(t) ?? 0) + 1)
        }
      }
    }

    return [...words.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w)
  }

  /** Remove low-importance nuggets */
  prune(): void {
    const sorted = [...this.nuggets.values()].sort(
      (a, b) => a.importance - b.importance,
    )
    let removed = 0
    for (const nugget of sorted) {
      if (this.nuggets.size <= this.config.maxNuggetsPerConv) break
      if (nugget.importance < this.config.minNuggetImportance) {
        this.nuggets.delete(nugget.id)
        removed++
      }
    }
  }

  /** Find similar existing nugget (for merging) */
  private findSimilar(nugget: MemoryNugget): MemoryNugget | undefined {
    for (const existing of this.nuggets.values()) {
      if (existing.type !== nugget.type) continue
      if (existing.sourceConvId !== nugget.sourceConvId) continue

      // Check keyword overlap
      const overlap = existing.keywords.filter((k) => nugget.keywords.includes(k))
      if (overlap.length > 3) return existing
    }
    return undefined
  }

  /** Persist nuggets for a conversation to file store */
  private persistConversationNuggets(convId: string): void {
    if (!this.persistentStore) return
    const nuggets = this.getConversationNuggets(convId).map((n) => ({
      id: n.id,
      type: n.type,
      content: n.content,
      keywords: n.keywords,
      importance: n.importance,
      createdAt: n.createdAt,
      lastReferenced: n.lastReferenced,
      sourceConvId: n.sourceConvId,
      sourceMessageId: n.sourceMessageId,
    }))
    this.persistentStore.saveNuggets(convId, nuggets)
  }

  /** Load nuggets from file store */
  loadNuggetsFromStore(convId: string): void {
    if (!this.persistentStore) return
    const stored = this.persistentStore.loadNuggets(convId)
    if (!stored || stored.length === 0) return

    for (const n of stored) {
      const nugget: MemoryNugget = {
        id: n.id,
        type: n.type as NuggetType,
        content: n.content,
        keywords: n.keywords,
        importance: n.importance,
        createdAt: n.createdAt,
        lastReferenced: n.lastReferenced,
        sourceConvId: n.sourceConvId,
        sourceMessageId: n.sourceMessageId,
      }
      this.nuggets.set(nugget.id, nugget)
    }
  }

  private getNuggetIcon(type: NuggetType): string {
    const icons: Record<NuggetType, string> = {
      fact: "📌",
      preference: "❤️",
      decision: "✅",
      task: "📋",
      context: "💬",
      personality: "🎭",
      summary: "📝",
    }
    return icons[type] ?? "📌"
  }

  private getAge(timestamp: number): string {
    const diff = Date.now() - timestamp
    if (diff < 60_000) return "now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }
}

// ─── Auto Compact Context Manager ──────────────────

export class AutoCompactManager {
  private engine: TurboQuantEngine
  private store: InMemoryStore | FileStore | SQLiteStore
  private config: TurboQuantConfig

  constructor(
    store: InMemoryStore | FileStore | SQLiteStore,
    engine: TurboQuantEngine,
    config?: Partial<TurboQuantConfig>,
  ) {
    this.store = store
    this.engine = engine
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Check if compaction is needed and auto-compact */
  async checkAndCompact(convId: string): Promise<boolean> {
    const conv = await this.store.getConversation(convId)
    if (!conv) return false

    const msgs = conv.messages.filter((m) => m.role !== "system")

    // Only trigger if threshold exceeded
    if (msgs.length <= this.config.compactThreshold) return false

    // Extract messages to compact (everything except recent)
    const compactEnd = msgs.length - this.config.keepRecentCount
    const toCompact = msgs.slice(0, compactEnd)
    const toKeep = msgs.slice(compactEnd)

    if (toCompact.length < 5) return false // Don't compact too little

    // Process each message through TurboQuant
    for (const msg of toCompact) {
      this.engine.processMessage(msg, convId)
    }

    // Generate compact summary
    const summary = this.engine.generateSummary(convId, toCompact)
    const nuggetIds = this.engine
      .getEssentialNuggets(convId)
      .map((n) => n.id)

    // Build compacted block
    const compacted: CompactedBlock = {
      type: "compacted",
      summary,
      nuggets: nuggetIds,
      messageCount: toCompact.length,
      timestamp: Date.now(),
    }

    // Replace compacted messages with compacted block
    // We store it as a system message containing the context
    const compactedMsg: Message = {
      id: `compact-${Date.now()}`,
      role: "system",
      content: `[Context Compacted — ${toCompact.length} messages summarized]\n${summary}\n${this.engine.getNuggetContext(convId)}`,
      timestamp: Date.now(),
      metadata: {
        compacted: true,
        originalCount: toCompact.length,
      },
    }

    conv.messages = [compactedMsg, ...toKeep]
    conv.metadata.lastCompactedAt = Date.now()
    conv.updatedAt = Date.now()

    await this.store.saveConversation(conv)
    return true
  }

  /** Get compaction stats */
  getStats(conv: Conversation): { messageCount: number; compactedCount: number; nuggetCount: number } {
    const msgs = conv.messages
    const compactedBlocks = msgs.filter(
      (m) => m.metadata?.compacted,
    ).length

    return {
      messageCount: msgs.length,
      compactedCount: compactedBlocks,
      nuggetCount: this.engine.getConversationNuggets(conv.id).length,
    }
  }
}

// ─── Enhanced Conversation Manager ──────────────────

export class TurboQuantConversationManager extends ConversationManager {
  private turboEngine: TurboQuantEngine
  private autoCompact: AutoCompactManager
  private compactThreshold: number

  constructor(
    store: InMemoryStore | FileStore | SQLiteStore,
    turboEngine: TurboQuantEngine,
    autoCompact: AutoCompactManager,
    defaultHistoryLimit = 100,
    compactThreshold = 40,
  ) {
    super(store, defaultHistoryLimit)
    this.turboEngine = turboEngine
    this.autoCompact = autoCompact
    this.compactThreshold = compactThreshold
  }

  /** Add message + auto-extract nuggets + auto-compact if needed */
  async addMessage(convId: string, msg: Message): Promise<void> {
    // Extract nuggets
    this.turboEngine.processMessage(msg, convId)

    // Add to store
    await super.addMessage(convId, msg)

    // Auto-compact check
    const conv = await (this as any).store.getConversation(convId) as Conversation
    if (conv && this.shouldCompact(conv)) {
      await this.autoCompact.checkAndCompact(convId)
    }
  }

  /** Build context with TurboQuant nuggets injected */
  async buildContext(convId: string, systemPrompt?: string, limit?: number): Promise<Message[]> {
    const context = await super.buildContext(convId, undefined, limit)

    // Inject TurboQuant memory context as a system message
    const nuggetContext = this.turboEngine.getNuggetContext(convId)

    if (systemPrompt) {
      // Add system prompt with memory context
      const enhancedPrompt = systemPrompt + nuggetContext
      // Replace any existing system prompt or add new one
      const sysIdx = context.findIndex((m) => m.id === "system-prompt")
      if (sysIdx >= 0) {
        context[sysIdx] = {
          id: "system-prompt",
          role: "system",
          content: enhancedPrompt,
          timestamp: 0,
        }
      } else {
        context.unshift({
          id: "system-prompt",
          role: "system",
          content: enhancedPrompt,
          timestamp: 0,
        })
      }
    }

    return context
  }

  private shouldCompact(conv: Conversation): boolean {
    const msgs = conv.messages.filter((m) => m.role !== "system")
    return msgs.length > this.compactThreshold
  }
}
