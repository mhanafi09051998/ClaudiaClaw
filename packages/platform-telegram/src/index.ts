import type { PlatformAdapter, SendOptions, Message } from "@claudiaclaw/core"

export interface TelegramOptions {
  botToken: string
  onMessage: (msg: Message) => void | Promise<void>
  /** Polling interval in ms (default: 1000) */
  pollInterval?: number
}

export class TelegramPlatform implements PlatformAdapter {
  name = "telegram"
  private botToken: string
  private baseUrl: string
  private onMessage: (msg: Message) => void | Promise<void>
  private pollInterval: number

  // Polling state
  private offset = 0
  private polling = false
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: TelegramOptions) {
    this.botToken = options.botToken
    this.baseUrl = `https://api.telegram.org/bot${options.botToken}`
    this.onMessage = options.onMessage
    this.pollInterval = options.pollInterval ?? 1000
  }

  async start(): Promise<void> {
    this.startPolling()
  }

  async stop(): Promise<void> {
    this.stopPolling()
    console.log("[TelegramPlatform] Stopped")
  }

  async sendMessage(chatId: string, text: string, options?: SendOptions): Promise<string> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode ?? "HTML",
    }
    if (options?.replyTo) body.reply_to_message_id = Number(options.replyTo)

    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown")
      throw new Error(`Telegram sendMessage error ${res.status}: ${err}`)
    }

    const data = (await res.json()) as { result?: { message_id?: number } }
    return String(data.result?.message_id ?? "")
  }

  async sendReaction(chatId: string, messageId: string, reaction: string): Promise<void> {
    await fetch(`${this.baseUrl}/setMessageReaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: Number(messageId),
        reaction: [{ type: "emoji", emoji: reaction }],
      }),
    }).catch(() => {})
  }

  // ─── Polling mode ─────────────────────────────────

  private startPolling(): void {
    this.polling = true
    this.pollTimer = setInterval(() => this.poll(), this.pollInterval)
    this.poll().catch(console.error)
    console.log(`[TelegramPlatform] Started polling (every ${this.pollInterval}ms)`)
  }

  private stopPolling(): void {
    this.polling = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async poll(): Promise<void> {
    if (!this.polling) return

    try {
      const url = `${this.baseUrl}/getUpdates?timeout=10&offset=${this.offset + 1}&allowed_updates=["message"]`
      const res = await fetch(url)
      if (!res.ok) return

      const data = (await res.json()) as {
        result?: Array<{
          update_id: number
          message?: {
            message_id: number
            chat: { id: number; type: string }
            from?: { id: number; is_bot?: boolean; first_name?: string; username?: string }
            text?: string
          }
        }>
      }

      if (!data.result) return

      for (const update of data.result) {
        this.offset = update.update_id
        const msg = update.message
        if (!msg || msg.from?.is_bot) continue

        const coreMsg: Message = {
          id: String(msg.message_id),
          role: "user",
          content: msg.text ?? "",
          timestamp: Date.now(),
          metadata: {
            chatId: String(msg.chat.id),
            chatType: msg.chat.type,
            userId: String(msg.from?.id),
            username: msg.from?.username,
            firstName: msg.from?.first_name,
            messageId: msg.message_id,
          },
        }

        await this.onMessage(coreMsg)
      }
    } catch (err) {
      console.error("[TelegramPlatform] Poll error:", err)
    }
  }
}
