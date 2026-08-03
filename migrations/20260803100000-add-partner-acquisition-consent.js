"use strict";

const normalizedTableNames = async (queryInterface) =>
  (await queryInterface.showAllTables()).map((table) =>
    typeof table === "string" ? table : table.tableName || table.TABLE_NAME
  );

const removeIndexIfPresent = async (queryInterface, table, indexName) => {
  const indexes = await queryInterface.showIndex(table);
  if (indexes.some((index) => index.name === indexName)) {
    await queryInterface.removeIndex(table, indexName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const campaignColumns = await queryInterface.describeTable("partner_campaigns");
    if (!campaignColumns.acquisition_config) {
      await queryInterface.addColumn("partner_campaigns", "acquisition_config", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!campaignColumns.consent_config) {
      await queryInterface.addColumn("partner_campaigns", "consent_config", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

    const eventColumns = await queryInterface.describeTable("pilot_events");
    if (!eventColumns.partner_programme_id) {
      await queryInterface.addColumn("pilot_events", "partner_programme_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "partner_programmes", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }
    if (!eventColumns.partner_campaign_id) {
      await queryInterface.addColumn("pilot_events", "partner_campaign_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "partner_campaigns", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }
    await removeIndexIfPresent(queryInterface, "pilot_events", "idx_pilot_events_programme");
    await removeIndexIfPresent(queryInterface, "pilot_events", "idx_pilot_events_campaign");
    await queryInterface.addIndex("pilot_events", ["partner_programme_id"], {
      name: "idx_pilot_events_programme",
    });
    await queryInterface.addIndex("pilot_events", ["partner_campaign_id"], {
      name: "idx_pilot_events_campaign",
    });
  },

  async down(queryInterface) {
    const tableNames = await normalizedTableNames(queryInterface);
    if (tableNames.includes("pilot_events")) {
      const eventColumns = await queryInterface.describeTable("pilot_events");
      if (eventColumns.partner_campaign_id) {
        await queryInterface.removeColumn("pilot_events", "partner_campaign_id");
      }
      if (eventColumns.partner_programme_id) {
        await queryInterface.removeColumn("pilot_events", "partner_programme_id");
      }
      await removeIndexIfPresent(queryInterface, "pilot_events", "idx_pilot_events_campaign");
      await removeIndexIfPresent(queryInterface, "pilot_events", "idx_pilot_events_programme");
    }
    if (tableNames.includes("partner_campaigns")) {
      const campaignColumns = await queryInterface.describeTable("partner_campaigns");
      if (campaignColumns.consent_config) {
        await queryInterface.removeColumn("partner_campaigns", "consent_config");
      }
      if (campaignColumns.acquisition_config) {
        await queryInterface.removeColumn("partner_campaigns", "acquisition_config");
      }
    }
  },
};
