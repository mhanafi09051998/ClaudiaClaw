/** A single message in a conversation */
export interface Message {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  name?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
  timestamp: number
  metadata?: Record<string, unknown>
}

/** Tool call request from the AI */
export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

/** Tool call result to send back */
export interface ToolResult {
  toolCallId: string
  role: "tool"
  content: string
  name: string
}

/** Conversation thread */
export interface Conversation {
  id: string
  platform: string
  platformChatId: string
  messages: Message[]
  metadata: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

/** Provider (AI) adapter interface */
export interface ProviderAdapter {
  name: string
  complete(messages: Message[], options: CompletionOptions): Promise<CompletionResult>
  stream?(messages: Message[], options: CompletionOptions): AsyncIterable<Chunk>
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  systemPrompt?: string
}

export interface CompletionResult {
  message: Message
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface Chunk {
  type: "text" | "tool_call" | "done"
  content?: string
  toolCall?: ToolCall
  usage?: CompletionResult["usage"]
}

/** Tool definition for function calling */
export interface ToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** Platform (chat) adapter interface */
export interface PlatformAdapter {
  name: string
  sendMessage(chatId: string, text: string, options?: SendOptions): Promise<string>
  sendReaction?(chatId: string, messageId: string, reaction: string): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
}

export interface SendOptions {
  replyTo?: string
  parseMode?: string
  buttons?: unknown[]
}

/** Agent configuration */
export interface AgentConfig {
  agentId: string
  name: string
  provider: string
  model: string
  systemPrompt: string
  platform: string
  platformChatId?: string
  tools: string[]
  maxHistory?: number
  temperature?: number
  maxTokens?: number
}

/** Plugin interface */
export interface Plugin {
  name: string
  setup?(agent: import("../agent.js").AgentCore): void | Promise<void>
  teardown?(): void | Promise<void>
}

/** Middleware types */
export type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>

export interface MiddlewareContext {
  message: Message
  conversation: Conversation
  agent: import("../agent.js").AgentCore
  [key: string]: unknown
}

/** Events emitted by the core */
export interface AgentEvents {
  "message:received": (msg: Message, conv: Conversation) => void
  "message:sent": (msg: Message, conv: Conversation) => void
  "tool:called": (toolCall: ToolCall) => void
  "tool:result": (result: ToolResult) => void
  "error": (err: Error) => void
  "agent:start": () => void
  "agent:stop": () => void
}
