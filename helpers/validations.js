const validateLocation = (location) => {
    if (!location || typeof location !== 'string') return false;
    const trimmed = location.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  };
  
  const validateIncome = (income) => {
    const num = parseFloat(income);
    return !isNaN(num) && num >= 0 && num <= 10000000;
  };
  
  const validateCreditScore = (score) => {
    const num = parseInt(score);
    return !isNaN(num) && num >= 300 && num <= 850;
  };
  
  const validateDownPayment = (amount) => {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0 && num <= 2000000;
  };
  
  const validateMonthlyPayment = (amount) => {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0 && num <= 50000;
  };
  
  const validateLoanTerm = (years) => {
    const num = parseInt(years);
    return !isNaN(num) && num >= 5 && num <= 50;
  };
  
  const validatePercentage = (rate) => {
    const num = parseFloat(rate);
    return !isNaN(num) && num >= 0 && num <= 100;
  };
  
  module.exports = {
    validateLocation,
    validateIncome,
    validateCreditScore,
    validateDownPayment,
    validateMonthlyPayment,
    validateLoanTerm,
    validatePercentage
  };