#!/usr/bin/env bash
# ===================================================
# ClaudiaClaw 🦞 — One-liner installer (Linux)
# Usage: curl -fsSL https://raw.githubusercontent.com/.../install.sh | sh
# ===================================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}  ╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}  ║       🦞 ClaudiaClaw Installer       ║${NC}"
echo -e "${BOLD}${CYAN}  ╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Check OS ──────────────────────────────────────

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in x86_64) ARCH="amd64" ;; aarch64|arm64) ARCH="arm64" ;; esac
echo -e "${BOLD}System:${NC} $OS ($ARCH)"

if [ "$OS" != "linux" ]; then
  echo -e "${YELLOW}⚠  Linux is the primary target. macOS may work but not officially supported.${NC}"
fi

# ─── Prerequisites ─────────────────────────────────

check_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! check_cmd git; then
  echo -e "${RED}Error: git not found. Install: sudo apt install git${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Git"

NODE_OK=false
if check_cmd node; then
  V=$(node --version | sed 's/v//' | cut -d. -f1)
  [ "$V" -ge 20 ] 2>/dev/null && NODE_OK=true
  echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
fi

if [ "$NODE_OK" != "true" ]; then
  echo -e "${YELLOW}⚠  Node.js v20+ required. Installing...${NC}"
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
    nvm install 22 && nvm use 22
  else
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
    [ -f "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
    nvm install 22 && nvm use 22
  fi
  echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
fi

echo -e "  ${GREEN}✓${NC} npm $(npm --version)"

# ─── Install directory ─────────────────────────────

INSTALL_DIR="${1:-$HOME/claudiaclaw}"
[ "$1" = "--help" ] || [ "$1" = "-h" ] && {
  echo "Usage: curl ... | sh"; echo "       curl ... | sh -s -- /custom/path"; exit 0
}
echo -e "${BOLD}Target:${NC} $INSTALL_DIR"

# ─── Clone / Pull ──────────────────────────────────

echo ""
echo -e "${BOLD}📦 Downloading ClaudiaClaw...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR" && git pull origin main
else
  mkdir -p "$(dirname "$INSTALL_DIR")" 2>/dev/null || true
  git clone https://github.com/mhanafi09051998/ClaudiaClaw.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ─── Install deps & build ──────────────────────────

echo ""
echo -e "${BOLD}📥 Installing dependencies...${NC}"
npm install --no-audit --no-fund 2>&1 | tail -1

echo ""
echo -e "${BOLD}🔨 Building packages...${NC}"
npm run build 2>&1 | tail -1

# ─── .env ──────────────────────────────────────────

if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo ""
  echo -e "${YELLOW}📝 File .env sudah dibuat. Isi API key & token:${NC}"
  echo "  nano $INSTALL_DIR/.env"
fi

# ─── Done ──────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}✅ ClaudiaClaw berhasil diinstall!${NC}"
echo ""
echo -e "${BOLD}📁 Lokasi:${NC} $INSTALL_DIR"
echo ""

# ─── Interactive: PM2 ──────────────────────────────

if [ -t 0 ]; then
  echo -ne "${BOLD}🔧 Setup PM2 auto-restart sekarang? (y/N): ${NC}"
  read -r SETUP_PM2
  if [ "$SETUP_PM2" = "y" ] || [ "$SETUP_PM2" = "Y" ]; then
    echo ""
    echo -e "${BOLD}📦 Installing PM2...${NC}"
    npm install -g pm2 2>&1 | tail -1
    cd "$INSTALL_DIR"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "  ${GREEN}✓${NC} PM2 started — auto-restart aktif"
    echo ""
    echo -e "${YELLOW}⚠  Jangan lupa: isi DEEPSEEK_API_KEY & TELEGRAM_BOT_TOKEN di .env${NC}"
    echo -e "${YELLOW}   lalu jalankan: pm2 restart claudiaclaw${NC}"
    echo ""
    echo -ne "${BOLD}🚀 Mau setting PM2 startup (auto-start pas reboot)? (y/N): ${NC}"
    read -r SETUP_STARTUP
    if [ "$SETUP_STARTUP" = "y" ] || [ "$SETUP_STARTUP" = "Y" ]; then
      pm2 startup 2>&1 | tail -3
      echo -e "  ${GREEN}✓${NC} PM2 startup configured"
    fi
  fi

  # ─── Interactive: onboarding ─────────────────────
  echo ""
  echo -ne "${BOLD}🚀 Jalankan onboarding wizard sekarang? (y/N): ${NC}"
  read -r RUN_INIT
  if [ "$RUN_INIT" = "y" ] || [ "$RUN_INIT" = "Y" ]; then
    echo ""
    node "$INSTALL_DIR/packages/cli/dist/index.js" init
  fi
fi

# ─── Final instructions ────────────────────────────

echo ""
echo -e "${BOLD}📋 Langkah selanjutnya:${NC}"
echo "  1. nano $INSTALL_DIR/.env    — isi API key & token"
echo "  2. cd $INSTALL_DIR && npm start   — jalankan agent"
echo ""
echo -e "${BOLD}📖 Butuh bantuan:${NC}"
echo "  node $INSTALL_DIR/packages/cli/dist/index.js --help"
echo "  https://github.com/mhanafi09051998/ClaudiaClaw"
echo ""
