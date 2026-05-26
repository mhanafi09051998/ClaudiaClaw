import type { AgentCore, ToolDefinition } from "@claudiaclaw/core"
import type { ToolHandler } from "@claudiaclaw/tools"

// ─── Types ──────────────────────────────────────────

export interface SkillManifest {
  name: string
  version: string
  description: string
  author?: string
  /** Internal skills are built-in, external are user-installed */
  kind?: "internal" | "external"
}

export interface SkillDefinition {
  manifest: SkillManifest
  /** Tools this skill provides */
  tools?: Array<{
    definition: ToolDefinition
    handler: ToolHandler
  }>
  /** Custom system prompt context added when skill is active */
  systemPrompt?: string
  /** Lifecycle hooks */
  onLoad?: (agent: AgentCore) => void | Promise<void>
  onUnload?: (agent: AgentCore) => void | Promise<void>
  /** Unique ID for dependency resolution */
  dependsOn?: string[]
}

export interface SkillManagerConfig {
  /** Directory to scan for external skills (default: ./skills/) */
  skillsDir?: string
}

// ─── Skill Manager ─────────────────────────────────

export class SkillManager {
  private skills: Map<string, SkillDefinition> = new Map()
  private loaded: Set<string> = new Set()
  private config: SkillManagerConfig

  constructor(config?: SkillManagerConfig) {
    this.config = { skillsDir: "./skills", ...config }
  }

  /** Register a skill programmatically */
  register(skill: SkillDefinition): void {
    const name = skill.manifest.name
    if (this.skills.has(name)) {
      throw new Error(`Skill "${name}" is already registered`)
    }
    this.skills.set(name, skill)
  }

  /** Load a skill (call onLoad, register tools) */
  async load(name: string, agent: AgentCore, toolRegistry?: import("@claudiaclaw/tools").ToolRegistry): Promise<boolean> {
    const skill = this.skills.get(name)
    if (!skill) {
      console.error(`[SkillManager] Skill "${name}" not found`)
      return false
    }

    if (this.loaded.has(name)) {
      return true // Already loaded
    }

    // Check dependencies
    if (skill.dependsOn) {
      for (const dep of skill.dependsOn) {
        if (!this.loaded.has(dep)) {
          await this.load(dep, agent, toolRegistry)
        }
      }
    }

    // Register tools
    if (skill.tools && toolRegistry) {
      for (const t of skill.tools) {
        toolRegistry.register(
          t.definition.function.name,
          t.definition.function.description,
          t.definition.function.parameters,
          t.handler,
        )
      }
    }

    // Call onLoad hook
    await skill.onLoad?.(agent)

    this.loaded.add(name)
    console.log(`[SkillManager] Loaded skill: ${name} v${skill.manifest.version}`)
    return true
  }

  /** Unload a skill */
  async unload(name: string, agent: AgentCore): Promise<boolean> {
    const skill = this.skills.get(name)
    if (!skill || !this.loaded.has(name)) return false

    await skill.onUnload?.(agent)

    // Remove tools (would need tool registry reference ideally)
    this.loaded.delete(name)
    console.log(`[SkillManager] Unloaded skill: ${name}`)
    return true
  }

  /** Load all registered skills */
  async loadAll(agent: AgentCore, toolRegistry?: import("@claudiaclaw/tools").ToolRegistry): Promise<void> {
    for (const name of this.skills.keys()) {
      await this.load(name, agent, toolRegistry)
    }
  }

  /** Get a skill by name */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  /** List all registered skills */
  list(): SkillManifest[] {
    return Array.from(this.skills.values()).map((s) => s.manifest)
  }

  /** List loaded skills */
  listLoaded(): string[] {
    return Array.from(this.loaded)
  }

  /** Scan skills directory and load external skills */
  async scanDirectory(): Promise<number> {
    const { existsSync, readdirSync, readFileSync } = await import("fs")
    const { join } = await import("path")

    if (!existsSync(this.config.skillsDir!)) {
      return 0
    }

    const entries = readdirSync(this.config.skillsDir!, { withFileTypes: true })
    let loaded = 0

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = join(this.config.skillsDir!, entry.name)
      const pkgPath = join(skillPath, "package.json")
      const mainPath = join(skillPath, "index.js")

      if (!existsSync(pkgPath) || !existsSync(mainPath)) continue

      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
        const skillModule = await import(mainPath)

        const skill: SkillDefinition = {
          manifest: {
            name: pkg.name ?? entry.name,
            version: pkg.version ?? "0.1.0",
            description: pkg.description ?? "",
            author: pkg.author,
            kind: "external",
          },
          tools: skillModule.tools,
          systemPrompt: skillModule.systemPrompt,
          onLoad: skillModule.onLoad,
          onUnload: skillModule.onUnload,
          dependsOn: skillModule.dependsOn,
        }

        this.register(skill)
        loaded++
      } catch (err) {
        console.error(`[SkillManager] Failed to load skill from ${entry.name}:`, err)
      }
    }

    return loaded
  }

  /** Get combined system prompt from all loaded skills */
  getCombinedSystemPrompt(): string {
    let prompt = ""
    for (const name of this.loaded) {
      const skill = this.skills.get(name)
      if (skill?.systemPrompt) {
        prompt += `\n[Skill: ${name}]\n${skill.systemPrompt}\n`
      }
    }
    return prompt
  }
}

// ─── Built-in Skills ───────────────────────────────

/** Basic skill with utility tools */
export function createBasicSkill(): SkillDefinition {
  return {
    manifest: {
      name: "@claudiaclaw/basic",
      version: "0.1.0",
      description: "Basic utility tools (ping, time)",
      kind: "internal",
    },
    tools: [
      {
        definition: {
          type: "function",
          function: {
            name: "ping",
            description: "Simple ping to test connectivity",
            parameters: { type: "object", properties: {} },
          },
        },
        handler: () => "pong!",
      },
      {
        definition: {
          type: "function",
          function: {
            name: "get_time",
            description: "Get current time in a timezone",
            parameters: {
              type: "object",
              properties: {
                timezone: { type: "string", description: "Timezone like Asia/Jakarta" },
              },
            },
          },
        },
        handler: (args) => {
          const tz = (args.timezone as string) ?? "UTC"
          return new Date().toLocaleString("en-US", { timeZone: tz })
        },
      },
    ],
  }
}
