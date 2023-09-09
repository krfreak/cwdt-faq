import { Nitro } from "nitropack";
import mongoose from "mongoose";

export default async (_nitroApp: Nitro) => {
  const config = useRuntimeConfig();

  try {
    console.log("Connecting to MongoDB");
    console.log(config.mongodbUri);
    await mongoose.connect(config.mongodbUri);
  } catch (err) {
    console.error(err);
  }
};
