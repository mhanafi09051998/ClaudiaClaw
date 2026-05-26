#!/usr/bin/env bash
# ===================================================
# ClaudiaClaw 🦞 — One-liner installer
# Usage: curl -fsSL https://claudiaclaw.dev/install.sh | sh
# Or:   curl -fsSL https://raw.githubusercontent.com/mhanafi09051998/ClaudiaClaw/main/install.sh | sh
# ===================================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}${CYAN}  ╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}  ║       🦞 ClaudiaClaw Installer       ║${NC}"
echo -e "${BOLD}${CYAN}  ║  Super modern agent framework        ║${NC}"
echo -e "${BOLD}${CYAN}  ╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Detect OS ──────────────────────────────────────

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)       ARCH="$ARCH" ;;
esac

echo -e "${BOLD}System:${NC} $OS ($ARCH)"

# ─── Check prerequisites ────────────────────────────

check_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# Check Git
if ! check_cmd git; then
  echo -e "${RED}Error: git is not installed.${NC}"
  echo "  Install: sudo apt install git  # Debian/Ubuntu"
  echo "           brew install git      # macOS"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Git $(git --version | head -1)"

# Check Node.js
NODE_OK=false
NODE_VERSION=""

if check_cmd node; then
  NODE_VERSION=$(node --version 2>/dev/null)
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null; then
    NODE_OK=true
    echo -e "  ${GREEN}✓${NC} Node.js $NODE_VERSION"
  else
    echo -e "  ${YELLOW}⚠${NC} Node.js $NODE_VERSION detected (need v20+)"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Node.js not found"
fi

# Install Node.js if needed
if [ "$NODE_OK" != "true" ]; then
  echo ""
  echo -e "${YELLOW}Node.js v20+ required. Installing via nvm...${NC}"

  if check_cmd nvm || [ -f "$HOME/.nvm/nvm.sh" ]; then
    [ -f "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
    nvm install 22
    nvm use 22
  elif check_cmd brew; then
    brew install node
  else
    # Install nvm
    echo "Installing nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
    [ -f "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
    nvm install 22
    nvm use 22
  fi

  if check_cmd node; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node --version) installed"
  else
    echo -e "${RED}Failed to install Node.js. Please install manually.${NC}"
    exit 1
  fi
fi

# Check npm
if ! check_cmd npm; then
  echo -e "${RED}Error: npm not found.${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm --version)"

# ─── Choose install directory ───────────────────────

INSTALL_DIR="${1:-$HOME/claudiaclaw}"

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo ""
  echo "Usage: curl -fsSL https://claudiaclaw.dev/install.sh | sh"
  echo "       curl -fsSL https://claudiaclaw.dev/install.sh | sh -s -- /custom/path"
  exit 0
fi

echo ""
echo -e "${BOLD}Install directory:${NC} $INSTALL_DIR"

if [ -d "$INSTALL_DIR" ]; then
  echo -e "  ${YELLOW}⚠${NC} Directory already exists. Updating..."
else
  mkdir -p "$(dirname "$INSTALL_DIR")" 2>/dev/null || true
fi

# ─── Clone / Pull ───────────────────────────────────

echo ""
echo -e "${BOLD}📦 Downloading ClaudiaClaw...${NC}"

if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git pull origin main
else
  git clone https://github.com/mhanafi09051998/ClaudiaClaw.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ─── Install dependencies ───────────────────────────

echo ""
echo -e "${BOLD}📥 Installing dependencies...${NC}"
npm install --no-audit --no-fund 2>&1 | tail -1

# ─── Build ──────────────────────────────────────────

echo ""
echo -e "${BOLD}🔨 Building packages...${NC}"
npm run build 2>&1 | tail -1

# ─── Setup .env ─────────────────────────────────────

if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo ""
  echo -e "${YELLOW}📝 Edit .env file with your API keys:${NC}"
  echo "  nano $INSTALL_DIR/.env"
fi

# ─── Done ───────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}✅ ClaudiaClaw berhasil diinstall!${NC}"
echo ""
echo -e "${BOLD}📁 Lokasi:${NC} $INSTALL_DIR"
echo ""
echo -e "${BOLD}🚀 Jalankan sekarang:${NC}"
echo ""
echo "  cd $INSTALL_DIR"
echo "  nano .env                    # Isi API key & token"
echo "  npm start                    # Jalanin agent!"
echo ""
echo -e "${BOLD}📚 Atau pake Docker:${NC}"
echo ""
echo "  cd $INSTALL_DIR"
echo "  docker build -t claudiaclaw ."
echo "  docker run -e DEEPSEEK_API_KEY=*** -e TELEGRAM_BOT_TOKEN=*** claudiaclaw"
echo ""
echo -e "${BOLD}💡 Butuh bantuan?${NC}"
echo "  cd $INSTALL_DIR && node ./packages/cli/dist/index.js --help"
echo ""

# ─── Ask to run onboarding ──────────────────────────

if [ -t 0 ]; then
  echo -ne "${BOLD}Jalankan onboarding wizard sekarang? (y/N): ${NC}"
  read -r RUN_INIT
  if [ "$RUN_INIT" = "y" ] || [ "$RUN_INIT" = "Y" ]; then
    echo ""
    node "$INSTALL_DIR/packages/cli/dist/index.js" init
  fi
fi
