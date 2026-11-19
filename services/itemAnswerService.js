const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  ItemError,
  id
} = require('./itemContract');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
module.exports = function createItemAnswerService({
  items,
  Evidence,
  Answer,
  secret
}) {
  const checkSources = async (user, itemId, sources) => {
    for (const source of sources) {
      const link = await Evidence.findOne({
        where: {
          id: source.id,
          item_id: id(itemId),
          user_document_id: source.documentId,
          match_status: 'user_confirmed'
        }
      });
      if (!link) return false;
      let doc;
      try {
        doc = await items.document(user, source.documentId);
      } catch (e) {
        if (e.statusCode === 404) return false;
        throw e;
      }
      if (!require('./itemSource').readable(doc) || digest(doc.text_content) !== source.digest) return false;
    }
    return sources.length > 0;
  };
  return {
    issue(user, home, itemId, question, answer, sources) {
      if (!answer.statements.length) return null;
      return jwt.sign({
        purpose: 'home-item-answer',
        user: id(user),
        home: id(home),
        item: id(itemId),
        question,
        answer,
        sources
      }, secret, {
        algorithm: 'HS256',
        expiresIn: '1h'
      });
    },
    async save(user, home, itemId, token) {
      await items.find(user, home, itemId);
      let content;
      try {
        content = jwt.verify(token, secret, {
          algorithms: ['HS256']
        });
      } catch {
        throw new ItemError('This answer cannot be saved now. Ask again to check the current sources.', 409);
      }
      if (content.purpose !== 'home-item-answer' || content.user !== id(user) || content.home !== id(home) || content.item !== id(itemId)) throw new ItemError('Answer not found', 404);
      if (!(await checkSources(user, itemId, content.sources))) throw new ItemError('The evidence changed or was removed. Ask again before saving.', 409);
      const [row] = await Answer.findOrCreate({
        where: {
          user_id: id(user),
          token_hash: digest(token)
        },
        defaults: {
          item_id: id(itemId),
          content: {
            question: content.question,
            answer: content.answer,
            sources: content.sources
          }
        }
      });
      return {
        id: row.id,
        saved: true
      };
    },
    async list(user, home, itemId) {
      await items.find(user, home, itemId);
      const rows = await Answer.findAll({
        where: {
          item_id: id(itemId),
          user_id: id(user)
        },
        order: [['id', 'DESC']]
      });
      const result = [];
      for (const row of rows) {
        const available = await checkSources(user, itemId, row.content.sources);
        result.push({
          id: row.id,
          question: row.content.question,
          savedAt: row.createdAt,
          sourceUnavailable: !available,
          answer: available ? row.content.answer : null,
          sources: available ? row.content.sources.map(s => ({
            id: s.id,
            documentId: s.documentId,
            name: s.name
          })) : []
        });
      }
      return result;
    },
    async remove(user, home, itemId, answerId) {
      await items.find(user, home, itemId);
      const row = await Answer.findOne({
        where: {
          id: id(answerId),
          item_id: id(itemId),
          user_id: id(user)
        }
      });
      if (!row) throw new ItemError('Saved answer not found', 404);
      await row.destroy();
      return {
        removed: true
      };
    }
  };
};
module.exports.digest = digest;
