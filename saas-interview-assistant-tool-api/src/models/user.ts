import mongoose, { Schema, Document } from "mongoose";
import Interview from "./interview";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email?: string;
  passcode: string;
  role: "user" | "admin";
  tier?: string;
  remainingMinutes?: number;
  expiresAt?: Date | null;   // calendar-date expiry set by admin; null = never expires
  label?: string;            // admin-friendly description (e.g. "John Smith - 30 days")
  deviceFingerprint?: string;
  fraudFlag?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, trim: true },
    passcode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    tier: { type: String, default: "free" },
    remainingMinutes: { type: Number, default: 0 },
    deviceFingerprint: { type: String, default: "" },
    fraudFlag: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    label: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
);

userSchema.pre(
  "findOneAndDelete",
  { document: false, query: true },
  async function (next) {
    try {
      const user = await this.model.findOne(this.getQuery()).select("_id");
      if (user?._id) {
        await Interview.deleteMany({ user: user._id });
      }
    } catch (error) {
      console.error("Cascade delete failed:", error);
    }
    next();
  },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
