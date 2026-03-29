const {
    validateLocation,
    validateIncome,
    validateCreditScore,
    validateDownPayment,
    validateMonthlyPayment,
    validateLoanTerm,
    validatePercentage
  } = require('./validations');
  
  const extractInformationStrict = (userMessage, conversationHistory, budgetCalculation, currentField) => {
    const extractedData = {};
    const message = userMessage.toLowerCase().trim();
  
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
  
    if (!currentField) return extractedData;
  
    let extractedValue = null;
  
    const extractNumeric = () => {
      const match = message.match(/(?:around|about|roughly|close to|nearly|approximately)?\s*\£?\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?/);
      return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    };
  
    switch (currentField) {
      case 'location': {
        const locationMatch = message.match(/(?:live in|from|located in|in)\s+([^,.]+)/i);
        if (locationMatch && validateLocation(locationMatch[1].trim())) {
          extractedValue = locationMatch[1].trim();
        } else if (!message.match(/\d+/)) {
          const words = message.split(/\s+/);
          if (words.length <= 4 && validateLocation(message)) {
            extractedValue = message;
          }
        }
        break;
      }
  
      case 'household_income':
      case 'other_income': {
        const match = message.match(/\£?\$?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|thousand))?/i);
        if (match) {
          let val = parseFloat(match[1].replace(/,/g, ''));
          if (match[2]) val *= 1000;
          if (validateIncome(val)) extractedValue = val;
        } else if (/(no|none|zero|don't have)/.test(message)) {
          extractedValue = 0;
        }
        break;
      }
  
      case 'credit_score_range': {
        const match = message.match(/\b(\d{3})\b/);
        if (match && validateCreditScore(match[1])) {
          extractedValue = match[1];
        } else if (/excellent/.test(message)) {
          extractedValue = 'Excellent (740+)';
        } else if (/good/.test(message)) {
          extractedValue = 'Good (670-739)';
        } else if (/fair/.test(message)) {
          extractedValue = 'Fair (580-669)';
        } else if (/poor/.test(message)) {
          extractedValue = 'Poor (below 580)';
        }
        break;
      }
  
      case 'down_payment':
      case 'monthly_debt_payments':
      case 'max_housing_payment':
      case 'insurance_cost':
      case 'hoa_fees': {
        const val = extractNumeric();
        if (val !== null && validateMonthlyPayment(val)) {
          extractedValue = val;
        } else if (/(none|nothing|zero|no payments?)/.test(message)) {
          extractedValue = 0;
        }
        break;
      }
  
      case 'loan_term_years': {
        const match = message.match(/(\d{1,2})(?:\s*(year|yr|years))?/i);
        if (match && validateLoanTerm(parseInt(match[1]))) {
          extractedValue = parseInt(match[1]);
        } else if (/30/.test(message)) {
          extractedValue = 30;
        } else if (/25/.test(message)) {
          extractedValue = 25;
        }
        break;
      }
  
      case 'property_tax_rate': {
        const match = message.match(/(\d+(\.\d+)?)\s*%/);
        if (match && validatePercentage(parseFloat(match[1]))) {
          extractedValue = parseFloat(match[1]);
        }
        break;
      }
  
      case 'expected_income_changes': {
        if (/no|none|nothing|not expecting/.test(message)) {
          extractedValue = 'None';
        } else if (message.length > 5 || /\d/.test(message)) {
          extractedValue = userMessage.trim();
        }
        break;
      }
    }
  
    if (extractedValue !== null && extractedValue !== undefined) {
      extractedData[currentField] = extractedValue;
    }
  
    return extractedData;
  };
  
  module.exports = { extractInformationStrict };
  