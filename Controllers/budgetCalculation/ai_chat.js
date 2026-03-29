const OpenAI = require('openai');
const env = require('../../config/env');


const openai = new OpenAI({ 
  apiKey: env.ai.OpenAIKey
});


// Updated system message for Home Affordability Budget Assistant with comprehensive questions
const homeAffordabilitySystemMessage = {
  role: 'system',
  content: `You are a Home Affordability Budget Assistant.
Your task is to chat with the user to collect the necessary information to estimate how much home they can afford to purchase. You should ask one clear question at a time. Be conversational, polite, and concise.

Your goal is to gather the following information:
- Location (city/state)
- Household annual gross income
- Other sources of regular income (if any)
- Estimated credit score or credit range
- Total amount available for down payment
- Total monthly debt payments (loans, credit cards, etc.)
- Desired maximum monthly payment for housing (optional)
- Preferred loan term (e.g., 30-year, 20-year)
- Estimated property tax rate (or use typical local averages if not provided)
- Estimated homeowner's insurance cost
- HOA fees (if applicable)
- Any major expected changes in income or expenses

After collecting this data, you will calculate a recommended maximum home price using conservative lending assumptions (e.g., 28% front-end DTI, 36% back-end DTI).

Do not make up any values. If the user does not know something, note it and proceed.

When you have enough information, present a clear and simple result that includes:
- Estimated maximum home price
- Estimated monthly payment (including taxes, insurance, HOA)
- A brief explanation of your estimate

Stay within your role at all times. Do not give legal, financial, or tax advice. This is only an informal estimate.
Always wait for the user's response before continuing.

Start by greeting the user and asking for their location.`
};

// System message for generating estimates with incomplete information
const estimateSystemMessage = {
  role: 'system',
  content: `You are a Home Affordability Budget Assistant specializing in generating estimates.

When asked to provide an estimate, you should:
1. Analyze the information provided in the conversation
2. Calculate an estimated monthly payment range using conservative assumptions
3. If information is missing, use reasonable defaults for the user's region
4. Always provide a range (minimum to maximum monthly payment)
5. Include a disclaimer about incomplete information if applicable

Consider these key factors in your analysis:
- Location (city/state)
- Household annual gross income
- Other sources of regular income (if any)
- Estimated credit score or credit range
- Total amount available for down payment
- Total monthly debt payments (loans, credit cards, etc.)
- Desired maximum monthly payment for housing (optional)
- Preferred loan term (e.g., 30-year, 20-year)
- Estimated property tax rate (or use typical local averages if not provided)
- Estimated homeowner's insurance cost
- HOA fees (if applicable)
- Any major expected changes in income or expenses

Format your response as JSON with the following structure:
{
  "hasCompleteInfo": true/false,
  "estimatedRange": {
    "min": number,
    "max": number,
    "currency": "£" or "$"
  },
  "breakdown": {
    "mortgagePayment": number,
    "propertyTax": number,
    "insurance": number,
    "hoa": number
  },
  "riskLevel": "good" or "bad",
  "explanation": "Brief explanation of the estimate and assumptions made"
}

Risk level should be "good" if the payments are within safe DTI ratios (under 28% of gross income), "bad" if they exceed safe ratios or if too much information is missing.`
};

const chatController = {

  // Method to start a new home affordability chat session
  async startHomeAffordabilityChat(req, res) {
    try {
      // Initialize conversation with system message and get the assistant's first response
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [homeAffordabilitySystemMessage]
      });

      const assistantReply = response.choices[0].message.content;

      return res.status(200).json({
        success: true,
        message: 'Home affordability chat session started',
        data: {
          reply: assistantReply,
          conversationId: Date.now(), // Simple conversation ID for tracking
          messageHistory: [
            homeAffordabilitySystemMessage,
            { role: 'assistant', content: assistantReply }
          ]
        }
      });

    } catch (error) {
      console.error('Error starting home affordability chat:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // Method to generate estimate based on collected information
  async generateEstimate(req, res) {
    try {
      const { messageHistory } = req.body;

      if (!messageHistory || !Array.isArray(messageHistory)) {
        return res.status(400).json({
          success: false,
          message: 'messageHistory is required and must be an array'
        });
      }

      // Create a comprehensive summary of the conversation for analysis
      const conversationSummary = messageHistory
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join('\n');

      const estimatePrompt = `Based on the following conversation, generate a comprehensive home affordability estimate:

Conversation:
${conversationSummary}

Please analyze ALL the information provided including:
- Location details for property tax and insurance estimates
- Complete income picture (household + other sources)
- Credit score impact on interest rates
- Down payment amount and loan-to-value ratio
- Existing debt obligations
- Loan term preferences
- Regional cost factors (property tax, insurance, HOA)
- Any anticipated income/expense changes

Generate an estimated monthly payment range using conservative lending standards. If critical information is missing, use reasonable regional defaults and clearly note the limitations in your explanation.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          estimateSystemMessage,
          { role: 'user', content: estimatePrompt }
        ]
      });

      let assistantReply = response.choices[0].message.content;
      
      // Try to parse JSON response
      let estimateData;
      try {
        // Remove any markdown formatting
        assistantReply = assistantReply.replace(/```json\n?|\n?```/g, '');
        estimateData = JSON.parse(assistantReply);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        estimateData = {
          hasCompleteInfo: false,
          estimatedRange: {
            min: 800,
            max: 1500,
            currency: "$"
          },
          breakdown: {
            mortgagePayment: 1000,
            propertyTax: 200,
            insurance: 150,
            hoa: 0
          },
          riskLevel: "bad",
          explanation: "Unable to generate accurate estimate due to insufficient information. Please provide more details about your income, credit score, down payment, and location for a more precise calculation."
        };
      }

      // Generate appropriate message based on completeness
      let responseMessage;
      if (estimateData.hasCompleteInfo) {
        responseMessage = "Here is your comprehensive monthly housing budget estimate:";
      } else {
        responseMessage = "Based on the information provided, here is your estimated monthly housing budget range. Note that some details were missing, so defaults were used:";
      }

      return res.status(200).json({
        success: true,
        message: 'Estimate generated successfully',
        data: {
          responseMessage,
          estimate: estimateData,
          displayRange: `${estimateData.estimatedRange.currency}${estimateData.estimatedRange.min} - ${estimateData.estimatedRange.currency}${estimateData.estimatedRange.max}/month`,
          riskLevel: estimateData.riskLevel,
          hasCompleteInfo: estimateData.hasCompleteInfo,
          missingInfo: estimateData.hasCompleteInfo ? [] : [
            "Some key information may be missing for a complete assessment",
            "Consider providing more details for a more accurate estimate"
          ]
        }
      });

    } catch (error) {
      console.error('Error generating estimate:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  async continueHomeAffordabilityChat(req, res) {
    try {
      const { userMessage, messageHistory } = req.body;

      // Validate required fields
      if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'userMessage is required and must be a string'
        });
      }

      if (!messageHistory || !Array.isArray(messageHistory)) {
        return res.status(400).json({
          success: false,
          message: 'messageHistory is required and must be an array'
        });
      }

      // Add user message to conversation history
      const updatedHistory = [
        ...messageHistory,
        { role: 'user', content: userMessage }
      ];

      // Generate AI response
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: updatedHistory
      });

      const assistantReply = response.choices[0].message.content;

      // Add assistant reply to history
      const finalHistory = [
        ...updatedHistory,
        { role: 'assistant', content: assistantReply }
      ];

      return res.status(200).json({
        success: true,
        message: 'Chat message processed successfully',
        data: {
          reply: assistantReply,
          messageHistory: finalHistory
        }
      });

    } catch (error) {
      console.error('Error processing home affordability chat message:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // Optional: Method to get information checklist
  async getInformationChecklist(req, res) {
    try {
      const checklist = [
        { id: 'location', label: 'Location (city/state)', required: true },
        { id: 'income', label: 'Household annual gross income', required: true },
        { id: 'otherIncome', label: 'Other sources of regular income', required: false },
        { id: 'creditScore', label: 'Estimated credit score or credit range', required: true },
        { id: 'downPayment', label: 'Total amount available for down payment', required: true },
        { id: 'monthlyDebt', label: 'Total monthly debt payments', required: true },
        { id: 'desiredPayment', label: 'Desired maximum monthly payment for housing', required: false },
        { id: 'loanTerm', label: 'Preferred loan term (e.g., 30-year, 20-year)', required: false },
        { id: 'propertyTax', label: 'Estimated property tax rate', required: false },
        { id: 'insurance', label: 'Estimated homeowner\'s insurance cost', required: false },
        { id: 'hoa', label: 'HOA fees (if applicable)', required: false },
        { id: 'incomeChanges', label: 'Any major expected changes in income or expenses', required: false }
      ];

      return res.status(200).json({
        success: true,
        message: 'Information checklist retrieved successfully',
        data: {
          checklist,
          requiredCount: checklist.filter(item => item.required).length,
          totalCount: checklist.length
        }
      });

    } catch (error) {
      console.error('Error retrieving checklist:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
};

module.exports = chatController;