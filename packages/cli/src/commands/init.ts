import { createInterface } from "readline/promises"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { stdin as input, stdout as output } from "process"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Prompt helpers ──────────────────────────────────

function rl() {
  return createInterface({
    input,
    output,
    terminal: input.isTTY,
  })
}

async function ask(question: string, defaultVal?: string): Promise<string> {
  const r = rl()
  const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `
  const answer = await r.question(prompt)
  r.close()
  return answer.trim() || defaultVal || ""
}

async function confirm(question: string, defaultVal = true): Promise<boolean> {
  const r = rl()
  const hint = defaultVal ? "Y/n" : "y/N"
  const answer = await r.question(`${question} (${hint}): `)
  r.close()
  const trimmed = answer.trim().toLowerCase()
  if (!trimmed) return defaultVal
  return trimmed === "y" || trimmed === "yes"
}

async function select(question: string, options: string[], defaultIdx = 0): Promise<number> {
  const r = rl()
  console.log(`\n${question}`)
  options.forEach((opt, i) => {
    const marker = i === defaultIdx ? "➤" : " "
    console.log(`  ${marker} ${i + 1}. ${opt}`)
  })
  const answer = await r.question(`Pilih (1-${options.length}, default ${defaultIdx + 1}): `)
  r.close()
  const num = parseInt(answer.trim())
  if (num >= 1 && num <= options.length) return num - 1
  return defaultIdx
}

// ─── Banners ─────────────────────────────────────────

function showBanner() {
  console.log(`
╔══════════════════════════════════════════╗
║          🦞 ClaudiaClaw v0.1.0           ║
║   Super modern agent framework           ║
║   Built with DeepSeek ❤️                 ║
╚══════════════════════════════════════════╝
`)
}

function showStep(step: number, total: number, label: string) {
  console.log(`\n─── Step ${step}/${total}: ${label} ───`)
}

// ─── Main init ───────────────────────────────────────

export async function init() {
  showBanner()
  console.log("Selamat datang di ClaudiaClaw! 🎉")
  console.log("Kita akan setup agent pertamamu secara interaktif.\n")

  const TOTAL_STEPS = 6

  // ── Step 1: Project Info ──//
  showStep(1, TOTAL_STEPS, "Project Info")
  const projectName = await ask("Nama project", "my-claudiaclaw-agent")
  const projectDir = join(process.cwd(), projectName)

  if (existsSync(projectDir)) {
    const ok = await confirm(`Directory "${projectName}" sudah ada. Lanjutkan?`, false)
    if (!ok) {
      console.log("❌ Onboarding dibatalkan.")
      return
    }
  } else {
    mkdirSync(projectDir, { recursive: true })
  }

  // ── Step 2: AI Provider ──//
  showStep(2, TOTAL_STEPS, "AI Provider")
  const providerIdx = await select(
    "Pilih AI Provider:",
    ["DeepSeek (default)", "OpenAI (coming soon)", "Anthropic (coming soon)"],
    0,
  )

  if (providerIdx !== 0) {
    console.log("⚠️  Untuk saat ini hanya DeepSeek yang tersedia. Akan menggunakan DeepSeek.")
  }

  const apiKey = await ask("Masukkan DeepSeek API Key")
  if (!apiKey) {
    console.log("❌ API Key wajib diisi. Jalankan ulang: claudiaclaw init")
    return
  }

  const model = await ask("Model name", "deepseek-v4-flash")

  // ── Step 3: Platform ──//
  showStep(3, TOTAL_STEPS, "Platform Connector")
  const platformIdx = await select(
    "Pilih platform chat:",
    ["Telegram (default)", "Discord (coming soon)", "WhatsApp (coming soon)"],
    0,
  )

  let botToken = ""
  if (platformIdx === 0) {
    botToken = await ask("Masukkan Telegram Bot Token (dari @BotFather)")
    if (!botToken) {
      console.log("❌ Bot Token wajib diisi.")
      return
    }
  }

  // ── Step 4: Agent Personality ──//
  showStep(4, TOTAL_STEPS, "Agent Personality")
  const systemPrompt = await ask(
    "System prompt / personality agent",
    "Kamu adalah asisten AI yang helpful, ramah, dan cekatan.",
  )

  // ── Step 5: Project Scaffold ──//
  showStep(5, TOTAL_STEPS, "Generate Project")
  console.log("Membuat struktur project...")

  const srcDir = join(projectDir, "src")
  mkdirSync(srcDir, { recursive: true })

  // package.json
  writeFileSync(
    join(projectDir, "package.json"),
    JSON.stringify(
      {
        name: projectName,
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          start: "claudiaclaw start",
          dev: "claudiaclaw start",
        },
        dependencies: {
          "@claudiaclaw/core": "^0.1.0",
          "@claudiaclaw/provider-deepseek": "^0.1.0",
          "@claudiaclaw/platform-telegram": "^0.1.0",
          "@claudiaclaw/tools": "^0.1.0",
          "@claudiaclaw/memory": "^0.1.0",
          "@claudiaclaw/config": "^0.1.0",
          "@claudiaclaw/cli": "^0.1.0",
        },
      },
      null,
      2,
    ),
  )

  // .env
  const envContent = `# ClaudiaClaw Configuration
DEEPSEEK_API_KEY=***
DEEPSEEK_MODEL=${model}
TELEGRAM_BOT_TOKEN=***
SYSTEM_PROMPT=${systemPrompt}
`
  writeFileSync(join(projectDir, ".env"), envContent)

  // .gitignore
  writeFileSync(join(projectDir, ".gitignore"), "node_modules/\n.env\ndist/\n")

  // Config file
  writeFileSync(
    join(projectDir, "config.json"),
    JSON.stringify(
      {
        agent: {
          name: projectName,
          systemPrompt,
          maxHistory: 50,
        },
        deepseek: {
          model,
        },
      },
      null,
      2,
    ),
  )

  // ── Step 6: Done ──//
  showStep(6, TOTAL_STEPS, "Done! 🎉")

  console.log(`
✅ Project "${projectName}" berhasil dibuat!

  📁 ${projectDir}
    ├── package.json
    ├── config.json
    ├── .env
    ├── .gitignore
    └── src/

🚀  Langkah selanjutnya:

  cd ${projectName}
  npm install
  npx claudiaclaw start

📚  Butuh bantuan? claudiaclaw --help
`)

  const gitInit = await confirm("Init git repository?", true)
  if (gitInit) {
    const { execSync } = await import("child_process")
    try {
      execSync("git init", { cwd: projectDir, stdio: "ignore" })
      execSync("git add -A", { cwd: projectDir, stdio: "ignore" })
      execSync('git commit -m "init: ClaudiaClaw project scaffold"', {
        cwd: projectDir,
        stdio: "ignore",
      })
      console.log("✅ Git repository initialized.")
    } catch {
      console.log("⚠️  Git init skipped (git not installed or already a repo).")
    }
  }

  console.log("\nTerima kasih sudah menggunakan ClaudiaClaw! 🦞")
}
