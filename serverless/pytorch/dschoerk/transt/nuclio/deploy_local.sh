#!/bin/bash
# ============================================================
# TransT Tracker 本地部署脚本（绕过 nuctl，使用 Nuclio REST API）
# 适用于：国内网络环境 / nuctl 二进制不可用的情况
# 使用前提：
#   1. trans-t/ 目录已 clone 至本脚本同级目录
#   2. transt.pth 已下载至本脚本同级目录
#   3. CVAT 及 Nuclio Dashboard (localhost:8070) 已启动
# ============================================================

set -e

NUCLIO_API="http://localhost:8070"
PROJECT_NAME="cvat"
FUNC_NAME="pth-dschoerk-transt"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "====== 步骤 1: 检查 Nuclio Dashboard 是否可达 ======"
curl -sf "${NUCLIO_API}/api/functions" > /dev/null || {
    echo "[ERROR] Nuclio Dashboard 无法访问: ${NUCLIO_API}"
    echo "请先确认 CVAT 已通过 serverless compose 启动"
    exit 1
}
echo "[OK] Nuclio Dashboard 连接正常"

echo ""
echo "====== 步骤 2: 确保 cvat 项目已存在 ======"
# 检查 cvat 项目是否已存在
EXISTING=$(curl -sf "${NUCLIO_API}/api/projects" | python3 -c "
import sys, json
projects = json.load(sys.stdin)
for p in projects.values():
    if p.get('metadata', {}).get('name') == 'cvat':
        print('exists')
        break
" 2>/dev/null || true)

if [ "$EXISTING" = "exists" ]; then
    echo "[OK] cvat 项目已存在，跳过创建"
else
    echo "[INFO] 创建 cvat 项目..."
    curl -sf -X POST "${NUCLIO_API}/api/projects" \
        -H "Content-Type: application/json" \
        -d '{
            "metadata": {"name": "cvat", "namespace": "nuclio"},
            "spec": {"displayName": "CVAT"}
        }' > /dev/null
    echo "[OK] cvat 项目创建成功"
fi

echo ""
echo "====== 步骤 3: 检查本地文件是否就绪 ======"
if [ ! -d "${SCRIPT_DIR}/trans-t" ]; then
    echo "[ERROR] 未找到 trans-t 目录，请先执行："
    echo "  cd ${SCRIPT_DIR}"
    echo "  git clone --depth 1 --branch v1.0 https://github.com/dschoerk/TransT trans-t"
    exit 1
fi
echo "[OK] trans-t 源码目录存在"

if [ ! -f "${SCRIPT_DIR}/transt.pth" ]; then
    echo "[ERROR] 未找到 transt.pth 模型权重文件"
    echo "请从 Google Drive 下载后放置到: ${SCRIPT_DIR}/transt.pth"
    echo "下载地址: https://drive.google.com/file/d/1Pq0sK-9jmbLAVtgB9-dPDc2pipCxYdM5/view"
    exit 1
fi
echo "[OK] transt.pth 模型权重文件存在"

echo ""
echo "====== 步骤 4: 构建并部署 TransT Docker 镜像 ======"
echo "[INFO] 这一步会构建 Docker 镜像，可能需要 10-30 分钟..."
echo "[INFO] 如果 pip 下载 PyTorch 很慢，可设置代理后重新运行"

# 读取 yaml 文件并通过 API 部署函数
FUNC_YAML=$(cat "${SCRIPT_DIR}/function-gpu-local.yaml")

curl -sf -X POST "${NUCLIO_API}/api/functions" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${FUNC_NAME}\",
            \"namespace\": \"nuclio\",
            \"labels\": {\"nuclio.io/project-name\": \"${PROJECT_NAME}\"}
        },
        \"spec\": {
            \"description\": \"Fast Online Object Tracking and Segmentation\",
            \"runtime\": \"python:3.10\",
            \"handler\": \"main:handler\",
            \"eventTimeout\": \"30s\",
            \"env\": [{\"name\": \"PYTHONPATH\", \"value\": \"/opt/nuclio/trans-t\"}],
            \"build\": {
                \"image\": \"cvat.pth.dschoerk.transt:latest-gpu\",
                \"baseImage\": \"ubuntu:22.04\",
                \"path\": \"${SCRIPT_DIR}\",
                \"functionConfigPath\": \"function-gpu-local.yaml\"
            }
        }
    }" || {
    echo ""
    echo "[INFO] REST API 直接部署遇到问题，改用 nuctl docker 容器方式..."
    echo ""
    echo "请在 WSL2 中手动运行以下命令："
    echo ""
    echo "  docker run --rm \\"
    echo "    -v /var/run/docker.sock:/var/run/docker.sock \\"
    echo "    -v ${SCRIPT_DIR}:${SCRIPT_DIR} \\"
    echo "    --network host \\"
    echo "    --entrypoint nuctl \\"
    echo "    quay.io/nuclio/dashboard:1.15.9-amd64 \\"
    echo "    deploy --project-name cvat \\"
    echo "    --path \"${SCRIPT_DIR}\" \\"
    echo "    --file \"${SCRIPT_DIR}/function-gpu-local.yaml\" \\"
    echo "    --platform local \\"
    echo "    --env CVAT_FUNCTIONS_REDIS_HOST=cvat_redis_ondisk \\"
    echo "    --env CVAT_FUNCTIONS_REDIS_PORT=6666 \\"
    echo "    --platform-config '{\"attributes\": {\"network\": \"cvat_cvat\"}}'"
    exit 1
}

echo ""
echo "[OK] 部署请求已发送，正在等待构建完成..."
echo "[INFO] 可通过以下命令监控部署状态："
echo "  curl -s http://localhost:8070/api/functions/${FUNC_NAME} | python3 -m json.tool | grep state"
echo ""
echo "浏览器打开 http://localhost:8070 查看实时构建日志"
