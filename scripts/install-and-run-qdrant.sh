#!/usr/bin/env bash
# Install and run Qdrant natively on macOS (no Docker).
# Usage: ./scripts/install-and-run-qdrant.sh
# Or: npm run qdrant (if added to package.json)

set -e
QDRANT_VERSION="${QDRANT_VERSION:-v1.17.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PROJECT_ROOT/qdrant-local"
CONFIG_PATH="$PROJECT_ROOT/config/qdrant-config.yaml"

# Detect macOS architecture
ARCH=$(uname -m)
case "$ARCH" in
  arm64)  QDRANT_ARCH="aarch64-apple-darwin" ;;
  x86_64) QDRANT_ARCH="x86_64-apple-darwin" ;;
  *)      echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

TARBALL="qdrant-${QDRANT_ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/qdrant/qdrant/releases/download/${QDRANT_VERSION}/${TARBALL}"

echo "Qdrant $QDRANT_VERSION for $QDRANT_ARCH"
echo "Install dir: $INSTALL_DIR"
echo "Config: $CONFIG_PATH"
echo ""

# Install if binary missing
if [[ ! -f "$INSTALL_DIR/qdrant" ]]; then
  echo "Downloading Qdrant..."
  mkdir -p "$INSTALL_DIR"
  curl -sL "$DOWNLOAD_URL" -o "$INSTALL_DIR/$TARBALL"
  tar -xzf "$INSTALL_DIR/$TARBALL" -C "$INSTALL_DIR"
  rm -f "$INSTALL_DIR/$TARBALL"
  chmod +x "$INSTALL_DIR/qdrant"
  echo "Installed to $INSTALL_DIR"
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Config not found: $CONFIG_PATH"
  exit 1
fi

echo "Starting Qdrant (HTTP :6333, gRPC :6334, storage: $PROJECT_ROOT/qdrant_storage)..."
echo "Stop with Ctrl+C. Backend should use http://localhost:6333"
echo ""

cd "$PROJECT_ROOT"
exec "$INSTALL_DIR/qdrant" --config-path "$CONFIG_PATH"
