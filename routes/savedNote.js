const express = require("express");
const router = express.Router();
const auth = require("../Middleware/authMiddleware");
const validateNote = require("../Middleware/validation/validateNote"); // Optional validation middleware
const savedNoteController = require('../Controllers/savedNoteController/savedNoteController');

// Apply authentication middleware to all routes
router.use(auth);

// POST /api/saved-notes - Create a new saved note
router.post("/", validateNote, savedNoteController.createNote);

// GET /api/saved-notes - Get all saved notes for the authenticated user
router.get("/", savedNoteController.getUserNotes);

// GET /api/saved-notes/all-saved-items - Get combined list of saved notes and budget calculations
router.get("/all-saved-items", savedNoteController.getAllSavedItems);

// GET /api/saved-notes/:id - Get a specific saved note by ID
router.get("/:id", savedNoteController.getNoteById);

// PUT /api/saved-notes/:id - Update a specific saved note
router.put("/:id", validateNote, savedNoteController.updateNote);

// DELETE /api/saved-notes/:id - Delete a specific saved note
router.delete("/:id", savedNoteController.deleteNote);


module.exports = router;