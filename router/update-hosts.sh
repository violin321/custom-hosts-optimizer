#!/bin/sh
set -u
URL="https://custom-hosts-optimizer.violinproxy.workers.dev/hosts"
OUT="/etc/custom-hosts-optimizer.hosts"
ETAG="/etc/custom-hosts-optimizer.etag"
exec 9>/var/lock/custom-hosts-update.lock
flock -n 9 || { echo "another update is running"; exit 0; }
TMP=$(mktemp /tmp/custom-hosts-update.XXXXXX) || exit 1
trap 'rm -f "$TMP" "$TMP.old" "$TMP.dhcp" "$TMP.etag"' EXIT
needs_registration=0
uci -q get dhcp.@dnsmasq[0].addnhosts | tr ' ' '\n' | grep -qxF "$OUT" || needs_registration=1
[ -f "$ETAG" ] || : > "$ETAG"
# Missing local file or registration requires a full response to repair it.
[ -f "$OUT" ] && [ "$needs_registration" -eq 0 ] || : > "$ETAG"
CODE=$(curl -fsSL --connect-timeout 5 --max-time 20 --retry 1 --retry-delay 1 --retry-max-time 30 --max-filesize 1048576 --etag-compare "$ETAG" --etag-save "$TMP.etag" -w '%{http_code}' "$URL" -o "$TMP") || {
  echo "download failed; existing hosts preserved"
  exit 1
}
if [ "$CODE" = 304 ]; then
  echo "HTTP 304; download and DNS reload skipped"
  exit 0
fi
[ "$CODE" = 200 ] || { echo "unexpected HTTP response; existing hosts preserved"; exit 1; }
lua /usr/libexec/validate-custom-hosts.lua "$TMP" || {
  echo "invalid hosts; existing hosts preserved"
  exit 1
}
hosts_records() {
  awk '{ sub(/#.*/, ""); if (NF) { $1=$1; print } }' "$1" | LC_ALL=C sort
}
if [ -f "$OUT" ] && [ "$(hosts_records "$TMP")" = "$(hosts_records "$OUT")" ] && [ "$needs_registration" -eq 0 ]; then
  [ ! -s "$TMP.etag" ] || cp "$TMP.etag" "$ETAG"
  echo "unchanged; DNS reload skipped"
  exit 0
fi
[ ! -f "$OUT" ] || cp -p "$OUT" "$TMP.old"
cp -p /etc/config/dhcp "$TMP.dhcp"
cp "$TMP" "$OUT.new" && chmod 644 "$OUT.new" && mv -f "$OUT.new" "$OUT" || exit 1
if [ "$needs_registration" -eq 1 ]; then
  uci add_list dhcp.@dnsmasq[0].addnhosts="$OUT"
  uci commit dhcp
fi
if ! /etc/init.d/dnsmasq reload; then
  [ ! -f "$TMP.old" ] || cp -p "$TMP.old" "$OUT"
  cp -p "$TMP.dhcp" /etc/config/dhcp
  /etc/init.d/dnsmasq reload
  echo "DNS reload failed; rolled back"
  exit 1
fi
[ ! -s "$TMP.etag" ] || cp "$TMP.etag" "$ETAG"
echo "updated hosts; unrelated addnhosts preserved"
