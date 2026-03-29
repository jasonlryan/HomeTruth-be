const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Document = sequelize.define("documents", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sessionId: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fileType: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  textContent: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  chunksCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  processing_error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  documentId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Normal', 'High', 'Critical'),
    allowNull: true,
    defaultValue: 'Normal',
  },
  source: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  entryMethod: {
    type: DataTypes.ENUM('file_upload', 'url_scrape', 'manual_entry'),
    allowNull: true,
  }
}, {
  timestamps: true,
  tableName: 'documents'
});

module.exports = Document;