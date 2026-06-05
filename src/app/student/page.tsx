"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Mic, Square, RotateCcw, Trash2, Send, Play, Pause, 
  HelpCircle, Shuffle, ChevronRight, CheckCircle2, AlertCircle, LogOut, Loader2, Languages
} from 'lucide-react';
import { i18n, Language } from '@/lib/i18n';

interface RecordedClip {
  id: string;
  blob: Blob;
  url: string;
  wordText: string;
}

export default function StudentPage() {
  const router = useRouter();
  
  // Auth states
  const [token, setToken] = useState<string | null>(null);
  const [label, setLabel] = useState<string>('');
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [lang, setLang] = useState<Language>('vi');
  
  // App states
  const [words, setWords] = useState<string[]>([]);
  const [activeWord, setActiveWord] = useState<string>('đất nước');
  const [customWord, setCustomWord] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string>('');
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  
  // Refs for media recording and visualization
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Playing audio element reference
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Session authorization check
  useEffect(() => {
    const savedLang = localStorage.getItem('doraebin_lang') as Language;
    if (savedLang === 'vi' || savedLang === 'en') {
      setLang(savedLang);
    }

    const savedToken = localStorage.getItem('doraebin_token');
    const savedRole = localStorage.getItem('doraebin_role');
    const savedLabel = localStorage.getItem('doraebin_label');

    if (!savedToken || savedRole !== 'student') {
      router.push('/join');
      return;
    }

    setToken(savedToken);
    setLabel(savedLabel || '');
    setAuthorized(true);
    
    // Load words list
    loadWords();
  }, [router]);

  const toggleLang = () => {
    const next = lang === 'vi' ? 'en' : 'vi';
    setLang(next);
    localStorage.setItem('doraebin_lang', next);
  };

  const t = i18n[lang];

  // Load words from sample_text table
  const loadWords = async () => {
    try {
      const { data, error } = await supabase
        .from('sample_text')
        .select('text')
        .order('id', { ascending: true });
      
      if (!error && data && data.length > 0) {
        const textList = data.map(item => item.text);
        setWords(textList);
        // Set first word as active
        setActiveWord(textList[0]);
      }
    } catch (err) {
      console.error('Error loading words:', err);
    }
  };

  // Draw random word suggestion
  const handleRandomWord = () => {
    if (words.length > 0) {
      const filtered = words.filter(w => w !== activeWord);
      const pool = filtered.length > 0 ? filtered : words;
      const randomWord = pool[Math.floor(Math.random() * pool.length)];
      setActiveWord(randomWord);
    }
  };

  // Apply custom word typed by user
  const handleUseCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWord.trim()) {
      setActiveWord(customWord.trim().toLowerCase());
      setCustomWord('');
    }
  };

  // 2. Microphone Waveform Visualization
  const startVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const draw = () => {
      if (!canvasRef.current) return;
      const width = canvas.width;
      const height = canvas.height;
      
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'; // Semi-transparent slate-900 to create echo blur
      ctx.fillRect(0, 0, width, height);
      
      const barWidth = (width / bufferLength) * 1.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const percent = dataArray[i] / 255;
        const barHeight = percent * height * 0.8;
        
        // Dynamic green-emerald to purple gradient mapping amplitude
        const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
        grad.addColorStop(0, '#10b981'); // emerald-500
        grad.addColorStop(1, '#6366f1'); // indigo-500
        
        ctx.fillStyle = grad;
        // Symmetric waveform bars
        ctx.fillRect(x, height / 2 - barHeight / 2, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    
    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  // 3. Audio Recording Engine
  const startRecording = async () => {
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const newClip: RecordedClip = {
          id: Math.random().toString(36).substring(2, 9),
          blob: audioBlob,
          url: audioUrl,
          wordText: activeWord
        };
        
        setClips(prev => [newClip, ...prev]);
        stopVisualizer();
        
        // Clean stream tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      startVisualizer(stream);
    } catch (err) {
      alert('Không thể truy cập Microphone. Vui lòng cho phép quyền thu âm để thực hiện bài đọc.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Play a clip locally
  const togglePlayClip = (clip: RecordedClip) => {
    if (activePlayingId === clip.id) {
      if (playingAudioRef.current) {
        playingAudioRef.current.pause();
      }
      setActivePlayingId(null);
    } else {
      // Pause any active playback
      if (playingAudioRef.current) {
        playingAudioRef.current.pause();
      }
      
      const audio = new Audio(clip.url);
      playingAudioRef.current = audio;
      setActivePlayingId(clip.id);
      
      audio.play();
      audio.onended = () => {
        setActivePlayingId(null);
      };
    }
  };

  // Delete a clip locally
  const handleDeleteClip = (id: string) => {
    if (activePlayingId === id) {
      if (playingAudioRef.current) {
        playingAudioRef.current.pause();
      }
      setActivePlayingId(null);
    }
    setClips(prev => prev.filter(c => c.id !== id));
  };

  // 4. Batch Upload to Supabase Storage & Postgres
  const handleSubmitAll = async () => {
    if (clips.length === 0) return;
    
    setUploadStatus('uploading');
    
    try {
      for (const clip of clips) {
        // A. Generate Unique Filename: token/uuid_timestamp.webm
        const fileExt = 'webm';
        const uniqueId = Math.random().toString(36).substring(2, 15);
        const fileName = `${token}/${uniqueId}_${Date.now()}.${fileExt}`;
        
        // B. Upload file to Supabase Storage 'audios' Bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('audios')
          .upload(fileName, clip.blob, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: false
          });
          
        if (uploadError) {
          throw uploadError;
        }
        
        // C. Retrieve the Public URL of the uploaded file
        const { data: urlData } = supabase.storage
          .from('audios')
          .getPublicUrl(fileName);
          
        const audioUrl = urlData.publicUrl;
        
        // D. Insert record into audio_records table with 'approved' status and retrieve its ID
        const { data: insertedData, error: insertError } = await supabase
          .from('audio_records')
          .insert({
            word_text: clip.wordText,
            audio_url: audioUrl,
            student_token: token,
            status: 'approved'
          })
          .select('id')
          .single();
          
        if (insertError || !insertedData) {
          throw insertError || new Error('Failed to insert audio record.');
        }

        const recordId = insertedData.id;

        // E. Immediately trigger AI model transcription pipeline
        try {
          console.log(`Triggering auto-transcription for record ${recordId}...`);
          const transcribeResponse = await fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_record_id: recordId,
              audio_url: audioUrl
            })
          });

          if (!transcribeResponse.ok) {
            const errData = await transcribeResponse.json();
            console.error(`Auto-transcription error for record ${recordId}:`, errData.error);
          } else {
            console.log(`Auto-transcription succeeded for record ${recordId}`);
          }
        } catch (transcribeErr) {
          console.error(`Failed to call transcribe API for record ${recordId}:`, transcribeErr);
        }
      }
      
      setUploadStatus('success');
      // Clear clips queue on success
      setClips([]);
      setTimeout(() => setUploadStatus('idle'), 4000);
      
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setUploadErrorMsg(err.message || JSON.stringify(err));
      setUploadStatus('error');
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadErrorMsg('');
      }, 6000);
    }
  };

  // Logout session
  const handleLogout = () => {
    localStorage.removeItem('doraebin_token');
    localStorage.removeItem('doraebin_role');
    localStorage.removeItem('doraebin_label');
    router.push('/join');
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header bar */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-900 py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <Mic className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">Doraebin Voice Lab</h1>
            <p className="text-xs text-slate-400">{t.common.student}: <span className="text-emerald-400 font-semibold">{label || token}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Language Toggle Button */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl text-xs font-bold text-slate-350 hover:text-slate-200 transition cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
          </button>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition text-sm"
          >
            <LogOut className="w-4 h-4" />
            {t.common.logout}
          </button>
        </div>
      </header>

      {/* Main Studio layout */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column: Recording Booth */}
        <section className="md:col-span-7 flex flex-col gap-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
            {/* Glow accent */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl"></div>
            
            <span className="text-xs text-indigo-400 tracking-wider uppercase font-semibold mb-3">{t.student.targetWord}</span>
            
            {/* Bold Target Vietnamese Word Display */}
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-100 text-center tracking-tight capitalize select-all mb-8 bg-gradient-to-b from-white to-slate-200 bg-clip-text text-transparent">
              {activeWord}
            </h2>

            {/* Interactive Visualizer Canvas */}
            <div className="w-full h-24 bg-slate-950/60 border border-slate-900 rounded-2xl overflow-hidden relative mb-8">
              <canvas ref={canvasRef} className="w-full h-full" width={400} height={96} />
              {!isRecording && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                  {lang === 'en' ? 'Device ready. Click micro to speak.' : 'Thiết bị sẵn sàng. Nhấn để bắt đầu đọc.'}
                </div>
              )}
            </div>

            {/* pulsating record trigger button */}
            <div className="flex justify-center items-center gap-6">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={uploadStatus === 'uploading'}
                  className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-emerald-500/20 duration-300 disabled:opacity-50"
                  title={t.student.startRecord}
                >
                  <Mic className="w-8 h-8 text-emerald-400 group-hover:text-slate-950 transition duration-300" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center hover:bg-rose-500 hover:scale-105 active:scale-95 transition-all animate-pulse shadow-lg hover:shadow-rose-500/20 duration-300"
                  title={t.student.stopRecord}
                >
                  <Square className="w-7 h-7 text-rose-400 hover:text-slate-950 transition duration-300 fill-current" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Target Switcher panel */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-indigo-400" />
              {lang === 'en' ? 'Switch target word' : 'Thay đổi từ phát âm'}
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRandomWord}
                disabled={words.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-slate-100 transition text-sm text-slate-300"
              >
                {t.student.randomWord}
              </button>
              
              <div className="h-[1px] sm:h-auto sm:w-[1px] bg-slate-850"></div>
              
              <form onSubmit={handleUseCustomWord} className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder={t.student.wordPlaceholder}
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Right Column: Local queue review */}
        <section className="md:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col flex-1 max-h-[600px] overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200">{t.student.reviewTitle}</h3>
                <p className="text-xs text-slate-400">{t.student.reviewSub}</p>
              </div>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-full font-bold">
                {clips.length} {lang === 'en' ? 'drafts' : 'clip nháp'}
              </span>
            </div>

            {/* List scroll panel */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
              {clips.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <Mic className="w-12 h-12 text-slate-700 stroke-1 mb-3 animate-pulse" />
                  <p className="text-sm">{t.student.noDrafts}</p>
                </div>
              ) : (
                clips.map((clip) => (
                  <div 
                    key={clip.id}
                    className="p-3 bg-slate-950/60 border border-slate-900 rounded-2xl flex items-center justify-between hover:border-slate-800 transition"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-bold text-slate-200 capitalize truncate">{clip.wordText}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.student.listeningCheck}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePlayClip(clip)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border transition ${
                          activePlayingId === clip.id
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {activePlayingId === clip.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                      </button>
                      <button
                        onClick={() => handleDeleteClip(clip.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
                        title={t.student.deleteDraft}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* batch submit action */}
            {clips.length > 0 && (
              <div className="pt-4 border-t border-slate-800 mt-4 flex flex-col gap-3">
                {uploadStatus === 'uploading' ? (
                  <button
                    disabled
                    className="w-full py-3 bg-indigo-600/50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-wait"
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.student.submitting} ({clips.length} clip)...
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitAll}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition duration-200"
                  >
                    <Send className="w-4 h-4" />
                    {t.student.submitAll} ({clips.length})
                  </button>
                )}
              </div>
            )}
            
            {/* Upload notifications */}
            {uploadStatus === 'success' && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                {t.student.uploadSuccessSub}
              </div>
            )}
            
            {uploadStatus === 'error' && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col gap-1 text-rose-400 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {lang === 'en' ? 'Submission failed.' : 'Gửi ghi âm thất bại.'}
                </div>
                {uploadErrorMsg && (
                  <p className="text-xs text-rose-300 ml-7 break-all font-semibold">{uploadErrorMsg}</p>
                )}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
