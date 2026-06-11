import mongoose, { Schema, Document } from "mongoose";

export interface IInterviewQuestion extends Document {
  questionNumber: number;
  question: string;
  answer: string;
}

export interface IInterview extends Document {
  user: mongoose.Types.ObjectId;
  date: Date;
  timeTaken: number; // in seconds
  status: "completed" | "incomplete";
  questions: IInterviewQuestion[];
}

const questionSchema = new mongoose.Schema<IInterviewQuestion>(
  {
    questionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const interviewSchema = new Schema<IInterview>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    timeTaken: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "incomplete"],
      required: true,
    },
    questions: [questionSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

interviewSchema.index({ user: 1, date: -1 });

const Interview = mongoose.model<IInterview>("Interview", interviewSchema);

export default Interview;
