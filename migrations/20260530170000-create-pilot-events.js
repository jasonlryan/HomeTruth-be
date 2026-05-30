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
    await queryInterface.createTable("pilot_events", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      event_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      event_category: {
        type: Sequelize.ENUM(
          "onboarding",
          "consent",
          "property",
          "document",
          "fact",
          "task",
          "feedback",
          "system"
        ),
        allowNull: false,
        defaultValue: "system",
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
      source_type: {
        type: Sequelize.ENUM(
          "partner_onboarding",
          "property_document",
          "property_fact",
          "property_task",
          "feedback",
          "system",
          "manual"
        ),
        allowNull: false,
        defaultValue: "system",
      },
      source_model: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      source_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      consent_scope: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      partner_context_allowed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("pilot_events", ["event_name"], {
      name: "idx_pilot_events_event_name",
    });
    await queryInterface.addIndex("pilot_events", ["event_category"], {
      name: "idx_pilot_events_event_category",
    });
    await queryInterface.addIndex(
      "pilot_events",
      ["partner_cohort_id", "occurred_at"],
      { name: "idx_pilot_events_cohort_occurred_at" }
    );
    await queryInterface.addIndex("pilot_events", ["user_id"], {
      name: "idx_pilot_events_user_id",
    });
    await queryInterface.addIndex("pilot_events", ["property_id"], {
      name: "idx_pilot_events_property_id",
    });
    await queryInterface.addIndex(
      "pilot_events",
      ["source_type", "source_model", "source_id"],
      { name: "idx_pilot_events_source" }
    );
    await queryInterface.addIndex("pilot_events", ["occurred_at"], {
      name: "idx_pilot_events_occurred_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pilot_events");
  },
};
