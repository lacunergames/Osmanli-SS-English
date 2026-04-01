/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChevronRight, ArrowLeft, Trophy,
  GraduationCap, Award, Library, X, Loader2,
  Sparkles, BookOpen, Zap, Target, Layout,
  Lock, AlertTriangle, Trash2, Volume2
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import VersusMode from './components/VersusMode';

// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xtugvvlfxljvkabcddxm.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dWd2dmxmeGxqdmthYmNkZHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY2MDMsImV4cCI6MjA4Nzk2MjYwM30.E6mfkZrSRwUbcTKCMDrg5izmDfn7Y1aD-Ij0cFOLuxU";

// Geçersiz URL hatasını önlemek için kontrol
const isConfigured = SUPABASE_URL && SUPABASE_URL.startsWith('http');
const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);

// ==========================================
// 3. GAME ENGINES
// ==========================================

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

  if (!currentWord) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto space-y-5">
      <div className="w-full flex justify-between bg-white/50 p-4 rounded-xl border border-emerald-200 shadow-sm text-sm font-bold">
        <span className="text-emerald-700">Kalan: {queue.length - currentIndex}</span>
        <span className="text-orange-600">Hata: {errors}</span>
      </div>
      <div className="w-full h-80 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)} style={{ perspective: '1500px' }}>
        <motion.div 
          className="relative w-full h-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 bg-white text-emerald-700 rounded-[40px] flex flex-col items-center justify-center border-4 border-emerald-50 shadow-lg p-8" style={{ backfaceVisibility: 'hidden' }}>
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
            <button onClick={(e) => { e.stopPropagation(); handleNext(true); }} className="flex-1 bg-emerald-600 text-white h-14 rounded-2xl font-bold hover:bg-emerald-700 transition-colors">Biliyorum</button>
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
  const currentChunk = chunks[currentChunkIndex] || [];

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
      <div className="flex justify-between bg-white/50 p-4 rounded-xl border border-emerald-200 font-bold text-sm">
        {chunks.length > 1 && <span className="text-emerald-700">Aşama: {currentChunkIndex + 1} / {chunks.length}</span>}
        <span className="text-emerald-700">Doğru: {matchedIds.length / 2} / {currentChunk.length}</span>
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
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-3xl border-4 border-emerald-100 z-10"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles size={40} className="text-emerald-600 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-emerald-800 mb-2">Harika Gidiyorsun!</h3>
              <p className="text-emerald-600 font-bold">Bir sonraki aşama hazırlanıyor...</p>
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
                          ? (isError ? 'bg-orange-500 text-white border-orange-600' : 'bg-emerald-600 text-white border-emerald-700') 
                          : 'bg-white border-emerald-100 shadow-sm hover:border-emerald-300'
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
                          ? (isError ? 'bg-orange-500 text-white border-orange-600' : 'bg-emerald-600 text-white border-emerald-700') 
                          : 'bg-white border-emerald-100 shadow-sm hover:border-emerald-300'
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
      <div className="flex justify-between bg-white/50 p-4 rounded-xl border border-emerald-200 font-bold text-sm">
        <span className="text-emerald-700">Doğru: {correct} / Yanlış: {errors}</span>
      </div>
      <div className="bg-white p-8 rounded-[40px] border-4 border-emerald-50 text-center shadow-lg">
        <p className="text-xl md:text-2xl font-black text-gray-800 leading-relaxed mb-10">
          {current.sentence_blank && typeof current.sentence_blank === 'string' ? (
            current.sentence_blank.split('___').map((p: string, i: number, a: string[]) => (
              <React.Fragment key={i}>{p}{i < a.length - 1 && <span className={`inline-block border-b-4 mx-2 min-w-[100px] transition-colors ${ans ? (ans === current.word_en ? 'border-emerald-500 text-emerald-600' : 'border-orange-500 text-orange-600') : 'border-emerald-200'}`}>{ans ? current.word_en : '____'}</span>}</React.Fragment>
            ))
          ) : (
            <span className="text-orange-500">Cümle verisi bulunamadı.</span>
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {options.map((o: string, i: number) => (
            <button key={i} disabled={!!ans} onClick={() => select(o)} className={`h-14 rounded-2xl font-bold border-2 transition-all ${ans ? (o === current.word_en ? 'bg-emerald-600 text-white border-emerald-700' : o === ans ? 'bg-orange-500 text-white border-orange-600' : 'opacity-20 border-transparent') : 'bg-white border-emerald-100 hover:border-emerald-300'}`}>{o}</button>
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

  if (!current) return null;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex justify-between bg-white/50 p-4 rounded-xl border border-emerald-200 font-bold text-sm">
        <span>Soru: {index + 1} / {queue.length}</span>
        <span className={time < 4 ? 'text-orange-600 animate-pulse' : 'text-emerald-700'}>Süre: {time}s</span>
      </div>
      <div className="w-full h-3 bg-white/50 rounded-full border border-emerald-100 overflow-hidden">
        <motion.div className={`h-full ${time < 4 ? 'bg-orange-500' : 'bg-emerald-500'}`} initial={{ width: "100%" }} animate={{ width: `${(time / 10) * 100}%` }} transition={{ duration: 1, ease: "linear" }} />
      </div>
      <div className="bg-white p-10 rounded-[40px] border-4 border-emerald-50 text-center shadow-lg space-y-10">
        <h2 className="text-4xl md:text-6xl font-black text-emerald-800 tracking-tight">{current.word_en}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {opts.map((o, i) => (
            <button key={i} disabled={!!ans} onClick={() => handle(o)} className={`h-14 rounded-2xl font-bold border-2 transition-all ${ans ? (o === current.word_tr ? 'bg-emerald-600 text-white border-emerald-700' : o === ans ? 'bg-orange-500 text-white border-orange-600' : 'opacity-20 border-transparent') : 'bg-white border-emerald-100 hover:border-emerald-300'}`}>{o}</button>
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

      if (!supabase) {
        if (isMounted) {
          setErrorMsg("Veritabanı bağlantısı kurulamadı.");
          setLoading(false);
        }
        return;
      }
      
      const timeoutId = setTimeout(() => {
        console.error('TIMEOUT: Leaderboard sorgusu 5 saniyeyi aştı!');
        if (isMounted) {
          setLoading(false);
          setScores([]);
          setErrorMsg("Bağlantı zaman aşımına uğradı. Lütfen internetinizi kontrol edin.");
        }
      }, 5000);

      try {
        setLoading(true);
        setErrorMsg(null);
        console.log('2. Supabase leaderboard sorgusu başlatılıyor...', { grade });
        const { data, error } = await supabase
          .from('leaderboards')
          .select('*')
          .eq('grade_level', grade)
          .order('score', { ascending: false })
          .limit(10);
          
        console.log('3. Supabase leaderboard yanıtı geldi.', { data, error });

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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-[32px] p-8 border-4 border-emerald-50 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={20} /></button>
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg border-2 border-white rotate-3"><Trophy size={32} className="text-white" /></div>
          <h2 className="text-2xl md:text-3xl font-black text-emerald-900 tracking-tighter text-center">{grade}. Sınıf Şampiyonları</h2>
        </div>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-50"><Loader2 className="animate-spin mb-2" size={32} /><p className="font-bold text-sm">Yükleniyor...</p></div>
          ) : errorMsg ? (
            <div className="text-center p-6 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200"><p className="font-bold text-rose-600">{errorMsg}</p></div>
          ) : scores.length === 0 ? (
            <div className="text-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-emerald-100">
              <p className="font-bold text-gray-400">Henüz bu sınıfta puan alan yok, ilk sen ol!</p>
            </div>
          ) : (
            scores.map((s, i) => (
              <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400'}`}>{i+1}</span>
                  <span className="font-bold text-gray-700 truncate max-w-[150px]">{s.student_name}</span>
                </div>
                <span className="font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-sm">{s.score} XP</span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

const NoDataView = ({ onBack, message = "Bu aktivite için içerik henüz eklenmedi. Diğer aktiviteleri deneyebilirsin." }: { onBack: any, message?: string }) => (
  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto bg-white p-12 rounded-[56px] shadow-2xl border-8 border-emerald-50 text-center">
    <div className="w-24 h-24 bg-orange-100 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-xl border-4 border-white rotate-3"><Sparkles size={48} className="text-orange-500"/></div>
    <h2 className="text-3xl font-black mb-4 tracking-tighter text-emerald-900">Yakında Burada!</h2>
    <p className="text-emerald-600/60 font-bold mb-8">{message}</p>
    <button onClick={onBack} className="w-full h-16 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 active:scale-95 transition-all">Geri Dön</button>
  </motion.div>
);

// ==========================================
// 5. MAIN APP
// ==========================================

const UserRegistrationModal = ({ onRegister }: { onRegister: (name: string, grade: number) => void }) => {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number>(6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length > 2) {
      onRegister(name.trim(), grade);
    }
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
      <div className="bg-white w-full max-w-md rounded-[40px] p-10 border-8 border-emerald-50 shadow-2xl text-center mx-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
          <Sparkles size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-3xl font-black text-emerald-900 mb-2 tracking-tighter">Hoş Geldin!</h2>
        <p className="text-emerald-600/80 font-bold text-sm mb-8">Başlamak için bilgilerini gir.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-black text-emerald-800 uppercase tracking-widest mb-2 ml-2">Adın ve Soyadın</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Örn: Ali Yılmaz"
              className="w-full h-14 px-6 rounded-2xl bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-500 focus:outline-none font-bold text-emerald-900 placeholder:text-emerald-300 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-black text-emerald-800 uppercase tracking-widest mb-2 ml-2">Sınıfın</label>
            <select 
              value={grade} 
              onChange={(e) => setGrade(Number(e.target.value))}
              className="w-full h-14 px-6 rounded-2xl bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-500 focus:outline-none font-bold text-emerald-900 transition-colors appearance-none cursor-pointer"
            >
              <option value={6}>6. Sınıf</option>
              <option value={7}>7. Sınıf</option>
              <option value={8}>8. Sınıf</option>
            </select>
          </div>
          <button type="submit" disabled={name.trim().length < 3} className="w-full h-16 mt-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all uppercase tracking-widest">
            Kaydet ve Başla
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('home'); 
  const [grade, setGrade] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [weekId, setWeekId] = useState<number | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [activityResult, setActivityResult] = useState<any>(null);
  const [showLB, setShowLB] = useState<number | null>(null); 
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
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
  const [showRegistration, setShowRegistration] = useState(!username);
  
  // Supabase'den çekilen kelimeler
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // NEW STATES for Home Screen
  const [wordOfTheDay, setWordOfTheDay] = useState<any>(null);
  const [top3Leaderboard, setTop3Leaderboard] = useState<any[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<any>(null);

  // Fetch Word of the Day and Top 3 Leaderboard
  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      if (!userGrade || !supabase || view !== 'home') return;
      
      try {
        // Fetch All for accurate ranking
        const { data: lbData, error: lbError } = await supabase
          .from('leaderboards')
          .select('*')
          .eq('grade_level', userGrade)
          .order('score', { ascending: false });
          
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
        const { data: vocabData, error: vocabError } = await supabase
          .from('vocabulary_master')
          .select('*')
          .eq('grade_level', userGrade)
          .limit(50);
          
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
  }, [userGrade, view]);

  // Ünite İsimleri (Görsel amaçlı)
  const unitNames: any = {
    6: { 5: "At the Fair", 6: "Occupations", 7: "Holidays", 8: "Bookworms", 9: "Saving the Planet" },
    7: { 5: "Television", 6: "Celebrations", 7: "Dreams", 8: "Public Buildings", 9: "Environment" },
    8: { 5: "The Internet", 6: "Adventures", 7: "Tourism", 8: "Chores", 9: "Science" }
  };

  // Fetch initial score if user exists
  useEffect(() => {
    let isMounted = true;
    const fetchUserScore = async () => {
      if (!username || !userGrade || !supabase) return;
      
      try {
        const { data, error } = await supabase
          .from('leaderboards')
          .select('score')
          .eq('student_name', username)
          .eq('grade_level', userGrade)
          .single();
          
        if (error) {
          if (error.code !== 'PGRST116') {
            console.error("Score fetch error:", error);
          }
          return;
        }
        
        if (data && isMounted) {
          setTotalScore(data.score);
          localStorage.setItem('nexus_total_score', data.score.toString());
        }
      } catch (err) {
        console.error("Unexpected error fetching score:", err);
      }
    };
    fetchUserScore();
    return () => { isMounted = false; };
  }, [username, userGrade]);

  const handleRegister = async (name: string, gradeLevel: number) => {
    try {
      // 1. LocalStorage'ı güvenli bir şekilde güncelle
      const userProfile = { username: name, grade: gradeLevel, score: 0 };
      localStorage.setItem('nexus_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('nexus_student_name', name);
      localStorage.setItem('nexus_student_grade', gradeLevel.toString());
      localStorage.setItem('nexus_total_score', '0');
      
      // 2. Supabase işlemlerini yap (Eğer varsa)
      if (supabase) {
        const { data, error } = await supabase
          .from('leaderboards')
          .select('score')
          .eq('student_name', name)
          .eq('grade_level', gradeLevel)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error("Kayıt kontrol hatası:", error);
        }
          
        if (data) {
          const updatedProfile = { username: name, grade: gradeLevel, score: data.score };
          localStorage.setItem('nexus_user_profile', JSON.stringify(updatedProfile));
          localStorage.setItem('nexus_total_score', data.score.toString());
          setTotalScore(data.score);
        } else {
          // Insert new user with 0 score
          const { error: insertError } = await supabase.from('leaderboards').insert([{ 
            student_name: name, 
            score: 0, 
            grade_level: gradeLevel 
          }]);
          if (insertError) {
            console.error("Kullanıcı oluşturma hatası:", insertError);
          }
          setTotalScore(0);
        }
      } else {
        setTotalScore(0);
      }
    } catch (err) {
      console.error("Beklenmeyen kayıt hatası:", err);
    } finally {
      setUsername(name);
      setUserGrade(gradeLevel);
      setShowRegistration(false);
      setView('home');
    }
  };

  const handleResetProfile = async () => {
    try {
      if (supabase && username && userGrade) {
        await supabase
          .from('leaderboards')
          .delete()
          .eq('student_name', username)
          .eq('grade_level', userGrade);
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

    // Acil Çıkış Kapısı (Timeout Fallback) - 5 saniye
    const timeoutId = setTimeout(() => {
      console.error('TIMEOUT: Supabase sorgusu 5 saniyeyi aştı!');
      setLoading(false);
      setVocabulary([]);
      setFetchErrorMsg("Bağlantı zaman aşımına uğradı. Lütfen internetinizi kontrol edin.");
    }, 5000);

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

    if (!supabase) {
      setVocabulary([]);
      setFetchErrorMsg("Veritabanı bağlantısı kurulamadı.");
      clearTimeout(timeoutId);
      setLoading(false);
      return;
    }

    // Adım 2: Basit try-catch-finally bloğu
    try {
      const { data, error } = await supabase
        .from('vocabulary_master')
        .select('*')
        .eq('grade_level', safeGrade)
        .eq('unit_no', safeUnitId)
        .eq('week_no', safeWeekId);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        setVocabulary([]);
        setFetchErrorMsg("Bu haftaya ait içerik bulunamadı.");
      } else {
        setVocabulary(data);
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
    if (g !== null && userGrade !== null && g !== userGrade) {
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

  const handleFinish = async (errors: number, correct: number) => {
    // 1. Puan Hesaplama
    let earnedScore = 0;
    if (activeMode === 'synonyms' || activeMode === 'collocations') {
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

    if (hasCompletedToday) {
      alert("Bugün bu etkinlikten puanını aldın, yarın tekrar gel!");
      setActivityResult({ errors, total: correct, score: 0, limited: true });
      return;
    }

    // 3. Puan Ekleme ve Kaydetme
    setActivityResult({ errors, total: correct, score: earnedScore, limited: false });
    
    // Kullanıcıya bilgi ver
    if (activeMode !== 'flashcards') {
      alert(`Oyun Bitti! Hata Sayın: ${errors}, Kazandığın Puan: ${earnedScore}`);
    }
    
    if (earnedScore > 0 && username && userGrade && supabase) {
      localStorage.setItem(activityKey, 'true');
      
      try {
        // Önce veritabanından mevcut puanı çek
        const { data, error } = await supabase
          .from('leaderboards')
          .select('score')
          .eq('student_name', username)
          .eq('grade_level', userGrade)
          .single();
          
        let currentDbScore = 0;
        if (!error && data) {
          currentDbScore = data.score;
        } else if (error && error.code !== 'PGRST116') {
          console.error("Mevcut puan çekilemedi:", error);
          return; // Hata varsa güncelleme yapma
        }

        const newTotal = currentDbScore + earnedScore;
        
        // Supabase'i güncelle
        const { error: updateError } = await supabase
          .from('leaderboards')
          .update({ score: newTotal })
          .eq('student_name', username)
          .eq('grade_level', userGrade);
          
        if (!updateError) {
          setTotalScore(newTotal);
          localStorage.setItem('nexus_total_score', newTotal.toString());
        } else {
          console.error("Puan güncellenemedi:", updateError);
        }
      } catch (err) {
        console.error("Puan ekleme sırasında beklenmeyen hata:", err);
      }
    }
  };

  const handleVersusWin = async (earnedScore: number) => {
    if (earnedScore > 0 && username && userGrade && supabase) {
      try {
        const { data, error } = await supabase
          .from('leaderboards')
          .select('score')
          .eq('student_name', username)
          .eq('grade_level', userGrade)
          .single();
          
        let currentDbScore = 0;
        if (!error && data) {
          currentDbScore = data.score;
        } else if (error && error.code !== 'PGRST116') {
          console.error("Mevcut puan çekilemedi:", error);
          return;
        }

        const newTotal = currentDbScore + earnedScore;
        
        const { error: updateError } = await supabase
          .from('leaderboards')
          .update({ score: newTotal })
          .eq('student_name', username)
          .eq('grade_level', userGrade);
          
        if (!updateError) {
          setTotalScore(newTotal);
          localStorage.setItem('nexus_total_score', newTotal.toString());
        } else {
          console.error("Puan güncellenemedi:", updateError);
        }
      } catch (err) {
        console.error("Puan ekleme sırasında beklenmeyen hata:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-emerald-100 text-gray-800 font-sans selection:bg-emerald-200">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4)_0%,transparent_50%)] pointer-events-none"></div>
      
      {showRegistration && <UserRegistrationModal onRegister={handleRegister} />}
      {showLB && <LeaderboardModal grade={showLB} onClose={() => setShowLB(null)} />}

      <AnimatePresence>
        {showGuardModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-md rounded-[40px] p-8 border-8 border-orange-50 shadow-2xl text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3"><AlertTriangle size={40} className="text-orange-600" /></div>
              <h2 className="text-2xl font-black text-emerald-900 mb-4">🛑 Erişim Engellendi!</h2>
              <p className="text-emerald-700 font-bold mb-8">Sadece kendi sınıf düzeyindeki etkinliklere katılabilirsin. Kendi sınıfının maceralarına dönmeye ne dersin?</p>
              <button onClick={() => { setShowGuardModal(false); navigate('home'); }} className="w-full h-14 bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-700 transition-all">Sınıfıma Dön</button>
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

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md rounded-3xl border border-white px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 shadow-sm">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('home')}>
             <img src="https://lh3.googleusercontent.com/d/1ErIIJdTCjGKwvQ2fdXnWfbzb_-8ALIGe" alt="Osmanlı Secondary School Logo" className="w-12 h-12 object-contain rounded-full shadow-md group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = 'https://drive.google.com/thumbnail?id=1ErIIJdTCjGKwvQ2fdXnWfbzb_-8ALIGe&sz=w500'; }} />
             <span className="font-black text-xl tracking-tighter uppercase text-emerald-900">Osmanlı Secondary School</span>
          </div>
          
          {username && (
            <div className="flex items-center gap-2 bg-emerald-50 p-1.5 rounded-full border border-emerald-100 shadow-sm">
               <button onClick={() => setShowResetModal(true)} className="flex items-center gap-1 bg-rose-100 text-rose-600 px-3 py-1.5 rounded-full hover:bg-rose-200 transition-colors mr-2">
                 <Trash2 size={14} />
                 <span className="text-xs font-black">Sıfırla</span>
               </button>
               <div className="bg-white px-4 py-2 rounded-full flex items-center gap-2 shadow-sm">
                 <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] text-emerald-700 font-black">{userGrade}</div>
                 <span className="text-xs font-bold text-emerald-900 truncate max-w-[120px]">{username}</span>
               </div>
               <div className="bg-orange-500 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm text-white">
                 <Award size={14} />
                 <span className="text-xs font-black">{totalScore} XP</span>
               </div>
            </div>
          )}
        </header>

        {/* Home View */}
        {view === 'home' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="w-full bg-[#116A46] rounded-[48px] p-6 md:p-10 border-8 border-white shadow-2xl relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
              
              <div className="relative z-10 space-y-6">
                {/* Header inside card */}
                <div>
                  <span className="bg-[#F97316] font-black px-4 py-1.5 rounded-full text-[10px] md:text-xs uppercase tracking-widest inline-block mb-4">
                    Osmanlı Secondary School
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter">Selam {username},</h1>
                </div>

                {/* Grid for Word of the Day & Leaderboard */}
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {/* Word of the Day */}
                  <div className="bg-[#1A7A55] rounded-3xl p-4 md:p-6 border border-emerald-600/50 shadow-inner flex flex-col justify-center">
                    <h3 className="text-emerald-100 font-bold text-xs md:text-sm mb-2 md:mb-4">Günün Kelimesi</h3>
                    {wordOfTheDay ? (
                      <>
                        <div className="flex items-start justify-between gap-1 mb-1 md:mb-2">
                          <h2 className="text-lg sm:text-xl md:text-3xl font-black tracking-tight break-words leading-tight line-clamp-2">{wordOfTheDay.word_en}</h2>
                          <button 
                            onClick={() => {
                              const utterance = new SpeechSynthesisUtterance(wordOfTheDay.word_en);
                              utterance.lang = 'en-US';
                              window.speechSynthesis.speak(utterance);
                            }}
                            className="p-1.5 md:p-2 bg-emerald-700/50 rounded-full hover:bg-emerald-600 transition-colors shrink-0 mt-0.5"
                          >
                            <Volume2 size={16} className="text-white md:w-6 md:h-6" />
                          </button>
                        </div>
                        <p className="text-emerald-100 font-medium text-xs md:text-base mb-1 md:mb-4 truncate">{wordOfTheDay.word_tr}</p>
                        {wordOfTheDay.sentence_blank && (
                          <p className="text-[10px] md:text-sm text-emerald-50/80 italic leading-tight line-clamp-3">
                            {wordOfTheDay.sentence_blank.replace(/_+/g, wordOfTheDay.word_en)}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-24">
                        <Loader2 className="animate-spin text-emerald-300" size={24} />
                      </div>
                    )}
                  </div>

                  {/* Leaderboard Top 3 */}
                  <div className="bg-[#1A7A55] rounded-3xl p-4 md:p-6 border border-emerald-600/50 shadow-inner flex flex-col">
                    <h3 className="text-yellow-400 font-black text-sm md:text-base mb-2 md:mb-4 tracking-wide flex items-center gap-1.5">
                      ⭐ Rising Stars
                    </h3>
                    <div className="space-y-2 md:space-y-3 flex-1">
                      {top3Leaderboard.length > 0 ? (
                        top3Leaderboard.map((player, idx) => (
                          <div key={idx} className={`flex items-center justify-between p-2 md:p-3 rounded-2xl ${player.student_name === username ? 'bg-emerald-600/50 border border-emerald-500/50' : ''}`}>
                            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 pr-2">
                              <span className={`font-black text-sm md:text-lg shrink-0 ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : 'text-orange-300'}`}>
                                {idx + 1}
                              </span>
                              <span className="font-bold text-white text-xs md:text-base break-words leading-tight">
                                {player.student_name} {player.student_name === username && '(Sen)'}
                              </span>
                            </div>
                            <span className="text-[10px] md:text-xs font-black text-emerald-100 bg-emerald-800/50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shrink-0">
                              {player.score} XP
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-emerald-200/60 text-xs md:text-sm py-4">Henüz sıralama yok</div>
                      )}

                      {currentUserRank && (
                        <>
                          <div className="w-full h-px bg-emerald-500/30 my-2"></div>
                          <div className="flex items-center justify-between p-2 md:p-3 rounded-2xl bg-emerald-600/50 border border-emerald-500/50">
                            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 pr-2">
                              <span className="font-black text-sm md:text-lg shrink-0 text-emerald-200">
                                {currentUserRank.rank}
                              </span>
                              <span className="font-bold text-white text-xs md:text-base break-words leading-tight">
                                {currentUserRank.student_name} (Sen)
                              </span>
                            </div>
                            <span className="text-[10px] md:text-xs font-black text-emerald-100 bg-emerald-800/50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shrink-0">
                              {currentUserRank.score} XP
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-4 mt-6">
                  <button 
                    onClick={() => navigate('units', userGrade)} 
                    className="w-full h-16 bg-[#2A4365] text-white font-black text-xl rounded-2xl shadow-xl hover:bg-[#1E3A8A] active:scale-95 transition-all"
                  >
                    Öğrenmeye Devam Et
                  </button>
                  <button 
                    onClick={() => setView('versusLobby')} 
                    className="w-full py-4 bg-[#F97316] text-white rounded-2xl shadow-xl border-b-4 border-[#C2410C] hover:bg-[#EA580C] active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <div className="flex items-center gap-2 font-black text-xl">
                      <Target size={24} /> 1v1 Yarışma
                    </div>
                    <span className="text-xs font-bold opacity-90">Çevrimiçi biriyle eşleş ve yarış</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[6, 7, 8].map(g => {
                const isLocked = userGrade !== null && g !== userGrade;
                return (
                <motion.div key={g} whileHover={!isLocked ? { y: -5 } : {}} className={`bg-white rounded-[40px] p-6 border border-white shadow-xl relative group transition-all ${isLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                  {isLocked && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/20 backdrop-blur-[1px] rounded-[40px]">
                      <div className="bg-gray-800/80 p-4 rounded-2xl shadow-2xl rotate-12">
                        <Lock className="text-white" size={32} />
                      </div>
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setShowLB(g); }} className={`absolute top-6 right-6 z-20 bg-emerald-50 p-3 rounded-full text-orange-500 hover:scale-110 active:scale-90 transition-transform shadow-sm ${isLocked ? 'hidden' : ''}`}><Trophy size={22}/></button>
                  <div onClick={() => !isLocked && navigate('units', g)} className="cursor-pointer space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">{g === 6 ? <GraduationCap size={32}/> : g === 7 ? <Library size={32}/> : <Award size={32}/>}</div>
                    <div><h3 className="text-4xl font-black tracking-tighter text-emerald-900">{g}. Sınıf</h3><p className="text-emerald-600/60 font-bold text-xs uppercase mt-1">{isLocked ? 'Erişim Kilitli' : 'Middle School English'}</p></div>
                    <div className={`h-14 w-full rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors ${isLocked ? 'bg-gray-300 text-gray-500' : 'bg-emerald-600 text-white group-hover:bg-emerald-700'}`}>Üniteleri Gör <ChevronRight size={18}/></div>
                  </div>
                </motion.div>
              )})}
            </div>
          </motion.div>
        )}

        {/* Units View */}
        {view === 'units' && grade && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex items-center gap-6 bg-white p-6 rounded-[40px] border border-white shadow-sm">
              <button onClick={() => navigate('home')} className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"><ArrowLeft size={24} /></button>
              <div><h1 className="text-3xl md:text-5xl font-black tracking-tighter text-emerald-900">{grade}. Sınıf</h1><p className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest">Müfredat Üniteleri</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[5, 6, 7, 8, 9].map((id) => (
                <motion.div key={id} whileHover={{ scale: 1.02, y: -5 }} onClick={() => navigate('weekSelection', grade, id)} className="bg-white p-8 rounded-[48px] border border-white shadow-xl cursor-pointer group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:bg-emerald-100 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl mb-8 shadow-lg group-hover:rotate-6 transition-transform">{id}</div>
                    <h3 className="text-2xl font-black text-emerald-900 mb-2 leading-tight">{unitNames[grade][id] || `Unit ${id}`}</h3>
                    <p className="text-emerald-600/60 font-bold text-[10px] uppercase tracking-widest mb-8">Unit {id}</p>
                    <div className="flex justify-between items-center text-emerald-600 font-black text-xs pt-6 border-t border-emerald-50">
                      <span>4 Hafta • Dinamik Veri</span>
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all"><ChevronRight size={20}/></div>
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
              <button onClick={() => navigate('units', grade)} className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"><ArrowLeft size={24}/></button>
              <div className="text-center md:text-left"><span className="bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-[10px] font-black mb-3 inline-block uppercase tracking-widest">Ünite {unitId}</span><h1 className="text-3xl md:text-6xl font-black tracking-tighter text-emerald-900">{unitNames[grade][unitId]}</h1></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((w) => (
                <motion.div key={w} whileHover={{ y: -5 }} onClick={() => navigate('activitySelection', grade, unitId, w)} className="bg-white p-6 rounded-[40px] border border-white shadow-lg cursor-pointer flex flex-col items-center text-center group">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-2xl mb-6 group-hover:scale-110 transition-transform">{w}</div>
                  <h3 className="text-lg font-bold text-emerald-900 mb-2">{w}. Hafta</h3>
                  <div className="mt-6 h-12 w-full flex items-center justify-center gap-2 text-emerald-600/40 font-black uppercase text-[10px] border-t border-emerald-50 group-hover:text-emerald-600 transition-colors">Aktiviteler <ChevronRight size={14}/></div>
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
              <button onClick={() => navigate('weekSelection', grade, unitId)} className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md text-emerald-600 hover:bg-emerald-50 transition-colors"><ArrowLeft size={24}/></button>
              <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-emerald-900">Aktivite Seç</h2>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50"><Loader2 className="animate-spin mb-4" size={48} /><p className="font-black uppercase tracking-widest text-sm">Kelimeler Yükleniyor...</p></div>
            ) : vocabulary.length === 0 ? (
              <NoDataView onBack={() => navigate('weekSelection', grade, unitId)} message={fetchErrorMsg || undefined} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                  { type: 'flashcards', title: 'Flashcard', icon: '📝', color: 'text-emerald-600', btn: 'bg-emerald-600' },
                  { type: 'synonyms', title: 'Synonyms', icon: '🔍', color: 'text-orange-500', btn: 'bg-orange-500' },
                  { type: 'collocations', title: 'Collocations', icon: '📐', color: 'text-emerald-600', btn: 'bg-emerald-600' },
                  { type: 'sentences', title: 'Blanks', icon: '🖋️', color: 'text-gray-700', btn: 'bg-emerald-600' },
                  { type: 'quiz', title: 'Quiz', icon: '📊', color: 'text-orange-500', btn: 'bg-orange-500' }
                ].map(item => (
                  <motion.div key={item.type} whileHover={{ scale: 1.05 }} className="bg-white rounded-[40px] p-6 border border-white shadow-xl flex flex-col items-center text-center">
                    <div className="h-28 w-full bg-emerald-50 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-inner">{item.icon}</div>
                    <h3 className={`text-xs font-black ${item.color} mb-6 uppercase tracking-widest`}>{item.title}</h3>
                    <button onClick={() => navigate('activity', grade, unitId, weekId, item.type)} className={`w-full h-14 rounded-2xl ${item.btn} text-white font-black shadow-lg uppercase active:scale-95 transition-all`}>Başla</button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Activity View */}
        {view === 'activity' && grade && unitId && weekId && activeMode && (
          <div className="animate-in fade-in">
            {activityResult ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto bg-white p-12 rounded-[56px] shadow-2xl border-8 border-emerald-50 text-center">
                <div className="w-24 h-24 bg-emerald-600 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-xl border-4 border-white rotate-3"><Trophy size={48} className="text-orange-400"/></div>
                <h2 className="text-4xl font-black mb-8 tracking-tighter text-emerald-900">Tebrikler!</h2>
                
                {activityResult.limited && (
                  <div className="bg-orange-50 text-orange-600 p-4 rounded-2xl mb-6 font-bold text-sm border border-orange-100">
                    Bugün bu etkinlikten puanını aldın, yarın tekrar gel!
                  </div>
                )}

                <div className="bg-emerald-50 p-8 rounded-[40px] mb-10 flex flex-col gap-6 border border-emerald-100 shadow-inner">
                  <div className="flex justify-between items-center"><span className="text-emerald-600/60 font-black uppercase text-[10px] tracking-widest">Doğru Yanıt</span><span className="text-4xl font-black text-emerald-800">{activityResult.total}</span></div>
                  <div className="flex justify-between items-center"><span className="text-emerald-600/60 font-black uppercase text-[10px] tracking-widest">Hata Sayısı</span><span className="text-4xl font-black text-orange-600">{activityResult.errors}</span></div>
                  <div className="flex justify-between items-center"><span className="text-emerald-600/60 font-black uppercase text-[10px] tracking-widest">Kazanılan</span><span className="text-4xl font-black text-orange-500">+{activityResult.score} XP</span></div>
                </div>
                <button onClick={() => navigate('activitySelection', grade, unitId, weekId)} className="w-full h-16 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 active:scale-95 transition-all">Listeye Dön</button>
              </motion.div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <button onClick={() => navigate('activitySelection', grade, unitId, weekId)} className="flex items-center h-12 gap-2 font-black bg-white px-6 rounded-full border border-emerald-100 text-emerald-600 text-[10px] uppercase shadow-sm hover:bg-emerald-50 transition-all"><ArrowLeft size={16}/> Sonlandır</button>
                  <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">{activeMode}</div>
                </div>
                <div className="py-4">
                  {activeMode === 'flashcards' && <FlashcardActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'synonyms' && <MatchingActivity data={vocabulary} leftKey="word_en" rightKey="synonym_en" onFinish={handleFinish} />}
                  {activeMode === 'collocations' && <MatchingActivity data={vocabulary} leftKey="word_en" rightKey="collocation_en" onFinish={handleFinish} />}
                  {activeMode === 'sentences' && <FillBlanksActivity data={vocabulary} onFinish={handleFinish} />}
                  {activeMode === 'quiz' && <QuizActivity data={vocabulary} onFinish={handleFinish} />}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
