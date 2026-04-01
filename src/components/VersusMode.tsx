import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Swords, Loader2, Trophy, XCircle, Flame, Timer, Sparkles } from 'lucide-react';

interface VersusModeProps {
  username: string;
  grade: number;
  onBack: () => void;
  onWin?: (score: number) => void;
}

export default function VersusMode({ username, grade, onBack, onWin }: VersusModeProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'game_over'>('lobby');
  const [opponentName, setOpponentName] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [scores, setScores] = useState<{ me: number, opponent: number }>({ me: 0, opponent: 0 });
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<any>(null);
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [myStreak, setMyStreak] = useState(0);
  const [showGoldenWarning, setShowGoldenWarning] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{id: number, emoji: string, isMine: boolean}[]>([]);

  useEffect(() => {
    if (currentQuestion && !roundResult && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [currentQuestion, roundResult, timeLeft]);

  useEffect(() => {
    // Connect to Socket.io server
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_queue', { name: username, grade });
    });

    newSocket.on('match_found', (data) => {
      setRoomId(data.roomId);
      setOpponentName(data.opponent[newSocket.id]);
      setGameState('playing');
    });

    newSocket.on('question', (data) => {
      setShowGoldenWarning(false);
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setRoundResult(null);
      setOpponentAnswered(false);
      setTimeLeft(data.timeLimit);
    });

    newSocket.on('golden_warning', () => {
      setShowGoldenWarning(true);
    });

    newSocket.on('opponent_answered', () => {
      setOpponentAnswered(true);
    });

    newSocket.on('receive_emoji', (emoji) => {
      addFloatingEmoji(emoji, false);
    });

    newSocket.on('round_result', (data) => {
      setRoundResult(data);
      setScores({
        me: data.players[newSocket.id].score,
        opponent: Object.entries(data.players).find(([id]) => id !== newSocket.id)?.[1]?.score || 0
      });
      setMyStreak(data.players[newSocket.id].streak || 0);
    });

    newSocket.on('game_over', (data) => {
      setGameState('game_over');
      const myScore = data.players[newSocket.id].score;
      const oppScore = Object.entries(data.players).find(([id]) => id !== newSocket.id)?.[1]?.score || 0;
      setScores({
        me: myScore,
        opponent: oppScore
      });
      if (myScore > oppScore && onWin) {
        onWin(myScore);
      }
    });

    newSocket.on('opponent_disconnected', () => {
      alert('Rakip oyundan ayrıldı!');
      onBack();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [username, grade, onBack]);

  const handleAnswer = (answer: string) => {
    if (selectedAnswer || roundResult) return;
    setSelectedAnswer(answer);
    socket?.emit('submit_answer', { roomId, answer });
  };

  const sendEmoji = (emoji: string) => {
    socket?.emit('send_emoji', { roomId, emoji });
    addFloatingEmoji(emoji, true);
  };

  const addFloatingEmoji = (emoji: string, isMine: boolean) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis(prev => [...prev, { id, emoji, isMine }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  };

  if (gameState === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600 mb-6" size={64} />
        <h2 className="text-3xl font-black text-emerald-900 mb-2">Eşleşme Bekleniyor...</h2>
        <p className="text-emerald-600 font-bold">Seninle aynı sınıftan bir rakip aranıyor (Sınıf {grade})</p>
        <button onClick={onBack} className="mt-8 px-6 py-3 bg-white border-2 border-emerald-200 text-emerald-600 font-bold rounded-2xl hover:bg-emerald-50">
          İptal Et
        </button>
      </div>
    );
  }

  if (gameState === 'game_over') {
    const isWinner = scores.me > scores.opponent;
    const isDraw = scores.me === scores.opponent;
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto bg-white p-10 rounded-[40px] shadow-2xl text-center border-4 border-emerald-50">
        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 ${isWinner ? 'bg-yellow-100 text-yellow-500' : isDraw ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-500'}`}>
          {isWinner ? <Trophy size={48} /> : isDraw ? <Swords size={48} /> : <XCircle size={48} />}
        </div>
        <h2 className="text-4xl font-black mb-2">{isWinner ? 'Kazandın!' : isDraw ? 'Berabere!' : 'Kaybettin!'}</h2>
        <div className="flex justify-center gap-8 my-8">
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase">Sen</p>
            <p className="text-3xl font-black text-emerald-600">{scores.me}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase">{opponentName}</p>
            <p className="text-3xl font-black text-orange-500">{scores.opponent}</p>
          </div>
        </div>
        <button onClick={onBack} className="w-full h-16 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700">
          Ana Menüye Dön
        </button>
      </motion.div>
    );
  }

  if (showGoldenWarning) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse text-center">
        <Sparkles className="text-yellow-500 mb-6" size={80} />
        <h2 className="text-5xl font-black text-yellow-600 mb-4">ALTIN SORU!</h2>
        <p className="text-2xl font-bold text-yellow-700">Süre: 3 Saniye</p>
        <p className="text-xl font-bold text-yellow-600/80">Puanlar İki Katı!</p>
      </div>
    );
  }

  const scoreDiff = scores.me - scores.opponent;
  let myPercentage = 50 + (scoreDiff / 100) * 50;
  myPercentage = Math.max(5, Math.min(95, myPercentage));

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      {/* On Fire Effect */}
      {myStreak >= 5 && (
        <div className="pointer-events-none fixed inset-0 border-[16px] border-orange-500/50 shadow-[inset_0_0_50px_rgba(249,115,22,0.5)] z-50 animate-pulse flex items-start justify-center pt-4">
          <span className="bg-orange-500 text-white font-black px-6 py-2 rounded-full animate-bounce flex items-center gap-2">
            <Flame /> ALEV ALDIN! ({myStreak} SERİ) <Flame />
          </span>
        </div>
      )}

      {/* Floating Emojis */}
      <AnimatePresence>
        {floatingEmojis.map(e => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, scale: 0.5, y: 0, x: e.isMine ? -20 : 20 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.8], y: -150 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className={`fixed text-3xl md:text-5xl z-50 pointer-events-none drop-shadow-xl ${e.isMine ? 'left-8 md:left-16' : 'right-8 md:right-16'} bottom-32`}
          >
            {e.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Tug of War Bar */}
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex mb-4 shadow-inner">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${myPercentage}%` }} />
        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${100 - myPercentage}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center font-black text-emerald-600 text-xl">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Sen</p>
            <p className="font-black text-emerald-900">{scores.me} Puan</p>
          </div>
        </div>
        <div className="text-center">
          <Swords className="text-orange-500 mx-auto mb-1" size={24} />
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Versus</p>
        </div>
        <div className="flex items-center gap-4 text-right relative">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">{opponentName}</p>
            <p className="font-black text-orange-600">{scores.opponent} Puan</p>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center font-black text-orange-600 text-xl">
            {opponentName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-white p-8 rounded-[40px] shadow-xl border-4 border-emerald-50 text-center min-h-[400px] flex flex-col justify-center relative overflow-hidden">
        {opponentAnswered && !roundResult && (
          <motion.div 
            initial={{ scale: 0, opacity: 0, y: -50 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            className="absolute top-6 right-1/2 translate-x-1/2 md:translate-x-0 md:right-6 bg-red-600 text-white text-xl md:text-2xl font-black px-6 py-3 rounded-2xl shadow-2xl ring-4 ring-red-500/50 animate-bounce whitespace-nowrap z-50 flex items-center gap-2"
          >
            <Flame className="animate-pulse" /> RAKİP CEVAPLADI!
          </motion.div>
        )}
        {currentQuestion ? (
          <motion.div key={currentQuestion.questionNumber} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-center gap-2 text-3xl font-black mb-2">
              <Timer className={timeLeft <= 2 ? "text-red-500 animate-pulse" : "text-emerald-600"} size={32} />
              <span className={timeLeft <= 2 ? "text-red-500" : "text-emerald-600"}>{timeLeft.toFixed(1)}s</span>
            </div>
            <p className="text-sm font-bold text-emerald-600/60 uppercase tracking-widest mb-6">
              Soru {currentQuestion.questionNumber} / {currentQuestion.totalQuestions}
              {currentQuestion.isGolden && <span className="ml-2 text-yellow-500 font-black">⭐ ALTIN SORU</span>}
            </p>
            <h3 className="text-5xl font-black text-emerald-900 mb-12">{currentQuestion.word_en}</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt: string, i: number) => {
                let btnClass = "h-20 bg-white border-4 border-emerald-100 text-emerald-700 font-black text-xl rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all";
                
                if (roundResult) {
                  if (opt === roundResult.correctAnswer) {
                    btnClass = "h-20 bg-emerald-500 border-4 border-emerald-600 text-white font-black text-xl rounded-2xl";
                  } else if (opt === selectedAnswer) {
                    btnClass = "h-20 bg-red-500 border-4 border-red-600 text-white font-black text-xl rounded-2xl";
                  } else {
                    btnClass = "h-20 bg-gray-100 border-4 border-gray-200 text-gray-400 font-black text-xl rounded-2xl opacity-50";
                  }
                } else if (selectedAnswer === opt) {
                  btnClass = "h-20 bg-emerald-100 border-4 border-emerald-500 text-emerald-800 font-black text-xl rounded-2xl";
                }

                return (
                  <button 
                    key={i} 
                    onClick={() => handleAnswer(opt)}
                    disabled={!!selectedAnswer || !!roundResult}
                    className={btnClass}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {roundResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-8 p-4 rounded-xl font-bold text-lg ${roundResult.answers[socket?.id || '']?.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {!roundResult.answers[socket?.id || ''] ? (
                  'Süre bitti! Cevap veremedin. (0 Puan)'
                ) : roundResult.answers[socket?.id || ''].answer === null ? (
                  `Süre bitti! ${roundResult.answers[socket?.id || ''].points} Puan`
                ) : roundResult.answers[socket?.id || ''].isCorrect ? (
                  `Tebrikler, doğru bildin! +${roundResult.answers[socket?.id || ''].points} Puan`
                ) : (
                  `Yanlış cevap! ${roundResult.answers[socket?.id || ''].points} Puan`
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <div className="flex justify-center">
            <Loader2 className="animate-spin text-emerald-600" size={48} />
          </div>
        )}
      </div>

      {/* Emoji Buttons */}
      {gameState === 'playing' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2 bg-white/80 backdrop-blur-xl p-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100/50 z-40">
          {['😎', '😮', '😢', '😂', '🔥', '👏'].map(emoji => (
            <button key={emoji} onClick={() => sendEmoji(emoji)} className="text-2xl hover:scale-125 hover:-translate-y-2 transition-all p-2 rounded-full hover:bg-white active:scale-95">
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
