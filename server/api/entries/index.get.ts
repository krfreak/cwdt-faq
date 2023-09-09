import { Entry } from "~/server/models/entry.model";

export default defineEventHandler(async (event) => {
  console.log("GET /api/entries");

  try {
    console.log("Find entries");
    const entries = await Entry.find();
    return {
      entries,
    };
  } catch (err) {
    console.error(err);
  }
});
