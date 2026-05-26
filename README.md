<div align="center">
  <br/>
  <h1>💅🏻 ClaudiaClaw</h1>
  <p><strong>Super modern, highly efficient & effective agent framework</strong></p>
  <p>Built from scratch with <strong>DeepSeek</strong> · TypeScript-native · ESM-first</p>
  <br/>

[![GitHub stars](https://img.shields.io/github/stars/mhanafi09051998/ClaudiaClaw?style=flat-square&logo=github)](https://github.com/mhanafi09051998/ClaudiaClaw/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-v4--Flash-4F46E5?style=flat-square)](https://deepseek.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/mhanafi09051998/ClaudiaClaw/pulls)
[![Linux](https://img.shields.io/badge/Linux-ready-FCC624?style=flat-square&logo=linux)](https://kernel.org)

  <br/>
</div>

---

## 🦞 Why ClaudiaClaw?

**ClaudiaClaw is a complete reimagining of what an agent framework should be.**

Built **from scratch in 2026** with modern JavaScript, zero legacy patterns, and one obsession: **maximum efficiency for real agent workloads**.

| Feature | ClaudiaClaw 💅🏻 | OpenClaw |
|---------|:-------------:|:--------:|
| **Stack** | Pure ESM + TypeScript 5.7 | Mixed CJS/ESM |
| **AI Provider** | DeepSeek-first, pluggable | Multi-provider (heavier) |
| **Bundle Size** | ~15KB total packages | ~500KB+ core |
| **Startup Time** | ~80ms cold start | ~500ms+ |
| **Memory** | SQLite + TurboQuant™ persistent | External only |
| **User Isolation** | ✅ Auto per-user/grup directory | ❌ |
| **Allowlist** | ✅ By ID (user & grup) | ✅ |
| **Skill System** | ✅ Modular, loadable at runtime | Plugin-based |
| **Identity/Soul** | ✅ identity.md + soul.md files | ❌ |
| **Install** | One-liner `curl ... | sh` | Manual |
| **Learning Curve** | Low — 5 minutes to first agent | Medium |

---

## 🚀 Install — Linux

**Satu baris:**
```bash
curl -fsSL https://raw.githubusercontent.com/mhanafi09051998/ClaudiaClaw/main/install.sh | sh
```

Script akan otomatis:
1. Cek Git, Node.js v20+ (install otomatis jika belum ada)
2. Clone repo ke `~/claudiaclaw/`
3. Install dependencies + build
4. Buat file `.env` dari contoh
5. Tanya mau jalankan onboarding wizard

**Selesai, tinggal:**
```bash
cd ~/claudiaclaw
nano .env              # Isi DEEPSEEK_API_KEY & TELEGRAM_BOT_TOKEN
npm start              # Agent jalan! 🎉
```

**Atau pake PM2 (auto-restart):**
```bash
cd ~/claudiaclaw
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Custom path:**
```bash
curl -fsSL https://raw.githubusercontent.com/.../install.sh | sh -s -- /opt/claudiaclaw
```

---

## 🔒 Allowlist

Batasi akses user/grup di `.env`:
```bash
ALLOWLIST_USERS=659617669,1714557404
ALLOWLIST_GROUPS=-1003953147640
ALLOWLIST_OWNERS=659617669
```

Kosongkan untuk allow all.

---

## 🏗️ Architecture

```
                    ┌─────────────┐
                    │  Platforms  │  ← Telegram
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   @core     │  ← Event, Identity, Isolation, Allowlist
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
- **Memory Nuggets** — ekstrak fakta, preferensi, keputusan
- **Auto Compact** — kompres lama, nugget tetap diingat
- **SQLite persistent** — aman walau restart
- **Per-user isolation** — setiap user punya memori sendiri

### 📁 Struktur Data
```
📁 data/
  ├── users/<user-id>/
  │   ├── memory.db, identity.md, soul.md, notes/, projects/
  ├── groups/<group-id>/
  │   ├── memory.db, notes/, projects/
  └── claudiaclaw/identity.md, soul.md
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
| `@claudiaclaw/memory` | ~11 KB | SQLite + TurboQuant |
| `@claudiaclaw/config` | ~1.2 KB | Config with schema |

---

## 🗺️ Roadmap

### ✅ Done
- [x] Core engine, DeepSeek, Telegram, CLI wizard
- [x] SQLite, TurboQuant Memory, Skill System
- [x] Identity/Soul files, User/group isolation
- [x] Allowlist, PM2, Docker
- [x] One-liner curl installer

### 🚧 Coming Soon
- [ ] Discord platform, OpenAI/Anthropic providers
- [ ] Redis backend, Web dashboard, Skill marketplace

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
