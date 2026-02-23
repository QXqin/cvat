#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "====== 步骤 1: 构建 TransT 基础镜像 ======"
echo "[INFO] 使用清华源，无需翻墙"
echo "[INFO] 首次构建需要下载 PyTorch (~2GB)，预计 5-15 分钟"
echo ""

docker build -t cvat.transt.base:latest -f Dockerfile.transt .

echo ""
echo "[OK] 基础镜像构建完成！"
echo ""
echo "====== 步骤 2: 通过 nuctl 部署到 Nuclio ======"
echo ""

nuctl deploy --project-name cvat --path . \
  --file function-gpu-local.yaml \
  --platform local \
  --base-image cvat.transt.base:latest \
  --env CVAT_FUNCTIONS_REDIS_HOST=cvat_redis_ondisk \
  --env CVAT_FUNCTIONS_REDIS_PORT=6666 \
  --platform-config '{"attributes": {"network": "cvat_cvat"}}'

echo ""
echo "====== 部署完成！ ======"
echo "[OK] TransT tracker 已成功部署到 Nuclio"
echo "[INFO] 刷新 CVAT 标注页面即可在 AI 工具栏看到 TransT"
echo ""
nuctl get function --platform local
