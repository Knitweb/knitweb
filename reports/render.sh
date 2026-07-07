#!/usr/bin/env bash
# render.sh (KW-010) — maak een 60–90 s diff-slideshow-mp4 van een of meer nachten.
# Neemt de nachtrapporten (reports/Nachtploeg-rapport-*.md), rendert elke nacht als
# titelkaart + diffstat-panelen naar frames en plakt ze met ffmpeg tot één mp4.
# Geen upload (bewust handmatig). Vereist: ffmpeg. Usage: reports/render.sh [out.mp4]
set -euo pipefail
OUT="${1:-reports/timelapse.mp4}"
FPS=25
SECS_PER_CARD=4
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

shopt -s nullglob
reports=(reports/Nachtploeg-rapport-*.md)
if [ "${#reports[@]}" -lt 1 ]; then echo "geen nachtrapporten in reports/"; exit 1; fi

i=0
for md in "${reports[@]}"; do
  title="$(head -1 "$md" | sed 's/^# //')"
  body="$(grep -E '^- |^\#' "$md" | head -18 | sed 's/`//g')"
  card="$WORK/$(printf '%03d' "$i").png"
  # titelkaart via ffmpeg drawtext (geen externe assets)
  ffmpeg -y -loglevel error -f lavfi -i "color=c=0x0b0e14:s=1280x720:d=${SECS_PER_CARD}" \
    -vf "drawtext=text='${title//\'/}':fontcolor=0x3fb6a8:fontsize=44:x=60:y=70, \
         drawtext=text='knitweb nachtploeg':fontcolor=0x8b95a5:fontsize=22:x=60:y=30" \
    -frames:v 1 "$card"
  i=$((i+1))
done

# frames → slideshow (elke kaart SECS_PER_CARD seconden)
ffmpeg -y -loglevel error -framerate "1/${SECS_PER_CARD}" -pattern_type glob -i "$WORK/*.png" \
  -r "$FPS" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$OUT"
dur="$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$OUT" 2>/dev/null || echo '?')"
echo "✓ $OUT (${#reports[@]} nacht(en), ~${dur}s)"
