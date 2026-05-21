import "server-only";
import { Resend } from "resend";

type InviteEmailInput = {
  to: string;
  fullName: string;
  actionLink: string;
  tempPassword: string;
  loginUrl: string;
};

export type InviteEmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: string };

let cached: Resend | null | undefined;

function getResend(): Resend | null {
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY;
  cached = key ? new Resend(key) : null;
  return cached;
}

export async function sendInviteEmail(
  input: InviteEmailInput,
): Promise<InviteEmailResult> {
  const resend = getResend();
  const from = process.env.RESEND_FROM;
  if (!resend || !from) {
    return {
      sent: false,
      reason: !resend
        ? "RESEND_API_KEY not configured"
        : "RESEND_FROM not configured",
    };
  }

  const subject = "Your FlipSide Ops account is ready";
  const text = [
    `Hi ${input.fullName},`,
    "",
    "Your FlipSide Ops account has been created. You can sign in two ways:",
    "",
    "1) One-time sign-in link (no password needed for first login):",
    input.actionLink,
    "",
    `2) Email + password at ${input.loginUrl}`,
    `   Temporary password: ${input.tempPassword}`,
    "",
    "After signing in, please change your password from your profile.",
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.fullName)},</p>
    <p>Your FlipSide Ops account has been created. You can sign in two ways:</p>
    <ol>
      <li>
        <p>One-time sign-in link (no password needed for first login):</p>
        <p><a href="${input.actionLink}">${escapeHtml(input.actionLink)}</a></p>
      </li>
      <li>
        <p>Email + password at <a href="${input.loginUrl}">${escapeHtml(input.loginUrl)}</a></p>
        <p>Temporary password: <code>${escapeHtml(input.tempPassword)}</code></p>
      </li>
    </ol>
    <p>After signing in, please change your password from your profile.</p>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      text,
      html,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true, id: data?.id ?? "" };
  } catch (e) {
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "Unknown send error",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
