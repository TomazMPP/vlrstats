#!/usr/bin/env bash
# One-time server prep (idempotent). Run as root:
#   ssh brasil-root 'bash -s' < deploy/setup.sh
set -euo pipefail
APP=/srv/vlrstats
id vlrstats >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin vlrstats
mkdir -p "$APP/releases" "$APP/shared/data"
[ -d "$APP/repo.git" ] || git init -q --bare -b main "$APP/repo.git"
git config --global --get-all safe.directory | grep -qx "$APP/repo.git" || git config --global --add safe.directory "$APP/repo.git"
[ -f "$APP/shared/.env" ] || printf 'HENRIK_API_KEY=\nPORT=3260\nDB_PATH=%s/shared/data/vlrstats.db\n' "$APP" > "$APP/shared/.env"
chown vlrstats:vlrstats "$APP" "$APP/releases"
chown -R vlrstats:vlrstats "$APP/shared"
chmod 750 "$APP"; chmod 700 "$APP/shared/data"; chmod 600 "$APP/shared/.env"
# pm2 of its own, started by systemd unit pm2-vlrstats
if [ ! -f /etc/systemd/system/pm2-vlrstats.service ]; then
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u vlrstats --hp "$APP" >/dev/null
  systemctl enable --now pm2-vlrstats >/dev/null
fi
echo "setup ok"
