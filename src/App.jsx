import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [breaths, setBreaths] = useState(30);
  const [rounds, setRounds] = useState(3);
  const [phase, setPhase] = useState('setup');

  const [currentRound, setCurrentRound] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [retentionDurations, setRetentionDurations] = useState([]);
  const [recoveryCountdown, setRecoveryCountdown] = useState(15);
  const [currentBreath, setCurrentBreath] = useState(0);

  const retentionTimerRef = useRef(null);
  const bellIntervalRef = useRef(null);
  const recoveryTimerRef = useRef(null);

  // Refs for audio elements
  const breathAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const breathBufferRef = useRef(null);
  const bellBufferRef = useRef(null);
  const bellAudioRef = useRef(null);

  // Play bell buffer via Web Audio
  const playBell = () => {
    const ctx = audioContextRef.current;
    const buffer = bellBufferRef.current;
    if (!buffer) {
      console.error('Bell buffer not ready');
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
  };

  // Handler to start breathing sequence
  const handleStart = () => {
    if (phase === 'setup') {
      setCurrentRound(1);
      setRetentionDurations([]);
    }
    // Delay start by 3 seconds
    setTimeout(() => {
      setPhase('breathing');
      setCurrentBreath(0);

      // Schedule gapless breath loops
      const ctx = audioContextRef.current;
      const buffer = breathBufferRef.current;
      if (!buffer) {
        console.error('Breath buffer not ready');
        return;
      }
      const startTime = ctx.currentTime + 0.1;
      const loopDurationMs = buffer.duration * 1000;
      // Update currentBreath display and schedule buffer sources
      for (let i = 0; i < breaths; i++) {
        // schedule visual counter
        setTimeout(() => setCurrentBreath(i + 1), i * loopDurationMs);
        // schedule audio playback
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(startTime + i * buffer.duration);
      }
      // schedule bell and transition
      setTimeout(() => {
        playBell();
        setPhase('retention');
      }, breaths * loopDurationMs);
    }, 3000);
  };

  const handleRetentionTap = () => {
    clearInterval(retentionTimerRef.current);
    clearInterval(bellIntervalRef.current);
    setRetentionDurations(d => [...d, elapsed]);
    setRecoveryCountdown(15);
    setPhase('recovery');
  };

  const handleRestart = () => {
    setPhase('setup');
    setRecoveryCountdown(15);
    setElapsed(0);
    setCurrentRound(1);
    setRetentionDurations([]);
  };

  // Recovery countdown on phase change
  useEffect(() => {
    if (phase !== 'recovery') return;
    setRecoveryCountdown(15);
    recoveryTimerRef.current = setInterval(() => {
      setRecoveryCountdown(c => {
        if (c <= 0) {
          clearInterval(recoveryTimerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(recoveryTimerRef.current);
  }, [phase]);

  // Transition after recovery reaches zero, with a pause for bell playback
  useEffect(() => {
    if (phase === 'recovery' && recoveryCountdown === 0) {
      clearInterval(recoveryTimerRef.current);
      playBell();
      const isLastRound = currentRound >= rounds;
      setTimeout(() => {
        if (!isLastRound) {
          setCurrentRound(r => r + 1);
          handleStart();
        } else {
          setPhase('complete');
        }
      }, 5000);
    }
  }, [phase, recoveryCountdown, currentRound, rounds]);

  useEffect(() => {
    if (phase !== 'retention') return;
    setElapsed(0);
    const startTime = Date.now();
    retentionTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    bellIntervalRef.current = setInterval(() => {
      playBell();
    }, 60000);
    return () => {
      clearInterval(retentionTimerRef.current);
      clearInterval(bellIntervalRef.current);
    };
  }, [phase]);

  useEffect(() => {
    // Create AudioContext and load breath buffer
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    fetch('/breath.mp3')
      .then(res => res.arrayBuffer())
      .then(ab => audioContextRef.current.decodeAudioData(ab))
      .then(buffer => { breathBufferRef.current = buffer; })
      .catch(err => console.error('Failed to load breath buffer:', err));
     // Load bell buffer
    fetch('/bell.mp3')
      .then(res => res.arrayBuffer())
      .then(ab => audioContextRef.current.decodeAudioData(ab))
      .then(buffer => { bellBufferRef.current = buffer; })
      .catch(err => console.error('Failed to load bell buffer:', err));
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      {/* Hidden audio elements */}

      {phase === 'setup' && (
        <>
          <h1>Wim Hof Breathing Timer</h1>
          <form>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center' }}>
              <label htmlFor="breaths" style={{ fontSize: '1.5rem', fontWeight: '500', marginRight: '0.5rem' }}>
                Breaths per cycle:
              </label>
              <select
                id="breaths"
                name="breaths"
                value={breaths}
                onChange={e => setBreaths(Number(e.target.value))}
                style={{ fontSize: '1.25rem', padding: '0.5rem' }}
              >
                <option value={30}>30</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center' }}>
              <label htmlFor="rounds" style={{ fontSize: '1.5rem', fontWeight: '500', marginRight: '0.5rem' }}>
                Rounds:
              </label>
              <select
                id="rounds"
                name="rounds"
                value={rounds}
                onChange={e => setRounds(Number(e.target.value))}
                style={{ fontSize: '1.25rem', padding: '0.5rem' }}
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleStart}
              style={{
                fontSize: '1.5rem',
                padding: '1rem 2rem',
                marginTop: '1rem',
                fontWeight: '500'
              }}
            >
              Start Session
            </button>
          </form>
        </>
      )}

      {phase === 'breathing' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '1.5rem', margin: 0, color: '#000' }}>
            Round {currentRound} of {rounds}
          </p>
          <div
            style={{
              background: '#000',
              color: '#fff',
              padding: '1rem 2rem',
              borderRadius: '0.5rem',
              display: 'inline-block',
              margin: '1rem 0',
            }}
          >
            <h1 style={{ fontSize: '10rem', margin: '0' }}>
              {currentBreath}
            </h1>
            <p style={{ fontSize: '2rem', margin: 0 }}>
              of {breaths}
            </p>
          </div>
        </div>
      )}

      {phase === 'retention' && (
        <div
          onClick={handleRetentionTap}
          style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100%', height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{
            background: '#000',
            color: '#fff',
            padding: '1rem 2rem',
            borderRadius: '0.5rem',
            display: 'inline-block',
          }}>
            <span style={{ fontSize: '6rem', margin: 0 }}>
              {Math.floor(elapsed / 60).toString().padStart(2, '0')}:
              {(elapsed % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {phase === 'recovery' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#fff',
          color: '#000',
        }}>
          <h2>Recovery</h2>
          <p style={{ fontSize: '4rem', margin: '1rem 0' }}>
            {recoveryCountdown}s
          </p>
        </div>
      )}

      {phase === 'complete' && (
        <div style={{ padding: 20 }}>
          <h2>Session Complete</h2>
          <h3>Retention Times:</h3>
          <ul>
            {retentionDurations.map((d, i) => (
              <li key={i}>
                Round {i + 1}: {Math.floor(d / 60).toString().padStart(2, '0')}:
                {(d % 60).toString().padStart(2, '0')}
              </li>
            ))}
          </ul>
          <button
            onClick={handleRestart}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
            }}
          >
            Restart Session
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
