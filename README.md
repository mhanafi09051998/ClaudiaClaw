<div align="center">
  <br/>
  <img src="https://raw.githubusercontent.com/mhanafi09051998/ClaudiaClaw/main/.github/logo.png" alt="ClaudiaClaw" width="200"/>
  <br/>
  <h1>💅🏻 ClaudiaClaw</h1>
  <p><strong>Super modern, highly efficient & effective agent framework</strong></p>
  <p>Built from scratch with <strong>DeepSeek</strong> · TypeScript-native · ESM-first</p>
  <br/>

[![GitHub stars](https://img.shields.io/github/stars/mhanafi09051998/ClaudiaClaw?style=flat-square&logo=github)](https://github.com/mhanafi09051998/ClaudiaClaw/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-v4--Flash-4F46E5?style=flat-square)](https://deepseek.com)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)](https://docker.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/mhanafi09051998/ClaudiaClaw/pulls)

  <br/>
</div>

---

## 🦞 Why ClaudiaClaw?

**ClaudiaClaw isn't just another agent framework — it's a complete reimagining.**

Most agent frameworks were built years ago with architectural baggage. ClaudiaClaw is built **from scratch in 2026** with modern JavaScript, zero legacy patterns, and one obsession: **maximum efficiency for real agent workloads**.

| Feature | ClaudiaClaw 💅🏻 | OpenClaw |
|---------|:-------------:|:--------:|
| **Stack** | Pure ESM + TypeScript 5.7 | Mixed CJS/ESM |
| **AI Provider** | DeepSeek-first, pluggable | Multi-provider (heavier) |
| **Bundle Size** | ~15KB total packages | ~500KB+ core |
| **Startup Time** | ~80ms cold start | ~500ms+ |
| **Middleware** | Lightweight pipeline | Heavy middleware chain |
| **Memory** | SQLite + TurboQuant™ persistent | External only |
| **User Isolation** | ✅ Auto per-user/grup directory | ❌ |
| **Allowlist** | ✅ By ID (user & grup) | ✅ |
| **Skill System** | ✅ Modular, loadable at runtime | Plugin-based |
| **Identity/Soul** | ✅ identity.md + soul.md files | ❌ |
| **Docker** | ✅ Multi-stage, production-ready | ❌ Manual |
| **CLI Onboarding** | Interactive wizard (`init`) | Manual setup |
| **Learning Curve** | Low — 5 minutes to first agent | Medium |
| **Architecture** | Micro-packages, zero coupling | Monolithic |

> 💡 **ClaudiaClaw is lighter, faster, and more feature-rich — while being simpler to use.**

---

## 🚀 Quick Start

### Docker ⭐
```bash
docker run -e DEEPSEEK_API_KEY=*** -e TELEGRAM_BOT_TOKEN=*** --restart unless-stopped claudiaclaw
```

### CLI Onboarding
```bash
npx claudiaclaw init
```

### Manual
```bash
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw
npm install && npm run build
cp .env.example .env   # Isi API key & token
npm start
```

---

## 📖 Panduan

### 🐳 Docker
```bash
docker build -t claudiaclaw .
docker run -d --name claudiaclaw \
  -e DEEPSEEK_API_KEY=*** \
  -e TELEGRAM_BOT_TOKEN=*** \
  -v claudiaclaw_data:/app/data \
  --restart unless-stopped \
  claudiaclaw
```

### ♻️ PM2 Auto-restart
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup     # Auto-start pas server reboot
```

### 🔒 Allowlist
Batasi akses hanya untuk user/grup tertentu:
```bash
# Di .env
ALLOWLIST_USERS=659617669,1714557404
ALLOWLIST_GROUPS=-1003953147640
ALLOWLIST_OWNERS=659617669
```

User/grup yang tidak terdaftar otomatis ditolak.

---

## 🏗️ Architecture

```
                    ┌─────────────┐
                    │  Platforms  │  ← Telegram
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   @core     │  ← Event system
                    │  AgentCore  │     Plugin system
                    │  Identity   │     identity.md + soul.md
                    │  Isolation  │     User/grup directories
                    │  Allowlist  │     Access control
                    └──────┬──────┘
                           │
              ┌────────────┼──────────────┐
              │            │              │
        ┌─────▼─────┐ ┌───▼──────┐ ┌─────▼──────┐
        │ Provider  │ │   Skill  │ │   Memory   │
        │ -deepseek │ │  System  │ │  SQLite    │
        │ (stream)  │ │  Tools   │ │  TurboQuant│
        └───────────┘ └──────────┘ └────────────┘
```

### 🧠 TurboQuant Memory
- **Memory Nuggets** — ekstrak fakta, preferensi, keputusan dari setiap chat
- **Auto Compact** — kompres percakapan lama, nugget tetap diingat
- **SQLite persistent** — data aman walau restart
- **Per-user isolation** — setiap user punya memori sendiri

### 📁 Struktur Data
```
📁 data/
  ├── users/<user-id>/
  │   ├── memory.db       (SQLite per-user)
  │   ├── identity.md     (Personality khusus user ini)
  │   ├── soul.md
  │   ├── notes/
  │   └── projects/
  ├── groups/<group-id>/
  │   ├── memory.db
  │   ├── notes/
  │   └── projects/
  └── claudiaclaw/
      ├── identity.md
      └── soul.md
```

---

## 📦 Packages

| Package | Size | Description |
|---------|:----:|-------------|
| `@claudiaclaw/core` | ~3.3 KB | Engine, Identity, Isolation, Allowlist |
| `@claudiaclaw/cli` | ~6.5 KB | CLI — `init`, `start`, `help` |
| `@claudiaclaw/provider-deepseek` | ~5.1 KB | DeepSeek AI (chat + streaming + tools) |
| `@claudiaclaw/platform-telegram` | ~2.8 KB | Telegram bot connector |
| `@claudiaclaw/tools` | ~1.0 KB | Tool/function calling registry |
| `@claudiaclaw/skill` | ~6.0 KB | Modular skill system |
| `@claudiaclaw/memory` | ~11 KB | SQLite + TurboQuant Memory Engine |
| `@claudiaclaw/config` | ~1.2 KB | JSON/ENV config with schema |

---

## 🧪 Contoh Skill External
```javascript
// skills/my-skill/index.js
export const tools = [{
  definition: {
    type: "function",
    function: {
      name: "cari_berita",
      description: "Cari berita terbaru",
      parameters: { type: "object", properties: { query: { type: "string" } } }
    }
  },
  handler: async (args) => {
    const res = await fetch(`https://api.berita.com?q=${args.query}`)
    return res.text()
  }
}]
export const systemPrompt = "Kamu bisa mencari berita terbaru untuk user."
```

---

## 🛠️ CLI Commands
```bash
claudiaclaw              # Help
claudiaclaw init         # 🚀 Onboarding wizard
claudiaclaw start        # ▶  Run agent
claudiaclaw --version    # ℹ️  Version
```

---

## 🗺️ Roadmap

### ✅ Done
- [x] Core engine with middleware pipeline
- [x] DeepSeek provider (chat + streaming)
- [x] Telegram platform (polling)
- [x] CLI onboarding wizard (interactive)
- [x] SQLite persistent storage
- [x] TurboQuant Memory Engine + Auto Compact
- [x] Modular skill system
- [x] Identity & Soul files
- [x] User/group isolation
- [x] Allowlist by ID
- [x] Docker multi-stage build
- [x] PM2 ecosystem auto-restart

### 🚧 Coming Soon
- [ ] Discord platform adapter
- [ ] OpenAI / Anthropic providers
- [ ] Redis memory backend
- [ ] Web UI dashboard
- [ ] Skill marketplace

---

## 📄 License
MIT © [Muhammad Hanafi](https://github.com/mhanafi09051998)

---

<div align="center">
  <a href="https://github.com/mhanafi09051998/ClaudiaClaw/issues">Report Bug</a>
  ·
  <a href="https://github.com/mhanafi09051998/ClaudiaClaw/discussions">Discussions</a>
  ·
  <a href="https://github.com/mhanafi09051998/ClaudiaClaw/blob/main/CONTRIBUTING.md">Contributing</a>
</div>
