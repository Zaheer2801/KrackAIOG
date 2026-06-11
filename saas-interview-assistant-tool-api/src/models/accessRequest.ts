import mongoose, { Schema, Document } from "mongoose";

export interface IAccessRequest extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  phoneNumber: string;
  duration: string;
  status: "pending" | "approved" | "rejected";
  paymentStatus: "pending" | "done" | "free";
  amountPaid: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const accessRequestSchema = new Schema<IAccessRequest>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    duration: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    paymentStatus: { type: String, enum: ["pending", "done", "free"], default: "pending" },
    amountPaid: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const AccessRequest = mongoose.model<IAccessRequest>("AccessRequest", accessRequestSchema);
export default AccessRequest;
