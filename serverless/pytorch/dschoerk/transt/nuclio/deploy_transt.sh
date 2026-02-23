#!/bin/bash
# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT
# ============================================================
# TransT Tracker — One-Click Deployment Script
# Environment: CVAT + Nuclio (WSL2 / Linux)
# Prerequisites: Docker Desktop running, CVAT started via docker compose
# ============================================================
set -e

# ── Configuration ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRANST_SRC_DIR="${SCRIPT_DIR}/trans-t"
TRANST_WEIGHTS="${SCRIPT_DIR}/transt.pth"
RESNET_WEIGHTS="${SCRIPT_DIR}/resnet50-0676ba61.pth"
DOCKERFILE="${SCRIPT_DIR}/Dockerfile.transt"
FUNC_YAML="${SCRIPT_DIR}/function-gpu-local.yaml"
BASE_IMAGE="cvat.transt.base:latest"

TRANST_REPO="https://github.com/dschoerk/TransT"
TRANST_BRANCH="v1.0"
TRANST_GDRIVE_ID="1Pq0sK-9jmbLAVtgB9-dPDc2pipCxYdM5"
RESNET_URL="https://download.pytorch.org/models/resnet50-0676ba61.pth"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ── Step 0: Environment Check ──
echo ""
echo "============================================"
echo "  TransT Tracker — Deployment"
echo "============================================"
echo ""

info "Checking Docker..."
docker info > /dev/null 2>&1 || fail "Docker is not running. Please start Docker Desktop first."
ok "Docker is running"

info "Checking nuctl..."
if ! command -v nuctl &> /dev/null; then
    fail "nuctl is not installed. See DEPLOY_TRANST.md for installation instructions."
fi
ok "nuctl installed: $(nuctl version 2>/dev/null | head -1 || echo 'unknown')"

info "Checking Nuclio Dashboard..."
curl -sf "http://localhost:8070/api/functions" > /dev/null 2>&1 || \
    fail "Nuclio Dashboard (localhost:8070) is unreachable. Start CVAT first:\n       docker compose -f docker-compose.yml -f components/serverless/docker-compose.serverless.yml up -d"
ok "Nuclio Dashboard is accessible"

# ── Step 1: Download Model Files ──
echo ""
echo "── Step 1/4: Model Files ──"

if [ -d "$TRANST_SRC_DIR" ]; then
    ok "TransT source already exists"
else
    info "Cloning TransT source (${TRANST_REPO})..."
    git clone --depth 1 --branch "$TRANST_BRANCH" "$TRANST_REPO" "$TRANST_SRC_DIR"
    ok "TransT source cloned"
fi

# Patch torchvision compatibility issue in misc.py
MISC_PY="${TRANST_SRC_DIR}/util/misc.py"
if grep -q 'if float(torchvision.__version__\[:3\]) < 0.7' "$MISC_PY" 2>/dev/null; then
    info "Patching torchvision compatibility in misc.py..."
    sed -i "s/if float(torchvision.__version__\[:3\]) < 0.7/if False:  # patched for torchvision compat/g" "$MISC_PY"
    ok "misc.py patched"
else
    ok "misc.py already patched or does not need patching"
fi

if [ -f "$TRANST_WEIGHTS" ]; then
    ok "transt.pth exists ($(du -h "$TRANST_WEIGHTS" | cut -f1))"
else
    warn "transt.pth not found!"
    echo "  Please download it manually and place at: ${TRANST_WEIGHTS}"
    echo "  Google Drive: https://drive.google.com/file/d/${TRANST_GDRIVE_ID}/view"
    echo "  Or run: python3 ${SCRIPT_DIR}/download_model.py"
    fail "Missing transt.pth. Cannot continue."
fi

if [ -f "$RESNET_WEIGHTS" ]; then
    ok "ResNet50 backbone exists ($(du -h "$RESNET_WEIGHTS" | cut -f1))"
else
    info "Downloading ResNet50 backbone weights (~98MB)..."
    wget -q --show-progress -O "$RESNET_WEIGHTS" "$RESNET_URL" || \
        curl -L -o "$RESNET_WEIGHTS" "$RESNET_URL" || \
        fail "Failed to download ResNet50. Please check your network connection."
    ok "ResNet50 backbone downloaded"
fi

# ── Step 2: Build Docker Base Image ──
echo ""
echo "── Step 2/4: Build Docker Base Image ──"
info "First build may take 10-20 minutes (downloads PyTorch ~1.8GB)"
info "Subsequent builds use cache and complete in seconds"

cd "$SCRIPT_DIR"
docker build -t "$BASE_IMAGE" -f "$DOCKERFILE" .
ok "Base image ${BASE_IMAGE} built successfully"

# ── Step 3: Fix WSL docker-credential Issue ──
echo ""
echo "── Step 3/4: Environment Fix ──"
DOCKER_CONFIG="$HOME/.docker/config.json"
if [ -f "$DOCKER_CONFIG" ] && grep -q "desktop.exe" "$DOCKER_CONFIG" 2>/dev/null; then
    info "Fixing WSL docker-credential-desktop compatibility..."
    # Back up the original config before overwriting
    cp "$DOCKER_CONFIG" "${DOCKER_CONFIG}.bak" 2>/dev/null || true
    echo '{}' > "$DOCKER_CONFIG"
    ok "Docker config fixed (backup saved as config.json.bak)"
else
    ok "Docker config is OK"
fi

# ── Step 4: Deploy to Nuclio ──
echo ""
echo "── Step 4/4: Deploy to Nuclio ──"

# Remove stale function (ignore errors)
nuctl delete function pth-dschoerk-transt --platform local --force 2>/dev/null || true

info "Deploying TransT to Nuclio..."
nuctl deploy --project-name cvat --path "$SCRIPT_DIR" \
    --file "$FUNC_YAML" \
    --platform local \
    --base-image "$BASE_IMAGE" \
    --env CVAT_FUNCTIONS_REDIS_HOST=cvat_redis_ondisk \
    --env CVAT_FUNCTIONS_REDIS_PORT=6666 \
    --platform-config '{"attributes": {"network": "cvat_cvat"}}'

echo ""
echo "============================================"
echo ""
nuctl get function --platform local
echo ""
echo -e "${GREEN}✅ TransT Tracker deployed successfully!${NC}"
echo ""
echo "Usage:"
echo "  1. Open a CVAT annotation job"
echo "  2. Draw a bounding box on any frame"
echo "  3. Select the box, then click the Track button in the AI toolbar"
echo "  4. TransT will automatically track the object across subsequent frames"
echo ""
echo "============================================"
