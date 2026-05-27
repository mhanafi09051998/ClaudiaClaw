#!/usr/bin/env node
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"))

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] ?? "help"

  switch (command) {
    case "init":
    case "onboard": {
      const { init } = await import("./commands/init.js")
      await init()
      break
    }
    case "start": {
      const { start } = await import("./commands/start.js")
      await start()
      break
    }
    case "fresh":
    case "reset": {
      const { fresh } = await import("./commands/fresh.js")
      await fresh()
      break
    }
    case "version":
    case "--version":
    case "-v":
      console.log(`ClaudiaClaw v${pkg.version}`)
      break
    case "pairing": {
      const sub = args[1]
      if (sub === "approve" && args[2] && args[3]) {
        const { pairingApprove } = await import("./commands/approve.js")
        await pairingApprove(args[2], args[3])
      } else {
        console.log("Usage: claudiaclaw pairing approve <platform> <code>")
        console.log("Example: claudiaclaw pairing approve telegram 55GAGP8E")
      }
      break
    }
    case "help":
    case "--help":
    case "-h":
    default:
      console.log(`
🦞 ClaudiaClaw — Super modern agent framework

  USAGE
    claudiaclaw <command>

  COMMANDS
    init      🚀  Onboarding wizard — setup your first agent
    start     ▶   Start an agent from config
    fresh     🧹  Clean install from scratch
    pairing   🔑  Approve user pairing
    version   ℹ️   Show version
    help      ℹ️   Show this help

  EXAMPLES
    claudiaclaw init      Interactive setup
    claudiaclaw start     Run your agent
    claudiaclaw fresh     Reset everything
`)
      break
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message)
  process.exit(1)
})
