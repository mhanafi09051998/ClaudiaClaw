import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { AgentCore } from "@claudiaclaw/core"
import { DeepSeekProvider } from "@claudiaclaw/provider-deepseek"
import { TelegramPlatform } from "@claudiaclaw/platform-telegram"
import { ToolRegistry } from "@claudiaclaw/tools"
import { ConversationManager, InMemoryStore } from "@claudiaclaw/memory"
import { ConfigManager } from "@claudiaclaw/config"

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
    "agent.systemPrompt": { type: "string", default: "You are a helpful assistant.", env: "SYSTEM_PROMPT" },
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
  const conversations = new ConversationManager(store, config.get<number>("agent.maxHistory")!)
  const tools = new ToolRegistry()

  // Register built-in tools
  tools.register(
    "ping",
    "Simple ping to test connectivity",
    { type: "object", properties: {} },
    () => "pong!",
  )

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

  // Message handler
  async function handleMessage(msg: import("@claudiaclaw/core").Message) {
    const chatId = String(msg.metadata?.chatId ?? "")
    if (!msg.content) return

    const convId = `telegram:${chatId}`
    await conversations.getOrCreate(convId, "telegram", chatId)
    await conversations.addMessage(convId, msg)

    const context = await conversations.buildContext(convId, config.get<string>("agent.systemPrompt"))
    const result = await provider.complete(context, { tools: tools.getAllDefinitions() })
    await conversations.addMessage(convId, result.message)

    // Handle tool calls
    if (result.message.toolCalls?.length) {
      for (const tc of result.message.toolCalls) {
        const toolResult = await agent.executeToolCall(tc, (name, args) =>
          tools.execute({
            id: tc.id,
            type: "function",
            function: { name, arguments: JSON.stringify(args) },
          }),
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

      const updatedContext = await conversations.buildContext(convId, config.get<string>("agent.systemPrompt"))
      const finalResult = await provider.complete(updatedContext)
      await conversations.addMessage(convId, finalResult.message)

      const platform = agent.getPlatform("telegram")
      if (platform && finalResult.message.content) {
        await platform.sendMessage(chatId, finalResult.message.content)
      }
    } else if (result.message.content) {
      const platform = agent.getPlatform("telegram")
      if (platform) {
        await platform.sendMessage(chatId, result.message.content)
      }
    }
  }

  // Platform
  const telegram = new TelegramPlatform({ botToken, onMessage: handleMessage })
  agent.registerPlatform(telegram)

  // Events
  const agentName = config.get<string>("agent.name") ?? "ClaudiaClaw"
  agent.on("agent:start", () => console.log(`\n🦞 ${agentName} is running! Press Ctrl+C to stop.\n`))
  agent.on("error", (err) => console.error("💥 Error:", err))

  // Graceful shutdown
  process.on("SIGINT", async () => { await agent.stop(); process.exit(0) })
  process.on("SIGTERM", async () => { await agent.stop(); process.exit(0) })

  await agent.start()
}
