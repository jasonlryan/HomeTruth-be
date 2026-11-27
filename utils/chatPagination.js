const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function chatPagination(query = {}) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? DEFAULT_LIMIT);
  if (Array.isArray(query.page) || Array.isArray(query.limit) ||
      !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT ||
      !Number.isSafeInteger((page - 1) * limit)) {
    return null;
  }
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { chatPagination, DEFAULT_LIMIT, MAX_LIMIT };
