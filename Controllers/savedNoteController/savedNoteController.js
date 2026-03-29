const { SavedNote, User, ChatHistory, BudgetCalculation } = require('../../models/index');
const { Op } = require("sequelize");

const savedNoteController = {
    // Create a new saved note from chat history
    createNote: async (req, res) => {
        try {
            const { chat_history_id, title } = req.body;
            const user_id = req.user.id;
    
            // Validate required fields
            if (!chat_history_id) {
                return res.status(400).json({
                    success: false,
                    message: 'chat_history_id is required'
                });
            }

            // Check combined limit: saved notes + saved budget calculations should be less than 5
            const existingNotesCount = await SavedNote.count({
                where: { user_id }
            });
            
            const savedBudgetCalculationsCount = await BudgetCalculation.count({
                where: { user_id, is_saved: true }
            });
            
            const totalSavedItems = existingNotesCount + savedBudgetCalculationsCount;
    
            if (totalSavedItems >= 5) {
                return res.status(400).json({
                    success: false,
                    message: `You cannot create more saved items. You currently have ${existingNotesCount} saved notes and ${savedBudgetCalculationsCount} saved budget calculations (total: ${totalSavedItems}/5).`
                });
            }

            // Verify the chat history record exists and belongs to the user
            const chatRecord = await ChatHistory.findOne({
                where: {
                    id: chat_history_id,
                    user_id: parseInt(user_id)
                }
            });

            if (!chatRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Chat history record not found or does not belong to this user'
                });
            }

            // Check if this chat is already saved as a note
            const existingNote = await SavedNote.findOne({
                where: {
                    user_id: parseInt(user_id),
                    id: chat_history_id
                }
            });

            if (existingNote) {
                return res.status(409).json({
                    success: false,
                    message: 'This chat message is already saved as a note'
                });
            }
    
            const savedNote = await SavedNote.create({
                user_id,
                chat_history_id: chat_history_id,
                title: title || `Note from ${new Date().toLocaleDateString()}`,
                user_message: chatRecord.userMessage,
                assistant_reply: chatRecord.assistantReply
            });
    
            res.status(201).json({
                success: true,
                message: "Note saved successfully",
                data: {
                    savedNote: {
                        id: savedNote.id,
                        title: savedNote.title,
                        user_message: savedNote.user_message,
                        assistant_reply: savedNote.assistant_reply,
                        created_at: savedNote.createdAt
                    },
                    savedNotesCount: existingNotesCount + 1,
                    totalSavedItems: totalSavedItems + 1
                }
            });
        } catch (error) {
            console.error("Error creating saved note:", error);
            res.status(500).json({
                success: false,
                message: "Failed to save note",
                error: error.message
            });
        }
    },
    
    // Get all saved notes for a user
    getUserNotes: async (req, res) => {
        try {
            const user_id = req.user.id;
            const { page = 1, limit = 10, search } = req.query;
            
            const offset = (page - 1) * limit;
            
            // Build where clause
            let whereClause = { user_id };
            
            if (search) {
                whereClause[Op.or] = [
                    { title: { [Op.iLike]: `%${search}%` } },
                    { user_message: { [Op.iLike]: `%${search}%` } },
                    { assistant_reply: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const { count, rows } = await SavedNote.findAndCountAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                attributes: ['id', 'title', 'user_message', 'assistant_reply', 'createdAt']
            });

            res.status(200).json({
                success: true,
                data: {
                    notes: rows,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(count / limit),
                        totalItems: count,
                        itemsPerPage: parseInt(limit)
                    }
                }
            });
        } catch (error) {
            console.error("Error fetching user notes:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch notes",
                error: error.message
            });
        }
    },

    // Get a specific saved note by ID
    getNoteById: async (req, res) => {
        try {
            const { id } = req.params;
            const user_id = req.user.id;

            const savedNote = await SavedNote.findOne({
                where: { id, user_id },
                attributes: ['id', 'title', 'user_message', 'assistant_reply', 'chat_history_id', 'createdAt']
            });

            if (!savedNote) {
                return res.status(404).json({
                    success: false,
                    message: "Note not found"
                });
            }

            res.status(200).json({
                success: true,
                data: savedNote
            });
        } catch (error) {
            console.error("Error fetching note by ID:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch note",
                error: error.message
            });
        }
    },

    // Update a saved note (only title can be updated)
    updateNote: async (req, res) => {
        try {
            const { id } = req.params;
            const { title } = req.body;
            const user_id = req.user.id;

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: "Title is required"
                });
            }

            const savedNote = await SavedNote.findOne({
                where: { id, user_id }
            });

            if (!savedNote) {
                return res.status(404).json({
                    success: false,
                    message: "Note not found"
                });
            }

            const updatedNote = await savedNote.update({
                title: title
            });

            res.status(200).json({
                success: true,
                message: "Note updated successfully",
                data: {
                    id: updatedNote.id,
                    title: updatedNote.title,
                    user_message: updatedNote.user_message,
                    assistant_reply: updatedNote.assistant_reply,
                    created_at: updatedNote.createdAt
                }
            });
        } catch (error) {
            console.error("Error updating note:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update note",
                error: error.message
            });
        }
    },

    // Delete a saved note
    deleteNote: async (req, res) => {
        try {
            const { id } = req.params;
            const user_id = req.user.id;

            const savedNote = await SavedNote.findOne({
                where: { id, user_id }
            });

            if (!savedNote) {
                return res.status(404).json({
                    success: false,
                    message: "Note not found"
                });
            }

            await savedNote.destroy();

            // Get updated counts
            const remainingNotesCount = await SavedNote.count({
                where: { user_id }
            });
            
            const savedBudgetCalculationsCount = await BudgetCalculation.count({
                where: { user_id, is_saved: true }
            });
            
            const totalSavedItems = remainingNotesCount + savedBudgetCalculationsCount;

            res.status(200).json({
                success: true,
                message: "Note deleted successfully",
                data: {
                    remainingNotesCount: remainingNotesCount,
                    totalSavedItems: totalSavedItems
                }
            });
        } catch (error) {
            console.error("Error deleting note:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete note",
                error: error.message
            });
        }
    },

    // Get combined list of saved notes and saved budget calculations
    getAllSavedItems: async (req, res) => {
        try {
            const user_id = req.user.id;
            const { page = 1, limit = 10, search } = req.query;
            
            const offset = (page - 1) * limit;
            
            // Build where clause for search
            let notesWhereClause = { user_id };
            let budgetWhereClause = { user_id, is_saved: true };
            
            if (search) {
                notesWhereClause[Op.or] = [
                    { title: { [Op.iLike]: `%${search}%` } },
                    { user_message: { [Op.iLike]: `%${search}%` } },
                    { assistant_reply: { [Op.iLike]: `%${search}%` } }
                ];
                
                budgetWhereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { location: { [Op.iLike]: `%${search}%` } }
                ];
            }

            // Fetch saved notes
            const { count: notesCount, rows: savedNotes } = await SavedNote.findAndCountAll({
                where: notesWhereClause,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'title', 'user_message', 'assistant_reply', 'createdAt', 'updatedAt']
            });

            // Fetch saved budget calculations
            const { count: budgetCount, rows: savedBudgets } = await BudgetCalculation.findAndCountAll({
                where: budgetWhereClause,
                order: [['createdAt', 'DESC']],
                attributes: {
                    exclude: ['conversation_history']
                }
            });

            // Combine and format the results
            const combinedItems = [
                ...savedNotes.map(note => ({
                    id: note.id,
                    type: 'saved_note',
                    title: note.title,
                    content: {
                        user_message: note.user_message,
                        assistant_reply: note.assistant_reply
                    },
                    created_at: note.createdAt,
                    updated_at: note.updatedAt
                })),
                ...savedBudgets.map(budget => ({
                    id: budget.id,
                    type: 'budget_calculation',
                    title: budget.name,
                    content: {
                        location: budget.location,
                        household_income: budget.household_income,
                        estimated_monthly_payment_range: budget.estimated_monthly_payment_range
                    },
                    created_at: budget.createdAt,
                    updated_at: budget.updatedAt
                }))
            ];

            // Sort combined items by creation date (most recent first)
            combinedItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Apply pagination to combined results
            const totalItems = combinedItems.length;
            const paginatedItems = combinedItems.slice(offset, offset + parseInt(limit));

            res.status(200).json({
                success: true,
                data: {
                    items: paginatedItems,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalItems / limit),
                        totalItems: totalItems,
                        itemsPerPage: parseInt(limit),
                        savedNotesCount: notesCount,
                        savedBudgetCalculationsCount: budgetCount,
                        totalSavedItems: notesCount + budgetCount
                    }
                }
            });
        } catch (error) {
            console.error("Error fetching all saved items:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch saved items",
                error: error.message
            });
        }
    }
};

module.exports = savedNoteController;