const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserDocument = sequelize.define("userDocuments", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "users",
            key: "id"
        }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Original filename of the document"
    },
    doc_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "AI extracted document type (e.g., Lease Agreement, Financial Statement, Title Deed)"
    },
    status: {
        type: DataTypes.ENUM("processing", "ready", "urgent", "expiring", "error"),
        defaultValue: "processing",
        comment: "Document processing status"
    },
    category: {
        type: DataTypes.ENUM("financial", "legal", "maintenance", "compliance", "surveys_reports", "property_details"),
        allowNull: true,
        comment: "AI extracted category"
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "AI extracted tags array (e.g., [tenant, bank, lease])"
    },
    date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "AI extracted document date"
    },
    expiry_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "AI extracted expiry date"
    },
    file_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: "Path to stored file"
    },
    file_type: {
        type: DataTypes.STRING(10),
        allowNull: false,
        comment: "File extension (pdf, docx, jpg, png)"
    },
    file_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "File size in bytes"
    },
    text_content: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        comment: "Extracted text content for RAG"
    },
    chunks_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "Number of text chunks created for RAG"
    },
    vector_ids: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Array of vector IDs in Qdrant for this document"
    },
    ai_analysis: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Complete AI analysis results"
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When document processing completed"
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Soft delete flag"
    }
}, {
    tableName: "userDocuments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
});

module.exports = UserDocument;
