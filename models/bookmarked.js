const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");


    const BookmarkedListing = sequelize.define('bookmarked_listings', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      property_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      property_details: {
        type: DataTypes.JSON,
        allowNull: false
      },
     
    });
   // ________________
    module.exports = BookmarkedListing; 

  
   
  