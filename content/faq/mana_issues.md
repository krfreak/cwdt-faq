---
tags: ['mana']
title: 'Mana Issues'
description: 'Resolving mana issues'
---

# Mana Issues

#### If you require multiple weapon swaps to start the loop

1. Did you forget to allocate the mana recoup nodes on the tree?
2. If your ward is low and you have Mind Over Matter allocated, then you will run out of mana. Remove it.
3. You absolutely need to put the Summon Skeletons into the first socket of your Runic Crown.
4. If you are using a rare ring use a separate FR 1 + normal CWDT 12 setup in your gloves.
5. Don't use too many skills in your loop or they will eat your mana.
6. Put the actual skill gems in your weapon and body armour into a later socket than the Summon Skeletons. Why? Trigger order of the CWDT gem.

##### Trigger order of CWDT

Trigger order: If multiple triggers proc simultaneously, skills triggered follow a set priority.\
First, skill gems in socket 1 of any piece of gear will apply before any skill gems in socket 2. \
Items with less than 6 sockets still follow this pattern from socket 1.

```
(1)⇒(2)
     ⇓
(4)⇐(3)
 ⇓
(5)⇒(6)
```

Then, if multiple triggered skills are in socket 1, the following priority is used:

`Main hand ⇒ Amulet ⇒ Helm ⇒ Off hand ⇒ Body armour ⇒ Gloves ⇒ Boots` \
Therefore, the trigger order will follow:

`Main hand (1) ⇒ Amulet (1) ⇒ ... ⇒ Boots (1) ⇒ Main hand (2) ⇒ Amulet (2) ⇒ ...` \
For skills that are dependent on another skill (e.g. Summon Skeletons), it is advised to place the dependent skill in a later socket to ensure smooth functioning.

See also [this](https://www.poewiki.net/wiki/Cast_when_Damage_Taken_Support){:target="\_blank"}.
