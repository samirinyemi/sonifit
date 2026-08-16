#!/bin/bash
# Re-cut every collection photograph to the exact aspect ratio of the frame it
# sits in.
#
# Why: the hover crossing is a WebGL shader. If the texture and the frame do not
# share an aspect ratio, the shader has to carry a "cover" fit — extra uniforms,
# extra maths, and a UV space that is no longer 0-1. Cropping at build time
# instead means the shader samples a plain 0-1 UV and the markup stays a plain
# `object-fit: cover`, which is also exactly what the no-WebGL fallback needs.
#
# The frame ratio is identical at every breakpoint: above 1280 the frame is
# `--w * --u` by `--h * --u`, below it the frame is `aspect-ratio: --w / --h`.
# So one crop per photograph covers every viewport.
#
# Source of truth is the untouched Figma export in ../../Collection images.
# Frame sizes are read straight out of index.html, so they can never drift from
# the markup.
#
# Usage:  site/tools/crop-products.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
site="$(dirname "$here")"
src="$(dirname "$site")/Collection images"
out="$site/assets/products"

# Longest side of the written file. Covers a 2x display at the widest frame
# without shipping a 2MB texture.
MAX=1200

if [ ! -d "$src" ]; then
  echo "missing source folder: $src" >&2
  exit 1
fi

# name<TAB>w<TAB>h, one line per product, pulled from the markup.
pairs="$(awk '
  match($0, /--w:[0-9]+;--h:[0-9]+/) {
    spec = substr($0, RSTART, RLENGTH)
    split(spec, a, /[^0-9]+/)
    w = a[2]; h = a[3]
    next
  }
  /product__img" src="assets\/products\// {
    match($0, /products\/[^"]+\.jpg/)
    f = substr($0, RSTART + 9, RLENGTH - 9)
    sub(/\.jpg$/, "", f)
    if (w) print f "\t" w "\t" h
    w = 0
  }
' "$site/index.html")"

if [ -z "$pairs" ]; then
  echo "no products found in index.html" >&2
  exit 1
fi

# jpg basename -> original PNG basename. The exports are title-cased with
# spaces; the shipped files are slugs.
original() {
  case "$1" in
    1-22-short)        echo "1.22 Short" ;;
    1500-bra)          echo "1500 Bra" ;;
    dawn-half-zip)     echo "Dawn Half-Zip" ;;
    escarpment-shell)  echo "Escarpment Shell" ;;
    heat-tee)          echo "Heat Tee" ;;
    lane-cap)          echo "Lane Cap" ;;
    lane-singlet)      echo "Lane Singlet" ;;
    season-short)      echo "Season Short" ;;
    sightline)         echo "Sightline" ;;
    split-sock)        echo "Split Sock" ;;
    the-straight)      echo "The Straight" ;;
    *)                 echo "" ;;
  esac
}

cut_one() {
  local input="$1" target="$2" w="$3" h="$4"

  local sw sh
  sw="$(sips -g pixelWidth "$input" | awk '/pixelWidth/{print $2}')"
  sh="$(sips -g pixelHeight "$input" | awk '/pixelHeight/{print $2}')"

  # Centre crop to the frame ratio: shave whichever axis is proportionally long.
  local cw ch
  read -r cw ch <<EOF
$(awk -v sw="$sw" -v sh="$sh" -v w="$w" -v h="$h" 'BEGIN {
  want = w / h
  have = sw / sh
  if (have > want) { print int(sh * want + 0.5), sh }
  else             { print sw, int(sw / want + 0.5) }
}')
EOF

  # Crop stays in PNG (sips warns if a lossless crop is written to a .jpg
  # name), then one resample writes the shipped JPEG.
  local tmp="${TMPDIR:-/tmp}/sonifit-crop.png"
  sips -c "$ch" "$cw" "$input" --out "$tmp" >/dev/null
  sips -Z "$MAX" -s format jpeg -s formatOptions 72 "$tmp" --out "$target" >/dev/null
  rm -f "$tmp"
}

printf '%s\n' "$pairs" | while IFS="$(printf '\t')" read -r name w h; do
  base="$(original "$name")"
  if [ -z "$base" ]; then
    echo "no original mapped for $name — skipped" >&2
    continue
  fi

  for variant in "" "_Hover"; do
    input="$src/$base$variant.png"
    suffix=""
    [ -n "$variant" ] && suffix="-hover"
    target="$out/$name$suffix.jpg"

    if [ ! -f "$input" ]; then
      echo "missing $input — skipped" >&2
      continue
    fi

    cut_one "$input" "$target" "$w" "$h"
    echo "$name$suffix.jpg  ${w}:${h}"
  done
done
