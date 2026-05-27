import { createInterface } from "readline/promises"
import { writeFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { stdin as input, stdout as output } from "process"

// ─── Single readline instance ───────────────────────

// Inisialisasi stdin dan paksa terminal mode untuk kompatibilitas Windows/Git Bash
input.resume()
const rl = createInterface({ input, output, terminal: true })

async function ask(question: string, defaultVal?: string): Promise<string> {
  const answer = await rl.question(
    defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `,
  )
  return answer.trim() || defaultVal || ""
}

async function confirm(question: string, defaultVal = true): Promise<boolean> {
  const answer = await rl.question(`${question} (${defaultVal ? "Y/n" : "y/N"}): `)
  const t = answer.trim().toLowerCase()
  if (!t) return defaultVal
  return t === "y" || t === "yes"
}

async function select(question: string, options: string[], defaultIdx = 0): Promise<number> {
  console.log(`\n${question}`)
  options.forEach((opt, i) => {
    console.log(`  ${i === defaultIdx ? "➤" : " "} ${i + 1}. ${opt}`)
  })
  const answer = await rl.question(`Pilih (1-${options.length}, default ${defaultIdx + 1}): `)
  const num = parseInt(answer.trim())
  return num >= 1 && num <= options.length ? num - 1 : defaultIdx
}

// ─── Main ────────────────────────────────────────────

export async function init() {
  const cwd = process.cwd()

  try {
    console.log(`
╔══════════════════════════════════════════╗
║          💅🏻 ClaudiaClaw v0.1.0          ║
║   Super modern agent framework           ║
║   Built with DeepSeek                    ║
╚══════════════════════════════════════════╝
`)
    console.log("Selamat datang! Kita akan setup ClaudiaClaw-mu.\n")

    // ── Step 1: DeepSeek API Key ──//
    console.log("─── Step 1/3: AI Provider ───")
    await select("Pilih AI Provider:", [
      "DeepSeek (default)",
      "OpenAI (coming soon)",
      "Anthropic (coming soon)",
    ])

    const apiKey = await ask("Masukkan DeepSeek API Key")
    if (!apiKey) {
      console.log("\n❌ API Key wajib diisi. Jalankan ulang: claudiaclaw init")
      return
    }

    const model = await ask("Model", "deepseek-v4-flash")

    // ── Step 2: Telegram Bot Token ──//
    console.log("\n─── Step 2/3: Telegram Bot ───")
    const botToken = await ask("Masukkan Telegram Bot Token (dari @BotFather)")
    if (!botToken) {
      console.log("\n❌ Bot Token wajib diisi.")
      return
    }

    // ── Step 3: Apply config ──//
    console.log("\n─── Step 3/3: Menulis Konfigurasi ───")

    const envContent = `# ClaudiaClaw Configuration
DEEPSEEK_API_KEY=***
DEEPSEEK_MODEL=${model}
TELEGRAM_BOT_TOKEN=***
`
    writeFileSync(join(cwd, ".env"), envContent)

    writeFileSync(
      join(cwd, "config.json"),
      JSON.stringify(
        {
          agent: {
            name: "ClaudiaClaw",
            defaultPrompt: "Kamu adalah asisten AI yang helpful, ramah, dan cekatan.",
            maxHistory: 50,
            compactThreshold: 40,
          },
          deepseek: { model },
        },
        null,
        2,
      ),
    )

    console.log("  ✅ .env berisi API key & token")
    console.log("  ✅ config.json siap")
    console.log("")

    // ── Auto PM2 Setup ──//
    console.log("🔧 Setup PM2 auto-restart...")
    try {
      execSync("npm install -g pm2", { stdio: "ignore", timeout: 30000 })
      execSync("pm2 start ecosystem.config.js", { cwd, stdio: "ignore", timeout: 10000 })
      execSync("pm2 save", { stdio: "ignore", timeout: 10000 })
      console.log("  ✅ PM2 started — agent jalan dengan auto-restart")

      try {
        const startupCmd = execSync("pm2 startup", { cwd, encoding: "utf-8", timeout: 10000 })
        const lines = startupCmd.split("\n")
        for (const line of lines) {
          if (line.includes("sudo")) {
            console.log(`  ⚡ Jalankan: ${line.trim()}`)
          }
        }
        console.log("  ✅ Startup configured")
      } catch {}
    } catch (err) {
      console.log(`  ⚠️  PM2 setup skipped: ${(err as Error).message}`)
      console.log("  Jalankan manual: npm start")
    }

    // ── Done ──//
    console.log(`
╔══════════════════════════════════════════╗
║          ✅ Siap! 💅🏻                    ║
╚══════════════════════════════════════════╝

📁 Config: .env dan config.json sudah diisi.

🚀  Agent sudah jalan via PM2!
     pm2 status
     pm2 logs claudiaclaw

💅🏻  ClaudiaClaw siap digunakan!
`)
  } finally {
    rl.close()
  }
}
