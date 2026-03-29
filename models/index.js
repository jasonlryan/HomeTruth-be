const Sequelize = require("sequelize");
const db = require("../config/database");

// Import models
const User = require("./User");
const UserProfile = require("./userProfiles");
const QuizQuestion = require("./quizQuestions");
const QuizOption = require("./quizOption");

const QuizAnswer = require("./quizAnswers");
const BookmarkedListing = require("./bookmarked");
const SavedNote = require("./savedNotes");
const AiQuery = require("./notification");
const Document = require("./documents");
const BudgetCalculation = require("./budgetCalculations");
const UserSetting = require("./userSettings");
const UserExtension = require("./userExtensions");
const Subscription = require("./subscriptions");
const ProfilePreferences = require("./profilePreferences");
const ChatHistory = require("./chatHistory");
const NotificationSettings = require("./notification");
const PrivacySettings = require('./privacySettings');
const UserDocument = require("./userDocument");
const UserDocumentChatHistory = require("./userDocumentChatHistory");
const Waitlist = require("./waitlist");
const GuestChatSession = require("./guestChatSession");
const Article = require("./article");





// Define associations
User.hasOne(UserProfile, { foreignKey: "user_id" });
UserProfile.belongsTo(User, { foreignKey: "user_id" });
// Define associations


User.hasOne(ProfilePreferences, { foreignKey: "user_id" });
ProfilePreferences.belongsTo(User, { foreignKey: "user_id" });

// QuizQuestion.hasMany(QuizAnswer, { foreignKey: "question_id" });
// QuizAnswer.belongsTo(QuizQuestion, { foreignKey: "question_id" });

QuizQuestion.hasMany(QuizOption, {
  foreignKey: 'question_id',
  onDelete: 'CASCADE'
});

QuizOption.belongsTo(QuizQuestion, {
  foreignKey: 'question_id'
});

QuizQuestion.hasMany(QuizAnswer, {
  foreignKey: 'question_id',
  onDelete: 'CASCADE'
});

QuizAnswer.belongsTo(QuizQuestion, {
  foreignKey: 'question_id'
});

QuizOption.hasMany(QuizAnswer, {
  foreignKey: 'option_id'
});

QuizAnswer.belongsTo(QuizOption, {
  foreignKey: 'option_id'
});


User.hasMany(ChatHistory, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});

ChatHistory.belongsTo(User, {
  foreignKey: 'user_id'
});







User.hasMany(SavedNote, { foreignKey: "user_id" });
SavedNote.belongsTo(User, { foreignKey: "user_id" });



User.hasMany(AiQuery, { foreignKey: "user_id" });
AiQuery.belongsTo(User, { foreignKey: "user_id" });


User.hasMany(BudgetCalculation, { foreignKey: "user_id" });
BudgetCalculation.belongsTo(User, { foreignKey: "user_id" });



User.hasOne(UserSetting, { foreignKey: "user_id" });
UserSetting.belongsTo(User, { foreignKey: "user_id" });

User.hasOne(UserExtension, { foreignKey: "user_id" });
UserExtension.belongsTo(User, { foreignKey: "user_id" });

User.hasOne(Subscription, { foreignKey: "user_id" });
Subscription.belongsTo(User, { foreignKey: "user_id" });

User.hasMany(NotificationSettings, { foreignKey: "user_id" });
NotificationSettings.belongsTo(User, { foreignKey: "user_id" });


User.hasMany(BookmarkedListing, { foreignKey: "user_id", onDelete: 'CASCADE' });
BookmarkedListing.belongsTo(User, { foreignKey: "user_id" });


// Define associations
User.hasOne(PrivacySettings, { 
  foreignKey: "user_id",
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

PrivacySettings.belongsTo(User, { 
  foreignKey: "user_id" 
});

// UserDocument associations
User.hasMany(UserDocument, { 
  foreignKey: "user_id",
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

UserDocument.belongsTo(User, { 
  foreignKey: "user_id" 
});

// UserDocumentChatHistory associations
User.hasMany(UserDocumentChatHistory, { 
  foreignKey: "user_id",
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

UserDocument.hasMany(UserDocumentChatHistory, { 
  foreignKey: "document_id",
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

UserDocumentChatHistory.belongsTo(User, { 
  foreignKey: "user_id" 
});

UserDocumentChatHistory.belongsTo(UserDocument, { 
  foreignKey: "document_id" 
});

// Article associations
User.hasMany(Article, {
  foreignKey: "created_by",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Article.belongsTo(User, {
  foreignKey: "created_by",
});

// Sync
db.sync({ alter: true })
  .then(async () => {
    console.log("All tables created and associated");

    // Run seeders
    (async () => {
      try {
        const { seedQuizQuestions } = require("../Seeders/seedQuizQuestions");
        const { seedQuizOptions } = require("../Seeders/seedQuizOptions");
        const { seedAdminUser } = require("../Seeders/seedAdminUser");
    
        await seedQuizQuestions();
        await seedQuizOptions();
        await seedAdminUser();
      } catch (error) {
        console.error("Error running seeders:", error);
      }
    })();
    
   })
  .catch((err) => {
    console.error("Error syncing database:", err);
  });
module.exports = {
  User, 
  UserProfile,
  QuizQuestion,
  QuizOption,
  QuizAnswer,
  BookmarkedListing,
  SavedNote,
  AiQuery,
  Document,
  BudgetCalculation,
  UserSetting,
  UserExtension,
  Subscription,
  ProfilePreferences,
  ChatHistory,
  NotificationSettings,
  UserDocument,
  UserDocumentChatHistory,
  Waitlist,
  GuestChatSession,
  Article,
};
