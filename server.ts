import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import 'dotenv/config';

// Initialize Supabase safely (Read directly from server environment variables)
let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://xtugvvlfxljvkabcddxm.supabase.co';
if (!supabaseUrl.startsWith('http')) {
  supabaseUrl = 'https://' + supabaseUrl;
}
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dWd2dmxmeGxqdmthYmNkZHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY2MDMsImV4cCI6MjA4Nzk2MjYwM30.E6mfkZrSRwUbcTKCMDrg5izmDfn7Y1aD-Ij0cFOLuxU';

let supabase: any = null;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized on server.');
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Matchmaking State
  const queues: Record<number, any[]> = { 5: [], 6: [], 7: [], 8: [], 9: [] };
  const activeGames: Record<string, any> = {};

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ==========================================
    // DATABASE OPERATIONS (Frontend -> Backend)
    // ==========================================

    socket.on('get_leaderboard', async ({ grade }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('grade_level', grade)
        .order('score', { ascending: false })
        .limit(10);
      callback({ data, error });
    });

    socket.on('get_home_data', async ({ grade, username }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      
      const { data: lbData, error: lbError } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('grade_level', grade)
        .order('score', { ascending: false });

      const { data: vocabData, error: vocabError } = await supabase
        .from('vocabulary_master')
        .select('*')
        .eq('grade_level', grade)
        .limit(50);

      callback({ lbData, lbError, vocabData, vocabError });
    });

    socket.on('get_user_score', async ({ username, grade }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { data, error } = await supabase
        .from('leaderboards')
        .select('score')
        .eq('student_name', username)
        .eq('grade_level', grade)
        .single();
      callback({ data, error });
    });

    socket.on('update_score', async ({ username, grade, score }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      
      const { data: existing } = await supabase
        .from('leaderboards')
        .select('score')
        .eq('student_name', username)
        .eq('grade_level', grade)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('leaderboards')
          .update({ score })
          .eq('student_name', username)
          .eq('grade_level', grade);
        callback({ data, error });
      } else {
        const { data, error } = await supabase
          .from('leaderboards')
          .insert([{ student_name: username, grade_level: grade, score }]);
        callback({ data, error });
      }
    });

    socket.on('get_vocabulary', async ({ grade, unitId, weekId }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { data, error } = await supabase
        .from('vocabulary_master')
        .select('*')
        .eq('grade_level', grade)
        .eq('unit_no', unitId)
        .eq('week_no', weekId);
      callback({ data, error });
    });

    socket.on('delete_profile', async ({ username, grade }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { data, error } = await supabase
        .from('leaderboards')
        .delete()
        .eq('student_name', username)
        .eq('grade_level', grade);
      callback({ data, error });
    });

    // ==========================================
    // VERSUS MODE OPERATIONS
    // ==========================================

    socket.on('join_queue', async ({ name, grade }) => {
      console.log(`User ${name} (Grade ${grade}) joined queue.`);
      const safeGrade = Number(grade);
      if (!queues[safeGrade]) queues[safeGrade] = [];
      
      const player = { id: socket.id, name, grade: safeGrade, socket, score: 0, streak: 0 };
      queues[safeGrade].push(player);

      // Check if we have 2 players
      if (queues[safeGrade].length >= 2) {
        const p1 = queues[safeGrade].shift();
        const p2 = queues[safeGrade].shift();
        
        const roomId = `room_${p1.id}_${p2.id}`;
        p1.socket.join(roomId);
        p2.socket.join(roomId);

        // Fetch words for this grade
        const { data, error } = await supabase
          .from('vocabulary_master')
          .select('*')
          .eq('grade_level', safeGrade)
          .limit(50); // Fetch a pool of words

        let words = data || [];
        if (words.length < 10) {
          // fallback if not enough words
          words = Array(10).fill({ word_en: 'Test', word_tr: 'Test', synonym_en: 'Test', collocation_en: 'Test' });
        }

        // Shuffle and pick 10
        const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, 10);
        
        // Generate questions
        const questions = shuffled.map(w => {
          // Pick a random wrong answer from the pool
          const wrongWord = words[Math.floor(Math.random() * words.length)];
          const options = [w.word_tr, wrongWord.word_tr];
          // Shuffle options
          return {
            word_en: w.word_en,
            options: options.sort(() => Math.random() - 0.5),
            correct: w.word_tr
          };
        });

        activeGames[roomId] = {
          players: {
            [p1.id]: { name: p1.name, score: 0, streak: 0 },
            [p2.id]: { name: p2.name, score: 0, streak: 0 }
          },
          questions,
          currentQuestionIndex: 0,
          answersThisRound: {},
          roundTimeout: null,
          questionStartTime: 0
        };

        io.to(roomId).emit('match_found', {
          roomId,
          opponent: {
            [p1.id]: p2.name,
            [p2.id]: p1.name
          }
        });

        // Start first round after 3 seconds
        setTimeout(() => {
          sendNextQuestion(roomId);
        }, 3000);
      }
    });

    socket.on('send_emoji', ({ roomId, emoji }) => {
      socket.to(roomId).emit('receive_emoji', emoji);
    });

    socket.on('submit_answer', ({ roomId, answer }) => {
      const game = activeGames[roomId];
      if (!game) return;

      const currentQ = game.questions[game.currentQuestionIndex];
      if (!currentQ) return;
      
      const isGolden = game.currentQuestionIndex === 9;
      const isCorrect = answer === currentQ.correct;
      const timeTaken = Date.now() - game.questionStartTime;
      
      if (!game.answersThisRound[socket.id]) {
        socket.to(roomId).emit('opponent_answered');

        let points = 0;
        if (isCorrect) {
          game.players[socket.id].streak += 1;
          if (isGolden) {
            points = timeTaken <= 1500 ? 20 : 10;
          } else {
            points = timeTaken <= 3000 ? 10 : 5;
          }
        } else {
          game.players[socket.id].streak = 0;
          points = -5;
        }

        game.players[socket.id].score += points;
        game.answersThisRound[socket.id] = { answer, isCorrect, points, timeTaken };

        // Check if both answered
        const playerIds = Object.keys(game.players);
        if (playerIds.every(id => game.answersThisRound[id])) {
          // Both answered, clear timeout and end round
          if (game.roundTimeout) clearTimeout(game.roundTimeout);
          endRound(roomId);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Remove from queue
      for (const grade in queues) {
        queues[grade] = queues[grade].filter(p => p.id !== socket.id);
      }
      // Handle active games
      for (const roomId in activeGames) {
        if (activeGames[roomId].players[socket.id]) {
          io.to(roomId).emit('opponent_disconnected');
          delete activeGames[roomId];
        }
      }
    });

    function sendNextQuestion(roomId: string) {
      const game = activeGames[roomId];
      if (!game) return;

      if (game.currentQuestionIndex >= game.questions.length) {
        io.to(roomId).emit('game_over', { players: game.players });
        delete activeGames[roomId];
        return;
      }

      game.answersThisRound = {};
      const q = game.questions[game.currentQuestionIndex];
      const isGolden = game.currentQuestionIndex === 9;
      const timeLimit = isGolden ? 3 : 5;
      
      const emitQuestion = () => {
        const currentGame = activeGames[roomId];
        if (!currentGame) return;
        currentGame.questionStartTime = Date.now();
        io.to(roomId).emit('question', {
          word_en: q.word_en,
          options: q.options,
          questionNumber: currentGame.currentQuestionIndex + 1,
          totalQuestions: currentGame.questions.length,
          isGolden,
          timeLimit
        });

        currentGame.roundTimeout = setTimeout(() => {
          endRound(roomId);
        }, timeLimit * 1000);
      };

      if (isGolden) {
        io.to(roomId).emit('golden_warning');
        setTimeout(emitQuestion, 2000);
      } else {
        emitQuestion();
      }
    }

    function endRound(roomId: string) {
      const game = activeGames[roomId];
      if (!game) return;

      // Penalize players who didn't answer
      for (const playerId in game.players) {
        if (!game.answersThisRound[playerId]) {
          game.players[playerId].score -= 5;
          game.players[playerId].streak = 0;
          game.answersThisRound[playerId] = { answer: null, isCorrect: false, points: -5, timeTaken: 0 };
        }
      }

      const q = game.questions[game.currentQuestionIndex];
      
      io.to(roomId).emit('round_result', {
        correctAnswer: q.correct,
        players: game.players,
        answers: game.answersThisRound
      });

      game.currentQuestionIndex++;

      // Next question after 3 seconds
      setTimeout(() => {
        sendNextQuestion(roomId);
      }, 3000);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
