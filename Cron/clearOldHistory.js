const cron = require("node-cron");
const { ChatHistory } = require("../models/index");
const { Op } = require("sequelize");

/**
 * Cron job to clean up old unsaved chat history
 * Runs daily at 2:00 AM to delete chat records that are:
 * - Not saved (is_saved = false)
 * - Created more than 7 days ago
 */

const cleanupOldChatHistory = async () => {
  try {
    console.log("Starting chat history cleanup...");
    
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Delete unsaved chat history older than 7 days
    const deletedCount = await ChatHistory.destroy({
      where: {
        is_saved: false,
        createdAt: {
          [Op.lt]: sevenDaysAgo
        }
      }
    });
    
    console.log(`Chat history cleanup completed. Deleted ${deletedCount} old unsaved chat records.`);
    
    // Optional: Log some statistics
    const totalChatRecords = await ChatHistory.count();
    const savedChatRecords = await ChatHistory.count({
      where: { is_saved: true }
    });
    
    console.log(`Current chat statistics:
      - Total chat records: ${totalChatRecords}
      - Saved chat records: ${savedChatRecords}
      - Unsaved chat records: ${totalChatRecords - savedChatRecords}
    `);
    
  } catch (error) {
    console.error("Error during chat history cleanup:", error);
    
    // Optional: You might want to send an alert/notification about the failure
    // For example, send an email to admin or log to monitoring service
  }
};

// Schedule the cleanup job to run daily at 2:00 AM
// Format: second minute hour day-of-month month day-of-week
cron.schedule("0 0 2 * * *", cleanupOldChatHistory, {
  scheduled: true,
  timezone: "UTC" // Adjust timezone as needed
});

// Alternative schedules you might consider:
// Every day at midnight: "0 0 0 * * *"
// Every day at 3:00 AM: "0 0 3 * * *"
// Every Sunday at 2:00 AM: "0 0 2 * * 0"
// Every 6 hours: "0 0 */6 * * *"

console.log("Chat history cleanup cron job scheduled to run daily at 2:00 AM UTC");

// Optional: Run cleanup immediately on startup (useful for testing)
// cleanupOldChatHistory();

// Export the cleanup function for manual execution if needed
module.exports = {
  cleanupOldChatHistory,
  
  // Alternative function to cleanup with custom days
  cleanupOldChatHistoryCustom: async (daysOld = 7) => {
    try {
      console.log(`Starting custom chat history cleanup for records older than ${daysOld} days...`);
      
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysOld);
      
      const deletedCount = await ChatHistory.destroy({
        where: {
          is_saved: false,
          createdAt: {
            [Op.lt]: targetDate
          }
        }
      });
      
      console.log(`Custom cleanup completed. Deleted ${deletedCount} old unsaved chat records.`);
      return deletedCount;
      
    } catch (error) {
      console.error("Error during custom chat history cleanup:", error);
      throw error;
    }
  }
};