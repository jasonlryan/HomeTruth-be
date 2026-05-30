"use strict";

const timestampColumns = (Sequelize) => ({
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

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("partners", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      partner_type: {
        type: Sequelize.ENUM(
          "insurer",
          "lender",
          "estate_agent",
          "property_developer",
          "other"
        ),
        allowNull: false,
        defaultValue: "insurer",
      },
      status: {
        type: Sequelize.ENUM("active", "paused", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      external_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      reporting_mode: {
        type: Sequelize.ENUM(
          "none",
          "aggregate_only",
          "individual_with_consent"
        ),
        allowNull: false,
        defaultValue: "aggregate_only",
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("partners", ["partner_type"], {
      name: "idx_partners_partner_type",
    });
    await queryInterface.addIndex("partners", ["status"], {
      name: "idx_partners_status",
    });
    await queryInterface.addIndex("partners", ["external_ref"], {
      name: "idx_partners_external_ref",
    });

    await queryInterface.createTable("partner_cohorts", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "partners",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      cohort_key: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("planned", "active", "paused", "closed", "archived"),
        allowNull: false,
        defaultValue: "planned",
      },
      target_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      external_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      reporting_level: {
        type: Sequelize.ENUM(
          "none",
          "aggregate_only",
          "individual_with_consent"
        ),
        allowNull: false,
        defaultValue: "aggregate_only",
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("partner_cohorts", ["partner_id"], {
      name: "idx_partner_cohorts_partner_id",
    });
    await queryInterface.addIndex("partner_cohorts", ["cohort_key"], {
      name: "uniq_partner_cohorts_cohort_key",
      unique: true,
    });
    await queryInterface.addIndex("partner_cohorts", ["status"], {
      name: "idx_partner_cohorts_status",
    });
    await queryInterface.addIndex(
      "partner_cohorts",
      ["partner_id", "external_ref"],
      { name: "idx_partner_cohorts_partner_external_ref" }
    );

    await queryInterface.createTable("cohort_members", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partner_cohort_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "partner_cohorts",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "properties",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      external_member_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      membership_status: {
        type: Sequelize.ENUM(
          "invited",
          "onboarded",
          "active",
          "withdrawn",
          "removed",
          "completed"
        ),
        allowNull: false,
        defaultValue: "invited",
      },
      source_type: {
        type: Sequelize.ENUM("manual", "import", "partner_api", "system"),
        allowNull: false,
        defaultValue: "manual",
      },
      invited_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("cohort_members", ["partner_cohort_id"], {
      name: "idx_cohort_members_partner_cohort_id",
    });
    await queryInterface.addIndex("cohort_members", ["user_id"], {
      name: "idx_cohort_members_user_id",
    });
    await queryInterface.addIndex("cohort_members", ["property_id"], {
      name: "idx_cohort_members_property_id",
    });
    await queryInterface.addIndex("cohort_members", ["membership_status"], {
      name: "idx_cohort_members_status",
    });
    await queryInterface.addIndex(
      "cohort_members",
      ["partner_cohort_id", "external_member_ref"],
      { name: "idx_cohort_members_external_ref" }
    );
    await queryInterface.addIndex(
      "cohort_members",
      ["partner_cohort_id", "user_id"],
      { name: "idx_cohort_members_cohort_user" }
    );

    await queryInterface.createTable("consent_records", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partner_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "partners",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      partner_cohort_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "partner_cohorts",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      cohort_member_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "cohort_members",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "properties",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      consent_scope: {
        type: Sequelize.ENUM(
          "hometruth_processing",
          "partner_reporting",
          "partner_contact_servicing",
          "individual_report_access",
          "aggregate_analytics"
        ),
        allowNull: false,
      },
      consent_type: {
        type: Sequelize.ENUM(
          "processing",
          "reporting",
          "contact",
          "report_access",
          "analytics"
        ),
        allowNull: false,
      },
      consent_version: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      consent_text_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("granted", "withdrawn", "expired", "superseded"),
        allowNull: false,
        defaultValue: "granted",
      },
      granted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      withdrawn_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      recorded_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      source_type: {
        type: Sequelize.ENUM(
          "onboarding",
          "user_settings",
          "partner_import",
          "admin",
          "system"
        ),
        allowNull: false,
        defaultValue: "onboarding",
      },
      source_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("consent_records", ["partner_id"], {
      name: "idx_consent_records_partner_id",
    });
    await queryInterface.addIndex("consent_records", ["partner_cohort_id"], {
      name: "idx_consent_records_partner_cohort_id",
    });
    await queryInterface.addIndex("consent_records", ["cohort_member_id"], {
      name: "idx_consent_records_cohort_member_id",
    });
    await queryInterface.addIndex("consent_records", ["user_id"], {
      name: "idx_consent_records_user_id",
    });
    await queryInterface.addIndex("consent_records", ["property_id"], {
      name: "idx_consent_records_property_id",
    });
    await queryInterface.addIndex(
      "consent_records",
      ["consent_scope", "status"],
      { name: "idx_consent_records_scope_status" }
    );
    await queryInterface.addIndex("consent_records", ["granted_at"], {
      name: "idx_consent_records_granted_at",
    });
    await queryInterface.addIndex("consent_records", ["withdrawn_at"], {
      name: "idx_consent_records_withdrawn_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("consent_records");
    await queryInterface.dropTable("cohort_members");
    await queryInterface.dropTable("partner_cohorts");
    await queryInterface.dropTable("partners");
  },
};
