#!/bin/sh
# Compacta CSS e JS da cópia do site que vai dentro do app (assets/web).
# O código-fonte (repositório justgo) continua legível; só a cópia sai enxuta.
# Precisa de esbuild e lightningcss em ~/.jgmin (npm i esbuild lightningcss-cli).
set -e
B="$HOME/.jgmin/node_modules/.bin"
W="$(dirname "$0")/../assets/web"
if [ ! -x "$B/esbuild" ] || [ ! -x "$B/lightningcss" ]; then echo "minify: ferramentas ausentes, publicando sem compactar"; exit 0; fi
before=$(cat "$W"/css/*.css "$W"/js/*.js | wc -c)
for f in "$W"/css/*.css; do "$B/lightningcss" --minify --targets 'chrome >= 90' "$f" -o "$f.min" && mv "$f.min" "$f"; done
for f in "$W"/js/*.js; do "$B/esbuild" "$f" --minify-whitespace --minify-syntax --target=chrome90 --log-level=error --outfile="$f.min" --allow-overwrite && mv "$f.min" "$f"; done
after=$(cat "$W"/css/*.css "$W"/js/*.js | wc -c)
echo "minify: $before -> $after bytes"
