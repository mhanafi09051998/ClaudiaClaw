import type { PlatformAdapter, SendOptions, Message } from "@claudiaclaw/core"
import { createServer, IncomingMessage, ServerResponse } from "http"

export interface TelegramOptions {
  botToken: string
  onMessage: (msg: Message) => void | Promise<void>
  /** Webhook URL (production) — set to auto-enable webhook mode */
  webhookUrl?: string
  /** Webhook server port (default: 8443) */
  webhookPort?: number
  /** Webhook server host (default: 0.0.0.0) */
  webhookHost?: string
  /** Fallback to polling if webhook fails (default: true) */
  fallbackToPolling?: boolean
  /** Polling interval in ms (default: 1000) */
  pollInterval?: number
}

export class TelegramPlatform implements PlatformAdapter {
  name = "telegram"
  private botToken: string
  private baseUrl: string
  private onMessage: (msg: Message) => void | Promise<void>
  private webhookUrl?: string
  private webhookPort: number
  private webhookHost: string
  private fallbackToPolling: boolean
  private pollInterval: number

  // Polling state
  private offset = 0
  private polling = false
  private pollTimer: ReturnType<typeof setInterval> | null = null

  // Webhook state
  private server: ReturnType<typeof createServer> | null = null

  constructor(options: TelegramOptions) {
    this.botToken = options.botToken
    this.baseUrl = `https://api.telegram.org/bot${options.botToken}`
    this.onMessage = options.onMessage
    this.webhookUrl = options.webhookUrl
    this.webhookPort = options.webhookPort ?? 8443
    this.webhookHost = options.webhookHost ?? "0.0.0.0"
    this.fallbackToPolling = options.fallbackToPolling ?? true
    this.pollInterval = options.pollInterval ?? 1000
  }

  async start(): Promise<void> {
    if (this.webhookUrl) {
      await this.startWebhook()
    } else {
      this.startPolling()
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.stopWebhook()
    }
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

  // ─── Webhook mode ─────────────────────────────────

  private async startWebhook(): Promise<void> {
    // Set webhook on Telegram
    const webhookFullUrl = `${this.webhookUrl}/webhook/${this.botToken}`
    const setRes = await fetch(`${this.baseUrl}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookFullUrl,
        allowed_updates: ["message"],
      }),
    })

    const setData = (await setRes.json()) as { ok: boolean; description?: string }
    if (!setData.ok) {
      console.error(`[TelegramPlatform] Webhook setup failed: ${setData.description}`)
      if (this.fallbackToPolling) {
        console.log("[TelegramPlatform] Falling back to polling")
        this.startPolling()
      }
      return
    }

    console.log(`[TelegramPlatform] Webhook set: ${webhookFullUrl}`)

    // Start HTTP server for webhook
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Only accept POST to /webhook/<token>
      if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ status: "ok", platform: "telegram", mode: "webhook" }))
        return
      }

      if (req.method !== "POST" || req.url !== `/webhook/${this.botToken}`) {
        res.writeHead(404)
        res.end("Not found")
        return
      }

      let body = ""
      req.on("data", (chunk: string) => { body += chunk })
      req.on("end", () => {
        res.writeHead(200)
        res.end("OK")

        try {
          const update = JSON.parse(body) as {
            update_id: number
            message?: {
              message_id: number
              chat: { id: number; type: string }
              from?: { id: number; is_bot?: boolean; first_name?: string; username?: string }
              text?: string
            }
          }

          const msg = update.message
          if (!msg || msg.from?.is_bot) return

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

          const result = this.onMessage(coreMsg)
          if (result instanceof Promise) {
            result.catch((err: Error) =>
              console.error("[TelegramPlatform] Webhook handler error:", err),
            )
          }
        } catch (err) {
          console.error("[TelegramPlatform] Webhook parse error:", err)
        }
      })
    })

    return new Promise((resolve) => {
      this.server!.listen(this.webhookPort, this.webhookHost, () => {
        console.log(`[TelegramPlatform] Webhook server listening on ${this.webhookHost}:${this.webhookPort}`)
        resolve()
      })
    })
  }

  private async stopWebhook(): Promise<void> {
    // Remove webhook from Telegram
    try {
      await fetch(`${this.baseUrl}/deleteWebhook`, { method: "POST" })
    } catch { /* ignore */ }

    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve())
        this.server = null
      })
    }
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
