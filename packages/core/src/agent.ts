import type {
  Message,
  Conversation,
  ProviderAdapter,
  PlatformAdapter,
  MiddlewareFn,
  MiddlewareContext,
  Plugin,
  AgentEvents,
  ToolCall,
  ToolResult,
} from "./types/index.js"

export class AgentCore {
  private providers: Map<string, ProviderAdapter> = new Map()
  private platforms: Map<string, PlatformAdapter> = new Map()
  private plugins: Plugin[] = []
  private middlewares: MiddlewareFn[] = []
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  private _running = false

  get running(): boolean {
    return this._running
  }

  // --- Provider registry ---
  registerProvider(adapter: ProviderAdapter): void {
    this.providers.set(adapter.name, adapter)
  }

  getProvider(name: string): ProviderAdapter | undefined {
    return this.providers.get(name)
  }

  // --- Platform registry ---
  registerPlatform(adapter: PlatformAdapter): void {
    this.platforms.set(adapter.name, adapter)
  }

  getPlatform(name: string): PlatformAdapter | undefined {
    return this.platforms.get(name)
  }

  // --- Middleware ---
  use(fn: MiddlewareFn): void {
    this.middlewares.push(fn)
  }

  // --- Plugin system ---
  registerPlugin(plugin: Plugin): void {
    this.plugins.push(plugin)
  }

  // --- Event system ---
  on<K extends keyof AgentEvents>(event: K, fn: AgentEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(fn as (...args: unknown[]) => void)
  }

  off<K extends keyof AgentEvents>(event: K, fn: AgentEvents[K]): void {
    this.listeners.get(event)?.delete(fn as (...args: unknown[]) => void)
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(...args)
      } catch (e) {
        console.error(`[ClaudiaClaw] Error in event listener "${event}":`, e)
      }
    })
  }

  // --- Lifecycle ---
  async start(): Promise<void> {
    if (this._running) return
    this._running = true

    for (const plugin of this.plugins) {
      await plugin.setup?.(this)
    }

    for (const [, platform] of this.platforms) {
      await platform.start()
    }

    this.emit("agent:start")
    console.log("[ClaudiaClaw] Agent started")
  }

  async stop(): Promise<void> {
    if (!this._running) return
    this._running = false

    for (const [, platform] of this.platforms) {
      await platform.stop()
    }

    for (const plugin of this.plugins.reverse()) {
      await plugin.teardown?.()
    }

    this.emit("agent:stop")
    console.log("[ClaudiaClaw] Agent stopped")
  }

  // --- Message processing pipeline ---
  async processMessage(
    platform: string,
    chatId: string,
    message: Omit<Message, "id" | "timestamp">,
  ): Promise<Message | null> {
    const fullMsg: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }

    const conversation: Conversation = {
      id: `${platform}:${chatId}`,
      platform,
      platformChatId: chatId,
      messages: [fullMsg],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.emit("message:received", fullMsg, conversation)

    // Run middleware pipeline
    const ctx: MiddlewareContext = {
      message: fullMsg,
      conversation,
      agent: this,
    }

    const runMiddlewares = async (idx: number): Promise<void> => {
      if (idx < this.middlewares.length) {
        await this.middlewares[idx](ctx, () => runMiddlewares(idx + 1))
      }
    }

    try {
      await runMiddlewares(0)
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)))
      return null
    }

    return ctx.message
  }

  // --- Tool helpers ---
  async executeToolCall(
    toolCall: ToolCall,
    handler: (name: string, args: unknown) => Promise<string>,
  ): Promise<ToolResult> {
    this.emit("tool:called", toolCall)
    let content: string
    try {
      content = await handler(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
      )
    } catch (err) {
      content = `Error: ${err instanceof Error ? err.message : String(err)}`
    }
    const result: ToolResult = {
      toolCallId: toolCall.id,
      role: "tool",
      content,
      name: toolCall.function.name,
    }
    this.emit("tool:result", result)
    return result
  }
}
