import { useCallback, useEffect, useRef, useState } from 'react'
import { STT_TOKEN_URL } from '../lib/constants'

interface SpeechInputState {
  /** True when the browser + Speechmatics backend can support voice input. */
  supported: boolean
  /** True while the microphone is actively transcribing. */
  listening: boolean
  /** Live partial transcript shown while speaking. */
  partialTranscript: string
  /** Start listening. Resolves to false (silently) if it cannot start. */
  start: () => Promise<boolean>
  /** Stop listening and commit the final transcript. */
  stop: () => void
}

function canUseMicrophone(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.AudioContext &&
    typeof WebSocket !== 'undefined'
  )
}

/**
 * Speechmatics realtime voice intake.
 *
 * - Streams raw PCM (16 kHz, s16le) over WebSocket to Speechmatics.
 * - The JWT is minted server-side by the `stt-token` Edge Function — the API
 *   key never reaches the browser.
 * - Any failure (unsupported browser, missing config, network) resolves
 *   silently: the widget falls back to text input and never breaks.
 */
export function useSpeechInput(onTranscript: (text: string) => void): SpeechInputState {
  const [supported, setSupported] = useState<boolean>(() => canUseMicrophone())
  const [listening, setListening] = useState(false)
  const [partialTranscript, setPartialTranscript] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const finalTranscriptRef = useRef('')
  const partialRef = useRef('')
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect()
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }))
      } catch {
        /* noop */
      }
      wsRef.current.close()
    }
    wsRef.current = null
    processorRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
  }, [])

  const commitTranscript = useCallback(() => {
    const text = (finalTranscriptRef.current || partialRef.current).trim()
    finalTranscriptRef.current = ''
    partialRef.current = ''
    setPartialTranscript('')
    if (text) onTranscriptRef.current(text)
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    if (!supported || listening) return false

    // 1. Get a short-lived realtime JWT from the server
    let jwt = ''
    try {
      const res = await fetch(STT_TOKEN_URL)
      if (!res.ok) throw new Error('stt unavailable')
      const data = await res.json()
      jwt = data.jwt
      if (!jwt) throw new Error('stt unavailable')
    } catch {
      // Silent fallback: voice isn't configured — hide the mic
      setSupported(false)
      return false
    }

    try {
      // 2. Open the Speechmatics realtime socket
      const ws = new WebSocket(`wss://realtime.rt.speechmatics.com/v2?jwt=${jwt}`)
      wsRef.current = ws

      const wsReady = new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = () => reject(new Error('ws error'))
      })

      await wsReady

      ws.send(
        JSON.stringify({
          message: 'StartRecognition',
          audio_format: { type: 'raw', encoding: 'pcm_s16le', sample_rate: 16000 },
          transcription_config: { language: 'en', enable_partials: true },
        })
      )

      // 3. Capture microphone → 16 kHz PCM → socket
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return
        const input = e.inputBuffer.getChannelData(0)
        const pcm = new Int16Array(input.length)
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        ws.send(pcm.buffer)
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.message === 'AddPartialTranscript') {
            partialRef.current = msg.metadata?.transcript || ''
            setPartialTranscript(partialRef.current)
          } else if (msg.message === 'AddTranscript') {
            finalTranscriptRef.current = msg.metadata?.transcript || finalTranscriptRef.current
          } else if (msg.message === 'EndOfTranscript') {
            cleanup()
            setListening(false)
            commitTranscript()
          }
        } catch {
          /* ignore malformed frames */
        }
      }

      ws.onerror = () => {
        cleanup()
        setListening(false)
      }

      ws.onclose = () => {
        if (listening) {
          setListening(false)
        }
      }

      setListening(true)
      return true
    } catch {
      cleanup()
      setListening(false)
      return false
    }
  }, [supported, listening, cleanup, commitTranscript])

  const stop = useCallback(() => {
    if (!wsRef.current) {
      setListening(false)
      return
    }
    // Ask for the final transcript, but don't wait forever
    try {
      wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }))
    } catch {
      /* noop */
    }
    // Fallback: if EndOfTranscript doesn't arrive, commit what we have
    setTimeout(() => {
      if (listening) {
        cleanup()
        setListening(false)
        commitTranscript()
      }
    }, 2500)
    setListening(false)
  }, [cleanup, commitTranscript, listening])

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return { supported, listening, start, stop, partialTranscript }
}
