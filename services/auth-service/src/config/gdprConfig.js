// services/gdprService.js
const cron = require("node-cron");

class GDPRService {
  constructor(dbService, emailService) {
    this.dbService = dbService;
    this.emailService = emailService;
    this.cleanupJob = null;
  }

  async init() {
    await this.setupCleanupSchedule();
    await this.setupDeletionReminders();
  }

  async setupCleanupSchedule() {
    this.cleanupJob = cron.schedule(
      "0 2 * * *",
      this.runCleanup.bind(this),
      { timezone: "UTC" }
    );

    console.log("GDPR cleanup scheduled: daily at 02:00 UTC");
  }

  async runCleanup() {
    try {
      console.log("Starting GDPR compliance cleanup...");
      
      const stats = {
        anonymizedAccounts: 0,
        deletedAccounts: 0,
        orphanedSessions: 0,
        orphanedRecords: 0
      };

      await this.cleanupAnonymizedAccounts(stats);
      await this.cleanupDeletedAccounts(stats);
      await this.cleanupOrphanedData(stats);
      await this.cleanupOldTokens(stats);

      console.log("GDPR cleanup completed:", stats);
      
      await this.sendCleanupReport(stats);

    } catch (error) {
      console.error("GDPR cleanup failed:", error);
      await this.sendCleanupAlert(error);
    }
  }

  async cleanupAnonymizedAccounts(stats) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await this.dbService.db.run(
      `DELETE FROM users 
       WHERE data_anonymized = TRUE 
       AND anonymization_requested_at < ?`,
      [thirtyDaysAgo]
    );

    stats.anonymizedAccounts = result.changes;
  }

  async cleanupDeletedAccounts(stats) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await this.dbService.db.run(
      `DELETE FROM users 
       WHERE deletion_requested_at IS NOT NULL 
       AND deletion_requested_at < ?
       AND data_anonymized = FALSE`,
      [thirtyDaysAgo]
    );

    stats.deletedAccounts = result.changes;
  }

  async cleanupOrphanedData(stats) {
    const tablesToClean = [
      'user_sessions',
      'friendships',
      'friend_requests',
      'game_participants',
      'tournament_participants',
      'matchmaking_queue',
      'user_game_stats',
      'detailed_game_stats'
    ];

    let totalCleaned = 0;
    for (const table of tablesToClean) {
      const result = await this.dbService.db.run(
        `DELETE FROM ${table} 
         WHERE user_id NOT IN (SELECT id FROM users)`
      );
      totalCleaned += result.changes;
    }

    stats.orphanedRecords = totalCleaned;
  }

  async cleanupOldTokens(stats) {
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    
    const tokenTypes = [
      'email_verification_tokens',
      'password_reset_tokens'
    ];

    for (const table of tokenTypes) {
      await this.dbService.db.run(
        `DELETE FROM ${table} 
         WHERE expires_at < ? OR used_at IS NOT NULL`,
        [fortyFiveDaysAgo]
      );
    }
  }

  async setupDeletionReminders() {
    // Send reminders 7 days before scheduled deletion
    cron.schedule(
      "0 3 * * *", // 3:00 AM daily
      this.sendDeletionReminders.bind(this),
      { timezone: "UTC" }
    );
  }

  async sendDeletionReminders() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const usersToRemind = await this.dbService.db.all(
      `SELECT id, email, username, deletion_requested_at 
       FROM users 
       WHERE deletion_requested_at IS NOT NULL 
       AND deletion_requested_at < ?
       AND data_anonymized = FALSE`,
      [sevenDaysFromNow]
    );

    for (const user of usersToRemind) {
      await this.emailService.sendDeletionReminder(user);
    }
  }

  async sendCleanupReport(stats) {
    const report = {
      timestamp: new Date().toISOString(),
      stats: stats,
      status: 'completed'
    };

    console.log("GDPR Cleanup Report:", JSON.stringify(report, null, 2));
  }

  async sendCleanupAlert(error) {
    const alert = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      status: 'failed'
    };

    console.error("GDPR Cleanup Alert:", JSON.stringify(alert, null, 2));
  }

  async stop() {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
    }
  }
}

module.exports = { GDPRService };
