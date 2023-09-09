import { Schema, model } from "mongoose";

const EntrySchema = new Schema({
  tags: { type: [String] },
  title: { type: String },
  text: { type: String },
});

export const Entry = model<any>("Entry", EntrySchema);
