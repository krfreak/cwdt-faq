import { Entry } from "~/server/models/entry.model";

export default defineEventHandler(async (event) => {
  console.log("GET /api/entries/tags");

  try {
    const data = await Entry.aggregate([
      {
        $match: {
          tags: { $exists: true, $ne: [] },
        },
      },
      {
        $unwind: "$tags",
      },
      {
        $group: {
          _id: null,
          tags: { $addToSet: "$tags" },
        },
      },
      {
        $sort: {
          tags: 1,
        },
      },
      {
        $project: {
          _id: 0,
          tags: 1,
        },
      },
    ]);
    return {
      data,
    };
  } catch (err) {
    console.error(err);
  }
});
