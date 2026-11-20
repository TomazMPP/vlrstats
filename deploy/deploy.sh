#!/usr/bin/env bash
# Deploy:   git push brasil main && ssh brasil-root 'bash -s' < deploy/deploy.sh
# Rollback: ssh brasil-root 'bash -s' -- --rollback < deploy/deploy.sh
set -euo pipefail
APP=/srv/vlrstats
as_app() { sudo -u vlrstats -H env PM2_HOME="$APP/.pm2" "$@"; }
health() { for _ in $(seq 1 20); do curl -fsS -o /dev/null http://127.0.0.1:3260/ && return 0; sleep 1; done; return 1; }
start() { ln -sfn "$1" "$APP/current"; as_app pm2 delete vlrstats >/dev/null 2>&1 || true; as_app pm2 start "$1/deploy/ecosystem.config.cjs" >/dev/null; as_app pm2 save >/dev/null; }

prev=$(readlink -f "$APP/current" 2>/dev/null || true)
if [ "${1:-}" = "--rollback" ]; then
  target=$(ls -1d "$APP"/releases/*/ | sed 's|/$||' | sort | grep -B1 -x "$prev" | head -1)
  [ -n "$target" ] && [ "$target" != "$prev" ] || { echo "no previous release"; exit 1; }
  start "$target"; health && echo "rolled back to $target"; exit
fi

sha=$(git --git-dir="$APP/repo.git" rev-parse --short=12 main)
rel="$APP/releases/$(date +%Y%m%d-%H%M%S)-$sha"
as_app mkdir -p "$rel"
git --git-dir="$APP/repo.git" archive main | as_app tar -x -C "$rel"
cd "$rel"
as_app npm ci --no-audit --no-fund --loglevel=error
as_app npm run build --silent
as_app npm prune --omit=dev --no-audit --no-fund --loglevel=error

if [ ! -f /etc/nginx/sites-available/vlrstats.lol ]; then
  install -m 644 deploy/nginx.conf /etc/nginx/sites-available/vlrstats.lol
  ln -sf /etc/nginx/sites-available/vlrstats.lol /etc/nginx/sites-enabled/vlrstats.lol
  nginx -t && systemctl reload nginx
fi

start "$rel"
if ! health; then
  echo "health check failed"; as_app pm2 logs vlrstats --lines 30 --nostream || true
  [ -n "$prev" ] && start "$prev" && echo "reverted to $prev"
  exit 1
fi
ls -1d "$APP"/releases/*/ | sort | head -n -5 | xargs -r rm -rf
echo "deployed $sha"
