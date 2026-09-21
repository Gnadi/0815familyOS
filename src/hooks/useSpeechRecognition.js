import { useCallback, useEffect, useRef, useState } from 'react';

// Dictation via the Web Speech API -- the browser's own recognizer, no audio
// ever reaching this app's servers. Chrome/Edge and Safari (iOS 14.5+) ship it
// behind the webkit prefix; Firefox does not have it at all, which is why every
// caller needs the `supported` flag and a typed fallback.
//
// Note for the privacy copy: Chrome performs recognition in Google's cloud,
// Safari on-device where it can. Either way it is the browser's arrangement
// with its vendor, not ours.

const RECOGNITION_LANGS = { en: 'en-US', de: 'de-DE' };

function recognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function useSpeechRecognition(locale = 'en') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  // One of '', 'denied', 'no-speech', 'network', 'audio', 'failed' -- the
  // caller turns these into translated copy.
  const [error, setError] = useState('');

  const recognition = useRef(null);
  // Set while stop() is tearing down, so the resulting `onend` is not reported
  // as the recognizer dying on its own.
  const finishing = useRef(false);

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
  }, []);

  // Release the microphone if the sheet closes mid-sentence.
  useEffect(() => () => {
    finishing.current = true;
    try {
      recognition.current?.abort();
    } catch {
      // Already gone.
    }
    recognition.current = null;
  }, []);

  const stop = useCallback(() => {
    finishing.current = true;
    try {
      recognition.current?.stop();
    } catch {
      // Not running.
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    try {
      recognition.current?.abort();
    } catch {
      // Nothing to abort.
    }

    const instance = new Ctor();
    instance.lang = RECOGNITION_LANGS[locale] || RECOGNITION_LANGS.en;
    // Single utterance: a family sentence is short, and ending on the first
    // pause is what makes "tap, speak, done" feel immediate.
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onresult = (event) => {
      let finalText = '';
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (finalText) {
        setTranscript((prev) => `${prev} ${finalText}`.trim());
        setInterim('');
      } else {
        setInterim(pending);
      }
    };

    instance.onerror = (event) => {
      const map = {
        'not-allowed': 'denied',
        'service-not-allowed': 'denied',
        'no-speech': 'no-speech',
        network: 'network',
        'audio-capture': 'audio',
      };
      setError(map[event.error] || 'failed');
      setListening(false);
    };

    instance.onend = () => {
      setListening(false);
      setInterim('');
      finishing.current = false;
    };

    recognition.current = instance;
    setError('');
    setInterim('');
    finishing.current = false;
    try {
      instance.start();
      setListening(true);
    } catch {
      // start() throws if called twice in a row; treat it as "already on".
      setListening(true);
    }
  }, [locale]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError('');
  }, []);

  return {
    supported,
    listening,
    transcript,
    interim,
    error,
    start,
    stop,
    reset,
    setTranscript,
  };
}
