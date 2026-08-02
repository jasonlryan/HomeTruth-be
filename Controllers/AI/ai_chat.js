const OpenAI = require('openai');
const { ChatHistory, User, GuestChatSession } = require('../../models/index');
const { Op } = require('sequelize');
const env = require('../../config/env');
const VectorStore = require('../../services/vectorStore');
const UnifiedRetrievalService = require('../../services/unifiedRetrievalService');
const WebSearchService = require('../../services/webSearchService');

const openai = new OpenAI({ 
  apiKey:  env.ai.OpenAIKey
});

const systemMessage = {
  role: 'system',
  content: `You are HomeTruth, an expert AI assistant helping UK homebuyers make informed, risk-aware decisions in the UK property market.

Operating principles (RAG-first):
- Only rely on the provided Sources section. Treat it as authoritative HomeTruth context retrieved from labelled source classes. If key facts are missing, say so and request the needed info.
- Source classes may include uploaded user documents, property record context, HomeTruth guidance, and external/web sources. Keep those classes distinct in your reasoning.
- Use the provided sources to inform your answers but don't include citation numbers in your response.
- If no relevant sources are provided, state that you lack evidence and propose concrete next steps to find it.
- Never invent sources, links, figures, legal or financial guarantees.

Answer style and structure:
- Be friendly, concise, and actionable in plain English. Use contractions and UK-focused terms.
- Use clear headings and short paragraphs; prefer bullet points for lists.
- Where appropriate, include brief checklists, timelines, or comparison tables.
- Avoid hedging language; state certainty levels explicitly (Confident / Uncertain – why).

Required output format:
1. Short answer: 2–4 sentence direct answer based on the sources.
2. Key points: 3–7 bullets of practical, user-facing guidance.
3. Next steps: 2–5 concrete actions the user can take now.
4. Caveats: Note assumptions, regional variations, or when to seek professional advice.

Evidence handling:
- Prefer government, regulator, and well-known institutional sources. De-emphasize low-credibility material.
- When sources conflict, explain the discrepancy and recommend a cautious path.
- Quote short passages (<=1–2 lines) sparingly for precision.
- Use the information from sources naturally without citation numbers.

Scope constraints:
- Focus on first-time buyers, mortgages, conveyancing, surveys, property condition, fees, timelines, and regional UK nuances.
- Do not provide personalized legal, tax, or financial advice; offer general guidance and refer to qualified professionals when necessary.

Formatting rules:
- Use markdown. Bold key labels. Tables are allowed when useful. Keep code fences for data only.
- For numbers (fees, thresholds), include currency and date context when relevant.
- Currency and numbers: use £, thousand separators (e.g., £425,000), and en–dashes for ranges (e.g., £425,001–£625,000).
- Time sensitivity: for changing thresholds/policies, add "As of {Month YYYY}" if the source provides a date.

Failure mode policy:
- If sources are empty or irrelevant, say: "I don't have enough evidence to answer confidently." Then ask 1–3 clarifying questions and list next steps to obtain sources (e.g., which documents or URLs to provide).

Behavioral guardrails:
- Do not disclose internal system or retrieval details; just use the sources.
- Be respectful and reassuring; avoid fear-mongering.
- Do not include internal metadata (e.g., namespaces, categories, scores) in the user-facing output.

Tone of voice (HomeTruth):
- Friendly, on your side, practical. Use "you" and contractions ("you'll", "don't").
- Plain English, short sentences. Avoid legalese and corporate phrasing.
- Lead with what it means for the buyer; explain the "why" briefly.
- Be reassuring and calm; never alarmist. Offer help if the user seems unsure.
- Default to UK terms and examples; avoid US-isms unless asked.

Language style:
- Prefer: "make sure", "talk to", "check", "see if", "you'll", "let's"
- Avoid: "ensure", "consult", "review", "advise that", "therefore", "pursuant"
- Be specific with numbers and dates; tie them to user impact.
- Put caveats at the end; keep them short and concrete.

Response scaffold (apply unless user requests a different style):
1. Short answer (2–4 sentences, friendly, plain English).
2. What this means for you (3–5 bullets, user-facing outcomes).
3. Next steps (2–4 simple actions the user can take now).
4. Caveats (only if necessary; short and specific).

Tone helpers (use when rewriting formal content):
- If a sentence is formal, rewrite it in a warmer, shorter form without losing meaning.
- Replace officious verbs:
  - "ensure" → "make sure"
  - "consult" → "talk to"
  - "review" → "check"
  - "advise that" → "recommend"
- When uncertain, say so plainly and offer 1–2 smart next steps.

Empathy cues (sprinkle sparingly):
- "If you're unsure, I can help you check."
- "If you're close to a threshold, I can estimate it for your exact price."
- "If it helps, I can summarise this in a checklist."

Each conversation is limited to 5 follow-up questions, so make each response count.`
};

const chatController = {
  async handleChat(req, res) {
    try {
      const user_id = req.user?.id;
      const {
        userMessage,
        conversation_id,
        is_saved = false,
        search_web = false,
        propertyId,
        property_id
      } = req.body;
      const selectedPropertyId = propertyId || property_id || null;
  
      // Validate required fields
      if (!user_id || !userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'user_id and userMessage are required and userMessage must be a string'
        });
      }
  
      // Generate conversation ID for new conversations
      const currentConversationId = conversation_id || `conv_${Date.now()}_${user_id}`;
  
      // Parallelize initial database queries for better performance
      const [userExists, messageCountResult, previousChatsResult] = await Promise.all([
        User.findByPk(user_id),
        conversation_id ? ChatHistory.count({
          where: { 
            user_id: parseInt(user_id),
            conversation_id: conversation_id
          }
        }) : Promise.resolve(0),
        conversation_id ? ChatHistory.findAll({
          where: { 
            user_id: parseInt(user_id),
            conversation_id: conversation_id
          },
          order: [['createdAt', 'ASC']]
        }) : Promise.resolve([])
      ]);
  
      // Verify user exists
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      const messageCount = messageCountResult;
      const previousChats = previousChatsResult;
  
      // Check conversation message limit (5 follow-up questions = 6 total messages including initial)
      // if (conversation_id && messageCount >= 6) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'Conversation limit reached. You can ask up to 5 follow-up questions per conversation. Please start a new conversation.',
      //     conversationEnded: true
      //   });
      // }
  
      // Build conversation history for OpenAI
      const conversationHistory = previousChats.flatMap(chat => [
        { role: 'user', content: chat.userMessage },
        { role: 'assistant', content: chat.assistantReply }
      ]);
  
      // Check if user wants to save this conversation and validate saved conversation limit
      let savedConversationsCount = 0;
      let isConversationAlreadySaved = null;
      
      if (is_saved) {
        // Parallelize saved conversation checks
        [savedConversationsCount, isConversationAlreadySaved] = await Promise.all([
          ChatHistory.count({
            where: {
              user_id: parseInt(user_id),
              is_saved: true
            },
            distinct: true,
            col: 'conversation_id'
          }),
          ChatHistory.findOne({
            where: {
              user_id: parseInt(user_id),
              conversation_id: currentConversationId,
              is_saved: true
            }
          })
        ]);
  
        // If trying to save a new conversation and already at limit
        if (!isConversationAlreadySaved && savedConversationsCount >= 3) {
          return res.status(400).json({
            success: false,
            message: 'You can only save up to 3 different conversations. Please unsave an existing conversation first.',
            savedConversationsLimit: true
          });
        }
      }
  
      // Parallelize unified retrieval, web search, and saved count fetch (if needed) for better performance
      const parallelTasks = [
        UnifiedRetrievalService.assembleAssistantContext({
          query: userMessage,
          userId: user_id,
          propertyId: selectedPropertyId
        }).catch(err => {
          if (err.name === 'UnifiedRetrievalAccessError') {
            throw err;
          }
          console.error('Error assembling unified retrieval context:', err);
          return UnifiedRetrievalService.emptyContext(
            userMessage,
            {
              userId: parseInt(user_id),
              propertyId: selectedPropertyId || null,
              userDocumentScope: selectedPropertyId
                ? 'selected_property_documents'
                : 'all_current_user_documents'
            },
            [err.message]
          );
        }),
        search_web === true ? WebSearchService.searchWeb(userMessage, 5).catch(err => {
          console.error('Error performing web search:', err);
          return { sources: [], content: '', hasResults: false };
        }) : Promise.resolve({ sources: [], content: '', hasResults: false })
      ];
      
      // Add saved count fetch if we don't already have it (when is_saved is false)
      if (!is_saved) {
        parallelTasks.push(
          ChatHistory.count({
            where: {
              user_id: parseInt(user_id),
              is_saved: true
            },
            distinct: true,
            col: 'conversation_id'
          })
        );
      }
      
      const results = await Promise.all(parallelTasks);
      const retrievalContext = results[0];
      const webSearchResultsResult = results[1];
      
      // Update saved count if we fetched it
      if (!is_saved && results.length > 2) {
        savedConversationsCount = results[2];
      }
  
      let webSearchResults = webSearchResultsResult;

      // Build combined context with all sources (unified retrieval + optional web search)
      let relevantContext = retrievalContext.contextText || '';
      if (webSearchResults.hasResults && webSearchResults.content) {
        const webSources = (webSearchResults.sources || [])
          .map((source, index) => {
            const title = source.title || `Web source ${index + 1}`;
            return `${index + 1}. ${title}${source.url ? ` - ${source.url}` : ''}`;
          })
          .join('\n');
        const webContext = [
          '**External/web source context:**',
          webSearchResults.content,
          webSources ? `**External/web sources:**\n${webSources}` : null
        ].filter(Boolean).join('\n\n');

        relevantContext = relevantContext
          ? `${relevantContext}\n\n${webContext}`
          : webContext;
      }

      // Create messages array with system message, history, and current message
      // If we have relevant context, include it with the user message
      const userMessageWithContext = relevantContext 
        ? `${userMessage}\n\n${relevantContext}`
        : userMessage;

      const messages = [
        systemMessage,
        ...conversationHistory,
        { role: 'user', content: userMessageWithContext }
      ];

      // Generate AI response using OpenAI with RAG context
      let assistantReply;
      
      try {
        // Use OpenAI directly - faster and more reliable
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Faster than gpt-4, still excellent quality
          messages,
          temperature: 0.7,
          max_tokens: 1000
        });

        assistantReply = response.choices[0].message.content;
      } catch (openaiError) {
        console.error('❌ OpenAI error:', openaiError.message);
        throw openaiError;
      }
  
      // Save to DB with conversation ID and is_saved flag
      const savedChat = await ChatHistory.create({
        user_id: parseInt(user_id),
        conversation_id: currentConversationId,
        userMessage,
        assistantReply,
        is_saved: is_saved
      });
  
      // Calculate message counts without redundant queries (use data we already have)
      const totalMessages = messageCount + 1;
      const isConversationEnded = totalMessages >= 6;
      const remainingQuestions = Math.max(0, 6 - totalMessages);
  
      // Update saved conversations count if we just saved (increment by 1 if it's a new saved conversation)
      const currentSavedCount = is_saved && !isConversationAlreadySaved 
        ? savedConversationsCount + 1 
        : savedConversationsCount;
  
      // Build chat history array from existing data + new message (avoid redundant query)
      const chatHistoryArray = previousChats.map(chat => ({
        id: chat.id,
        userMessage: chat.userMessage,
        assistantReply: chat.assistantReply
      }));
      // Add the newly saved message
      chatHistoryArray.push({
        id: savedChat.id,
        userMessage: savedChat.userMessage,
        assistantReply: savedChat.assistantReply
      });
  
      return res.status(201).json({
        success: true,
        message: 'Chat processed successfully',
        data: {
          conversation_id: currentConversationId,
          remainingQuestions: remainingQuestions,
          conversationEnded: isConversationEnded,
          is_saved: is_saved,
          savedConversationsCount: currentSavedCount,
          maxSavedConversations: 3,
          chatHistory: chatHistoryArray, // All chat history as array
          savedChat: {
            id: savedChat.id,
            userMessage: savedChat.userMessage,
            assistantReply: savedChat.assistantReply,
            is_saved: savedChat.is_saved,
            createdAt: savedChat.createdAt
          },
          ragContext: {
            hasContext: relevantContext.length > 0,
            contextLength: relevantContext.length,
            sourceClasses: [
              ...(retrievalContext.sourceSummary.sourceClasses || []),
              ...(webSearchResults.hasResults ? ['external_web_source'] : [])
            ],
            counts: {
              uploadedUserDocuments: retrievalContext.sourceSummary.uploadedUserDocuments,
              propertyRecords: retrievalContext.sourceSummary.propertyRecords,
              homeTruthGuidance: retrievalContext.sourceSummary.homeTruthGuidance,
              webSources: webSearchResults.sources?.length || 0
            },
            scope: retrievalContext.scope,
            errors: retrievalContext.sourceSummary.errors
          },
          webSearch: {
            performed: search_web === true,
            hasResults: webSearchResults.hasResults,
            sourcesCount: webSearchResults.sources?.length || 0,
            error: webSearchResults.error || null
          }
        }
      });
  
    } catch (error) {
      console.error('Error processing chat message:', error);
      
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user reference',
          error: 'The specified user does not exist'
        });
      }

      if (error.name === 'UnifiedRetrievalAccessError') {
        return res.status(error.statusCode || 400).json({
          success: false,
          message: error.message
        });
      }
  
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // New method to save/unsave existing conversations
  async toggleConversationSaved(req, res) {
    try {
      const user_id = req.user?.id;
      // const { conversation_id } = req.params;
      const { is_saved,conversation_id } = req.body;
      
      

      if (!user_id || !conversation_id || typeof is_saved !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'user_id, conversation_id, and is_saved (boolean) are required'
        });
      }

      // Check if conversation exists for user
      const conversationExists = await ChatHistory.findOne({
        where: {
          user_id: parseInt(user_id),
          conversation_id: conversation_id
        }
      });

      if (!conversationExists) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // If trying to save, check the limit
      if (is_saved) {
        const savedConversationsCount = await ChatHistory.count({
          where: {
            user_id: parseInt(user_id),
            is_saved: true,
            conversation_id: { [Op.ne]: conversation_id } // Exclude current conversation
          },
          distinct: true,
          col: 'conversation_id'
        });

        if (savedConversationsCount >= 3) {
          return res.status(400).json({
            success: false,
            message: 'You can only save up to 3 different conversations. Please unsave an existing conversation first.',
            savedConversationsLimit: true
          });
        }
      }

      // Update all messages in the conversation
      const [updatedCount] = await ChatHistory.update(
        { is_saved: is_saved },
        {
          where: {
            user_id: parseInt(user_id),
            conversation_id: conversation_id
          }
        }
      );

      // Get updated saved conversations count
      const currentSavedCount = await ChatHistory.count({
        where: {
          user_id: parseInt(user_id),
          is_saved: true
        },
        distinct: true,
        col: 'conversation_id'
      });

      return res.status(200).json({
        success: true,
        message: `Conversation ${is_saved ? 'saved' : 'unsaved'} successfully`,
        data: {
          conversation_id: conversation_id,
          is_saved: is_saved,
          updatedMessages: updatedCount,
          savedConversationsCount: currentSavedCount,
          maxSavedConversations: 3
        }
      });

    } catch (error) {
      console.error('Error toggling conversation saved status:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // Updated getUserChatHistory to include saved status
  async getUserChatHistory(req, res) {
    try {
      const user_id = req.user?.id || req.query.user_id;
      const { conversation_id, page = 1, limit = 20, saved_only = false } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: 'user_id is required'
        });
      }

      const userExists = await User.findByPk(user_id);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const whereClause = { user_id: parseInt(user_id) };
      if (conversation_id) {
        whereClause.conversation_id = conversation_id;
      }
      if (saved_only === 'true') {
        whereClause.is_saved = true;
      }

      const offset = (page - 1) * limit;

      const { count, rows: chatHistory } = await ChatHistory.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Group by conversation for better organization
      const conversationGroups = {};
      chatHistory.forEach(chat => {
        const convId = chat.conversation_id || 'default';
        if (!conversationGroups[convId]) {
          conversationGroups[convId] = {
            conversation_id: convId,
            messages: [],
            messageCount: 0,
            isComplete: false,
            is_saved: chat.is_saved
          };
        }
        conversationGroups[convId].messages.push(chat);
        conversationGroups[convId].messageCount++;
        conversationGroups[convId].isComplete = conversationGroups[convId].messageCount >= 6;
      });

      return res.status(200).json({ 
        success: true,
        message: 'Chat history retrieved successfully',
        data: {
          conversations: conversationGroups,
          totalCount: count,
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          hasMore: offset + chatHistory.length < count
        }
      });

    } catch (error) {
      console.error('Error retrieving chat history:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // Alternative approach without sequelize.fn - using raw queries or multiple queries
  async getConversationList(req, res) {
    try {
      const user_id = req.user?.id;
      const { saved_only = false } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: 'user_id is required'
        });
      }

      const whereClause = { user_id: parseInt(user_id) };
      if (saved_only === 'true') {
        whereClause.is_saved = true;
      }

      // Get all messages for the user
      const allMessages = await ChatHistory.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      // Group and process conversations manually
      const conversationMap = new Map();
      
      allMessages.forEach(message => {
        const convId = message.conversation_id;
        
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, {
            conversation_id: convId,
            messages: [],
            is_saved: message.is_saved,
            lastMessageAt: message.createdAt,
            firstMessage: message.userMessage
          });
        }
        
        const conversation = conversationMap.get(convId);
        conversation.messages.push(message);
        
        // Update last message time if this message is newer
        if (message.createdAt > conversation.lastMessageAt) {
          conversation.lastMessageAt = message.createdAt;
        }
        
        // Keep the first message (oldest) as preview
        if (message.createdAt < new Date(conversation.firstMessage)) {
          conversation.firstMessage = message.userMessage;
        }
      });

      // Convert to array and add computed properties
      const conversationList = Array.from(conversationMap.values()).map(conv => ({
        conversation_id: conv.conversation_id,
        lastMessageAt: conv.lastMessageAt,
        messageCount: conv.messages.length,
        isComplete: conv.messages.length >= 6,
        remainingQuestions: Math.max(0, 6 - conv.messages.length),
        is_saved: conv.is_saved,
        preview: conv.firstMessage ? 
          conv.firstMessage.substring(0, 100) + '...' : 
          'No messages'
      }));

      // Sort by last message time (newest first)
      conversationList.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      // Get saved conversations count
      const savedConversationsCount = await ChatHistory.count({
        where: {
          user_id: parseInt(user_id),
          is_saved: true
        },
        distinct: true,
        col: 'conversation_id'
      });

      return res.status(200).json({
        success: true,
        message: 'Conversation list retrieved successfully',
        data: {
          conversations: conversationList,
          savedConversationsCount: savedConversationsCount,
          maxSavedConversations: 3
        }
      });

    } catch (error) {
      console.error('Error retrieving conversation list:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // Anonymous guest chat: 5 messages per session, persisted in GuestChatSession, RAG-enabled
  async handleAnonymousChat(req, res) {
    try {
      const { userMessage, sessionId } = req.body;

      if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'userMessage is required and must be a string'
        });
      }

      const currentSessionId = sessionId || `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      // Enforce 5 user messages per session from DB (source of truth)
      const existingCount = await GuestChatSession.count({
        where: { session_id: currentSessionId }
      });

      if (existingCount >= 5) {
        return res.status(400).json({
          success: false,
          message: 'To continue chatting with HomeTruth, please log in or register for unlimited chats.',
          conversationEnded: true,
          session_id: currentSessionId
        });
      }

      // Load previous messages for context
      const previousMessages = await GuestChatSession.findAll({
        where: { session_id: currentSessionId },
        order: [['createdAt', 'ASC']]
      });

      const conversationHistory = previousMessages.flatMap((row) => [
        { role: 'user', content: row.user_message },
        { role: 'assistant', content: row.assistant_reply }
      ]);

      // RAG: search for relevant context (same as authenticated chat)
      let relevantContext = '';
      let documentChunks = [];
      const similarChunks = await VectorStore.searchSimilarChunks(userMessage, 5, 0.7).catch(() => []);
      if (similarChunks.length > 0) {
        documentChunks = similarChunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`);
        relevantContext = documentChunks.join('\n\n');
        if (relevantContext) {
          relevantContext += '\n\n**Sources:**\n' + similarChunks.map((c, i) => `[${i + 1}] ${c.metadata?.filename || 'Document'}`).join('\n');
        }
      }

      const userMessageWithContext = relevantContext
        ? `${userMessage}\n\n${relevantContext}`
        : userMessage;

      const messages = [
        systemMessage,
        ...conversationHistory,
        { role: 'user', content: userMessageWithContext }
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const assistantReply = response.choices[0].message.content;

      // Persist to GuestChatSession
      await GuestChatSession.create({
        session_id: currentSessionId,
        user_message: userMessage,
        assistant_reply: assistantReply
      });

      const newMessageCount = existingCount + 1;
      const remainingQuestions = Math.max(0, 5 - newMessageCount);

      return res.status(200).json({
        success: true,
        message: 'Chat processed successfully',
        data: {
          reply: assistantReply,
          session_id: currentSessionId,
          messageCount: newMessageCount,
          remainingQuestions: remainingQuestions,
          conversationEnded: newMessageCount >= 5
        }
      });

    } catch (error) {
      console.error('Error processing anonymous chat message:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  // Claim guest session after login: copy GuestChatSession -> ChatHistory for authenticated user
  async claimGuestSession(req, res) {
    try {
      const user_id = req.user?.id;
      const { guest_session_id } = req.body;

      if (!user_id || !guest_session_id || typeof guest_session_id !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'guest_session_id is required and user must be authenticated'
        });
      }

      const guestRows = await GuestChatSession.findAll({
        where: { session_id: guest_session_id },
        order: [['createdAt', 'ASC']]
      });

      if (!guestRows.length) {
        return res.status(404).json({
          success: false,
          message: 'Guest session not found or already claimed'
        });
      }

      // Idempotent: if user already has this conversation_id, return it
      const existing = await ChatHistory.findOne({
        where: {
          user_id: parseInt(user_id),
          conversation_id: guest_session_id
        }
      });
      if (existing) {
        const messageCount = await ChatHistory.count({
          where: {
            user_id: parseInt(user_id),
            conversation_id: guest_session_id
          }
        });
        return res.status(200).json({
          success: true,
          data: {
            conversation_id: guest_session_id,
            messageCount
          }
        });
      }

      for (const row of guestRows) {
        await ChatHistory.create({
          user_id: parseInt(user_id),
          conversation_id: guest_session_id,
          userMessage: row.user_message,
          assistantReply: row.assistant_reply,
          is_saved: false
        });
      }

      await GuestChatSession.destroy({
        where: { session_id: guest_session_id }
      });

      return res.status(200).json({
        success: true,
        data: {
          conversation_id: guest_session_id,
          messageCount: guestRows.length
        }
      });

    } catch (error) {
      console.error('Error claiming guest session:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  async deleteConversation(req, res) {
    try {
      const user_id = req.user?.id;
      const { conversationId } = req.params;

      if (!user_id || !conversationId) {
        return res.status(400).json({
          success: false,
          message: 'user_id and conversationId are required'
        });
      }

      const deletedCount = await ChatHistory.destroy({
        where: { 
          user_id: parseInt(user_id),
          conversation_id: conversationId
        }
      });

      if (deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Conversation deleted successfully',
        data: { deletedMessages: deletedCount }
      });

    } catch (error) {
      console.error('Error deleting conversation:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  },

  async getConversationStatus(req, res) {
    try {
      const user_id = req.user?.id;
      const { conversationId } = req.params;

      if (!user_id || !conversationId) {
        return res.status(400).json({
          success: false,
          message: 'user_id and conversationId are required'
        });
      }

      const conversationData = await ChatHistory.findOne({
        where: { 
          user_id: parseInt(user_id),
          conversation_id: conversationId
        },
        attributes: ['is_saved']
      });

      if (!conversationData) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const messageCount = await ChatHistory.count({
        where: { 
          user_id: parseInt(user_id),
          conversation_id: conversationId
        }
      });

      const remainingQuestions = Math.max(0, 6 - messageCount);
      const isComplete = messageCount >= 6;

      return res.status(200).json({
        success: true,
        data: {
          conversation_id: conversationId,
          messageCount,
          remainingQuestions,
          isComplete,
          is_saved: conversationData.is_saved,
          maxMessages: 6
        }
      });

    } catch (error) {
      console.error('Error getting conversation status:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
};

module.exports = chatController;
