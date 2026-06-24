#!/bin/bash
# ═══════════════════════════════════════════════
# RootX LLM Deployment Script for AMD GPU
# ═══════════════════════════════════════════════
#
# Deploys the fine-tuned RootX Security LLM on AMD MI300X
# using vLLM with ROCm support.
#
# Usage:
#   chmod +x deploy_amd.sh
#   ./deploy_amd.sh [--model ./output/rootx-security-llm] [--port 8000]
#
# Prerequisites:
#   - AMD MI300X GPU with ROCm drivers
#   - Docker (recommended) or Python 3.10+
#   - vLLM with ROCm support

set -e

MODEL_PATH="${1:-./output/rootx-security-llm}"
PORT="${2:-8000}"
GPU_COUNT="${3:-1}"

echo "═══════════════════════════════════════════════"
echo "  ROOTX LLM DEPLOYMENT — AMD GPU"
echo "═══════════════════════════════════════════════"
echo "  Model:  $MODEL_PATH"
echo "  Port:   $PORT"
echo "  GPUs:   $GPU_COUNT"
echo "═══════════════════════════════════════════════"

# ─── Option 1: Docker (Recommended) ───
echo ""
echo "🐳 Deploying with Docker + ROCm..."
echo ""

docker run -d \
  --name rootx-llm \
  --device /dev/kfd \
  --device /dev/dri \
  --group-add video \
  --ipc=host \
  --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  -p ${PORT}:8000 \
  -v $(pwd)/${MODEL_PATH}:/model \
  rocm/vllm:latest \
  --model /model \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size ${GPU_COUNT} \
  --dtype float16 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.9

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ RootX LLM is running!"
echo "═══════════════════════════════════════════════"
echo ""
echo "  API Endpoint: http://localhost:${PORT}/v1"
echo ""
echo "  Test it:"
echo "    curl http://localhost:${PORT}/v1/chat/completions \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"model\": \"rootx-security-llm\", \"messages\": [{\"role\": \"user\", \"content\": \"Explain SQL injection\"}]}'"
echo ""
echo "  Add to backend/.env:"
echo "    LLM_API_URL=http://localhost:${PORT}/v1"
echo "    LLM_MODEL=rootx-security-llm"
echo ""
echo "  View logs:"
echo "    docker logs -f rootx-llm"
echo ""
echo "═══════════════════════════════════════════════"
