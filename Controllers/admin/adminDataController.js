const { Op } = require("sequelize");
const {
  User,
  Subscription,
  UserProfile,
  QuizQuestion,
  QuizOption,
  QuizAnswer,
  ProfilePreferences,
  UserDocument,
  ChatHistory,
} = require("../../models");

async function resolveProUserIds() {
  const totalSubRows = await Subscription.count();
  if (totalSubRows > 0) {
    const activeSubs = await Subscription.findAll({
      where: { status: "active", expires_at: { [Op.gt]: new Date() } },
      attributes: ["user_id"],
      raw: true,
    });
    return activeSubs.map((s) => s.user_id);
  }
  const proUsers = await User.findAll({
    where: { role: "pro" },
    attributes: ["id"],
    raw: true,
  });
  return proUsers.map((u) => u.id);
}

const adminDataController = {
  /**
   * GET /api/admin/users
   * Paginated, searchable, filterable list of users.
   */
  async getUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;
      const search = req.query.search?.trim();
      const planType = req.query.plan_type; // 'free' | 'pro' | undefined
      const sortBy = req.query.sort_by || "createdAt";
      const sortOrder = req.query.sort_order === "ASC" ? "ASC" : "DESC";

      const where = { role: { [Op.ne]: "admin" } };

      if (search) {
        where[Op.or] = [
          { email: { [Op.like]: `%${search}%` } },
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
        ];
      }

      let proUserIds = await resolveProUserIds();

      if (planType === "pro" || planType === "free") {
        if (planType === "pro") {
          where.id = { [Op.in]: proUserIds.length > 0 ? proUserIds : [0] };
        } else {
          where.id = { [Op.notIn]: proUserIds };
        }
      }

      const proUserIdSet = new Set(proUserIds);

      const allowedSortFields = ["createdAt", "email", "first_name"];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

      const { count, rows } = await User.findAndCountAll({
        where,
        attributes: [
          "id",
          "first_name",
          "last_name",
          "email",
          "role",
          "home_address",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: UserProfile,
            attributes: ["onboarding_completed", "preferences"],
            required: false,
          },
        ],
        order: [[safeSortBy, sortOrder]],
        limit,
        offset,
      });

      const users = rows.map((u) => {
        const plain = u.toJSON();
        plain.plan_type = proUserIdSet.has(plain.id) ? "pro" : "free";
        plain.last_activity_date = plain.updatedAt;
        return plain;
      });

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ success: false, message: "Failed to fetch users", error: error.message });
    }
  },

  /**
   * GET /api/admin/users/:id
   * Detailed user view with onboarding/quiz data.
   */
  async getUserDetail(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
      }

      const user = await User.findByPk(userId, {
        attributes: [
          "id",
          "first_name",
          "last_name",
          "email",
          "role",
          "home_address",
          "is_verified",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: UserProfile,
            attributes: ["onboarding_completed", "preferences"],
            required: false,
          },
          {
            model: Subscription,
            attributes: ["plan", "status", "expires_at"],
            required: false,
          },
          {
            model: ProfilePreferences,
            attributes: [
              "communication_tone",
              "communication_style",
              "behavior",
              "use_profile_personalization",
            ],
            required: false,
          },
        ],
      });

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Quiz answers with question text and option text
      const quizAnswers = await QuizAnswer.findAll({
        where: { user_id: userId },
        include: [
          {
            model: QuizQuestion,
            attributes: ["id", "question_text", "type"],
          },
          {
            model: QuizOption,
            attributes: ["id", "option"],
            required: false,
          },
        ],
        raw: false,
      });

      const formattedAnswers = quizAnswers.map((qa) => {
        const plain = qa.toJSON();
        return {
          question_id: plain.quiz_question?.id,
          question_text: plain.quiz_question?.question_text,
          question_type: plain.quiz_question?.type,
          selected_option: plain.quiz_option?.option || null,
          answer_value: plain.answer,
        };
      });

      // Determine plan type
      const subscription = user.subscription || null;
      let planType = "free";
      const subsTableInUse = (await Subscription.count()) > 0;
      if (subsTableInUse) {
        if (
          subscription &&
          subscription.status === "active" &&
          subscription.expires_at &&
          new Date(subscription.expires_at) > new Date()
        ) {
          planType = "pro";
        }
      } else if (user.role === "pro") {
        planType = "pro";
      }

      // Activity summary counts
      const documentCount = await UserDocument.count({
        where: { user_id: userId, is_active: true },
      });
      const aiChatCount = await ChatHistory.count({
        where: { user_id: userId },
      });

      const result = user.toJSON();
      result.plan_type = planType;
      result.quiz_answers = formattedAnswers;
      result.activity_summary = {
        documents_uploaded: documentCount,
        ai_chat_records: aiChatCount,
      };

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Error fetching user detail:", error);
      res.status(500).json({ success: false, message: "Failed to fetch user detail", error: error.message });
    }
  },

  /**
   * GET /api/admin/users/export
   * Export users as CSV or JSON.
   */
  async exportUsers(req, res) {
    try {
      const format = req.query.format === "csv" ? "csv" : "json";
      const search = req.query.search?.trim();
      const planType = req.query.plan_type;

      const where = { role: { [Op.ne]: "admin" } };

      if (search) {
        where[Op.or] = [
          { email: { [Op.like]: `%${search}%` } },
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
        ];
      }

      const proUserIds = await resolveProUserIds();
      const proUserIdSet = new Set(proUserIds);

      if (planType === "pro") {
        where.id = { [Op.in]: proUserIds.length > 0 ? proUserIds : [0] };
      } else if (planType === "free") {
        where.id = { [Op.notIn]: proUserIds };
      }

      const users = await User.findAll({
        where,
        attributes: [
          "id",
          "first_name",
          "last_name",
          "email",
          "role",
          "home_address",
          "createdAt",
          "updatedAt",
        ],
        order: [["createdAt", "DESC"]],
        raw: true,
      });

      const exportData = users.map((u) => ({
        id: u.id,
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        email: u.email,
        plan_type: proUserIdSet.has(u.id) ? "pro" : "free",
        signup_date: u.createdAt,
        last_activity_date: u.updatedAt,
        location: u.home_address || "",
      }));

      if (format === "csv") {
        const headers = [
          "id",
          "first_name",
          "last_name",
          "email",
          "plan_type",
          "signup_date",
          "last_activity_date",
          "location",
        ];
        const csvRows = [headers.join(",")];
        for (const row of exportData) {
          csvRows.push(
            headers
              .map((h) => {
                const val = String(row[h] ?? "").replace(/"/g, '""');
                return `"${val}"`;
              })
              .join(",")
          );
        }
        const csv = csvRows.join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="users_export_${Date.now()}.csv"`
        );
        return res.send(csv);
      }

      // JSON format
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="users_export_${Date.now()}.json"`
      );
      return res.json({ success: true, data: exportData });
    } catch (error) {
      console.error("Error exporting users:", error);
      res.status(500).json({ success: false, message: "Failed to export users", error: error.message });
    }
  },
};

module.exports = adminDataController;
