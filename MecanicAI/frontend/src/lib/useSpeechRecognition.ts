import { useCallback, useEffect, useRef, useState } from 'react'

// Tipos mínimos de la Web Speech API (no vienen en lib.dom de TypeScript)
interface SpeechRecognitionAlternative {
  transcript: string
}
interface SpeechRecognitionResult {
  isFinal: boolean
  0: SpeechRecognitionAlternative
}
interface SpeechRecognitionEvent {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResult>
}
interface SpeechRecognitionErrorEvent {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permite el acceso al micrófono para dictar.',
  'service-not-allowed': 'Tu navegador no permite el dictado por voz aquí.',
  'no-speech': 'No te he oído. Vuelve a intentarlo.',
  'audio-capture': 'No se encuentra ningún micrófono.',
  network: 'El dictado necesita conexión a internet.',
}

/**
 * Dictado por voz con la Web Speech API del navegador (gratis, sin backend).
 * Llama a `onFinalText` con cada frase reconocida.
 */
export function useSpeechRecognition(onFinalText: (text: string) => void, onError: (message: string) => void) {
  const supported = getRecognition() !== undefined
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const callbacks = useRef({ onFinalText, onError })

  useEffect(() => {
    callbacks.current = { onFinalText, onError }
  })

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Recognition = getRecognition()
    if (!Recognition || recognitionRef.current) return
    const recognition = new Recognition()
    recognition.lang = navigator.language?.toLowerCase().startsWith('es') ? navigator.language : 'es-ES'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = (event) => {
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) callbacks.current.onFinalText(result[0].transcript.trim())
        else pending += result[0].transcript
      }
      setInterim(pending)
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        callbacks.current.onError(ERROR_MESSAGES[event.error] ?? 'No se pudo usar el dictado por voz.')
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
    }
  }, [])

  return { supported, listening, interim, start, stop }
}
