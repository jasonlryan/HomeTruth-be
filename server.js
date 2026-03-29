const express = require('express')
const app = express();
const bodyParser = require('body-parser')
const env = require('./config/env');
const cors = require("cors");
require('colors');
require('./Cron/clearOldHistory');
const path = require('path');
app.use('/temp-images', express.static(path.join(__dirname, 'temp-images')));
app.use('/uploads/articles', express.static(path.join(__dirname, 'uploads/articles')));
const fs = require("fs");
const https = require("https");
const http = require("http");
const colors = require("colors");

// Initialize RAG system
const { initializeQdrant, initializeUserDocumentsCollection, checkQdrantConnection } = require('./config/qdrant');



app.use(
  cors({
  
    origin: ["http://localhost:3000","http://localhost:8007","https://b8299deae6d9.ngrok-free.app","https://hometruth.ohtplayground.com", "http://3.141.227.135:8007","https://hometruth.io"],


  credentials: true,
  })
);

app.use(express.json());








// app.use(bodyParser.urlencoded({extended:true}))
// app.use(bodyParser.json())
const UserAuthRoute = require("./routes/userRoute/auth");
const QuizQuestioRoute = require("./routes/quiz/quizQuestionRoute");
const QuizOptionRoute = require("./routes/quiz/quizeOptionRoute");
const QuizAnswerRoute = require("./routes/quiz/quizeAnswerRoute");
const SavedNoteRoute = require("./routes/savedNote");
const budgetRoute = require("./routes/budgetCalculation");
const profilePreferencesRoute = require("./routes/setting/profilePreferences");
const ai_chat = require("./routes/AI/ai_chat");
const notification = require("./routes/setting/NotificationSettings");
const privacySettings = require("./routes/setting/privacySettings");
const documentRoutes = require("./routes/documentRoutes");
const userDocumentRoutes = require("./routes/userDocumentRoutes");
const waitlistRoute = require("./routes/waitlistRoute");
// const zoopla = require("./routes/zoppla/zoopla");
const propertyRoutes = require('./routes/zoppla/properties');
const adminDashboardRoutes = require('./routes/admin/adminDashboardRoutes');
const adminDataRoutes = require('./routes/admin/adminDataRoutes');
const adminArticleRoutes = require('./routes/admin/adminArticleRoutes');
const articleRoutes = require('./routes/articleRoutes');






app.use("/api/auth", UserAuthRoute);
app.use("/api/quiz", QuizQuestioRoute);
app.use("/api/quiz-options", QuizOptionRoute);
app.use("/api/quiz-answers", QuizAnswerRoute);
app.use("/api/saved-notes", SavedNoteRoute);
app.use("/api/budget-calculation", budgetRoute);
app.use("/api/profile-preferences", profilePreferencesRoute);
app.use("/api/ai_chat", ai_chat);
app.use("/api/notification-settings", notification);
app.use("/api/privacy-settings", privacySettings);
app.use("/api/documents", documentRoutes);
app.use("/api/user-documents", userDocumentRoutes);
app.use("/api/waitlist", waitlistRoute);
app.use('/api/properties', propertyRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminDataRoutes);
app.use('/api/admin/articles', adminArticleRoutes);
app.use('/api/articles', articleRoutes);

// app.use("/api/zoopla", zoopla);











app.get('/',(req,res)=>{
    res.send('hello awsomes production!')
}  )





// app.listen(port, () =>
//     console.log(`Server running on port ${port}`.bgYellow.bold)
//   );


// Initialize RAG system on startup
async function initializeRAGSystem() {
  try {
    console.log('🚀 Initializing RAG system...');
    
    // Check Qdrant connection
    const qdrantConnected = await checkQdrantConnection();
    if (qdrantConnected) {
      await initializeQdrant();
      await initializeUserDocumentsCollection();
      console.log('✅ Qdrant vector database ready');
    } else {
      console.log('⚠️  Qdrant not available, RAG features will be limited');
    }
    
    // OpenAI is used for embeddings and LLM - no Ollama needed
    console.log('✅ Using OpenAI for embeddings and LLM generation');
    console.log('✅ RAG system initialization complete');
  } catch (error) {
    console.error('❌ RAG system initialization failed:', error);
  }
}

const port = env.port || 8005;
const useSSL = env.ssl.enabled;

let server;

if (useSSL) {
  const sslCertPath = env.ssl.certPath;
  const sslKeyPath = env.ssl.keyPath;

  if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
    const options = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath),
    };
    server = https.createServer(options, app);
    server.listen(port, async () => {
      console.log(`Secure server running on https://localhost:${port}`.green);
      await initializeRAGSystem();
    });
  } else {
    console.error("SSL certificate or key not found!".red);
    process.exit(1);
  }
} else {
  server = http.createServer(app);
  server.listen(port, async () => {
    console.log(colors.bgGreen(`Server running on http://localhost:${port}`));
    await initializeRAGSystem();
  });
}

