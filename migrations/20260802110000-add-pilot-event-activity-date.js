"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pilot_events", "activity_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addIndex(
      "pilot_events",
      ["partner_cohort_id", "cohort_member_id", "event_name", "activity_date"],
      {
        name: "uniq_pilot_daily_activity_per_member",
        unique: true,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pilot_events",
      "uniq_pilot_daily_activity_per_member"
    );
    await queryInterface.removeColumn("pilot_events", "activity_date");
  },
};
