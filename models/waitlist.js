const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Waitlist = sequelize.define('waitlist', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'notified', 'registered'),
    defaultValue: 'pending'
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  createdAt: 'joined_at',
  updatedAt: 'updated_at'
});

module.exports = Waitlist;

