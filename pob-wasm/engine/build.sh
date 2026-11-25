#!/bin/sh
# Builds the WebAssembly engine for the PoB checker: Lua 5.2 + lua-utf8 + zlib, with the small C host
# in pobwasm.c. Output goes to dist/ and is committed, so deploying does not need this script.
#
# Needs Docker (runs Emscripten from its official image) and network access.
#   sh pob-wasm/engine/build.sh
set -eu

EMSDK_IMAGE="emscripten/emsdk:7.0.1"
LUA_VERSION="5.2.4"
LUA_SHA256="b9e2e4aad6789b3b63a056d442f7b39f0ecfca3ae0f1fc0ae4e9614401b69f4b"
LUAUTF8_REPO="https://github.com/starwing/luautf8.git"
LUAUTF8_COMMIT="a845c5b7f89995b7e1f10e34608fd2fa37ea9d87"

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching Lua $LUA_VERSION"
curl -sSfL "https://www.lua.org/ftp/lua-$LUA_VERSION.tar.gz" -o "$WORK/lua.tar.gz"
echo "$LUA_SHA256  $WORK/lua.tar.gz" | sha256sum -c -
tar -xzf "$WORK/lua.tar.gz" -C "$WORK"
mv "$WORK/lua-$LUA_VERSION" "$WORK/lua"
patch -d "$WORK/lua" -p1 < "$HERE/lstrlib-format.patch"

echo "Fetching lua-utf8 $LUAUTF8_COMMIT"
git init -q "$WORK/luautf8"
git -C "$WORK/luautf8" fetch -q --depth 1 "$LUAUTF8_REPO" "$LUAUTF8_COMMIT"
git -C "$WORK/luautf8" checkout -q FETCH_HEAD

cp "$HERE/pobwasm.c" "$WORK/"
mkdir -p "$WORK/out"

# LUA_COMPAT_ALL: unpack, loadstring, math.pow and other Lua 5.1 functions PoB (LuaJIT) uses.
# LUA_USELONGLONG: 64-bit %d in string.format, like LuaJIT (long is 32-bit on wasm32).
cat > "$WORK/emcc.sh" <<'EOF'
set -eu
cd /work
SRCS=$(ls lua/src/*.c | grep -v -e '/lua.c$' -e '/luac.c$')
emcc -O3 -flto -DLUA_COMPAT_ALL -DLUA_USELONGLONG -sUSE_ZLIB=1 -Ilua/src \
  $SRCS luautf8/lutf8lib.c pobwasm.c \
  -o out/pobwasm.mjs \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=4GB -sINITIAL_MEMORY=64MB -sSTACK_SIZE=8MB \
  -sFORCE_FILESYSTEM=1 -lnodefs.js \
  -sEXPORTED_FUNCTIONS=_pob_boot,_pob_call \
  -sEXPORTED_RUNTIME_METHODS=ccall,FS,NODEFS,HEAP8
EOF

echo "Compiling with $EMSDK_IMAGE"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$WORK:/work" "$EMSDK_IMAGE" sh /work/emcc.sh

mkdir -p "$HERE/dist"
cp "$WORK/out/pobwasm.mjs" "$WORK/out/pobwasm.wasm" "$HERE/dist/"
echo "Engine written to $HERE/dist"
