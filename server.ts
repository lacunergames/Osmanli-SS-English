import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import 'dotenv/config';

// Initialize Supabase safely (Read directly from server environment variables)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Use the powerful Service Role Key for backend operations to bypass RLS, fallback to anon key for preview
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL ERROR: Supabase URL or Key is missing from environment variables!');
  console.error('Please check your Hugging Face Secrets and ensure SUPABASE_SERVICE_ROLE_KEY is set.');
} else {
  let formattedUrl = supabaseUrl;
  if (!formattedUrl.startsWith('http')) {
    formattedUrl = 'https://' + formattedUrl;
  }
  
  try {
    supabase = createClient(formattedUrl, supabaseKey);
    console.log(`Supabase client initialized successfully with URL: ${formattedUrl.substring(0, 15)}...`);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('SUCCESS: Using SERVICE ROLE KEY. RLS policies will be bypassed.');
    } else {
      console.warn('WARNING: Using ANON KEY instead of SERVICE ROLE KEY. RLS policies might block operations. Please set SUPABASE_SERVICE_ROLE_KEY in Hugging Face Secrets.');
    }
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
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

  async function getLeagueSettings() {
    if (!supabase) return { period: 1, startTime: Date.now() };
    
    const { data, error } = await supabase
      .from('leaderboards')
      .select('league_period, last_activity_date')
      .eq('student_name', '__SYSTEM__')
      .eq('grade_level', '0')
      .single();

    const PERIOD_DURATION = 20 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (data) {
      let period = data.league_period || 1;
      let startTime = parseInt(data.last_activity_date || '0', 10);
      
      if (now - startTime >= PERIOD_DURATION) {
        period += 1;
        startTime = now;
        await supabase
          .from('leaderboards')
          .update({ league_period: period, last_activity_date: startTime.toString() })
          .eq('student_name', '__SYSTEM__')
          .eq('grade_level', '0');
      }
      return { period, startTime };
    } else {
      await supabase
        .from('leaderboards')
        .insert([{ 
          student_name: '__SYSTEM__', 
          grade_level: '0', 
          score: 0, 
          last_activity_date: now.toString(),
          league_period: 1 
        }]);
      return { period: 1, startTime: now };
    }
  }

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ==========================================
    // DATABASE OPERATIONS (Frontend -> Backend)
    // ==========================================

    socket.on('get_leaderboard', async ({ grade }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { period } = await getLeagueSettings();
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('grade_level', grade)
        .eq('league_period', period)
        .order('score', { ascending: false })
        .limit(10);
      callback({ data, error });
    });

    socket.on('get_home_data', async ({ grade, username }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      
      const { period, startTime } = await getLeagueSettings();
      const { data: lbData, error: lbError } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('grade_level', grade)
        .eq('league_period', period)
        .order('score', { ascending: false });

      const { data: vocabData, error: vocabError } = await supabase
        .from('vocabulary_master')
        .select('*')
        .eq('grade_level', grade)
        .limit(50);

      callback({ lbData, lbError, vocabData, vocabError, leagueStartTime: startTime, currentPeriod: period });
    });

    socket.on('get_user_score', async ({ username, grade }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { data, error } = await supabase
        .from('leaderboards')
        .select('score, streak, last_activity_date, league_period')
        .eq('student_name', username)
        .eq('grade_level', grade)
        .single();
        
      if (data) {
        const { period } = await getLeagueSettings();
        if (data.league_period !== period) {
          data.score = 0;
        }
      }
      callback({ data, error });
    });

    socket.on('update_score', async ({ username, grade, score, streak, last_activity_date }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      
      const { period } = await getLeagueSettings();

      const { data: existing } = await supabase
        .from('leaderboards')
        .select('score')
        .eq('student_name', username)
        .eq('grade_level', grade)
        .single();

      const updateData: any = { score, league_period: period };
      if (streak !== undefined) updateData.streak = streak;
      if (last_activity_date !== undefined) updateData.last_activity_date = last_activity_date;

      if (existing) {
        const { data, error } = await supabase
          .from('leaderboards')
          .update(updateData)
          .eq('student_name', username)
          .eq('grade_level', grade);
        callback({ data, error });
      } else {
        const { data, error } = await supabase
          .from('leaderboards')
          .insert([{ student_name: username, grade_level: grade, ...updateData }]);
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

    socket.on('admin_reset_league', async (callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const { period } = await getLeagueSettings();
      const newPeriod = period + 1;
      const newStartTime = Date.now();
      
      const { error } = await supabase
        .from('leaderboards')
        .update({ league_period: newPeriod, last_activity_date: newStartTime.toString() })
        .eq('student_name', '__SYSTEM__')
        .eq('grade_level', '0');
        
      if (error) {
        return callback({ error });
      }
      
      io.emit('league_reset', { startTime: newStartTime, period: newPeriod });
      callback({ success: true, startTime: newStartTime });
    });

    socket.on('get_previous_winner', async ({ grade, period }, callback) => {
      if (!supabase) return callback({ error: 'Database not initialized' });
      const targetPeriod = period - 1;
      if (targetPeriod < 1) return callback({ data: null });
      
      const { data, error } = await supabase
        .from('leaderboards')
        .select('student_name, score')
        .eq('grade_level', grade)
        .eq('league_period', targetPeriod)
        .order('score', { ascending: false })
        .limit(1)
        .single();
        
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
