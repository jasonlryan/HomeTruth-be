const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // adjust the path as needed

const BudgetCalculation = sequelize.define("budget_calculations", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true // Optional label/title for the budget record
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  household_income: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  other_income: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  credit_score_range: {
    type: DataTypes.STRING,
    allowNull: true
  },
  down_payment: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  monthly_debt_payments: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  max_housing_payment: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  loan_term_years: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  property_tax_rate: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  insurance_cost: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  hoa_fees: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  expected_income_changes: {
    type: DataTypes.STRING,
    allowNull: true
  },
  conversation_history: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  estimated_monthly_payment_range: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_saved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
});

module.exports = BudgetCalculation;
