import { OrganizationInvitationPayload } from "../mailer.service";
import path from "path";

export function renderOrganizationInvitationEmail(payload: OrganizationInvitationPayload) {
  const subject = `Invitation to join ${payload.organizationName} on KOCHAM`;

  const text = `
Hi ${payload.recipient.name ?? "there"},
You have been invited by ${payload.inviterName} to join the organization "${payload.organizationName}" on KOCHAM.
Click the link below to accept the invitation:
${payload.inviteLink}

Best Regards,
KOCHAM team
  `.trim();

  const html = `
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:0;margin:0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <!-- Banner -->
            <tr>
              <td style="padding:0;">
                <img src="cid:banner@kocham" alt="KOCHAM Banner" width="600" style="display:block;width:100%;height:auto;border:0;" />
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:40px 48px 32px 48px;text-align:left;">
                <p style="font-size:18px;color:#222;margin:0 0 16px 0;font-weight:600;">Hi ${payload.recipient.name ?? "there"},</p>
                <p style="font-size:16px;color:#222;margin:0 0 10px 0;">
                  You’ve been invited by <strong>${payload.inviterName}</strong> to join the organization
                  <strong>${payload.organizationName}</strong> on <strong>KOCHAM</strong>.
                </p>
                <p style="font-size:16px;color:#222;margin:0 0 24px 0;">
                  Click the button below to accept and create your account:
                </p>

                <div style="text-align:center;margin:32px 0;">
                  <a href="${payload.inviteLink}" style="display:inline-block;background:#1a4d8f;color:#fff;
                    font-size:16px;font-weight:600;text-decoration:none;border-radius:6px;
                    padding:14px 32px;">
                    Create free account
                  </a>
                </div>

                <p style="font-size:15px;color:#222;margin:0 0 16px 0;">If you did not expect this invitation, you can safely ignore this email.</p>
                <p style="font-size:15px;color:#222;margin:0;">Best Regards,</p>
                <p style="font-size:15px;color:#1a4d8f;font-weight:600;margin:0;">KOCHAM team.</p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 48px 40px 48px;text-align:center;">
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                <div style="margin-bottom:12px;">
                  <a href="https://instagram.com/kochamvn" style="margin:0 8px;">
                    <img src="cid:instagram@kocham" alt="Instagram" style="height:28px;" />
                  </a>
                  <a href="https://facebook.com/kochamvn" style="margin:0 8px;">
                    <img src="cid:facebook@kocham" alt="Facebook" style="height:28px;" />
                  </a>
                  <a href="https://kocham.vn" style="margin:0 8px;">
                    <img src="cid:naver@kocham" alt="Website" style="height:28px;" />
                  </a>
                </div>
                <p style="font-size:13px;color:#888;margin:4px 0;">© 2025 KOCHAM. All rights reserved.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  `.trim();

  const attachments = [
    {
      filename: "banner-kocham.png",
      path: path.join(__dirname, "img/banner-kocham.png"),
      cid: "banner@kocham",
    },
    {
      filename: "image-instagram.png",
      path: path.join(__dirname, "img/image-instagram.png"),
      cid: "instagram@kocham",
    },
    {
      filename: "image-facebook.png",
      path: path.join(__dirname, "img/image-facebook.png"),
      cid: "facebook@kocham",
    },
    {
      filename: "image-naver.png",
      path: path.join(__dirname, "img/image-naver.png"),
      cid: "naver@kocham",
    },
  ];

  return { subject, text, html, attachments };
}
