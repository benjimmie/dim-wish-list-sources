import D2Manifest from "destiny2-manifest";
import { WishListRoll } from "./lib/types";
import fs from "fs";
import { toWishList } from "./lib/wishlist-file";
import { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";
const manifest = new D2Manifest("asdf");
const verboseMain = true;
const placesToLookForValidPerks: (
  | "randomizedPlugSetHash"
  | "reusablePlugSetHash"
)[] = ["randomizedPlugSetHash", "reusablePlugSetHash"];

(async () => {
  let counter = 0;
  await manifest.load();
  ["Mercules904", "PandaPaxxy" /*, "misc"*/].forEach(dirName => {
    fs.readdirSync("../" + dirName).forEach(fileName => {
      verboseMain && console.log(`\nloading ${fileName}`);
      const rolls = toWishList(
        fs.readFileSync("../" + dirName + "/" + fileName, {
          encoding: "UTF-8"
        })
      ).wishListRolls;
      const badIndexes = getInvalidWishlistRolls(rolls, verboseMain);
      const badRolls = badIndexes.filter(i => i !== false).length;
      verboseMain &&
        console.log(`ran ${badIndexes.length} rolls -- ${badRolls} bad rolls`);
      counter += badRolls;
      verboseMain && console.log(`bad wishlist lines so far: ${counter}`);
    });
  });
})();

// given an array of [valid roll, invalid roll, valid roll, invalid roll]
// returns           [false,      1,            false,      3           ]
// so i guess you have an array of the indices of invalid rolls
function getInvalidWishlistRolls(rolls: WishListRoll[], verbose = false) {
  verbose && console.log(`about to check ${rolls.length} rolls`);
  const errorsByItem: { [key: string]: Set<string> } = { badItems: new Set() };

  const indicesOfBadRolls = rolls.map((roll, index) => {
    const perksOnThisRoll = [...roll.recommendedPerks];
    const rollItem = getItem(roll.itemHash);
    if (!rollItem) {
      errorsByItem.badItems.add(
        `!!! couldn't find an item for ${roll.itemHash} !!!`
      );
      return;
    }
    const itemName = rollItem.displayProperties.name;
    if (isDummy(rollItem)) {
      errorsByItem.badItems.add(
        `!!! ${itemName} (${roll.itemHash}) is a dummy item !!!`
      );
      return;
    }
    const perksThisGunCanActuallyHave = (rollItem.sockets.socketEntries
      .flatMap(se => {
        const hashesInPlugsets = placesToLookForValidPerks.flatMap(key =>
          getPlugSet(se[key] ?? -99999999)?.reusablePlugItems?.map(
            p => p.plugItemHash
          )
        );
        const reusablePlugItemHashes = se.reusablePlugItems.map(
          pi => pi.plugItemHash
        );
        return [...hashesInPlugsets, ...reusablePlugItemHashes];
      })
      .filter(Boolean) ?? []) as number[];
    const allPerksAreValid = perksOnThisRoll.every(p =>
      perksThisGunCanActuallyHave.includes(p)
    );
    if (allPerksAreValid) {
      // verbose && console.log("that was a valid roll for " + itemName);
      return false;
    }
    // verbose && console.log("something is wrong with " + itemName + ":");

    perksOnThisRoll.forEach(p => {
      if (perksThisGunCanActuallyHave.includes(p)) return;

      const cantExistPerkName = getItem(p)?.displayProperties.name;
      const maybeMeant = perksThisGunCanActuallyHave
        .filter(a => a !== p)
        .find(a => getItem(a)?.displayProperties.name === cantExistPerkName);
      if (!errorsByItem[itemName]) errorsByItem[itemName] = new Set();
      errorsByItem[itemName].add(
        `${cantExistPerkName} (${p}) cant exist on ${itemName} (${roll.itemHash})` +
          (!maybeMeant
            ? ""
            : `\n    maybe you meant rollable perk ${cantExistPerkName} (${maybeMeant})?`)
      );
    });

    return index;
  });
  Object.values(errorsByItem).forEach(set =>
    set.forEach(err => verbose && console.log(err))
  );
  return indicesOfBadRolls;
}

// ItemCategory [3109687656] "Dummies"
function isDummy(item: DestinyInventoryItemDefinition) {
  return item?.itemCategoryHashes?.includes(3109687656);
}
function getItem(hash: number) {
  return manifest.get("DestinyInventoryItemDefinition", hash);
}
function getPlugSet(hash: number) {
  return manifest.get("DestinyPlugSetDefinition", hash);
}
