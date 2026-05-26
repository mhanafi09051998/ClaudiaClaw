import { PairingManager, AllowlistFile } from "@claudiaclaw/core"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

export async function pairingApprove(platform: string, code: string) {
  const cwd = process.cwd()
  const dataDir = join(cwd, "data", "claudiaclaw")
  
  if (!existsSync(dataDir)) {
    console.log("❌ Data directory not found. Is ClaudiaClaw installed?")
    console.log(`   ${dataDir}`)
    return
  }

  const pairings = new PairingManager(dataDir)
  const pairing = pairings.approve(code.toUpperCase())

  if (!pairing) {
    console.log(`❌ Pairing code "${code}" not found or expired.`)
    console.log("")
    console.log("Pending pairings:")
    const pending = pairings.list()
    if (pending.length === 0) {
      console.log("  (none)")
    } else {
      for (const p of pending) {
        const age = Math.floor((Date.now() - p.createdAt) / 60000)
        console.log(`  ${p.code} — user ${p.userId}${p.username ? ` (@${p.username})` : ""} (${age}m ago)`)
      }
    }
    return
  }

  // Add to allowlist
  const allowlist = new AllowlistFile(dataDir)
  
  if (pairing.chatType === "group" || pairing.chatType === "supergroup") {
    allowlist.addGroup(pairing.chatId)
    console.log(`✅ Group ${pairing.chatId} approved!`)
  } else {
    allowlist.addUser(pairing.userId)
    console.log(`✅ User ${pairing.userId}${pairing.username ? ` (@${pairing.username})` : ""} approved!`)
  }

  console.log("")
  console.log("📋 Updated allowlist:")
  console.log(`   Users: ${(allowlist as any).status.users}`)
  console.log(`   Groups: ${(allowlist as any).status.groups}`)

  // Restart PM2 process if available
  try {
    execSync("pm2 restart claudiaclaw", { stdio: "ignore" })
    console.log("")
    console.log("🔄 ClaudiaClaw restarted — changes applied.")
  } catch {
    console.log("")
    console.log("⚠️  PM2 not detected. Restart manually: npm start")
  }
}
