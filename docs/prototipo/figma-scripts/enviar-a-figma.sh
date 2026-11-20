#!/usr/bin/env bash
# enviar-a-figma.sh <submitUrl> <archivo.html>
# Envía un HTML capturado con capturar-pagina.js a Figma (html_to_figma).
# La submitUrl es de un solo uso: pide una nueva a Claude por cada página.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Uso: $0 <submitUrl> <archivo.html>" >&2
  exit 1
fi

curl -f -X POST "$1" -H "Content-Type: text/html" --data-binary @"$2"
echo
