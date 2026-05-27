import { execSync } from "child_process"
import { existsSync, rmSync } from "fs"
import { join } from "path"

export async function fresh() {
  const cwd = process.cwd()

  console.log(`
╔══════════════════════════════════════════╗
║   💅🏻 ClaudiaClaw — Fresh Install       ║
╚══════════════════════════════════════════╝
`)

  // ── Stop PM2 ──//
  console.log("🔧 Menghentikan PM2...")
  try {
    execSync("pm2 stop all 2>/dev/null; pm2 delete all 2>/dev/null", { stdio: "ignore", timeout: 5000 })
    console.log("  ✅ PM2 stopped")
  } catch { console.log("  ⚪ PM2 not running") }

  // ── Hapus .env, config.json, data ──//
  const targets = [
    join(cwd, ".env"),
    join(cwd, "config.json"),
    join(cwd, "data"),
    join(cwd, "logs"),
  ]

  console.log("🗑️  Menghapus konfigurasi lama...")
  for (const target of targets) {
    if (existsSync(target)) {
      try {
        rmSync(target, { recursive: true, force: true })
        console.log(`  ✅ ${target.replace(cwd, ".")}`)
      } catch (err) {
        console.log(`  ⚠️  ${target.replace(cwd, ".")}: ${(err as Error).message}`)
      }
    }
  }

  // ── Hapus node_modules & dist lama ──//
  console.log("🗑️  Membersihkan cache...")
  try {
    rmSync(join(cwd, "packages/cli/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/core/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/memory/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/tools/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/skill/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/config/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/provider-deepseek/dist"), { recursive: true, force: true })
    rmSync(join(cwd, "packages/platform-telegram/dist"), { recursive: true, force: true })
    console.log("  ✅ Cache cleaned")
  } catch { console.log("  ⚪ Already clean") }

  // ── Install + Build ──//
  console.log("")
  console.log("📦 Install dependencies...")
  execSync("npm install", { stdio: "inherit" })

  console.log("")
  console.log("🔨 Building packages...")
  execSync("npm run build", { stdio: "inherit" })

  // ── Done ──//
  console.log(`
╔══════════════════════════════════════════╗
║          ✅ Siap untuk init!             ║
╚══════════════════════════════════════════╝

🚀  Jalankan wizard setup:
     node ./packages/cli/dist/index.js init

💅🏻  Atau langsung mulai:
     npm start
`)
}
