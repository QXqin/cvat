# TransT Tracker Deployment Guide

This document describes how to deploy the [TransT](https://github.com/dschoerk/TransT) object tracker as a serverless function in CVAT via Nuclio.

> **Target Environment**: Windows 10/11 + WSL2 + Docker Desktop + NVIDIA GPU

---

## Prerequisites

| Component | Requirement |
|-----------|-------------|
| Docker Desktop | Installed and running with WSL2 backend |
| NVIDIA Driver | CUDA-capable driver installed (for GPU runtime) |
| CVAT | Running via `docker compose` (with serverless component) |
| nuctl | Nuclio CLI, v1.15.x |
| Disk Space | ≥ 10 GB (Docker images + model weights) |

---

## Quick Deploy (One-Click Script)

```bash
# Run in WSL2 terminal
cd <your-cvat-root>/serverless/pytorch/dschoerk/transt/nuclio
bash deploy_transt.sh
```

The script automatically performs the following:
1. Validates Docker / nuctl / Nuclio Dashboard availability.
2. Clones the TransT source and patches torchvision compatibility.
3. Checks for model weights (`transt.pth` must be downloaded manually).
4. Downloads the ResNet50 backbone weights.
5. Builds the Docker base image.
6. Deploys the function to Nuclio via `nuctl`.

---

## Manual Deployment (Step-by-Step)

### 1. Install nuctl

```bash
# Download the nuctl binary
wget https://github.com/nuclio/nuclio/releases/download/1.15.9/nuctl-1.15.9-linux-amd64
chmod +x nuctl-1.15.9-linux-amd64
sudo mv nuctl-1.15.9-linux-amd64 /usr/local/bin/nuctl

# Verify installation
nuctl version
```

### 2. Download Model Files

```bash
cd serverless/pytorch/dschoerk/transt/nuclio

# 2a. Clone TransT source
git clone --depth 1 --branch v1.0 https://github.com/dschoerk/TransT trans-t

# 2b. Download TransT weights (~88MB, hosted on Google Drive)
python3 download_model.py
# Or manually: https://drive.google.com/file/d/1Pq0sK-9jmbLAVtgB9-dPDc2pipCxYdM5/view

# 2c. Download ResNet50 backbone weights (~98MB)
wget -O resnet50-0676ba61.pth https://download.pytorch.org/models/resnet50-0676ba61.pth
```

### 3. Patch Compatibility Issue

TransT's `util/misc.py` references `_new_empty_tensor` from torchvision, which has been removed in newer versions. Apply the following patch:

```bash
sed -i "s/if float(torchvision.__version__\[:3\]) < 0.7/if False:  # patched/g" trans-t/util/misc.py
```

### 4. Build the Docker Base Image

```bash
docker build -t cvat.transt.base:latest -f Dockerfile.transt .
```

> **Note:** The first build downloads PyTorch (~1.8 GB) and may take 10–20 minutes. Subsequent builds use the Docker cache and complete in seconds.

### 5. Deploy to Nuclio

```bash
# Fix WSL credential helper (if you encounter "exec format error")
cp ~/.docker/config.json ~/.docker/config.json.bak 2>/dev/null; echo '{}' > ~/.docker/config.json

# Remove stale function (if any)
nuctl delete function pth-dschoerk-transt --platform local --force 2>/dev/null

# Deploy
nuctl deploy --project-name cvat --path . \
  --file function-gpu-local.yaml \
  --platform local \
  --base-image cvat.transt.base:latest \
  --env CVAT_FUNCTIONS_REDIS_HOST=cvat_redis_ondisk \
  --env CVAT_FUNCTIONS_REDIS_PORT=6666 \
  --platform-config '{"attributes": {"network": "cvat_cvat"}}'
```

### 6. Verify Deployment

```bash
nuctl get function --platform local
# Confirm STATE is "ready"
```

---

## File Structure

```
nuclio/
├── deploy_transt.sh           # One-click deployment script
├── Dockerfile.transt          # Docker base image definition
├── function-gpu-local.yaml    # Nuclio function config (local deployment)
├── function-gpu.yaml          # Nuclio function config (original, requires external network)
├── main.py                    # Nuclio handler entry point
├── model_handler.py           # TransT model inference logic
├── download_model.py          # Script to download transt.pth
├── DEPLOY_TRANST.md           # This document
├── trans-t/                   # TransT source (cloned via git)
├── transt.pth                 # TransT model weights (~88MB)
└── resnet50-0676ba61.pth      # ResNet50 backbone (~98MB)
```

---

## Troubleshooting

### Q: Tracker is unavailable after Docker restart (Network is unreachable)

Nuclio container port mappings are invalidated when Docker restarts. Re-deploy to fix:

```bash
bash deploy_transt.sh
```

### Q: First invocation returns 504 Gateway Timeout

This occurs when the ResNet50 backbone is being downloaded at runtime. Ensure `resnet50-0676ba61.pth` is pre-baked into the Docker image (the one-click script handles this automatically).

### Q: `docker-credential-desktop.exe: exec format error`

This is a known WSL2 issue where the Docker credential helper is misconfigured. Fix:

```bash
cp ~/.docker/config.json ~/.docker/config.json.bak
echo '{}' > ~/.docker/config.json
```

### Q: `Function cannot be updated when existing function is being provisioned`

A previous deployment was interrupted, leaving a stale function entry. Fix:

```bash
nuctl delete function pth-dschoerk-transt --platform local --force
```

### Q: WSL runs out of memory and Docker crashes

Create or edit `%USERPROFILE%\.wslconfig` (in Windows):

```ini
[wsl2]
memory=12GB
swap=4GB
```

Then restart WSL:

```powershell
wsl --shutdown
```

---

## Architecture

```
Browser → nginx (traefik:8080) → CVAT Server → Nuclio Container (TransT)
                                     ↓                    ↓
                               host.docker.internal  GPU Inference
                                     ↓
                              Tracking result (bbox)
```

CVAT communicates with the Nuclio function container via `host.docker.internal:<port>`, where the port is dynamically assigned by Nuclio.
