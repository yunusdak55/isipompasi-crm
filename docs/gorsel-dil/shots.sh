#!/bin/sh
# kullanim: ./shots.sh <klasor> [lite|reduce]  -> her ekran ayri tarayicida
for n in login panel login-mobil panel-mobil; do ONLY=$n node shot.mjs "$1" 4500 "$2" & P=$!; ( sleep 45; kill $P 2>/dev/null ) & W=$!; wait $P; kill $W 2>/dev/null; done
