import type { ToolDefinition, ToolCall } from "@claudiaclaw/core"

export type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string

export interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
  /** Only allowlist users/roles */
  allowedUsers?: string[]
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map()

  register(name: string, description: string, parameters: Record<string, unknown>, handler: ToolHandler): void {
    const definition: ToolDefinition = {
      type: "function",
      function: { name, description, parameters },
    }

    this.tools.set(name, { definition, handler })
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  async execute(toolCall: ToolCall): Promise<string> {
    const tool = this.tools.get(toolCall.function.name)
    if (!tool) {
      return `Error: Tool "${toolCall.function.name}" not found`
    }

    try {
      const args = toolCall.function.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {}
      return await tool.handler(args)
    } catch (err) {
      return `Error executing ${toolCall.function.name}: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  remove(name: string): void {
    this.tools.delete(name)
  }

  clear(): void {
    this.tools.clear()
  }

  get size(): number {
    return this.tools.size
  }
}
