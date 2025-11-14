// src/services/emailTemplates.ts

export const verificationEmail = (name: string, code: string) => ({
  template: 'verification-email',  // matches template name in Resend
  variables: { 
    name,
    code,
  },
});

export const passwordResetEmail = (name: string, link: string) => ({
  template: 'password-reset-email',  // matches template name in Resend
  variables: {
    name,
    link,
  },
});
