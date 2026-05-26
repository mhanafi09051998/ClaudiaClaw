import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"

/** Config value — supports nesting */
export type ConfigValue = string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue }

export interface ConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "object" | "array"
    default?: ConfigValue
    description?: string
    required?: boolean
    env?: string // map to environment variable
  }
}

export class ConfigManager {
  private config: Map<string, ConfigValue> = new Map()
  private schema: ConfigSchema = {}
  private filePath: string | null = null

  constructor(schema?: ConfigSchema) {
    if (schema) this.defineSchema(schema)
  }

  /** Define config schema with defaults */
  defineSchema(schema: ConfigSchema): void {
    this.schema = { ...this.schema, ...schema }
    for (const [key, field] of Object.entries(schema)) {
      // Load from env first, then default
      const envVal = field.env ? process.env[field.env] : undefined
      if (envVal !== undefined) {
        this.set(key, this.coerce(envVal, field.type))
      } else if (field.default !== undefined) {
        this.set(key, field.default)
      }
    }
  }

  /** Set a config value */
  set(key: string, value: ConfigValue): void {
    const parts = key.split(".")
    if (parts.length === 1) {
      this.config.set(key, value)
    } else {
      // Nested set
      const rootKey = parts[0]
      const existing = this.config.get(rootKey) as Record<string, ConfigValue> | undefined
      const nested = existing ?? {}
      let current = nested
      for (let i = 1; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
          current[parts[i]] = {}
        }
        current = current[parts[i]] as Record<string, ConfigValue>
      }
      current[parts[parts.length - 1]] = value
      this.config.set(rootKey, nested)
    }
  }

  /** Get a config value */
  get<T extends ConfigValue = ConfigValue>(key: string, defaultValue?: T): T | undefined {
    const parts = key.split(".")
    if (parts.length === 1) {
      return (this.config.get(key) as T) ?? defaultValue
    }
    // Nested get
    let current: unknown = this.config.get(parts[0])
    for (let i = 1; i < parts.length && current !== undefined; i++) {
      current = (current as Record<string, unknown>)?.[parts[i]]
    }
    return (current as T) ?? defaultValue
  }

  /** Get config as a flat object */
  all(): Record<string, ConfigValue> {
    const result: Record<string, ConfigValue> = {}
    for (const [key, value] of this.config) {
      result[key] = value
    }
    return result
  }

  /** Load config from JSON file */
  loadFile(filePath: string): void {
    this.filePath = filePath
    if (!existsSync(filePath)) return

    const raw = readFileSync(filePath, "utf-8")
    const data = JSON.parse(raw) as Record<string, ConfigValue>
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value)
    }
  }

  /** Save config to file */
  saveFile(filePath?: string): void {
    const target = filePath ?? this.filePath
    if (!target) throw new Error("No config file path specified")
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, JSON.stringify(this.all(), null, 2), "utf-8")
  }

  private coerce(value: string, type: string): ConfigValue {
    switch (type) {
      case "number":
        return Number(value)
      case "boolean":
        return value === "true" || value === "1"
      case "string":
        return value
      default:
        return value
    }
  }
}
