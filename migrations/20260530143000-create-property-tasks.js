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
    await queryInterface.createTable("property_tasks", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "properties",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      assigned_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      task_type: {
        type: Sequelize.ENUM(
          "service_due",
          "seasonal_check",
          "document_expiry",
          "missing_baseline",
          "known_issue_follow_up",
          "evidence_improvement"
        ),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      recommended_action: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      priority: {
        type: Sequelize.ENUM("low", "medium", "high"),
        allowNull: false,
        defaultValue: "medium",
      },
      status: {
        type: Sequelize.ENUM("open", "completed", "dismissed", "not_relevant"),
        allowNull: false,
        defaultValue: "open",
      },
      source_type: {
        type: Sequelize.ENUM(
          "rule",
          "property",
          "property_fact",
          "property_document",
          "evidence_source",
          "system",
          "manual"
        ),
        allowNull: false,
        defaultValue: "rule",
      },
      source_model: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      source_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      generation_key: {
        type: Sequelize.STRING(191),
        allowNull: true,
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      dismissed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      not_relevant_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status_updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status_updated_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("property_tasks", ["property_id"], {
      name: "idx_property_tasks_property_id",
    });
    await queryInterface.addIndex("property_tasks", ["assigned_user_id"], {
      name: "idx_property_tasks_assigned_user_id",
    });
    await queryInterface.addIndex("property_tasks", ["property_id", "status"], {
      name: "idx_property_tasks_property_status",
    });
    await queryInterface.addIndex("property_tasks", ["due_date"], {
      name: "idx_property_tasks_due_date",
    });
    await queryInterface.addIndex("property_tasks", ["generation_key"], {
      name: "uniq_property_tasks_generation_key",
      unique: true,
    });

    await queryInterface.createTable("property_task_status_events", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      property_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "property_tasks",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "properties",
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
      from_status: {
        type: Sequelize.ENUM("open", "completed", "dismissed", "not_relevant"),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.ENUM("open", "completed", "dismissed", "not_relevant"),
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
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

    await queryInterface.addIndex(
      "property_task_status_events",
      ["property_task_id"],
      { name: "idx_property_task_events_task_id" }
    );
    await queryInterface.addIndex(
      "property_task_status_events",
      ["property_id", "to_status"],
      { name: "idx_property_task_events_property_status" }
    );
    await queryInterface.addIndex("property_task_status_events", ["user_id"], {
      name: "idx_property_task_events_user_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("property_task_status_events");
    await queryInterface.dropTable("property_tasks");
  },
};
