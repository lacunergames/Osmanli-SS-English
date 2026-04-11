/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ChevronRight, ArrowLeft, Trophy,
  GraduationCap, Award, Library, X, Loader2,
  Sparkles, BookOpen, Zap, Target, Layout,
  Lock, AlertTriangle, Trash2, Volume2, Flame, Timer,
  Headphones, Mic, TrendingUp, Play, Clock, Star, BarChart2, Map, Medal,
  Leaf, Compass, Brain, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import VersusMode from './components/VersusMode';

// ==========================================
// 1. SOCKET CONFIGURATION (Backend Connection)
// ==========================================
const socket = io();

const PREDEFINED_AVATARS = [
  "Felix", "Luna", "Milo", "Bella", 
  "Leo", "Chloe", "Max", "Mia", 
  "Charlie", "Lily", "Oscar", "Zoe", 
  "Sam", "Ruby", "Finn", "Penny"
];

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);

// ==========================================
// 3. GAME ENGINES
// ==========================================

const NoDataView = ({ onBack, message = "Bu aktivite için içerik henüz eklenmedi. Diğer aktiviteleri deneyebilirsin." }: { onBack: any, message?: string }) => (
  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto bg-white p-12 rounded-[56px] shadow-2xl border-8 border-indigo-50 text-center">
    <div className="w-24 h-24 bg-orange-100 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-xl border-4 border-white rotate-3"><Sparkles size={48} className="text-orange-500"/></div>
    <h2 className="text-3xl font-black mb-4 tracking-tighter text-indigo-900">Yakında Burada!</h2>
    <p className="text-indigo-600/60 font-bold mb-8">{message}</p>
    <button onClick={onBack} className="w-full h-16 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Geri Dön</button>
  </motion.div>
);

const FlashcardActivity = ({ data, onFinish }: { data: any[], onFinish: any }) => {
  const [queue, setQueue] = useState(() => shuffle(data));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [errors, setErrors] = useState(0);
  const currentWord = queue[currentIndex];

  const handleNext = (isCorrect: boolean) => {
    if(!isCorrect) setErrors(e => e + 1);
    setIsFlipped(false);
    setTimeout(() => {
      if (!isCorrect) setQueue(prev => [...prev, currentWord]);
      if (currentIndex + 1 < queue.length) setCurrentIndex(i => i + 1);
      else onFinish(errors + (isCorrect ? 0 : 1), data.length);
    }, 150);
  };

  if (queue.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;
  if (!currentWord) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto space-y-5">
      <div className="w-full flex justify-between bg-white/50 p-4 rounded-xl border border-indigo-200 shadow-sm text-sm font-bold">
        <span className="text-indigo-700">Kalan: {queue.length - currentIndex}</span>
        <span className="text-orange-600">Hata: {errors}</span>
      </div>
      <div className="w-full h-80 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)} style={{ perspective: '1500px' }}>
        <motion.div 
          className="relative w-full h-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 bg-white text-indigo-700 rounded-[40px] flex flex-col items-center justify-center border-4 border-indigo-50 shadow-lg p-8" style={{ backfaceVisibility: 'hidden' }}>
            <span className="text-4xl sm:text-6xl font-black text-center">{currentWord.word_en}</span>
            <span className="mt-4 text-sm opacity-50 font-bold uppercase tracking-widest">Click to flip</span>
          </div>
          <div className="absolute inset-0 bg-orange-500 text-white rounded-[40px] flex items-center justify-center border-4 border-orange-400 shadow-lg p-8" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <span className="text-4xl sm:text-6xl font-black text-center">{currentWord.word_tr}</span>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {isFlipped && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 w-full">
            <button onClick={(e) => { e.stopPropagation(); handleNext(false); }} className="flex-1 bg-white border-2 border-orange-500 text-orange-500 h-14 rounded-2xl font-bold hover:bg-orange-50 transition-colors">Tekrar</button>
            <button onClick={(e) => { e.stopPropagation(); handleNext(true); }} className="flex-1 bg-indigo-600 text-white h-14 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Biliyorum</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MatchItem { id: string; text: string; }

const MatchingActivity = ({ data, leftKey, rightKey, onFinish }: { data: any[], leftKey: string, rightKey: string, onFinish: any }) => {
  const CHUNK_SIZE = 8;
  const [chunks] = useState(() => {
    const validItems = data.filter(item => {
      const left = item[leftKey];
      const right = item[rightKey];
      if (!left || !right) return false;
      if (typeof right === 'string' && (right.trim() === '-' || right.trim() === '')) return false;
      return true;
    });
    const shuffled = shuffle(validItems);
    const result = [];
    for (let i = 0; i < shuffled.length; i += CHUNK_SIZE) {
      result.push(shuffled.slice(i, i + CHUNK_SIZE));
    }
    return result;
  });

  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const currentChunk = useMemo(() => chunks[currentChunkIndex] || [], [chunks, currentChunkIndex]);

  const [leftItems, setLeftItems] = useState<MatchItem[]>([]);
  const [rightItems, setRightItems] = useState<MatchItem[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<MatchItem | null>(null);
  const [selectedRight, setSelectedRight] = useState<MatchItem | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [errors, setErrors] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Each item in currentChunk is a pair. We give each side a unique ID based on its original index in the chunk.
    const lefts = currentChunk.map((item, idx) => ({ id: `l-${idx}`, text: item[leftKey] }));
    const rights = currentChunk.map((item, idx) => ({ id: `r-${idx}`, text: item[rightKey] }));
    
    setLeftItems(shuffle(lefts));
    setRightItems(shuffle(rights));
    setMatchedIds([]);
    setIsTransitioning(false);
  }, [currentChunkIndex, currentChunk, leftKey, rightKey]);

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      // Flexible validation: check if the text pair exists anywhere in the current chunk
      const matchFound = currentChunk.find(i => i[leftKey] === selectedLeft.text && i[rightKey] === selectedRight.text);
      
      if (matchFound) {
        // Point-to-point targeting: only disable the specific IDs that were clicked
        setMatchedIds(prev => [...prev, selectedLeft.id, selectedRight.id]);
        setSelectedLeft(null); 
        setSelectedRight(null);
      } else {
        setErrors(e => e + 1); 
        setIsError(true);
        setTimeout(() => { 
          setSelectedLeft(null); 
          setSelectedRight(null); 
          setIsError(false); 
        }, 600);
      }
    }
  }, [selectedLeft, selectedRight, currentChunk, leftKey, rightKey]);

  useEffect(() => {
    if (currentChunk.length > 0 && matchedIds.length === currentChunk.length * 2) {
      setIsTransitioning(true);
      setTimeout(() => {
        if (currentChunkIndex + 1 < chunks.length) {
          setCurrentChunkIndex(i => i + 1);
        } else {
          const totalItems = chunks.reduce((acc, c) => acc + c.length, 0);
          onFinish(errors, totalItems);
        }
      }, 1500);
    }
  }, [matchedIds, currentChunk.length, currentChunkIndex, chunks, errors, onFinish]);

  if (chunks.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 px-2">
      <div className="flex justify-between bg-white/50 p-4 rounded-xl border border-indigo-200 font-bold text-sm">
        {chunks.length > 1 && <span className="text-indigo-700">Aşama: {currentChunkIndex + 1} / {chunks.length}</span>}
        <span className="text-indigo-700">Doğru: {matchedIds.length / 2} / {currentChunk.length}</span>
        <span className="text-orange-600">Hata: {errors}</span>
      </div>
      
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {isTransitioning ? (
            <motion.div 
              key="transition"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-3xl border-4 border-indigo-100 z-10"
            >
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles size={40} className="text-indigo-600 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-indigo-800 mb-2">Harika Gidiyorsun!</h3>
              <p className="text-indigo-600 font-bold">Bir sonraki aşama hazırlanıyor...</p>
            </motion.div>
          ) : (
            <motion.div 
              key={`chunk-${currentChunkIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="space-y-3">
                {leftItems.map((item) => (
                  <button 
                    key={item.id} 
                    disabled={matchedIds.includes(item.id) || isError} 
                    onClick={() => setSelectedLeft(item)}
                    className={`w-full h-14 rounded-2xl font-bold transition-all border-2 ${
                      matchedIds.includes(item.id) 
                        ? 'opacity-20 bg-gray-100 border-transparent' 
                        : selectedLeft?.id === item.id 
                          ? (isError ? 'bg-orange-500 text-white border-orange-600' : 'bg-indigo-600 text-white border-indigo-700') 
                          : 'bg-white border-indigo-100 shadow-sm hover:border-indigo-300'
                    }`}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {rightItems.map((item) => (
                  <button 
                    key={item.id} 
                    disabled={matchedIds.includes(item.id) || isError} 
                    onClick={() => setSelectedRight(item)}
                    className={`w-full h-14 rounded-2xl font-bold transition-all border-2 ${
                      matchedIds.includes(item.id) 
                        ? 'opacity-20 bg-gray-100 border-transparent' 
                        : selectedRight?.id === item.id 
                          ? (isError ? 'bg-orange-500 text-white border-orange-600' : 'bg-indigo-600 text-white border-indigo-700') 
                          : 'bg-white border-indigo-100 shadow-sm hover:border-indigo-300'
                    }`}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const FillBlanksActivity = ({ data, onFinish }: { data: any[], onFinish: any }) => {
  const [queue] = useState(() => shuffle(data.filter(item => item.sentence_blank && item.word_en)));
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [ans, setAns] = useState<string | null>(null);
  const current = queue[index];

  const options = useMemo(() => {
    if (!current) return [];
    const others = shuffle(data.filter(d => d.word_en !== current.word_en).map(d => d.word_en)).slice(0, 2);
    return shuffle([current.word_en, ...others]);
  }, [current, data]);

  const select = (opt: string) => {
    if (ans) return;
    setAns(opt);
    const isCorrect = opt === current.word_en;
    if (isCorrect) setCorrect(c => c + 1); else setErrors(e => e + 1);
    setTimeout(() => {
      setAns(null);
      if (index + 1 < queue.length) setIndex(i => i + 1);
      else onFinish(errors + (isCorrect ? 0 : 1), correct + (isCorrect ? 1 : 0));
    }, 1500);
  };

  if (queue.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between bg-white/50 p-4 rounded-xl border border-indigo-200 font-bold text-sm">
        <span className="text-indigo-700">Doğru: {correct} / Yanlış: {errors}</span>
      </div>
      <div className="bg-white p-8 rounded-[40px] border-4 border-indigo-50 text-center shadow-lg">
        <p className="text-xl md:text-2xl font-black text-gray-800 leading-relaxed mb-10">
          {current.sentence_blank && typeof current.sentence_blank === 'string' ? (
            current.sentence_blank.split('___').map((p: string, i: number, a: string[]) => (
              <React.Fragment key={i}>{p}{i < a.length - 1 && <span className={`inline-block border-b-4 mx-2 min-w-[100px] transition-colors ${ans ? (ans === current.word_en ? 'border-indigo-500 text-indigo-600' : 'border-orange-500 text-orange-600') : 'border-indigo-200'}`}>{ans ? current.word_en : '____'}</span>}</React.Fragment>
            ))
          ) : (
            <span className="text-orange-500">Cümle verisi bulunamadı.</span>
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {options.map((o: string, i: number) => (
            <button key={i} disabled={!!ans} onClick={() => select(o)} className={`h-14 rounded-2xl font-bold border-2 transition-all ${ans ? (o === current.word_en ? 'bg-indigo-600 text-white border-indigo-700' : o === ans ? 'bg-orange-500 text-white border-orange-600' : 'opacity-20 border-transparent') : 'bg-white border-indigo-100 hover:border-indigo-300'}`}>{o}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuizActivity = ({ data, onFinish }: { data: any[], onFinish: any }) => {
  const [queue] = useState(() => shuffle(data));
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(10);
  const [errors, setErrors] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [ans, setAns] = useState<string | null>(null);
  const current = queue[index];

  const opts = useMemo(() => {
    if (!current) return [];
    // quiz_distractors tire (-) ile ayrılmış 3 yanlış şık içermeli
    // Verinin null veya undefined olma ihtimaline karşı güvenlik kontrolü
    let distractors: string[] = [];
    if (current.quiz_distractors && typeof current.quiz_distractors === 'string') {
      distractors = current.quiz_distractors.split('-').map((s: string) => s.trim()).filter(Boolean);
    }
    return shuffle([current.word_tr || "", ...distractors]);
  }, [index, current]);

  useEffect(() => {
    if (time > 0 && !ans) {
      const t = setInterval(() => setTime(v => v - 1), 1000);
      return () => clearInterval(t);
    } else if (time === 0 && !ans) handle(null);
  }, [time, ans]);

  const handle = (o: string | null) => {
    if (ans) return;
    setAns(o || "ZAMAN DOLDU");
    const isCorrect = o === current.word_tr;
    if (isCorrect) setCorrect(c => c + 1); else setErrors(e => e + 1);
    setTimeout(() => {
      setAns(null); setTime(10);
      if (index + 1 < queue.length) setIndex(i => i + 1);
      else onFinish(errors + (isCorrect ? 0 : 1), correct + (isCorrect ? 1 : 0));
    }, 1500);
  };

  if (data.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;
  if (!current) return null;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex justify-between bg-white/50 p-4 rounded-xl border border-indigo-200 font-bold text-sm">
        <span>Soru: {index + 1} / {queue.length}</span>
        <span className={time < 4 ? 'text-orange-600 animate-pulse' : 'text-indigo-700'}>Süre: {time}s</span>
      </div>
      <div className="w-full h-3 bg-white/50 rounded-full border border-indigo-100 overflow-hidden">
        <motion.div className={`h-full ${time < 4 ? 'bg-orange-500' : 'bg-indigo-500'}`} initial={{ width: "100%" }} animate={{ width: `${(time / 10) * 100}%` }} transition={{ duration: 1, ease: "linear" }} />
      </div>
      <div className="bg-white p-10 rounded-[40px] border-4 border-indigo-50 text-center shadow-lg space-y-10">
        <h2 className="text-4xl md:text-6xl font-black text-indigo-800 tracking-tight">{current.word_en}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {opts.map((o, i) => (
            <button key={i} disabled={!!ans} onClick={() => handle(o)} className={`h-14 rounded-2xl font-bold border-2 transition-all ${ans ? (o === current.word_tr ? 'bg-indigo-600 text-white border-indigo-700' : o === ans ? 'bg-orange-500 text-white border-orange-600' : 'opacity-20 border-transparent') : 'bg-white border-indigo-100 hover:border-indigo-300'}`}>{o}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. UI COMPONENTS
// ==========================================
const LeaderboardModal = ({ grade, onClose }: { grade: number, onClose: any }) => {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const fetchScores = async () => {
      console.log('1. fetchLeaderboard başladı. Parametreler:', { grade });
      
      if (grade === undefined || grade === null) {
        console.error("HATA: grade değeri tanımsız veya null.");
        if (isMounted) {
          setErrorMsg("Sınıf bilgisi eksik.");
          setLoading(false);
        }
        return;
      }
      
      const timeoutId = setTimeout(() => {
        console.error('TIMEOUT: Leaderboard sorgusu 15 saniyeyi aştı!');
        if (isMounted) {
          setLoading(false);
          setScores([]);
          setErrorMsg("Bağlantı zaman aşımına uğradı. Lütfen internetinizi kontrol edin.");
        }
      }, 15000);

      try {
        setLoading(true);
        setErrorMsg(null);
        console.log('2. Backend leaderboard sorgusu başlatılıyor...', { grade });
        
        const response: any = await socket.emitWithAck('get_leaderboard', { grade });
        const { data, error } = response;
          
        console.log('3. Backend leaderboard yanıtı geldi.', { data, error });

        if (error) throw error;
        
        if (isMounted) {
          if (!data || data.length === 0) {
            setScores([]);
          } else {
            setScores(data);
          }
        }
      } catch (err) {
        console.error("4. Hata yakalandı (Leaderboard):", err);
        if (isMounted) {
          setErrorMsg("Sıralama verileri alınamadı.");
          setScores([]);
        }
      } finally {
        console.log('5. Finally bloğu çalıştı (Leaderboard).');
        clearTimeout(timeoutId);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchScores();
    return () => { isMounted = false; };
  }, [grade]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-[32px] p-8 border-4 border-indigo-50 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={20} /></button>
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg border-2 border-white rotate-3"><Trophy size={32} className="text-white" /></div>
          <h2 className="text-2xl md:text-3xl font-black text-indigo-900 tracking-tighter text-center">{grade}. Sınıf Şampiyonları</h2>
        </div>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-50"><Loader2 className="animate-spin mb-2" size={32} /><p className="font-bold text-sm">Yükleniyor...</p></div>
          ) : errorMsg ? (
            <div className="text-center p-6 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200"><p className="font-bold text-rose-600">{errorMsg}</p></div>
          ) : scores.length === 0 ? (
            <div className="text-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-indigo-100">
              <p className="font-bold text-gray-400">Henüz bu sınıfta puan alan yok, ilk sen ol!</p>
            </div>
          ) : (
            scores.map((s, i) => {
              const playerLevel = calculateLevel(s.score).level;
              const playerTitle = getUserTitle(playerLevel);
              const TitleIcon = playerTitle.icon;
              const avatarSeed = s.student_name === localStorage.getItem('nexus_student_name') ? (localStorage.getItem('nexus_avatar_seed') || s.student_name) : s.student_name;
              
              let avatarRing = "";
              if (playerLevel >= 20) avatarRing = "ring-4 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]";
              else if (playerLevel >= 10) avatarRing = "ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]";

              return (
                <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400'}`}>{i+1}</span>
                    <div className={`w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${avatarRing}`}>
                       <img src={getAvatarUrl(avatarSeed, playerLevel)} alt="avatar" className="w-full h-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700 truncate max-w-[150px]">{s.student_name}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">Lvl {playerLevel}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${playerTitle.bg} ${playerTitle.color}`}>
                          <TitleIcon size={8} />
                          {playerTitle.title}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-sm">{s.score} XP</span>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// 5. MAIN APP
// ==========================================

const UserRegistrationModal = ({ onRegister }: { onRegister: (name: string, grade: number, avatarSeed: string) => void }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number>(6);
  const [avatarSeed, setAvatarSeed] = useState(PREDEFINED_AVATARS[0]);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length > 2) {
      setStep(2);
    }
  };

  const handleSubmit = () => {
    onRegister(name.trim(), grade, avatarSeed);
  };

  return (
    <div 
      id="loginModal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="bg-white w-full max-w-md rounded-[40px] p-10 border-8 border-indigo-50 shadow-2xl text-center mx-4">
        {step === 1 ? (
          <>
            <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
              <Sparkles size={40} className="text-indigo-600" />
            </div>
            <h2 className="text-3xl font-black text-indigo-900 mb-2 tracking-tighter">Hoş Geldin!</h2>
            <p className="text-indigo-600/80 font-bold text-sm mb-8">Başlamak için bilgilerini gir.</p>
            
            <form onSubmit={handleNext} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-black text-indigo-800 uppercase tracking-widest mb-2 ml-2">Adın ve Soyadın</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Örn: Ali Yılmaz"
                  className="w-full h-14 px-6 rounded-2xl bg-indigo-50 border-2 border-indigo-100 focus:border-indigo-500 focus:outline-none font-bold text-indigo-900 placeholder:text-indigo-300 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-indigo-800 uppercase tracking-widest mb-2 ml-2">Sınıfın</label>
                <select 
                  value={grade} 
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className="w-full h-14 px-6 rounded-2xl bg-indigo-50 border-2 border-indigo-100 focus:border-indigo-500 focus:outline-none font-bold text-indigo-900 transition-colors appearance-none cursor-pointer"
                >
                  <option value={6}>6. Sınıf</option>
                  <option value={7}>7. Sınıf</option>
                  <option value={8}>8. Sınıf</option>
                </select>
              </div>
              <button type="submit" disabled={name.trim().length < 3} className="w-full h-16 mt-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all uppercase tracking-widest">
                İleri
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => { setStep(3); setName(''); }} className="text-xs font-bold text-indigo-400 hover:text-indigo-600">Öğretmen Girişi</button>
              </div>
            </form>
          </>
        ) : step === 2 ? (
          <>
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner overflow-hidden border-4 border-indigo-200">
              <img src={getAvatarUrl(avatarSeed, 1)} alt="Selected Avatar" className="w-full h-full" />
            </div>
            <h2 className="text-2xl font-black text-indigo-900 mb-2 tracking-tighter">Avatarını Seç</h2>
            <p className="text-indigo-600/80 font-bold text-sm mb-6">Seni en iyi yansıtan karakteri bul!</p>
            
            <div className="grid grid-cols-4 gap-3 mb-6 max-h-[240px] overflow-y-auto p-2 custom-scrollbar">
              {PREDEFINED_AVATARS.map((seed) => (
                <button
                  key={seed}
                  onClick={() => setAvatarSeed(seed)}
                  className={`w-full aspect-square rounded-2xl overflow-hidden border-4 transition-all ${avatarSeed === seed ? 'border-indigo-500 scale-105 shadow-md' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}
                >
                  <img src={getAvatarUrl(seed, 1)} alt={seed} className="w-full h-full" />
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 h-16 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 active:scale-95 transition-all uppercase tracking-widest">
                Geri
              </button>
              <button onClick={handleSubmit} className="flex-[2] h-16 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest">
                Başla!
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
              <Lock size={40} className="text-indigo-600" />
            </div>
            <h2 className="text-3xl font-black text-indigo-900 mb-2 tracking-tighter">Öğretmen Girişi</h2>
            <p className="text-indigo-600/80 font-bold text-sm mb-8">Lütfen şifrenizi girin.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); if (name === 'osmanli_admin') onRegister('__ADMIN__', 6, 'bottts:teacher'); }} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-black text-indigo-800 uppercase tracking-widest mb-2 ml-2">Şifre</label>
                <input 
                  type="password" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Şifre"
                  className="w-full h-14 px-6 rounded-2xl bg-indigo-50 border-2 border-indigo-100 focus:border-indigo-500 focus:outline-none font-bold text-indigo-900 placeholder:text-indigo-300 transition-colors"
                />
              </div>
              <button type="submit" disabled={name !== 'osmanli_admin'} className="w-full h-16 mt-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all uppercase tracking-widest">
                Giriş Yap
              </button>
              <button type="button" onClick={() => { setStep(1); setName(''); }} className="w-full h-16 mt-2 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 active:scale-95 transition-all uppercase tracking-widest">
                Geri Dön
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const AVATAR_PACKS = [
  { id: 'avataaars', name: 'Standart', minLevel: 1, desc: 'Temel öğrenci avatarları' },
  { id: 'bottts', name: 'Robotlar', minLevel: 5, desc: 'Sevimli metalik dostlar' },
  { id: 'adventurer', name: 'Maceracılar', minLevel: 10, desc: 'RPG tarzı karakterler' },
  { id: 'micah', name: 'Efsaneler', minLevel: 15, desc: 'Özel tasarım karakterler' },
  { id: 'pixel-art', name: 'Retro Oyuncular', minLevel: 20, desc: 'Nostaljik piksel sanat' },
  { id: 'lorelei', name: 'Sevimli Kahramanlar', minLevel: 25, desc: 'Tatlı ve renkli yüzler' },
  { id: 'notionists', name: 'Minimalistler', minLevel: 30, desc: 'Sade ve şık tasarımlar' },
  { id: 'fun-emoji', name: 'Duygu Ustaları', minLevel: 40, desc: 'Eğlenceli emoji yüzleri' },
  { id: 'personas', name: 'Elit Karakterler', minLevel: 50, desc: 'Modern ve havalı avatarlar' },
];

const AvatarChangeModal = ({ currentSeed, level, isAdmin, onClose, onSave }: { currentSeed: string, level: number, isAdmin?: boolean, onClose: () => void, onSave: (seed: string) => void }) => {
  const [selectedSeed, setSelectedSeed] = useState(currentSeed);

  const getParsedSeed = (s: string) => s.includes(':') ? s.split(':')[1] : s;
  const getParsedStyle = (s: string) => s.includes(':') ? s.split(':')[0] : getAvatarStyle(level);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[40px] p-8 border-8 border-indigo-50 shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-black text-indigo-900 tracking-tighter">Avatarını Seç</h2>
            <p className="text-indigo-600/80 font-bold text-sm">Seni en iyi yansıtan karakteri bul!</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
          {AVATAR_PACKS.map((pack) => {
            const isLocked = !isAdmin && level < pack.minLevel;
            return (
              <div key={pack.id} className={`relative ${isLocked ? 'opacity-60 grayscale' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      {pack.name}
                      {isLocked && <Lock size={16} className="text-slate-500" />}
                    </h3>
                    <p className="text-sm font-bold text-slate-500">{pack.desc}</p>
                  </div>
                  {isLocked && (
                    <div className="bg-slate-200 text-slate-600 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                      <Lock size={12} /> LEVEL {pack.minLevel}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                  {PREDEFINED_AVATARS.map((seed) => {
                    const fullSeed = `${pack.id}:${seed}`;
                    const isSelected = selectedSeed === fullSeed || (selectedSeed === seed && getParsedStyle(selectedSeed) === pack.id);
                    
                    return (
                      <button
                        key={seed}
                        disabled={isLocked}
                        onClick={() => setSelectedSeed(fullSeed)}
                        className={`shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-4 transition-all snap-center ${isSelected ? 'border-indigo-500 scale-105 shadow-md bg-indigo-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'} ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <img src={`https://api.dicebear.com/7.x/${pack.id}/svg?seed=${seed}`} alt={seed} className="w-full h-full" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 pt-6 border-t-2 border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-indigo-200 shadow-inner">
              <img src={getAvatarUrl(selectedSeed, level)} alt="Selected Avatar" className="w-full h-full" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-500">Seçilen Avatar</div>
              <div className="text-lg font-black text-indigo-900">{getParsedSeed(selectedSeed)}</div>
            </div>
          </div>
          <button 
            onClick={() => onSave(selectedSeed)} 
            className="h-14 px-8 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};

function calculateLevel(totalXp: number) {
  let level = 1;
  let xpRemaining = totalXp;
  let xpForNextLevel = 100;

  while (true) {
    if (level >= 1 && level <= 5) {
      xpForNextLevel = 100;
    } else if (level >= 6 && level <= 15) {
      xpForNextLevel = 250;
    } else if (level >= 16 && level <= 30) {
      xpForNextLevel = 500;
    } else if (level >= 31 && level <= 50) {
      xpForNextLevel = 1000;
    } else if (level >= 51 && level <= 80) {
      xpForNextLevel = 2000;
    } else if (level >= 81 && level <= 120) {
      xpForNextLevel = 3000;
    } else {
      xpForNextLevel = 4000;
    }

    if (xpRemaining >= xpForNextLevel) {
      xpRemaining -= xpForNextLevel;
      level++;
    } else {
      break;
    }
  }

  return {
    level,
    currentXpInLevel: xpRemaining,
    xpForNextLevel,
    progressPercentage: Math.min(100, Math.max(0, (xpRemaining / xpForNextLevel) * 100))
  };
}

const getAvatarStyle = (level: number) => {
  if (level >= 50) return 'personas';
  if (level >= 40) return 'fun-emoji';
  if (level >= 30) return 'notionists';
  if (level >= 25) return 'lorelei';
  if (level >= 20) return 'pixel-art';
  if (level >= 15) return 'micah';
  if (level >= 10) return 'adventurer';
  if (level >= 5) return 'bottts';
  return 'avataaars';
};

const getAvatarUrl = (seed: string, level: number = 1) => {
  let actualSeed = seed;
  let style = getAvatarStyle(level);
  
  if (seed && seed.includes(':')) {
    const parts = seed.split(':');
    style = parts[0];
    actualSeed = parts[1];
  }
  
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${actualSeed}`;
};

const getUserTitle = (level: number) => {
  if (level >= 20) return { title: "Efsanevi Bilge", icon: Crown, color: "text-amber-500", bg: "bg-amber-100" };
  if (level >= 15) return { title: "Zihin Ustası", icon: Brain, color: "text-purple-500", bg: "bg-purple-100" };
  if (level >= 10) return { title: "Bilgi Avcısı", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-100" };
  if (level >= 5) return { title: "Meraklı Kaşif", icon: Compass, color: "text-blue-500", bg: "bg-blue-100" };
  return { title: "Çaylak Öğrenci", icon: Leaf, color: "text-green-500", bg: "bg-green-100" };
};

const ListeningActivity = ({ data, onFinish }: { data: any[], onFinish: any }) => {
  const [words, setWords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.length > 0) {
      const shuffled = shuffle(data).slice(0, 10);
      setWords(shuffled);
    }
  }, [data]);

  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      const currentWord = words[currentIndex];
      const wrongOptions = shuffle(data.filter(w => w.id !== currentWord.id)).slice(0, 3);
      setOptions(shuffle([currentWord, ...wrongOptions]));
      setHasAnswered(false);
      setSelectedOption(null);
      // Auto play audio when word changes
      playAudio(currentWord.word_en);
    }
  }, [currentIndex, words, data]);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleOptionClick = (option: any) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    setSelectedOption(option.id);

    const isCorrect = option.id === words[currentIndex].id;
    if (isCorrect) {
      setScore(s => s + 10);
    } else {
      setScore(s => s - 5);
      setErrors(e => e + 1);
    }

    setTimeout(() => {
      if (currentIndex + 1 < words.length) {
        setCurrentIndex(c => c + 1);
      } else {
        const finalErrors = isCorrect ? errors : errors + 1;
        const finalScore = isCorrect ? score + 10 : score - 5;
        onFinish(finalErrors, words.length, finalScore);
      }
    }, 1500);
  };

  if (data.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;
  if (words.length === 0) return <div className="text-center py-10"><Loader2 className="animate-spin mx-auto mb-4" size={32} />Yükleniyor...</div>;

  const currentWord = words[currentIndex];

  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="flex justify-between items-center text-xs font-black text-indigo-400 uppercase tracking-widest">
        <span>Soru {currentIndex + 1}/{words.length}</span>
        <span>{score} XP</span>
      </div>

      <div className="bg-white p-10 rounded-[40px] shadow-xl border border-indigo-50 flex flex-col items-center justify-center min-h-[250px]">
        <button 
          onClick={() => playAudio(currentWord.word_en)}
          className="w-32 h-32 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all mb-4"
        >
          <Volume2 size={64} />
        </button>
        <p className="text-indigo-400 font-bold text-sm mt-4">Tekrar dinlemek için dokun</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {options.map((opt, i) => {
          let btnClass = "bg-white text-indigo-900 border-2 border-indigo-100 hover:border-indigo-400";
          if (hasAnswered) {
            if (opt.id === currentWord.id) btnClass = "bg-green-500 text-white border-green-500";
            else if (opt.id === selectedOption) btnClass = "bg-red-500 text-white border-red-500";
            else btnClass = "bg-gray-100 text-gray-400 border-gray-100 opacity-50";
          }
          return (
            <button
              key={i}
              onClick={() => handleOptionClick(opt)}
              disabled={hasAnswered}
              className={`p-6 rounded-2xl font-black text-lg shadow-sm transition-all ${btnClass}`}
            >
              {opt.word_en}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SpeakingActivity = ({ data, onFinish }: { data: any[], onFinish: any }) => {
  const [words, setWords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<{message: string, type: 'success'|'error'|'info'|null}>({message: '', type: null});

  useEffect(() => {
    if (data && data.length > 0) {
      const shuffled = shuffle(data).slice(0, 10);
      setWords(shuffled);
    }
  }, [data]);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFeedback({ message: 'Tarayıcınız ses tanımayı desteklemiyor. Lütfen Chrome, Edge veya Safari kullanın.', type: 'error' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setFeedback({ message: 'Dinleniyor...', type: 'info' });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().replace(/[.,?!]/g, '').trim();
      const targetWord = words[currentIndex].word_en.toLowerCase().replace(/[.,?!]/g, '').trim();
      
      if (transcript === targetWord || transcript.includes(targetWord) || targetWord.includes(transcript)) {
        // Doğru
        let points = 5;
        if (attempts === 0) points = 10;
        else if (attempts === 1) points = 8;
        
        setScore(s => s + points);
        setFeedback({ message: `Harika! "${transcript}" dedin.`, type: 'success' });
        
        setTimeout(() => {
          if (currentIndex + 1 < words.length) {
            setCurrentIndex(c => c + 1);
            setAttempts(0);
            setFeedback({ message: '', type: null });
          } else {
            onFinish(errors, words.length, score + points);
          }
        }, 1500);
      } else {
        // Yanlış
        setAttempts(a => a + 1);
        setErrors(e => e + 1);
        setFeedback({ message: `"${transcript}" olarak duyduk. Tekrar dene!`, type: 'error' });
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        setFeedback({ message: 'Ses algılanmadı. Tekrar dene.', type: 'error' });
      } else {
        setFeedback({ message: 'Bir hata oluştu: ' + event.error, type: 'error' });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  if (data.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;
  if (words.length === 0) return <div className="text-center py-10"><Loader2 className="animate-spin mx-auto mb-4" size={32} />Yükleniyor...</div>;

  const currentWord = words[currentIndex];

  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="flex justify-between items-center text-xs font-black text-indigo-400 uppercase tracking-widest">
        <span>Kelime {currentIndex + 1}/{words.length}</span>
        <span>{score} XP</span>
      </div>

      <div className="bg-white p-10 rounded-[40px] shadow-xl border border-indigo-50 flex flex-col items-center justify-center min-h-[300px]">
        <h2 className="text-5xl font-black text-indigo-900 mb-8 text-center">{currentWord.word_en}</h2>
        
        <button 
          onClick={() => playAudio(currentWord.word_en)}
          className="flex items-center gap-2 bg-indigo-100 text-indigo-600 px-6 py-3 rounded-full font-bold hover:bg-indigo-200 transition-colors mb-8"
        >
          <Volume2 size={20} /> Örnek Seslendirme
        </button>

        {feedback.message && (
          <div className={`mb-6 p-4 rounded-2xl text-center font-bold w-full ${
            feedback.type === 'success' ? 'bg-green-100 text-green-700' : 
            feedback.type === 'error' ? 'bg-red-100 text-red-700' : 
            'bg-indigo-100 text-indigo-700'
          }`}>
            {feedback.message}
          </div>
        )}

        <button 
          onClick={startListening}
          disabled={isListening || feedback.type === 'success'}
          className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all ${
            isListening ? 'bg-red-500 animate-pulse scale-110' : 
            feedback.type === 'success' ? 'bg-green-500' :
            'bg-orange-500 hover:scale-105 active:scale-95'
          } text-white`}
        >
          <Mic size={40} />
        </button>
        <p className="text-indigo-400 font-bold text-sm mt-4">
          {isListening ? 'Sizi dinliyorum...' : 'Konuşmak için dokun'}
        </p>
      </div>
    </div>
  );
};

const SentenceArrangeActivity = ({ data, onFinish, mode }: { data: any[], onFinish: any, mode: 'listen' | 'translate' }) => {
  const [sentences, setSentences] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  const [availableWords, setAvailableWords] = useState<{id: string, word: string}[]>([]);
  const [selectedWords, setSelectedWords] = useState<{id: string, word: string}[]>([]);

  useEffect(() => {
    if (data && data.length > 0) {
      const shuffled = shuffle(data).slice(0, 5); // 5 sentences per session
      setSentences(shuffled);
    }
  }, [data]);

  useEffect(() => {
    if (sentences.length > 0 && currentIndex < sentences.length) {
      const currentSentence = sentences[currentIndex];
      const words = currentSentence.sentence_en.split(' ').map((w: string) => w.replace(/[.,?!]/g, ''));
      
      // Add some distractors (random words from other sentences if possible)
      let distractors: string[] = [];
      if (data.length > 1) {
         const otherSentences = data.filter(s => s.id !== currentSentence.id);
         if (otherSentences.length > 0) {
             const randomOther = otherSentences[Math.floor(Math.random() * otherSentences.length)];
             const otherWords = randomOther.sentence_en.split(' ').map((w: string) => w.replace(/[.,?!]/g, ''));
             distractors = shuffle(otherWords).slice(0, 2); // add 2 distractors
         }
      }

      const allWords = shuffle([...words, ...distractors]).map((w, i) => ({ id: `${i}-${w}`, word: w }));
      
      setAvailableWords(allWords);
      setSelectedWords([]);
      setHasAnswered(false);

      if (mode === 'listen') {
        playAudio(currentSentence.sentence_en);
      }
    }
  }, [currentIndex, sentences, data, mode]);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleWordClick = (wordObj: {id: string, word: string}, from: 'available' | 'selected') => {
    if (hasAnswered) return;

    if (from === 'available') {
      setAvailableWords(prev => prev.filter(w => w.id !== wordObj.id));
      setSelectedWords(prev => [...prev, wordObj]);
    } else {
      setSelectedWords(prev => prev.filter(w => w.id !== wordObj.id));
      setAvailableWords(prev => [...prev, wordObj]);
    }
  };

  const checkAnswer = () => {
    if (hasAnswered) return;
    setHasAnswered(true);

    const currentSentence = sentences[currentIndex];
    const targetWords = currentSentence.sentence_en.split(' ').map((w: string) => w.replace(/[.,?!]/g, '').toLowerCase());
    const userWords = selectedWords.map(w => w.word.toLowerCase());

    const isCorrect = targetWords.join(' ') === userWords.join(' ');

    if (isCorrect) {
      setScore(s => s + 15);
    } else {
      setScore(s => s - 5);
      setErrors(e => e + 1);
    }

    setTimeout(() => {
      if (currentIndex + 1 < sentences.length) {
        setCurrentIndex(c => c + 1);
      } else {
        const finalErrors = isCorrect ? errors : errors + 1;
        const finalScore = isCorrect ? score + 15 : score - 5;
        onFinish(finalErrors, sentences.length, finalScore);
      }
    }, 2000);
  };

  if (data.length === 0) return <NoDataView onBack={() => onFinish(0, 0)} />;
  if (sentences.length === 0) return <div className="text-center py-10"><Loader2 className="animate-spin mx-auto mb-4" size={32} />Cümleler Yükleniyor...</div>;

  const currentSentence = sentences[currentIndex];
  const targetWords = currentSentence.sentence_en.split(' ').map((w: string) => w.replace(/[.,?!]/g, '').toLowerCase());
  const userWords = selectedWords.map(w => w.word.toLowerCase());
  const isCorrect = hasAnswered && targetWords.join(' ') === userWords.join(' ');

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center text-xs font-black text-indigo-400 uppercase tracking-widest">
        <span>Cümle {currentIndex + 1}/{sentences.length}</span>
        <span>{score} XP</span>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-xl border border-indigo-50 flex flex-col items-center min-h-[200px]">
        {mode === 'listen' ? (
          <div className="flex flex-col items-center">
            <button 
              onClick={() => playAudio(currentSentence.sentence_en)}
              className="w-24 h-24 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all mb-4"
            >
              <Volume2 size={40} />
            </button>
            <p className="text-indigo-400 font-bold text-sm">Dinle ve cümleyi oluştur</p>
          </div>
        ) : (
          <div className="text-center w-full">
            <p className="text-indigo-400 font-bold text-sm uppercase tracking-widest mb-2">Çevir</p>
            <h2 className="text-2xl md:text-3xl font-black text-indigo-900">{currentSentence.sentence_tr}</h2>
          </div>
        )}
      </div>

      {/* Selected Words Area */}
      <div className={`min-h-[80px] p-4 rounded-3xl flex flex-wrap gap-2 items-center justify-center border-2 border-dashed ${hasAnswered ? (isCorrect ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50') : 'border-indigo-200 bg-indigo-50/50'}`}>
        {selectedWords.map(wordObj => (
          <button
            key={wordObj.id}
            onClick={() => handleWordClick(wordObj, 'selected')}
            disabled={hasAnswered}
            className="bg-white px-4 py-2 rounded-xl font-bold text-indigo-900 shadow-sm border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
          >
            {wordObj.word}
          </button>
        ))}
        {selectedWords.length === 0 && !hasAnswered && (
          <span className="text-indigo-300 font-bold text-sm">Kelimeleri buraya diz</span>
        )}
      </div>

      {/* Available Words Area */}
      <div className="min-h-[120px] p-6 bg-white rounded-3xl shadow-inner border border-gray-100 flex flex-wrap gap-3 justify-center">
        {availableWords.map(wordObj => (
          <button
            key={wordObj.id}
            onClick={() => handleWordClick(wordObj, 'available')}
            disabled={hasAnswered}
            className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-indigo-200 hover:scale-105 active:scale-95 transition-all"
          >
            {wordObj.word}
          </button>
        ))}
      </div>

      {/* Check Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={checkAnswer}
          disabled={hasAnswered || selectedWords.length === 0}
          className={`w-full max-w-xs h-14 rounded-2xl font-black text-white shadow-lg uppercase tracking-widest transition-all ${
            hasAnswered 
              ? (isCorrect ? 'bg-green-500' : 'bg-red-500')
              : (selectedWords.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed')
          }`}
        >
          {hasAnswered ? (isCorrect ? 'Doğru!' : 'Yanlış') : 'Kontrol Et'}
        </button>
      </div>
      
      {hasAnswered && !isCorrect && (
        <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-100">
          <p className="text-red-500 font-bold text-sm mb-1">Doğru Cevap:</p>
          <p className="text-red-700 font-black">{currentSentence.sentence_en}</p>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isAccessGranted, setIsAccessGranted] = useState(() => {
    return localStorage.getItem('nexus_access_granted') === 'true';
  });
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessError, setAccessError] = useState(false);

  const handleAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCodeInput === 'OSMANLI2026') {
      localStorage.setItem('nexus_access_granted', 'true');
      setIsAccessGranted(true);
      setAccessError(false);
    } else {
      setAccessError(true);
    }
  };

  const [view, setView] = useState('home'); 
  const [grade, setGrade] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [weekId, setWeekId] = useState<number | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [activityResult, setActivityResult] = useState<any>(null);
  const [showLB, setShowLB] = useState<number | null>(null); 
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [sentences, setSentences] = useState<any[]>([]);
  
  // User State
  const [username, setUsername] = useState(() => {
    try {
      const stored = localStorage.getItem('nexus_user_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.username || "";
      }
    } catch (e) {
      localStorage.removeItem('nexus_user_profile');
      window.location.href = '/';
    }
    return localStorage.getItem('nexus_student_name') || "";
  });

  const [userAvatarSeed, setUserAvatarSeed] = useState<string>(() => localStorage.getItem('nexus_avatar_seed') || '');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('nexus_is_admin') === 'true');
  
  const [userGrade, setUserGrade] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('nexus_user_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.grade ? Number(parsed.grade) : null;
      }
    } catch (e) {
      localStorage.removeItem('nexus_user_profile');
      window.location.href = '/';
    }
    const g = localStorage.getItem('nexus_student_grade');
    return g ? Number(g) : null;
  });
  
  const [totalScore, setTotalScore] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('nexus_user_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.score ? Number(parsed.score) : 0;
      }
    } catch (e) {
      localStorage.removeItem('nexus_user_profile');
      window.location.href = '/';
    }
    const s = localStorage.getItem('nexus_total_score');
    return s ? Number(s) : 0;
  });

  const levelInfo = calculateLevel(totalScore);
  const [showRegistration, setShowRegistration] = useState(!username);
  
  const [levelUpPopup, setLevelUpPopup] = useState<{ level: number } | null>(null);
  const prevLevelRef = useRef<number>(levelInfo.level);

  useEffect(() => {
    if (levelInfo.level > prevLevelRef.current) {
      setLevelUpPopup({ level: levelInfo.level });
    }
    prevLevelRef.current = levelInfo.level;
  }, [levelInfo.level]);

  // Supabase'den çekilen kelimeler
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // NEW STATES for Home Screen
  const [wordOfTheDay, setWordOfTheDay] = useState<any>(null);
  const [top3Leaderboard, setTop3Leaderboard] = useState<any[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<any>(null);

  const [streak, setStreak] = useState<number>(() => {
    const s = localStorage.getItem('nexus_streak');
    return s ? parseInt(s, 10) : 0;
  });
  const [streakPopup, setStreakPopup] = useState<{ streak: number, bonus: number } | null>(null);
  const [winnerPopup, setWinnerPopup] = useState<{ name: string, score: number, period: number } | null>(null);
  const [currentLeaguePeriod, setCurrentLeaguePeriod] = useState<number>(1);
  const [leagueTimeRemaining, setLeagueTimeRemaining] = useState<string>('');
  const [leagueStartTime, setLeagueStartTime] = useState<number>(Date.now());
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const checkPreviousWinner = useCallback((period: number, grade: string) => {
    if (period <= 1) return;
    const lastSeen = parseInt(localStorage.getItem('nexus_last_seen_winner_period') || '0', 10);
    if (lastSeen < period) {
      socket.emit('get_previous_winner', { grade, period }, (res: any) => {
        if (res.data) {
          setWinnerPopup({ name: res.data.student_name, score: res.data.score, period });
        } else {
          localStorage.setItem('nexus_last_seen_winner_period', period.toString());
        }
      });
    }
  }, []);

  const closeWinnerPopup = () => {
    if (winnerPopup) {
      localStorage.setItem('nexus_last_seen_winner_period', winnerPopup.period.toString());
      setWinnerPopup(null);
    }
  };

  useEffect(() => {
    const PERIOD_DURATION = 20 * 24 * 60 * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const nextResetTime = leagueStartTime + PERIOD_DURATION;
      const diff = nextResetTime - now;

      if (diff <= 0) {
        setLeagueTimeRemaining('Sıfırlanıyor...');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setLeagueTimeRemaining(`${days}g ${hours}s ${minutes}d`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [leagueStartTime]);

  useEffect(() => {
    socket.on('league_reset', (data) => {
      setLeagueStartTime(data.startTime);
      if (data.period) {
        setCurrentLeaguePeriod(data.period);
        if (userGrade) {
          checkPreviousWinner(data.period, userGrade);
        }
      }
      if (userGrade && username) {
        socket.emit('get_home_data', { grade: userGrade, username }, (res: any) => {
          if (res.lbData) setTop3Leaderboard(res.lbData.slice(0, 3));
        });
      }
    });
    return () => {
      socket.off('league_reset');
    };
  }, [userGrade, username, checkPreviousWinner]);

  useEffect(() => {
    const lastDateStr = localStorage.getItem('nexus_last_activity_date');
    if (lastDateStr) {
      const lastDate = new Date(lastDateStr);
      const today = new Date();
      lastDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) {
        localStorage.setItem('nexus_streak', '0');
        setStreak(0);
      }
    }
  }, []);

  // Fetch Word of the Day and Top 3 Leaderboard
  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      if (!userGrade || view !== 'home') return;
      
      try {
        const response: any = await socket.emitWithAck('get_home_data', { grade: userGrade, username });
        const { lbData, lbError, vocabData, vocabError, leagueStartTime: serverStartTime, currentPeriod } = response;
        
        if (serverStartTime) setLeagueStartTime(serverStartTime);
        if (currentPeriod) {
          setCurrentLeaguePeriod(currentPeriod);
          checkPreviousWinner(currentPeriod, userGrade);
        }
          
        if (!lbError && lbData && isMounted) {
          setTop3Leaderboard(lbData.slice(0, 3));
          const uIndex = lbData.findIndex(p => p.student_name === username);
          if (uIndex > 2) {
            setCurrentUserRank({
              ...lbData[uIndex],
              rank: uIndex + 1
            });
          } else {
            setCurrentUserRank(null);
          }
        }

        // Fetch Word of the Day
        if (!vocabError && vocabData && vocabData.length > 0 && isMounted) {
          const today = new Date().toISOString().split('T')[0];
          let seed = 0;
          for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i);
          const randomIndex = seed % vocabData.length;
          setWordOfTheDay(vocabData[randomIndex]);
        }
      } catch (err) {
        console.error("Error fetching home data:", err);
      }
    };
    fetchHomeData();
    return () => { isMounted = false; };
  }, [userGrade, view, username, checkPreviousWinner]);

  // Ünite İsimleri (Görsel amaçlı)
  const unitNames: any = {
    6: { 1: "Life", 2: "Yummy Breakfast", 3: "Downtown", 4: "Weather and Emotions", 5: "At the Fair", 6: "Occupations", 7: "Holidays", 8: "Bookworms", 9: "Saving the Planet", 10: "Democracy" },
    7: { 1: "Appearance and Personality", 2: "Sports", 3: "Biographies", 4: "Wild Animals", 5: "Television", 6: "Celebrations", 7: "Dreams", 8: "Public Buildings", 9: "Environment", 10: "Planets" },
    8: { 1: "Friendship", 2: "Teen Life", 3: "In the Kitchen", 4: "On the Phone", 5: "The Internet", 6: "Adventures", 7: "Tourism", 8: "Chores", 9: "Science", 10: "Natural Forces" }
  };

  // Fetch initial score if user exists
  useEffect(() => {
    let isMounted = true;
    const fetchUserScore = async () => {
      if (!username || !userGrade) return;
      
      try {
        const response: any = await socket.emitWithAck('get_user_score', { username, grade: userGrade });
        const { data, error } = response;
          
        if (error) {
          if (error.code !== 'PGRST116') {
            console.error("Score fetch error:", error);
          }
          return;
        }
        
        if (data && isMounted) {
          setTotalScore(data.score);
          localStorage.setItem('nexus_total_score', data.score.toString());
          
          if (data.streak !== undefined) {
            setStreak(data.streak);
            localStorage.setItem('nexus_streak', data.streak.toString());
          }
          if (data.last_activity_date) {
            localStorage.setItem('nexus_last_activity_date', data.last_activity_date);
          }
        }
      } catch (err) {
        console.error("Unexpected error fetching score:", err);
      }
    };
    fetchUserScore();
    return () => { isMounted = false; };
  }, [username, userGrade]);

  const handleRegister = async (name: string, gradeLevel: number, avatarSeed: string) => {
    try {
      if (name === '__ADMIN__') {
        localStorage.setItem('nexus_is_admin', 'true');
        setIsAdmin(true);
        name = 'Öğretmen';
      } else {
        localStorage.removeItem('nexus_is_admin');
        setIsAdmin(false);
      }

      // 1. LocalStorage'ı güvenli bir şekilde güncelle
      const userProfile = { username: name, grade: gradeLevel, score: 0 };
      localStorage.setItem('nexus_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('nexus_student_name', name);
      localStorage.setItem('nexus_student_grade', gradeLevel.toString());
      localStorage.setItem('nexus_total_score', '0');
      localStorage.setItem('nexus_avatar_seed', avatarSeed);
      setUserAvatarSeed(avatarSeed);
      
      // 2. Backend işlemlerini yap
      if (name !== 'Öğretmen') {
        try {
          const response: any = await socket.emitWithAck('get_user_score', { username: name, grade: gradeLevel });
          const { data, error } = response;
            
          if (error && error.code !== 'PGRST116') {
            console.error("Kayıt kontrol hatası:", error);
          }
            
          if (data) {
            const updatedProfile = { username: name, grade: gradeLevel, score: data.score };
            localStorage.setItem('nexus_user_profile', JSON.stringify(updatedProfile));
            localStorage.setItem('nexus_total_score', data.score.toString());
            setTotalScore(data.score);

            if (data.streak !== undefined) {
              setStreak(data.streak);
              localStorage.setItem('nexus_streak', data.streak.toString());
            }
            if (data.last_activity_date) {
              localStorage.setItem('nexus_last_activity_date', data.last_activity_date);
            }
          } else {
            // Insert new user with 0 score
            const insertResponse: any = await socket.emitWithAck('update_score', { username: name, grade: gradeLevel, score: 0, streak: 0, last_activity_date: null });
            if (insertResponse.error) {
              console.error("Kullanıcı oluşturma hatası:", insertResponse.error);
            }
            setTotalScore(0);
          }
        } catch (err) {
          console.error("Beklenmeyen kayıt hatası:", err);
        }
      }
    } catch (err) {
      console.error("Kayıt işlemi sırasında hata:", err);
    } finally {
      setUsername(name);
      setUserGrade(gradeLevel);
      setShowRegistration(false);
      setView('home');
    }
  };

  const handleResetProfile = async () => {
    try {
      if (username && userGrade) {
        await socket.emitWithAck('delete_profile', { username, grade: userGrade });
      }
    } catch (error) {
      console.error("Profil silinirken hata oluştu:", error);
    } finally {
      localStorage.clear();
      setUsername("");
      setUserGrade(null);
      setTotalScore(0);
      setGrade(null);
      setUnitId(null);
      setWeekId(null);
      setActiveMode(null);
      setActivityResult(null);
      setVocabulary([]);
      setFetchErrorMsg(null);
      setShowResetModal(false);
      setShowRegistration(true);
      setView('home');
    }
  };

  const [fetchErrorMsg, setFetchErrorMsg] = useState<string | null>(null);

  const fetchVocabulary = useCallback(async (gLevel: number, uId: number, wId: number) => {
    setLoading(true);
    setFetchErrorMsg(null);

    // Acil Çıkış Kapısı (Timeout Fallback) - 15 saniye
    const timeoutId = setTimeout(() => {
      console.error('TIMEOUT: Supabase sorgusu 15 saniyeyi aştı!');
      setLoading(false);
      setVocabulary([]);
      setFetchErrorMsg("Bağlantı zaman aşımına uğradı. Lütfen internetinizi kontrol edin.");
    }, 15000);

    // Adım 1: Profili güvenle değişkene al
    let safeGrade = Number(gLevel);
    try {
      const stored = localStorage.getItem('nexus_user_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.grade) {
          safeGrade = Number(parsed.grade);
        }
      }
    } catch (e) {
      localStorage.removeItem('nexus_user_profile');
      clearTimeout(timeoutId);
      setLoading(false);
      window.location.href = '/';
      return;
    }

    if (!safeGrade || !uId || !wId) {
      setVocabulary([]);
      setFetchErrorMsg("Lütfen sınıfınızı tekrar seçin.");
      clearTimeout(timeoutId);
      setLoading(false);
      return;
    }

    const safeUnitId = Number(uId);
    const safeWeekId = Number(wId);

    // Adım 2: Basit try-catch-finally bloğu
    try {
      const response: any = await socket.emitWithAck('get_vocabulary', { 
        grade: safeGrade, 
        unitId: safeUnitId, 
        weekId: safeWeekId 
      });
      const { data, error } = response;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        setVocabulary([]);
        setFetchErrorMsg("Bu haftaya ait içerik bulunamadı.");
      } else {
        setVocabulary(data);
      }

      // Fetch sentences
      const sentencesResponse: any = await socket.emitWithAck('get_sentences', {
        grade: safeGrade,
        unitId: safeUnitId,
        weekId: safeWeekId
      });
      
      if (!sentencesResponse.error && sentencesResponse.data && sentencesResponse.data.length > 0) {
        setSentences(sentencesResponse.data);
      } else {
        // Fallback mock sentences if table is empty or doesn't exist yet
        setSentences([
          { id: '1', sentence_en: 'The quick brown fox jumps over the lazy dog.', sentence_tr: 'Hızlı kahverengi tilki tembel köpeğin üzerinden atlar.' },
          { id: '2', sentence_en: 'I am learning English every day.', sentence_tr: 'Her gün İngilizce öğreniyorum.' },
          { id: '3', sentence_en: 'She likes to read books in the library.', sentence_tr: 'O kütüphanede kitap okumayı sever.' },
          { id: '4', sentence_en: 'They played football after school.', sentence_tr: 'Okuldan sonra futbol oynadılar.' },
          { id: '5', sentence_en: 'What time does the train arrive?', sentence_tr: 'Tren saat kaçta varıyor?' }
        ]);
      }

    } catch (error) {
      console.error("Veri çekme hatası:", error);
      setVocabulary([]);
      setFetchErrorMsg("Kelimeler yüklenirken bir hata oluştu.");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []); // Sadece primitive bağımlılıklar (burada bağımlılık yok)

  useEffect(() => {
    if (view === 'activitySelection' && grade !== null && unitId !== null && weekId !== null) {
      console.log('0. useEffect tetiklendi -> fetchVocabulary çağrılıyor');
      fetchVocabulary(grade, unitId, weekId);
    }
  }, [view, grade, unitId, weekId, fetchVocabulary]);

  const navigate = (v: string, g: number | null = null, u: number | null = null, w: number | null = null, m: string | null = null) => {
    // GÜVENLİK: Route Koruması (GradeGuard Katmanı)
    if (!isAdmin && g !== null && userGrade !== null && g !== userGrade) {
      setShowGuardModal(true);
      return;
    }

    setView(v); 
    if(g !== null) setGrade(g); 
    if(u !== null) setUnitId(u); 
    if(w !== null) setWeekId(w); 
    if(m !== null) setActiveMode(m);
    setActivityResult(null); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinish = async (errors: number, correct: number, customScore?: number) => {
    // 0. Başarı Oranı Kontrolü
    let isSuccessful = false;
    let actualCorrect = 0;

    if (correct === 0 && errors === 0) {
      // Boş etkinlik durumu
      isSuccessful = true;
    } else if (activeMode === 'sentences' || activeMode === 'quiz') {
      actualCorrect = correct;
      const totalQuestions = correct + errors;
      isSuccessful = totalQuestions > 0 && (actualCorrect / totalQuestions) >= 0.5;
    } else if (activeMode === 'listening' || activeMode === 'speaking' || activeMode === 'sentence_listen' || activeMode === 'sentence_translate') {
      actualCorrect = Math.max(0, correct - errors);
      isSuccessful = correct > 0 && (actualCorrect / correct) >= 0.5;
    } else if (activeMode === 'synonyms' || activeMode === 'collocations') {
      actualCorrect = correct;
      const totalAttempts = correct + errors;
      isSuccessful = totalAttempts > 0 && (actualCorrect / totalAttempts) >= 0.5;
    } else if (activeMode === 'flashcards') {
      actualCorrect = correct;
      const totalAttempts = correct + errors;
      isSuccessful = totalAttempts > 0 && (actualCorrect / totalAttempts) >= 0.5;
    }

    if (!isSuccessful) {
      setActivityResult({ 
        errors, 
        total: actualCorrect, 
        score: 0, 
        limited: false, 
        failed: true,
        message: "Etkinliği tamamlamak için %50 veya daha fazla doğru yapmalısın!" 
      });
      return;
    }

    // 1. Puan Hesaplama
    let earnedScore = 0;
    if (customScore !== undefined) {
      earnedScore = customScore;
    } else if (activeMode === 'synonyms' || activeMode === 'collocations') {
      earnedScore = Math.max(0, (correct * 10) - (errors * 5));
    } else if (activeMode === 'sentences') {
      earnedScore = correct * 15;
    } else if (activeMode === 'quiz') {
      earnedScore = correct * 20;
    }
    // flashcards = 0 puan

    // 2. Günlük Limit Kontrolü
    const today = new Date().toISOString().split('T')[0];
    const activityKey = `${today}_${unitId}_${weekId}_${activeMode}`;
    const hasCompletedToday = localStorage.getItem(activityKey);

    // Kalıcı tamamlama kaydı (Kategori ilerlemesi için)
    localStorage.setItem(`nexus_completed_${unitId}_${weekId}_${activeMode}`, 'true');

    if (hasCompletedToday) {
      alert("Bugün bu etkinlikten puanını aldın, yarın tekrar gel!");
      setActivityResult({ errors, total: actualCorrect, score: 0, limited: true });
      return;
    }

    // 3. Puan Ekleme ve Kaydetme
    let currentStreak = parseInt(localStorage.getItem('nexus_streak') || '0', 10);
    const lastDateStr = localStorage.getItem('nexus_last_activity_date');
    let streakBonus = 0;

    if (lastDateStr !== today) {
      let diffDays = 0;
      if (lastDateStr) {
        const lastDate = new Date(lastDateStr);
        const todayDate = new Date(today);
        lastDate.setHours(0, 0, 0, 0);
        todayDate.setHours(0, 0, 0, 0);
        const diffTime = todayDate.getTime() - lastDate.getTime();
        diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          currentStreak += 1;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      
      localStorage.setItem('nexus_last_activity_date', today);
      localStorage.setItem('nexus_streak', currentStreak.toString());
      setStreak(currentStreak);

      // Check for 5-day milestone
      if (currentStreak > 0 && currentStreak % 5 === 0) {
        streakBonus = 50;
        setStreakPopup({ streak: currentStreak, bonus: 50 });
      } else if (diffDays === 1 || !lastDateStr) {
        setStreakPopup({ streak: currentStreak, bonus: 0 });
      }
    }

    const finalEarnedScore = earnedScore + streakBonus;

    setActivityResult({ errors, total: actualCorrect, score: finalEarnedScore, limited: false });
    
    // Kullanıcıya bilgi ver
    if (activeMode !== 'flashcards' && !streakPopup) {
      // alert(`Oyun Bitti! Hata Sayın: ${errors}, Kazandığın Puan: ${earnedScore}${streakBonus > 0 ? ` (+${streakBonus} Seri Bonusu)` : ''}`);
    }
    
    if (finalEarnedScore > 0 && username && userGrade && !isAdmin) {
      localStorage.setItem(activityKey, 'true');
      
      try {
        // Önce veritabanından mevcut puanı çek
        const response: any = await socket.emitWithAck('get_user_score', { username, grade: userGrade });
        const { data, error } = response;
          
        let currentDbScore = 0;
        if (!error && data) {
          currentDbScore = data.score;
        } else if (error && error.code !== 'PGRST116') {
          console.error("Mevcut puan çekilemedi:", error);
          return; // Hata varsa güncelleme yapma
        }

        const newTotal = currentDbScore + finalEarnedScore;
        
        // Backend'i güncelle
        const updateResponse: any = await socket.emitWithAck('update_score', { 
          username, 
          grade: userGrade, 
          score: newTotal,
          streak: currentStreak,
          last_activity_date: today
        });
          
        if (!updateResponse.error) {
          setTotalScore(newTotal);
          localStorage.setItem('nexus_total_score', newTotal.toString());
        } else {
          console.error("Puan güncellenemedi:", updateResponse.error);
        }
      } catch (err) {
        console.error("Puan ekleme sırasında beklenmeyen hata:", err);
      }
    }
  };

  const handleVersusWin = async (earnedScore: number) => {
    if (earnedScore > 0 && username && userGrade && !isAdmin) {
      // Streak Logic
      const today = new Date().toISOString().split('T')[0];
      let currentStreak = parseInt(localStorage.getItem('nexus_streak') || '0', 10);
      const lastDateStr = localStorage.getItem('nexus_last_activity_date');
      let streakBonus = 0;

      if (lastDateStr !== today) {
        let diffDays = 0;
        if (lastDateStr) {
          const lastDate = new Date(lastDateStr);
          const todayDate = new Date(today);
          lastDate.setHours(0, 0, 0, 0);
          todayDate.setHours(0, 0, 0, 0);
          const diffTime = todayDate.getTime() - lastDate.getTime();
          diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            currentStreak += 1;
          } else if (diffDays > 1) {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        
        localStorage.setItem('nexus_last_activity_date', today);
        localStorage.setItem('nexus_streak', currentStreak.toString());
        setStreak(currentStreak);

        // Check for 5-day milestone
        if (currentStreak > 0 && currentStreak % 5 === 0) {
          streakBonus = 50;
          setStreakPopup({ streak: currentStreak, bonus: 50 });
        } else if (diffDays === 1 || !lastDateStr) {
          setStreakPopup({ streak: currentStreak, bonus: 0 });
        }
      }

      const finalEarnedScore = earnedScore + streakBonus;

      try {
        const response: any = await socket.emitWithAck('get_user_score', { username, grade: userGrade });
        const { data, error } = response;
          
        let currentDbScore = 0;
        if (!error && data) {
          currentDbScore = data.score;
        } else if (error && error.code !== 'PGRST116') {
          console.error("Mevcut puan çekilemedi:", error);
          return;
        }

        const newTotal = currentDbScore + finalEarnedScore;
        
        const updateResponse: any = await socket.emitWithAck('update_score', { 
          username, 
          grade: userGrade, 
          score: newTotal,
          streak: currentStreak,
          last_activity_date: today
        });
          
        if (!updateResponse.error) {
          setTotalScore(newTotal);
          localStorage.setItem('nexus_total_score', newTotal.toString());
        } else {
          console.error("Puan güncellenemedi:", updateResponse.error);
        }
      } catch (err) {
        console.error("Puan ekleme sırasında beklenmeyen hata:", err);
      }
    }
  };

  if (!isAccessGranted) {
    return (
      <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[40px] p-10 border-8 border-indigo-100 shadow-2xl text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
            <Lock size={40} className="text-indigo-600" />
          </div>
          <h2 className="text-3xl font-black text-indigo-900 mb-2 tracking-tighter">Özel Erişim</h2>
          <p className="text-indigo-600/80 font-bold text-sm mb-8">Bu uygulamaya erişmek için şifre gereklidir.</p>
          
          <form onSubmit={handleAccessSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-black text-indigo-800 uppercase tracking-widest mb-2 ml-2">Erişim Şifresi</label>
              <input 
                type="password" 
                value={accessCodeInput} 
                onChange={(e) => setAccessCodeInput(e.target.value)} 
                placeholder="Şifreyi girin"
                className={`w-full h-14 px-6 rounded-2xl bg-indigo-50 border-2 ${accessError ? 'border-orange-500' : 'border-indigo-100 focus:border-indigo-500'} focus:outline-none font-bold text-indigo-900 placeholder:text-indigo-300 transition-colors`}
                required
              />
              {accessError && <p className="text-orange-500 text-xs font-bold mt-2 ml-2">Hatalı şifre, lütfen tekrar deneyin.</p>}
            </div>
            <button type="submit" className="w-full h-16 mt-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest">
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-100 text-gray-800 font-sans selection:bg-indigo-200">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4)_0%,transparent_50%)] pointer-events-none"></div>

      {showRegistration && <UserRegistrationModal onRegister={handleRegister} />}
      {showAvatarModal && (
        <AvatarChangeModal 
          currentSeed={userAvatarSeed || username} 
          level={levelInfo.level} 
          isAdmin={isAdmin}
          onClose={() => setShowAvatarModal(false)} 
          onSave={(seed) => {
            localStorage.setItem('nexus_avatar_seed', seed);
            setUserAvatarSeed(seed);
            setShowAvatarModal(false);
          }} 
        />
      )}
      {showLB && <LeaderboardModal grade={showLB} onClose={() => setShowLB(null)} />}

      <AnimatePresence>
        {showGuardModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-md rounded-[40px] p-8 border-8 border-orange-50 shadow-2xl text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3"><AlertTriangle size={40} className="text-orange-600" /></div>
              <h2 className="text-2xl font-black text-indigo-900 mb-4">🛑 Erişim Engellendi!</h2>
              <p className="text-indigo-700 font-bold mb-8">Sadece kendi sınıf düzeyindeki etkinliklere katılabilirsin. Kendi sınıfının maceralarına dönmeye ne dersin?</p>
              <button onClick={() => { setShowGuardModal(false); navigate('home'); }} className="w-full h-14 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Sınıfıma Dön</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-md rounded-[40px] p-8 border-8 border-rose-50 shadow-2xl text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3"><Trash2 size={40} className="text-rose-600" /></div>
              <h2 className="text-2xl font-black text-rose-900 mb-4">Emin misin?</h2>
              <p className="text-rose-700 font-bold mb-8">Tüm puanların ve ilerlemen silinecek. Bu işlem geri alınamaz!</p>
              <div className="flex gap-4">
                <button onClick={() => setShowResetModal(false)} className="flex-1 h-14 bg-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-200 transition-colors">Vazgeç</button>
                <button onClick={handleResetProfile} className="flex-1 h-14 bg-rose-600 text-white font-black rounded-2xl shadow-lg hover:bg-rose-700 transition-colors">Evet, Sil</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {streakPopup && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.5, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 10 }} className="bg-white w-full max-w-sm rounded-[40px] p-8 border-8 border-amber-100 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.2)_0%,transparent_70%)] pointer-events-none"></div>
              <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative z-10">
                <Flame size={56} className="text-amber-500 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-amber-900 mb-2 relative z-10">{streakPopup.streak} Günlük Seri!</h2>
              <p className="text-amber-700 font-bold mb-6 relative z-10">
                Harika gidiyorsun! Her gün girerek serini koru.
                {streakPopup.bonus > 0 && <span className="block mt-2 text-orange-600 font-black text-lg">+{streakPopup.bonus} XP Bonus Kazandın!</span>}
              </p>
              <button onClick={() => setStreakPopup(null)} className="w-full h-14 bg-amber-500 text-white font-black rounded-2xl shadow-lg hover:bg-amber-600 transition-all relative z-10 uppercase tracking-widest">
                Devam Et
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {levelUpPopup && (
          <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.5, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.5, opacity: 0, y: 50 }} className="bg-white w-full max-w-sm rounded-[40px] p-8 border-8 border-yellow-200 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(253,224,71,0.3)_0%,transparent_70%)] pointer-events-none"></div>
              <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative z-10">
                <Trophy size={56} className="text-yellow-500 animate-bounce" />
              </div>
              <h2 className="text-4xl font-black text-yellow-600 mb-2 relative z-10">LEVEL UP!</h2>
              <p className="text-yellow-800 font-bold mb-6 relative z-10 text-xl">
                Tebrikler! <span className="text-indigo-600">Level {levelUpPopup.level}</span> oldun!
              </p>
              <button onClick={() => setLevelUpPopup(null)} className="w-full h-14 bg-yellow-500 text-white font-black rounded-2xl shadow-lg hover:bg-yellow-600 transition-all relative z-10 uppercase tracking-widest">
                Devam Et
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-md rounded-[40px] p-8 border-8 border-indigo-50 shadow-2xl text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3"><Lock size={40} className="text-indigo-600" /></div>
              <h2 className="text-2xl font-black text-indigo-900 mb-4">Admin Paneli</h2>
              <input 
                type="password" 
                placeholder="Admin Şifresi" 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full h-14 rounded-2xl border-2 border-gray-200 px-4 mb-6 text-center font-bold focus:border-indigo-500 focus:outline-none"
              />
              {adminPassword === 'osmanli_admin' ? (
                <button 
                  onClick={() => {
                    socket.emit('admin_reset_league', (res: any) => {
                      if (res.success) {
                        alert('Lig başarıyla sıfırlandı!');
                        setShowAdminModal(false);
                        setAdminPassword('');
                      }
                    });
                  }} 
                  className="w-full h-14 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all mb-4"
                >
                  Ligi Şimdi Sıfırla
                </button>
              ) : (
                <p className="text-sm text-gray-500 font-bold mb-6">Lütfen admin şifresini girin.</p>
              )}
              <button onClick={() => { setShowAdminModal(false); setAdminPassword(''); }} className="w-full h-14 bg-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-200 transition-colors">Kapat</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {winnerPopup && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-gradient-to-b from-yellow-300 to-yellow-500 w-full max-w-md rounded-[40px] p-1 border-8 border-yellow-200 shadow-2xl text-center">
              <div className="bg-white rounded-[32px] p-8 h-full w-full flex flex-col items-center">
                <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <Trophy size={48} className="text-yellow-500" />
                </div>
                <h2 className="text-3xl font-black text-gray-800 mb-2 uppercase tracking-tight">LİG ŞAMPİYONU!</h2>
                <p className="text-gray-500 font-bold mb-6">Önceki ligin {userGrade}. sınıflar birincisi belli oldu!</p>
                
                <div className="bg-gray-50 w-full rounded-2xl p-6 mb-8 border-2 border-gray-100 shadow-sm">
                  <div className="text-4xl font-black text-indigo-600 mb-2">{winnerPopup.name}</div>
                  <div className="flex items-center justify-center gap-2 text-yellow-500 font-bold text-xl">
                    <Award size={24} />
                    <span>{winnerPopup.score} XP</span>
                  </div>
                </div>
                
                <button onClick={closeWinnerPopup} className="w-full h-14 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all text-lg">
                  Tebrikler! (Kapat)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="relative z-10 max-w-md mx-auto min-h-screen pb-24 bg-slate-50">
        {/* Header */}
        <header className="px-6 py-4 flex justify-between items-center">
          {view === 'home' ? (
            <div className="flex items-center gap-3 cursor-pointer group w-full" onClick={() => navigate('home')}>
               <div className="w-16 h-16 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-white border border-slate-100 shrink-0">
                 <img src="https://lh3.googleusercontent.com/d/1ErIIJdTCjGKwvQ2fdXnWfbzb_-8ALIGe=w1000" alt="Osmanlı Secondary School Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
               </div>
               <span className="font-black text-2xl text-slate-800 whitespace-nowrap tracking-tight">Osmanlı Secondary School</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 bg-indigo-900 rounded-full flex items-center justify-center text-white shadow-md overflow-hidden cursor-pointer hover:scale-105 transition-transform" 
                onClick={() => setShowAvatarModal(true)} 
                title="Avatarı Değiştir"
              >
                <img src={getAvatarUrl(userAvatarSeed || username, levelInfo.level)} alt="avatar" className="w-full h-full" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-indigo-900 leading-tight">Lvl {levelInfo.level}</span>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold mt-0.5">
                  <Timer size={10} className="text-orange-500" />
                  <span>LİG SONU: {leagueTimeRemaining}</span>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="px-6">

        {/* Home View */}
        {view === 'home' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Action Buttons Row (Admin & Reset) */}
            <div className="flex justify-between items-center -mt-2 mb-2">
               <button onClick={() => setShowAdminModal(true)} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 px-3 py-2 rounded-lg" title="Admin Paneli">
                 <Lock size={14} />
                 <span>Admin</span>
               </button>
               <button onClick={() => setShowResetModal(true)} className="flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-rose-600 transition-colors bg-rose-50 px-3 py-2 rounded-lg" title="Profili Sıfırla">
                 <span>Sıfırla</span>
                 <Trash2 size={14} />
               </button>
            </div>

            {isAdmin && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-indigo-100 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <Layout size={16} />
                    <span className="tracking-wide">ÖĞRETMEN PANELİ</span>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mb-4 font-bold">Görüntülemek istediğiniz sınıf seviyesini seçin:</p>
                <div className="flex gap-2">
                  {[6, 7, 8].map(g => (
                    <button
                      key={g}
                      onClick={() => {
                        setUserGrade(g);
                        localStorage.setItem('nexus_student_grade', g.toString());
                        const profile = JSON.parse(localStorage.getItem('nexus_user_profile') || '{}');
                        profile.grade = g;
                        localStorage.setItem('nexus_user_profile', JSON.stringify(profile));
                      }}
                      className={`flex-1 py-2 rounded-xl font-black text-sm transition-colors ${userGrade === g ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {g}. Sınıf
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Greeting */}
            <div className="flex items-center gap-4">
              <div 
                onClick={() => setShowAvatarModal(true)}
                className={`w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-indigo-200 shadow-sm shrink-0 cursor-pointer hover:scale-105 transition-transform ${levelInfo.level >= 20 ? 'ring-4 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' : levelInfo.level >= 10 ? 'ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : ''}`}
                title="Avatarı Değiştir"
              >
                <img src={getAvatarUrl(userAvatarSeed || username, levelInfo.level)} alt="avatar" className="w-full h-full" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight truncate">Selam, {username}! 👋</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500 text-sm truncate">Bugün yeni bir şeyler keşfetmeye hazır mısın?</span>
                </div>
              </div>
            </div>

            {/* Progress Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                  <TrendingUp size={16} />
                  <span className="tracking-wide">İLERLEME DURUMU</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {streak > 0 && (
                    <div className="flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                      <Flame size={14} className={streak >= 3 ? "animate-pulse" : ""} />
                      <span>{streak} Seri</span>
                    </div>
                  )}
                  <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">
                    LEVEL {levelInfo.level}
                  </div>
                </div>
              </div>
              
              <div className="w-full bg-slate-100 rounded-full h-3 mb-3 overflow-hidden">
                <motion.div 
                  className="h-full bg-indigo-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${levelInfo.progressPercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                Ligin bitmesine <span className="font-semibold text-slate-700">{leagueTimeRemaining}</span> kaldı. Terfi etmek için <span className="font-semibold text-slate-700">{levelInfo.xpForNextLevel - levelInfo.currentXpInLevel} XP</span> daha kazanmalısın!
              </p>
            </div>

            {/* Active Curriculum Card */}
            <div className="bg-indigo-600 rounded-3xl p-6 shadow-md relative overflow-hidden text-white">
              <div className="absolute top-4 right-4 opacity-20">
                <GraduationCap size={80} />
              </div>
              <div className="relative z-10">
                <span className="bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-3">
                  AKTİF MÜFREDAT
                </span>
                <h2 className="text-3xl font-black mb-2">{userGrade}. Sınıf</h2>
                <p className="text-indigo-100 text-sm mb-6 max-w-[200px] leading-relaxed">
                  İngilizce odaklı haftalık program.
                </p>
                <button 
                  onClick={() => navigate('units', userGrade)}
                  className="bg-white text-indigo-600 font-bold py-3 px-6 rounded-full text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors"
                >
                  Üniteleri Gör <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => navigate('versusLobby')}
                className="bg-orange-200 rounded-3xl p-5 text-left flex flex-col justify-between aspect-square hover:bg-orange-300 transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-orange-600 shadow-sm mb-4">
                  <Zap size={20} className="fill-current" />
                </div>
                <div>
                  <h3 className="text-orange-900 font-black text-lg leading-tight mb-1">1v1 Yarışma</h3>
                  <p className="text-orange-800/70 text-[10px] font-bold tracking-wider uppercase">ŞİMDİ MEYDAN OKU</p>
                </div>
              </button>

              <button 
                onClick={() => navigate('units', userGrade)}
                className="bg-emerald-300 rounded-3xl p-5 text-left flex flex-col justify-between aspect-square hover:bg-emerald-400 transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm mb-4">
                  <Play size={20} className="fill-current ml-1" />
                </div>
                <div>
                  <h3 className="text-emerald-900 font-black text-lg leading-tight mb-1">Derslere Başla</h3>
                  <p className="text-emerald-800/70 text-[10px] font-bold tracking-wider uppercase">KALDIĞIN YERDEN</p>
                </div>
              </button>
            </div>

            {/* Word of the Day */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <BookOpen size={16} className="text-indigo-600" />
                  <span>GÜNÜN KELİMESİ</span>
                </div>
                {wordOfTheDay && (
                  <button 
                    onClick={() => {
                      const utterance = new SpeechSynthesisUtterance(wordOfTheDay.word_en);
                      utterance.lang = 'en-US';
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors"
                  >
                    <Volume2 size={16} />
                  </button>
                )}
              </div>
              
              {wordOfTheDay ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="text-2xl font-black text-slate-800">{wordOfTheDay.word_en}</h3>
                    <span className="text-slate-500 font-medium">({wordOfTheDay.word_tr})</span>
                  </div>
                  {wordOfTheDay.sentence_blank && (
                    <p className="text-slate-500 italic text-sm">
                      "{wordOfTheDay.sentence_blank.replace(/_+/g, wordOfTheDay.word_en)}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-16">
                  <Loader2 className="animate-spin text-slate-300" size={24} />
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-4 px-1">
                <div>
                  <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">YÜKSELEN YILDIZLAR</h3>
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-1 rounded-md w-fit">
                    <Timer size={12} />
                    <span>Lig Sonu: {leagueTimeRemaining}</span>
                  </div>
                </div>
                <button onClick={() => setShowLB(userGrade || 6)} className="text-indigo-600 font-bold text-xs hover:underline mb-1">Tümünü Gör</button>
              </div>
              
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {top3Leaderboard.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {top3Leaderboard.map((player, idx) => {
                      const playerLevel = calculateLevel(player.score).level;
                      const playerTitle = getUserTitle(playerLevel);
                      const TitleIcon = playerTitle.icon;
                      const avatarSeed = player.student_name === username ? (localStorage.getItem('nexus_avatar_seed') || username) : player.student_name;

                      let avatarRing = "";
                      if (playerLevel >= 20) avatarRing = "ring-4 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]";
                      else if (playerLevel >= 10) avatarRing = "ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]";

                      return (
                      <div key={idx} className={`flex items-center justify-between p-4 ${player.student_name === username ? 'bg-indigo-50/50' : ''}`}>
                        <div className="flex items-center gap-4">
                          <span className={`font-black w-4 text-center shrink-0 ${idx === 0 ? 'text-orange-500' : idx === 1 ? 'text-slate-400' : 'text-amber-600'}`}>
                            {idx + 1}
                          </span>
                          <div className={`w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${avatarRing}`}>
                             <img src={getAvatarUrl(avatarSeed, playerLevel)} alt="avatar" className="w-full h-full" />
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-bold text-sm ${player.student_name === username ? 'text-indigo-700' : 'text-slate-800'}`}>
                              {player.student_name === username ? 'Siz (' + player.student_name + ')' : player.student_name}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-black text-indigo-500">Lvl {playerLevel}</span>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 ${playerTitle.bg} ${playerTitle.color}`}>
                                <TitleIcon size={8} />
                                {playerTitle.title}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-indigo-600 text-sm">{player.score}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">XP</span>
                        </div>
                      </div>
                      );
                    })}
                    
                    {currentUserRank && currentUserRank.rank > 3 && (() => {
                      const playerLevel = calculateLevel(currentUserRank.score).level;
                      const playerTitle = getUserTitle(playerLevel);
                      const TitleIcon = playerTitle.icon;
                      const avatarSeed = localStorage.getItem('nexus_avatar_seed') || username;

                      let avatarRing = "";
                      if (playerLevel >= 20) avatarRing = "ring-4 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]";
                      else if (playerLevel >= 10) avatarRing = "ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]";

                      return (
                      <div className="flex items-center justify-between p-4 bg-indigo-50/50 border-t-2 border-indigo-100">
                        <div className="flex items-center gap-4">
                          <span className="font-black w-4 text-center text-indigo-400 shrink-0">
                            {currentUserRank.rank}
                          </span>
                          <div className={`w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${avatarRing}`}>
                             <img src={getAvatarUrl(avatarSeed, playerLevel)} alt="avatar" className="w-full h-full" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-indigo-700">
                              Siz ({currentUserRank.student_name})
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-black text-indigo-500">Lvl {playerLevel}</span>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 ${playerTitle.bg} ${playerTitle.color}`}>
                                <TitleIcon size={8} />
                                {playerTitle.title}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-indigo-600 text-sm">{currentUserRank.score}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">XP</span>
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 text-sm py-6">Henüz sıralama yok</div>
                )}
              </div>
            </div>

          </motion.div>
        )}

        {/* Units View */}
        {view === 'units' && grade && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex items-center gap-6 bg-white p-6 rounded-[40px] border border-white shadow-sm">
              <button onClick={() => navigate('home')} className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors"><ArrowLeft size={24} /></button>
              <div><h1 className="text-3xl md:text-5xl font-black tracking-tighter text-indigo-900">{grade}. Sınıf</h1><p className="text-indigo-600 font-bold uppercase text-[10px] tracking-widest">Müfredat Üniteleri</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => (
                <motion.div key={id} whileHover={{ scale: 1.02, y: -5 }} onClick={() => navigate('weekSelection', grade, id)} className="bg-white p-8 rounded-[48px] border border-white shadow-xl cursor-pointer group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-100 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl mb-8 shadow-lg group-hover:rotate-6 transition-transform">{id}</div>
                    <h3 className="text-2xl font-black text-indigo-900 mb-2 leading-tight">{unitNames[grade][id] || `Unit ${id}`}</h3>
                    <p className="text-indigo-600/60 font-bold text-[10px] uppercase tracking-widest mb-8">Unit {id}</p>
                    <div className="flex justify-between items-center text-indigo-600 font-black text-xs pt-6 border-t border-indigo-50">
                      <span>4 Hafta • Dinamik Veri</span>
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight size={20}/></div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Week Selection View */}
        {view === 'weekSelection' && grade && unitId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="bg-white p-8 rounded-[48px] border border-white shadow-xl flex flex-col md:flex-row items-center gap-8">
              <button onClick={() => navigate('units', grade)} className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors"><ArrowLeft size={24}/></button>
              <div className="text-center md:text-left"><span className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-[10px] font-black mb-3 inline-block uppercase tracking-widest">Ünite {unitId}</span><h1 className="text-3xl md:text-6xl font-black tracking-tighter text-indigo-900">{unitNames[grade][unitId]}</h1></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((w) => (
                <motion.div key={w} whileHover={{ y: -5 }} onClick={() => navigate('activitySelection', grade, unitId, w)} className="bg-white p-6 rounded-[40px] border border-white shadow-lg cursor-pointer flex flex-col items-center text-center group">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl mb-6 group-hover:scale-110 transition-transform">{w}</div>
                  <h3 className="text-lg font-bold text-indigo-900 mb-2">{w}. Hafta</h3>
                  <div className="mt-6 h-12 w-full flex items-center justify-center gap-2 text-indigo-600/40 font-black uppercase text-[10px] border-t border-indigo-50 group-hover:text-indigo-600 transition-colors">Aktiviteler <ChevronRight size={14}/></div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Versus Mode View */}
        {view === 'versusLobby' && userGrade && username && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <VersusMode 
              username={username} 
              grade={userGrade} 
              onBack={() => setView('home')} 
              onWin={handleVersusWin}
            />
          </motion.div>
        )}

        {/* Activity Selection View */}
        {view === 'activitySelection' && grade && unitId && weekId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('weekSelection', grade, unitId)} className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md text-indigo-600 hover:bg-indigo-50 transition-colors"><ArrowLeft size={24}/></button>
              <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-indigo-900">Aktivite Seç</h2>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50"><Loader2 className="animate-spin mb-4" size={48} /><p className="font-black uppercase tracking-widest text-sm">Kelimeler Yükleniyor...</p></div>
            ) : (
              <div className="space-y-12">
                {[
                  {
                    id: 'discover',
                    title: 'Keşfet & Tanı',
                    bgClass: 'bg-blue-50/50',
                    borderClass: 'border-blue-100',
                    headerClass: 'text-blue-600',
                    iconBg: 'bg-blue-50',
                    activities: [
                      { type: 'flashcards', title: 'Flashcard', icon: '📝', color: 'text-blue-600', btn: 'bg-blue-600' },
                      { type: 'synonyms', title: 'Synonyms', icon: '🔍', color: 'text-blue-500', btn: 'bg-blue-500' },
                      { type: 'collocations', title: 'Collocations', icon: '📐', color: 'text-blue-600', btn: 'bg-blue-600' }
                    ].filter(act => {
                      if (act.type === 'synonyms') {
                        return vocabulary.some(item => item.word_en && item.synonym_en && item.synonym_en.trim() !== '-' && item.synonym_en.trim() !== '');
                      }
                      if (act.type === 'collocations') {
                        return vocabulary.some(item => item.word_en && item.collocation_en && item.collocation_en.trim() !== '-' && item.collocation_en.trim() !== '');
                      }
                      return true;
                    })
                  },
                  {
                    id: 'apply',
                    title: 'Duy & Uygula',
                    bgClass: 'bg-purple-50/50',
                    borderClass: 'border-purple-100',
                    headerClass: 'text-purple-600',
                    iconBg: 'bg-purple-50',
                    activities: [
                      { type: 'listening', title: 'Dinle & Bul', icon: '🎧', color: 'text-purple-600', btn: 'bg-purple-600' },
                      { type: 'sentence_listen', title: 'Dinle & Sırala', icon: '🔊', color: 'text-purple-500', btn: 'bg-purple-500' },
                      { type: 'speaking', title: 'Konuş & Kazan', icon: '🎙️', color: 'text-purple-600', btn: 'bg-purple-600' }
                    ]
                  },
                  {
                    id: 'prove',
                    title: 'Bilgini Kanıtla',
                    bgClass: 'bg-orange-50/50',
                    borderClass: 'border-orange-100',
                    headerClass: 'text-orange-600',
                    iconBg: 'bg-orange-50',
                    activities: [
                      { type: 'sentences', title: 'Blanks', icon: '🖋️', color: 'text-orange-600', btn: 'bg-orange-600' },
                      { type: 'quiz', title: 'Quiz', icon: '📊', color: 'text-orange-500', btn: 'bg-orange-500' },
                      { type: 'sentence_translate', title: 'Çevir & Sırala', icon: '🧩', color: 'text-orange-600', btn: 'bg-orange-600' }
                    ].filter(act => {
                      if (act.type === 'sentences') {
                        return vocabulary.some(item => item.sentence_blank && item.word_en);
                      }
                      return true;
                    })
                  }
                ].map((category, catIndex, allCats) => {
                  // Calculate progress for this category
                  const completedCount = category.activities.filter(act => localStorage.getItem(`nexus_completed_${unitId}_${weekId}_${act.type}`)).length;
                  const progress = category.activities.length > 0 ? Math.round((completedCount / category.activities.length) * 100) : 100;
                  
                  // Calculate progress for previous category to determine if locked
                  let isLocked = false;
                  if (catIndex > 0 && !isAdmin) {
                    const prevCat = allCats[catIndex - 1];
                    const prevCompleted = prevCat.activities.filter(act => localStorage.getItem(`nexus_completed_${unitId}_${weekId}_${act.type}`)).length;
                    const prevProgress = prevCat.activities.length > 0 ? (prevCompleted / prevCat.activities.length) * 100 : 100;
                    if (prevProgress < 70 && vocabulary.length > 0) {
                      isLocked = true;
                    }
                  }

                  // Determine progress bar color
                  let barColor = 'bg-red-500';
                  if (progress >= 71) barColor = 'bg-green-500';
                  else if (progress >= 31) barColor = 'bg-orange-500';

                  return (
                    <div key={category.id} className={`p-6 md:p-8 rounded-[40px] border ${category.borderClass} ${category.bgClass} relative overflow-hidden`}>
                      {isLocked && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-[40px]">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <span className="text-3xl">🔒</span>
                          </div>
                          <p className="font-black text-gray-600 uppercase tracking-widest text-sm text-center px-4">
                            Önceki kategoriyi %70 tamamlamalısın
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <h3 className={`text-2xl font-black ${category.headerClass} tracking-tight`}>{category.title}</h3>
                        <div className="flex items-center gap-4 w-full md:w-64">
                          <div className="flex-1 h-3 bg-white rounded-full overflow-hidden shadow-inner border border-gray-100">
                            <motion.div 
                              className={`h-full ${barColor} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1 }}
                            />
                          </div>
                          <span className={`font-black text-sm ${category.headerClass}`}>%{progress}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {category.activities.map(item => {
                          const isCompleted = localStorage.getItem(`nexus_completed_${unitId}_${weekId}_${item.type}`);
                          return (
                            <motion.div key={item.type} whileHover={!isLocked ? { scale: 1.05 } : {}} className={`bg-white rounded-[32px] p-6 border border-white shadow-xl flex flex-col items-center text-center relative ${isLocked ? 'opacity-50' : ''}`}>
                              {isCompleted && (
                                <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-md z-10">
                                  ✓
                                </div>
                              )}
                              <div className={`h-24 w-full rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-inner ${category.iconBg}`}>{item.icon}</div>
                              <h4 className={`text-xs font-black ${item.color} mb-6 uppercase tracking-widest`}>{item.title}</h4>
                              <button 
                                disabled={isLocked}
                                onClick={() => navigate('activity', grade, unitId, weekId, item.type)} 
                                className={`w-full h-12 rounded-xl ${item.btn} text-white font-black shadow-md uppercase active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                Başla
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Activity View */}
        {view === 'activity' && grade && unitId && weekId && activeMode && (
          <div className="animate-in fade-in">
            {activityResult ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto bg-white p-12 rounded-[56px] shadow-2xl border-8 border-indigo-50 text-center">
                <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-xl border-4 border-white rotate-3 ${activityResult.failed ? 'bg-red-100' : 'bg-indigo-600'}`}>
                  {activityResult.failed ? <X size={48} className="text-red-500"/> : <Trophy size={48} className="text-orange-400"/>}
                </div>
                <h2 className={`text-4xl font-black mb-8 tracking-tighter ${activityResult.failed ? 'text-red-600' : 'text-indigo-900'}`}>
                  {activityResult.failed ? 'Başarısız' : 'Tebrikler!'}
                </h2>
                
                {activityResult.limited && (
                  <div className="bg-orange-50 text-orange-600 p-4 rounded-2xl mb-6 font-bold text-sm border border-orange-100">
                    Bugün bu etkinlikten puanını aldın, yarın tekrar gel!
                  </div>
                )}

                {activityResult.failed && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 font-bold text-sm border border-red-100">
                    {activityResult.message}
                  </div>
                )}

                <div className="bg-indigo-50 p-8 rounded-[40px] mb-10 flex flex-col gap-6 border border-indigo-100 shadow-inner">
                  <div className="flex justify-between items-center"><span className="text-indigo-600/60 font-black uppercase text-[10px] tracking-widest">{activityResult.failed ? 'Doğru Yanıt' : 'Doğru Yanıt'}</span><span className="text-4xl font-black text-indigo-800">{activityResult.total}</span></div>
                  <div className="flex justify-between items-center"><span className="text-indigo-600/60 font-black uppercase text-[10px] tracking-widest">Hata Sayısı</span><span className="text-4xl font-black text-orange-600">{activityResult.errors}</span></div>
                  {!activityResult.failed && <div className="flex justify-between items-center"><span className="text-indigo-600/60 font-black uppercase text-[10px] tracking-widest">Kazanılan</span><span className="text-4xl font-black text-orange-500">+{activityResult.score} XP</span></div>}
                </div>
                <button onClick={() => navigate('activitySelection', grade, unitId, weekId)} className="w-full h-16 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Listeye Dön</button>
              </motion.div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <button onClick={() => navigate('activitySelection', grade, unitId, weekId)} className="flex items-center h-12 gap-2 font-black bg-white px-6 rounded-full border border-indigo-100 text-indigo-600 text-[10px] uppercase shadow-sm hover:bg-indigo-50 transition-all"><ArrowLeft size={16}/> Sonlandır</button>
                  <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">{activeMode}</div>
                </div>
                <div className="py-4">
                  {activeMode === 'listening' && <ListeningActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'speaking' && <SpeakingActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'flashcards' && <FlashcardActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'synonyms' && <MatchingActivity data={vocabulary} leftKey="word_en" rightKey="synonym_en" onFinish={handleFinish} />}
                  {activeMode === 'collocations' && <MatchingActivity data={vocabulary} leftKey="word_en" rightKey="collocation_en" onFinish={handleFinish} />}
                  {activeMode === 'sentences' && <FillBlanksActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'quiz' && <QuizActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'sentence_listen' && <SentenceArrangeActivity data={sentences} onFinish={handleFinish} mode="listen" />}
                  {activeMode === 'sentence_translate' && <SentenceArrangeActivity data={sentences} onFinish={handleFinish} mode="translate" />}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
