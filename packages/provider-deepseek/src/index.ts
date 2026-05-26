import type { ProviderAdapter, Message, CompletionOptions, CompletionResult, Chunk, ToolCall } from "@claudiaclaw/core"

export interface DeepSeekOptions {
  apiKey: string
  baseUrl?: string
  defaultModel?: string
}

export class DeepSeekProvider implements ProviderAdapter {
  name = "deepseek"
  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(options: DeepSeekOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? "https://api.deepseek.com"
    this.defaultModel = options.defaultModel ?? "deepseek-chat"
  }

  async complete(messages: Message[], options: CompletionOptions): Promise<CompletionResult> {
    const url = `${this.baseUrl}/v1/chat/completions`
    const model = options.model ?? this.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(this.mapMessage),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
    }

    if (options.systemPrompt) {
      body.messages = [
        { role: "system" as const, content: options.systemPrompt },
        ...(body.messages as Array<{ role: string; content: string }>),
      ]
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => "unknown")
      throw new Error(`DeepSeek API error ${response.status}: ${errBody}`)
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          role: string
          content: string | null
          tool_calls?: Array<{
            id: string
            type: "function"
            function: { name: string; arguments: string }
          }>
        }
        finish_reason: string
      }>
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const choice = data.choices[0]
    const resultMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: choice.message.content ?? "",
      timestamp: Date.now(),
    }

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      resultMsg.toolCalls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }))
    }

    return {
      message: resultMsg,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    }
  }

  async *stream(messages: Message[], options: CompletionOptions): AsyncIterable<Chunk> {
    const url = `${this.baseUrl}/v1/chat/completions`
    const model = options.model ?? this.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(this.mapMessage),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
    }

    if (options.systemPrompt) {
      body.messages = [
        { role: "system", content: options.systemPrompt },
        ...(body.messages as Array<{ role: string; content: string }>),
      ]
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => "unknown")
      throw new Error(`DeepSeek API error ${response.status}: ${errBody}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith("data: ")) continue
        const payload = trimmed.slice(6)
        if (payload === "[DONE]") {
          yield { type: "done" }
          return
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices: Array<{
              delta: {
                content?: string
                tool_calls?: Array<{
                  index: number
                  id?: string
                  type?: string
                  function?: { name?: string; arguments?: string }
                }>
              }
              finish_reason?: string
            }>
          }

          for (const choice of parsed.choices) {
            const delta = choice.delta
            if (delta.content) {
              yield { type: "text", content: delta.content }
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id && tc.function?.name) {
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: tc.id,
                      type: "function",
                      function: {
                        name: tc.function.name,
                        arguments: tc.function.arguments ?? "",
                      },
                    },
                  }
                }
              }
            }
            if (choice.finish_reason === "stop" || choice.finish_reason === "tool_calls") {
              yield { type: "done" }
            }
          }
        } catch {
          // skip parse errors in streaming
        }
      }
    }

    yield { type: "done" }
  }

  private mapMessage(msg: Message): Record<string, unknown> {
    const base: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    }
    if (msg.name) base.name = msg.name
    if (msg.toolCallId) base.tool_call_id = msg.toolCallId
    if (msg.toolCalls) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }))
    }
    return base
  }
}
