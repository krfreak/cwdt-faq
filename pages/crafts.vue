<template>
  <div class="content m-5">
    <h1>Crafting Cookbook</h1>
    <button
      class="rounded bg-zinc-700 p-2 mr-2 hover:bg-red-600"
      v-for="craft in crafts"
      :key="craft.title"
      @click="scrollToTarget(craft.title)"
    >
      {{ craft.title }}
    </button>
    <CraftPanel
      v-for="craft in crafts"
      :key="craft.title"
      :id="craft.title"
      :title="craft.title"
      :text="craft.text"
      :img="craft.img"
    ></CraftPanel>
  </div>
</template>
<script setup lang="ts">
interface Craft {
  title: string;
  text: string;
  img: string;
}

function scrollToTarget(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView();
  }
}

const crafts: Craft[] = [
  {
    title: "Boots",
    text: `Buy a base with 85-100% base defense
Perfect fossil to get 29-30% quality

# Phase 1 - Prefix

Dense fossil till you have more than 400 ward, some times more than 430 ward
Check if you have have a high movement speed mod, if yes, then your phase 1 is complete

If you don't have movement, annul a prefix and then make sure ward is more than 370

Repeat above still till you get open prefix or 30% movement speed prefix with more than 370 ward

Craft Movement speed from the bench. For Endgame, do Aisling then phase 2.

# Phase 2 - Suffix

Now apply a lesser eldritch ember and a greater eldritch  ichor
Now slam with eldritch exalts
If you get low tier mods, eldritch annul them

If all three suffixes are horrible, then use Eldritch chaos

Repeat the process till you got good resistance rolls in the suffix

Endgame - Aisling Movement Speed

Make sure you have an open prefix.
Craft Prefix cannot be changed in the suffix.
Now Aisling to try to get a prefix
Unveil the prefix for Movement Speed

If you don't get a Prefix from Aisling, you need to annul your Aisling suffix
To remove Aisling suffix, you can use eldritch annul or eldritch chaos orb.

Craft Prefix cannot to be changed and repeat till you get Aisling Prefix.

Once you have Movement Speed in the prefix from Aisling, you can continue crafting your suffix, Phase 2
Aisling again for prefix.

Targets

Budget - 350 ward, no movement speed, no suffix
Endgame - 400 ward, movement speed & full suffix for resistance

Budget - 100c
Midgame  - 5 divines

Finishing Implicit , 7-10% Cooldown Recovery Rate

Buy 5-10 Exceptional Eldritch Embers
Buy 10 of Orb Of Conflicts

Spam Greater Eldritch Ichor to get 6% CDR

Now apply just one Exceptional Ember
Orb of conflict, the 6% should go to 7%. If it does not, then use Orb Of Conflict till it becomes 7%
Now its 7%, apply Exceptional Ember again & Orb Of Conflict till 8%
Repeat till 9 or 10%

[Runic Sabatons Base URL](https://www.pathofexile.com/trade/search/Kalandra/2Pgmb55hk)
`,
    img: "",
  },
  {
    title: "Crown and Gauntlets",
    text: `Phase 1

Perfect fossil to get 27-30% quality

Spam dense fossils till you get more than 650 ward, ideally 700+ ward for helm, Gloves 450+
Then Apply One Greater Eldritch Ichor

Phase 2
Now use Eldritch chaos orb till you get one or two good suffix

Eldritch Annul the bad suffix or Eldritch Chaos Orb if all suffixes are bad
Bench craft accuracy
Slam eldritch exalt

If you don't get anything good
Remove accuracy Benchcraft
Try to Annul the bad suffix

Craft Accuracy again using Bench
Slam eldritch exalt

Repeat above process till you get good suffixes
You can also use eldritch chaos orb when both suffixes are bad

In the final open suffix, you can bench craft resistances or attributes
On gloves you can craft Shock reduction or elemental damage or resistance/attributes


Target Runic Crown

Budget - 550 ward, only  benchcraft suffix
Endgame - 680  ward, eldritch craft 2 suffix, benchcraft final suffix

Budget - 100c
Endgame  - 5 divines


Target Runic Gauntlets

Budget - 350 ward,  only benchcraft suffix
Endgame - 450  ward, eldritch craft 2 suffix, benchcraft final suffix

Budget - 100c
Endgame  - 5 divines

Runic Crown Base URL
https://www.pathofexile.com/trade/search/Kalandra/L238MOGSn

Runic Gauntlets Base URL
https://www.pathofexile.com/trade/search/Kalandra/2rQe0ypck
`,
    img: "",
  },
  {
    title: "27 CDR Belt",
    text: `Buy 20 Stygian Vise, Level 84+ bases from Trade or TFT

Phase 1

Spam Alterations on all 20 belts till you get "Reduced flask charges used"
Now Augment and regal
If you you regal a suffix, scour and restart / Or you can use beast Farric Wolf Alpha to remove the suffix, add a prefix
If you regal a prefix continue to next step
Bench craft a prefix on belt now, anything such as life or mana
Now Slam Crusader Orb and Pray
If it fails, sell the belt base, repeat above steps

Phase 2

Option 1 - Safe easy option

Now you have 16+ CDR in suffix
Craft Can Have 3 Crafted Modifiers
Craft Suffix Cannot Be Changed (Buy the beast  Wild Bristle Matron and kill it. This is cheaper than benchcraft)
Now Scour the belt
Craft Suffix Cannot Be Changed again
Take the belt to Aisling. Do not Unveil yet.
Bench Craft Mana
Bench Craft Armor + ES hybrid mod or simply es/evasion any defense modifier
8 Unveil and you will get life modifier. Apply fertile catalyst!
Remove Crafted Modifiers using Bench.
Finally Bench craft 15% flask duration

See the image


Option 2 - Gamble, but you can get T1 life.

Craft Can Have 3 Crafted Modifiers
Craft Suffix Cannot Be Changed
Harvest Reforge Life. Beaware it may fill all 3 prefixes.
Repeat Suffix Cannot Be Changed & Reforge life until you are happy with life mod


Bonus
In Phase 1 if you happen to regal T1/T2 flask effect duration then craft Suffix Cannot Be changed and Aisling and Pray for 16 CDR.

Crafting Cost - 6 divines lucky, 25 divines very unlucky`,
    img: "https://imgur.com/sp2Re1n",
  },
  {
    title: "Endgame CDR Belt",
    text: `Look above post/message for crafting without fracture base. This is not the only method. The above is cheaper.

Phase 1 - The Fracture

Basee - Stygian Vise 84+

Option 1 -
Buy a fractured "20% reduced flask charges used" base,

Option  2 -
Buy a Stygian Vise,  alterations till you get "20% reduced flask charges used", augment, regal, exalt slam
The belt will now have exactly 4 modifiers.

Option 3 -
Buy a Stygian with "20% reduced flask charges used"
If it has 6 or 5 modifiers, annul them. So that it has 4 modifiers only.

Time to fracture

Ensure it has only 4 modifiers, now fracturing orb and Pray

Phase 2 - Crafting Flask Duration & CDR

Spam Chaos Orbs till you get 28+ flask duration in suffix,
Buy Aisling and pray for suffix and while keeping the flask duration suffix
Unveil and pray for CDR
Repeat till you get it

Crafting Life Mod
Craft Suffix Cannot Be Changed. (Buy the beast  Wild Bristle Matron  and kill it. This is cheaper than benchcraft)
Harvest Reforge Life

Repeat till you are happy with life mod

Cost - 30 Divines Very Lucky, 70 Divines Very Unlucky

This is the end game belt you want for Non-Omni Builds`,
    img: "",
  },
  {
    title: "+2 Amulet",
    text: `
Total Cost - 10 Divines

WARNING - You may take 10K alts and still not get +1

Buy 2-3 bases. Pick any decent implicit

https://www.pathofexile.com/trade/search/Crucible/yvw0zWeIR

+ Phase 1 - Alt Spam

Scour all 3 bases, alterations spam
After 2k-3k alterations you should get +1 to all Skill Gems

Use string to filter in stash "all skill gems"

+ Phase 2 - Regal and Prep

Close Eyes [Chris Wilson Vision] Regal. Pray Suffix!
  If you get a suffix
  Craft Prefix Cannot Be Changed
  Scour the amulet

If you regal a prefix, then use an Annul orb
If this step removes +1, restart

+ Phase 3 -  Brenchcraft and Harvest

Craft Can Have 3 Crafted Modifiers
Craft Prefix Cannot Be Changed again
Craft Adds (6-8) to (14-18) Cold Damage to Attacks

Buy Yellow Harvest 15000, and 1 Sacred Crystallised Lifeforce

Harvest craft Add a cold modifier, remove a random modifer

This will guarantee +1 to all cold skill gems

+ Phase 4 - Finish

# Option 1
You can stop here.
Bench Craft Projectile Damage from Bench in the Open Prefix
Exalt Slam Once For a random suffix

# Option 2
Can have 3 mods
Benchcraft Proj Damage in Prefix.
Benchcraft Cold Damage / Critical Strike Chance in Suffix.

Instead of projectile damage, you can craft Mana Recoup in the prefix.
This means you don't need to have Mana Recoup on the ring.

If you have Sublime Vision, Increased Effect of non-damaging ailments is best Suffix from Aisling/Bench

- Phase 5 - Currency Burn Endgame

Prefix cannot be changed
Go to Aisling and get prefix
Unveil for Projectile Damage

You can also take Life/Mana recoup.

If Aisling gives a suffix

Prefix cannot be changed, Scour or Annul orb(gamble)
Repeat Phase 5 again.

# Currency Burn Part 2

Now that prefixes are completed
Craft Prefix Cannot Be Changed
Harvest craft Add Critical Remove Another
Repeat this till you get T1 Critical Strike Chance

Finish with Cold Damage in the suffix or Resistance of your choice.`,
    img: "",
  },
  {
    title: "Omni Rare Ring",
    text: `Buy unset ring base
https://www.pathofexile.com/trade/search/Kalandra/3eJnBpZh5

Phase 1 - Prefix

Essence spam till you have triple attributes
Tier 2 or higher attribute rolls

Phase 2 - Suffix

Craft suffix cannot be changed
Veiled chaos Orb, use this

Phase 3 - Block

Now use the bench to block one the following fire/cold or fire/lightning or cold/lightning damage, continue now

Phase 4 - Unveil
Unveil now
Pick Maximum Life Or Mana Recoup

If you picked life, bench craft mana recoup
If you picked mana recoup, bench craft maximum life

If you don't get mana recoup or life, repeat phase 2
`,
    img: "",
  },
];
</script>
