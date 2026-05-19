#!/usr/bin/env bash
# Run once on a fresh Vultr Cloud GPU Ubuntu 24.04 instance.
# Installs NVIDIA driver, nvidia-container-toolkit, Docker, then brings up the
# kit-app-streaming stack defined in docker-compose.yml.
#
# Usage (executed by scripts/provision_gpu.py over SSH after instance boot):
#   NGC_API_KEY=nvapi-... bash setup-gpu-host.sh
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "must run as root" >&2
  exit 1
fi
: "${NGC_API_KEY:?NGC_API_KEY env var is required}"

echo "=== 1. NVIDIA driver ==="
if ! command -v nvidia-smi >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends \
    build-essential dkms linux-headers-$(uname -r) ubuntu-drivers-common
  ubuntu-drivers autoinstall
  echo "NVIDIA driver installed; rebooting in 5s. Re-run this script after reboot."
  sleep 5
  reboot
  exit 0
fi
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader

echo "=== 2. Docker + nvidia-container-toolkit ==="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
if ! dpkg -l nvidia-container-toolkit >/dev/null 2>&1; then
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb #deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] #g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update
  apt-get install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
fi

echo "=== 3. NGC login ==="
echo "${NGC_API_KEY}" | docker login nvcr.io -u '$oauthtoken' --password-stdin

echo "=== 4. Bring up stack ==="
cd /opt/omniverse
mkdir -p usd
# Drop a tiny sample USD scene so the viewport is not empty on first connect.
if [ ! -f usd/hello.usda ]; then
  cat > usd/hello.usda <<'USD'
#usda 1.0
(
    defaultPrim = "Hello"
    upAxis = "Y"
)
def Xform "Hello" {
    def Sphere "Sphere" {
        double radius = 1
        color3f[] primvars:displayColor = [(0.9, 0.5, 0.2)]
    }
}
USD
fi

docker compose pull
docker compose up -d
docker compose ps

echo "=== 5. TLS cert (Let's Encrypt) ==="
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot
fi
if [ ! -f /etc/letsencrypt/live/omniverse.qubitpage.com/fullchain.pem ]; then
  docker compose stop signaling || true
  certbot certonly --standalone -d omniverse.qubitpage.com \
    --non-interactive --agree-tos -m admin@qubitpage.com || true
  docker compose start signaling || true
fi

echo "=== done ==="
echo "Open https://omniverse.qubitpage.com/healthz to verify."
