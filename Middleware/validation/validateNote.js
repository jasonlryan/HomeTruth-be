const validateNote = (req, res, next) => {
    const { title, content, tags } = req.body;
    const errors = [];

    // Validate title
    if (title !== undefined && title !== null) {
        if (typeof title !== 'string') {
            errors.push('Title must be a string');
        } else if (title.trim().length === 0) {
            errors.push('Title cannot be empty');
        } else if (title.length > 500) {
            errors.push('Title cannot exceed 500 characters');
        }
    }

    // Validate content
    if (content !== undefined && content !== null) {
        if (typeof content !== 'string') {
            errors.push('Content must be a string');
        } else if (content.trim().length === 0) {
            errors.push('Content cannot be empty');
        } else if (content.length > 50000) {
            errors.push('Content cannot exceed 50,000 characters');
        }
    }

    // Validate that at least title or content is provided
    if (req.method === 'POST') {
        if ((!title || title.trim().length === 0) && (!content || content.trim().length === 0)) {
            errors.push('Either title or content must be provided');
        }
    }

    // Validate tags
    if (tags !== undefined && tags !== null) {
        if (!Array.isArray(tags)) {
            errors.push('Tags must be an array');
        } else {
            // Check each tag
            for (let i = 0; i < tags.length; i++) {
                const tag = tags[i];
                if (typeof tag !== 'string') {
                    errors.push(`Tag at index ${i} must be a string`);
                } else if (tag.trim().length === 0) {
                    errors.push(`Tag at index ${i} cannot be empty`);
                } else if (tag.length > 50) {
                    errors.push(`Tag at index ${i} cannot exceed 50 characters`);
                }
            }
            
            // Check for duplicate tags
            const uniqueTags = [...new Set(tags.map(tag => tag.trim().toLowerCase()))];
            if (uniqueTags.length !== tags.length) {
                errors.push('Duplicate tags are not allowed');
            }
            
            // Limit number of tags
            if (tags.length > 20) {
                errors.push('Cannot have more than 20 tags');
            }
        }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors
        });
    }

    // Clean up the data
    if (title) req.body.title = title.trim();
    if (content) req.body.content = content.trim();
    if (tags && Array.isArray(tags)) {
        req.body.tags = tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    next();
};

module.exports = validateNote;