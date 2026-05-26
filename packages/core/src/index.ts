export { AgentCore } from "./agent.js"
export type * from "./types/index.js"

// ─── Identity & Soul ────────────────────────────────
export { IdentityManager } from "./identity.js"
export type { AgentIdentity, IdentityOptions } from "./identity.js"

// ─── Isolation & Allowlist ──────────────────────────
export { IsolationManager, Allowlist } from "./isolation.js"
export type { IsolatedContext, AllowlistConfig } from "./isolation.js"
