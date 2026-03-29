const aiChatSystemMessage = {
    role: 'system',
    content: `You are a Home Affordability Budget Assistant...` // truncated for brevity
  };
  
  const fieldMapping = {
    location: 'location',
    household_income: 'household_income',
    other_income: 'other_income',
    credit_score_range: 'credit_score_range',
    down_payment: 'down_payment',
    monthly_debt_payments: 'monthly_debt_payments',
    max_housing_payment: 'max_housing_payment',
    loan_term_years: 'loan_term_years',
    property_tax_rate: 'property_tax_rate',
    insurance_cost: 'insurance_cost',
    hoa_fees: 'hoa_fees',
    expected_income_changes: 'expected_income_changes'
  };
  
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
  
  module.exports = {
    aiChatSystemMessage,
    fieldMapping,
    questionOrder
  };