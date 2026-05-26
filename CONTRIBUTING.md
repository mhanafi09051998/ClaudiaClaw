# Contributing to ClaudiaClaw 🦞

Thanks for your interest! Here's how to get started:

## Development Setup

```bash
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw
npm install
npm run build
```

## Project Structure

```
ClaudiaClaw/
├── packages/
│   ├── core/                    # Core engine
│   ├── provider-deepseek/       # DeepSeek provider
│   ├── platform-telegram/       # Telegram adapter
│   ├── tools/                   # Tool registry
│   ├── memory/                  # Memory system
│   ├── config/                  # Config manager
│   └── cli/                     # CLI tool
└── examples/
    └── basic-bot/               # Example agent
```

## Adding a New Platform

1. Create `packages/platform-<name>/`
2. Implement `PlatformAdapter` interface
3. Add to workspace in root `package.json`
4. Submit a PR!

## Adding a New Provider

1. Create `packages/provider-<name>/`
2. Implement `ProviderAdapter` interface
3. Add to workspace

## Code Style

- TypeScript strict mode
- ESM only (`import`/`export`, no `require`)
- 2-space indentation
- No semicolons (prettier default)

## PR Checklist

- [ ] Build passes (`npm run build`)
- [ ] Follows existing patterns
- [ ] Includes types
- [ ] README updated if needed
