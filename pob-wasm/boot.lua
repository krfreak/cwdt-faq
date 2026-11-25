-- Boot script for Path of Building on Lua 5.2 (WebAssembly).
--
-- PoB is written for LuaJIT. This file adds what LuaJIT has and Lua 5.2 lacks, then loads PoB
-- headless and defines pobcheck_extract(xml) -> JSON for the JavaScript side.
-- Virtual filesystem layout: /pob = PoB checkout (src/, runtime/), /pobcheck = extract.lua.

-- ---- LuaJIT compatibility ----
unpack = unpack or table.unpack
loadstring = loadstring or load

local function tobit(v)
	v = v % 0x100000000
	return v >= 0x80000000 and v - 0x100000000 or v
end
-- LuaJIT's bit library returns signed 32-bit results, bit32 unsigned ones.
bit = {
	tobit = tobit,
	band = function(...) return tobit(bit32.band(...)) end,
	bor = function(...) return tobit(bit32.bor(...)) end,
	bxor = function(...) return tobit(bit32.bxor(...)) end,
	bnot = function(a) return tobit(bit32.bnot(a)) end,
	lshift = function(a, n) return tobit(bit32.lshift(a, n)) end,
	rshift = function(a, n) return tobit(bit32.rshift(a, n)) end,
	arshift = function(a, n) return tobit(bit32.arshift(a, n)) end,
	rol = function(a, n) return tobit(bit32.lrotate(a, n)) end,
	ror = function(a, n) return tobit(bit32.rrotate(a, n)) end,
	tohex = function(a, n) return string.format("%0" .. (n or 8) .. "x", a % 0x100000000) end,
}
package.loaded.bit = bit
-- Lua 5.2 validates io.open modes strictly ("wb+" is rejected, "w+b" accepted); LuaJIT does not.
local rawOpen = io.open
function io.open(path, mode)
	if mode then
		mode = mode:gsub("b", "") .. (mode:find("b", 1, true) and "b" or "")
	end
	return rawOpen(path, mode)
end
jit = { version = "Lua 5.2 (wasm)", opt = { start = function() end, stop = function() end } }
package.loaded.jit = jit

-- PoB's LuaJIT fork accepts syntax extensions Lua 5.2 cannot parse: compound assignments
-- (a ..= b) and optional chaining (x?.y, x?.:m()). They only appear in a few files, so a file is
-- rewritten only when it fails to parse; files that parse are never touched (a blind rewrite could
-- corrupt string patterns). Optional chaining becomes plain indexing: the files using it are UI
-- features (trade search) that never run headless, they only need to parse.
local function rewriteLuaJITSyntax(src)
	local function expand(indent, target, op)
		return "\n" .. indent .. target .. " = " .. target .. " " .. op .. " "
	end
	src = ("\n" .. src):gsub("\n([ \t]*)([%w_%.:%[%]\"']+)[ \t]*(%.%.)=[ \t]", expand)
	src = src:gsub("\n([ \t]*)([%w_%.:%[%]\"']+)[ \t]*([%+%-%*/])=[ \t]", expand)
	src = src:gsub("%?%.:", ":"):gsub("%?%.", ".")
	return src:sub(2)
end

local rawLoadfile = loadfile
function loadfile(path, mode, env)
	local f, err = io.open(path, "rb")
	if not f then
		return rawLoadfile(path, mode, env)
	end
	local src = f:read("*a")
	f:close()
	-- Like the native loader, ignore a first line starting with '#' (PoB files start with "#@")
	if src:sub(1, 1) == "#" then
		src = "--" .. src
	end
	-- dkjson does `local _ENV = nil` to forbid globals on Lua 5.2; on LuaJIT that is an ordinary
	-- unused local, and PoB's copy of dkjson relies on globals afterwards.
	src = src:gsub("local%s+_ENV%s*=%s*nil", "local _ENV_LuaJIT_unused = nil")
	local fn, loadErr = load(src, "@" .. path, mode, env or _G)
	if fn then
		return fn
	end
	local rewritten = load(rewriteLuaJITSyntax(src), "@" .. path, mode, env or _G)
	if rewritten then
		print("Rewrote LuaJIT-only syntax in " .. path)
		return rewritten
	end
	return nil, loadErr
end
function dofile(path)
	local f = assert(loadfile(path))
	return f()
end
-- require() reads files natively; route Lua modules through loadfile as well.
table.insert(package.searchers, 2, function(name)
	local path, err = package.searchpath(name, package.path)
	if not path then
		return err
	end
	return assert(loadfile(path)), path
end)

-- ---- load PoB ----
-- The standalone interpreter defines the command line arguments; PoB's Main.lua reads them.
arg = {}
package.path = "/pob/runtime/lua/?.lua;/pob/runtime/lua/?/init.lua;/pob/src/?.lua;" .. package.path

local logBuffer = {}
-- Timeless jewel lookup tables PoB tried to read but did not find (it logs "Missing LUT: <type>").
local missingLUTs = {}
print = function(...)
	local parts = {}
	for i = 1, select("#", ...) do
		parts[i] = tostring((select(i, ...)))
	end
	local line = table.concat(parts, "\t")
	-- Reported with the type label ("Brutal Restraint") when a lookup misses, or with the file name
	-- ("BrutalRestraint") when the data file is absent, in which case PoB also raises an error.
	local lut = line:match("^Missing LUT: (.+)$") or line:match("^Failed to load jewel data: (.+)$")
	if lut then
		missingLUTs[(lut:gsub("%s+", ""))] = true
	end
	logBuffer[#logBuffer + 1] = line
	if #logBuffer > 200 then
		table.remove(logBuffer, 1)
	end
end

dofile("HeadlessWrapper.lua")
Inflate = NativeInflate

local json = require("dkjson")
local extract = dofile("/pobcheck/extract.lua")

-- Returns JSON: { facts } on success, { needs = { "BrutalRestraint", ... } } (type names without
-- spaces) when the build uses timeless jewels whose lookup tables are not in the virtual filesystem
-- yet (the caller fetches them and calls again), or { error, prompt, log }.
function pobcheck_extract(xml)
	missingLUTs = {}
	-- A previous build's error leaves PoB's error popup set; clear it so errors belong to this build
	if __mainObject__ then
		__mainObject__.promptMsg = nil
	end
	local ok, facts = pcall(extract, xml)
	local response
	if next(missingLUTs) then
		local needs = {}
		for name in pairs(missingLUTs) do
			needs[#needs + 1] = name
		end
		table.sort(needs)
		response = { needs = needs }
	elseif ok then
		response = { facts = facts }
	else
		response = { error = tostring(facts), prompt = __mainObject__ and __mainObject__.promptMsg, log = table.concat(logBuffer, "\n") }
	end
	local out = json.encode(response)
	collectgarbage("collect")
	return out
end

function pobcheck_log()
	return table.concat(logBuffer, "\n")
end
