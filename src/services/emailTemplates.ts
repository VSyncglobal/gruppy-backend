// src/services/emailTemplates.ts

export const verificationEmail = (name: string, code: string) => ({
  subject: "Verify your Gruppy Account",
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Welcome to Gruppy, ${name}!</h2>
      <p>Your verification code is:</p>
      <h1 style="color: #4CAF50;">${code}</h1>
      <p>This code expires in 10 minutes.</p>
      <br/>
      <p>— The Gruppy Team</p>
    </div>
  `
});

export const passwordResetEmail = (name: string, link: string) => ({
  subject: "Reset your Gruppy Password",
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hello ${name},</h2>
      <p>Click below to reset your password:</p>
      <a href="${link}">Reset Password</a>
      <p>This link expires in 15 minutes.</p>
      <br/>
      <p>— Gruppy Security Team</p>
    </div>
  `
});
