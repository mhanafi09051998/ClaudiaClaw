# ClaudiaClaw 🦞

> Super modern, highly efficient & effective agent framework — built from scratch.
> AI provider: **DeepSeek** | Architecture inspired by OpenClaw, built better.

## Philosophy

ClaudiaClaw is a ground-up reimagining of what an agent framework should be:

- **Efficient** — Minimal overhead, maximum throughput
- **Effective** — Built for real agent workloads, not demos
- **Modern** — TypeScript-first, ESM-native, async everything
- **Extensible** — Plugin architecture from day one

## Onboarding (CLI)

```bash
# Langsung dari repo
npx claudiaclaw init

# Atau clone dulu
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw
npm install
npm run build
npm run init
```

CLI akan memandu kamu setup:
1. Nama project
2. DeepSeek API Key & model
3. Telegram Bot Token
4. Personality agent
5. Auto-generate semua file + optional git init

## Quick Start Manual

```bash
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw
npm install
npm run build

# Setup .env
cp .env.example .env
# Isi DEEPSEEK_API_KEY dan TELEGRAM_BOT_TOKEN

# Jalankan
npm start
```

## Packages

| Package | Description |
|---------|-------------|
| `@claudiaclaw/cli` | 🚀 CLI + onboarding wizard (`init`, `start`) |
| `@claudiaclaw/core` | Core engine — middleware pipeline, events, lifecycle |
| `@claudiaclaw/provider-deepseek` | DeepSeek AI provider (chat + streaming) |
| `@claudiaclaw/platform-telegram` | Telegram bot connector (long-polling) |
| `@claudiaclaw/tools` | Tool/function calling registry |
| `@claudiaclaw/memory` | Conversation memory & context management |
| `@claudiaclaw/config` | Config manager (JSON + env vars) |

## Architecture

```
                    ┌─────────────┐
                    │  Telegram   │  ← Platform adapters
                    │  Discord    │     (more coming)
                    │  WhatsApp   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │             │
                    │  @core      │  ← Middleware pipeline
                    │  AgentCore  │     Event system
                    │             │     Plugin system
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌────▼────┐
        │ provider  │ │ tools  │ │ memory  │
        │ -deepseek │ │        │ │         │
        └───────────┘ └────────┘ └─────────┘
```

## Commands

```bash
claudiaclaw init      # 🚀 Onboarding wizard
claudiaclaw start     # ▶  Run agent
claudiaclaw --help    # ℹ️  Help
claudiaclaw --version # ℹ️  Version
```

## License

Private — Muhammad Hanafi
