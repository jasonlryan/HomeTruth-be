// const User = require("../../models/index"); // or wherever your User model is

// const syncUser = async (req, res) => {
//   try {
//     const userId = req.user.id; // set by authMiddleware

//     // 👇 Example sync logic — update user's lastSync timestamp
//     const user = await User.findByPk(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Example: Update sync timestamp
//     user.last_sync = new Date();
//     await user.save();

//     // You could also send back user data or any synced content
//     return res.status(200).json({
//       success: true,
//       message: "User synced successfully",
//       data: {
//         id: user.id,
//         email: user.email,
//         last_sync: user.last_sync,
//         // more data here if needed
//       },
//     });
//   } catch (error) {
//     console.error("Sync error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };
// module.exports = syncUser;