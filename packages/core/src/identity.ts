import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join, resolve } from "path"

export interface AgentIdentity {
  name: string
  persona: string // from soul.md
  identity: string // from identity.md
}

export interface IdentityOptions {
  /** Directory to store identity/soul files (default: ./data/claudiaclaw/) */
  dataDir?: string
}

const DEFAULT_IDENTITY = `# IDENTITY — Who Am I?

- **Name:** Claudia
- **Creature:** Virtual assistant
- **Vibe:** Helpful, professional, friendly
`

const DEFAULT_SOUL = `# SOUL — Core Personality

- Panggil user dengan sopan
- Responsif dan cekatan
- Jujur dan transparan
- Gunakan bahasa yang sesuai dengan user
- Prioritaskan membantu dengan akurat
`

export class IdentityManager {
  private dataDir: string
  private _identity: AgentIdentity = {
    name: "Claudia",
    persona: "",
    identity: "",
  }

  constructor(options?: IdentityOptions) {
    this.dataDir = resolve(options?.dataDir ?? "./data/claudiaclaw")
  }

  /** Initialize identity directory and files */
  init(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }

    // Create default files if they don't exist
    const identityPath = join(this.dataDir, "identity.md")
    const soulPath = join(this.dataDir, "soul.md")

    if (!existsSync(identityPath)) {
      writeFileSync(identityPath, DEFAULT_IDENTITY, "utf-8")
    }
    if (!existsSync(soulPath)) {
      writeFileSync(soulPath, DEFAULT_SOUL, "utf-8")
    }

    this.load()
  }

  /** Load identity and soul from files */
  load(): void {
    const identityPath = join(this.dataDir, "identity.md")
    const soulPath = join(this.dataDir, "soul.md")

    if (existsSync(identityPath)) {
      this._identity.identity = readFileSync(identityPath, "utf-8")
    }
    if (existsSync(soulPath)) {
      this._identity.persona = readFileSync(soulPath, "utf-8")
    }
  }

  /** Get the combined system prompt from identity + soul */
  getSystemPrompt(): string {
    const identity = this._identity.identity
    const soul = this._identity.persona

    let prompt = ""
    if (identity) {
      prompt += `[Identity]\n${identity}\n\n`
    }
    if (soul) {
      prompt += `[Soul]\n${soul}\n`
    }

    return prompt.trim()
  }

  /** Get current identity */
  get identity(): AgentIdentity {
    return { ...this._identity }
  }

  /** Update identity.md content */
  updateIdentity(content: string): void {
    this._identity.identity = content
    writeFileSync(join(this.dataDir, "identity.md"), content, "utf-8")
  }

  /** Update soul.md content */
  updateSoul(content: string): void {
    this._identity.persona = content
    writeFileSync(join(this.dataDir, "soul.md"), content, "utf-8")
  }

  /** File paths */
  get identityPath(): string {
    return join(this.dataDir, "identity.md")
  }

  get soulPath(): string {
    return join(this.dataDir, "soul.md")
  }
}
