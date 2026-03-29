const { Op, fn, col, literal } = require("sequelize");
const {
  User,
  Subscription,
  QuizQuestion,
  QuizAnswer,
  UserDocument,
  ChatHistory,
  UserDocumentChatHistory,
  Waitlist,
} = require("../models");

class AdminDashboardService {
  /**
   * Returns the date range boundaries for a given period string.
   * Supported: '7d', '30d', '90d', 'all'
   */
  static getDateRange(period) {
    if (period === "all") return { start: null, end: new Date() };
    const days = { "7d": 7, "30d": 30, "90d": 90 }[period] || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { start, end: new Date() };
  }

  /**
   * Returns the previous period of equal length for trend comparison.
   */
  static getPreviousDateRange(period) {
    if (period === "all") return null;
    const days = { "7d": 7, "30d": 30, "90d": 90 }[period] || 30;
    const end = new Date();
    end.setDate(end.getDate() - days);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return { start, end };
  }

  static computeTrend(current, previous) {
    if (previous === 0 || previous === null) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  // ──────────────────────────────────────────────
  //  Pro user helpers
  // ──────────────────────────────────────────────

  static async getProUserIds() {
    // Check if the subscriptions table is in use at all
    const totalSubRows = await Subscription.count();

    if (totalSubRows > 0) {
      // Table is in use — it is the source of truth, even if all are expired
      const activeSubs = await Subscription.findAll({
        where: {
          status: "active",
          expires_at: { [Op.gt]: new Date() },
        },
        attributes: ["user_id"],
        raw: true,
      });
      return activeSubs.map((s) => s.user_id);
    }

    // Table is completely empty — fall back to role field
    const proUsers = await User.findAll({
      where: { role: "pro" },
      attributes: ["id"],
      raw: true,
    });
    return proUsers.map((u) => u.id);
  }

  // ──────────────────────────────────────────────
  //  KPI queries
  // ──────────────────────────────────────────────

  static async getKPIs(period = "30d") {
    const { start, end } = this.getDateRange(period);
    const prev = this.getPreviousDateRange(period);

    const nonAdminWhere = { role: { [Op.ne]: "admin" } };

    // Total users (excluding admins)
    const totalUsers = await User.count({ where: nonAdminWhere });

    // Pro users
    const proUserIds = await this.getProUserIds();
    const proUsers = proUserIds.length;
    const freeUsers = totalUsers - proUsers;

    // Pro user rate
    const proUserRate =
      totalUsers > 0 ? Math.round((proUsers / totalUsers) * 100) : 0;

    // Quiz completed: users who answered ALL questions
    const totalQuestions = await QuizQuestion.count();
    let quizCompletedCount = 0;
    if (totalQuestions > 0) {
      const usersWithCompleteQuiz = await QuizAnswer.findAll({
        attributes: [
          "user_id",
          [fn("COUNT", fn("DISTINCT", col("question_id"))), "answered"],
        ],
        group: ["user_id"],
        having: literal(`COUNT(DISTINCT question_id) >= ${totalQuestions}`),
        raw: true,
      });
      quizCompletedCount = usersWithCompleteQuiz.length;
    }

    // Documents uploaded (active only)
    const documentsUploaded = await UserDocument.count({
      where: { is_active: true },
    });

    // Document AI chats (secondary stat for Documents card)
    const documentAIChats = await UserDocumentChatHistory.count();

    // AI chat records (from chat_history — each row is one Q&A exchange)
    const aiChatRecords = await ChatHistory.count();

    // Waitlist signups
    const waitlistSignups = await Waitlist.count();

    // ── Trends (only for timestamp-reliable metrics) ──
    let trends = {
      totalUsers: null,
      documentsUploaded: null,
      aiChatRecords: null,
      waitlistSignups: null,
    };

    if (prev) {
      const currentDateFilter = start
        ? { createdAt: { [Op.between]: [start, end] } }
        : {};
      const prevDateFilter = {
        createdAt: { [Op.between]: [prev.start, prev.end] },
      };

      // Signups trend
      const signupsCurrent = await User.count({
        where: { ...nonAdminWhere, ...currentDateFilter },
      });
      const signupsPrev = await User.count({
        where: { ...nonAdminWhere, ...prevDateFilter },
      });
      trends.totalUsers = this.computeTrend(signupsCurrent, signupsPrev);

      // Documents trend
      const docCurrentFilter = start
        ? { created_at: { [Op.between]: [start, end] } }
        : {};
      const docPrevFilter = {
        created_at: { [Op.between]: [prev.start, prev.end] },
      };
      const docsCurrent = await UserDocument.count({
        where: { is_active: true, ...docCurrentFilter },
      });
      const docsPrev = await UserDocument.count({
        where: { is_active: true, ...docPrevFilter },
      });
      trends.documentsUploaded = this.computeTrend(docsCurrent, docsPrev);

      // AI chat records trend
      const aiCurrent = await ChatHistory.count({
        where: currentDateFilter,
      });
      const aiPrev = await ChatHistory.count({
        where: prevDateFilter,
      });
      trends.aiChatRecords = this.computeTrend(aiCurrent, aiPrev);

      // Waitlist trend (uses joined_at as createdAt alias)
      const wlCurrent = await Waitlist.count({
        where: start
          ? { joined_at: { [Op.between]: [start, end] } }
          : {},
      });
      const wlPrev = await Waitlist.count({
        where: { joined_at: { [Op.between]: [prev.start, prev.end] } },
      });
      trends.waitlistSignups = this.computeTrend(wlCurrent, wlPrev);
    }

    return {
      totalUsers,
      freeUsers,
      proUsers,
      proUserRate,
      quizCompletedCount,
      totalQuizUsers: totalUsers,
      documentsUploaded,
      documentAIChats,
      aiChatRecords,
      waitlistSignups,
      trends,
    };
  }

  // ──────────────────────────────────────────────
  //  Chart data: signups over time
  // ──────────────────────────────────────────────

  static async getSignupsChart(period = "30d") {
    const { start } = this.getDateRange(period);
    const where = { role: { [Op.ne]: "admin" } };
    if (start) where.createdAt = { [Op.gte]: start };

    const rows = await User.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where,
      group: [fn("DATE", col("createdAt"))],
      order: [[fn("DATE", col("createdAt")), "ASC"]],
      raw: true,
    });

    return rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  }

  // ──────────────────────────────────────────────
  //  Chart data: AI usage over time
  // ──────────────────────────────────────────────

  static async getAIUsageChart(period = "30d") {
    const { start } = this.getDateRange(period);
    const where = {};
    if (start) where.createdAt = { [Op.gte]: start };

    const rows = await ChatHistory.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where,
      group: [fn("DATE", col("createdAt"))],
      order: [[fn("DATE", col("createdAt")), "ASC"]],
      raw: true,
    });

    return rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  }

  // ──────────────────────────────────────────────
  //  Chart data: documents uploaded over time
  // ──────────────────────────────────────────────

  static async getDocumentsChart(period = "30d") {
    const { start } = this.getDateRange(period);
    const where = { is_active: true };
    if (start) where.created_at = { [Op.gte]: start };

    const rows = await UserDocument.findAll({
      attributes: [
        [fn("DATE", col("created_at")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where,
      group: [fn("DATE", col("created_at"))],
      order: [[fn("DATE", col("created_at")), "ASC"]],
      raw: true,
    });

    return rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  }

  // ──────────────────────────────────────────────
  //  Chart data: documents by category
  // ──────────────────────────────────────────────

  static async getDocCategoriesChart() {
    const rows = await UserDocument.findAll({
      attributes: [
        "category",
        [fn("COUNT", col("id")), "count"],
      ],
      where: { is_active: true },
      group: ["category"],
      raw: true,
    });

    return rows.map((r) => ({
      category: r.category || "uncategorized",
      count: parseInt(r.count, 10),
    }));
  }

  // ──────────────────────────────────────────────
  //  Recent activity tables
  // ──────────────────────────────────────────────

  static async getRecentSignups(limit = 10) {
    const users = await User.findAll({
      where: { role: { [Op.ne]: "admin" } },
      attributes: ["id", "first_name", "last_name", "email", "role", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit,
      raw: true,
    });
    return users;
  }

  static async getRecentUploads(limit = 10) {
    const docs = await UserDocument.findAll({
      where: { is_active: true },
      attributes: [
        "id",
        "user_id",
        "name",
        "category",
        "status",
        "file_type",
        "file_size",
        "created_at",
      ],
      include: [
        {
          model: User,
          attributes: ["email", "first_name", "last_name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
    });
    return docs.map((d) => d.toJSON());
  }

  static async getRecentAIActivity(limit = 10) {
    const chats = await ChatHistory.findAll({
      attributes: [
        "id",
        "user_id",
        "conversation_id",
        "userMessage",
        "createdAt",
      ],
      include: [
        {
          model: User,
          attributes: ["email", "first_name", "last_name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });
    return chats.map((c) => c.toJSON());
  }
}

module.exports = AdminDashboardService;
