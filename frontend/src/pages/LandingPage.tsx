import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Icon from '../components/shared/Icon'

export default function LandingPage() {
  /* ── Hero Cycling Frames ── */
  const [currentFrame, setCurrentFrame] = useState(0)
  const [reelProgress, setReelProgress] = useState(0)
  const [muted, setMuted] = useState(true)

  const reelFrames = [
    {
      url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1920&q=80',
      title: 'Harvest Intake & Sacks Weighing',
      subtitle: 'Precision Platform Scales',
    },
    {
      url: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1920&q=80',
      title: 'Automated 3-Tier Potato Grading',
      subtitle: 'Grade A, B, and C Sorting',
    },
    {
      url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80',
      title: '1 kg Pouch Packaging Line',
      subtitle: 'GS1 Digital Link Pouch Barcodes',
    },
    {
      url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1920&q=80',
      title: 'Warehouse Pallet Stacking & Cold Storage',
      subtitle: 'RFID & Pallet Label Tracking',
    },
    {
      url: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1920&q=80',
      title: 'Export Load Verification',
      subtitle: 'ITF-14 Logistics Dispatch',
    },
  ]

  const FRAME_DURATION = 5000

  useEffect(() => {
    const interval = 50
    const timer = setInterval(() => {
      setReelProgress((prev) => {
        if (prev >= 100) {
          setCurrentFrame((cur) => (cur + 1) % reelFrames.length)
          return 0
        }
        return prev + (interval / FRAME_DURATION) * 100
      })
    }, interval)

    return () => clearInterval(timer)
  }, [reelFrames.length])

  /* ── Animated Number Counters on Scroll ── */
  const [counters, setCounters] = useState({
    years: 0,
    farmers: 0,
    tons: 0,
    stations: 0,
  })
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsAnimated, setStatsAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !statsAnimated) {
          setStatsAnimated(true)
          const duration = 1800
          const start = performance.now()
          const targets = { years: 12, farmers: 850, tons: 1240, stations: 24 }

          const animate = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const easeOut = 1 - Math.pow(1 - progress, 3)

            setCounters({
              years: Math.floor(easeOut * targets.years),
              farmers: Math.floor(easeOut * targets.farmers),
              tons: Math.floor(easeOut * targets.tons),
              stations: Math.floor(easeOut * targets.stations),
            })

            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              setCounters(targets)
            }
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )

    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [statsAnimated])

  /* ── Filter Pills for Programs/Stations ── */
  const [activeCategory, setActiveCategory] = useState<'all' | 'weighing' | 'sorting' | 'packaging'>('all')

  /* ── Flip Card Click Handling for Touch Devices ── */
  const [flippedCard, setFlippedCard] = useState<number | null>(null)

  const toggleFlip = (index: number) => {
    setFlippedCard(flippedCard === index ? null : index)
  }

  /* ── Stories Carousel ── */
  const [storyIndex, setStoryIndex] = useState(0)

  const stories = [
    {
      caseId: 'CASE / 01',
      badge: '-28% TARE LOSS',
      farmer: 'SARAH K. · DIENG',
      duration: '8 MONTHS',
      quote:
        'The live Modbus tare lock eliminated discrepancies between farm delivery and intake receipt. Every single sack is accounted for with zero manual recalculation errors.',
      metric1: { val: '-28', label: 'Tare Variance' },
      metric2: { val: '+18%', label: 'Gross Margin' },
      metric3: { val: '8', label: 'Harvest Cycles' },
      img: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'CASE / 02',
      badge: '+14 TONS LOGGED',
      farmer: 'DAVID L. · PANGALENGAN',
      duration: '12 MONTHS',
      quote:
        'Sorting potato harvest into Grade A, B, and C directly onto labelled pallets without rescanning boosted our packhouse throughput by more than threefold.',
      metric1: { val: '+14', label: 'Tons Certified' },
      metric2: { val: '120', label: 'Pallets Sealed' },
      metric3: { val: '12', label: 'Months Active' },
      img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'CASE / 03',
      badge: '42 TONS EXPORTED',
      farmer: 'MAYA R. · BROMO HIGHLANDS',
      duration: '14 MONTHS',
      quote:
        'Buyers scan the GS1 QR on each 1 kg pouch and instantly view the whole harvest journey. It unlocked premium export contracts across Southeast Asia.',
      metric1: { val: '42', label: 'Tons Export' },
      metric2: { val: '100%', label: 'GS1 Compliant' },
      metric3: { val: '14', label: 'Months Export' },
      img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'CASE / 04',
      badge: 'ZERO PACKING ERRORS',
      farmer: 'JAMES T. · WONOSOBO CO-OP',
      duration: '10 MONTHS',
      quote:
        'Having 3 dedicated packaging stations with channel-isolated scale transmitters allows 3 operators to bag and print labels simultaneously with zero collisions.',
      metric1: { val: '3,800', label: 'Pouches / Day' },
      metric2: { val: '0', label: 'Channel Conflict' },
      metric3: { val: '10', label: 'Months Live' },
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'CASE / 05',
      badge: '-12% POST-HARVEST',
      farmer: 'PRIYA N. · TOSARI AGRI',
      duration: '6 MONTHS',
      quote:
        'Real-time weight calibration and instant QR pallet label generation turned what used to take 2 hours of manual ledger bookkeeping into a 15-second operation.',
      metric1: { val: '-12%', label: 'Transit Loss' },
      metric2: { val: '+24%', label: 'Speed Index' },
      metric3: { val: '6', label: 'Months Run' },
      img: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'CASE / 06',
      badge: 'PRO CERTIFIED',
      farmer: 'CARLOS M. · CIWIDEY VALLEY',
      duration: '18 MONTHS',
      quote:
        'The public traceability web viewer built into the system provides full transparency to consumers without requiring them to install any application.',
      metric1: { val: '18,500', label: 'Consumer Scans' },
      metric2: { val: '+35%', label: 'Brand Value' },
      metric3: { val: '18', label: 'Months Tracked' },
      img: 'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=600&q=80',
    },
  ]

  const handleNextStory = () => {
    setStoryIndex((prev) => (prev + 1) % stories.length)
  }

  const handlePrevStory = () => {
    setStoryIndex((prev) => (prev - 1 + stories.length) % stories.length)
  }

  /* ── Booking Form State & Toast ── */
  const [selectedGoal, setSelectedGoal] = useState('granola')
  const [selectedShift, setSelectedShift] = useState('morning')
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState({ title: '', desc: '' })

  const handleBookingSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setToastMessage({
      title: 'Trial request received',
      desc: 'Our deployment team will verify your packhouse setup within 24 hours.',
    })
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 5000)
    ;(e.target as HTMLFormElement).reset()
  }

  /* ── Sticky CTA Bar Visibility on Scroll ── */
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const hero = document.getElementById('hero')
      const booking = document.getElementById('booking')
      if (!hero || !booking) return

      const heroBottom = hero.getBoundingClientRect().bottom
      const bookingTop = booking.getBoundingClientRect().top
      const windowHeight = window.innerHeight

      const pastHero = heroBottom < 0
      const reachedBooking = bookingTop < windowHeight && bookingTop > -500

      setStickyVisible(pastHero && !reachedBooking)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#eff6ff] selection:text-[#0070f3] overflow-x-hidden relative">
      {/* ── Sub-pixel Grain Overlay ── */}
      <div
        className="fixed inset-[-10%] pointer-events-none z-[190] opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='250'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        }}
        aria-hidden="true"
      />

      {/* ── Scoped CSS Styles ── */}
      <style>{`
        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }
        .font-heading { font-family: 'Oswald', sans-serif; }
        .font-mono-custom { font-family: 'JetBrains Mono', monospace; }

        .text-stroke {
          -webkit-text-stroke: 1.5px rgba(23, 23, 23, 0.3);
          color: transparent;
        }
        .text-stroke-white {
          -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.4);
          color: transparent;
        }

        @keyframes kenburns {
          0% { transform: scale(1.04) translate(0, 0); }
          100% { transform: scale(1.15) translate(-2%, -2%); }
        }
        .reel-active-img {
          animation: kenburns 7s ease-out forwards;
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          animation: marquee 32s linear infinite;
          width: max-content;
        }

        .flip-card {
          perspective: 1800px;
          min-height: 540px;
        }
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.8s cubic-bezier(0.4, 0.2, 0.2, 1);
          transform-style: preserve-3d;
        }
        .flip-card:hover .flip-card-inner,
        .flip-card.flipped .flip-card-inner {
          transform: rotateY(180deg);
        }
        .flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flip-back {
          transform: rotateY(180deg);
        }

        .notch-corner {
          position: relative;
        }
        .notch-corner::before,
        .notch-corner::after {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          border: 1.5px solid #0070f3;
          pointer-events: none;
        }
        .notch-corner::before {
          top: -1px;
          left: -1px;
          border-right: none;
          border-bottom: none;
        }
        .notch-corner::after {
          bottom: -1px;
          right: -1px;
          border-left: none;
          border-top: none;
        }

        .booking-frame {
          position: relative;
          background: #ffffff;
          border: 1px solid #eaeaea;
        }
        .booking-frame::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 48px;
          height: 48px;
          border-top: 2px solid #0070f3;
          border-left: 2px solid #0070f3;
          pointer-events: none;
        }
        .booking-frame::after {
          content: '';
          position: absolute;
          bottom: 0;
          right: 0;
          width: 48px;
          height: 48px;
          border-bottom: 2px solid #0070f3;
          border-right: 2px solid #0070f3;
          pointer-events: none;
        }

        @keyframes wave {
          0%, 100% { height: 3px; }
          50% { height: 15px; }
        }
        .wave-bar {
          display: inline-block;
          width: 2px;
          background: #0070f3;
          margin: 0 1px;
          height: 3px;
          vertical-align: bottom;
        }
        .unmuted .wave-bar {
          animation: wave 0.7s ease-in-out infinite;
        }
        .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .wave-bar:nth-child(4) { animation-delay: 0.3s; }
        .wave-bar:nth-child(5) { animation-delay: 0.4s; }

        @keyframes pulse-btn-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(0, 112, 243, 0.4), 0 4px 12px rgba(0, 112, 243, 0.2);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(0, 112, 243, 0), 0 4px 12px rgba(0, 112, 243, 0.2);
          }
        }
        .pulse-btn {
          animation: pulse-btn-glow 2.4s ease-out infinite;
        }
      `}</style>

      {/* ── Top Header Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/90 border-b border-[#eaeaea]">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <Logo className="h-8 w-auto" markOnly />
            <div>
              <div className="font-display text-2xl leading-none tracking-wider text-[#171717] flex items-center gap-2">
                ENYX-SMART HUB
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                TRACEABILITY · ENTERPRISE
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 font-heading text-xs uppercase tracking-[0.18em] text-[#666666]">
            <a href="#pipeline" className="hover:text-[#171717] transition-colors">
              Pipelines
            </a>
            <a href="#hardware" className="hover:text-[#171717] transition-colors">
              Hardware
            </a>
            <a href="#stories" className="hover:text-[#171717] transition-colors">
              Cases
            </a>
            <a href="#booking" className="hover:text-[#171717] transition-colors">
              Deployment
            </a>
            <Link to="/traceability" className="hover:text-[#0070f3] text-[#0070f3] font-semibold transition-colors">
              Public Trace
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 font-mono-custom text-[11px] text-[#666666] border border-[#eaeaea] bg-[#f5f5f5] px-3 py-1.5 rounded-sm">
              <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse"></span>
              <span>LIVE TELEMETRY · 192.168.1.50</span>
            </div>
            <Link
              to="/login"
              className="font-heading text-xs tracking-[0.18em] uppercase text-white bg-[#000000] px-5 py-2.5 hover:bg-[#333333] transition-colors rounded-sm"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative h-screen min-h-[760px] w-full overflow-hidden bg-[#050505]" id="hero">
        {/* Cycling Frames */}
        <div className="absolute inset-0">
          {reelFrames.map((frame, index) => (
            <div
              key={frame.title}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentFrame ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={frame.url}
                alt={frame.title}
                className={`w-full h-full object-cover filter brightness-[0.38] contrast-[1.3] ${
                  index === currentFrame ? 'reel-active-img' : ''
                }`}
              />
            </div>
          ))}
        </div>

        {/* Hero Overlays */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, rgba(5,5,5,0.85) 0%, rgba(5,5,5,0.4) 35%, rgba(5,5,5,0.6) 70%, rgba(5,5,5,0.95) 100%),
              linear-gradient(90deg, rgba(5,5,5,0.9) 0%, rgba(5,5,5,0.3) 60%, rgba(5,5,5,0.7) 100%)`,
          }}
        />

        {/* Hero Content */}
        <div className="relative z-20 h-full max-w-[1600px] mx-auto px-6 lg:px-10 flex flex-col justify-end pb-24 pt-32 text-white">
          {/* Top Right Live Telemetry Controls */}
          <div className="absolute top-28 right-6 lg:right-10 flex items-center gap-4 z-30">
            <div className="hidden sm:flex items-center gap-2 font-mono-custom text-[11px] text-white/80 bg-black/50 border border-white/10 px-3 py-1.5 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#0070f3] animate-ping"></span>
              <span className="tracking-[0.2em]">MODBUS TCP · STREAM</span>
            </div>

            <button
              onClick={() => setMuted(!muted)}
              className={`flex items-center gap-2.5 px-3.5 py-2 border border-white/20 bg-black/60 backdrop-blur-md transition-colors hover:border-[#0070f3] ${
                !muted ? 'unmuted' : ''
              }`}
            >
              <div className="flex items-end gap-[2px] h-3.5">
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
              </div>
              <span className="font-mono-custom text-[10px] tracking-[0.2em] uppercase text-white/90">
                {muted ? 'Telemetry Off' : 'Live Audio'}
              </span>
            </button>
          </div>

          {/* Main Headline */}
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#0070f3] tracking-[0.25em] uppercase mb-4">
              <span className="w-8 h-[2px] bg-[#0070f3]"></span>
              <span>EST. 2024 · IOT SMART PACKHOUSE</span>
            </div>

            <h1 className="font-display text-[13vw] md:text-[9.5vw] lg:text-[7.5vw] leading-[0.85] mb-6 tracking-tight">
              <span className="block">BUILT BY DATA.</span>
              <span className="block text-stroke-white">VERIFIED IN SCALE.</span>
              <span className="block">
                TRACEABLE IN <span className="text-[#0070f3]">FULL.</span>
              </span>
            </h1>

            <p className="max-w-2xl text-white/80 text-base md:text-lg leading-relaxed font-body">
              Enterprise potato traceability system linking farm intake, 3-tier grading, and 1 kg pouch
              packaging directly to GS1 Digital Link barcodes. Hardware-integrated, tamper-resistant, and verified
              end-to-end.
            </p>
          </div>

          {/* Bottom Hero Strip */}
          <div className="mt-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 pt-8 border-t border-white/10">
            {/* Operator and Station Staff Preview */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <div className="w-11 h-11 rounded-full border-2 border-black bg-[#171717] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  <Icon name="scale" size={16} />
                </div>
                <div className="w-11 h-11 rounded-full border-2 border-black bg-[#0070f3] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  <Icon name="sortir" size={16} />
                </div>
                <div className="w-11 h-11 rounded-full border-2 border-black bg-[#15803d] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  <Icon name="package" size={16} />
                </div>
                <div className="w-11 h-11 rounded-full border-2 border-black bg-white flex items-center justify-center text-xs font-mono-custom text-black font-bold">
                  +3
                </div>
              </div>
              <div>
                <div className="font-mono-custom text-[10px] tracking-[0.2em] text-white/60 uppercase">
                  ACTIVE PACKHOUSE STATIONS
                </div>
                <div className="font-heading text-sm text-white tracking-wider">
                  3 Modbus Isolated Channels · FreeRTOS Firmware
                </div>
              </div>
            </div>

            {/* Reel Progress & Chapter */}
            <div className="flex items-center gap-5 max-w-md w-full lg:w-auto">
              <div className="font-mono-custom text-[11px] text-white/60 tracking-[0.2em]">
                {String(currentFrame + 1).padStart(2, '0')} / {String(reelFrames.length).padStart(2, '0')}
              </div>
              <div className="flex-1 h-[2px] bg-white/20 overflow-hidden rounded-full">
                <div
                  className="h-full bg-[#0070f3] transition-all duration-75"
                  style={{ width: `${reelProgress}%` }}
                />
              </div>
              <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase">
                {reelFrames[currentFrame].subtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Scrolling Ticker Marquee */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-md py-3 overflow-hidden z-20">
          <div className="marquee-track font-heading text-xs tracking-[0.25em] uppercase text-white/70">
            <span className="px-8">WEIGHED & APPROVED</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">GS1 DIGITAL LINK</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">MODBUS TCP INTEGRATION</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">SINGLE CANONICAL SORTING</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">ZERO WEIGHT CONFLICT</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">PUBLIC QR TRACEABILITY</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">FIELD TO EXPORT CONTAINER</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">WEIGHED & APPROVED</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">GS1 DIGITAL LINK</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">MODBUS TCP INTEGRATION</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">SINGLE CANONICAL SORTING</span>
            <span className="text-[#0070f3]">/</span>
            <span className="px-8">ZERO WEIGHT CONFLICT</span>
            <span className="text-[#0070f3]">/</span>
          </div>
        </div>
      </section>

      {/* ── STATS SECTION ── */}
      <section className="border-b border-[#eaeaea] bg-white relative" ref={statsRef}>
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            <div className="border-l-2 border-[#eaeaea] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#171717] tabular-nums">
                {counters.years}+
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Operational Hubs
              </div>
            </div>

            <div className="border-l-2 border-[#0070f3] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#0070f3] tabular-nums">
                {counters.farmers}+
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Registered Farmers
              </div>
            </div>

            <div className="border-l-2 border-[#eaeaea] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#171717] tabular-nums">
                {counters.tons.toLocaleString()}+
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Tons Net Weighed
              </div>
            </div>

            <div className="border-l-2 border-[#eaeaea] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#171717] tabular-nums">
                {counters.stations}
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Connected IoT Scales
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CURRICULUM / OPERATIONAL PIPELINES ── */}
      <section className="py-24 lg:py-32 bg-[#fafafa]" id="pipeline">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-8 mb-16 items-end">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#0070f3] tracking-[0.25em] uppercase mb-4">
                <span className="w-8 h-[2px] bg-[#0070f3]"></span>
                <span>02 — Operational Pipeline</span>
              </div>
              <h2 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
                Three stations.<br />
                <span className="text-stroke">One outcome:</span><br />
                <span className="text-[#0070f3]">100% verified trace.</span>
              </h2>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-end">
              <p className="text-[#666666] text-lg leading-relaxed mb-6 font-body">
                Every workstation in ENYX-Smart Hub is engineered to eliminate data leakage and manual
                tampering. Choose a station workflow below to inspect hardware specs and protocol standards.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'all'
                      ? 'bg-[#0070f3] border-[#0070f3] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  All Stations
                </button>
                <button
                  onClick={() => setActiveCategory('weighing')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'weighing'
                      ? 'bg-[#0070f3] border-[#0070f3] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  Weighing
                </button>
                <button
                  onClick={() => setActiveCategory('sorting')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'sorting'
                      ? 'bg-[#0070f3] border-[#0070f3] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  Sorting
                </button>
                <button
                  onClick={() => setActiveCategory('packaging')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'packaging'
                      ? 'bg-[#0070f3] border-[#0070f3] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  Packaging
                </button>
              </div>
            </div>
          </div>

          {/* Program / Station Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: Weighing Station */}
            {(activeCategory === 'all' || activeCategory === 'weighing') && (
              <article className="notch-corner border border-[#eaeaea] bg-white shadow-xs group transition-all duration-300 hover:shadow-md hover:border-[#0070f3]">
                <div className="relative h-64 overflow-hidden bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
                    alt="Intake Weighing Station"
                    className="w-full h-full object-cover filter contrast-[1.2] opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 font-mono-custom text-[11px] text-[#3291ff] tracking-[0.2em]">
                    01 / INTAKE WEIGHING
                  </div>
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-[#0070f3] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                    DUAL PRINT OUTPUT
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="font-display text-4xl mb-3 text-[#171717]">INTAKE WEIGHING</h3>
                  <p className="text-[#666666] text-sm leading-relaxed mb-6 font-body">
                    Farmer ID identification, tare subtraction, live Modbus TCP stability detection, and automated
                    dual print: Farmer Receipt Slip & QR Pallet Label (PLT-...).
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6 pb-6 border-b border-[#eaeaea]">
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Protocol
                      </div>
                      <div className="font-heading text-base text-[#171717]">MODBUS TCP :502</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Capacity
                      </div>
                      <div className="font-heading text-base text-[#171717]">300 KG PLATFORM</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Stability
                      </div>
                      <div className="font-heading text-base text-[#171717]">±20 G / 2.0 SEC</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Focus Mode
                      </div>
                      <div className="font-heading text-base text-[#171717]">FULLSCREEN STEPPER</div>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/weighing"
                    className="flex items-center justify-between font-heading text-sm tracking-[0.15em] uppercase text-[#171717] hover:text-[#0070f3] transition-colors"
                  >
                    <span>Launch Station</span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </article>
            )}

            {/* Card 2: Sorting Station */}
            {(activeCategory === 'all' || activeCategory === 'sorting') && (
              <article className="notch-corner border border-[#eaeaea] bg-white shadow-xs group transition-all duration-300 hover:shadow-md hover:border-[#0070f3]">
                <div className="relative h-64 overflow-hidden bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80"
                    alt="Sorting Station"
                    className="w-full h-full object-cover filter contrast-[1.2] opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 font-mono-custom text-[11px] text-[#3291ff] tracking-[0.2em]">
                    02 / CLASSIFICATION
                  </div>
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-[#15803d] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                    CANONICAL SORTING
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="font-display text-4xl mb-3 text-[#171717]">SORTING STATION</h3>
                  <p className="text-[#666666] text-sm leading-relaxed mb-6 font-body">
                    Strict canonical sorting workflow: scan the intake pallet code, allocate into Grade A, B, or C,
                    and print the designated Pallet Grade Label (GRD-PLT-...-[GRADE]).
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6 pb-6 border-b border-[#eaeaea]">
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Input
                      </div>
                      <div className="font-heading text-base text-[#171717]">INTAKE PALLET QR</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Outputs
                      </div>
                      <div className="font-heading text-base text-[#171717]">GRADE A / B / C</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Speed
                      </div>
                      <div className="font-heading text-base text-[#171717]">1-TOUCH APPROVAL</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Standard
                      </div>
                      <div className="font-heading text-base text-[#171717]">ZERO RE-WEIGH FORM</div>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/sorting"
                    className="flex items-center justify-between font-heading text-sm tracking-[0.15em] uppercase text-[#171717] hover:text-[#0070f3] transition-colors"
                  >
                    <span>Launch Station</span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </article>
            )}

            {/* Card 3: Packaging Station */}
            {(activeCategory === 'all' || activeCategory === 'packaging') && (
              <article className="notch-corner border border-[#eaeaea] bg-white shadow-xs group transition-all duration-300 hover:shadow-md hover:border-[#0070f3]">
                <div className="relative h-64 overflow-hidden bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80"
                    alt="Packaging Station"
                    className="w-full h-full object-cover filter contrast-[1.2] opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 font-mono-custom text-[11px] text-[#3291ff] tracking-[0.2em]">
                    03 / RETAIL POUCH
                  </div>
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-[#171717] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                    3-CHANNEL CLUSTER
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="font-display text-4xl mb-3 text-[#171717]">PACKAGING STATION</h3>
                  <p className="text-[#666666] text-sm leading-relaxed mb-6 font-body">
                    Three parallel live scale channels for Grade A, B, and C operators. Real-time 1 kg target progress,
                    instant approval, and GS1 Digital Link pouch sticker printing.
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6 pb-6 border-b border-[#eaeaea]">
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Target Unit
                      </div>
                      <div className="font-heading text-base text-[#171717]">1.000 KG POUCH</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Tolerance
                      </div>
                      <div className="font-heading text-base text-[#171717]">±5 GRAMS</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Format
                      </div>
                      <div className="font-heading text-base text-[#171717]">GS1 QR / EAN-13</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Concurrency
                      </div>
                      <div className="font-heading text-base text-[#171717]">3 OPERATORS LIVE</div>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/packaging"
                    className="flex items-center justify-between font-heading text-sm tracking-[0.15em] uppercase text-[#171717] hover:text-[#0070f3] transition-colors"
                  >
                    <span>Launch Station</span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </article>
            )}
          </div>
        </div>
      </section>

      {/* ── HARDWARE ARCHITECTURE / FLIP CARDS (COACHES) ── */}
      <section className="py-24 lg:py-32 bg-[#f0f2f5] border-y border-[#eaeaea]" id="hardware">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-8 mb-16 items-end">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#0070f3] tracking-[0.25em] uppercase mb-4">
                <span className="w-8 h-[2px] bg-[#0070f3]"></span>
                <span>03 — Hardware & Stations</span>
              </div>
              <h2 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
                Systems that <span className="text-[#0070f3]">verify</span>,<br />
                hardware that <span className="text-stroke">endures.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-end">
              <p className="text-[#666666] text-base leading-relaxed font-body">
                Each packhouse module runs on dedicated dual-core firmware with hardware watchdog timers and
                fail-safe state recovery. Hover or tap any unit to view technical architecture specifications.
              </p>
            </div>
          </div>

          {/* 4 Flip Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Flip Card 1 */}
            <div
              className={`flip-card cursor-pointer ${flippedCard === 1 ? 'flipped' : ''}`}
              onClick={() => toggleFlip(1)}
            >
              <div className="flip-card-inner">
                {/* Front */}
                <div className="flip-face flip-front border border-[#eaeaea] bg-white flex flex-col shadow-xs">
                  <div className="relative h-64 overflow-hidden bg-black">
                    <img
                      src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80"
                      alt="Weight Transmitter Module"
                      className="w-full h-full object-cover filter contrast-[1.25] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#3291ff] tracking-[0.2em]">
                      / 01
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      DUAL-CORE RTOS
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">WEIGHT TRANSMITTER</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        ESP32-S3 N16R8 · HX711 HAL
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        MODBUS TCP :502
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#0070f3] tracking-wider font-semibold">
                        SPECS →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#0070f3] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-3">
                      / Architecture Specs
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">HARDWARE REVISION 1.7</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Median-of-5 Spike Rejection Filter</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Adaptive Exponential Moving Average</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Two-offset Tare & Zero point persistence</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>W5500 Ethernet + Fallback WiFi STA</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Stability Bit</div>
                    <div className="font-display text-xl text-[#0070f3]">HOLDING REG 0x0010</div>
                    <p className="text-[11px] text-[#666666] mt-1">±20 g threshold held for 2.000 ms lock.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flip Card 2 */}
            <div
              className={`flip-card cursor-pointer ${flippedCard === 2 ? 'flipped' : ''}`}
              onClick={() => toggleFlip(2)}
            >
              <div className="flip-card-inner">
                {/* Front */}
                <div className="flip-face flip-front border border-[#eaeaea] bg-white flex flex-col shadow-xs">
                  <div className="relative h-64 overflow-hidden bg-black">
                    <img
                      src="https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80"
                      alt="Pallet QR Label Engine"
                      className="w-full h-full object-cover filter contrast-[1.25] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#3291ff] tracking-[0.2em]">
                      / 02
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      QR + THERMAL
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">LABEL ENGINE</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        Dual Receipt & QR Thermal
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        AUTO-GENERATION
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#0070f3] tracking-wider font-semibold">
                        SPECS →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#0070f3] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-3">
                      / Print Engine Specs
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">DUAL OUTPUT MATRIX</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Struk Petani: 58 mm / 80 mm Thermal slip</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Pallet Label: 100×150 mm Weatherproof</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Zero Dialog Preview modal option</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>High-contrast visual fallback printer</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Standard Prefix</div>
                    <div className="font-display text-xl text-[#0070f3]">PLT-YYYYMMDD-XXXX</div>
                    <p className="text-[11px] text-[#666666] mt-1">Single atomic commit per weighing session.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flip Card 3 */}
            <div
              className={`flip-card cursor-pointer ${flippedCard === 3 ? 'flipped' : ''}`}
              onClick={() => toggleFlip(3)}
            >
              <div className="flip-card-inner">
                {/* Front */}
                <div className="flip-face flip-front border border-[#eaeaea] bg-white flex flex-col shadow-xs">
                  <div className="relative h-64 overflow-hidden bg-black">
                    <img
                      src="https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80"
                      alt="3-Channel Packaging Scale"
                      className="w-full h-full object-cover filter contrast-[1.25] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#3291ff] tracking-[0.2em]">
                      / 03
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      CONCURRENCY
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">PACKAGING CLUSTER</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        3 Parallel Scale Channels
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        1 KG POUCH SPEC
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#0070f3] tracking-wider font-semibold">
                        SPECS →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#0070f3] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-3">
                      / Packaging Protocol
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">CHANNEL ISOLATION</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Station A: IP .50 · Grade A Dedication</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Station B: IP .51 · Grade B Dedication</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Station C: IP .52 · Grade C Dedication</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Automatic port offset avoidance</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Target Calibration</div>
                    <div className="font-display text-xl text-[#0070f3]">1.000 KG ± 0.005 KG</div>
                    <p className="text-[11px] text-[#666666] mt-1">Live bar indicator locks upon stability window.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flip Card 4 */}
            <div
              className={`flip-card cursor-pointer ${flippedCard === 4 ? 'flipped' : ''}`}
              onClick={() => toggleFlip(4)}
            >
              <div className="flip-card-inner">
                {/* Front */}
                <div className="flip-face flip-front border border-[#eaeaea] bg-white flex flex-col shadow-xs">
                  <div className="relative h-64 overflow-hidden bg-black">
                    <img
                      src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=600&q=80"
                      alt="Public Traceability Web Engine"
                      className="w-full h-full object-cover filter contrast-[1.25] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#3291ff] tracking-[0.2em]">
                      / 04
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      PUBLIC PORTAL
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">TRACE ENGINE</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        GS1 Digital Link URI Schema
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        ZERO-LOGIN SCAN
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#0070f3] tracking-wider font-semibold">
                        SPECS →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#0070f3] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-3">
                      / Traceability Engine
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">GS1 DIGITAL LINK</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Direct phone camera browser redirection</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Farmer profile, elevation, harvest date</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Grading batch certificate & QA approval</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#0070f3] shrink-0" />
                        <span>Cold-chain transit & delivery timeline</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">URI Standard</div>
                    <div className="font-display text-xl text-[#0070f3]">/01/GTIN/21/SERIAL</div>
                    <p className="text-[11px] text-[#666666] mt-1">Conforms to GS1 General Specifications Release 23.0.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MEMBER STORIES / HARVEST JOURNEYS CAROUSEL ── */}
      <section className="py-24 lg:py-32 bg-white relative overflow-hidden" id="stories">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 mb-14">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#0070f3] tracking-[0.25em] uppercase mb-4">
                <span className="w-8 h-[2px] bg-[#0070f3]"></span>
                <span>04 — Verified in the Field</span>
              </div>
              <h2 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
                Real harvests.<br />
                <span className="text-[#0070f3]">Relentless</span> traceability.
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-end">
              <p className="text-[#666666] text-base leading-relaxed mb-4 font-body">
                Every verified record in our database originates from actual IoT scale readings. Explore real harvest
                batches tracked from the field through the ENYX-Smart Hub ecosystem.
              </p>
              <div className="flex items-center gap-3 font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                <Icon name="scan" size={13} className="text-[#0070f3]" />
                <span>Swipeable · Interactive Records · Active Batches</span>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Container */}
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="overflow-hidden cursor-grab active:cursor-grabbing select-none">
            <div
              className="flex gap-6 transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${storyIndex * (100 / (window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3))}%)` }}
            >
              {stories.map((story) => (
                <article
                  key={story.caseId}
                  className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] shrink-0 border border-[#eaeaea] bg-white shadow-xs hover:border-[#0070f3] transition-colors"
                >
                  <div className="relative h-56 overflow-hidden bg-black">
                    <img
                      src={story.img}
                      alt={story.farmer}
                      className="w-full h-full object-cover filter contrast-[1.2] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#3291ff] tracking-[0.2em]">
                      {story.caseId}
                    </div>
                    <div className="absolute bottom-4 right-4 px-2.5 py-1 bg-[#0070f3] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                      {story.badge}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-2xl text-[#171717]">{story.farmer}</h3>
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        {story.duration}
                      </span>
                    </div>

                    <p className="text-[#525252] text-sm leading-relaxed mb-6 italic font-body">
                      "{story.quote}"
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#eaeaea]">
                      <div>
                        <div className="font-display text-2xl text-[#0070f3]">{story.metric1.val}</div>
                        <div className="font-mono-custom text-[9px] text-[#666666] tracking-wider uppercase">
                          {story.metric1.label}
                        </div>
                      </div>
                      <div>
                        <div className="font-display text-2xl text-[#171717]">{story.metric2.val}</div>
                        <div className="font-mono-custom text-[9px] text-[#666666] tracking-wider uppercase">
                          {story.metric2.label}
                        </div>
                      </div>
                      <div>
                        <div className="font-display text-2xl text-[#171717]">{story.metric3.val}</div>
                        <div className="font-mono-custom text-[9px] text-[#666666] tracking-wider uppercase">
                          {story.metric3.label}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Carousel Controls */}
          <div className="mt-10 flex items-center justify-between">
            {/* Progress Dots */}
            <div className="flex items-center gap-2">
              {stories.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStoryIndex(i)}
                  className={`transition-all duration-300 rounded-full h-1 ${
                    i === storyIndex ? 'w-8 bg-[#0070f3]' : 'w-2 bg-[#d1d5db]'
                  }`}
                  aria-label={`Go to case ${i + 1}`}
                />
              ))}
            </div>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevStory}
                className="w-10 h-10 border border-[#eaeaea] bg-white hover:border-[#0070f3] hover:text-[#0070f3] flex items-center justify-center transition-colors shadow-xs"
                aria-label="Previous case"
              >
                <Icon name="arrow-left" size={14} />
              </button>
              <button
                onClick={handleNextStory}
                className="w-10 h-10 border border-[#eaeaea] bg-white hover:border-[#0070f3] hover:text-[#0070f3] flex items-center justify-center transition-colors shadow-xs"
                aria-label="Next case"
              >
                <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOOKING & TRIAL SESSION REQUEST ── */}
      <section className="py-24 lg:py-32 bg-[#fafafa] border-t border-[#eaeaea]" id="booking">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="mb-14">
            <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#0070f3] tracking-[0.25em] uppercase mb-4">
              <span className="w-8 h-[2px] bg-[#0070f3]"></span>
              <span>05 — Begin the Deployment</span>
            </div>
            <h2 className="font-display text-6xl md:text-7xl lg:text-[7rem] leading-[0.9]">
              STOP GUESSING.<br />
              <span className="text-stroke">START</span> <span className="text-[#0070f3]">TRACING.</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Form Frame */}
            <div className="lg:col-span-7">
              <div className="booking-frame p-8 lg:p-12 shadow-sm">
                <div className="font-mono-custom text-[11px] text-[#0070f3] tracking-[0.2em] uppercase mb-2">
                  // Packhouse Onboarding Request
                </div>
                <h3 className="font-display text-4xl mb-2 text-[#171717]">SCHEDULE A SMART HUB DEMO</h3>
                <p className="text-[#666666] text-sm mb-8 font-body">
                  Schedule an on-site evaluation, scale transmitter configuration test, and simulated GS1 packaging workflow.
                </p>

                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase mb-1">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        className="w-full bg-transparent border-b border-[#d1d5db] py-2.5 text-base font-heading focus:outline-none focus:border-[#0070f3] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase mb-1">
                        Phone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+62 812 3456 7890"
                        className="w-full bg-transparent border-b border-[#d1d5db] py-2.5 text-base font-heading focus:outline-none focus:border-[#0070f3] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase mb-1">
                      Organization / Packhouse Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="packhouse@cooperative.id"
                      className="w-full bg-transparent border-b border-[#d1d5db] py-2.5 text-base font-heading focus:outline-none focus:border-[#0070f3] transition-colors"
                    />
                  </div>

                  {/* Commodity Selector Pills */}
                  <div>
                    <label className="block font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase mb-2">
                      Primary Potato Variety
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'granola', label: 'Granola Table' },
                        { id: 'atlantic', label: 'Atlantic Processing' },
                        { id: 'chippewa', label: 'Chippewa' },
                        { id: 'seed', label: 'G0/G2 Seed Stock' },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setSelectedGoal(item.id)}
                          className={`px-3.5 py-1.5 font-heading text-xs uppercase tracking-wider border transition-all ${
                            selectedGoal === item.id
                              ? 'bg-[#0070f3] border-[#0070f3] text-white font-semibold'
                              : 'bg-white border-[#eaeaea] text-[#666666] hover:border-[#d1d5db]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferred Shift Radios */}
                  <div>
                    <label className="block font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase mb-2">
                      Preferred Demonstration Time
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'morning', label: 'Morning Intake', sub: '05:00 - 09:00' },
                        { id: 'midday', label: 'Midday Shift', sub: '09:00 - 12:00' },
                        { id: 'afternoon', label: 'Afternoon Sort', sub: '12:00 - 17:00' },
                        { id: 'evening', label: 'Evening Dispatch', sub: '17:00 - 22:00' },
                      ].map((shift) => (
                        <label
                          key={shift.id}
                          onClick={() => setSelectedShift(shift.id)}
                          className={`cursor-pointer p-3 border text-center transition-all ${
                            selectedShift === shift.id
                              ? 'bg-[#0070f3] border-[#0070f3] text-white'
                              : 'bg-white border-[#eaeaea] text-[#666666] hover:border-[#d1d5db]'
                          }`}
                        >
                          <div className="font-heading text-xs uppercase tracking-wider">{shift.label}</div>
                          <div className="font-mono-custom text-[9px] mt-0.5 opacity-80">{shift.sub}</div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="pulse-btn w-full bg-[#000000] text-white py-4 font-display text-2xl tracking-wider hover:bg-[#333333] transition-colors flex items-center justify-center gap-3 rounded-sm"
                  >
                    <span>SUBMIT DEPLOYMENT REQUEST</span>
                    <Icon name="arrow-right" size={20} />
                  </button>

                  <p className="text-center font-mono-custom text-[10px] text-[#666666] tracking-wider uppercase">
                    Zero Commitment · Remote Modbus Verification Included · 24h Confirmation
                  </p>
                </form>
              </div>
            </div>

            {/* Info Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div className="border border-[#eaeaea] bg-white p-7 shadow-xs">
                <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-2">
                  / Hub Locations
                </div>
                <h4 className="font-display text-2xl mb-2 text-[#171717]">CENTRAL PACKHOUSE PILOT</h4>
                <p className="text-[#666666] text-sm leading-relaxed mb-4 font-body">
                  Pangalengan Agricultural Complex<br />
                  Bandung Regency, West Java 40378
                </p>
                <div className="flex items-center gap-2 font-mono-custom text-[11px] text-[#0070f3]">
                  <Icon name="location" size={13} />
                  <span>ELEVATION: 1,420M ASL · FIBER CONNECTED</span>
                </div>
              </div>

              <div className="border border-[#eaeaea] bg-white p-7 shadow-xs">
                <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-2">
                  / Operating Schedule
                </div>
                <h4 className="font-display text-2xl mb-3 text-[#171717]">ACTIVE INTAKE WINDOWS</h4>
                <div className="space-y-2 text-sm font-body">
                  <div className="flex justify-between border-b border-[#eaeaea] pb-2">
                    <span className="text-[#666666]">Monday — Friday</span>
                    <span className="font-mono-custom font-semibold text-[#171717]">05:00 — 23:00</span>
                  </div>
                  <div className="flex justify-between border-b border-[#eaeaea] pb-2">
                    <span className="text-[#666666]">Saturday (Peak Intake)</span>
                    <span className="font-mono-custom font-semibold text-[#171717]">06:00 — 21:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Sunday (Export Dispatch)</span>
                    <span className="font-mono-custom font-semibold text-[#171717]">07:00 — 18:00</span>
                  </div>
                </div>
              </div>

              <div className="border border-[#eaeaea] bg-white p-7 shadow-xs">
                <div className="font-mono-custom text-[10px] text-[#0070f3] tracking-[0.2em] uppercase mb-2">
                  / Direct Engineer Contact
                </div>
                <h4 className="font-display text-2xl mb-3 text-[#171717]">TECHNICAL SUPPORT</h4>
                <div className="space-y-2.5 text-sm font-body">
                  <a
                    href="tel:+62215550100"
                    className="flex items-center gap-3 hover:text-[#0070f3] transition-colors text-[#525252]"
                  >
                    <Icon name="phone" size={14} className="text-[#0070f3]" />
                    <span className="font-mono-custom">+62 (21) 555-0100 (Packhouse Ops)</span>
                  </a>
                  <a
                    href="mailto:support@enyx.local"
                    className="flex items-center gap-3 hover:text-[#0070f3] transition-colors text-[#525252]"
                  >
                    <Icon name="send" size={14} className="text-[#0070f3]" />
                    <span className="font-mono-custom">engineering@enyx.local</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#eaeaea] bg-white py-16 relative overflow-hidden">
        {/* Giant Watermark Background */}
        <div
          className="font-display text-[16vw] leading-none text-stroke opacity-15 absolute bottom-[-5%] left-0 right-0 text-center pointer-events-none select-none z-0"
          aria-hidden="true"
        >
          TRACEABILITY
        </div>

        <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="grid md:grid-cols-12 gap-10 mb-12">
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <Logo className="h-8 w-auto" markOnly />
                <div>
                  <div className="font-display text-2xl leading-none tracking-wider text-[#171717]">
                    ENYX-SMART HUB
                  </div>
                  <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                    POTATO TRACEABILITY SYSTEM
                  </div>
                </div>
              </div>
              <p className="text-[#666666] text-sm leading-relaxed max-w-md mb-6 font-body">
                Modular IoT platform uniting smart platform scales, optical grading classification, and GS1 Digital Link
                pouch barcodes into a unified single source of truth for the potato supply chain.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#f5f5f5] text-[#525252] border border-[#eaeaea] px-2.5 py-1 font-mono-custom">
                  Type: enyx-enterprise
                </span>
                <span className="text-xs text-[#666666] font-mono-custom">
                  v1.0.0 (Production)
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <h5 className="font-mono-custom text-[11px] text-[#0070f3] tracking-[0.2em] uppercase mb-4 font-semibold">
                Workstations
              </h5>
              <ul className="space-y-2 text-sm font-heading tracking-wider uppercase text-[#666666]">
                <li>
                  <Link to="/dashboard/weighing" className="hover:text-[#171717] transition-colors">
                    Intake Weighing
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard/sorting" className="hover:text-[#171717] transition-colors">
                    Sorting Station
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard/packaging" className="hover:text-[#171717] transition-colors">
                    Pouch Packaging
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard/pallets" className="hover:text-[#171717] transition-colors">
                    Pallet Registry
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <h5 className="font-mono-custom text-[11px] text-[#0070f3] tracking-[0.2em] uppercase mb-4 font-semibold">
                Traceability
              </h5>
              <ul className="space-y-2 text-sm font-heading tracking-wider uppercase text-[#666666]">
                <li>
                  <Link to="/traceability" className="hover:text-[#171717] transition-colors">
                    Public Scan Portal
                  </Link>
                </li>
                <li>
                  <a href="#pipeline" className="hover:text-[#171717] transition-colors">
                    GS1 Digital Link
                  </a>
                </li>
                <li>
                  <a href="#hardware" className="hover:text-[#171717] transition-colors">
                    Modbus Telemetry
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-[#171717] transition-colors">
                    Operator Login
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <h5 className="font-mono-custom text-[11px] text-[#0070f3] tracking-[0.2em] uppercase mb-4 font-semibold">
                System Updates
              </h5>
              <p className="text-[#666666] text-xs mb-3 font-body">
                Subscribe for batch verification notices, firmware changelogs, and harvest summaries.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setToastMessage({
                    title: 'Subscription confirmed',
                    desc: 'You have been registered for automated telemetry updates.',
                  })
                  setToastVisible(true)
                  setTimeout(() => setToastVisible(false), 4000)
                }}
                className="flex border border-[#eaeaea] bg-white focus-within:border-[#0070f3] transition-colors"
              >
                <input
                  type="email"
                  required
                  placeholder="operator@cooperative.id"
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-[#171717] outline-none placeholder:text-[#999999]"
                />
                <button
                  type="submit"
                  className="px-3.5 bg-[#000000] text-white hover:bg-[#333333] transition-colors"
                  aria-label="Subscribe"
                >
                  <Icon name="arrow-right" size={13} />
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-[#eaeaea] pt-6 flex flex-col md:flex-row justify-between gap-4 text-[#666666] font-mono-custom text-[11px] tracking-wider uppercase">
            <div>© {new Date().getFullYear()} ENYX ENTERPRISE · TRACEABILITY SYSTEM</div>
            <div className="flex gap-6">
              <Link to="/traceability" className="hover:text-[#0070f3] transition-colors">
                Public Trace
              </Link>
              <Link to="/login" className="hover:text-[#0070f3] transition-colors">
                Sign In
              </Link>
              <a href="#hero" className="hover:text-[#0070f3] transition-colors">
                Back to Top ↑
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── STICKY CTA BAR ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 bg-white/95 backdrop-blur-md border-t border-[#0070f3]/40 shadow-lg ${
          stickyVisible ? 'translate-y-0' : 'translate-y-[110%]'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 font-mono-custom text-[11px] text-[#0070f3] tracking-wider font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#0070f3] animate-ping"></span>
              <span>LIVE PACKHOUSE TELEMETRY</span>
            </div>
            <div>
              <div className="font-display text-xl md:text-2xl leading-none text-[#171717]">
                READY TO TRACE YOUR HARVEST?
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-wider uppercase mt-0.5">
                WEIGHING · GRADING · 1 KG POUCH PACKAGING · GS1 DIGITAL LINK
              </div>
            </div>
          </div>

          <a
            href="#booking"
            className="pulse-btn bg-[#0070f3] text-white px-6 py-2.5 font-heading text-xs uppercase tracking-[0.18em] hover:bg-[#3291ff] transition-colors flex items-center gap-2 rounded-sm shrink-0 font-semibold"
          >
            <span>Deploy System</span>
            <Icon name="arrow-right" size={14} />
          </a>
        </div>
      </div>

      {/* ── SLIDE-IN TOAST NOTIFICATION ── */}
      <div
        className={`fixed top-20 right-6 z-[160] transition-transform duration-500 bg-white border border-[#0070f3] border-l-4 border-l-[#0070f3] p-4 shadow-xl max-w-sm ${
          toastVisible ? 'translate-x-0' : 'translate-x-[120%]'
        }`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 bg-[#0070f3] text-white flex items-center justify-center shrink-0 rounded-sm">
            <Icon name="check" size={14} />
          </div>
          <div>
            <div className="font-heading text-sm uppercase tracking-wider text-[#171717]">
              {toastMessage.title}
            </div>
            <div className="text-[#666666] text-xs mt-1 font-body">
              {toastMessage.desc}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
