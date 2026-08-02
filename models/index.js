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
const Property = require("./property");
const PropertyAddress = require("./propertyAddress");
const PropertyPerson = require("./propertyPerson");
const PropertyDocument = require("./propertyDocument");
const EvidenceSource = require("./evidenceSource");
const PropertyFact = require("./propertyFact");
const PropertyTask = require("./propertyTask");
const PropertyTaskStatusEvent = require("./propertyTaskStatusEvent");
const Partner = require("./partner");
const PartnerCohort = require("./partnerCohort");
const CohortMember = require("./cohortMember");
const ConsentRecord = require("./consentRecord");
const PilotEvent = require("./pilotEvent");
const PartnerProgramme = require("./partnerProgramme");
const PartnerCampaign = require("./partnerCampaign");
const PartnerProgrammeAuditEvent = require("./partnerProgrammeAuditEvent");





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

// Property + people spine associations
User.hasMany(Property, {
  foreignKey: "created_by_user_id",
  as: "createdProperties",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Property.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "createdBy",
});

Property.hasMany(PropertyAddress, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyAddress.belongsTo(Property, {
  foreignKey: "property_id",
});

Property.hasMany(PropertyPerson, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyPerson.belongsTo(Property, {
  foreignKey: "property_id",
});

User.hasMany(PropertyPerson, {
  foreignKey: "user_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyPerson.belongsTo(User, {
  foreignKey: "user_id",
});

Property.hasMany(PropertyDocument, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyDocument.belongsTo(Property, {
  foreignKey: "property_id",
});

UserDocument.hasMany(PropertyDocument, {
  foreignKey: "user_document_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyDocument.belongsTo(UserDocument, {
  foreignKey: "user_document_id",
});

User.hasMany(PropertyDocument, {
  foreignKey: "linked_by_user_id",
  as: "linkedPropertyDocuments",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PropertyDocument.belongsTo(User, {
  foreignKey: "linked_by_user_id",
  as: "linkedBy",
});

Property.hasMany(EvidenceSource, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

EvidenceSource.belongsTo(Property, {
  foreignKey: "property_id",
});

PropertyDocument.hasMany(EvidenceSource, {
  foreignKey: "property_document_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

EvidenceSource.belongsTo(PropertyDocument, {
  foreignKey: "property_document_id",
});

UserDocument.hasMany(EvidenceSource, {
  foreignKey: "user_document_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

EvidenceSource.belongsTo(UserDocument, {
  foreignKey: "user_document_id",
});

User.hasMany(EvidenceSource, {
  foreignKey: "extracted_by_user_id",
  as: "extractedEvidenceSources",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

EvidenceSource.belongsTo(User, {
  foreignKey: "extracted_by_user_id",
  as: "extractedBy",
});

Property.hasMany(PropertyFact, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyFact.belongsTo(Property, {
  foreignKey: "property_id",
});

EvidenceSource.hasMany(PropertyFact, {
  foreignKey: "evidence_source_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PropertyFact.belongsTo(EvidenceSource, {
  foreignKey: "evidence_source_id",
});

User.hasMany(PropertyFact, {
  foreignKey: "created_by_user_id",
  as: "createdPropertyFacts",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PropertyFact.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "createdBy",
});

Property.hasMany(PropertyTask, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyTask.belongsTo(Property, {
  foreignKey: "property_id",
});

User.hasMany(PropertyTask, {
  foreignKey: "assigned_user_id",
  as: "assignedPropertyTasks",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PropertyTask.belongsTo(User, {
  foreignKey: "assigned_user_id",
  as: "assignedUser",
});

User.hasMany(PropertyTask, {
  foreignKey: "status_updated_by_user_id",
  as: "updatedPropertyTasks",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PropertyTask.belongsTo(User, {
  foreignKey: "status_updated_by_user_id",
  as: "statusUpdatedBy",
});

PropertyTask.hasMany(PropertyTaskStatusEvent, {
  foreignKey: "property_task_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyTaskStatusEvent.belongsTo(PropertyTask, {
  foreignKey: "property_task_id",
});

Property.hasMany(PropertyTaskStatusEvent, {
  foreignKey: "property_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PropertyTaskStatusEvent.belongsTo(Property, {
  foreignKey: "property_id",
});

User.hasMany(PropertyTaskStatusEvent, {
  foreignKey: "user_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PropertyTaskStatusEvent.belongsTo(User, {
  foreignKey: "user_id",
});

// Partner cohort and consent associations
Partner.hasMany(PartnerProgramme, {
  foreignKey: "partner_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PartnerProgramme.belongsTo(Partner, {
  foreignKey: "partner_id",
});

PartnerProgramme.hasMany(PartnerCampaign, {
  foreignKey: "partner_programme_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PartnerCampaign.belongsTo(PartnerProgramme, {
  foreignKey: "partner_programme_id",
});

PartnerProgramme.hasMany(PartnerCohort, {
  foreignKey: "partner_programme_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PartnerCohort.belongsTo(PartnerProgramme, {
  foreignKey: "partner_programme_id",
});

PartnerCampaign.hasMany(PartnerCohort, {
  foreignKey: "partner_campaign_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PartnerCohort.belongsTo(PartnerCampaign, {
  foreignKey: "partner_campaign_id",
});

PartnerProgramme.hasMany(PartnerProgrammeAuditEvent, {
  foreignKey: "partner_programme_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PartnerProgrammeAuditEvent.belongsTo(PartnerProgramme, {
  foreignKey: "partner_programme_id",
});

for (const [foreignKey, as] of [
  ["owner_user_id", "owner"],
  ["created_by_user_id", "programmeCreator"],
  ["updated_by_user_id", "programmeUpdater"],
]) {
  PartnerProgramme.belongsTo(User, { foreignKey, as });
  User.hasMany(PartnerProgramme, {
    foreignKey,
    as: `${as}Programmes`,
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
}

PartnerProgrammeAuditEvent.belongsTo(User, {
  foreignKey: "actor_user_id",
  as: "actor",
});

User.hasMany(PartnerProgrammeAuditEvent, {
  foreignKey: "actor_user_id",
  as: "partnerProgrammeAuditEvents",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Partner.hasMany(PartnerCohort, {
  foreignKey: "partner_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

PartnerCohort.belongsTo(Partner, {
  foreignKey: "partner_id",
});

PartnerCohort.hasMany(CohortMember, {
  foreignKey: "partner_cohort_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

CohortMember.belongsTo(PartnerCohort, {
  foreignKey: "partner_cohort_id",
});

User.hasMany(CohortMember, {
  foreignKey: "user_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

CohortMember.belongsTo(User, {
  foreignKey: "user_id",
});

Property.hasMany(CohortMember, {
  foreignKey: "property_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

CohortMember.belongsTo(Property, {
  foreignKey: "property_id",
});

Partner.hasMany(ConsentRecord, {
  foreignKey: "partner_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

ConsentRecord.belongsTo(Partner, {
  foreignKey: "partner_id",
});

PartnerCohort.hasMany(ConsentRecord, {
  foreignKey: "partner_cohort_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

ConsentRecord.belongsTo(PartnerCohort, {
  foreignKey: "partner_cohort_id",
});

CohortMember.hasMany(ConsentRecord, {
  foreignKey: "cohort_member_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

ConsentRecord.belongsTo(CohortMember, {
  foreignKey: "cohort_member_id",
});

User.hasMany(ConsentRecord, {
  foreignKey: "user_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

ConsentRecord.belongsTo(User, {
  foreignKey: "user_id",
});

Property.hasMany(ConsentRecord, {
  foreignKey: "property_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

ConsentRecord.belongsTo(Property, {
  foreignKey: "property_id",
});

Partner.hasMany(PilotEvent, {
  foreignKey: "partner_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PilotEvent.belongsTo(Partner, {
  foreignKey: "partner_id",
});

PartnerCohort.hasMany(PilotEvent, {
  foreignKey: "partner_cohort_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PilotEvent.belongsTo(PartnerCohort, {
  foreignKey: "partner_cohort_id",
});

CohortMember.hasMany(PilotEvent, {
  foreignKey: "cohort_member_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PilotEvent.belongsTo(CohortMember, {
  foreignKey: "cohort_member_id",
});

User.hasMany(PilotEvent, {
  foreignKey: "user_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PilotEvent.belongsTo(User, {
  foreignKey: "user_id",
});

Property.hasMany(PilotEvent, {
  foreignKey: "property_id",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

PilotEvent.belongsTo(Property, {
  foreignKey: "property_id",
});

const runSeeders = async () => {
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
};

if (process.env.AUTO_SYNC_DB === "true") {
  db.sync({ alter: true })
    .then(async () => {
      console.log("AUTO_SYNC_DB enabled: database schema synced from models");
      await runSeeders();
    })
    .catch((err) => {
      console.error("Error syncing database:", err);
    });
} else {
  console.log(
    "Skipping automatic Sequelize sync. Run `npm run db:migrate` for schema changes, or set AUTO_SYNC_DB=true for local prototyping."
  );
}

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
  Property,
  PropertyAddress,
  PropertyPerson,
  PropertyDocument,
  EvidenceSource,
  PropertyFact,
  PropertyTask,
  PropertyTaskStatusEvent,
  Partner,
  PartnerCohort,
  CohortMember,
  ConsentRecord,
  PilotEvent,
  PartnerProgramme,
  PartnerCampaign,
  PartnerProgrammeAuditEvent,
};
