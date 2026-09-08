import { loadMailConfig } from './mail.config';

describe('mail configuration', () => {
  it('keeps email delivery disabled without SMTP settings', () => {
    expect(loadMailConfig({})).toBeNull();
  });

  it('accepts Gmail SMTP with an app password', () => {
    expect(
      loadMailConfig({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'sender@example.com',
        SMTP_PASSWORD: 'app-password',
        SMTP_FROM: 'Task Manager <sender@example.com>',
        INVITATION_URL_BASE: 'https://app.example.com',
      }),
    ).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      from: 'Task Manager <sender@example.com>',
      invitationBaseUrl: 'https://app.example.com',
    });
  });
});
