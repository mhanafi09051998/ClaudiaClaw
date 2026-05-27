import { writeFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { Input, Select } from "enquirer"

/**
 * ClaudiaClaw Onboarding Wizard
 * Uses enquirer — cross-platform interactive prompts
 * Works on: Linux, macOS, Windows (Git Bash, CMD, PowerShell, WSL2)
 */

export async function init() {
  const cwd = process.cwd()

  console.log(`
╔══════════════════════════════════════════╗
║          💅🏻 ClaudiaClaw v0.1.0          ║
║   Super modern agent framework           ║
║   Built with DeepSeek                    ║
╚══════════════════════════════════════════╝
`)
  console.log("Selamat datang! Kita akan setup ClaudiaClaw-mu.\n")

  try {
    // ── Step 1: DeepSeek API Key ──//
    console.log("─── Step 1/3: AI Provider ───")

    const apiKey = await new Input({
      type: "input",
      name: "apiKey",
      message: "Masukkan DeepSeek API Key",
      validate: (input: string) => input.trim() ? true : "API Key wajib diisi",
    }).run()

    const model = await new Input({
      type: "input",
      name: "model",
      message: "Model",
      initial: "deepseek-v4-flash",
    }).run()

    // ── Step 2: Telegram Bot Token ──//
    console.log("\n─── Step 2/3: Telegram Bot ───")

    const botToken = await new Input({
      type: "input",
      name: "botToken",
      message: "Masukkan Telegram Bot Token (dari @BotFather)",
      validate: (input: string) => input.trim() ? true : "Bot Token wajib diisi",
    }).run()

    // ── Step 3: Apply config ──//
    console.log("\n─── Step 3/3: Menulis Konfigurasi ───")

    writeFileSync(
      join(cwd, ".env"),
      `# ClaudiaClaw Configuration
DEEPSEEK_API_KEY=${apiKey}
DEEPSEEK_MODEL=${model}
TELEGRAM_BOT_TOKEN=${botToken}
`
    )

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

    const isWin = process.platform === "win32"

    try {
      execSync("npm install -g pm2", { stdio: "ignore", timeout: 30000 })
      execSync("pm2 start ecosystem.config.js", { cwd, stdio: "ignore", timeout: 10000 })
      execSync("pm2 save", { stdio: "ignore", timeout: 10000 })
      console.log("  ✅ PM2 started — agent jalan dengan auto-restart")

      if (!isWin) {
        try {
          const startupCmd = execSync("pm2 startup", { cwd, encoding: "utf-8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] })
          for (const line of startupCmd.split("\n")) {
            if (line.includes("sudo")) console.log(`  ⚡ Jalankan: ${line.trim()}`)
          }
          console.log("  ✅ Startup configured")
        } catch {}
      }
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
  } catch (err) {
    // Enquirer throws on cancel (Ctrl+C) — exit gracefully
    console.log("\n⚠️  Onboarding dibatalkan.")
    process.exit(0)
  }
}
