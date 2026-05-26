#!/usr/bin/env node
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"))

const args = process.argv.slice(2)
const command = args[0] ?? "help"

switch (command) {
  case "init":
  case "onboard":
    const { init } = await import("./commands/init.js")
    await init()
    break
  case "start":
    const { start } = await import("./commands/start.js")
    await start()
    break
  case "version":
  case "--version":
  case "-v":
    console.log(`ClaudiaClaw v${pkg.version}`)
    break
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
    version   ℹ️   Show version
    help      ℹ️   Show this help

  EXAMPLES
    claudiaclaw init      Interactive setup
    claudiaclaw start     Run your agent
`)
    break
}
