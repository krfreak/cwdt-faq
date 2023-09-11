import * as EntriesData from "~/server/entries.json";

export default defineEventHandler(async (event) => {
  return EntriesData.entries;
});
