const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Article = sequelize.define("articles", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  author: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  excerpt: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
  },
  featured_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  category: {
    type: DataTypes.ENUM("article", "insight", "guide", "template", "educational", "document"),
    defaultValue: "article",
  },
  status: {
    type: DataTypes.ENUM("draft", "published"),
    defaultValue: "draft",
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = Article;
