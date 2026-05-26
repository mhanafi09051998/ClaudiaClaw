import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { AgentCore } from "@claudiaclaw/core"
import { DeepSeekProvider } from "@claudiaclaw/provider-deepseek"
import { TelegramPlatform } from "@claudiaclaw/platform-telegram"
import { ToolRegistry } from "@claudiaclaw/tools"
import { InMemoryStore } from "@claudiaclaw/memory"
import { TurboQuantEngine, AutoCompactManager, TurboQuantConversationManager } from "@claudiaclaw/memory"
import { ConfigManager } from "@claudiaclaw/config"
import type { Message } from "@claudiaclaw/core"

// ─── User personality store ─────────────────────────
interface UserPrefs {
  persona: string     // system prompt for this user
  onboarded: boolean  // has completed onboarding
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
      if (key && value) {
        process.env[key] = value
      }
    }
  }

  // Init config
  const config = new ConfigManager()
  config.defineSchema({
    "deepseek.apiKey": { type: "string", required: true, env: "DEEPSEEK_API_KEY" },
    "deepseek.model": { type: "string", default: "deepseek-v4-flash", env: "DEEPSEEK_MODEL" },
    "telegram.botToken": { type: "string", required: true, env: "TELEGRAM_BOT_TOKEN" },
    "agent.defaultPrompt": { type: "string", default: "Kamu adalah asisten AI yang helpful, ramah, dan cekatan." },
    "agent.compactThreshold": { type: "number", default: 40 },
    "agent.maxHistory": { type: "number", default: 50, env: "MAX_HISTORY" },
    "agent.name": { type: "string", default: "ClaudiaClaw Agent" },
  })

  if (existsSync(configPath)) {
    config.loadFile(configPath)
  }

  // Validate required
  const apiKey = config.get<string>("deepseek.apiKey")
  if (!apiKey) {
    console.error("❌ DEEPSEEK_API_KEY not set. Run 'claudiaclaw init' first or set .env")
    process.exit(1)
  }

  const botToken = config.get<string>("telegram.botToken")
  if (!botToken) {
    console.error("❌ TELEGRAM_BOT_TOKEN not set. Run 'claudiaclaw init' first or set .env")
    process.exit(1)
  }

  // ─── Boot ──────────────────────────────────────────
  const agent = new AgentCore()
  const store = new InMemoryStore()
  const turboQuant = new TurboQuantEngine({
    compactThreshold: config.get<number>("agent.compactThreshold") ?? 40,
    maxNuggetsPerConv: 100,
  })
  const autoCompact = new AutoCompactManager(store, turboQuant)
  const conversations = new TurboQuantConversationManager(store, turboQuant, autoCompact, config.get<number>("agent.maxHistory")!)
  const tools = new ToolRegistry()
  const personas = new PersonaStore()

  const defaultPrompt = config.get<string>("agent.defaultPrompt")!

  // Register built-in tools
  tools.register("ping", "Simple ping to test connectivity", { type: "object", properties: {} }, () => "pong!")

  tools.register(
    "get_time",
    "Get current time in a timezone",
    {
      type: "object",
      properties: {
        timezone: { type: "string", description: "Timezone like Asia/Jakarta" },
      },
    },
    (args) => {
      const tz = (args.timezone as string) ?? "UTC"
      return new Date().toLocaleString("en-US", { timeZone: tz })
    },
  )

  // Provider
  const provider = new DeepSeekProvider({
    apiKey,
    defaultModel: config.get<string>("deepseek.model"),
  })
  agent.registerProvider(provider)

  // ─── Message handler ───────────────────────────────
  async function handleMessage(msg: Message) {
    const chatId = String(msg.metadata?.chatId ?? "")
    const userId = String(msg.metadata?.userId ?? chatId)
    if (!msg.content) return

    const platform = agent.getPlatform("telegram")
    const convId = `telegram:${chatId}`

    // ── Onboarding flow ──//
    if (!personas.isOnboarded(userId)) {
      const firstMsg = msg.content.toLowerCase().trim()

      // Check if user is responding to the personality question
      if (personas.get(userId)?.onboarded === false && firstMsg) {
        // User has replied with their desired personality
        // We'll use this as context but also let the AI handle the conversation
        const prompt = `Kamu adalah asisten AI yang baru saja ditanyai tentang kepribadian yang diinginkan user. 
User ingin kamu menjadi seperti ini: "${firstMsg}".

Gunakan deskripsi ini sebagai pedoman kepribadianmu. Jawab dengan ramah, perkenalkan dirimu dengan nama Claudia,
dan tanyakan apa yang bisa kamu bantu. Jadilah versi dirimu sesuai keinginan user! 🦞`

        personas.set(userId, { persona: firstMsg, onboarded: true })

        await conversations.getOrCreate(convId, "telegram", chatId)
        await conversations.addMessage(convId, msg)

        const ctx = await conversations.buildContext(convId, prompt)
        const result = await provider.complete(ctx)
        await conversations.addMessage(convId, result.message)

        if (platform && result.message.content) {
          await platform.sendMessage(chatId, result.message.content)
        }
        return
      }

      // First interaction — ask about personality
      const greeting =
        `Halo! Aku ClaudiaClaw 🦞 — asisten AI ciptaan kamu.\n\n` +
        `Aku bisa jadi apapun yang kamu mau. Ceritakan, kamu ingin aku jadi asisten seperti apa?\n\n` +
        `Contoh:\n` +
        `• "Kamu adalah asisten yang formal dan profesional"\n` +
        `• "Kamu adalah teman ngobrol yang santai dan humoris"\n` +
        `• "Kamu adalah mentor coding yang sabar dan detail"\n` +
        `• Bebas! Ceritakan gaya yang kamu inginkan 😊`

      // Mark as onboarding in progress
      personas.set(userId, { persona: "", onboarded: false })

      await conversations.getOrCreate(convId, "telegram", chatId)
      await conversations.addMessage(convId, msg)

      if (platform) {
        await platform.sendMessage(chatId, greeting)
      }
      return
    }

    // ── Normal message flow ──//
    const userPrompt = personas.get(userId)?.persona ?? defaultPrompt

    await conversations.getOrCreate(convId, "telegram", chatId)
    await conversations.addMessage(convId, msg)

    const context = await conversations.buildContext(convId, userPrompt)
    const result = await provider.complete(context, { tools: tools.getAllDefinitions() })
    await conversations.addMessage(convId, result.message)

    // Handle tool calls
    if (result.message.toolCalls?.length) {
      for (const tc of result.message.toolCalls) {
        const toolResult = await agent.executeToolCall(tc, (name, args) =>
          tools.execute({ id: tc.id, type: "function", function: { name, arguments: JSON.stringify(args) } }),
        )
        await conversations.addMessage(convId, {
          id: crypto.randomUUID(),
          role: "tool",
          content: toolResult.content,
          name: toolResult.name,
          toolCallId: toolResult.toolCallId,
          timestamp: Date.now(),
        })
      }

      const updatedContext = await conversations.buildContext(convId, userPrompt)
      const finalResult = await provider.complete(updatedContext)
      await conversations.addMessage(convId, finalResult.message)

      if (platform && finalResult.message.content) {
        await platform.sendMessage(chatId, finalResult.message.content)
      }
    } else if (result.message.content) {
      if (platform) {
        await platform.sendMessage(chatId, result.message.content)
      }
    }
  }

  // ─── Platform ───────────────────────────────────────
  const telegram = new TelegramPlatform({ botToken, onMessage: handleMessage })
  agent.registerPlatform(telegram)

  // ─── Events ─────────────────────────────────────────
  const agentName = config.get<string>("agent.name") ?? "ClaudiaClaw"
  agent.on("agent:start", () => console.log(`\n🦞 ${agentName} is running! Press Ctrl+C to stop.\n`))
  agent.on("error", (err) => console.error("💥 Error:", err))

  // Graceful shutdown
  process.on("SIGINT", async () => { await agent.stop(); process.exit(0) })
  process.on("SIGTERM", async () => { await agent.stop(); process.exit(0) })

  await agent.start()
}
