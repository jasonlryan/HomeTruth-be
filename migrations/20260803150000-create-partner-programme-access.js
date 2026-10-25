"use strict";

const actorReference = (Sequelize) => ({
  type: Sequelize.INTEGER,
  allowNull: true,
  references: { model: "users", key: "id" },
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

const timestamps = (Sequelize) => ({
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
    await queryInterface.createTable("partner_programme_accesses", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      partner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partners", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      partner_programme_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partner_programmes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      access_role: {
        type: Sequelize.ENUM(
          "sponsor",
          "programme_manager",
          "analyst",
          "privacy_auditor"
        ),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("active", "revoked"),
        allowNull: false,
        defaultValue: "active",
      },
      granted_by_user_id: actorReference(Sequelize),
      revoked_by_user_id: actorReference(Sequelize),
      granted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex(
      "partner_programme_accesses",
      ["partner_programme_id", "user_id"],
      { name: "uniq_partner_programme_access_user", unique: true }
    );
    await queryInterface.addIndex(
      "partner_programme_accesses",
      ["user_id", "status"],
      { name: "idx_partner_programme_access_user_status" }
    );
    await queryInterface.addIndex(
      "partner_programme_accesses",
      ["partner_id", "partner_programme_id", "status"],
      { name: "idx_partner_programme_access_scope" }
    );

    await queryInterface.createTable("partner_access_audit_events", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      partner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partners", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      partner_programme_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "partner_programmes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      partner_programme_access_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "partner_programme_accesses", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      actor_user_id: actorReference(Sequelize),
      subject_user_id: actorReference(Sequelize),
      event_type: {
        type: Sequelize.ENUM(
          "access_granted",
          "access_role_changed",
          "access_revoked",
          "programme_viewed",
          "audit_viewed",
          "report_viewed",
          "report_exported",
          "access_denied"
        ),
        allowNull: false,
      },
      action: { type: Sequelize.STRING(80), allowNull: false },
      resource_type: { type: Sequelize.STRING(80), allowNull: false },
      outcome: {
        type: Sequelize.ENUM("allowed", "denied"),
        allowNull: false,
      },
      reason_code: { type: Sequelize.STRING(120), allowNull: true },
      details: { type: Sequelize.JSON, allowNull: false },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex(
      "partner_access_audit_events",
      ["partner_programme_id", "occurred_at"],
      { name: "idx_partner_access_audit_programme_time" }
    );
    await queryInterface.addIndex(
      "partner_access_audit_events",
      ["partner_programme_access_id"],
      { name: "idx_partner_access_audit_assignment" }
    );
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((table) =>
      typeof table === "string" ? table : table.tableName || table.TABLE_NAME
    );
    if (tables.includes("partner_access_audit_events")) {
      await queryInterface.dropTable("partner_access_audit_events");
    }
    if (tables.includes("partner_programme_accesses")) {
      await queryInterface.dropTable("partner_programme_accesses");
    }
  },
};
