"use strict";

const timestampColumns = (Sequelize) => ({
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
});

const snakeTimestampColumns = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
});

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name =
      typeof table === "string"
        ? table
        : table.tableName || table.table_name || table.name;
    return name === tableName;
  });
};

const createTableIfMissing = async (
  queryInterface,
  tableName,
  attributes,
  options = {}
) => {
  if (await tableExists(queryInterface, tableName)) return false;
  await queryInterface.createTable(tableName, attributes, options);
  return true;
};

const addIndexIfMissing = async (queryInterface, tableName, fields, options) => {
  if (!(await tableExists(queryInterface, tableName))) return;

  const indexes = await queryInterface.showIndex(tableName);
  const indexName = options.name;
  const exists = indexes.some((index) => index.name === indexName);
  if (!exists) {
    await queryInterface.addIndex(tableName, fields, options);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const createdTables = new Set();
    const createBaselineTable = async (tableName, attributes, options) => {
      if (await createTableIfMissing(queryInterface, tableName, attributes, options)) {
        createdTables.add(tableName);
      }
    };
    const addBaselineIndex = async (tableName, fields, options) => {
      if (!createdTables.has(tableName)) return;
      await addIndexIfMissing(queryInterface, tableName, fields, options);
    };

    await createBaselineTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      password: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM("user", "admin", "pro"),
        defaultValue: "user",
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      home_address: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("quiz_questions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      question_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("multiple_choice", "single_choice", "text", "rating"),
        allowNull: false,
        defaultValue: "single_choice",
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("quiz_options", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      question_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "quiz_questions",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      option: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      image: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("quiz_answers", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      question_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "quiz_questions",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      option_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "quiz_options",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      answer: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("chat_history", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      conversation_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      userMessage: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      assistantReply: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      is_saved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("saved_notes", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      chat_history_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "chat_history",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      title: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      user_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      assistant_reply: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("notification_Settings", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      documentAnalysisComplete: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      chatSummaryFollowUps: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      newAiInsightsAvailable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      propertyAlerts: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      extensionSaveConfirmations: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      tipsAndProductUpdates: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("documents", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: Sequelize.CHAR(36),
        allowNull: true,
      },
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      originalName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      fileType: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      fileSize: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      textContent: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      chunksCount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      processing_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      documentId: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      priority: {
        type: Sequelize.ENUM("Low", "Normal", "High", "Critical"),
        allowNull: true,
        defaultValue: "Normal",
      },
      source: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      entryMethod: {
        type: Sequelize.ENUM("file_upload", "url_scrape", "manual_entry"),
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("budget_calculations", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      household_income: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      other_income: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      credit_score_range: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      down_payment: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      monthly_debt_payments: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      max_housing_payment: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      loan_term_years: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      property_tax_rate: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      insurance_cost: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      hoa_fees: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      expected_income_changes: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      conversation_history: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      estimated_monthly_payment_range: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_saved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("user_settings", {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      use_behavioral_personalization: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      use_chat_history: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      opt_out_automated_profiling: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      allow_anonymous_data: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      gdpr_consent: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("user_extensions", {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      extension_installed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      install_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    }, { timestamps: false });

    await createBaselineTable("subscriptions", {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      plan: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    }, { timestamps: false });

    await createBaselineTable("profile_preferences", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      communication_tone: {
        type: Sequelize.ENUM("formal", "friendly", "encouraging"),
        allowNull: true,
      },
      communication_style: {
        type: Sequelize.ENUM("bullet_points", "narrative_summary", "visual_aids"),
        allowNull: true,
      },
      behavior: {
        type: Sequelize.ENUM("follow_ups", "link_notes", "checklist"),
        allowNull: true,
      },
      use_profile_personalization: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("bookmarked_listings", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      property_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      property_details: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("privacy_settings", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      enableBehaviorBasedPersonalization: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      useChatHistoryToRefineInsights: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      optOutOfAttitudinalProfiling: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      gdprDataCollectionConsent: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      allowAnonymousUsageAnalytics: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      disableDocumentRetention: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      documentRetentionPeriod: {
        type: Sequelize.INTEGER,
        defaultValue: 90,
      },
      gdprConsentDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      analyticsConsentDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("userDocuments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      doc_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("processing", "ready", "urgent", "expiring", "error"),
        defaultValue: "processing",
      },
      category: {
        type: Sequelize.ENUM(
          "financial",
          "legal",
          "maintenance",
          "compliance",
          "surveys_reports",
          "property_details"
        ),
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      file_type: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      text_content: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      chunks_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      vector_ids: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ai_analysis: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      ...snakeTimestampColumns(Sequelize),
    });

    await createBaselineTable("user_document_chat_history", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      document_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "userDocuments",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      conversation_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      user_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      assistant_reply: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      has_context: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      is_saved: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ...snakeTimestampColumns(Sequelize),
    });

    await createBaselineTable("waitlist", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM("pending", "notified", "registered"),
        defaultValue: "pending",
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await createBaselineTable("guest_chat_session", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      session_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      user_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      assistant_reply: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("articles", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      author: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      excerpt: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      content: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      featured_image: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM(
          "article",
          "insight",
          "guide",
          "template",
          "educational",
          "document"
        ),
        defaultValue: "article",
      },
      status: {
        type: Sequelize.ENUM("draft", "published"),
        defaultValue: "draft",
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      ...timestampColumns(Sequelize),
    });

    await createBaselineTable("user_profiles", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      preferences: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      onboarding_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ...timestampColumns(Sequelize),
    });

    await addBaselineIndex("chat_history", ["conversation_id"], {
      name: "chat_history_conversation_id_idx",
    });
    await addBaselineIndex("chat_history", ["is_saved"], {
      name: "chat_history_is_saved_idx",
    });
    await addBaselineIndex("saved_notes", ["user_id"], {
      name: "saved_notes_user_id_idx",
    });
    await addBaselineIndex("saved_notes", ["chat_history_id"], {
      name: "saved_notes_chat_history_id_idx",
    });
    await addBaselineIndex("guest_chat_session", ["session_id"], {
      name: "guest_chat_session_session_id_idx",
    });
    await addBaselineIndex(
      "user_document_chat_history",
      ["conversation_id"],
      { name: "user_document_chat_history_conversation_id_idx" }
    );
    await addBaselineIndex(
      "user_document_chat_history",
      ["is_saved"],
      { name: "user_document_chat_history_is_saved_idx" }
    );
  },

  async down() {
    // Baseline migrations are intentionally not destructive. Future migrations
    // should provide precise rollback steps for the schema changes they make.
  },
};
