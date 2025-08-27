const nodemailer = require("nodemailer");

class EmailConfig {
  constructor(smtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port),
      secure: parseInt(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.email,
        pass: smtpConfig.password
      }
    });
  }

  async verify() {
    try {
      await this.transporter.verify();
      console.log("SMTP Verified - Ready to send emails");
    } catch (error) {
      console.error("SMTP Verification Failed:", error);
      throw error;
    }
  }

  async sendEmail(to, subject, html) {
    try {
      await this.transporter.sendMail({
        from: `"ft_transcendence" <${this.transporter.options.auth.user}>`,
        to,
        subject,
        html,
      });
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}

module.exports = { EmailConfig };
