const { open } = require("sqlite");
const sqlite3 = require("sqlite3").verbose();

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
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
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
