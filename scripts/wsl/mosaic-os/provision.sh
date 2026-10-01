#!/bin/bash
# Provisions the mosaic-os WSL distro (run as root by scripts/wsl/install-mosaic-os.ps1). Idempotent.
#   $1: this folder as Linux sees it (/mnt/c/.../scripts/wsl/mosaic-os)
#   APT_PROXY: the installer's relay through Windows, for networks that stall large packets inside WSL
set -euo pipefail
SRC="${1:?usage: provision.sh <path to scripts/wsl/mosaic-os>}"
export DEBIAN_FRONTEND=noninteractive

# WSL's NAT network has no IPv6 route, and apt would hang on the mirrors' IPv6 addresses.
echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99mosaic-ipv4
if [ -n "${APT_PROXY:-}" ]; then
  {
    echo "Acquire::http::Proxy \"$APT_PROXY\";"
    echo "Acquire::https::Proxy \"$APT_PROXY\";"
    echo 'Acquire::http::Pipeline-Depth "0";'
  } > /etc/apt/apt.conf.d/99mosaic-proxy
fi
if ! dpkg -s python3-fusepy libfuse2t64 fuse3 >/dev/null 2>&1; then
  apt-get -o Acquire::http::Timeout=30 update -qq
  apt-get install -y -qq --no-install-recommends python3 python3-fusepy fuse3 libfuse2t64 iproute2 ca-certificates sudo less nano curl >/dev/null
fi
rm -f /etc/apt/apt.conf.d/99mosaic-proxy

id mosaic >/dev/null 2>&1 || useradd -m -s /bin/bash -G sudo -c "mOSaic" mosaic
echo "mosaic ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/mosaic
chmod 0440 /etc/sudoers.d/mosaic

install -d /opt/mosaic /etc/mosaic
install -m 0644 "$SRC/mosaicos.py" /opt/mosaic/mosaicos.py
install -m 0755 "$SRC/orgfs.py" /opt/mosaic/orgfs.py
install -m 0755 "$SRC/mosaic" /usr/local/bin/mosaic
install -m 0644 "$SRC/mosaic-orgfs.service" /etc/systemd/system/mosaic-orgfs.service
install -m 0644 "$SRC/profile.sh" /etc/profile.d/zz-mosaic.sh
# Files checked out on Windows may carry CRLF endings.
sed -i 's/\r$//' /usr/local/bin/mosaic /opt/mosaic/*.py /etc/profile.d/zz-mosaic.sh /etc/systemd/system/mosaic-orgfs.service
install -d -o mosaic -g mosaic /org /home/mosaic/.config /home/mosaic/.config/mosaic
[ -f /etc/mosaic/env ] || printf '# MOSAIC_URL=http://<windows host>:8089   (found automatically when unset)\n' > /etc/mosaic/env
grep -q '^user_allow_other' /etc/fuse.conf 2>/dev/null || echo user_allow_other >> /etc/fuse.conf

cat > /etc/wsl.conf <<'CONF'
[boot]
systemd=true

[user]
default=mosaic

[network]
hostname=mosaic-os
generateHosts=true

[interop]
appendWindowsPath=false
CONF
grep -q "mosaic-os" /etc/hosts || echo "127.0.1.1 mosaic-os" >> /etc/hosts

# The desktop user's systemd manager runs from boot, so WSL finds it at the first login.
mkdir -p /var/lib/systemd/linger && touch /var/lib/systemd/linger/mosaic
# A lean OS: nothing here uses snaps.
systemctl disable snapd.service snapd.socket snapd.seeded.service >/dev/null 2>&1 || true
systemctl enable mosaic-orgfs.service >/dev/null 2>&1 \
  || ln -sf /etc/systemd/system/mosaic-orgfs.service /etc/systemd/system/multi-user.target.wants/mosaic-orgfs.service
echo "mosaic-os provisioned"
