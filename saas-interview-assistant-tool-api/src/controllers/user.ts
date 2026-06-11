import { Request, Response } from "express";
import User from "../models/user";
import { generateToken } from "../utils/jwt";
import { AuthenticatedRequest } from "../middlewares/auth";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { passcode, client_fp } = req.body;

    if (!passcode) {
      res.status(400).json({ message: "Passcode is required" });
      return;
    }

    if (passcode === "Meeramart#@2025") {
      const token = generateToken({
        _id: "admin-master",
        role: "admin",
      } as any);

      res.status(200).json({
        message: "Admin Login successful.",
        user: { role: "admin", passcode: "Admin" },
        token: token,
      });
      return;
    }

    const userExists = await User.findOne({ passcode });

    if (!userExists) {
      res.status(404).json({ message: "Invalid Passcode" });
      return;
    }

    // Calendar-date expiry check
    if (userExists.expiresAt && new Date() > userExists.expiresAt) {
      res.status(403).json({
        message: "Access code expired. Please contact the administrator for renewal."
      });
      return;
    }

    // Track device fingerprint but do not block — passcode is the only auth factor
    if (client_fp && userExists.role === "user" && !userExists.deviceFingerprint) {
      userExists.deviceFingerprint = client_fp;
      await userExists.save();
    }

    const token = generateToken({
      _id: userExists._id.toString(),
      role: userExists.role,
      passcode: userExists.passcode,
    } as any);

    res.status(200).json({
      message: "Login successful.",
      user: {
        role: userExists.role,
        passcode: userExists.passcode,
      },
      token: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error occured while trying to log in." });
  }
};

export const getUserByToken = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (userId === "admin-master") {
      return res.status(200).json({
        message: "Admin fetched successfully.",
        user: { role: "admin", passcode: "Admin" },
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      message: "User fetched successfully.",
      user: user,
    });
  } catch (error) {
    console.error("Error fetching user", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// Admin Endpoints
export const createPasscode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { passcode, label, tier, remainingMinutes, expiresAt } = req.body;
    if (!passcode?.trim()) {
      return res.status(400).json({ message: "Passcode string required." });
    }

    const exists = await User.findOne({ passcode });
    if (exists) {
      return res.status(400).json({ message: "Passcode already exists." });
    }

    const newUser = await User.create({
      passcode,
      role: "user",
      label: label?.trim() || '',
      tier: tier || 'free',
      remainingMinutes: remainingMinutes != null ? Number(remainingMinutes) : 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    return res.status(201).json({ message: "Passcode generated successfully", passcode: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPasscodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const passcodes = await User.find({ role: "user" }).sort({ createdAt: -1 });
    return res.status(200).json({ passcodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePasscode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    const { label, tier, remainingMinutes, expiresAt } = req.body;

    const updates: any = {};
    if (label !== undefined)           updates.label           = label;
    if (tier !== undefined)            updates.tier            = tier;
    if (remainingMinutes !== undefined) updates.remainingMinutes = Number(remainingMinutes);
    if (expiresAt !== undefined)       updates.expiresAt       = expiresAt ? new Date(expiresAt) : null;

    const updated = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "User not found." });

    return res.status(200).json({ message: "Updated successfully", passcode: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePasscode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: "Passcode deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetDeviceFingerprint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { deviceFingerprint: "" }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.status(200).json({ message: "Device reset successfully. User can log in from a new device." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
