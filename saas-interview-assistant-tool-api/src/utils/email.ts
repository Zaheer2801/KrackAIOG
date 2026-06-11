import { Resend } from "resend";
import Mailgen from "mailgen";

const resend = new Resend(process.env.RESEND_API_KEY!);

interface MailAction {
  instructions: string;
  button: {
    text: string;
    link: string;
  };
}

interface EmailInfo {
  email: string;
  name: string;
  intro: string | string[];
  outro: string;
  subject: string;
  action?: MailAction;
}

export const sendEmail = async (emailInfo: EmailInfo): Promise<void> => {
  try {
    const mailGenerator = new Mailgen({
      theme: "default",
      product: {
        name: "KrackAI",
        link: "kariqs.online",
      },
    });

    const emailContent = {
      body: {
        name: emailInfo.name,
        intro: emailInfo.intro,
        action: emailInfo.action,
        outro: emailInfo.outro,
      },
    };

    const html = mailGenerator.generate(emailContent);

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: emailInfo.email,
      subject: emailInfo.subject,
      html,
    });

    console.log(`Email sent successfully to ${emailInfo.email}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Email delivery failed");
  }
};
