import { Request, Response } from "express";
import Stripe from "stripe";
import { AuthenticatedRequest } from "../middlewares/auth";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;

type PackageConfig = {
  minutes: number;
  tier: string;
};

const PRICE_CONFIG: Record<string, PackageConfig> = {
  price_1SjFBJFZ79d2YXeIwfCf9zb5: {
    minutes: 60,
    tier: "1hour",
  },
  price_1SjFCMFZ79d2YXeIbHoPAvU5: {
    minutes: 120,
    tier: "2hour",
  },
  price_1SjFCwFZ79d2YXeIQKvjLo3d: {
    minutes: 180,
    tier: "3hour",
  },
};

export const createCheckoutSession = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { priceId } = req.body;
  const userEmail = req.user?.email;

  if (!priceId) {
    return res.status(400).json({ error: "priceId is required" });
  }

  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const config = PRICE_CONFIG[priceId];

  if (!config) {
    return res.status(400).json({ error: "Invalid priceId" });
  }

  if (!stripe) {
    return res.status(503).json({ error: "Payment not configured" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,

      metadata: {
        userEmail,
        minutes: String(config.minutes),
        tier: config.tier,
      },

      success_url: `${process.env.FRONTEND_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/stripe-cancel`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: "Checkout failed" });
  }
};

export const stripeSuccess = (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Success - KrackAI</title>
      <meta http-equiv="refresh" content="3;url=krackai://dashboard" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap');
        body { 
          margin: 0; 
          height: 100vh; 
          background: #0f0f0f; 
          color: white; 
          font-family: 'Inter', sans-serif; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          padding: 16px;
        }
        .container { 
          text-align: center; 
          padding: 40px 32px; 
          background: rgba(20, 20, 20, 0.8); 
          backdrop-filter: blur(20px); 
          border-radius: 20px; 
          border: 1px solid rgba(6, 182, 212, 0.3); 
          max-width: 420px; 
          width: 100%;
          animation: fadeIn 0.8s ease-out; 
        }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .icon { 
          width: 90px; 
          height: 90px; 
          margin: 0 auto 28px; 
          background: rgba(6, 182, 212, 0.2); 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: 2px solid rgba(6, 182, 212, 0.4);
        }
        svg { width: 48px; height: 48px; stroke: #06b6d4; stroke-width: 3; }
        h1 { font-size: 28px; margin: 0 0 16px; color: #06b6d4; font-weight: 700; }
        p { font-size: 16px; margin: 12px 0; color: #d0d0d0; line-height: 1.5; }
        .highlight { color: #06b6d4; font-weight: 600; }
        .link { color: #06b6d4; font-weight: 600; text-decoration: underline; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1>Payment Successful!</h1>
        <p>Your <span class="highlight">interview credits</span> have been added.</p>
        <p>Ready to crush your next interview.</p>
        <p><small>Returning to dashboard in 3s...</small></p>
        <p><span class="link" onclick="window.location.href='krackai://dashboard'">Tap here if nothing happens</span></p>
      </div>

      <script>
        setTimeout(() => {
          window.location.href = 'krackai://dashboard';
        }, 500);
      </script>
    </body>
    </html>
  `);
};

export const stripeCancel = (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Canceled - KrackAI</title>
      <meta http-equiv="refresh" content="4;url=krackai://dashboard" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap');
        body { 
          margin: 0; 
          height: 100vh; 
          background: #0f0f0f; 
          color: white; 
          font-family: 'Inter', sans-serif; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          padding: 16px;
        }
        .container { 
          text-align: center; 
          padding: 40px 32px; 
          background: rgba(20, 20, 20, 0.8); 
          backdrop-filter: blur(20px); 
          border-radius: 20px; 
          border: 1px solid rgba(251, 146, 60, 0.3); 
          max-width: 420px; 
          width: 100%;
          animation: fadeIn 0.8s ease-out; 
        }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .icon { 
          width: 90px; 
          height: 90px; 
          margin: 0 auto 28px; 
          background: rgba(251, 146, 60, 0.2); 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: 2px solid rgba(251, 146, 60, 0.4);
        }
        svg { width: 48px; height: 48px; stroke: #fb923c; stroke-width: 3; }
        h1 { font-size: 28px; margin: 0 0 16px; color: #fb923c; font-weight: 700; }
        p { font-size: 16px; margin: 12px 0; color: #d0d0d0; line-height: 1.5; }
        .link { color: #fb923c; font-weight: 600; text-decoration: underline; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>Payment Canceled</h1>
        <p>No charges were made.</p>
        <p>You can try again anytime in the app.</p>
        <p><small>Returning to dashboard in 4s...</small></p>
        <p><span class="link" onclick="window.location.href='krackai://dashboard'">Tap here if nothing happens</span></p>
      </div>

      <script>
        setTimeout(() => {
          window.location.href = 'krackai://dashboard';
        }, 500);
      </script>
    </body>
    </html>
  `);
};
