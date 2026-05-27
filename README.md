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
[![Linux](https://img.shields.io/badge/Linux-ready-FCC624?style=flat-square&logo=linux)](https://kernel.org)
[![Windows](https://img.shields.io/badge/Windows-ready-00A4EF?style=flat-square&logo=windows)](https://git-scm.com/download/win)

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

## 🚀 Install

**Clone & Setup:**
```bash
git clone https://github.com/mhanafi09051998/ClaudiaClaw.git ~/.claudiaclaw
cd ~/.claudiaclaw
npm install && npm run build
```

**Wizard interaktif:**
```bash
node ./packages/cli/dist/index.js init
```

**Jalankan agent:**
```bash
npm start
```

Yang terjadi saat init:
```
1. Install Git & Node.js (otomatis jika perlu)
2. Clone ClaudiaClaw ke ~/.claudiaclaw/
3. npm install + build

┌─ Wizard Interaktif ──────────────────────────┐
│                                              │
│  Step 1: Masukkan DeepSeek API Key           │
│  Step 2: Pilih model [deepseek-v4-flash]     │
│  Step 3: Masukkan Telegram Bot Token         │
│                                              │
│  ✅ .env + config.json terisi otomatis       │
│  ✅ PM2 auto-install, start, save            │
│  ✅ Startup auto-configure                   │
│                                              │
│  💅🏻 AGENT SUDAH JALAN!                       │
└──────────────────────────────────────────────┘
```

**Tidak perlu edit file manual. Tidak perlu setup tambahan.**
Cukup jawab 3 pertanyaan di terminal, agent langsung running via PM2.

Cek status:
```bash
pm2 status
pm2 logs claudiaclaw
```



---

## 🔒 Pairing & Allowlist

User yang belum terdaftar otomatis dapat pairing code saat kirim pesan:
```
⛔ Access not configured.
Your Telegram user ID: 659617669
Your pairing code: 55GAGP8E

Ask the bot owner to approve with:
claudiaclaw pairing approve telegram 55GAGP8E
```

**Owner approve dari server:**
```bash
claudiaclaw pairing approve telegram 55GAGP8E
✅ User 659617669 approved!
```

Atau tambah manual di `data/claudiaclaw/allowlist.json`:
```json
{
  "users": ["659617669"],
  "groups": ["-1003953147640"],
  "owners": ["659617669"]
}
```

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
  ├── users/<user-id>/   → memory.db, identity.md, soul.md, notes/, projects/
  ├── groups/<group-id>/ → memory.db, notes/, projects/
  └── claudiaclaw/       → identity.md, soul.md
```

---

## 📦 Packages

| Package | Size | Description |
|---------|:----:|-------------|
| `@claudiaclaw/core` | ~3.3 KB | Engine, Identity, Isolation, Allowlist |
| `@claudiaclaw/cli` | ~6.5 KB | CLI — init, start, help |
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
- [x] One-liner curl installer with interactive config

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
