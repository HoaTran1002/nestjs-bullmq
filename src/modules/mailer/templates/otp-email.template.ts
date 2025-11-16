import { I18nService } from "nestjs-i18n/dist/services/i18n.service";
import path from "path";
import { OtpMailPayload } from "../mailer.service";

export class OtpMailRenderer {
  constructor(private readonly i18n: I18nService) {}

  async render(payload: OtpMailPayload) {
    const locale = (payload.acceptLanguage?.split("-")[0] ?? "en") as "en" | "ko";
    const expiryMinutes = 5;
    const defaultName = locale === "ko" ? "회원님" : "there";
    const name = payload.recipient?.name?.trim() || defaultName;

    const t = (key: string, args?: Record<string, any>) =>
      this.i18n.translate(`mailer.otp.${key}`, { lang: locale, args });

    const contextLabel =
      (await this.i18n.translate(`mailer.otp.contexts.${payload.context}`, { lang: locale })) ||
      (await this.i18n.translate(`mailer.otp.contexts.default`, { lang: locale })) ||
      "Verification";

    const subject = await t("subject");

    const replaceVars = (text: string) =>
      text
        .replace("{{name}}", name)
        .replace("{{label}}", contextLabel)
        .replace("{{minutes}}", expiryMinutes.toString());

    const html = `
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="background:#ffffff;border-radius:8px;overflow:hidden;">

        <tr>
          <td><a href="https://kocham.app/" target="_blank">
            <img src="cid:banner@kocham" alt="KOCHAM" width="640" style="display:block;width:100%;height:auto;border:0;" />
          </a></td>
        </tr>

        <tr><td style="padding:48px 56px 32px 56px;text-align:left;">
          <p style="font-size:18px;color:#000;font-weight:600;margin:0 0 16px 0;">
            ${replaceVars(await t("greeting"))}
          </p>
          <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 8px 0;">
            ${replaceVars(await t("introLine1"))}
          </p>
          <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 24px 0;">
            ${replaceVars(await t("introLine2"))}
          </p>

          <div style="margin:32px 0;text-align:center;">
            <div style="display:inline-block;padding:10px 8px 10px 15px;border-radius:12px;background:#f3f6fa;border:1px solid #d9e2ef;font-size:30px;font-weight:700;letter-spacing:14px;color:#1a1a1a;">
              ${payload.otp}
            </div>
          </div>

          <p style="font-size:15px;color:#222;margin:0 0 24px 0;">
            ${replaceVars(await t("expiryLine"))}
          </p>

          <p style="font-size:15px;color:#222;margin:0 0 4px 0;">${await t("regards")}</p>
          <p style="font-size:15px;font-weight:600;color:#004080;margin:0;">KOCHAM team.</p>
        </td></tr>

        <tr><td style="background:#ffffff;padding:24px 56px 40px 56px;text-align:center;">
          <div style="    margin-bottom: 12px;
            padding: 12px 0;
            border-top: 1px solid #e6e6e6;
            border-bottom: 1px solid #e6e6e6;
            text-align: center;">
            <a href="https://www.facebook.com/kochamvietnam/"><img src="cid:facebook@kocham" alt="Facebook" style="height:28px;margin:0 8px;" /></a>
            <a href="https://kocham.vn"><img src="cid:naver@kocham" alt="Website" style="height:28px;margin:0 8px;" /></a>
          </div>
          <p style="font-size:13px;color:#666;margin:4px 0;">© 2025 KOCHAM. All rights reserved.</p>
          <p style="font-size:12px;color:#888;margin:12px 0 0 0;line-height:1.6;max-width:520px;margin-inline:auto;">
            ${await t("footerNote")}
          </p>
          <div style="font-size:12px;color:#888;margin-top:8px;">
            <a href="#" style="color:#555;text-decoration:underline;margin:0 4px;">${await t("footerLinks.privacy")}</a> ·
            <a href="#" style="color:#555;text-decoration:underline;margin:0 4px;">${await t("footerLinks.terms")}</a> ·
            <a href="#" style="color:#555;text-decoration:underline;margin:0 4px;">${await t("footerLinks.help")}</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
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

    const text = `
${replaceVars(await t("greeting"))}
${replaceVars(await t("introLine1"))}
${replaceVars(await t("introLine2"))}
OTP: ${payload.otp}
${replaceVars(await t("expiryLine"))}
${await t("regards")}
KOCHAM team.
`.trim();

    return { subject, text, html, attachments };
  }
}
