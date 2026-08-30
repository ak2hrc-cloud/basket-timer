import { useState, useEffect, useRef } from 'react'
import './App.css'

const TEAM_LETTERS = ['A', 'B', 'C', 'D', 'E']
const COLOR_OPTIONS = ['赤', '黄', '緑', '橙', '青', '白', '黒']
const COLOR_HEX = {
  '赤': '#e53935', '黄': '#fdd835', '緑': '#43a047', '橙': '#fb8c00',
  '青': '#1e88e5', '白': '#ffffff', '黒': '#222222',
}
const COLOR_EN = {
  '赤': 'Red', '黄': 'Yellow', '緑': 'Green', '橙': 'Orange',
  '青': 'Blue', '白': 'White', '黒': 'Black',
}
const DEFAULT_TEAM_COLORS = ['赤', '青', '緑', '白', '黒']
const LOOP_MAX_GAMES = 99
const MINUTE_VALUES = Array.from({ length: 16 }, (_, i) => i)
const SECOND_VALUES = Array.from({ length: 12 }, (_, i) => i * 5)

function generateRoundRobinMatches(count) {
  let teams = Array.from({ length: count }, (_, i) => i)
  if (teams.length % 2 !== 0) {
    teams = [...teams, null]
  }
  const n = teams.length
  const matches = []
  let arr = [teams[0], ...teams.slice(1).reverse()]
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const t1 = arr[i]
      const t2 = arr[n - 1 - i]
      if (t1 !== null && t2 !== null) {
        matches.push(t1 < t2 ? [t1, t2] : [t2, t1])
      }
    }
    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop())
    arr = [fixed, ...rest]
  }
  return matches
}

function assignOfficials(matches, teamCount) {
  const officiateCount = Array(teamCount).fill(0)
  const officials = []
  
  matches.forEach((match) => {
    const playing = new Set(match)
    const resting = []
    for (let t = 0; t < teamCount; t++) {
      if (!playing.has(t)) resting.push(t)
    }
    if (resting.length === 0) {
      officials.push(null)
      return
    }
    let best = resting[0]
    for (const t of resting) {
      if (officiateCount[t] < officiateCount[best]) {
        best = t
      }
    }
    officials.push(best)
    officiateCount[best]++
  })
  
  return officials
}

// ホイールピッカー本体（展開時のみ描画される、NEW）
function WheelPicker({ values, unit, value, onCommit }) {
  const itemH = 36
  const visibleCount = 5
  const boxH = itemH * visibleCount
  const padH = (boxH - itemH) / 2
  const scrollRef = useRef(null)
  const [pendingValue, setPendingValue] = useState(value)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, values.indexOf(value)))
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = activeIndex * itemH
    }
  }, [])
  
  const handleScroll = () => {
    if (!scrollRef.current) return
    const idx = Math.max(0, Math.min(values.length - 1, Math.round(scrollRef.current.scrollTop / itemH)))
    setActiveIndex(idx)
    setPendingValue(values[idx])
  }
  
  const scrollToIndex = (idx) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: idx * itemH, behavior: 'smooth' })
    }
  }
  
  return (
    <div className="wheel-accordion">
      <div className="wheel-wrap" style={{ height: boxH }}>
        <div className="wheel-band" style={{ top: padH, height: itemH }} />
        <div className="wheel-scroll" ref={scrollRef} onScroll={handleScroll} style={{ height: boxH }}>
          <div style={{ height: padH }} />
          {values.map((v, i) => (
            <div
              key={v}
              className={`wheel-item ${i === activeIndex ? 'active' : ''}`}
              style={{ height: itemH }}
              onClick={() => scrollToIndex(i)}
            >
              {v}{unit}
            </div>
          ))}
          <div style={{ height: padH }} />
        </div>
        <div className="wheel-fade-top" style={{ height: padH }} />
        <div className="wheel-fade-bottom" style={{ height: padH }} />
      </div>
      <button className="wheel-confirm-btn" onClick={() => onCommit(pendingValue)}>決定</button>
    </div>
  )
}

// 折りたたみ式の時間フィールド（分 or 秒、1つ分）NEW
function CollapsibleTimeField({ label, values, unit, value, onCommit, isFree, onGoFree, onBackFromFree, freeMax }) {
  const [expanded, setExpanded] = useState(false)
  
  if (isFree) {
    return (
      <div className="time-field">
        <div className="free-input-group">
          <input
            type="number"
            min="0"
            max={freeMax}
            value={value}
            onChange={(e) => onCommit(Math.max(0, Math.min(freeMax, parseInt(e.target.value) || 0)))}
          />
          <button className="free-back-btn" onClick={onBackFromFree}>戻す</button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="time-field">
      <button className="time-field-btn" onClick={() => setExpanded(!expanded)}>
        {value}{unit}
      </button>
      {expanded && (
        <WheelPicker
          values={values}
          unit={unit}
          value={value}
          onCommit={(v) => {
            onCommit(v)
            setExpanded(false)
          }}
        />
      )}
      {expanded && (
        <button className="time-field-free-link" onClick={() => { onGoFree(); setExpanded(false) }}>
          自由入力にする
        </button>
      )}
    </div>
  )
}

function App() {
  const [gameMinutes, setGameMinutes] = useState(10)
  const [gameSeconds, setGameSeconds] = useState(0)
  const [restMinutes, setRestMinutes] = useState(3)
  const [restSeconds, setRestSeconds] = useState(0)
  const [numGames, setNumGames] = useState(4)
  const [limitGames, setLimitGames] = useState(false)
  const [voiceMode, setVoiceMode] = useState('ja')
  const [theme, setTheme] = useState('dark')
  
  const [gameMinFree, setGameMinFree] = useState(false)
  const [gameSecFree, setGameSecFree] = useState(false)
  const [restMinFree, setRestMinFree] = useState(false)
  const [restSecFree, setRestSecFree] = useState(false)
  
  const [teamCount, setTeamCount] = useState(2)
  const [labelStyle, setLabelStyle] = useState('alpha')
  const [teamColors, setTeamColors] = useState(DEFAULT_TEAM_COLORS)
  
  const [presets, setPresets] = useState([])
  
  const [phases, setPhases] = useState([])
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isAllDone, setIsAllDone] = useState(false)
  const [isLoopMode, setIsLoopMode] = useState(false)
  const [completedGames, setCompletedGames] = useState(0)
  
  const [isLocked, setIsLocked] = useState(false)
  const [unlockProgress, setUnlockProgress] = useState(0)
  
  const [isBenchMode, setIsBenchMode] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  
  const [showSchedule, setShowSchedule] = useState(false)
  
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  )
  
  const appRootRef = useRef(null)
  const audioContextRef = useRef(null)
  const prevSecondsRef = useRef(0)
  const wakeLockRef = useRef(null)
  const unlockTimerRef = useRef(null)
  const unlockIntervalRef = useRef(null)
  const benchTimerRef = useRef(null)
  const voiceJaRef = useRef(null)
  const voiceEnRef = useRef(null)
  const voiceModeRef = useRef(voiceMode)
  
  const isTeamMatch = teamCount >= 3
  
  const getTeamLabel = (index) => {
    if (labelStyle === 'number') return String(index + 1)
    if (labelStyle === 'color') return teamColors[index] || TEAM_LETTERS[index]
    return TEAM_LETTERS[index]
  }
  
  const getTeamLabelEn = (index) => {
    if (labelStyle === 'color') return COLOR_EN[teamColors[index]] || TEAM_LETTERS[index]
    return getTeamLabel(index)
  }
  
  const handleSetTeamColor = (teamIndex, color) => {
    setTeamColors((prev) => {
      const next = [...prev]
      next[teamIndex] = color
      return next
    })
  }
  
  useEffect(() => {
    voiceModeRef.current = voiceMode
  }, [voiceMode])
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('basket-timer-theme')
      if (saved && ['dark', 'light', 'hc'].includes(saved)) {
        setTheme(saved)
      }
    } catch (e) {}
  }, [])
  
  useEffect(() => {
    try {
      localStorage.setItem('basket-timer-theme', theme)
    } catch (e) {}
  }, [theme])
  
  const currentPhase = phases[currentPhaseIndex]
  const nextPhase = phases[currentPhaseIndex + 1]
  
  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      if (!isFs && isBenchMode) {
        setIsBenchMode(false)
        setControlsVisible(true)
        clearTimeout(benchTimerRef.current)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [isBenchMode])
  
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      
      const jaVoices = voices.filter(v => v.lang.startsWith('ja'))
      const jaPreferred = ['Kyoko', 'Haruka', 'Ayumi', 'Sayaka', 'Mizuki', 'Nanami', 'Sakura', 'Female']
      let jaVoice = null
      for (const name of jaPreferred) {
        jaVoice = jaVoices.find(v => v.name.includes(name))
        if (jaVoice) break
      }
      if (!jaVoice && jaVoices.length > 0) jaVoice = jaVoices[0]
      voiceJaRef.current = jaVoice
      
      const enVoices = voices.filter(v => v.lang.startsWith('en'))
      const enPreferred = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Allison', 'Susan', 'Aria', 'Jenny', 'Female']
      let enVoice = null
      for (const name of enPreferred) {
        enVoice = enVoices.find(v => v.name.includes(name))
        if (enVoice) break
      }
      if (!enVoice && enVoices.length > 0) enVoice = enVoices[0]
      voiceEnRef.current = enVoice
    }
    
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])
  
  const speak = (textJa, textEn) => {
    const mode = voiceModeRef.current
    if (mode === 'none') return
    if (!('speechSynthesis' in window)) return
    
    window.speechSynthesis.cancel()
    
    const text = mode === 'ja' ? textJa : textEn
    const voice = mode === 'ja' ? voiceJaRef.current : voiceEnRef.current
    
    const utterance = new SpeechSynthesisUtterance(text)
    if (voice) utterance.voice = voice
    utterance.lang = mode === 'ja' ? 'ja-JP' : 'en-US'
    utterance.rate = mode === 'ja' ? 1.05 : 1.0
    utterance.pitch = mode === 'ja' ? 1.15 : 1.05
    utterance.volume = 1.0
    
    window.speechSynthesis.speak(utterance)
  }
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('basket-timer-presets')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.length > 0) {
          setPresets(parsed)
          return
        }
      }
      setPresets([
        { id: 'sample-1', name: '社会人標準', gameMinutes: 5, gameSeconds: 0, restMinutes: 2, restSeconds: 0, numGames: 4, limitGames: false, teamCount: 2, labelStyle: 'alpha', teamColors: DEFAULT_TEAM_COLORS, voiceMode: 'none', theme: 'light', createdAt: new Date().toISOString() },
        { id: 'sample-2', name: '3on3', gameMinutes: 5, gameSeconds: 0, restMinutes: 2, restSeconds: 0, numGames: 3, limitGames: false, teamCount: 2, labelStyle: 'alpha', teamColors: DEFAULT_TEAM_COLORS, createdAt: new Date().toISOString() },
        { id: 'sample-4', name: '4チーム総当たり', gameMinutes: 8, gameSeconds: 0, restMinutes: 2, restSeconds: 0, numGames: 6, limitGames: false, teamCount: 4, labelStyle: 'alpha', teamColors: DEFAULT_TEAM_COLORS, createdAt: new Date().toISOString() },
      ])
    } catch (e) {}
  }, [])
  
  useEffect(() => {
    try {
      localStorage.setItem('basket-timer-presets', JSON.stringify(presets))
    } catch (e) {}
  }, [presets])
  
  useEffect(() => {
    if (isRunning) {
      requestWakeLock()
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') requestWakeLock()
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        releaseWakeLock()
      }
    }
  }, [isRunning])
  
  useEffect(() => {
    if (isAllDone) {
      setIsLocked(false)
      setIsBenchMode(false)
      clearTimeout(benchTimerRef.current)
    }
  }, [isAllDone])
  
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])
  
  useEffect(() => {
    if (secondsLeft === 0 && hasStarted && !isAllDone && phases.length > 0) {
      const finishedPhase = phases[currentPhaseIndex]
      const nextIndex = currentPhaseIndex + 1
      
      if (finishedPhase.type === 'game') {
        setCompletedGames((prev) => prev + 1)
      }
      
      if (nextIndex >= phases.length) {
        setIsRunning(false)
        setIsAllDone(true)
        playFinalAlarm()
        setTimeout(() => speak(
          '全試合終了です。お疲れさまでした',
          'All games complete. Good job!'
        ), 1000)
      } else {
        setCurrentPhaseIndex(nextIndex)
        setSecondsLeft(phases[nextIndex].durationSec)
        playTransitionAlarm()
        const next = phases[nextIndex]
        setTimeout(() => {
          if (next.type === 'game') {
            if (next.teamA) {
              speak(
                `${next.teamA}対${next.teamB}、試合開始です`,
                `Team ${next.teamAEn} vs Team ${next.teamBEn}, start`
              )
            } else {
              speak('次の試合を開始します', 'Next game, start')
            }
          } else {
            speak('休憩に入ります', 'Break time')
          }
        }, 700)
      }
    }
  }, [secondsLeft, hasStarted, isAllDone, currentPhaseIndex, phases])
  
  useEffect(() => {
    if (isRunning) {
      const prev = prevSecondsRef.current
      if (prev === secondsLeft + 1) {
        if (secondsLeft === 60) {
          playSoftWarningBeep(700)
          setTimeout(() => speak('残り1分です', 'One minute remaining'), 300)
        }
        else if (secondsLeft === 30) {
          playSoftWarningBeep(850)
          setTimeout(() => speak('残り30秒です', 'Thirty seconds remaining'), 300)
        }
        else if (secondsLeft === 10) {
          playSoftWarningBeep(1000)
          setTimeout(() => speak('残り10秒です', 'Ten seconds'), 300)
        }
        else if (secondsLeft === 3 || secondsLeft === 2 || secondsLeft === 1) {
          playCountdownBeep()
        }
      }
    }
    prevSecondsRef.current = secondsLeft
  }, [secondsLeft, isRunning])
  
  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch (err) {}
  }
  
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release() } catch (err) {}
      wakeLockRef.current = null
    }
  }
  
  const requestFullscreenSafe = () => {
    const el = appRootRef.current
    if (!el) return
    try {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {})
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen()
      }
    } catch (e) {}
  }
  
  const exitFullscreenSafe = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      }
    } catch (e) {}
  }
  
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
  }
  
  const createWhistleTone = (startTime, duration, baseFreq = 2900, peakVolume = 0.9) => {
    const ctx = audioContextRef.current
    if (!ctx) return
    
    const osc1 = ctx.createOscillator()
    osc1.type = 'square'
    osc1.frequency.setValueAtTime(baseFreq, startTime)
    
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(baseFreq * 1.017, startTime)
    
    const osc3 = ctx.createOscillator()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(baseFreq * 0.5, startTime)
    
    const gain1 = ctx.createGain()
    const gain2 = ctx.createGain()
    const gain3 = ctx.createGain()
    
    osc1.connect(gain1); gain1.connect(ctx.destination)
    osc2.connect(gain2); gain2.connect(ctx.destination)
    osc3.connect(gain3); gain3.connect(ctx.destination)
    
    const attack = 0.006
    const release = 0.04
    const sustainEnd = Math.max(startTime + attack, startTime + duration - release)
    
    gain1.gain.setValueAtTime(0, startTime)
    gain1.gain.linearRampToValueAtTime(peakVolume, startTime + attack)
    gain1.gain.setValueAtTime(peakVolume, sustainEnd)
    gain1.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    
    gain2.gain.setValueAtTime(0, startTime)
    gain2.gain.linearRampToValueAtTime(peakVolume * 0.55, startTime + attack)
    gain2.gain.setValueAtTime(peakVolume * 0.55, sustainEnd)
    gain2.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    
    gain3.gain.setValueAtTime(0, startTime)
    gain3.gain.linearRampToValueAtTime(peakVolume * 0.3, startTime + attack)
    gain3.gain.setValueAtTime(peakVolume * 0.3, sustainEnd)
    gain3.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    
    osc1.start(startTime); osc1.stop(startTime + duration + 0.02)
    osc2.start(startTime); osc2.stop(startTime + duration + 0.02)
    osc3.start(startTime); osc3.stop(startTime + duration + 0.02)
  }
  
  const playCountdownBeep = () => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    const startTime = ctx.currentTime
    
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1800, startTime)
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(0.6, startTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12)
    osc.start(startTime)
    osc.stop(startTime + 0.14)
  }
  
  const playSoftWarningBeep = (baseFreq) => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    
    for (let i = 0; i < 2; i++) {
      const startTime = ctx.currentTime + i * 0.16
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq, startTime)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1)
      osc.start(startTime)
      osc.stop(startTime + 0.12)
    }
  }
  
  const playPoon = (startTime) => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    const t0 = startTime !== undefined ? startTime : ctx.currentTime
    
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523, t0)
    gain1.gain.setValueAtTime(0, t0)
    gain1.gain.linearRampToValueAtTime(0.7, t0 + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7)
    osc1.start(t0)
    osc1.stop(t0 + 0.75)
    
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(784, t0)
    gain2.gain.setValueAtTime(0, t0)
    gain2.gain.linearRampToValueAtTime(0.35, t0 + 0.02)
    gain2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6)
    osc2.start(t0)
    osc2.stop(t0 + 0.65)
  }
  
  const playTransitionAlarm = () => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    playPoon(ctx.currentTime)
    createWhistleTone(ctx.currentTime + 0.2, 0.18, 2900, 0.95)
    createWhistleTone(ctx.currentTime + 0.48, 0.18, 2900, 0.95)
  }
  
  const playFinalAlarm = () => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    playPoon(ctx.currentTime)
    createWhistleTone(ctx.currentTime + 0.2, 0.5, 2900, 1.0)
    createWhistleTone(ctx.currentTime + 0.85, 0.5, 2900, 1.0)
    createWhistleTone(ctx.currentTime + 1.5, 0.7, 2900, 1.0)
  }
  
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  
  const buildPhases = () => {
    const result = []
    const gameSec = gameMinutes * 60 + gameSeconds
    const restSec = restMinutes * 60 + restSeconds
    const targetGames = limitGames ? numGames : LOOP_MAX_GAMES
    
    let roundRobinMatches = []
    let expandedOfficials = []
    if (isTeamMatch) {
      roundRobinMatches = generateRoundRobinMatches(teamCount)
      const expandedMatches = []
      for (let i = 0; i < targetGames; i++) {
        expandedMatches.push(roundRobinMatches[i % roundRobinMatches.length])
      }
      expandedOfficials = assignOfficials(expandedMatches, teamCount)
    }
    
    for (let i = 0; i < targetGames; i++) {
      let label, teamA, teamB, teamAEn, teamBEn, official
      if (isTeamMatch && roundRobinMatches.length > 0) {
        const cycleIdx = i % roundRobinMatches.length
        const pair = roundRobinMatches[cycleIdx]
        teamA = getTeamLabel(pair[0])
        teamB = getTeamLabel(pair[1])
        teamAEn = getTeamLabelEn(pair[0])
        teamBEn = getTeamLabelEn(pair[1])
        label = `${teamA} vs ${teamB}`
        const officialIdx = expandedOfficials[i]
        official = officialIdx !== null && officialIdx !== undefined ? getTeamLabel(officialIdx) : null
      } else {
        label = limitGames ? `第${i + 1}試合` : '試合中'
      }
      
      result.push({
        type: 'game',
        label,
        gameNumber: i + 1,
        teamA,
        teamB,
        teamAEn,
        teamBEn,
        official,
        durationSec: gameSec,
      })
      if (i < targetGames - 1) {
        let restOfficial = null
        if (isTeamMatch && expandedOfficials.length > 0) {
          const nextOfficialIdx = expandedOfficials[i + 1]
          restOfficial = nextOfficialIdx !== null && nextOfficialIdx !== undefined ? getTeamLabel(nextOfficialIdx) : null
        }
        result.push({ type: 'rest', label: '休憩', durationSec: restSec, official: restOfficial })
      }
    }
    return result
  }
  
  const gameSecCalc = gameMinutes * 60 + gameSeconds
  const restSecCalc = restMinutes * 60 + restSeconds
  const totalSeconds = gameSecCalc * numGames + restSecCalc * Math.max(0, numGames - 1)
  const totalMin = Math.floor(totalSeconds / 60)
  const totalSec = totalSeconds % 60
  
  const handleSavePreset = () => {
    const defaultName = isTeamMatch
      ? `${teamCount}チーム総当たり`
      : (limitGames ? `${gameMinutes}分×${numGames}試合` : `${gameMinutes}分 連続`)
    const name = prompt('プリセット名を入力してください:', defaultName)
    if (!name || !name.trim()) return
    const newPreset = {
      id: Date.now().toString(),
      name: name.trim(),
      gameMinutes, gameSeconds, restMinutes, restSeconds, numGames, limitGames,
      teamCount, labelStyle, teamColors,
      createdAt: new Date().toISOString(),
    }
    setPresets([newPreset, ...presets])
  }
  
  const handleLoadPreset = (preset) => {
    setGameMinutes(preset.gameMinutes)
    setGameSeconds(preset.gameSeconds)
    setRestMinutes(preset.restMinutes)
    setRestSeconds(preset.restSeconds)
    setNumGames(preset.numGames)
    setLimitGames(preset.limitGames || false)
    setTeamCount(preset.teamCount || 2)
    setLabelStyle(preset.labelStyle || 'alpha')
    setTeamColors(preset.teamColors || DEFAULT_TEAM_COLORS)
    if (preset.voiceMode) setVoiceMode(preset.voiceMode)
    if (preset.theme) setTheme(preset.theme)
    setGameMinFree(!MINUTE_VALUES.includes(preset.gameMinutes))
    setGameSecFree(!SECOND_VALUES.includes(preset.gameSeconds))
    setRestMinFree(!MINUTE_VALUES.includes(preset.restMinutes))
    setRestSecFree(!SECOND_VALUES.includes(preset.restSeconds))
  }
  
  const handleDeletePreset = (presetId, presetName) => {
    if (confirm(`「${presetName}」を削除しますか？`)) {
      setPresets(presets.filter(p => p.id !== presetId))
    }
  }
  
  const handleStart = () => {
    initAudio()
    if (!hasStarted) {
      const newPhases = buildPhases()
      if (newPhases.length === 0 || newPhases[0].durationSec === 0) return
      setPhases(newPhases)
      setCurrentPhaseIndex(0)
      setSecondsLeft(newPhases[0].durationSec)
      prevSecondsRef.current = newPhases[0].durationSec
      setIsLoopMode(!limitGames)
      setCompletedGames(0)
      setTimeout(() => {
        const first = newPhases[0]
        if (first.teamA) {
          speak(
            `${first.teamA}対${first.teamB}、試合開始です`,
            `Team ${first.teamAEn} vs Team ${first.teamBEn}, start`
          )
        } else {
          speak('試合開始です', 'Game start')
        }
      }, 100)
    }
    setIsRunning(true)
    setHasStarted(true)
    setIsAllDone(false)
  }
  
  const handlePause = () => setIsRunning(false)
  
  const handleRedoCurrent = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (!currentPhase) return
    setIsRunning(false)
    setSecondsLeft(currentPhase.durationSec)
    prevSecondsRef.current = currentPhase.durationSec
  }
  
  const handleSkipRest = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (!currentPhase || currentPhase.type !== 'rest') return
    const nextIndex = currentPhaseIndex + 1
    if (nextIndex >= phases.length) return
    setIsRunning(false)
    setCurrentPhaseIndex(nextIndex)
    setSecondsLeft(phases[nextIndex].durationSec)
    prevSecondsRef.current = phases[nextIndex].durationSec
  }
  
  const handleJumpToMatch = (matchPositionInCycle) => {
    if (!isTeamMatch) return
    const cycleLength = generateRoundRobinMatches(teamCount).length
    let currentGameNumber = -1
    for (let i = 0; i <= currentPhaseIndex; i++) {
      if (phases[i].type === 'game') currentGameNumber++
    }
    const currentPositionInCycle = currentGameNumber % cycleLength
    let targetGameNumber
    if (matchPositionInCycle > currentPositionInCycle) {
      targetGameNumber = currentGameNumber - currentPositionInCycle + matchPositionInCycle
    } else {
      targetGameNumber = currentGameNumber - currentPositionInCycle + cycleLength + matchPositionInCycle
    }
    let gn = -1
    let targetPhaseIndex = -1
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].type === 'game') {
        gn++
        if (gn === targetGameNumber) {
          targetPhaseIndex = i
          break
        }
      }
    }
    if (targetPhaseIndex === -1) return
    
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsRunning(false)
    setCurrentPhaseIndex(targetPhaseIndex)
    setSecondsLeft(phases[targetPhaseIndex].durationSec)
    prevSecondsRef.current = phases[targetPhaseIndex].durationSec
    setShowSchedule(false)
  }
  
  const handleFinish = () => {
    if (!confirm('タイマーを終了して設定画面に戻りますか？')) return
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsRunning(false)
    setHasStarted(false)
    setIsAllDone(false)
    setIsLocked(false)
    setIsBenchMode(false)
    setIsLoopMode(false)
    setCompletedGames(0)
    clearTimeout(benchTimerRef.current)
    setCurrentPhaseIndex(0)
    setSecondsLeft(0)
    setPhases([])
  }
  
  const handleLock = () => setIsLocked(true)
  
  const handleUnlockStart = (e) => {
    e.preventDefault()
    setUnlockProgress(0)
    const startTime = Date.now()
    const duration = 2000
    unlockIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      setUnlockProgress(Math.min(100, (elapsed / duration) * 100))
    }, 30)
    unlockTimerRef.current = setTimeout(() => {
      setIsLocked(false)
      setUnlockProgress(0)
      clearInterval(unlockIntervalRef.current)
    }, duration)
  }
  
  const handleUnlockEnd = () => {
    clearTimeout(unlockTimerRef.current)
    clearInterval(unlockIntervalRef.current)
    setUnlockProgress(0)
  }
  
  const scheduleHideControls = () => {
    clearTimeout(benchTimerRef.current)
    benchTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, 3000)
  }
  
  const enterBenchMode = () => {
    setIsBenchMode(true)
    setControlsVisible(true)
    scheduleHideControls()
    requestFullscreenSafe()
  }
  
  const exitBenchMode = () => {
    setIsBenchMode(false)
    setControlsVisible(true)
    clearTimeout(benchTimerRef.current)
    exitFullscreenSafe()
  }
  
  const handleScreenTap = () => {
    if (!isBenchMode) return
    setControlsVisible(true)
    scheduleHideControls()
  }
  
  const phaseClass = currentPhase
    ? currentPhase.type === 'game' ? 'phase-game' : 'phase-rest'
    : ''
  
  const getTimerWarnClass = () => {
    if (!isRunning) return ''
    if (secondsLeft === 0) return ''
    if (secondsLeft <= 10) return 'warn-high'
    if (secondsLeft <= 30) return 'warn-mid'
    if (secondsLeft <= 60) return 'warn-low'
    return ''
  }
  const timerWarnClass = getTimerWarnClass()
  
  const formatPresetSummary = (p) => {
    const gameStr = p.gameSeconds > 0 ? `${p.gameMinutes}分${p.gameSeconds}秒` : `${p.gameMinutes}分`
    const restStr = p.restSeconds > 0 ? `${p.restMinutes}分${p.restSeconds}秒` : `${p.restMinutes}分`
    const modeStr = (p.teamCount >= 3) ? `${p.teamCount}チーム総当たり / ` : ''
    const gamesStr = p.limitGames ? `${p.numGames}試合` : '連続'
    return `${modeStr}試合 ${gameStr} × ${gamesStr} / 休憩 ${restStr}`
  }
  
  const renderTimer = () => {
    if (isPortrait && secondsLeft > 0 && secondsLeft <= 60) {
      return (
        <div className={`timer portrait seconds-only ${timerWarnClass}`}>
          {secondsLeft}
        </div>
      )
    }
    if (isPortrait) {
      return (
        <div className={`timer portrait ${timerWarnClass}`}>
          <span className="big-min">{minutes}</span>
          <span className="separator-portrait">:</span>
          <span className="small-sec">{String(seconds).padStart(2, '0')}</span>
        </div>
      )
    }
    return <div className={`timer ${timerWarnClass}`}>{formatted}</div>
  }
  
  const benchHideClass = isBenchMode && !controlsVisible ? 'bench-hidden' : ''
  
  const teamSchedulePreview = isTeamMatch
    ? generateRoundRobinMatches(teamCount).map(([a, b]) => `${getTeamLabel(a)} vs ${getTeamLabel(b)}`).join(' → ')
    : ''
  
  const showPhaseCounter = limitGames && currentPhase
  
  const getNextLabel = () => {
    if (!nextPhase || nextPhase.type !== 'game') return ''
    if (nextPhase.teamA) return `${nextPhase.teamA} vs ${nextPhase.teamB}`
    return '次の試合'
  }
  const isRestPhase = currentPhase?.type === 'rest'
  const nextLabel = isRestPhase ? getNextLabel() : ''
  
  const getCurrentPositionInCycle = () => {
    if (!isTeamMatch || phases.length === 0) return -1
    const cycleLength = generateRoundRobinMatches(teamCount).length
    let currentGameNumber = -1
    for (let i = 0; i <= currentPhaseIndex; i++) {
      if (phases[i].type === 'game') currentGameNumber++
    }
    if (currentGameNumber === -1) return -1
    return currentGameNumber % cycleLength
  }
  const currentPositionInCycle = getCurrentPositionInCycle()
  
  return (
    <div
      ref={appRootRef}
      className={`app theme-${theme} ${phaseClass} ${isPortrait ? 'is-portrait' : ''} ${!hasStarted ? 'is-setup' : ''} ${isBenchMode ? 'bench-mode' : ''}`}
      onClick={isBenchMode ? handleScreenTap : undefined}
    >
      {!hasStarted ? (
        <div className="setup-area">
          <div className="presets">
            <h3 className="presets-title">プリセット</h3>
            {presets.length === 0 ? (
              <div className="presets-empty">
                まだプリセットはありません<br />
                よく使う設定を保存できます
              </div>
            ) : (
              <div className="presets-list">
                {presets.map(preset => (
                  <div key={preset.id} className="preset-item">
                    <div className="preset-info">
                      <div className="preset-name">{preset.name}</div>
                      <div className="preset-summary">{formatPresetSummary(preset)}</div>
                    </div>
                    <div className="preset-actions">
                      <button className="preset-load" onClick={() => handleLoadPreset(preset)}>読込</button>
                      <button className="preset-delete" onClick={() => handleDeletePreset(preset.id, preset.name)}>削除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="preset-save" onClick={handleSavePreset}>＋ 現在の設定を保存</button>
          </div>
          
          <div className="setting">
            <h2 className="setting-title">試合と休憩を設定</h2>
            
            <div className="setting-row time-row">
              <span className="setting-label">試合時間</span>
              <CollapsibleTimeField
                label="分"
                values={MINUTE_VALUES}
                unit="分"
                value={gameMinutes}
                onCommit={setGameMinutes}
                isFree={gameMinFree}
                onGoFree={() => setGameMinFree(true)}
                onBackFromFree={() => {
                  setGameMinutes(v => Math.max(0, Math.min(15, v)))
                  setGameMinFree(false)
                }}
                freeMax={99}
              />
              <CollapsibleTimeField
                label="秒"
                values={SECOND_VALUES}
                unit="秒"
                value={gameSeconds}
                onCommit={setGameSeconds}
                isFree={gameSecFree}
                onGoFree={() => setGameSecFree(true)}
                onBackFromFree={() => {
                  setGameSeconds(v => Math.max(0, Math.min(55, Math.round(v / 5) * 5)))
                  setGameSecFree(false)
                }}
                freeMax={59}
              />
            </div>
            
            <div className="setting-row time-row">
              <span className="setting-label">休憩時間</span>
              <CollapsibleTimeField
                label="分"
                values={MINUTE_VALUES}
                unit="分"
                value={restMinutes}
                onCommit={setRestMinutes}
                isFree={restMinFree}
                onGoFree={() => setRestMinFree(true)}
                onBackFromFree={() => {
                  setRestMinutes(v => Math.max(0, Math.min(15, v)))
                  setRestMinFree(false)
                }}
                freeMax={99}
              />
              <CollapsibleTimeField
                label="秒"
                values={SECOND_VALUES}
                unit="秒"
                value={restSeconds}
                onCommit={setRestSeconds}
                isFree={restSecFree}
                onGoFree={() => setRestSecFree(true)}
                onBackFromFree={() => {
                  setRestSeconds(v => Math.max(0, Math.min(55, Math.round(v / 5) * 5)))
                  setRestSecFree(false)
                }}
                freeMax={59}
              />
            </div>
            
            <div className="setting-row voice-row">
              <span className="setting-label">試合数</span>
              <div className="voice-mode-selector">
                <button className={`voice-mode-btn ${!limitGames ? 'active' : ''}`} onClick={() => setLimitGames(false)}>♾️ 連続（自動）</button>
                <button className={`voice-mode-btn ${limitGames ? 'active' : ''}`} onClick={() => setLimitGames(true)}>回数を指定</button>
              </div>
            </div>
            
            {limitGames && (
              <div className="setting-row">
                <span className="setting-label">試合数</span>
                <input type="number" min="1" max="30" value={numGames}
                  onChange={(e) => setNumGames(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} />
                <span className="unit">試合</span>
              </div>
            )}
            
            <div className="setting-row voice-row">
              <span className="setting-label">チーム数</span>
              <div className="voice-mode-selector">
                <button className={`voice-mode-btn ${teamCount === 2 ? 'active' : ''}`} onClick={() => setTeamCount(2)}>2チーム（連続）</button>
                <button className={`voice-mode-btn ${teamCount === 3 ? 'active' : ''}`} onClick={() => setTeamCount(3)}>3チーム</button>
                <button className={`voice-mode-btn ${teamCount === 4 ? 'active' : ''}`} onClick={() => setTeamCount(4)}>4チーム</button>
                <button className={`voice-mode-btn ${teamCount === 5 ? 'active' : ''}`} onClick={() => setTeamCount(5)}>5チーム</button>
              </div>
            </div>
            
            {isTeamMatch && (
              <div className="setting-row voice-row">
                <span className="setting-label">表示形式</span>
                <div className="voice-mode-selector">
                  <button className={`voice-mode-btn ${labelStyle === 'alpha' ? 'active' : ''}`} onClick={() => setLabelStyle('alpha')}>ABCD</button>
                  <button className={`voice-mode-btn ${labelStyle === 'number' ? 'active' : ''}`} onClick={() => setLabelStyle('number')}>1234</button>
                  <button className={`voice-mode-btn ${labelStyle === 'color' ? 'active' : ''}`} onClick={() => setLabelStyle('color')}>色</button>
                </div>
              </div>
            )}
            
            {isTeamMatch && labelStyle === 'color' && (
              <div className="team-color-config">
                {Array.from({ length: teamCount }).map((_, i) => (
                  <div key={i} className="team-color-row">
                    <span className="team-color-row-label">チーム{i + 1}</span>
                    <div className="color-swatch-selector">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          className={`color-swatch ${teamColors[i] === color ? 'active' : ''}`}
                          style={{
                            backgroundColor: COLOR_HEX[color],
                            color: color === '黒' ? '#ffffff' : '#000000',
                          }}
                          onClick={() => handleSetTeamColor(i, color)}
                        >
                          {COLOR_EN[color]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="setting-row voice-row">
              <span className="setting-label">音声案内</span>
              <div className="voice-mode-selector">
                <button className={`voice-mode-btn ${voiceMode === 'none' ? 'active' : ''}`} onClick={() => setVoiceMode('none')}>🔇 音のみ</button>
                <button className={`voice-mode-btn ${voiceMode === 'ja' ? 'active' : ''}`} onClick={() => setVoiceMode('ja')}>🇯🇵 日本語</button>
                <button className={`voice-mode-btn ${voiceMode === 'en' ? 'active' : ''}`} onClick={() => setVoiceMode('en')}>🇺🇸 English</button>
              </div>
            </div>
            
            <div className="setting-row voice-row">
              <span className="setting-label">テーマ</span>
              <div className="voice-mode-selector">
                <button className={`voice-mode-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙 ダーク</button>
                <button className={`voice-mode-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️ ライト</button>
                <button className={`voice-mode-btn ${theme === 'hc' ? 'active' : ''}`} onClick={() => setTheme('hc')}>🎨 ハイコントラスト</button>
              </div>
            </div>
            
            {limitGames ? (
              <div className="setting-summary">
                合計時間: {totalMin}分{totalSec}秒
              </div>
            ) : (
              <div className="setting-summary">
                「終了」を押すまで自動で繰り返します
              </div>
            )}
            
            {isTeamMatch && (
              <div className="setting-summary">
                対戦順: {teamSchedulePreview}（以降ループ）
              </div>
            )}
          </div>
        </div>
      ) : isAllDone ? (
        <div className="all-done">
          <div className="finished-message">お疲れさまでした！</div>
          <div className="finished-summary">{completedGames}試合 完了</div>
          <button onClick={handleFinish}>設定に戻る</button>
        </div>
      ) : (
        <>
          <div className={`phase-info ${benchHideClass}`}>
            <div className="phase-label">{currentPhase?.label}</div>
            {showPhaseCounter && (
              <div className="phase-counter">{currentPhaseIndex + 1} / {phases.length}</div>
            )}
            {isRestPhase && nextLabel && (
              <div className="next-label">NEXT: {nextLabel}</div>
            )}
            {currentPhase?.official && (
              <div className="official-label">オフィシャル: {currentPhase.official}</div>
            )}
          </div>
          {renderTimer()}
          {isRunning && !isRestPhase && secondsLeft > 0 && secondsLeft <= 15 && (
            <div className="no-time-badge">No Time</div>
          )}
        </>
      )}
      
      {isLocked ? (
        <div className="locked-area">
          <div className="locked-icon">🔒</div>
          <button
            className="unlock-button"
            onMouseDown={handleUnlockStart}
            onMouseUp={handleUnlockEnd}
            onMouseLeave={handleUnlockEnd}
            onTouchStart={handleUnlockStart}
            onTouchEnd={handleUnlockEnd}
            onTouchCancel={handleUnlockEnd}
          >
            <div className="unlock-progress" style={{ width: `${unlockProgress}%` }} />
            <span className="unlock-text">長押しでロック解除</span>
          </button>
        </div>
      ) : isBenchMode ? (
        <div className={`buttons ${benchHideClass}`}>
          <button onClick={handlePause} disabled={!isRunning}>一時停止</button>
          {!isRunning && (
            <button onClick={handleStart}>再開</button>
          )}
          <button onClick={handleRedoCurrent} className="lock-button">↻ やり直し</button>
          {isRestPhase && (
            <button onClick={handleSkipRest} className="skip-button">▶ 次の試合へ</button>
          )}
          <button onClick={exitBenchMode} className="lock-button">✕ 通常表示</button>
        </div>
      ) : !isAllDone && (
        <div className="buttons">
          {!hasStarted ? (
            <button onClick={handleStart} disabled={isRunning}>スタート</button>
          ) : (
            <>
              {isRunning ? (
                <button onClick={handlePause}>一時停止</button>
              ) : (
                <button onClick={handleStart}>再開</button>
              )}
              <button onClick={handleRedoCurrent} className="lock-button">↻ やり直し</button>
              {isRestPhase && (
                <button onClick={handleSkipRest} className="skip-button">▶ 次の試合へ</button>
              )}
              <button
                onClick={() => isTeamMatch && setShowSchedule(true)}
                className="lock-button"
                disabled={!isTeamMatch}
              >
                📋 一覧
              </button>
              <button onClick={handleFinish} className="lock-button">終了</button>
              <button onClick={handleLock} className="lock-button">🔒 ロック</button>
              <button onClick={enterBenchMode} className="bench-button">📺 大画面</button>
            </>
          )}
        </div>
      )}
      
      {showSchedule && isTeamMatch && (
        <div className="schedule-overlay" onClick={() => setShowSchedule(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="schedule-title">対戦スケジュール</h3>
            <div className="schedule-list">
              {generateRoundRobinMatches(teamCount).map(([a, b], idx) => {
                const isCurrent = idx === currentPositionInCycle
                return (
                  <button
                    key={idx}
                    className={`schedule-item ${isCurrent ? 'current' : ''}`}
                    onClick={() => handleJumpToMatch(idx)}
                  >
                    <span className="schedule-match">{getTeamLabel(a)} vs {getTeamLabel(b)}</span>
                    {isCurrent && <span className="schedule-current-badge">現在</span>}
                  </button>
                )
              })}
            </div>
            <button className="schedule-close" onClick={() => setShowSchedule(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App