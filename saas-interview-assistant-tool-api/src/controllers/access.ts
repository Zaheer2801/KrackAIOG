import { Request, Response } from "express";
import AccessRequest from "../models/accessRequest";
import User from "../models/user";
import Interview from "../models/interview";
import { AuthenticatedRequest } from "../middlewares/auth";
import crypto from "crypto";
import { sendEmail } from "../utils/email";

export const createAccessRequest = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, duration } = req.body;
    
    if (!fullName || !email || !phoneNumber || !duration) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    if (Number(duration) <= 0 || Number(duration) > 180) {
      return res.status(400).json({ message: "Duration must be between 0 and 180 minutes" });
    }

    const request = await AccessRequest.create({ fullName, email, phoneNumber, duration });
    return res.status(201).json({ message: "Request submitted successfully", request });
  } catch (error) {
    console.error("Error creating access request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAccessRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const requests = await AccessRequest.find().sort({ createdAt: -1 });
    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Error fetching access requests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

function generateRandomPasscode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    // Cryptographically secure random index — no Math.random()
    result += characters.charAt(crypto.randomInt(0, characters.length));
  }
  return result;
}

export const approveAccessRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    const { tier = "free", remainingMinutes = 15, expiresAt, passcode: customPasscode } = req.body;

    // Atomically claim the request: only one concurrent approve can flip pending→approved.
    // The second concurrent request matches nothing and bails out — prevents duplicate users.
    const request = await AccessRequest.findOneAndUpdate(
      { _id: id, status: { $ne: "approved" } },
      { $set: { status: "approved" } },
      { new: true }
    );

    if (!request) {
      // Either not found, or already approved by a concurrent request
      const exists = await AccessRequest.findById(id).select("_id status");
      if (!exists) return res.status(404).json({ message: "Request not found" });
      return res.status(400).json({ message: "Request already approved" });
    }

    // Use admin-provided code or generate a random one
    const passcode = customPasscode?.trim().toUpperCase() || generateRandomPasscode();

    let user;
    try {
      // Create new user for this passcode
      user = await User.create({
        email: request.email,
        passcode,
        role: "user",
        tier,
        remainingMinutes: Number(remainingMinutes),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        deviceFingerprint: "",
        fraudFlag: false
      });
    } catch (createErr) {
      // Roll back the approval so the admin can retry
      request.status = "pending";
      await request.save().catch(() => {});
      throw createErr;
    }

    // Send the Magic Link via Email
    await sendEmail({
      email: request.email,
      name: request.fullName,
      subject: "Your KrackAI Access is Approved!",
      intro: "Your access request to KrackAI has been approved. Download the desktop app from krackai.org and use the access code below to log in.",
      action: {
        instructions: `Your Access Code: ${passcode}  —  Open the KrackAI app and enter this code to get started. You have ${remainingMinutes} minutes included.`,
        button: {
          text: "Visit krackai.org",
          link: "https://krackai.org"
        }
      },
      outro: "If you have any questions, reply directly to this email. Your access code is unique to your device — do not share it."
    });

    return res.status(200).json({ message: "Request approved and email sent", passcode, user });
  } catch (error: any) {
    console.error("Error approving request:", error);
    res.status(500).json({ message: "Internal server error: " + error.message });
  }
};

export const rejectAccessRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    const request = await AccessRequest.findById(id);
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = "rejected";
    await request.save();

    return res.status(200).json({ message: "Request rejected" });
  } catch (error) {
    console.error("Error rejecting request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateAccessRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    const fields = ["fullName", "email", "phoneNumber", "duration", "paymentStatus", "amountPaid", "notes"];
    const update: Record<string, any> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) update[f] = req.body[f];
    }

    const request = await AccessRequest.findByIdAndUpdate(id, { $set: update }, { new: true });

    if (!request) return res.status(404).json({ message: "Request not found" });
    return res.status(200).json({ message: "Updated", request });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserInterviews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const interviews = await Interview.find({ user: id }).sort({ date: -1 }).limit(50);
    const totalMinutesUsed = interviews.reduce((sum, i) => sum + Math.round(i.timeTaken / 60), 0);

    return res.status(200).json({ user, interviews, totalMinutesUsed });
  } catch (error) {
    console.error("Error fetching user interviews:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

