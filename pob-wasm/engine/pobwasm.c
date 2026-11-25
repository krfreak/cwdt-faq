// Minimal headless Lua 5.2 host for Path of Building, compiled to WebAssembly with Emscripten.
//
// Exposes two functions to JavaScript:
//   int pob_boot(const char *bootScript)       run a Lua file from the virtual filesystem
//   const char *pob_call(const char *fn, const char *arg)
//                                              call global fn(arg) -> string (valid until next call)
// and provides the native pieces PoB needs from its desktop runtime: lua-utf8 and a synchronous
// zlib Inflate().
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <zlib.h>

#include "lauxlib.h"
#include "lua.h"
#include "lualib.h"

int luaopen_utf8(lua_State *L);

static lua_State *L = NULL;

// Inflate(data) -> string | nil, err. Accepts zlib or gzip headers (windowBits 15 + 32), like PoB's runtime.
static int l_inflate(lua_State *L) {
  size_t len;
  const char *data = luaL_checklstring(L, 1, &len);
  z_stream s;
  memset(&s, 0, sizeof s);
  if (inflateInit2(&s, 15 + 32) != Z_OK) {
    lua_pushnil(L);
    lua_pushstring(L, "inflateInit failed");
    return 2;
  }
  s.next_in = (Bytef *)data;
  s.avail_in = (uInt)len;
  luaL_Buffer b;
  luaL_buffinit(L, &b);
  int rc;
  do {
    char *out = luaL_prepbuffsize(&b, 1 << 20);
    s.next_out = (Bytef *)out;
    s.avail_out = 1 << 20;
    rc = inflate(&s, Z_NO_FLUSH);
    if (rc != Z_OK && rc != Z_STREAM_END) {
      inflateEnd(&s);
      lua_pushnil(L);
      lua_pushfstring(L, "inflate error %d", rc);
      return 2;
    }
    luaL_addsize(&b, (1 << 20) - s.avail_out);
  } while (rc != Z_STREAM_END);
  inflateEnd(&s);
  luaL_pushresult(&b);
  return 1;
}

static int traceback(lua_State *L) {
  luaL_traceback(L, L, lua_tostring(L, 1), 1);
  return 1;
}

EMSCRIPTEN_KEEPALIVE int pob_boot(const char *bootScript) {
  L = luaL_newstate();
  luaL_openlibs(L);
  lua_getglobal(L, "package");
  lua_getfield(L, -1, "preload");
  lua_pushcfunction(L, luaopen_utf8);
  lua_setfield(L, -2, "lua-utf8");
  lua_pop(L, 2);
  lua_pushcfunction(L, l_inflate);
  lua_setglobal(L, "NativeInflate");

  lua_pushcfunction(L, traceback);
  if (luaL_loadfile(L, bootScript) != LUA_OK || lua_pcall(L, 0, 0, -2) != LUA_OK) {
    emscripten_log(EM_LOG_ERROR, "boot failed: %s", lua_tostring(L, -1));
    return 1;
  }
  lua_pop(L, 1);
  return 0;
}

EMSCRIPTEN_KEEPALIVE const char *pob_call(const char *fn, const char *arg) {
  static char *result = NULL;
  free(result);
  result = NULL;
  lua_pushcfunction(L, traceback);
  lua_getglobal(L, fn);
  lua_pushstring(L, arg);
  if (lua_pcall(L, 1, 1, -3) != LUA_OK) {
    const char *err = lua_tostring(L, -1);
    size_t n = strlen(err);
    result = malloc(n + 7);
    memcpy(result, "ERROR:", 6);
    memcpy(result + 6, err, n + 1);
  } else {
    size_t n;
    const char *s = lua_tolstring(L, -1, &n);
    result = malloc(n + 1);
    memcpy(result, s ? s : "", n + 1);
  }
  lua_pop(L, 2);
  return result;
}
