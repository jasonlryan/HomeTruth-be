const { Op } = require("sequelize");
const { Article } = require("../models");

const articleController = {
  async listPublished(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
      const offset = (page - 1) * limit;
      const categoryFilter = req.query.category;

      const where = { status: "published" };
      if (categoryFilter) where.category = categoryFilter;

      const { count, rows } = await Article.findAndCountAll({
        where,
        attributes: [
          "id", "title", "slug", "author", "excerpt",
          "featured_image", "tags", "category", "published_at", "createdAt",
        ],
        order: [["published_at", "DESC"]],
        limit,
        offset,
      });

      res.json({
        success: true,
        data: {
          articles: rows,
          pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error listing published articles:", error);
      res.status(500).json({ success: false, message: "Failed to list articles", error: error.message });
    }
  },

  async getBySlug(req, res) {
    try {
      const article = await Article.findOne({
        where: { slug: req.params.slug, status: "published" },
      });

      if (!article) {
        return res.status(404).json({ success: false, message: "Article not found" });
      }

      res.json({ success: true, data: article });
    } catch (error) {
      console.error("Error getting article by slug:", error);
      res.status(500).json({ success: false, message: "Failed to get article", error: error.message });
    }
  },
};

module.exports = articleController;
