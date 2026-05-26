<div align="center">
  <br/>
  <img src="https://raw.githubusercontent.com/mhanafi09051998/ClaudiaClaw/main/.github/logo.png" alt="ClaudiaClaw" width="200"/>
  <br/>
  <h1>🦞 ClaudiaClaw</h1>
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

| Feature | ClaudiaClaw 🦞 | OpenClaw |
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
| **Docker** | ✅ Multi-stage, production-ready | Manual |
| **CLI Onboarding** | Interactive wizard (`init`) | Manual setup |
| **Learning Curve** | Low — 5 minutes to first agent | Medium |
| **Architecture** | Micro-packages, zero coupling | Monolithic |

> 💡 **ClaudiaClaw is lighter, faster, and more feature-rich — while being simpler to use.**

---

## 🚀 Quick Start — 4 Ways

### 1. Docker (paling gampang) ⭐
```bash
docker run -e DEEPSEEK_API_KEY=*** \
           -e TELEGRAM_BOT_TOKEN=*** \
           -p 8443:8443 \
           ghcr.io/mhanafi09051998/claudiaclaw
```

### 2. Docker Compose (production)
```bash
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw
cp .env.example .env    # Isi API key
docker compose up -d    # 🚀 Jalan!
```

### 3. CLI Onboarding (local)
```bash
npx claudiaclaw init
```

### 4. Manual setup
```bash
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw
npm install
npm run build
cp .env.example .env   # Isi API key
npm start
```

---

## 📖 Panduan Lengkap

### 🔑 Persiapan

Sebelum mulai, siapkan:
1. **DeepSeek API Key** — daftar di [platform.deepseek.com](https://platform.deepseek.com)
2. **Telegram Bot Token** — buat bot baru via [@BotFather](https://t.me/BotFather)
3. **Domain + HTTPS** (hanya untuk webhook mode) — bisa pakai [ngrok](https://ngrok.com) untuk testing

### 🐳 Docker (Recommended untuk Production)

```bash
# 1. Build image
docker build -t claudiaclaw .

# 2. Run dengan environment variables
docker run -d \
  --name claudiaclaw \
  -e DEEPSEEK_API_KEY=sk-xxx \
  -e TELEGRAM_BOT_TOKEN=xxx:xxx \
  -e TELEGRAM_WEBHOOK_URL=https://domain-anda.com \
  -p 8443:8443 \
  -v claudiaclaw_data:/app/data \
  --restart unless-stopped \
  claudiaclaw
```

### 📦 Docker Compose (Recommended untuk VPS)

```bash
# 1. Clone
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git
cd ClaudiaClaw

# 2. Setup .env
cp .env.example .env
nano .env   # Isi API key & token

# 3. Jalanin
docker compose up -d

# 4. Cek log
docker compose logs -f

# 5. Stop
docker compose down
```

Struktur docker-compose:
```
claudiaclaw/
├── .env              # API key, token, dll
├── skills/           # 🔌 External skills (optional)
└── data/             # 💾 Persistent data (SQLite + identity)
```

### 📡 Webhook vs Polling

ClaudiaClaw mendukung **dua mode** koneksi ke Telegram:

| Mode | Cocok untuk | Setup |
|------|------------|-------|
| **Polling** ✅ (default) | Development, lokal | `TELEGRAM_WEBHOOK_URL=` (kosongkan) |
| **Webhook** 🚀 | Production, VPS | `TELEGRAM_WEBHOOK_URL=https://domain.com` |

**Webhook mode** — Telegram langsung kirim pesan ke server ClaudiaClaw. Lebih cepat dan efisien. Set di `.env`:
```bash
TELEGRAM_WEBHOOK_URL=https://claudia.anda.com
TELEGRAM_WEBHOOK_PORT=8443
```
> ℹ️ Telegram mewajibkan port: **443, 80, 88, 8443** dengan HTTPS valid.

Testing webhook lokal pakai ngrok:
```bash
ngrok http 8443
# Copy URL https://xxxx.ngrok.io → paste ke TELEGRAM_WEBHOOK_URL
```

### 🔒 Allowlist

Batasi akses hanya untuk user/grup tertentu:

```bash
# Di .env
ALLOWLIST_USERS=659617669,1714557404
ALLOWLIST_GROUPS=-1003953147640
ALLOWLIST_OWNERS=659617669
```

Atau di `config.json`:
```json
{
  "allowlist": {
    "enabled": true,
    "users": ["659617669"],
    "groups": ["-1003953147640"],
    "owners": ["659617669"]
  }
}
```

User/grup yang tidak terdaftar otomatis ditolak.

### ♻️ PM2 Auto-restart

```bash
# Install PM2 global
npm install -g pm2

# Start dengan auto-restart
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # Auto-start pas reboot
```

---

## 🏗️ Architecture

```
                    ┌─────────────┐
                    │  Platforms  │  ← Telegram (webhook/polling)
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

### Data Flow
```
User → Telegram
  → Webhook/Poll → PlatformAdapter
    → Allowlist check 🔒
      → Isolation: resolve user/grup directory 📁
        → Identity + Soul → system prompt
          → DeepSeek API (with TurboQuant memory 🧠)
            → Tool execution (if needed) 🔧
              → Response back to user
```

### 🧠 TurboQuant Memory
ClaudiaClaw punya sistem memori cerdas yang memastikan **tidak pernah lupa**:
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
  └── claudiaclaw/         (Global config)
      ├── identity.md
      └── soul.md
```

---

## 📦 Packages

| Package | Size | Description |
|---------|:----:|-------------|
| `@claudiaclaw/core` | ~3.3 KB | Engine, Identity, Isolation, Allowlist |
| `@claudiaclaw/cli` | ~6.5 KB | CLI tool — `init`, `start`, `help` |
| `@claudiaclaw/provider-deepseek` | ~5.1 KB | DeepSeek AI (chat + streaming + tools) |
| `@claudiaclaw/platform-telegram` | ~6.2 KB | Telegram (webhook + polling) |
| `@claudiaclaw/tools` | ~1.0 KB | Tool/function calling registry |
| `@claudiaclaw/skill` | ~6.0 KB | Modular skill system |
| `@claudiaclaw/memory` | ~11 KB | SQLite + TurboQuant Memory Engine |
| `@claudiaclaw/config` | ~1.2 KB | JSON/ENV config with schema |

---

## 🧪 Contoh Skill External

Buat folder `skills/my-skill/`:
```
skills/my-skill/
├── package.json        # { "name": "my-skill", "version": "1.0.0" }
└── index.js            # Ekspor tools, systemPrompt, dll
```

```javascript
// skills/my-skill/index.js
export const tools = [{
  definition: {
    type: "function",
    function: {
      name: "cari_berita",
      description: "Cari berita terbaru",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        }
      }
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
claudiaclaw                    # Show help
claudiaclaw init               # 🚀 Interactive onboarding
claudiaclaw start              # ▶  Run agent
claudiaclaw --version          # ℹ️  Version
```

---

## 🗺️ Roadmap

### ✅ Done
- [x] Core engine with middleware pipeline
- [x] DeepSeek provider (chat + streaming)
- [x] Telegram platform (webhook + polling)
- [x] CLI onboarding wizard (interactive)
- [x] SQLite persistent storage
- [x] TurboQuant Memory Engine + Auto Compact
- [x] Modular skill system
- [x] Identity & Soul files (identity.md, soul.md)
- [x] User/group isolation (auto directory per user)
- [x] Allowlist by ID
- [x] Docker multi-stage build
- [x] Docker Compose production setup
- [x] PM2 ecosystem auto-restart

### 🚧 Coming Soon
- [ ] Discord platform adapter
- [ ] OpenAI / Anthropic providers
- [ ] Discord / WhatsApp platforms
- [ ] Redis memory backend
- [ ] Web UI dashboard
- [ ] Skill marketplace

---

## 📄 License

MIT © [Muhammad Hanafi](https://github.com/mhanafi09051998)

---

<div align="center">
  <p>Built with ❤️ and 🦞</p>
  <p>
    <a href="https://github.com/mhanafi09051998/ClaudiaClaw/issues">Report Bug</a>
    ·
    <a href="https://github.com/mhanafi09051998/ClaudiaClaw/discussions">Discussions</a>
    ·
    <a href="https://github.com/mhanafi09051998/ClaudiaClaw/blob/main/CONTRIBUTING.md">Contributing</a>
  </p>
</div>
