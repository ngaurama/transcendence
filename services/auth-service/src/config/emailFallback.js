class EmailFallback {
  constructor() {
    console.warn("SMTP not configured - using email fallback mode");
    this.isFallback = true;
  }
  
  async verify() {
    console.warn("Email verification skipped - SMTP not configured");
    return true;
  }
  
  async sendEmail(to, subject, html) {
    console.log(`[EMAIL SIMULATION] To: ${to}, Subject: ${subject}`);
    console.log(`[EMAIL CONTENT] ${html}`);
    
    let extractedToken = null;
    if (subject.includes("Password Reset")) {
      const tokenMatch = html.match(/token=([^"&]+)/);
      if (tokenMatch) {
        extractedToken = tokenMatch[1];
        console.log(`[PASSWORD RESET LINK] ${process.env.FRONTEND_URL_LAN}/reset-password?token=${extractedToken}`);
      }
    }
    
    if (subject.includes("Verify Your Email")) {
      const tokenMatch = html.match(/token=([^"&]+)/);
      if (tokenMatch) {
        extractedToken = tokenMatch[1];
        console.log(`[EMAIL VERIFICATION LINK] ${process.env.FRONTEND_URL_LAN}/verify-email?token=${extractedToken}`);
      }
    }
    
    if (extractedToken) {
      this.lastGeneratedToken = {
        email: to,
        token: extractedToken,
        type: subject.includes("Password Reset") ? "password_reset" : "email_verification",
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    }
    
    return { success: true, isFallback: true, token: extractedToken };
  }
  getLastToken() {
    return this.lastGeneratedToken;
  }
}

module.exports = { EmailFallback };
