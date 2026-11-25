-- CWDT PoB checker: extraction of the numbers Path of Building calculates for a build.
--
-- Runs inside Path of Building's Lua (see boot.lua), after PoB is loaded headless, and returns the
-- extract function: extract(xmlText) -> facts table. The CWDT-specific judgement lives in
-- shared/utils/pobAnalysis.ts.
--
-- Globals such as build, calcLib, itemLib, main, launch, loadBuildFromXML and runCallback are
-- defined by PoB at runtime, which the language server cannot see.
---@diagnostic disable: undefined-global

local FLASK_SLOTS = { "Flask 1", "Flask 2", "Flask 3", "Flask 4", "Flask 5" }
local WICKERMAN_SLOTS = { Head = true, Body = true, Arm = true, Leg = true }

local function recalc()
	build.buildFlag = true
	runCallback("OnFrame")
end

local function num(v)
	if type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge then
		return v
	end
	return nil
end

-- Resolved text of an item's active mod lines: variant-filtered, ranges and catalyst scaling applied,
-- the same way PoB's own tooltips render them.
local function itemLines(item)
	local lines = {}
	local groups = { item.enchantModLines, item.scourgeModLines, item.implicitModLines, item.explicitModLines, item.crucibleModLines }
	for _, group in ipairs(groups) do
		for _, ml in ipairs(group or {}) do
			if not ml.disabled and item:CheckModLineVariant(ml) then
				local ok, line = pcall(itemLib.applyRange, ml.line, ml.range or main.defaultItemAffixQuality or 0.5, ml.valueScalar or 1)
				lines[#lines + 1] = ok and line or ml.line
			end
		end
	end
	return lines
end

local function itemInfo(slotName, item)
	return {
		slot = slotName,
		name = item.title or item.name,
		baseName = item.baseName,
		type = item.type,
		rarity = item.rarity,
		lines = itemLines(item),
	}
end

local function extract(xmlText)
	loadBuildFromXML(xmlText, "check")
	if not build or not build.calcsTab or not build.calcsTab.mainOutput then
		error("Path of Building could not load this build")
	end
	local itemsTab = build.itemsTab
	local spec = build.spec
	local treeVersion = spec.treeVersion or ""
	local wickermanActive = treeVersion:find("3_30") ~= nil

	-- The FAQ's PoB setup says to tick all flasks; the loop keeps every flask up permanently.
	-- Unticked flasks make PoB report ward and chaos resistance without their effects.
	local flasksForced = {}
	for _, slotName in ipairs(FLASK_SLOTS) do
		local slot = itemsTab.slots[slotName]
		if slot and slot.selItemId ~= 0 and itemsTab.items[slot.selItemId] and not slot.active then
			slot.active = true
			if itemsTab.activeItemSet and itemsTab.activeItemSet[slotName] then
				itemsTab.activeItemSet[slotName].active = true
			end
			flasksForced[#flasksForced + 1] = slotName
		end
	end
	-- No recalculation here: the per-skill calculations below include the flask change.

	local facts = {
		pobVersion = launch and launch.versionNumber or "?",
		treeVersion = treeVersion,
		className = build.spec.curClassName,
		ascendClassName = build.spec.curAscendClassName,
		characterLevel = build.characterLevel,
		pantheonMajor = build.pantheonMajorGod,
		pantheonMinor = build.pantheonMinorGod,
		flasksForced = flasksForced,
		groups = {},
		items = {},
		flasks = {},
		allocated = {},
		masteryEffects = {},
	}

	-- Passive tree: keystones, notables and ascendancy nodes by name; mastery effect ids.
	for _, node in pairs(spec.allocNodes) do
		if node.type == "Keystone" or node.type == "Notable" or node.ascendancyName then
			facts.allocated[#facts.allocated + 1] = node.dn or node.name
		end
	end
	table.sort(facts.allocated)
	for _, effectId in pairs(spec.masterySelections or {}) do
		facts.masteryEffects[#facts.masteryEffects + 1] = effectId
	end
	-- Pantheon: every power of the chosen gods, and whether PoB could parse it (PantheonTools only
	-- applies parsed powers; conditional ones like "per enemy within 6 metres" are skipped).
	facts.pantheon = {}
	for _, choice in ipairs({ { slot = "major", id = build.pantheonMajorGod }, { slot = "minor", id = build.pantheonMinorGod } }) do
		local god = choice.id and choice.id ~= "None" and data.pantheons[choice.id]
		if god then
			local powers = {}
			for _, soul in ipairs(god.souls or {}) do
				for _, soulMod in ipairs(soul.mods or {}) do
					local modList, extra = modLib.parseMod(soulMod.line)
					powers[#powers + 1] = { soul = soul.name, line = soulMod.line, applied = (modList ~= nil and #modList > 0 and not extra) }
				end
			end
			facts.pantheon[#facts.pantheon + 1] = { slot = choice.slot, id = choice.id, name = god.souls[1] and god.souls[1].name or choice.id, powers = powers }
		end
	end
	-- Tattoos and Runegrafts replace tree nodes (PassiveSpec hashOverrides). PoB already includes
	-- their stats in its numbers; pass name and stat lines on for the text-based checks.
	facts.treeOverrides = {}
	for nodeId, override in pairs(spec.hashOverrides or {}) do
		if spec.allocNodes[nodeId] then
			local lines = {}
			for _, line in ipairs(override.sd or {}) do
				lines[#lines + 1] = line
			end
			facts.treeOverrides[#facts.treeOverrides + 1] = { node = nodeId, name = override.dn, lines = lines }
		end
	end
	table.sort(facts.treeOverrides, function(a, b) return a.node < b.node end)

	-- Equipped items (including weapon swap) and socketed jewels.
	for _, slot in ipairs(itemsTab.orderedSlots) do
		local slotName = slot.slotName
		local item = slot.selItemId ~= 0 and itemsTab.items[slot.selItemId]
		local isWickerman = WICKERMAN_SLOTS[slotName]
		if item and not slot.nodeId and (not isWickerman or wickermanActive) then
			facts.items[#facts.items + 1] = itemInfo(slotName, item)
		end
	end
	-- Kalandra's Touch reflects the opposite ring. PoB copies that ring's mods into its calculations
	-- (CalcSetup), so the numbers above already include them; mirror it in the item text so the
	-- text-based checks (e.g. counting Heartbound Loops) see the reflected ring too.
	local ringInfo = {}
	for _, info in ipairs(facts.items) do
		if info.slot == "Ring 1" or info.slot == "Ring 2" then
			ringInfo[info.slot] = info
		end
	end
	for slotName, info in pairs(ringInfo) do
		local other = ringInfo[slotName == "Ring 1" and "Ring 2" or "Ring 1"]
		if info.name:match("^Kalandra's Touch") and other and not other.name:match("^Kalandra's Touch") then
			info.reflects = other.name
			for _, line in ipairs(other.lines) do
				info.lines[#info.lines + 1] = line
			end
		end
	end
	for nodeId, itemId in pairs(spec.jewels or {}) do
		local item = itemsTab.items[itemId]
		if item and spec.allocNodes[nodeId] then
			facts.items[#facts.items + 1] = itemInfo("Jewel " .. nodeId, item)
		end
	end

	-- Socket groups: gems as entered, plus effective levels/quality as PoB computes them.
	local interesting = {}
	for gi, group in ipairs(build.skillsTab.socketGroupList) do
		local g = { index = gi, slot = group.slot, label = group.label, enabled = group.enabled ~= false, gems = {}, skills = {} }
		for _, gem in ipairs(group.gemList) do
			g.gems[#g.gems + 1] = {
				name = gem.nameSpec,
				level = gem.level,
				quality = gem.quality,
				enabled = gem.enabled ~= false,
				support = gem.gemData and gem.gemData.grantedEffect and gem.gemData.grantedEffect.support or false,
			}
		end
		for si, activeSkill in ipairs(group.displaySkillList or {}) do
			local supports, hasCwdt = {}, false
			for _, effect in ipairs(activeSkill.effectList) do
				if effect ~= activeSkill.activeEffect then
					supports[#supports + 1] = { name = effect.grantedEffect.name, level = effect.level, quality = effect.quality }
					if effect.grantedEffect.name == "Cast when Damage Taken" then
						hasCwdt = true
					end
				end
			end
			local s = {
				name = activeSkill.activeEffect.grantedEffect.name,
				level = activeSkill.activeEffect.level,
				quality = activeSkill.activeEffect.quality,
				supports = supports,
			}
			g.skills[si] = s
			if g.enabled and (hasCwdt or s.name == "Summon Skeletons" or s.name == "Forbidden Rite") then
				interesting[#interesting + 1] = { group = group, groupIndex = gi, skillIndex = si, out = s }
			end
		end
		facts.groups[#facts.groups + 1] = g
	end

	-- Per-skill calculations. PoB only calculates its "main skill", and each recalculation is the
	-- expensive part of a check, so only the skills the loop depends on get one: the minion skills
	-- under a CWDT, Forbidden Rite and the body armour (or weapon) CWDT skill. The user's own main skill goes
	-- last so the character stats below are calculated exactly as PoB shows them. Other CWDT
	-- groups only need their trigger threshold, which comes from the gem data directly.
	local function cwdtEffect(activeSkill)
		for _, effect in ipairs(activeSkill.effectList) do
			if effect.grantedEffect.name == "Cast when Damage Taken" then
				return effect
			end
		end
	end
	local full, rest = {}, {}
	local bodyPicked = false
	for _, slotWanted in ipairs({ "Body Armour", "Weapon 1" }) do
		for _, entry in ipairs(interesting) do
			if not bodyPicked and entry.group.slot == slotWanted and cwdtEffect(entry.group.displaySkillList[entry.skillIndex]) then
				entry.isBody = true
				bodyPicked = true
			end
		end
	end
	-- Minion skills under a CWDT drive the loop: their minions die and set off Heartbound Loop
	-- (Summon Skeletons, Summon Raging Spirit, Raise Zombie of Falling, ...)
	local function createsMinion(entry)
		local activeSkill = entry.group.displaySkillList[entry.skillIndex]
		return activeSkill and activeSkill.skillTypes and activeSkill.skillTypes[SkillType.CreatesMinion] and cwdtEffect(activeSkill) ~= nil
	end
	for _, entry in ipairs(interesting) do
		local name = entry.out.name
		if entry.isBody or name == "Forbidden Rite" or createsMinion(entry) then
			full[#full + 1] = entry
		else
			rest[#rest + 1] = entry
		end
	end
	local originalGroup = build.mainSocketGroup
	local originalSkill = build.skillsTab.socketGroupList[originalGroup] and build.skillsTab.socketGroupList[originalGroup].mainActiveSkill
	table.sort(full, function(a, b)
		return (a.groupIndex == originalGroup and 1 or 0) < (b.groupIndex == originalGroup and 1 or 0)
	end)
	local endedOnOriginal = false
	for _, entry in ipairs(full) do
		local previousSkill = entry.group.mainActiveSkill
		build.mainSocketGroup = entry.groupIndex
		entry.group.mainActiveSkill = entry.skillIndex
		recalc()
		local o = build.calcsTab.mainOutput
		local mainSkill = build.calcsTab.mainEnv.player.mainSkill
		local cdrMod, durMod
		if mainSkill and mainSkill.skillModList then
			cdrMod = calcLib.mod(mainSkill.skillModList, mainSkill.skillCfg, "CooldownRecovery")
			durMod = calcLib.mod(mainSkill.skillModList, mainSkill.skillCfg, "Duration", "PrimaryDuration")
		end
		-- Heartbound Loop damage of one minion death. PoB only reports it for Summon Skeletons
		-- (SelfHitDamage), so apply PoB's own damage-taken calculation to the combined ring damage
		-- for any minion skill (same as its Heartbound Loop handler in CalcOffence).
		local heartboundHit
		if mainSkill and mainSkill.skillModList and mainSkill.skillTypes and mainSkill.skillTypes[SkillType.CreatesMinion] then
			local ringDamage = 0
			for _, value in ipairs(mainSkill.skillModList:List(nil, "HeartboundLoopSelfDamage")) do
				ringDamage = ringDamage + value.baseDamage
			end
			if ringDamage > 0 then
				local ok, _, taken = pcall(build.calcsTab.calcs.applyDmgTakenConversion, mainSkill, o, nil, "Physical", ringDamage)
				heartboundHit = ok and num(taken) or nil
			end
		end
		entry.out.calc = {
			heartboundHitDamage = heartboundHit,
			duration = num(o.Duration),
			baseDuration = mainSkill and mainSkill.skillData and num(mainSkill.skillData.duration) or nil,
			durationMod = num(durMod),
			cooldownRecoveryMod = num(cdrMod),
			minionsPerCast = num(o.SummonedMinionsPerCast),
			selfHitDamage = num(o.SelfHitDamage),
			frDamageTaken = num(o.FRDamageTaken),
			cwdtThreshold = num(o.CWDTThreshold),
			triggerRateCap = num(o.TriggerRateCap),
			skillTriggerRate = num(o.SkillTriggerRate),
		}
		entry.group.mainActiveSkill = previousSkill
		endedOnOriginal = entry.groupIndex == originalGroup and entry.skillIndex == (originalSkill or 1)
	end
	for _, entry in ipairs(rest) do
		local activeSkill = entry.group.displaySkillList[entry.skillIndex]
		local effect = cwdtEffect(activeSkill)
		local level = effect and effect.grantedEffect.levels[effect.level]
		if level then
			local thresholdMore = 0
			for _, qs in ipairs(effect.grantedEffect.qualityStats or {}) do
				if qs[1] == "cast_when_damage_taken_trigger_threshold_+%" then
					-- PoB truncates quality stats toward zero (CalcTools buildSkillInstanceStats)
					thresholdMore = thresholdMore + math.modf(qs[2] * (effect.quality or 0))
				end
			end
			entry.out.calc = {
				cwdtThreshold = num(level[1] * (1 + thresholdMore / 100)),
				ownCooldown = activeSkill.skillData and num(activeSkill.skillData.cooldown) or nil,
			}
		end
	end
	if not endedOnOriginal then
		build.mainSocketGroup = originalGroup
		recalc()
	end

	local o = build.calcsTab.mainOutput
	facts.stats = {
		life = num(o.Life),
		energyShield = num(o.EnergyShield),
		mana = num(o.Mana),
		ward = num(o.Ward),
		chaosResist = num(o.ChaosResist),
		armour = num(o.Armour),
		evasion = num(o.Evasion),
		physicalDamageReduction = num(o.PhysicalDamageReduction),
		lifeRecoup = num(o.LifeRecoup),
		manaRecoup = num(o.ManaRecoup),
	}

	-- Flasks: base data from the item, global modifiers from the player's modDB. Mirrors the
	-- maths in PoB's flask tooltip (ItemsTab:AddItemStatDifferences).
	local modDB = build.calcsTab.mainEnv.modDB
	local durInc = modDB:Sum("INC", nil, "FlaskDuration")
	local usedInc = modDB:Sum("INC", nil, "FlaskChargesUsed")
	local gainedInc = modDB:Sum("INC", nil, "FlaskChargesGained")
	local generic = modDB:Sum("BASE", nil, "FlaskChargesGenerated")
	local perEmpty = modDB:Sum("BASE", nil, "FlaskChargesGeneratedPerEmptyFlask")
	local emptySlots = 0
	for _, slotName in ipairs(FLASK_SLOTS) do
		local slot = itemsTab.slots[slotName]
		if slot and slot.selItemId == 0 then
			emptySlots = emptySlots + 1
		end
	end
	facts.flaskSlotsEmpty = emptySlots
	facts.flaskChanceNotConsume = math.min(modDB:Sum("BASE", nil, "FlaskChanceNotConsumeCharges"), 100)
	for _, slotName in ipairs(FLASK_SLOTS) do
		local slot = itemsTab.slots[slotName]
		local item = slot and slot.selItemId ~= 0 and itemsTab.items[slot.selItemId]
		if item and item.flaskData then
			local fd = item.flaskData
			local isLife, isMana = item.base.flask.life and true or false, item.base.flask.mana and true or false
			local typed = 0
			if isLife then typed = typed + modDB:Sum("BASE", nil, "LifeFlaskChargesGenerated") end
			if isMana then typed = typed + modDB:Sum("BASE", nil, "ManaFlaskChargesGenerated") end
			if not isLife and not isMana then typed = typed + modDB:Sum("BASE", nil, "UtilityFlaskChargesGenerated") end
			local info = itemInfo(slotName, item)
			info.utility = not isLife and not isMana
			info.duration = num(fd.duration * (1 + durInc / 100))
			info.chargesMax = num(fd.chargesMax)
			info.chargesUsed = num(fd.chargesUsed * (1 + usedInc / 100))
			info.gainMod = num(fd.gainMod * (1 + gainedInc / 100))
			-- charges per second before the gain modifier
			info.chargesPerSecond = num(generic + typed)
			info.chargesPerSecondPerEmptySlot = num(perEmpty)
			facts.flasks[#facts.flasks + 1] = info
		end
	end

	return facts
end

return extract
