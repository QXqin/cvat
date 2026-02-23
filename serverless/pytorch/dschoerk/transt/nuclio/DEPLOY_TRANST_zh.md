# TransT 目标跟踪器部署教程

本文档介绍如何在 CVAT 中以 Serverless / Nuclio 方式部署 [TransT](https://github.com/dschoerk/TransT) 目标跟踪器。

> **适用环境**: Windows 10/11 + WSL2 + Docker Desktop + NVIDIA GPU

[🇨🇳 简体中文](DEPLOY_TRANST_zh.md) | [🇺🇸 English](DEPLOY_TRANST.md)

---

## 前置条件

| 组件 | 要求 |
|------|------|
| Docker Desktop | 已安装并运行，WSL2 后端 |
| NVIDIA 驱动 | 支持 CUDA（需 GPU Runtime） |
| CVAT | 已通过 `docker compose` 启动（含 serverless 组件） |
| nuctl | Nuclio CLI，v1.15.x |
| 磁盘空间 | ≥ 10 GB（Docker 镜像 + 模型权重） |

---

## 快速部署（一键脚本）

```bash
# 在 WSL2 终端中执行
cd <你的cvat根目录>/serverless/pytorch/dschoerk/transt/nuclio
bash deploy_transt.sh
```

脚本会自动完成以下步骤：
1. 检查 Docker / nuctl / Nuclio Dashboard 环境。
2. 克隆 TransT 源码并修补 torchvision 兼容性问题。
3. 检查模型权重文件（`transt.pth` 需手动下载）。
4. 下载 ResNet50 backbone 权重。
5. 构建 Docker 基础镜像。
6. 通过 `nuctl` 部署函数到 Nuclio。

---

## 手动部署（分步操作）

### 1. 安装 nuctl

```bash
# 下载 nuctl 二进制文件
wget https://github.com/nuclio/nuclio/releases/download/1.15.9/nuctl-1.15.9-linux-amd64
chmod +x nuctl-1.15.9-linux-amd64
sudo mv nuctl-1.15.9-linux-amd64 /usr/local/bin/nuctl

# 验证安装
nuctl version
```

### 2. 下载模型文件

```bash
cd serverless/pytorch/dschoerk/transt/nuclio

# 2a. 克隆 TransT 源码
git clone --depth 1 --branch v1.0 https://github.com/dschoerk/TransT trans-t

# 2b. 下载 TransT 权重（~88MB，托管在 Google Drive）
python3 download_model.py
# 或手动下载: https://drive.google.com/file/d/1Pq0sK-9jmbLAVtgB9-dPDc2pipCxYdM5/view

# 2c. 下载 ResNet50 backbone 权重（~98MB）
wget -O resnet50-0676ba61.pth https://download.pytorch.org/models/resnet50-0676ba61.pth
```

### 3. 修补兼容性问题

TransT 的 `util/misc.py` 引用了新版 torchvision 中已移除的 `_new_empty_tensor`，需要修补：

```bash
sed -i "s/if float(torchvision.__version__\[:3\]) < 0.7/if False:  # patched/g" trans-t/util/misc.py
```

### 4. 构建 Docker 基础镜像

```bash
docker build -t cvat.transt.base:latest -f Dockerfile.transt .
```

> **说明：** 首次构建需下载 PyTorch (~1.8 GB)，耗时约 10–20 分钟。后续构建使用 Docker 缓存，仅需数秒。

### 5. 部署到 Nuclio

```bash
# 修复 WSL credential helper（如果遇到 "exec format error"）
cp ~/.docker/config.json ~/.docker/config.json.bak 2>/dev/null; echo '{}' > ~/.docker/config.json

# 清理旧函数（如有）
nuctl delete function pth-dschoerk-transt --platform local --force 2>/dev/null

# 部署
nuctl deploy --project-name cvat --path . \
  --file function-gpu-local.yaml \
  --platform local \
  --base-image cvat.transt.base:latest \
  --env CVAT_FUNCTIONS_REDIS_HOST=cvat_redis_ondisk \
  --env CVAT_FUNCTIONS_REDIS_PORT=6666 \
  --platform-config '{"attributes": {"network": "cvat_cvat"}}'
```

### 6. 验证部署

```bash
nuctl get function --platform local
# 确认 STATE 为 "ready"
```

---

## 文件结构

```
nuclio/
├── deploy_transt.sh           # 一键部署脚本
├── Dockerfile.transt          # Docker 基础镜像定义
├── function-gpu-local.yaml    # Nuclio 函数配置（本地部署用）
├── function-gpu.yaml          # Nuclio 函数配置（原版，需外网）
├── main.py                    # Nuclio handler 入口
├── model_handler.py           # TransT 模型推理逻辑
├── download_model.py          # transt.pth 下载脚本
├── DEPLOY_TRANST.md           # 英文部署教程
├── DEPLOY_TRANST_zh.md        # 本文档（中文部署教程）
├── trans-t/                   # TransT 源码（通过 git clone 获取）
├── transt.pth                 # TransT 模型权重（~88MB）
└── resnet50-0676ba61.pth      # ResNet50 backbone（~98MB）
```

---

## 常见问题

### Q: Docker 重启后 Tracker 不可用（Network is unreachable）

Docker 重启后 Nuclio 容器的端口映射会失效，需要重新部署：

```bash
bash deploy_transt.sh
```

### Q: 首次调用返回 504 Gateway Timeout

原因是 ResNet50 backbone 在运行时被下载。请确保 `resnet50-0676ba61.pth` 已预置到 Docker 镜像中（一键脚本已自动处理）。

### Q: `docker-credential-desktop.exe: exec format error`

这是一个已知的 WSL2 Docker credential helper 配置问题。修复方法：

```bash
cp ~/.docker/config.json ~/.docker/config.json.bak
echo '{}' > ~/.docker/config.json
```

### Q: `Function cannot be updated when existing function is being provisioned`

上一次部署被中断，留下了残留函数条目。修复方法：

```bash
nuctl delete function pth-dschoerk-transt --platform local --force
```

### Q: WSL 内存不足导致 Docker 崩溃

在 Windows 中创建或编辑 `%USERPROFILE%\.wslconfig`：

```ini
[wsl2]
memory=12GB
swap=4GB
```

然后重启 WSL：

```powershell
wsl --shutdown
```

---

## 架构说明

```
浏览器 → nginx (traefik:8080) → CVAT Server → Nuclio 容器 (TransT)
                                     ↓                    ↓
                               host.docker.internal  GPU 推理
                                     ↓
                              跟踪结果 (bbox)
```

CVAT 通过 `host.docker.internal:<port>` 直接调用 Nuclio 函数容器，端口由 Nuclio 动态分配。
