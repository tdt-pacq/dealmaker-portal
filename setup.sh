#!/bin/bash
# PACQ App Setup Script
# Run this once to install dependencies and configure the app.

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Peterson Acquisitions — Deal Platform"
echo " Setup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo ""
  echo "ERROR: Node.js not found."
  echo "Install Node.js 18+ from https://nodejs.org/"
  echo "Or via Homebrew: brew install node"
  exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Node.js $NODE_VERSION found"

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "ERROR: npm not found. Please reinstall Node.js."
  exit 1
fi

echo ""
echo "Installing server dependencies..."
cd "$(dirname "$0")/server"
npm install

echo ""
echo "Installing client dependencies..."
cd "../client"
npm install

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Setup complete!"
echo ""
echo " NEXT STEPS:"
echo " 1. Add your Anthropic API key to .env:"
echo "    ANTHROPIC_API_KEY=sk-ant-..."
echo ""
echo " 2. (Optional) Change the team password in .env:"
echo "    TEAM_PASSWORD=your_secure_password"
echo ""
echo " 3. Start the app:"
echo "    ./start.sh"
echo ""
echo " Or start manually:"
echo "    Terminal 1: cd server && npm run dev"
echo "    Terminal 2: cd client && npm run dev"
echo "    Then open: http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
