import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mic, Square, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioUrl: string, transcript: string) => void;
  existingTranscript?: string;
}

export function VoiceRecorder({ onRecordingComplete, existingTranscript }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState(existingTranscript || '');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start visualization
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop visualization
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        setAudioLevel(0);

        // Transcribe audio
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Call transcription function
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio },
      });

      if (error) throw error;

      const transcribedText = data.text || '';
      setTranscript(transcribedText);
      
      // Create a proper URL for storage (in production, you'd upload to storage)
      // For now, we'll use the base64 data URL
      onRecordingComplete(`data:audio/webm;base64,${base64Audio}`, transcribedText);
      
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Failed to transcribe audio. Your recording was saved.');
      setTranscript('Transcription unavailable');
    } finally {
      setIsTranscribing(false);
    }
  };

  const resetRecording = () => {
    setAudioUrl(null);
    setTranscript('');
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="flex flex-col items-center gap-4">
        {/* Audio Level Visualization */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div 
            className={cn(
              "absolute inset-0 rounded-full bg-primary/20 transition-transform duration-100",
              isRecording && "animate-pulse"
            )}
            style={{ 
              transform: `scale(${1 + audioLevel * 0.5})`,
              opacity: 0.3 + audioLevel * 0.7
            }}
          />
          <div 
            className={cn(
              "absolute inset-4 rounded-full bg-primary/30 transition-transform duration-100"
            )}
            style={{ 
              transform: `scale(${1 + audioLevel * 0.3})` 
            }}
          />
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="relative z-10 h-20 w-20 rounded-full"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
          >
            {isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
        </div>

        {/* Timer */}
        <div className="text-2xl font-mono font-bold">
          {formatTime(recordingTime)}
        </div>

        {/* Status Text */}
        <p className="text-sm text-muted-foreground">
          {isRecording 
            ? "Recording... Click to stop" 
            : isTranscribing 
              ? "Transcribing your answer..." 
              : audioUrl 
                ? "Recording complete" 
                : "Click to start recording"
          }
        </p>
      </div>

      {/* Audio Playback */}
      {audioUrl && !isRecording && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <audio src={audioUrl} controls className="flex-1 h-10" />
            <Button
              variant="outline"
              size="sm"
              onClick={resetRecording}
              disabled={isTranscribing}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-record
            </Button>
          </div>
        </Card>
      )}

      {/* Transcription */}
      {isTranscribing && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Transcribing your answer...</span>
          </div>
        </Card>
      )}

      {transcript && !isTranscribing && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-2">Transcript</h4>
          <p className="text-sm text-muted-foreground">{transcript}</p>
        </Card>
      )}
    </div>
  );
}
