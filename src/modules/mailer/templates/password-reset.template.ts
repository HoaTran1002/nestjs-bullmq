import path from "path";
import { I18nService } from "nestjs-i18n";
import { OtpMailPayload } from "../mailer.service";

export class PasswordResetMailRenderer {
  constructor(private readonly i18n: I18nService) {}

  async render(payload: OtpMailPayload) {
    const locale = (payload.acceptLanguage as "en" | "ko") || "en";

    // get translation
    const t = async (key: string, args?: Record<string, string | number>) =>
      await this.i18n.translate(`mailer.password-reset.${key}`, {
        lang: locale,
        args,
      });

    const name = payload.recipient?.name?.trim() || (locale === "ko" ? "회원님" : "there");
    const resetLink = payload.resetLink || "#";

    // translate each part
    const subject = await t("subject");
    const hi = await t("hi", { name });
    const body = await t("body");
    const button = await t("button");
    const ignore = await t("ignore");
    const regards = await t("regards");
    const team = await t("team");
    const footer = await t("footer");
    const privacy = await t("privacy");
    const terms = await t("terms");
    const help = await t("help");

    const html = `
    <body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr>
                <td><img src="cid:banner@kocham" alt="KOCHAM" width="640" style="display:block;width:100%;height:auto;border:0;" /></td>
              </tr>

              <tr>
                <td style="padding:48px 56px 32px 56px;text-align:left;">
                  <p style="font-size:18px;color:#000;font-weight:600;margin:0 0 16px 0;">
                    ${hi}
                  </p>

                  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 24px 0;">
                    ${body}
                  </p>

                  <div style="text-align:center;margin:40px 0;">
                    <a href="${resetLink}" style="
                      background-color:#004080;
                      color:#ffffff;
                      text-decoration:none;
                      padding:12px 24px;
                      border-radius:6px;
                      font-weight:600;
                      display:inline-block;
                    ">
                      ${button}
                    </a>
                  </div>

                  <p style="font-size:15px;color:#222;margin:0 0 24px 0;">
                    ${ignore}
                  </p>

                  <p style="font-size:15px;color:#222;margin:0 0 4px 0;">${regards}</p>
                  <p style="font-size:15px;font-weight:600;color:#004080;margin:0;">${team}</p>
                </td>
              </tr>

              <tr>
                <td style="background:#ffffff;padding:24px 56px 40px 56px;text-align:center;border-top:1px solid #E5E7EB;">
                  <div
                    style="
                      margin-bottom:12px;
                      padding:12px 0;
                      border-top:1px solid #e6e6e6;
                      border-bottom:1px solid #e6e6e6;
                    "
                  >
                    <a href="https://facebook.com/kochamvn"><img src="cid:facebook@kocham" alt="Facebook" style="height:28px;margin:0 8px;" /></a>
                    <a href="https://kocham.vn"><img src="cid:naver@kocham" alt="Website" style="height:28px;margin:0 8px;" /></a>
                  </div>

                  <p style="font-size:13px;color:#666;margin:4px 0;">© 2025 KOCHAM. All rights reserved.</p>

                  <p style="font-size:12px;color:#888;margin:12px 0 0 0;line-height:1.6;max-width:520px;margin-inline:auto;">
                    ${footer}
                  </p>

                  <div style="font-size:12px;color:#888;margin-top:8px;">
                    <a href="#" style="color:#555;text-decoration:underline;margin:0 4px;">${privacy}</a> ·
                    <a href="#" style="color:#555;text-decoration:underline;margin:0 4px;">${terms}</a> ·
                    <a href="#" style="color:#555;text-decoration:underline;margin:0 4px;">${help}</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    `.trim();

    const attachments = [
      { filename: "banner-kocham.png", path: path.join(__dirname, "img/banner-kocham.png"), cid: "banner@kocham" },
      { filename: "image-facebook.png", path: path.join(__dirname, "img/image-facebook.png"), cid: "facebook@kocham" },
      { filename: "image-naver.png", path: path.join(__dirname, "img/image-naver.png"), cid: "naver@kocham" },
    ];

    const text = `
${hi}
${body}
${ignore}
${regards}
${team}
    `.trim();

    return { subject, text, html, attachments };
  }
}
