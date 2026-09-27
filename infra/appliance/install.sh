#!/usr/bin/env bash
# mOSaic appliance installer (P4). Idempotent: safe to re-run.
# Prerequisite (manual, see README.md): Ubuntu 24.04, NVIDIA open driver installed and `nvidia-smi` working,
# /sovereign-data mounted from its own ext4 partition via fstab.
#
#   sudo REPO_URL=https://github.com/Kamalllx/mOSaic bash infra/appliance/install.sh
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/Kamalllx/mOSaic}
BRANCH=${BRANCH:-main}
APP=/opt/mosaic
DATA=/sovereign-data
SVC_USER=mosaic
COMPOSE=(docker compose -f "$APP/infra/compose/docker-compose.yml" -f "$APP/infra/compose/docker-compose.gpu.yml")

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
as_user() { sudo -u "$SVC_USER" -H bash -lc "$*"; }

[[ $EUID -eq 0 ]] || { echo "run with sudo"; exit 1; }
command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null || { echo "nvidia-smi fails: install the NVIDIA open driver first (README.md)"; exit 1; }
mountpoint -q "$DATA" || { echo "$DATA is not a mount point: add the partition to /etc/fstab first (README.md)"; exit 1; }

step "base packages"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git jq ufw python3

step "Docker Engine + compose plugin (official repo)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

step "NVIDIA Container Toolkit"
if ! command -v nvidia-ctk >/dev/null; then
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update -qq
  apt-get install -y -qq nvidia-container-toolkit
fi
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi >/dev/null && echo "GPU visible inside containers"

step "service user + data layout"
id "$SVC_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$SVC_USER"
usermod -aG docker "$SVC_USER"
for d in okf raw indexes memory agents runs audit policies artifacts; do install -d -o "$SVC_USER" -g "$SVC_USER" "$DATA/$d"; done
chown "$SVC_USER:$SVC_USER" "$DATA"

step "repo + Python env in $APP"
if [[ ! -d $APP/.git ]]; then
  install -d -o "$SVC_USER" -g "$SVC_USER" "$APP"
  as_user "git clone --branch $BRANCH $REPO_URL $APP"
fi
as_user "command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh"
as_user "cd $APP && ~/.local/bin/uv sync --all-packages --extra ingest --python 3.12"
if [[ ! -f $APP/.env ]]; then
  as_user "cd $APP && cp .env.example .env"
  sed -i -e 's|^MOSAIC_DATA_DIR=.*|MOSAIC_DATA_DIR=/sovereign-data|' \
         -e 's|^MOSAIC_OKF_DIR=.*|MOSAIC_OKF_DIR=./data/okf|' \
         -e 's|^MOSAIC_DEFAULT_MODE=.*|MOSAIC_DEFAULT_MODE=real|' "$APP/.env"
  grep -q '^OLLAMA_VERSION=' "$APP/.env" || echo "OLLAMA_VERSION=${OLLAMA_VERSION:-latest}" >> "$APP/.env"
fi
# systemd's EnvironmentFile keeps inline "# comments" as part of the value: strip them
sed -i -E '/^[A-Za-z_][A-Za-z0-9_]*=/ s/[[:space:]]+#.*$//' "$APP/.env"
for bin in "$APP"/.venv/bin/ai-* "$APP/.venv/bin/mosaicd" "$APP/.venv/bin/mosaic-okf"; do
  [[ -e $bin ]] && ln -sf "$bin" "/usr/local/bin/$(basename "$bin")"
done

step "compose services"
set -a; . "$APP/.env"; set +a
"${COMPOSE[@]}" up -d --wait postgres redis ollama mock-jira vendor-docs

step "models from models/models.yaml"
MODELS=$("$APP/.venv/bin/python" - "$APP/models/models.yaml" <<'PY'
import sys, yaml
c = yaml.safe_load(open(sys.argv[1]))
names = {c["embedding"], c["default"], c.get("latency_critical") or c["default"], *(c.get("by_task_class") or {}).values()}
print(" ".join(sorted(names)))
PY
)
for m in $MODELS; do "${COMPOSE[@]}" exec -T ollama ollama pull "$m"; done

step "sandbox images"
docker build -t mosaic/sandbox-base:latest "$APP/execution/images/sandbox-base"
docker build -t mosaic/sandbox-browser:latest "$APP/execution/images/sandbox-browser"

step "web console build"
if [[ -f $APP/apps/web/package.json ]]; then
  command -v npm >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; apt-get install -y -qq nodejs; }
  as_user "cd $APP/apps/web && npm ci && npm run build"
  WEB=1
else
  echo "apps/web not bootstrapped yet (P2): skipping mosaic-web.service"; WEB=0
fi

step "systemd units"
install -m 0644 "$APP/infra/systemd/mosaicd.service" /etc/systemd/system/mosaicd.service
install -m 0644 "$APP/infra/systemd/mosaic-web.service" /etc/systemd/system/mosaic-web.service
systemctl daemon-reload
systemctl enable --now mosaicd
[[ $WEB == 1 ]] && systemctl enable --now mosaic-web

step "laptop-as-server hardening"
install -d /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/mosaic.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
command -v powerprofilesctl >/dev/null && powerprofilesctl set performance || true
# a driver update mid-event breaks NVML ("Driver/library version mismatch") until reboot
dpkg-query -W -f='${Package}\n' 'nvidia-*' 'libnvidia-*' 2>/dev/null | xargs -r apt-mark hold >/dev/null || true
systemctl disable --now unattended-upgrades 2>/dev/null || true
echo "logind change applies after reboot (or: systemctl restart systemd-logind, which ends the desktop session)"

step "network: Tailscale + firewall"
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow in on tailscale0
ufw --force enable
install -m 0755 "$APP/infra/appliance/99-mosaic-motd" /etc/update-motd.d/99-mosaic

step "done"
echo "Next: sudo tailscale up   (then open http://<node>:3000 from a teammate's laptop)"
echo "Check: bash $APP/scripts/preflight.sh"
