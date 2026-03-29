const BudgetCalculation = require("../../models/budgetCalculations");
const SavedNote = require("../../models/savedNotes");
const OpenAI = require('openai');
const env = require('./../../config/env');
const openai = new OpenAI({ 
  apiKey: env.ai.OpenAIKey
});

const aiChatSystemMessage = {
  role: 'system',
  content: `You are a Home Affordability Budget Assistant that helps users in the UK by asking questions and saving their responses to a database.

Your goal is to collect the following 12 pieces of information through conversation:
1. Location (town/city and county)
2. Household annual gross income (before tax)
3. Other sources of regular income (if any)
4. Estimated credit score or credit range (e.g., excellent, good, fair, poor)
5. Total amount available for a deposit
6. Total monthly debt repayments (loans, credit cards, etc.)
7. Desired maximum monthly housing payment 
8. Preferred mortgage term (e.g., 25-year, 30-year)
9. Estimated council tax band or monthly cost (or use typical local averages if not provided)
10. Estimated buildings and contents insurance cost
11. Service charges or ground rent (if applicable)
12. Any major expected changes in income or expenses

IMPORTANT INSTRUCTIONS:
- Ask ONE question at a time
- Be conversational, polite, and concise

- Stay within your role – this is only an informal estimate, not financial advice

Start by greeting the user and asking for their location in the UK.`
};

// Field mapping for database updates
const fieldMapping = {
  'location': 'location',
  'household_income': 'household_income',
  'other_income': 'other_income',
  'credit_score_range': 'credit_score_range',
  'down_payment': 'down_payment',
  'monthly_debt_payments': 'monthly_debt_payments',
  'max_housing_payment': 'max_housing_payment',
  'loan_term_years': 'loan_term_years',
  'property_tax_rate': 'property_tax_rate',
  'insurance_cost': 'insurance_cost',
  'hoa_fees': 'hoa_fees',
  'expected_income_changes': 'expected_income_changes'
};

// Helper function to count answered questions
const countAnsweredQuestions = (budgetCalculation) => {
  const requiredFields = [
    'location',
    'household_income',
    'other_income',
    'credit_score_range',
    'down_payment',
    'monthly_debt_payments',
    'max_housing_payment',
    'loan_term_years',
    'property_tax_rate',
    'insurance_cost',
    'hoa_fees',
    'expected_income_changes'
  ];
  
  let answeredCount = 0;
  
  requiredFields.forEach(field => {
    const value = budgetCalculation[field];
    // Consider a field answered if it has a value (not null, undefined, or empty string)
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

// Enhanced validation functions with more lenient checks and detailed error messages
const validateLocation = (location) => {
  if (!location || typeof location !== 'string') {
    return { isValid: false, error: 'Location must be a text string' };
  }
  const trimmed = location.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Location must be at least 2 characters long' };
  }
  if (trimmed.length > 200) {
    return { isValid: false, error: 'Location must be less than 200 characters' };
  }
  
  // Check if it contains question words or financial terms that suggest it's not a location
  const lowerLocation = trimmed.toLowerCase();
  const invalidTerms = ['what', 'about', 'monthly', 'expenses', 'income', 'salary', 'budget', 'payment', 'cost', 'price', 'how much', 'how many'];
  if (invalidTerms.some(term => lowerLocation.includes(term))) {
    return { isValid: false, error: 'Please provide a UK location (town/city and county), not a question about finances. For example: "London, Greater London" or "Manchester, Greater Manchester"' };
  }
  
  // Check if it looks like a proper location (contains letters and possibly commas)
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Location must contain letters. Please provide a UK town/city and county' };
  }
  
  return { isValid: true, error: null };
};

const validateIncome = (income) => {
  const num = parseFloat(income);
  if (isNaN(num)) {
    return { isValid: false, error: 'Income must be a valid number' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Income cannot be negative' };
  }
  if (num > 50000000) {
    return { isValid: false, error: 'Income seems too high, please check the amount' };
  }
  return { isValid: true, error: null };
};

const validateCreditScore = (score) => {
  // Accept words or numeric scores between 200-900
  if (typeof score === 'string' && isNaN(parseInt(score))) {
    const lowerScore = score.toLowerCase();
    if (['excellent', 'good', 'fair', 'poor'].includes(lowerScore)) {
      return { isValid: true, error: null };
    }
    return { isValid: false, error: 'Credit score must be a number (200-900) or a range like "excellent", "good", "fair", or "poor"' };
  }
  const num = parseInt(score);
  if (isNaN(num)) {
    return { isValid: false, error: 'Credit score must be a valid number' };
  }
  if (num < 200 || num > 900) {
    return { isValid: false, error: 'Credit score must be between 200 and 900' };
  }
  return { isValid: true, error: null };
};

const validateDownPayment = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return { isValid: false, error: 'Down payment must be a valid number' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Down payment cannot be negative' };
  }
  if (num > 10000000) {
    return { isValid: false, error: 'Down payment seems too high, please check the amount' };
  }
  return { isValid: true, error: null };
};

const validateMonthlyPayment = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return { isValid: false, error: 'Monthly payment must be a valid number' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Monthly payment cannot be negative' };
  }
  if (num > 100000) {
    return { isValid: false, error: 'Monthly payment seems too high, please check the amount' };
  }
  return { isValid: true, error: null };
};

const validateLoanTerm = (years) => {
  const num = parseInt(years);
  if (isNaN(num)) {
    return { isValid: false, error: 'Loan term must be a valid number of years' };
  }
  if (num < 1) {
    return { isValid: false, error: 'Loan term must be at least 1 year' };
  }
  if (num > 60) {
    return { isValid: false, error: 'Loan term cannot exceed 60 years' };
  }
  return { isValid: true, error: null };
};

const validatePercentage = (rate) => {
  const num = parseFloat(rate);
  if (isNaN(num)) {
    return { isValid: false, error: 'Rate must be a valid number' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Rate cannot be negative' };
  }
  if (num > 50) {
    return { isValid: false, error: 'Rate seems too high, please check the amount' };
  }
  return { isValid: true, error: null };
};

// Context-aware extractor that only extracts data for the current field being asked
const extractInformationStrict = (userMessage, conversationHistory, budgetCalculation, currentField) => {
  const extractedData = {};
  const validationErrors = {};
  const message = userMessage.toLowerCase().trim();

  // Infer currentField if not passed
  if (!currentField) {
    const fieldOrder = [
      'location',
      'household_income',
      'other_income',
      'credit_score_range',
      'down_payment',
      'monthly_debt_payments',
      'max_housing_payment',
      'loan_term_years',
      'property_tax_rate',
      'insurance_cost',
      'hoa_fees',
      'expected_income_changes'
    ];
    for (const field of fieldOrder) {
      const value = budgetCalculation[field];
      if (value === null || value === undefined || value === '') {
        currentField = field;
        break;
      }
    }
  }

  if (!currentField) return { extractedData, validationErrors };

  let extractedValue = null;
  let validationResult = null;

  // Context-aware extraction - only extract for the current field
  switch (currentField) {
    case 'location': {
      // Look for location patterns
      const locationMatch = userMessage.match(/(?:live in|from|located in|i live in|i'm in|i am in)\s+([^,\.]+)/i);
      if (locationMatch) {
        validationResult = validateLocation(locationMatch[1].trim());
        if (validationResult.isValid) {
          extractedValue = locationMatch[1].trim();
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (!/\d/.test(userMessage) && !userMessage.toLowerCase().includes('what') && !userMessage.toLowerCase().includes('monthly') && !userMessage.toLowerCase().includes('expenses')) {
        // Only accept if it doesn't contain question words or financial terms
        validationResult = validateLocation(userMessage);
        if (validationResult.isValid) {
          extractedValue = userMessage.trim();
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else {
        validationErrors[currentField] = 'Please provide a UK location (town/city and county). For example: "London, Greater London" or "Manchester, Greater Manchester"';
      }
      break;
    }

    case 'household_income': {
      // Only extract income for household_income field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateIncome(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else {
        validationErrors[currentField] = 'Please provide your household annual gross income as a number';
      }
      break;
    }

    case 'other_income': {
      // Only extract income for other_income field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateIncome(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/\b(no|none|zero|don't have|nothing)\b/.test(message)) {
        extractedValue = 0;
      } else {
        validationErrors[currentField] = 'Please provide other income amount or say "none" if you have no other income';
      }
      break;
    }

    case 'credit_score_range': {
      // Only extract credit score for credit_score_range field
      const match = userMessage.match(/\b(\d{3})\b/);
      if (match) {
        validationResult = validateCreditScore(match[1]);
        if (validationResult.isValid) {
          extractedValue = match[1];
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/excellent/.test(message)) {
        extractedValue = 'Excellent (740+)';
      } else if (/good/.test(message)) {
        extractedValue = 'Good (670-739)';
      } else if (/fair/.test(message)) {
        extractedValue = 'Fair (580-669)';
      } else if (/poor/.test(message)) {
        extractedValue = 'Poor (below 580)';
      } else {
        validationErrors[currentField] = 'Please provide your credit score as a number (200-900) or a range like "excellent", "good", "fair", or "poor"';
      }
      break;
    }

    case 'down_payment': {
      // Only extract deposit amount for down_payment field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateDownPayment(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/\b(none|nothing|zero|no payments?)\b/.test(message)) {
        extractedValue = 0;
      } else {
        validationErrors[currentField] = 'Please provide the total amount available for a deposit as a number, or say "none" if you have no deposit';
      }
      break;
    }

    case 'monthly_debt_payments': {
      // Only extract debt payments for monthly_debt_payments field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateMonthlyPayment(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/\b(none|nothing|zero|no payments?)\b/.test(message)) {
        extractedValue = 0;
      } else {
        validationErrors[currentField] = 'Please provide your total monthly debt payments as a number, or say "none" if you have no debt payments';
      }
      break;
    }

    case 'max_housing_payment': {
      // Only extract housing payment for max_housing_payment field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateMonthlyPayment(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/\b(none|nothing|zero|no payments?)\b/.test(message)) {
        extractedValue = 0;
      } else {
        validationErrors[currentField] = 'Please provide your desired maximum monthly housing payment as a number';
      }
      break;
    }

    case 'loan_term_years': {
      // Only extract loan term for loan_term_years field
      const match = userMessage.match(/(\d{1,2})(?:\s*(year|yr|years))?/i);
      if (match) {
        validationResult = validateLoanTerm(parseInt(match[1], 10));
        if (validationResult.isValid) {
          extractedValue = parseInt(match[1], 10);
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/30/.test(message)) {
        extractedValue = 30;
      } else if (/25/.test(message)) {
        extractedValue = 25;
      } else {
        validationErrors[currentField] = 'Please provide the mortgage term in years (e.g., 25, 30)';
      }
      break;
    }

    case 'property_tax_rate': {
      // Only extract council tax for property_tax_rate field
      const percentMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*%/);
      const moneyMatch = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)/);
      if (percentMatch) {
        validationResult = validatePercentage(parseFloat(percentMatch[1]));
        if (validationResult.isValid) {
          extractedValue = parseFloat(percentMatch[1]);
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (moneyMatch) {
        const val = parseFloat(moneyMatch[1].replace(/,/g, ''));
        validationResult = validateMonthlyPayment(val);
        if (validationResult.isValid) {
          extractedValue = val; // store monthly council tax in £
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else {
        validationErrors[currentField] = 'Please provide council tax as a monthly amount (e.g., £120) or percentage (e.g., 1.2%)';
      }
      break;
    }

    case 'insurance_cost': {
      // Only extract insurance cost for insurance_cost field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateMonthlyPayment(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/\b(none|nothing|zero|no payments?)\b/.test(message)) {
        extractedValue = 0;
      } else {
        validationErrors[currentField] = 'Please provide insurance cost as a number, or say "none" if you have no insurance costs';
      }
      break;
    }

    case 'hoa_fees': {
      // Only extract service charges for hoa_fees field
      const match = userMessage.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) val *= 1000;
        validationResult = validateMonthlyPayment(val);
        if (validationResult.isValid) {
          extractedValue = val;
        } else {
          validationErrors[currentField] = validationResult.error;
        }
      } else if (/\b(none|nothing|zero|no payments?)\b/.test(message)) {
        extractedValue = 0;
      } else {
        validationErrors[currentField] = 'Please provide service charges or ground rent as a number, or say "none" if not applicable';
      }
      break;
    }

    case 'expected_income_changes': {
      // Only extract income changes for expected_income_changes field
      if (/\b(no|none|nothing|not expecting|no major changes)\b/.test(message)) {
        extractedValue = 'None';
      } else if (userMessage.trim().length > 0) {
        extractedValue = userMessage.trim();
      } else {
        validationErrors[currentField] = 'Please describe any expected changes in income or expenses, or say "none" if you don\'t expect any changes';
      }
      break;
    }
  }

  if (extractedValue !== null && extractedValue !== undefined) {
    extractedData[currentField] = extractedValue;
  }

  return { extractedData, validationErrors };
};

// Helper function to create budget calculation summary without conversation_history
const createBudgetSummary = (budgetCalculation) => {
  const summary = budgetCalculation.toJSON ? budgetCalculation.toJSON() : budgetCalculation;
  delete summary.conversation_history;
  return summary;
};

// Guidance messages for each field when user input is ambiguous or wrong
const guidanceForField = (field) => {
  const examples = {
    'location': `Please provide your UK location (town/city and county). For example: "London, Greater London" or "Manchester, Greater Manchester".`,
    'household_income': `Please enter your household's total annual gross income before tax as a number. Examples: "50000" or "£50,000".`,
    'other_income': `If you have no other income write "none" or "0". Otherwise give an amount like "2000" or "£2,000" (per year).`,
    'credit_score_range': `You can either give a numeric credit score (e.g. "720") or a range like "excellent", "good", "fair", or "poor".`,
    'down_payment': `Tell me the total amount available for a deposit. Example: "8000" or "£8,000". If none, reply "0".`,
    'monthly_debt_payments': `Please tell me the total you pay each month towards loans and credit (e.g. "600" or "£600"). If none, reply "0".`,
    'max_housing_payment': `What's the maximum you'd like to pay each month for housing? Example: "1500" or "£1,500".`,
    'loan_term_years': `Enter the mortgage term in years. Examples: "25" or "30".`,
    'property_tax_rate': `You can give a council tax monthly amount (e.g. "£120") or a percent if you prefer. Example: "£120" or "1.2%".`,
    'insurance_cost': `Give an estimated monthly or annual buildings & contents insurance amount, e.g. "10" (per month) or "120" (per year). If unsure, reply "unknown".`,
    'hoa_fees': `Enter any service charges or ground rent per month (e.g. "50" or "£50"). If none, reply "0".`,
    'expected_income_changes': `If you don't expect any changes reply "none". Otherwise briefly describe the change (e.g. "starting new job in 6 months" or "expected bonus of £2000 next year").`
  };
  return examples[field] || 'Please provide the requested information.';
};

const aiChatBudgetController = {
  
  // Start a new AI chat session and create budget calculation record
async startAIBudgetChat(req, res) {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const budgetCalculation = await BudgetCalculation.create({
      user_id,
      name: `Budget Chat ${new Date().toLocaleDateString()}`,
      location: null,
      household_income: null,
      other_income: null,
      credit_score_range: null,
      down_payment: null,
      monthly_debt_payments: null,
      max_housing_payment: null,
      loan_term_years: null,
      property_tax_rate: null,
      insurance_cost: null,
      hoa_fees: null,
      expected_income_changes: null,
      estimated_monthly_payment_range: null,
      conversation_history: JSON.stringify([aiChatSystemMessage])
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [aiChatSystemMessage]
    });

    const assistantReply = response.choices[0].message.content;

    // Update conversation history
    const updatedHistory = [
      aiChatSystemMessage,
      { role: 'assistant', content: assistantReply }
    ];

    await budgetCalculation.update({
      conversation_history: JSON.stringify(updatedHistory)
    });

    const questionProgress = countAnsweredQuestions(budgetCalculation);

    return res.status(200).json({
      success: true,
      message: 'AI budget chat session started',
      data: {
        budgetCalculationId: budgetCalculation.id,
        reply: assistantReply,
        conversationId: Date.now(),
        questionProgress: questionProgress,
        budgetCalculation: createBudgetSummary(budgetCalculation)
      }
    });

  } catch (error) {
    console.error('Error starting AI budget chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
    });
  }
},

// Continue AI chat conversation and update database
async continueAIBudgetChat(req, res) {
  try {
    const user_id = req.user?.id;
    const { userMessage, budgetCalculationId } = req.body;

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'userMessage is required and must be a string'
      });
    }

    if (!budgetCalculationId) {
      return res.status(400).json({
        success: false,
        message: 'budgetCalculationId is required'
      });
    }

    const questionOrder = [
      { field: 'location', question: 'Location (town/city and county)' },
      { field: 'household_income', question: 'Household annual gross income (before tax)' },
      { field: 'other_income', question: 'Other sources of regular income (if any)' },
      { field: 'credit_score_range', question: 'Estimated credit score or credit range' },
      { field: 'down_payment', question: 'Total amount available for a deposit' },
      { field: 'monthly_debt_payments', question: 'Total monthly debt repayments' },
      { field: 'max_housing_payment', question: 'Desired maximum monthly housing payment' },
      { field: 'loan_term_years', question: 'Preferred mortgage term (years)' },
      { field: 'property_tax_rate', question: 'Estimated council tax band or monthly cost' },
      { field: 'insurance_cost', question: 'Estimated buildings and contents insurance cost' },
      { field: 'hoa_fees', question: 'Service charges or ground rent (if applicable)' },
      { field: 'expected_income_changes', question: 'Any major expected changes in income or expenses' }
    ];

    // Fetch calculation without history (for speed)
    let budgetCalculation = await BudgetCalculation.findOne({
      where: { id: budgetCalculationId, user_id },
      attributes: { exclude: ['conversation_history'] }
    });

    if (!budgetCalculation) {
      return res.status(404).json({ success: false, message: 'Budget calculation not found' });
    }

    // Fetch conversation history separately
    const budgetWithHistory = await BudgetCalculation.findOne({
      where: { id: budgetCalculationId, user_id },
      attributes: ['conversation_history']
    });

    let messageHistory = [];
    try {
      messageHistory = JSON.parse(budgetWithHistory?.conversation_history || '[]');
    } catch (error) {
      console.error('Error parsing conversation history:', error);
      messageHistory = [aiChatSystemMessage];
    }

    // Determine current question expected BEFORE updating
    const unansweredBefore = questionOrder
      .map((q, i) => ({ ...q, index: i + 1 }))
      .filter(q => {
        const value = budgetCalculation[q.field];
        return value === null || value === undefined || value === '';
      });

    const currentQuestionBeforeUpdate = unansweredBefore[0] || null;
    const currentField = currentQuestionBeforeUpdate?.field;

    // Extract data from user's message (we pass currentField so extractor focuses on it)
    const { extractedData, validationErrors } = extractInformationStrict(userMessage, messageHistory, budgetCalculation, currentField);

    // Always append the user's message to the conversation history
    const updatedHistory = [
      ...messageHistory,
      { role: 'user', content: userMessage }
    ];

    // Determine whether extractor found the current field and if it's valid
    const includesCurrent = currentField && extractedData.hasOwnProperty(currentField) && extractedData[currentField] !== null && extractedData[currentField] !== undefined;
    const hasValidationError = currentField && validationErrors.hasOwnProperty(currentField);

    // If extractor found some fields (including possibly the current one) then save them.
    // We intentionally accept other fields the user provided, but we will NOT advance past the current field
    // unless the currentField was included in extractedData and has no validation errors.
    if (Object.keys(extractedData).length > 0) {
      await budgetCalculation.update({
        ...extractedData,
        conversation_history: JSON.stringify(updatedHistory)
      });
    } else {
      // Nothing parsed that we can save for now - only save the conversation history
      await budgetCalculation.update({
        conversation_history: JSON.stringify(updatedHistory)
      });
    }

    // Reload fresh record (including conversation_history) to compute progress
    const freshBudget = await BudgetCalculation.findOne({ where: { id: budgetCalculationId, user_id } });

    // Prepare completed & remaining lists
    const completedQuestions = [];
    const remainingQuestions = [];

    questionOrder.forEach((q, i) => {
      const val = freshBudget[q.field];
      const hasValue = val !== null && val !== undefined && val !== '';
      if (hasValue) {
        completedQuestions.push({ ...q, index: i + 1, answer: val });
      } else {
        remainingQuestions.push({ ...q, index: i + 1 });
      }
    });

    const isCompleted = remainingQuestions.length === 0;
    const nextQuestionObj = remainingQuestions[0] || null;
    const currentQuestionIndex = nextQuestionObj ? nextQuestionObj.index : questionOrder.length;

    // If current answer was NOT included in the parsed data or has validation errors, re-ask the same question with guidance
    if ((!includesCurrent || hasValidationError) && currentField) {
      // Acknowledge any fields we saved (if any) then ask the current question again with examples
      const savedFields = Object.keys(extractedData).length > 0 ? Object.keys(extractedData).map(f => `${f}: ${extractedData[f]}`).join(', ') : null;

      let assistantReply = '';
      if (savedFields) {
        assistantReply += `Thanks — I saved: ${savedFields}.\n\n`;
      }
      
      // If there's a validation error, show the specific error message
      if (hasValidationError) {
        assistantReply += `I need to clarify something about your answer for "${currentQuestionBeforeUpdate.question}". `;
        assistantReply += validationErrors[currentField];
        assistantReply += `\n\nPlease provide a valid answer for this question.`;
      } else {
        assistantReply += `I still need your answer to: "${currentQuestionBeforeUpdate.question}". `;
        assistantReply += guidanceForField(currentField);
      }

      // Append assistant reply to updated history and save
      const finalHistory = [
        ...updatedHistory,
        { role: 'assistant', content: assistantReply }
      ];

      await freshBudget.update({ conversation_history: JSON.stringify(finalHistory) });

      const budgetSummary = createBudgetSummary(freshBudget);

      return res.status(200).json({
        success: true,
        message: hasValidationError ? 'Chat message processed but current answer is invalid' : 'Chat message processed but current question not answered',
        data: {
          reply: assistantReply,
          budgetCalculation: budgetSummary,
          extractedData,
          validationErrors,
          questionProgress: {
            current: currentQuestionIndex,
            total: questionOrder.length,
            percentage: Math.round((completedQuestions.length / questionOrder.length) * 100),
            completed: completedQuestions.length,
            currentQuestion: currentQuestionBeforeUpdate?.question || 'All completed',
            isCompleted,
            allDataCollected: isCompleted,
            readyForEstimate: isCompleted,
            showEstimateButton: isCompleted
          },
          completedQuestions: completedQuestions.map((q) => ({
            number: q.index,
            question: q.question,
            field: q.field,
            answer: q.answer
          })),
          status: isCompleted ? 'READY_FOR_ESTIMATE' : 'COLLECTING_DATA'
        }
      });
    }

    // If we got here, the current field was answered (or there was no currentField) — continue and ask the AI to provide the next conversational prompt
    const contextMessage = `
BUDGET INFORMATION COLLECTION STATUS:

PROGRESS: ${completedQuestions.length} of 12 questions completed (${Math.round((completedQuestions.length / 12) * 100)}%)

COMPLETED QUESTIONS (${completedQuestions.length}):
${completedQuestions.map((q) => `${q.index}. ${q.question}: ${q.answer}`).join('\n')}

${isCompleted ? 
  `🎉 ALL 12 QUESTIONS COMPLETED! 

IMPORTANT: Tell the user enthusiastically that they now have all the information needed and can click the "Get my estimate" button to generate their personalized home affordability estimate.` : 
  `CURRENT QUESTION TO ASK:
${nextQuestionObj.index}. ${nextQuestionObj.question}

REMAINING QUESTIONS (${remainingQuestions.length - 1}):
${remainingQuestions.slice(1).map((q) => `${q.index}. ${q.question}`).join('\n')}`}

INSTRUCTIONS:
- ${isCompleted ? 'All information collected! Tell them to click "Get my estimate" button to generate their personalized home affordability calculation.' : `Ask ONLY about: "${nextQuestionObj.question}"`}
- Do NOT ask about completed questions
- Do NOT skip ahead to future questions
- If user doesn't answer current question clearly, re-ask it
- Be conversational and acknowledge their response
- Stay focused on the current question until it's answered

User's latest message: "${userMessage}"
`;

    const messagesForAI = [
      aiChatSystemMessage,
      { role: 'system', content: contextMessage },
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: messagesForAI,
      temperature: 0.1
    });

    const assistantReply = response.choices[0].message.content;

    // Append assistant reply to history and save
    const finalHistory = [
      ...updatedHistory,
      { role: 'assistant', content: assistantReply }
    ];

    await freshBudget.update({ conversation_history: JSON.stringify(finalHistory) });

    const budgetSummary = createBudgetSummary(freshBudget);

    return res.status(200).json({
      success: true,
      message: 'Chat message processed and data updated',
      data: {
        reply: assistantReply,
        budgetCalculation: budgetSummary,
        extractedData,
        validationErrors,
        questionProgress: {
          current: currentQuestionIndex,
          total: questionOrder.length,
          percentage: Math.round((completedQuestions.length / questionOrder.length) * 100),
          completed: completedQuestions.length,
          currentQuestion: nextQuestionObj?.question || 'All completed',
          isCompleted,
          allDataCollected: isCompleted,
          readyForEstimate: isCompleted,
          showEstimateButton: isCompleted
        },
        completedQuestions: completedQuestions.map((q) => ({
          number: q.index,
          question: q.question,
          field: q.field,
          answer: q.answer
        })),
        status: isCompleted ? 'READY_FOR_ESTIMATE' : 'COLLECTING_DATA'
      }
    });

  } catch (error) {
    console.error('Error continuing AI budget chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
    });
  }
},

  // Get conversation history for a budget calculation
  async getChatHistory(req, res) {
    try {
      const user_id = req.user?.id;
      const { budgetCalculationId } = req.params;
      
      if (!user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const budgetCalculation = await BudgetCalculation.findOne({
        where: { id: budgetCalculationId, user_id }
      });
      
      if (!budgetCalculation) {
        return res.status(404).json({
          success: false,
          message: 'Budget calculation not found'
        });
      }
      
      let conversationHistory = [];
      try {
        conversationHistory = JSON.parse(budgetCalculation.conversation_history || '[]');
      } catch (error) {
        console.error('Error parsing conversation history:', error);
        conversationHistory = [];
      }
      
      // Filter out system messages for client display
      const userFriendlyHistory = conversationHistory.filter(msg => msg.role !== 'system');
      
      return res.status(200).json({
        success: true,
        data: {
          conversationHistory: userFriendlyHistory,
          budgetCalculation: createBudgetSummary(budgetCalculation)
        }
      });
      
    } catch (error) {
      console.error('Error getting chat history:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },
  
  // Clear conversation history (restart chat)
async clearChatHistory(req, res) {
    try {
      const user_id = req.user?.id;
      const { budgetCalculationId } = req.params;
      
      if (!user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const budgetCalculation = await BudgetCalculation.findOne({
        where: { id: budgetCalculationId, user_id }
      });
      
      if (!budgetCalculation) {
        return res.status(404).json({
          success: false,
          message: 'Budget calculation not found'
        });
      }
      
      // Reset conversation history to just the system message
      await budgetCalculation.update({
        conversation_history: JSON.stringify([aiChatSystemMessage])
      });
      
      return res.status(200).json({
        success: true,
        message: 'Chat history cleared successfully'
      });
      
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },
  
  // Manually update specific field (for when extraction fails)
async updateBudgetField(req, res) {
    try {
      const user_id = req.user?.id;
      const { budgetCalculationId } = req.params;
      const { field, value } = req.body;
      
      if (!user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      if (!field || !fieldMapping[field]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid field name'
        });
      }
      
      const budgetCalculation = await BudgetCalculation.findOne({
        where: { id: budgetCalculationId, user_id }
      });
      
      if (!budgetCalculation) {
        return res.status(404).json({
          success: false,
          message: 'Budget calculation not found'
        });
      }
      
      const updateData = { [fieldMapping[field]]: value };
      await budgetCalculation.update(updateData);
      await budgetCalculation.reload(); // ✅ Ensure latest values are fetched before continuing
      
      return res.status(200).json({
        success: true,
        message: 'Field updated successfully',
        data: {
          field: field,
          value: value,
          budgetCalculation: createBudgetSummary(budgetCalculation)
        }
      });
      
    } catch (error) {
      console.error('Error updating budget field:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },
  
  // Manually update all fields (for when extraction fails)
async updateAllBudgetFields(req, res) {
    try {
      const user_id = req.user?.id;
      const { budgetCalculationId } = req.params;
      const updates = req.body;
  
      if (!user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
  
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid input: Request body must contain fields to update.'
        });
      }
  
      const budgetCalculation = await BudgetCalculation.findOne({
        where: { id: budgetCalculationId, user_id }
      });
  
      if (!budgetCalculation) {
        return res.status(404).json({
          success: false,
          message: 'Budget calculation not found'
        });
      }
  
      // Filter out only valid fields
      const validUpdates = {};
      for (const key in updates) {
        if (fieldMapping[key]) {
          validUpdates[fieldMapping[key]] = updates[key];
        }
      }
  
      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update.'
        });
      }
  
      await budgetCalculation.update(validUpdates);
  
      return res.status(200).json({
        success: true,
        message: 'Fields updated successfully.',
        data: {
          updatedFields: validUpdates,
          budgetCalculation: createBudgetSummary(budgetCalculation)
        }
      });
  
    } catch (error) {
      console.error('Error updating all budget fields:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },
async generateEstimateFromChat(req, res) {
    try {
      const user_id = req.user?.id;
      const { budgetCalculationId } = req.params;
  
      if (!user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
  
      const budgetCalculation = await BudgetCalculation.findOne({
        where: { id: budgetCalculationId, user_id }
      });
  
      if (!budgetCalculation) {
        return res.status(404).json({
          success: false,
          message: 'Budget calculation not found'
        });
      }
  
      const availableData = {};
      const missingCriticalData = [];
  
      const criticalFields = {
        location: budgetCalculation.location,
        household_income: budgetCalculation.household_income,
        down_payment: budgetCalculation.down_payment,
        credit_score_range: budgetCalculation.credit_score_range
      };
  
      const optionalFields = {
        other_income: budgetCalculation.other_income,
        monthly_debt_payments: budgetCalculation.monthly_debt_payments,
        max_housing_payment: budgetCalculation.max_housing_payment,
        loan_term_years: budgetCalculation.loan_term_years
      };
  
      Object.entries(criticalFields).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          availableData[key] = value;
        } else {
          missingCriticalData.push(key);
        }
      });
  
      Object.entries(optionalFields).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          availableData[key] = value;
        }
      });
  
      const canEstimate = missingCriticalData.length <= 2;
      const hasMinimalData = availableData.household_income || availableData.location;
  
      if (!hasMinimalData) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient data to generate estimate. At least income or location is required.',
          data: {
            missingCriticalData,
            availableFields: Object.keys(availableData),
            recommendation: 'Please provide at least your household income and location to generate an estimate.'
          }
        });
      }
  
      // ======== STATIC ESTIMATION LOGIC ==========
      const household_income = parseFloat(budgetCalculation.household_income || 0);
      const other_income = parseFloat(budgetCalculation.other_income || 0);
      const monthly_debt = parseFloat(budgetCalculation.monthly_debt_payments || 0);
  
      const gross_monthly_income = (household_income + other_income) / 12;
      let estimated = gross_monthly_income * 0.3 - monthly_debt;
  
      estimated = Math.max(estimated, 200); // ensure minimum
  
      const min = Math.round(estimated * 0.9);
      const max = Math.round(estimated * 1.1);
      const currency = 'GBP';
  
      const displayRange = `${currency}${min} - ${currency}${max}/month`;
  
      budgetCalculation.estimated_monthly_payment_range = displayRange;
      await budgetCalculation.save();
  
      // Determine risk level
      const credit = parseInt(budgetCalculation.credit_score_range || '0');
      let riskLevel = 'unknown';
      if (credit >= 740) riskLevel = 'low';
      else if (credit >= 670) riskLevel = 'medium';
      else if (credit > 0) riskLevel = 'high';
  
      const dataCompleteness = Math.round((Object.keys(availableData).length / 8) * 100);
  
      return res.status(200).json({
        success: true,
        message: canEstimate
          ? 'Estimate generated successfully.'
          : 'Preliminary estimate generated with limited data.',
        data: {
          estimate: {
            hasCompleteInfo: missingCriticalData.length === 0,
            dataCompleteness,
            estimatedRange: { min, max, currency }
          },
          displayRange,
          riskLevel,
          hasCompleteInfo: missingCriticalData.length === 0,
          dataCompleteness,
          availableFields: Object.keys(availableData),
          missingCriticalData,
          budgetCalculation: {
            id: budgetCalculation.id,
            user_id: budgetCalculation.user_id,
            name: budgetCalculation.name,
            location: budgetCalculation.location,
            household_income: budgetCalculation.household_income,
            other_income: budgetCalculation.other_income,
            credit_score_range: budgetCalculation.credit_score_range,
            down_payment: budgetCalculation.down_payment,
            monthly_debt_payments: budgetCalculation.monthly_debt_payments,
            max_housing_payment: budgetCalculation.max_housing_payment,
            loan_term_years: budgetCalculation.loan_term_years,
            estimated_monthly_payment_range: displayRange
          }
        }
      });
  
    } catch (error) {
      console.error('Estimate generation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },
  
  // Get current budget calculation status
  async getBudgetChatStatus(req, res) {
    try {
      const user_id = req.user?.id;
      const { budgetCalculationId } = req.params;
      
      if (!user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const budgetCalculation = await BudgetCalculation.findOne({
        where: { id: budgetCalculationId, user_id }
      });
      
      if (!budgetCalculation) {
        return res.status(404).json({
          success: false,
          message: 'Budget calculation not found'
        });
      }
      
      // Question order mapping
      const questionOrder = [
        { field: 'location', question: 'Location (town/city and county)' },
        { field: 'household_income', question: 'Household annual gross income (before tax)' },
        { field: 'other_income', question: 'Other sources of regular income (if any)' },
        { field: 'credit_score_range', question: 'Estimated credit score or credit range' },
        { field: 'down_payment', question: 'Total amount available for a deposit' },
        { field: 'monthly_debt_payments', question: 'Total monthly debt repayments' },
        { field: 'max_housing_payment', question: 'Desired maximum monthly housing payment' },
        { field: 'loan_term_years', question: 'Preferred mortgage term (years)' },
        { field: 'property_tax_rate', question: 'Estimated council tax band or monthly cost' },
        { field: 'insurance_cost', question: 'Estimated buildings and contents insurance cost' },
        { field: 'hoa_fees', question: 'Service charges or ground rent (if applicable)' },
        { field: 'expected_income_changes', question: 'Any major expected changes in income or expenses' }
      ];
      
      // Calculate completion percentage
      const fields = Object.keys(fieldMapping);
      const completedFields = fields.filter(field => {
        const dbField = fieldMapping[field];
        return budgetCalculation[dbField] !== null && budgetCalculation[dbField] !== undefined;
      });
      
      const completionPercentage = Math.round((completedFields.length / fields.length) * 100);
      
      // Parse conversation history to extract chat messages
      let chatHistory = [];
      
      if (budgetCalculation.conversation_history) {
        try {
          const conversationData = JSON.parse(budgetCalculation.conversation_history);
          
          // Helper function to get question text from field name
          const getQuestionFromField = (fieldName) => {
            const questionObj = questionOrder.find(q => q.field === fieldName);
            return questionObj ? questionObj.question : null;
          };
          
          // If conversation_history is an array of messages (your current format)
          const isInitialSystemPrompt = (msg) => {
            return msg.role === 'system' && typeof msg.content === 'string' &&
              msg.content.includes('You are a Home Affordability Budget Assistant') &&
              msg.content.includes('Your goal is to collect the following 12 pieces of information');
          };
          
          if (Array.isArray(conversationData)) {
            chatHistory = conversationData
              .filter(msg => !isInitialSystemPrompt(msg))
              .map(msg => ({
                role: msg.role,
                content: msg.content,
                fieldName: msg.fieldName || msg.field_name || msg.field || null,
                question: msg.fieldName ? getQuestionFromField(msg.fieldName) : null
              }));
          } else if (conversationData.messages && Array.isArray(conversationData.messages)) {
            chatHistory = conversationData.messages
              .filter(msg => !isInitialSystemPrompt(msg))
              .map(msg => ({
                role: msg.role,
                content: msg.content || msg.message,
                fieldName: msg.fieldName || msg.field_name || msg.field || null,
                question: msg.fieldName ? getQuestionFromField(msg.fieldName) : null
              }));
          } else if (conversationData.history && Array.isArray(conversationData.history)) {
            chatHistory = conversationData.history
              .filter(msg => !isInitialSystemPrompt(msg))
              .map(msg => ({
                role: msg.role,
                content: msg.content,
                fieldName: msg.fieldName || msg.field_name || msg.field || null,
                question: msg.fieldName ? getQuestionFromField(msg.fieldName) : null
              }));
          }
          
        } catch (parseError) {
          console.error('Error parsing conversation history:', parseError);
          chatHistory = [];
        }
      }
      
      return res.status(200).json({
        success: true,
        data: {
          budgetCalculation: budgetCalculation.toJSON(),
          completionPercentage,
          completedFields: completedFields.length,
          totalFields: fields.length,
          missingFields: fields.filter(field => !completedFields.includes(field)),
          chatHistory: chatHistory,
          totalMessages: chatHistory.length,
          fieldsWithAnswers: questionOrder.map(item => ({
            fieldName: item.field,
            question: item.question,
            answer: budgetCalculation[item.field] || null
          }))
        }
      });
      
    } catch (error) {
      console.error('Error getting budget chat status:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
  // Get all budget calculations for a user
async getAllBudgetCalculations(req, res) {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const budgetCalculations = await BudgetCalculation.findAll({
      where: { user_id },
      attributes: {
        exclude: ['conversation_history']
      },
      
      order: [['createdAt', 'DESC']] // Optional: order by most recent first
    });

    return res.status(200).json({
      success: true,
      data: budgetCalculations
    });

  } catch (error) {
    console.error('Error fetching all budget calculations:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
    });
  }
},
// Mark a budget calculation as saved
async markAsSaved(req, res) {
  try {
    const user_id = req.user?.id;
    const { budgetCalculationId,name } = req.params;
    // const { name } = req.body; // Extract name from request body

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const budgetCalculation = await BudgetCalculation.findOne({
      where: { id: budgetCalculationId, user_id }
    });

    if (!budgetCalculation) {
      return res.status(404).json({
        success: false,
        message: 'Budget calculation not found'
      });
    }

    // Only count and validate if this record is not already saved
    if (!budgetCalculation.is_saved) {
      // Check combined limit: saved notes + saved budget calculations should be less than 5
      const savedNotesCount = await SavedNote.count({
        where: { user_id }
      });
      
      const savedBudgetCalculationsCount = await BudgetCalculation.count({
        where: { user_id, is_saved: true }
      });
      
      const totalSavedItems = savedNotesCount + savedBudgetCalculationsCount;

      if (totalSavedItems >= 5) {
        return res.status(400).json({
          success: false,
          message: `You cannot save more items. You currently have ${savedNotesCount} saved notes and ${savedBudgetCalculationsCount} saved budget calculations (total: ${totalSavedItems}/5).`
        });
      }

      budgetCalculation.is_saved = true;
    }

    // Update the name if provided in request body
    if (name !== undefined) {
      budgetCalculation.name = name;
    }

    await budgetCalculation.save();

    // Get updated counts for response
    const savedNotesCount = await SavedNote.count({
      where: { user_id }
    });
    
    const savedBudgetCalculationsCount = await BudgetCalculation.count({
      where: { user_id, is_saved: true }
    });
    
    const totalSavedItems = savedNotesCount + savedBudgetCalculationsCount;

    return res.status(200).json({
      success: true,
      message: 'Budget calculation marked as saved',
      data: { 
        id: budgetCalculation.id, 
        is_saved: budgetCalculation.is_saved,
        name: budgetCalculation.name,
        totalSavedItems: totalSavedItems
      }
    });

  } catch (error) {
    console.error('Error marking as saved:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
},
async getSavedBudgetCalculations(req, res) {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const savedBudgetCalculations = await BudgetCalculation.findAll({
      where: {
        user_id,
        is_saved: true
      },
      attributes: {
        // exclude: ['conversation_history']
      },
      order: [['createdAt', 'DESC']] // Optional: most recent first
    });

    return res.status(200).json({
      success: true,
      data: savedBudgetCalculations
    });

  } catch (error) {
    console.error('Error fetching saved budget calculations:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
    });
  }
}  ,
async updateBudgetCalculationName(req, res) {
  try {
    const user_id = req.user?.id;
    const { budgetCalculationId } = req.params;
    const { name } = req.body;

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const budgetCalculation = await BudgetCalculation.findOne({
      where: { id: budgetCalculationId, user_id }
    });

    if (!budgetCalculation) {
      return res.status(404).json({
        success: false,
        message: 'Budget calculation not found'
      });
    }

    // Update the name
    budgetCalculation.name = name.trim();
    await budgetCalculation.save();

    return res.status(200).json({
      success: true,
      message: 'Budget calculation name updated successfully',
      data: {
        id: budgetCalculation.id,
        name: budgetCalculation.name
      }
    });

  } catch (error) {
    console.error('Error updating budget calculation name:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
},

// Clear a specific field to allow re-entry
async clearBudgetField(req, res) {
  try {
    const user_id = req.user?.id;
    const { budgetCalculationId, field } = req.params;

    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!field || !fieldMapping[field]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field name'
      });
    }

    const budgetCalculation = await BudgetCalculation.findOne({
      where: { id: budgetCalculationId, user_id }
    });

    if (!budgetCalculation) {
      return res.status(404).json({
        success: false,
        message: 'Budget calculation not found'
      });
    }

    // Clear the specific field
    const updateData = { [fieldMapping[field]]: null };
    await budgetCalculation.update(updateData);

    return res.status(200).json({
      success: true,
      message: `Field ${field} cleared successfully`,
      data: {
        field: field,
        budgetCalculation: createBudgetSummary(budgetCalculation)
      }
    });

  } catch (error) {
    console.error('Error clearing budget field:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

};

module.exports = aiChatBudgetController;
