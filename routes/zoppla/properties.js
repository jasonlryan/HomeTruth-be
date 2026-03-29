const express = require('express');
const router = express.Router();
const { getProperties,
    getBookmarkedListingProperties,
    bookmarkProperty
 } = require('../../Controllers/zoopla/property1');
const auth = require("../../Middleware/authMiddleware");

// Support both GET and POST for flexibility
router.get('/',auth, getProperties);
router.post('/',auth, getProperties);
// You could also add a specific search endpoint
router.post('/search',auth, getProperties);

router.post('/bookmark',auth, bookmarkProperty);
router.get('/bookmark',auth, getBookmarkedListingProperties);


module.exports = router;