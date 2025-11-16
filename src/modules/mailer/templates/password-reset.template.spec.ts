/** biome-ignore-all lint/correctness/noUndeclaredVariables: <explanation> */
import { PasswordResetMailRenderer } from "./password-reset.template";
import { I18nService } from "nestjs-i18n";

describe("PasswordResetMailRenderer", () => {
  let renderer: PasswordResetMailRenderer;
  let i18n: jest.Mocked<I18nService>;

  beforeEach(() => {
    i18n = {
      translate: jest.fn(async (key: string) => {
        const t: Record<string, string> = {
          "mailer.password-reset.subject.en": "Reset your Circo password",
          "mailer.password-reset.subject.ko": "비밀번호 재설정",
          "mailer.password-reset.hi.en": "Hi {{name}}",
          "mailer.password-reset.hi.ko": "{{name}}님",
          "mailer.password-reset.body.en": "We received a request to reset your Circo account password.",
          "mailer.password-reset.body.ko": "회원님의 Circo 계정 비밀번호 재설정 요청이 접수되었습니다.",
          "mailer.password-reset.button.en": "Reset password",
          "mailer.password-reset.button.ko": "비밀번호 재설정",
          "mailer.password-reset.ignore.en": "If you didn't initiate the request, please ignore this email.",
          "mailer.password-reset.ignore.ko": "만약 본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
          "mailer.password-reset.regards.en": "Best regards,",
          "mailer.password-reset.regards.ko": "감사합니다,",
          "mailer.password-reset.team.en": "KOCHAM team",
          "mailer.password-reset.team.ko": "KOCHAM 팀",
          "mailer.password-reset.footer.en": "This email was sent automatically. Please do not reply.",
          "mailer.password-reset.footer.ko": "이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.",
          "mailer.password-reset.privacy.en": "Privacy policy",
          "mailer.password-reset.privacy.ko": "개인정보처리방침",
          "mailer.password-reset.terms.en": "Terms of use",
          "mailer.password-reset.terms.ko": "이용약관",
          "mailer.password-reset.help.en": "Help center",
          "mailer.password-reset.help.ko": "도움말 센터",
        };

        if (key.endsWith(".ko")) return t[key] || key;
        if (key.endsWith(".en")) return t[key] || key;

        return t[key + ".en"] || key;
      }),
    } as any;

    renderer = new PasswordResetMailRenderer(i18n);
  });

  it("renders valid subject, greeting, button, and images in English", async () => {
    const payload = {
      recipient: { email: "user@test.com", name: "Lokachi" },
      resetLink: "https://kocham.vn/reset?token=abc123",
      acceptLanguage: "en",
    } as any;

    const result = await renderer.render(payload);

    expect(result.subject).toContain("Reset your Circo password");
    expect(result.html).toContain("Hi Lokachi");
    expect(result.html).toContain("Reset password");
    expect(result.html).toContain(payload.resetLink);
    expect(result.html).toContain("If you didn't initiate the request");
    expect(result.html).toContain("KOCHAM team");
    expect(result.html).toContain("cid:banner@kocham");
    expect(result.html).toContain("cid:facebook@kocham");
    expect(result.html).toContain("cid:naver@kocham");
    expect(result.html).toContain("Privacy policy");
    expect(result.html).toContain("Terms of use");
    expect(result.html).toContain("Help center");
  });

  it("renders valid subject, greeting, button, and images in Korean", async () => {
    const payload = {
      recipient: { email: "user@test.com", name: "로카치" },
      resetLink: "https://kocham.vn/reset?token=abc123",
      acceptLanguage: "ko",
    } as any;

    const result = await renderer.render(payload);

    expect(result.subject).toContain("비밀번호 재설정");
    expect(result.html).toContain("로카치님");
    expect(result.html).toContain("비밀번호 재설정");
    expect(result.html).toContain(payload.resetLink);
    expect(result.html).toContain("만약 본인이 요청하지 않았다면");
    expect(result.html).toContain("KOCHAM 팀");
    expect(result.html).toContain("cid:banner@kocham");
    expect(result.html).toContain("cid:facebook@kocham");
    expect(result.html).toContain("cid:naver@kocham");
    expect(result.html).toContain("개인정보처리방침");
    expect(result.html).toContain("이용약관");
    expect(result.html).toContain("도움말 센터");
    expect(result.html).toContain("구독 취소");
  });
});
