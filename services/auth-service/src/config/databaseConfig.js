const { open } = require("sqlite");
const sqlite3 = require("sqlite3").verbose();
const cron = require("node-cron");

class DatabaseConfig {
  constructor(dbPath) {
    this.db = null;
    this.dbPath = dbPath;
  }

  async connect() {
    try {
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });
      console.log("Connected to SQLite database");
      this.setupGDPRCleanup();
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
  }

  async purgeAnonymizedUsers() {
    const cutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.db.run(
      `
      DELETE FROM users 
      WHERE data_anonymized = TRUE 
      AND anonymization_requested_at < ?
    `,
      [cutoff]
    );

    await this.db.run(
      `
      DELETE FROM users 
      WHERE deletion_requested_at < ?
      AND data_anonymized = FALSE
    `,
      [cutoff]
    );

    await this.db.run(`
      DELETE FROM user_sessions 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
  }

  setupGDPRCleanup() {
    cron.schedule("0 2 * * *", this.purgeAnonymizedUsers.bind(this));
  }

  async generateUniqueUsername(email) {
    const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    let username = baseUsername;
    let counter = 1;

    while (true) {
      const existingUser = await this.db.get(
        "SELECT id FROM users WHERE username = ?",
        [username]
      );
      if (!existingUser) break;
      username = `${baseUsername}_${counter}`;
      counter++;
    }
    return username;
  }
}

module.exports = { DatabaseConfig };
