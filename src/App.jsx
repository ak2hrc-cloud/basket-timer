import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [gameMinutes, setGameMinutes] = useState(10)
  const [gameSeconds, setGameSeconds] = useState(0)
  const [restMinutes, setRestMinutes] = useState(3)
  const [restSeconds, setRestSeconds] = useState(0)
  const [numGames, setNumGames] = useState(4)
  const [voiceMode, setVoiceMode] = useState('ja')
  const [theme, setTheme] = useState('dark')
  
  const [presets, setPresets] = useState([])
  
  const [phases, setPhases] = useState([])
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isAllDone, setIsAllDone] = useState(false)
  
  const [isLocked, setIsLocked] = useState(false)
  const [unlockProgress, setUnlockProgress] = useState(0)
  
  const [isBenchMode, setIsBenchMode] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  )
  
  const audioContextRef = useRef(null)
  const prevSecondsRef = useRef(0)
  const wakeLockRef = useRef(null)
  const unlockTimerRef = useRef(null)
  const unlockIntervalRef = useRef(null)
  const benchTimerRef = useRef(null)
  const voiceJaRef = useRef(null)
  const voiceEnRef = useRef(null)
  const voiceModeRef = useRef(voiceMode)
  
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
        { id: 'sample-1', name: '社会人標準', gameMinutes: 10, gameSeconds: 0, restMinutes: 3, restSeconds: 0, numGames: 4, createdAt: new Date().toISOString() },
        { id: 'sample-2', name: '3on3', gameMinutes: 5, gameSeconds: 0, restMinutes: 2, restSeconds: 0, numGames: 3, createdAt: new Date().toISOString() },
        { id: 'sample-3', name: '練習試合（短縮）', gameMinutes: 8, gameSeconds: 0, restMinutes: 2, restSeconds: 0, numGames: 2, createdAt: new Date().toISOString() },
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
      const nextIndex = currentPhaseIndex + 1
      if (nextIndex >= phases.length) {
        setIsRunning(false)
        setIsAllDone(true)
        playFinalAlarm()
        setTimeout(() => speak(
          '全試合終了です。お疲れさまでした',
          'All games complete. Good job!'
        ), 900)
      } else {
        setCurrentPhaseIndex(nextIndex)
        setSecondsLeft(phases[nextIndex].durationSec)
        playTransitionAlarm()
        const next = phases[nextIndex]
        setTimeout(() => {
          if (next.type === 'game') {
            speak(
              `${next.gameNumber}試合目を開始します`,
              `Game ${next.gameNumber}, start`
            )
          } else {
            speak('休憩に入ります', 'Break time')
          }
        }, 600)
      }
    }
  }, [secondsLeft, hasStarted, isAllDone, currentPhaseIndex, phases])
  
  useEffect(() => {
    if (isRunning) {
      const prev = prevSecondsRef.current
      if (prev === secondsLeft + 1) {
        if (secondsLeft === 60) {
          playWarningWhistle(2600)
          setTimeout(() => speak('残り1分です', 'One minute remaining'), 300)
        }
        else if (secondsLeft === 30) {
          playWarningWhistle(2900)
          setTimeout(() => speak('残り30秒です', 'Thirty seconds remaining'), 300)
        }
        else if (secondsLeft === 10) {
          playWarningWhistle(3200)
          setTimeout(() => speak('残り10秒です', 'Ten seconds'), 300)
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
  
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
  }
  
  // ============= 電子ホイッスル音の生成コア =============
  // baseFreq: 中心となる周波数（高いほど鋭く緊迫感が増す）
  // duration: 音の長さ（秒）
  // peakVolume: 最大音量（0〜1）
  const createWhistleTone = (startTime, duration, baseFreq = 2900, peakVolume = 0.9) => {
    const ctx = audioContextRef.current
    if (!ctx) return
    
    // メイン音（矢波：鋭さの核）
    const osc1 = ctx.createOscillator()
    osc1.type = 'square'
    osc1.frequency.setValueAtTime(baseFreq, startTime)
    
    // わずかにずらした音（ホイッスル特有の「ピリピリ」うなりを再現）
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(baseFreq * 1.017, startTime)
    
    // 下支えの音（太さ・体育館での通りやすさ）
    const osc3 = ctx.createOscillator()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(baseFreq * 0.5, startTime)
    
    const gain1 = ctx.createGain()
    const gain2 = ctx.createGain()
    const gain3 = ctx.createGain()
    
    osc1.connect(gain1); gain1.connect(ctx.destination)
    osc2.connect(gain2); gain2.connect(ctx.destination)
    osc3.connect(gain3); gain3.connect(ctx.destination)
    
    const attack = 0.006   // 立ち上がりを鋭く
    const release = 0.04
    const sustainEnd = Math.max(startTime + attack, startTime + duration - release)
    
    // メイン音
    gain1.gain.setValueAtTime(0, startTime)
    gain1.gain.linearRampToValueAtTime(peakVolume, startTime + attack)
    gain1.gain.setValueAtTime(peakVolume, sustainEnd)
    gain1.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    
    // うなり音（少し控えめ）
    gain2.gain.setValueAtTime(0, startTime)
    gain2.gain.linearRampToValueAtTime(peakVolume * 0.55, startTime + attack)
    gain2.gain.setValueAtTime(peakVolume * 0.55, sustainEnd)
    gain2.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    
    // 下支え音（さらに控えめ）
    gain3.gain.setValueAtTime(0, startTime)
    gain3.gain.linearRampToValueAtTime(peakVolume * 0.3, startTime + attack)
    gain3.gain.setValueAtTime(peakVolume * 0.3, sustainEnd)
    gain3.gain.linearRampToValueAtTime(0.0001, startTime + duration)
    
    osc1.start(startTime); osc1.stop(startTime + duration + 0.02)
    osc2.start(startTime); osc2.stop(startTime + duration + 0.02)
    osc3.start(startTime); osc3.stop(startTime + duration + 0.02)
  }
  
  // フェーズ切替時：短いホイッスルを2回「ピッ、ピッ」
  const playTransitionAlarm = () => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    createWhistleTone(ctx.currentTime, 0.18, 2900, 0.95)
    createWhistleTone(ctx.currentTime + 0.28, 0.18, 2900, 0.95)
  }
  
  // 全試合終了時：長めのホイッスルを3回「ピーーッ、ピーーッ、ピーーッ」
  const playFinalAlarm = () => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    createWhistleTone(ctx.currentTime, 0.5, 2900, 1.0)
    createWhistleTone(ctx.currentTime + 0.65, 0.5, 2900, 1.0)
    createWhistleTone(ctx.currentTime + 1.3, 0.7, 2900, 1.0)
  }
  
  // 残り時間警告：単発の短いホイッスル（周波数で緊迫感を変える）
  const playWarningWhistle = (baseFreq) => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    createWhistleTone(ctx.currentTime, 0.2, baseFreq, 0.95)
  }
  
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  
  const buildPhases = () => {
    const result = []
    const gameSec = gameMinutes * 60 + gameSeconds
    const restSec = restMinutes * 60 + restSeconds
    for (let i = 0; i < numGames; i++) {
      result.push({
        type: 'game',
        label: `第${i + 1}試合`,
        gameNumber: i + 1,
        durationSec: gameSec,
      })
      if (i < numGames - 1) {
        result.push({ type: 'rest', label: '休憩', durationSec: restSec })
      }
    }
    return result
  }
  
  const totalSeconds = (() => {
    const gs = gameMinutes * 60 + gameSeconds
    const rs = restMinutes * 60 + restSeconds
    return gs * numGames + rs * Math.max(0, numGames - 1)
  })()
  const totalMin = Math.floor(totalSeconds / 60)
  const totalSec = totalSeconds % 60
  
  const handleSavePreset = () => {
    const defaultName = `${gameMinutes}分×${numGames}試合`
    const name = prompt('プリセット名を入力してください:', defaultName)
    if (!name || !name.trim()) return
    setPresets([...presets, {
      id: Date.now().toString(),
      name: name.trim(),
      gameMinutes, gameSeconds, restMinutes, restSeconds, numGames,
      createdAt: new Date().toISOString(),
    }])
  }
  
  const handleLoadPreset = (preset) => {
    setGameMinutes(preset.gameMinutes)
    setGameSeconds(preset.gameSeconds)
    setRestMinutes(preset.restMinutes)
    setRestSeconds(preset.restSeconds)
    setNumGames(preset.numGames)
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
      setTimeout(() => speak(
        `${newPhases[0].gameNumber}試合目を開始します`,
        `Game ${newPhases[0].gameNumber}, start`
      ), 100)
    }
    setIsRunning(true)
    setHasStarted(true)
    setIsAllDone(false)
  }
  
  const handlePause = () => setIsRunning(false)
  
  const handleReset = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsRunning(false)
    setHasStarted(false)
    setIsAllDone(false)
    setIsLocked(false)
    setIsBenchMode(false)
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
  }
  
  const exitBenchMode = () => {
    setIsBenchMode(false)
    setControlsVisible(true)
    clearTimeout(benchTimerRef.current)
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
    return p.numGames > 1
      ? `試合 ${gameStr} × ${p.numGames} / 休憩 ${restStr}`
      : `試合 ${gameStr} × 1`
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
  
  return (
    <div
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
            <div className="setting-row">
              <span className="setting-label">試合時間</span>
              <input type="number" min="0" max="99" value={gameMinutes}
                onChange={(e) => setGameMinutes(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))} />
              <span className="unit">分</span>
              <input type="number" min="0" max="59" value={gameSeconds}
                onChange={(e) => setGameSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} />
              <span className="unit">秒</span>
            </div>
            <div className="setting-row">
              <span className="setting-label">休憩時間</span>
              <input type="number" min="0" max="99" value={restMinutes}
                onChange={(e) => setRestMinutes(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))} />
              <span className="unit">分</span>
              <input type="number" min="0" max="59" value={restSeconds}
                onChange={(e) => setRestSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} />
              <span className="unit">秒</span>
            </div>
            <div className="setting-row">
              <span className="setting-label">試合数</span>
              <input type="number" min="1" max="20" value={numGames}
                onChange={(e) => setNumGames(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} />
              <span className="unit">試合</span>
            </div>
            
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
            
            <div className="setting-summary">
              合計時間: {totalMin}分{totalSec}秒
            </div>
          </div>
        </div>
      ) : isAllDone ? (
        <div className="all-done">
          <div className="finished-message">お疲れさまでした！</div>
          <div className="finished-summary">{numGames}試合 完了</div>
        </div>
      ) : (
        <>
          <div className={`phase-info ${benchHideClass}`}>
            <div className="phase-label">{currentPhase?.label}</div>
            <div className="phase-counter">{currentPhaseIndex + 1} / {phases.length}</div>
          </div>
          {renderTimer()}
          {isRunning && secondsLeft > 0 && secondsLeft <= 15 && (
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
          <button onClick={exitBenchMode} className="lock-button">✕ 通常表示</button>
        </div>
      ) : (
        <div className="buttons">
          {!isAllDone && (
            <button onClick={handleStart} disabled={isRunning}>
              {!hasStarted ? 'スタート' : isRunning ? '動作中' : '再開'}
            </button>
          )}
          {hasStarted && !isAllDone && (
            <button onClick={handlePause} disabled={!isRunning}>一時停止</button>
          )}
          <button onClick={handleReset}>リセット</button>
          {hasStarted && !isAllDone && (
            <button onClick={handleLock} className="lock-button">🔒 ロック</button>
          )}
          {hasStarted && !isAllDone && (
            <button onClick={enterBenchMode} className="bench-button">📺 大画面</button>
          )}
        </div>
      )}
    </div>
  )
}

export default App