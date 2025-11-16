/** biome-ignore-all lint/correctness/noUndeclaredVariables: <explanation> */
import { OtpMailRenderer } from "./otp-email.template";
import { I18nService } from "nestjs-i18n";

describe("OtpMailRenderer", () => {
  let renderer: OtpMailRenderer;
  let i18n: jest.Mocked<I18nService>;

  beforeEach(() => {
    i18n = {
      translate: jest.fn(async (key: string) => {
        const translations: Record<string, string> = {
          "mailer.otp.subject": key.includes("ko") ? "이메일 인증" : "Email verification",
          "mailer.otp.greeting": key.includes("ko") ? "{{name}}님," : "Hi {{name}},",
          "mailer.otp.introLine1": key.includes("ko")
            ? "OTP는 계정 확인을 위해 사용됩니다."
            : "Your OTP is used to verify your account.",
          "mailer.otp.introLine2": key.includes("ko")
            ? "아래 코드를 입력하세요."
            : "Please enter the code below.",
          "mailer.otp.expiryLine": key.includes("ko")
            ? "OTP는 {{minutes}}분 후에 만료됩니다."
            : "OTP will expire in {{minutes}} minutes.",
          "mailer.otp.regards": key.includes("ko") ? "감사합니다," : "Best regards,",
          "mailer.otp.contexts.email-verification": key.includes("ko")
            ? "이메일 인증"
            : "Email verification",
          "mailer.otp.contexts.default": key.includes("ko") ? "인증" : "Verification",
          "mailer.otp.footerNote": key.includes("ko")
            ? "이 이메일은 자동으로 발송되었습니다."
            : "This email was sent automatically.",
          "mailer.otp.footerLinks.privacy": key.includes("ko")
            ? "개인정보처리방침"
            : "Privacy policy",
          "mailer.otp.footerLinks.terms": key.includes("ko")
            ? "이용약관"
            : "Terms of use",
          "mailer.otp.footerLinks.help": key.includes("ko")
            ? "도움말 센터"
            : "Help center",
        };
        return translations[key] || key;
      }),
    } as any;

    renderer = new OtpMailRenderer(i18n);
  });

  it("renders valid subject, body, and images in English", async () => {
    const payload = {
      otp: "57200",
      context: "email-verification",
      recipient: { email: "user@test.com", name: "Lokachi" },
      acceptLanguage: "en",
    } as any;

    const result = await renderer.render(payload);

    expect(result.subject).toMatch(/Email verification|Verification/);
    expect(result.html).toContain("Hi Lokachi");
    expect(result.html).toContain("KOCHAM team.");
    expect(result.html).toContain("OTP will expire");
    expect(result.html).toContain("Privacy policy");
    expect(result.html).toContain("Terms of use");
    expect(result.html).toContain("Help center");
    expect(result.html).toContain("cid:banner@kocham");
    expect(result.html).toContain("cid:facebook@kocham");
    expect(result.html).toContain("cid:naver@kocham");
    for (const digit of payload.otp.split("")) {
      expect(result.html).toContain(digit);
    }
  });

  it("renders valid subject, body, and images in Korean", async () => {
    const payload = {
      otp: "57200",
      context: "email-verification",
      recipient: { email: "user@test.com", name: "로카치" },
      acceptLanguage: "ko",
    } as any;

    const result = await renderer.render(payload);

    expect(result.subject).toMatch(/이메일 인증|인증/);
    expect(result.html).toContain("로카치님");
    expect(result.html).toContain("KOCHAM team.");
    expect(result.html).toContain("OTP는");
    expect(result.html).toContain("개인정보처리방침");
    expect(result.html).toContain("이용약관");
    expect(result.html).toContain("도움말 센터");
    expect(result.html).toContain("cid:banner@kocham");
    expect(result.html).toContain("cid:facebook@kocham");
    expect(result.html).toContain("cid:naver@kocham");
    for (const digit of payload.otp.split("")) {
      expect(result.html).toContain(digit);
    }
  });
});
