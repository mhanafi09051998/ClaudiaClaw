import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { AgentCore, IdentityManager, IsolationManager, AllowlistFile, PairingManager } from "@claudiaclaw/core"
import type { IsolatedContext } from "@claudiaclaw/core"
import { DeepSeekProvider } from "@claudiaclaw/provider-deepseek"
import { TelegramPlatform } from "@claudiaclaw/platform-telegram"
import { ToolRegistry } from "@claudiaclaw/tools"
import { SkillManager, createBasicSkill } from "@claudiaclaw/skill"
import { SQLiteStore } from "@claudiaclaw/memory"
import { TurboQuantEngine, AutoCompactManager, TurboQuantConversationManager } from "@claudiaclaw/memory"
import { ConfigManager } from "@claudiaclaw/config"
import type { Message } from "@claudiaclaw/core"

// ─── Per-user/group stores ───────────────────────────
class IsolatedStores {
  private stores = new Map<string, {
    store: SQLiteStore
    tq: TurboQuantEngine
    ac: AutoCompactManager
    cm: TurboQuantConversationManager
    identity: IdentityManager
  }>()

  async resolve(
    iso: IsolatedContext,
    compactThreshold: number,
    maxHistory: number,
  ): Promise<IsolatedStores["stores"] extends Map<string, infer V> ? V : never> {
    const key = `${iso.type}:${iso.id}`
    if (this.stores.has(key)) return this.stores.get(key)!

    // Per-user/group SQLite database
    const store = new SQLiteStore({ dbPath: iso.memoryDbPath, saveInterval: 10000 })
    await store.init()

    const tq = new TurboQuantEngine({ compactThreshold, maxNuggetsPerConv: 100 }, store)
    const ac = new AutoCompactManager(store, tq)
    const cm = new TurboQuantConversationManager(store, tq, ac, maxHistory)

    // Per-user identity (only for users)
    const identity = new IdentityManager({ dataDir: iso.dir, identityFile: "identity.md", soulFile: "soul.md" })
    identity.init()

    const ctx = { store, tq, ac, cm, identity }
    this.stores.set(key, ctx)

    console.log(`[Isolation] Created store for ${iso.type} ${iso.id}`)
    return ctx as any
  }

  async shutdownAll(): Promise<void> {
    for (const [, ctx] of this.stores) {
      ctx.store.close()
    }
    this.stores.clear()
  }
}

// ─── User personality store ─────────────────────────
interface UserPrefs {
  persona: string
  onboarded: boolean
}

class PersonaStore {
  private store = new Map<string, UserPrefs>()

  get(userId: string): UserPrefs | undefined {
    return this.store.get(userId)
  }

  set(userId: string, prefs: UserPrefs): void {
    this.store.set(userId, prefs)
  }

  isOnboarded(userId: string): boolean {
    return this.store.get(userId)?.onboarded ?? false
  }
}

// ─── Main ────────────────────────────────────────────
export async function start() {
  const cwd = process.cwd()
  const envPath = join(cwd, ".env")
  const configPath = join(cwd, "config.json")

  // Load .env
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8")
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      if (key && value) process.env[key] = value
    }
  }

  // Config
  const config = new ConfigManager()
  config.defineSchema({
    "deepseek.apiKey": { type: "string", required: true, env: "DEEPSEEK_API_KEY" },
    "deepseek.model": { type: "string", default: "deepseek-v4-flash", env: "DEEPSEEK_MODEL" },
    "telegram.botToken": { type: "string", required: true, env: "TELEGRAM_BOT_TOKEN" },
    "agent.defaultPrompt": { type: "string", default: "Kamu adalah asisten AI yang helpful, ramah, dan cekatan." },
    "agent.compactThreshold": { type: "number", default: 40 },
    "agent.maxHistory": { type: "number", default: 50, env: "MAX_HISTORY" },
    "agent.name": { type: "string", default: "ClaudiaClaw Agent" },
    // Allowlist
    "allowlist.enabled": { type: "boolean", default: false },
    "allowlist.users": { type: "string", default: "", env: "ALLOWLIST_USERS" },
    "allowlist.groups": { type: "string", default: "", env: "ALLOWLIST_GROUPS" },
    "allowlist.owners": { type: "string", default: "", env: "ALLOWLIST_OWNERS" },
  })

  if (existsSync(configPath)) config.loadFile(configPath)

  const apiKey = config.get<string>("deepseek.apiKey")
  if (!apiKey) { console.error("❌ DEEPSEEK_API_KEY not set"); process.exit(1) }

  const botToken = config.get<string>("telegram.botToken")
  if (!botToken) { console.error("❌ TELEGRAM_BOT_TOKEN not set"); process.exit(1) }

  // ─── Core Systems ────────────────────────────────────
  const agent = new AgentCore()
  const tools = new ToolRegistry()
  const personas = new PersonaStore()
  const isoStore = new IsolatedStores()

  // ─── Isolation & Allowlist ─────────────────────────
  const isolation = new IsolationManager("./data")
  const allowlist = new AllowlistFile("./data/claudiaclaw", {
    users: (config.get<string>("allowlist.users") ?? "").split(",").filter(Boolean),
    groups: (config.get<string>("allowlist.groups") ?? "").split(",").filter(Boolean),
    owners: (config.get<string>("allowlist.owners") ?? "").split(",").filter(Boolean),
  })
  allowlist.load()

  // Pairing manager
  const pairingMgr = new PairingManager("./data/claudiaclaw")

  if (config.get<boolean>("allowlist.enabled")) {
    console.log("[Allowlist] Enabled — restricted access")
    console.log("[Allowlist] Status:", JSON.stringify(allowlist.status))
  }

  // ─── Global Identity ───────────────────────────────
  const globalIdentity = new IdentityManager()
  globalIdentity.init()
  const globalSystemIdentity = globalIdentity.getSystemPrompt()

  // ─── Skills ─────────────────────────────────────────
  const skillManager = new SkillManager({ skillsDir: "./skills" })
  skillManager.register(createBasicSkill())
  await skillManager.loadAll(agent, tools)
  const extSkills = await skillManager.scanDirectory()
  if (extSkills > 0) console.log(`[Skills] Loaded ${extSkills} external skill(s)`)

  // ─── Provider ───────────────────────────────────────
  const provider = new DeepSeekProvider({
    apiKey,
    defaultModel: config.get<string>("deepseek.model"),
  })
  agent.registerProvider(provider)

  const compactThreshold = config.get<number>("agent.compactThreshold") ?? 40
  const maxHistory = config.get<number>("agent.maxHistory") ?? 50
  const defaultPrompt = config.get<string>("agent.defaultPrompt")!

  // ─── Message handler ───────────────────────────────
  async function handleMessage(msg: Message) {
    const chatId = String(msg.metadata?.chatId ?? "")
    const userId = String(msg.metadata?.userId ?? chatId)
    const chatType = String(msg.metadata?.chatType ?? "private")
    if (!msg.content) return

    const platform = agent.getPlatform("telegram")

    // ── Allowlist check ──//
    if (!allowlist.isAllowed(chatType, chatId, userId)) {
      console.log(`[Allowlist] Blocked: user=${userId} chat=${chatId}`)
      if (platform) {
        // Generate pairing code
        const pairing = pairingMgr.generate(userId, chatType, chatId, String(msg.metadata?.username ?? ""))
        const msg = `⛔ Access not configured.

Your Telegram user ID: ${userId}
Your pairing code: ` + `${pairing.code}` + `

Ask the bot owner to approve with:
claudiaclaw pairing approve telegram ${pairing.code}`

        await platform.sendMessage(chatId, msg)
      }
      return
    }

    // ── Resolve isolated store ──//
    const iso = isolation.resolve(chatType, chatId, userId)
    const ctx = await isoStore.resolve(iso, compactThreshold, maxHistory)
    const convId = `${chatType}:${chatId}`

    // Load persistent nuggets
    ctx.tq.loadNuggetsFromStore(convId)

    // Per-user/group identity
    const systemIdentity = [globalSystemIdentity, ctx.identity.getSystemPrompt()]
      .filter(Boolean).join("\n\n")

    // ── Onboarding flow ──//
    if (!personas.isOnboarded(userId)) {
      const firstMsg = msg.content.toLowerCase().trim()

      if (personas.get(userId)?.onboarded === false && firstMsg) {
        const prompt = `Kamu adalah asisten AI yang baru saja ditanyai tentang kepribadian yang diinginkan user. 
User ingin kamu menjadi seperti ini: "${firstMsg}".

Gunakan deskripsi ini sebagai pedoman kepribadianmu. Jawab dengan ramah, perkenalkan dirimu dengan nama Claudia,
dan tanyakan apa yang bisa kamu bantu. Jadilah versi dirimu sesuai keinginan user! 🦞`

        personas.set(userId, { persona: firstMsg, onboarded: true })
        await ctx.cm.getOrCreate(convId, chatType, chatId)
        await ctx.cm.addMessage(convId, msg)
        const ctxMsgs = await ctx.cm.buildContext(convId, prompt)
        const result = await provider.complete(ctxMsgs)
        await ctx.cm.addMessage(convId, result.message)
        if (platform && result.message.content) await platform.sendMessage(chatId, result.message.content)
        return
      }

      const greeting =
        `Halo! Aku ClaudiaClaw 🦞 — asisten AI ciptaan kamu.\n\n` +
        `Aku bisa jadi apapun yang kamu mau. Ceritakan, kamu ingin aku jadi asisten seperti apa?\n\n` +
        `Contoh:\n` +
        `• "Kamu adalah asisten yang formal dan profesional"\n` +
        `• "Kamu adalah teman ngobrol yang santai dan humoris"\n` +
        `• "Kamu adalah mentor coding yang sabar dan detail"\n` +
        `• Bebas! Ceritakan gaya yang kamu inginkan 😊`

      personas.set(userId, { persona: "", onboarded: false })
      await ctx.cm.getOrCreate(convId, chatType, chatId)
      await ctx.cm.addMessage(convId, msg)
      if (platform) await platform.sendMessage(chatId, greeting)
      return
    }

    // ── Normal message flow ──//
    const userPrompt = personas.get(userId)?.persona ?? defaultPrompt
    const skillContext = skillManager.getCombinedSystemPrompt()
    const fullPrompt = [systemIdentity, skillContext, userPrompt].filter(Boolean).join("\n\n")

    await ctx.cm.getOrCreate(convId, chatType, chatId)
    await ctx.cm.addMessage(convId, msg)

    const context = await ctx.cm.buildContext(convId, fullPrompt)
    const result = await provider.complete(context, { tools: tools.getAllDefinitions() })
    await ctx.cm.addMessage(convId, result.message)

    if (result.message.toolCalls?.length) {
      for (const tc of result.message.toolCalls) {
        const toolResult = await agent.executeToolCall(tc, (name, args) =>
          tools.execute({ id: tc.id, type: "function", function: { name, arguments: JSON.stringify(args) } }),
        )
        await ctx.cm.addMessage(convId, {
          id: crypto.randomUUID(), role: "tool", content: toolResult.content,
          name: toolResult.name, toolCallId: toolResult.toolCallId, timestamp: Date.now(),
        })
      }

      const updatedContext = await ctx.cm.buildContext(convId, fullPrompt)
      const finalResult = await provider.complete(updatedContext)
      await ctx.cm.addMessage(convId, finalResult.message)
      if (platform && finalResult.message.content) await platform.sendMessage(chatId, finalResult.message.content)
    } else if (result.message.content) {
      if (platform) await platform.sendMessage(chatId, result.message.content)
    }
  }

  // ─── Platform ───────────────────────────────────────
  const telegram = new TelegramPlatform({ botToken, onMessage: handleMessage })
  agent.registerPlatform(telegram)

  // ─── Events ─────────────────────────────────────────
  const agentName = config.get<string>("agent.name") ?? "ClaudiaClaw"
  agent.on("agent:start", () => console.log(`\n🦞 ${agentName} is running! Press Ctrl+C to stop.\n`))
  agent.on("error", (err) => console.error("💥 Error:", err))

  async function shutdown() {
    await agent.stop()
    await isoStore.shutdownAll()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  await agent.start()
}
