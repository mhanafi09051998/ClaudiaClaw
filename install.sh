#!/usr/bin/env bash
# ===================================================
# ClaudiaClaw 💅🏻 — One-liner installer
# Support: Linux, Windows (Git Bash / MINGW64)
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
echo -e "${BOLD}${CYAN}  ║      💅🏻 ClaudiaClaw Installer       ║${NC}"
echo -e "${BOLD}${CYAN}  ╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Detect OS ────────────────────────────────────

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
IS_WINDOWS=false

case "$OS" in
  mingw*|msys*|cygwin*)
    IS_WINDOWS=true
    OS="windows"
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

echo -e "${BOLD}System:${NC} $OS ($ARCH)"

# ─── Prerequisites ─────────────────────────────────

check_cmd() { command -v "$1" >/dev/null 2>&1; }

# Git
if ! check_cmd git; then
  if [ "$IS_WINDOWS" = true ]; then
    echo -e "${RED}Error: git not found. Install Git for Windows:${NC}"
    echo "  https://git-scm.com/download/win"
  else
    echo -e "${RED}Error: git not found. Install: sudo apt install git${NC}"
  fi
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Git"

# Node.js
NODE_OK=false
if check_cmd node; then
  V=$(node --version | sed 's/v//' | cut -d. -f1)
  [ "$V" -ge 20 ] 2>/dev/null && NODE_OK=true
  echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
fi

if [ "$NODE_OK" != "true" ]; then
  if [ "$IS_WINDOWS" = true ]; then
    echo -e "${YELLOW}⚠  Node.js v20+ required.${NC}"
    echo "  Download from: https://nodejs.org (v22 LTS recommended)"
    echo "  Or install via: winget install OpenJS.NodeJS.LTS"
    echo ""
    echo -e "${YELLOW}After installing Node.js, run this script again.${NC}"
    exit 1
  else
    echo -e "${YELLOW}⚠  Node.js v20+ required. Installing...${NC}"
    if [ -f "$HOME/.nvm/nvm.sh" ]; then
      . "$HOME/.nvm/nvm.sh"
    else
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
      [ -f "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
    fi
    nvm install 22 && nvm use 22
    echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
  fi
fi

echo -e "  ${GREEN}✓${NC} npm $(npm --version)"

# ─── Install directory ─────────────────────────────

INSTALL_DIR="${1:-$HOME/.claudiaclaw}"

[ "$1" = "--help" ] || [ "$1" = "-h" ] && {
  echo "Usage: curl ... | sh"
  echo "       curl ... | sh -s -- /custom/path"
  exit 0
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

# ─── Auto-run interactive onboarding ───────────────

echo ""
echo -e "${GREEN}${BOLD}✅ ClaudiaClaw berhasil diinstall!${NC}"
echo ""
echo -e "${BOLD}📁 Lokasi:${NC} $INSTALL_DIR"
echo ""
echo -e "${BOLD}Sekarang kita akan setup agent pertamamu...${NC}"
echo ""

cd "$INSTALL_DIR"
node ./packages/cli/dist/index.js init
