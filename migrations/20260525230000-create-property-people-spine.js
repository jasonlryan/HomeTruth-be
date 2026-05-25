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
    await queryInterface.createTable("properties", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      uprn: {
        type: Sequelize.STRING(32),
        allowNull: true,
        unique: true,
      },
      property_type: {
        type: Sequelize.ENUM(
          "house",
          "flat",
          "maisonette",
          "bungalow",
          "commercial",
          "land",
          "mixed_use",
          "unknown"
        ),
        allowNull: false,
        defaultValue: "unknown",
      },
      tenure: {
        type: Sequelize.ENUM(
          "freehold",
          "leasehold",
          "share_of_freehold",
          "commonhold",
          "unknown"
        ),
        allowNull: false,
        defaultValue: "unknown",
      },
      lifecycle_status: {
        type: Sequelize.ENUM(
          "unverified",
          "active",
          "archived",
          "merged",
          "deleted"
        ),
        allowNull: false,
        defaultValue: "unverified",
      },
      source_type: {
        type: Sequelize.ENUM(
          "manual",
          "user_profile",
          "listing",
          "partner_api",
          "import",
          "system"
        ),
        allowNull: false,
        defaultValue: "manual",
      },
      source_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("properties", ["lifecycle_status"], {
      name: "idx_properties_lifecycle_status",
    });
    await queryInterface.addIndex("properties", ["source_type", "source_ref"], {
      name: "idx_properties_source",
    });
    await queryInterface.addIndex("properties", ["created_by_user_id"], {
      name: "idx_properties_created_by_user_id",
    });

    await queryInterface.createTable("property_addresses", {
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
      is_current: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      address_line_1: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      address_line_2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      town_city: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      county: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      postcode: {
        type: Sequelize.STRING(16),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: false,
        defaultValue: "GB",
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      address_fingerprint: {
        type: Sequelize.CHAR(64),
        allowNull: true,
      },
      source_type: {
        type: Sequelize.ENUM(
          "manual",
          "user_profile",
          "listing",
          "partner_api",
          "import",
          "system"
        ),
        allowNull: false,
        defaultValue: "manual",
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
      },
      valid_from: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      valid_to: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("property_addresses", ["property_id"], {
      name: "idx_property_addresses_property_id",
    });
    await queryInterface.addIndex("property_addresses", ["postcode"], {
      name: "idx_property_addresses_postcode",
    });
    await queryInterface.addIndex("property_addresses", ["address_fingerprint"], {
      name: "idx_property_addresses_fingerprint",
    });
    await queryInterface.addIndex(
      "property_addresses",
      ["property_id", "is_current"],
      { name: "idx_property_addresses_current" }
    );

    await queryInterface.createTable("property_people", {
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      relationship_type: {
        type: Sequelize.ENUM(
          "owner",
          "buyer",
          "seller",
          "landlord",
          "tenant",
          "investor",
          "agent",
          "manager",
          "contractor",
          "lender",
          "insurer",
          "viewer",
          "other"
        ),
        allowNull: false,
      },
      relationship_status: {
        type: Sequelize.ENUM(
          "invited",
          "active",
          "ended",
          "revoked",
          "disputed"
        ),
        allowNull: false,
        defaultValue: "active",
      },
      permission_level: {
        type: Sequelize.ENUM("read", "contribute", "manage", "admin"),
        allowNull: false,
        defaultValue: "read",
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      verification_status: {
        type: Sequelize.ENUM(
          "unverified",
          "user_confirmed",
          "evidence_verified",
          "partner_verified",
          "disputed"
        ),
        allowNull: false,
        defaultValue: "unverified",
      },
      source_type: {
        type: Sequelize.ENUM(
          "manual",
          "user_profile",
          "document",
          "partner_api",
          "system"
        ),
        allowNull: false,
        defaultValue: "manual",
      },
      source_ref: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("property_people", ["property_id"], {
      name: "idx_property_people_property_id",
    });
    await queryInterface.addIndex("property_people", ["user_id"], {
      name: "idx_property_people_user_id",
    });
    await queryInterface.addIndex(
      "property_people",
      ["property_id", "relationship_type"],
      { name: "idx_property_people_relationship_type" }
    );
    await queryInterface.addIndex(
      "property_people",
      ["user_id", "relationship_status"],
      { name: "idx_property_people_user_status" }
    );

    await queryInterface.createTable("property_documents", {
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
      user_document_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "userDocuments",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      linked_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      document_role: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      relevance: {
        type: Sequelize.ENUM(
          "primary",
          "evidence",
          "supporting",
          "reference",
          "other"
        ),
        allowNull: false,
        defaultValue: "supporting",
      },
      effective_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      expiry_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(
      "property_documents",
      ["property_id", "user_document_id"],
      {
        name: "uniq_property_documents_property_user_doc",
        unique: true,
      }
    );
    await queryInterface.addIndex("property_documents", ["user_document_id"], {
      name: "idx_property_documents_user_document_id",
    });
    await queryInterface.addIndex("property_documents", ["linked_by_user_id"], {
      name: "idx_property_documents_linked_by_user_id",
    });
    await queryInterface.addIndex(
      "property_documents",
      ["property_id", "relevance"],
      { name: "idx_property_documents_relevance" }
    );
    await queryInterface.addIndex(
      "property_documents",
      ["property_id", "expiry_date"],
      { name: "idx_property_documents_expiry" }
    );

    await queryInterface.createTable("evidence_sources", {
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
      property_document_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "property_documents",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      user_document_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "userDocuments",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      source_type: {
        type: Sequelize.ENUM(
          "user_document",
          "system_document",
          "url",
          "manual",
          "partner_api",
          "listing",
          "ai_extraction"
        ),
        allowNull: false,
      },
      source_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      source_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      extraction_method: {
        type: Sequelize.ENUM("manual", "ocr", "ai", "partner_api", "system"),
        allowNull: false,
        defaultValue: "manual",
      },
      extracted_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      excerpt: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      page_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      locator: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("evidence_sources", ["property_id"], {
      name: "idx_evidence_sources_property_id",
    });
    await queryInterface.addIndex("evidence_sources", ["property_document_id"], {
      name: "idx_evidence_sources_property_document_id",
    });
    await queryInterface.addIndex("evidence_sources", ["user_document_id"], {
      name: "idx_evidence_sources_user_document_id",
    });
    await queryInterface.addIndex("evidence_sources", ["source_type"], {
      name: "idx_evidence_sources_source_type",
    });
    await queryInterface.addIndex("evidence_sources", ["extraction_method"], {
      name: "idx_evidence_sources_extraction_method",
    });
    await queryInterface.addIndex("evidence_sources", ["confidence"], {
      name: "idx_evidence_sources_confidence",
    });

    await queryInterface.createTable("property_facts", {
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
      evidence_source_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "evidence_sources",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      fact_namespace: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      fact_type: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      value_json: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      display_value: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      unit: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      valid_from: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      valid_to: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      observed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_current: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
      },
      verification_status: {
        type: Sequelize.ENUM(
          "suggested",
          "user_confirmed",
          "evidence_verified",
          "partner_verified",
          "disputed",
          "expired"
        ),
        allowNull: false,
        defaultValue: "suggested",
      },
      created_from: {
        type: Sequelize.ENUM("manual", "ocr", "ai", "partner_api", "system"),
        allowNull: false,
        defaultValue: "manual",
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex("property_facts", ["property_id"], {
      name: "idx_property_facts_property_id",
    });
    await queryInterface.addIndex("property_facts", ["evidence_source_id"], {
      name: "idx_property_facts_evidence_source_id",
    });
    await queryInterface.addIndex(
      "property_facts",
      ["property_id", "fact_namespace", "fact_type"],
      { name: "idx_property_facts_type" }
    );
    await queryInterface.addIndex("property_facts", ["property_id", "is_current"], {
      name: "idx_property_facts_current",
    });
    await queryInterface.addIndex("property_facts", ["verification_status"], {
      name: "idx_property_facts_verification_status",
    });
    await queryInterface.addIndex("property_facts", ["valid_from", "valid_to"], {
      name: "idx_property_facts_validity",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("property_facts");
    await queryInterface.dropTable("evidence_sources");
    await queryInterface.dropTable("property_documents");
    await queryInterface.dropTable("property_people");
    await queryInterface.dropTable("property_addresses");
    await queryInterface.dropTable("properties");
  },
};
