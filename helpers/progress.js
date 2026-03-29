const { fieldMapping } = require('./constants');

const countAnsweredQuestions = (budgetCalculation) => {
  const requiredFields = Object.values(fieldMapping);
  let answeredCount = 0;
  requiredFields.forEach(field => {
    const value = budgetCalculation[field];
    if (value !== null && value !== undefined && value !== '') {
      answeredCount++;
    }
  });
  return {
    answeredCount,
    totalQuestions: requiredFields.length,
    completionPercentage: Math.round((answeredCount / requiredFields.length) * 100)
  };
};

const createBudgetSummary = (budgetCalculation) => {
  const summary = budgetCalculation.toJSON();
  delete summary.conversation_history;
  return summary;
};

const createContextMessage = (budgetCalculation) => {
  const filledFields = [];
  const emptyFields = [];
  const plainBudget = budgetCalculation.toJSON ? budgetCalculation.toJSON() : budgetCalculation;

  Object.keys(fieldMapping).forEach(field => {
    const dbField = fieldMapping[field];
    const value = plainBudget[dbField];
    if (value !== null && value !== undefined && value !== '') {
      filledFields.push({ field, value, dbField });
    } else {
      emptyFields.push({ field, dbField });
    }
  });

  const contextMessage = `
CURRENT USER DATA STATUS:
Filled Fields (${filledFields.length}/12):
${filledFields.map(f => `- ${f.field}: ${f.value}`).join('\n')}

Empty Fields (${emptyFields.length}/12):
${emptyFields.map(f => `- ${f.field}: Not provided yet`).join('\n')}

Based on this information, ask the next appropriate question or acknowledge what they've provided.`;

  return contextMessage;
};

module.exports = {
  countAnsweredQuestions,
  createBudgetSummary,
  createContextMessage
};
