const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Listing = sequelize.define("listings", {
    id: {
       type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        startWith: 1
    },
    title: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    location: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    details: {
        type: DataTypes.JSON,
        allowNull: true
    },
    images: {
        type: DataTypes.JSON,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, );

module.exports = Listing;