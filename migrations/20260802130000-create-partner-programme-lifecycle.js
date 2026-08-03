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

const actorReference = (Sequelize) => ({
  type: Sequelize.INTEGER,
  allowNull: true,
  references: { model: "users", key: "id" },
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("partners", "partner_type", {
      type: Sequelize.ENUM(
        "insurer",
        "mortgage_provider",
        "home_developer",
        "other",
        "lender",
        "estate_agent",
        "property_developer"
      ),
      allowNull: false,
      defaultValue: "other",
    });

    await queryInterface.createTable("partner_programmes", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partners", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      programme_key: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("draft", "active", "paused", "closed"),
        allowNull: false,
        defaultValue: "draft",
      },
      owner_user_id: actorReference(Sequelize),
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      entitlement: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      invite_mode: {
        type: Sequelize.ENUM("cohort_code", "individual_invite", "both"),
        allowNull: false,
        defaultValue: "cohort_code",
      },
      approved_content_refs: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      created_by_user_id: actorReference(Sequelize),
      updated_by_user_id: actorReference(Sequelize),
      activated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      paused_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("partner_programmes", ["partner_id"], {
      name: "idx_partner_programmes_partner",
    });
    await queryInterface.addIndex(
      "partner_programmes",
      ["partner_id", "programme_key"],
      { name: "uniq_partner_programmes_partner_key", unique: true }
    );
    await queryInterface.addIndex("partner_programmes", ["status"], {
      name: "idx_partner_programmes_status",
    });

    await queryInterface.createTable("partner_campaigns", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partner_programme_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partner_programmes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      campaign_key: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("draft", "active", "paused", "closed"),
        allowNull: false,
        defaultValue: "draft",
      },
      invite_route: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      approved_content_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      created_by_user_id: actorReference(Sequelize),
      updated_by_user_id: actorReference(Sequelize),
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("partner_campaigns", ["partner_programme_id"], {
      name: "idx_partner_campaigns_programme",
    });
    await queryInterface.addIndex(
      "partner_campaigns",
      ["partner_programme_id", "campaign_key"],
      { name: "uniq_partner_campaigns_programme_key", unique: true }
    );
    await queryInterface.addIndex("partner_campaigns", ["status"], {
      name: "idx_partner_campaigns_status",
    });

    await queryInterface.addColumn("partner_cohorts", "partner_programme_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "partner_programmes", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await queryInterface.addColumn("partner_cohorts", "partner_campaign_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "partner_campaigns", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await queryInterface.addIndex("partner_cohorts", ["partner_programme_id"], {
      name: "idx_partner_cohorts_programme",
    });
    await queryInterface.addIndex("partner_cohorts", ["partner_campaign_id"], {
      name: "idx_partner_cohorts_campaign",
    });

    await queryInterface.createTable("partner_programme_audit_events", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partner_programme_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partner_programmes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      actor_user_id: actorReference(Sequelize),
      event_type: {
        type: Sequelize.ENUM("created", "updated", "status_changed"),
        allowNull: false,
      },
      previous_status: {
        type: Sequelize.ENUM("draft", "active", "paused", "closed"),
        allowNull: true,
      },
      new_status: {
        type: Sequelize.ENUM("draft", "active", "paused", "closed"),
        allowNull: true,
      },
      changes: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(
      "partner_programme_audit_events",
      ["partner_programme_id", "occurred_at"],
      { name: "idx_partner_programme_audit_programme_time" }
    );
    await queryInterface.addIndex("partner_programme_audit_events", ["actor_user_id"], {
      name: "idx_partner_programme_audit_actor",
    });
  },

  async down(queryInterface, Sequelize) {
    const tableNames = (await queryInterface.showAllTables()).map((table) =>
      typeof table === "string" ? table : table.tableName || table.TABLE_NAME
    );
    if (tableNames.includes("partner_programme_audit_events")) {
      await queryInterface.dropTable("partner_programme_audit_events");
    }

    const cohortColumns = await queryInterface.describeTable("partner_cohorts");
    if (cohortColumns.partner_campaign_id) {
      await queryInterface.removeColumn("partner_cohorts", "partner_campaign_id");
    }
    if (cohortColumns.partner_programme_id) {
      await queryInterface.removeColumn("partner_cohorts", "partner_programme_id");
    }
    if (tableNames.includes("partner_campaigns")) {
      await queryInterface.dropTable("partner_campaigns");
    }
    if (tableNames.includes("partner_programmes")) {
      await queryInterface.dropTable("partner_programmes");
    }

    await queryInterface.sequelize.query(
      "UPDATE partners SET partner_type = 'lender' WHERE partner_type = 'mortgage_provider'"
    );
    await queryInterface.sequelize.query(
      "UPDATE partners SET partner_type = 'property_developer' WHERE partner_type = 'home_developer'"
    );
    await queryInterface.changeColumn("partners", "partner_type", {
      type: Sequelize.ENUM(
        "insurer",
        "lender",
        "estate_agent",
        "property_developer",
        "other"
      ),
      allowNull: false,
      defaultValue: "insurer",
    });
  },
};
