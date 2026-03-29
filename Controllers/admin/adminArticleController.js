const { Op } = require("sequelize");
const { Article, User } = require("../../models");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "../../uploads/articles");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `article-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpg, .jpeg, .png, and .webp images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureUniqueSlug(slug, excludeId = null) {
  const where = { slug };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await Article.findOne({ where });
  if (!existing) return slug;
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${slug}-${suffix}`;
}

const adminArticleController = {
  upload: upload.single("featured_image"),

  async listArticles(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;
      const search = req.query.search?.trim();
      const categoryFilter = req.query.category;
      const statusFilter = req.query.status;

      const where = {};
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { author: { [Op.like]: `%${search}%` } },
        ];
      }
      if (categoryFilter) where.category = categoryFilter;
      if (statusFilter) where.status = statusFilter;

      const { count, rows } = await Article.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        include: [
          {
            model: User,
            attributes: ["id", "first_name", "last_name", "email"],
            required: false,
          },
        ],
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
      console.error("Error listing articles:", error);
      res.status(500).json({ success: false, message: "Failed to list articles", error: error.message });
    }
  },

  async getArticle(req, res) {
    try {
      const article = await Article.findByPk(req.params.id, {
        include: [
          {
            model: User,
            attributes: ["id", "first_name", "last_name", "email"],
            required: false,
          },
        ],
      });
      if (!article) {
        return res.status(404).json({ success: false, message: "Article not found" });
      }
      res.json({ success: true, data: article });
    } catch (error) {
      console.error("Error getting article:", error);
      res.status(500).json({ success: false, message: "Failed to get article", error: error.message });
    }
  },

  async createArticle(req, res) {
    try {
      const { title, author, excerpt, content, tags, category, status } = req.body;
      if (!title || !author) {
        return res.status(400).json({ success: false, message: "Title and author are required" });
      }

      const baseSlug = generateSlug(title);
      const slug = await ensureUniqueSlug(baseSlug);

      const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;

      const articleData = {
        title,
        slug,
        author,
        excerpt: excerpt || null,
        content: content || null,
        tags: parsedTags || null,
        category: category || "article",
        status: status || "draft",
        created_by: req.user?.id || null,
        featured_image: req.file ? `/uploads/articles/${req.file.filename}` : null,
      };

      if (articleData.status === "published") {
        articleData.published_at = new Date();
      }

      const article = await Article.create(articleData);
      res.status(201).json({ success: true, data: article });
    } catch (error) {
      console.error("Error creating article:", error);
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(500).json({ success: false, message: "Failed to create article", error: error.message });
    }
  },

  async updateArticle(req, res) {
    try {
      const article = await Article.findByPk(req.params.id);
      if (!article) {
        return res.status(404).json({ success: false, message: "Article not found" });
      }

      const { title, author, excerpt, content, tags, category, status } = req.body;

      if (title && title !== article.title) {
        const baseSlug = generateSlug(title);
        article.slug = await ensureUniqueSlug(baseSlug, article.id);
        article.title = title;
      }

      if (author !== undefined) article.author = author;
      if (excerpt !== undefined) article.excerpt = excerpt;
      if (content !== undefined) article.content = content;
      if (category !== undefined) article.category = category;

      if (tags !== undefined) {
        article.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
      }

      if (status !== undefined) {
        if (status === "published" && article.status !== "published") {
          article.published_at = new Date();
        }
        article.status = status;
      }

      if (req.file) {
        if (article.featured_image) {
          const oldPath = path.join(__dirname, "../..", article.featured_image);
          fs.unlink(oldPath, () => {});
        }
        article.featured_image = `/uploads/articles/${req.file.filename}`;
      }

      await article.save();
      res.json({ success: true, data: article });
    } catch (error) {
      console.error("Error updating article:", error);
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(500).json({ success: false, message: "Failed to update article", error: error.message });
    }
  },

  async deleteArticle(req, res) {
    try {
      const article = await Article.findByPk(req.params.id);
      if (!article) {
        return res.status(404).json({ success: false, message: "Article not found" });
      }

      if (article.featured_image) {
        const imgPath = path.join(__dirname, "../..", article.featured_image);
        fs.unlink(imgPath, () => {});
      }

      await article.destroy();
      res.json({ success: true, message: "Article deleted successfully" });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ success: false, message: "Failed to delete article", error: error.message });
    }
  },

  async publishArticle(req, res) {
    try {
      const article = await Article.findByPk(req.params.id);
      if (!article) {
        return res.status(404).json({ success: false, message: "Article not found" });
      }

      article.status = "published";
      article.published_at = new Date();
      await article.save();

      res.json({ success: true, data: article });
    } catch (error) {
      console.error("Error publishing article:", error);
      res.status(500).json({ success: false, message: "Failed to publish article", error: error.message });
    }
  },

  async unpublishArticle(req, res) {
    try {
      const article = await Article.findByPk(req.params.id);
      if (!article) {
        return res.status(404).json({ success: false, message: "Article not found" });
      }

      article.status = "draft";
      await article.save();

      res.json({ success: true, data: article });
    } catch (error) {
      console.error("Error unpublishing article:", error);
      res.status(500).json({ success: false, message: "Failed to unpublish article", error: error.message });
    }
  },
};

module.exports = adminArticleController;
