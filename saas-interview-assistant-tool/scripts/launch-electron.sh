#!/bin/bash
# macOS-compatible Electron launcher for development
export NODE_ENV=development
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
ELECTRON="$DIR/node_modules/electron/dist/Electron.app"

if [ -d "$ELECTRON" ]; then
  open -n "$ELECTRON" --args "$DIR"
else
  echo "Electron not found at: $ELECTRON"
  echo "Run: npm install"
  exit 1
fi
