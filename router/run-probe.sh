#!/bin/sh
# Lock is released automatically on process exit; prevents overlapping cron runs.
exec 9>/var/lock/custom-hosts-probe.lock
flock -n 9 || exit 0
umask 077
lua /usr/libexec/custom-hosts-probe.lua
