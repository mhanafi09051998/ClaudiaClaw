import { AgentCore } from "@claudiaclaw/core"
import { DeepSeekProvider } from "@claudiaclaw/provider-deepseek"
import { TelegramPlatform } from "@claudiaclaw/platform-telegram"
import { ToolRegistry } from "@claudiaclaw/tools"
import { ConversationManager, InMemoryStore } from "@claudiaclaw/memory"
import { ConfigManager } from "@claudiaclaw/config"

// ─── Config ───────────────────────────────────────────
const config = new ConfigManager()
config.defineSchema({
  "deepseek.apiKey": { type: "string", required: true, env: "DEEPSEEK_API_KEY" },
  "deepseek.model": { type: "string", default: "deepseek-chat", env: "DEEPSEEK_MODEL" },
  "telegram.botToken": { type: "string", required: true, env: "TELEGRAM_BOT_TOKEN" },
  "agent.systemPrompt": {
    type: "string",
    default: "You are Claudia, a helpful assistant. Be concise and friendly.",
    env: "SYSTEM_PROMPT",
  },
  "agent.maxHistory": { type: "number", default: 50, env: "MAX_HISTORY" },
})

config.loadFile("./config.json")

// ─── Core ─────────────────────────────────────────────
const agent = new AgentCore()
const store = new InMemoryStore()
const conversations = new ConversationManager(store, config.get<number>("agent.maxHistory")!)
const tools = new ToolRegistry()

// ─── Register tools ──────────────────────────────────
tools.register(
  "get_time",
  "Get the current server time",
  {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "Timezone (e.g., Asia/Jakarta)",
      },
    },
  },
  (args) => {
    const tz = (args.timezone as string) ?? "UTC"
    const now = new Date()
    const time = now.toLocaleString("en-US", { timeZone: tz })
    return `Current time in ${tz}: ${time}`
  },
)

tools.register(
  "calculator",
  "Perform basic math operations",
  {
    type: "object",
    properties: {
      expression: { type: "string", description: "Math expression to evaluate" },
    },
    required: ["expression"],
  },
  (args) => {
    try {
      const result = Function(`"use strict"; return (${args.expression})`)()
      return `Result: ${result}`
    } catch {
      return "Error: Invalid expression"
    }
  },
)

// ─── Provider ─────────────────────────────────────────
const provider = new DeepSeekProvider({
  apiKey: config.get<string>("deepseek.apiKey")!,
  defaultModel: config.get<string>("deepseek.model"),
})

agent.registerProvider(provider)

// ─── Message handler ─────────────────────────────────
async function handleMessage(msg: import("@claudiaclaw/core").Message) {
  const chatId = String(msg.metadata?.chatId ?? "")
  if (!msg.content) return

  const convId = `telegram:${chatId}`
  const conv = await conversations.getOrCreate(convId, "telegram", chatId)
  await conversations.addMessage(convId, msg)

  // Build context with history
  const context = await conversations.buildContext(convId, config.get<string>("agent.systemPrompt"))

  // Get AI completion
  const result = await provider.complete(context, {
    tools: tools.getAllDefinitions(),
  })

  await conversations.addMessage(convId, result.message)

  // Handle tool calls
  if (result.message.toolCalls && result.message.toolCalls.length > 0) {
    for (const tc of result.message.toolCalls) {
      const toolResult = await agent.executeToolCall(tc, (name, args) => tools.execute({ id: tc.id, type: "function", function: { name, arguments: JSON.stringify(args) } }))
      await conversations.addMessage(convId, {
        id: crypto.randomUUID(),
        role: "tool",
        content: toolResult.content,
        name: toolResult.name,
        toolCallId: toolResult.toolCallId,
        timestamp: Date.now(),
      })
    }

    // Second completion with tool results
    const updatedContext = await conversations.buildContext(convId, config.get<string>("agent.systemPrompt"))
    const finalResult = await provider.complete(updatedContext)
    await conversations.addMessage(convId, finalResult.message)

    // Send final response
    const platform = agent.getPlatform("telegram")
    if (platform && finalResult.message.content) {
      await platform.sendMessage(chatId, finalResult.message.content)
    }
  } else if (result.message.content) {
    // Send response directly
    const platform = agent.getPlatform("telegram")
    if (platform) {
      await platform.sendMessage(chatId, result.message.content)
    }
  }
}

// ─── Platform ─────────────────────────────────────────
const telegram = new TelegramPlatform({
  botToken: config.get<string>("telegram.botToken")!,
  onMessage: handleMessage,
})

agent.registerPlatform(telegram)

// ─── Events ──────────────────────────────────────────
agent.on("agent:start", () => console.log("🤖 ClaudiaClaw agent is running!"))
agent.on("error", (err) => console.error("💥 Error:", err))

// ─── Start ───────────────────────────────────────────
agent.start().catch(console.error)

// Graceful shutdown
process.on("SIGINT", async () => {
  await agent.stop()
  process.exit(0)
})
process.on("SIGTERM", async () => {
  await agent.stop()
  process.exit(0)
})
