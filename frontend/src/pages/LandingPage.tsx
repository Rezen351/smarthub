import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Icon from '../components/shared/Icon'

export default function LandingPage() {
  /* ── Hero Cycling Frames ── */
  const [currentFrame, setCurrentFrame] = useState(0)
  const [reelProgress, setReelProgress] = useState(0)
  const [backendStatus, setBackendStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING')

  useEffect(() => {
    let active = true
    const checkStatus = async () => {
      try {
        const res = await fetch('/health')
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'ok' || data.database === 'connected') {
            if (active) setBackendStatus('ONLINE')
            return
          }
        }
        if (active) setBackendStatus('OFFLINE')
      } catch {
        if (active) setBackendStatus('OFFLINE')
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

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
      subtitle: 'Product QR Pouch Labels',
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
      caseId: 'FARMER / 01',
      badge: 'FAIR WEIGHING',
      farmer: 'KANG ASEP · CIKAJANG, GARUT',
      duration: '8 MONTHS PARTNER',
      quote:
        'Before SmartGeulis, I was never certain if my potato sacks were weighed fairly by roaming buyers. Now, my receipt is printed right before my eyes the second my harvest lands on the scale. That trust means everything to my family.',
      metric1: { val: '100%', label: 'Fair Payout' },
      metric2: { val: '+18%', label: 'Family Income' },
      metric3: { val: '8', label: 'Harvest Cycles' },
      img: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'FARMER / 02',
      badge: 'COMMUNITY PRIDE',
      farmer: 'BU SITI · CISURUPAN, GARUT',
      duration: '12 MONTHS PARTNER',
      quote:
        'Seeing our village name appear on people phones when they buy potatoes in supermarkets fills our whole womens group with pride. We are no longer nameless growers—we are respected partners who feed families across Indonesia.',
      metric1: { val: '+14', label: 'Tons Harvested' },
      metric2: { val: '100%', label: 'Direct Trace' },
      metric3: { val: '12', label: 'Months Active' },
      img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'FARMER / 03',
      badge: 'ZERO WASTE',
      farmer: 'PAK ENDANG · BAYONGBONG, GARUT',
      duration: '14 MONTHS PARTNER',
      quote:
        'Sorting our potatoes into Grade A, B, and C means every single tuber finds its best home. Premium ones go to fresh food stores, while smaller potatoes go directly to local culinary makers. Nothing gets wasted or underpaid.',
      metric1: { val: '98.5%', label: 'Quality Score' },
      metric2: { val: '3', label: 'Clean Grades' },
      metric3: { val: '14', label: 'Months Partner' },
      img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'TEAM / 04',
      badge: 'PACKHOUSE TEAM',
      farmer: 'TEH RINA · GARUT OPERATIONS',
      duration: '10 MONTHS ACTIVE',
      quote:
        'Working in this packhouse is calm and uplifting. The scales are steady, the labels print instantly, and every potato is handled gently. We can prepare thousands of fresh bags every day knowing families will enjoy healthy food.',
      metric1: { val: '3,800', label: 'Bags / Day' },
      metric2: { val: '0', label: 'Weight Disputes' },
      metric3: { val: '10', label: 'Months Live' },
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'FARMER / 05',
      badge: 'FAST INTAKE',
      farmer: 'PAK UJANG · SUKARESMI, GARUT',
      duration: '6 MONTHS PARTNER',
      quote:
        'I used to wait hours in line just to get a handwritten note that easily got torn or lost. With SmartGeulis, I deliver my harvest in the morning, receive my official printed slip in two minutes, and return home with total confidence.',
      metric1: { val: '2 min', label: 'Average Intake' },
      metric2: { val: '100%', label: 'Clear Records' },
      metric3: { val: '6', label: 'Months Partner' },
      img: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&w=600&q=80',
    },
    {
      caseId: 'FAMILY / 06',
      badge: 'HAPPY CONSUMER',
      farmer: 'IBU LILIS · HOME COOK',
      duration: '18 MONTHS CUSTOMER',
      quote:
        'Whenever I buy potatoes for my children, scanning the QR code on the pouch shows the actual grower and harvest date. Knowing where my food came from gives me genuine peace of mind and connects my kitchen to real farmers.',
      metric1: { val: '18,500+', label: 'Family Scans' },
      metric2: { val: '0', label: 'Apps Required' },
      metric3: { val: '18', label: 'Months Trust' },
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
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#fff7ed] selection:text-[#ea580c] overflow-x-hidden relative">
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
          border: 1.5px solid #f97316;
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
          border-top: 2px solid #f97316;
          border-left: 2px solid #f97316;
          pointer-events: none;
        }
        .booking-frame::after {
          content: '';
          position: absolute;
          bottom: 0;
          right: 0;
          width: 48px;
          height: 48px;
          border-bottom: 2px solid #f97316;
          border-right: 2px solid #f97316;
          pointer-events: none;
        }

        @keyframes wave {
          0%, 100% { height: 3px; }
          50% { height: 15px; }
        }
        .wave-bar {
          display: inline-block;
          width: 2px;
          background: #f97316;
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
            box-shadow: 0 0 0 0 rgba(34, 152, 86, 0.4), 0 4px 12px rgba(34, 152, 86, 0.2);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(234, 88, 12, 0), 0 4px 12px rgba(34, 152, 86, 0.2);
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
                SmartGeulis
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                TRACEABILITY SYSTEM
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 font-heading text-xs uppercase tracking-[0.18em] text-[#666666]">
            <a href="#facility" className="hover:text-[#171717] transition-colors">
              Facility
            </a>
            <a href="#pipeline" className="hover:text-[#171717] transition-colors">
              Journey
            </a>
            <a href="#hardware" className="hover:text-[#171717] transition-colors">
              Stations
            </a>
            <a href="#stories" className="hover:text-[#171717] transition-colors">
              Farmers
            </a>
            <a href="#booking" className="hover:text-[#171717] transition-colors">
              Connect
            </a>
            <Link to="/traceability" className="hover:text-[#ea580c] text-[#ea580c] font-semibold transition-colors">
              Public Trace
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 font-mono-custom text-[11px] text-[#666666] border border-[#eaeaea] bg-[#f5f5f5] px-3 py-1.5 rounded-none">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'ONLINE'
                    ? 'bg-[#16a34a] animate-pulse'
                    : backendStatus === 'CHECKING'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              ></span>
              <span className="tracking-wider">SYSTEM STATUS · {backendStatus}</span>
            </div>
            <Link
              to="/login"
              className="font-heading text-xs tracking-[0.18em] uppercase text-white bg-[#000000] px-5 py-2.5 hover:bg-[#333333] transition-colors rounded-none"
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
          {/* Top Right Backend Status Indicator */}
          <div className="absolute top-28 right-6 lg:right-10 flex items-center gap-3 z-30">
            <div className="flex items-center gap-2.5 font-mono-custom text-[11px] text-white/90 bg-black/60 border border-white/15 px-3.5 py-2 backdrop-blur-md">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'ONLINE'
                    ? 'bg-[#16a34a] animate-ping'
                    : backendStatus === 'CHECKING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              ></span>
              <span className="tracking-[0.2em] uppercase font-semibold">
                SYSTEM STATUS · {backendStatus}
              </span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#ea580c] tracking-[0.25em] uppercase mb-4">
              <span className="w-8 h-[2px] bg-[#ea580c]"></span>
              <span>EST. 2026 · GARUT HIGHLAND PACKHOUSE</span>
            </div>

            <h1 className="font-display text-[13vw] md:text-[9.5vw] lg:text-[7.5vw] leading-[0.85] mb-6 tracking-tight">
              <span className="block">GROWN WITH CARE.</span>
              <span className="block text-stroke-white">WEIGHED WITH HONESTY.</span>
              <span className="block">
                TRACEABLE IN <span className="text-[#ea580c]">FULL.</span>
              </span>
            </h1>

            <p className="max-w-2xl text-white/80 text-base md:text-lg leading-relaxed font-body">
              From the volcanic soils of Garut into caring family kitchens. SmartGeulis connects local highland farmers directly with consumers through open scales, gentle handling, and honest traceability in every bag.
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
                <div className="w-11 h-11 rounded-full border-2 border-black bg-[#ea580c] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  <Icon name="sortir" size={16} />
                </div>
                <div className="w-11 h-11 rounded-full border-2 border-black bg-[#ea580c] flex items-center justify-center text-xs font-bold text-white shadow-sm">
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
                  3 Connected Stations · Ready for Daily Work
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
                  className="h-full bg-[#ea580c] transition-all duration-75"
                  style={{ width: `${reelProgress}%` }}
                />
              </div>
              <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase">
                {reelFrames[currentFrame].subtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Scrolling Ticker Marquee */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-md py-3 overflow-hidden z-20">
          <div className="marquee-track font-heading text-xs tracking-[0.25em] uppercase text-white/70">
            <span className="px-8">WEIGHED & APPROVED</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">PRODUCT QR LABELS</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">CONNECTED SCALES</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">CLEAR SORTING</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">VERIFIED WEIGHT</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">PUBLIC QR TRACEABILITY</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">FIELD TO EXPORT CONTAINER</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">WEIGHED & APPROVED</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">PRODUCT QR LABELS</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">CONNECTED SCALES</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">CLEAR SORTING</span>
            <span className="text-[#ea580c]">/</span>
            <span className="px-8">VERIFIED WEIGHT</span>
            <span className="text-[#ea580c]">/</span>
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
                Highland Facility
              </div>
            </div>

            <div className="border-l-2 border-[#f97316] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#ea580c] tabular-nums">
                {counters.farmers}+
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Farming Families
              </div>
            </div>

            <div className="border-l-2 border-[#eaeaea] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#171717] tabular-nums">
                {counters.tons.toLocaleString()}+
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Kilograms Weighed with Pride
              </div>
            </div>

            <div className="border-l-2 border-[#eaeaea] pl-6">
              <div className="font-display text-6xl md:text-7xl text-[#171717] tabular-nums">
                {counters.stations}
              </div>
              <div className="font-mono-custom text-[11px] text-[#666666] tracking-[0.2em] uppercase mt-2">
                Care & Quality Stations
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHYSICAL WAREHOUSE & PACKHOUSE FACILITY BANNER ── */}
      <section className="py-20 lg:py-28 bg-[#fafafa] border-b border-[#eaeaea]" id="facility">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-8 mb-12 items-end">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#ea580c] tracking-[0.25em] uppercase mb-4 font-semibold">
                <span className="w-8 h-[2px] bg-[#ea580c]"></span>
                <span>01 — Physical Facility & Headquarters</span>
              </div>
              <h2 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.9] text-[#171717]">
                THE HEART OF OUR <br />
                <span className="text-[#ea580c]">HIGHLAND PACKHOUSE.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-end">
              <p className="text-[#666666] text-base leading-relaxed font-body">
                Located in the fertile volcanic highlands of Garut, West Java, the SmartGeulis packhouse serves as the physical home where fresh harvests are received directly from local farming families, sorted with care, and prepared for dining tables across the nation.
              </p>
            </div>
          </div>

          {/* Warehouse Signboard Banner Image Showcase */}
          <div className="notch-corner border border-[#eaeaea] bg-white p-4 sm:p-6 shadow-sm mb-12">
            <div className="relative overflow-hidden bg-black/5 border border-[#eaeaea] group">
              <img
                src="/Papan Nama Warehouse.png"
                alt="SmartGeulis Packhouse & Warehouse Signboard"
                className="w-full h-auto max-h-[580px] object-contain mx-auto transition-transform duration-700 group-hover:scale-[1.01]"
              />
              {/* Badge Overlays */}
              <div className="absolute top-4 left-4 bg-black/85 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 text-xs font-mono-custom uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ea580c] animate-pulse"></span>
                <span>Official Facility Signboard</span>
              </div>
              <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md border border-[#eaeaea] text-[#171717] px-4 py-2 text-xs font-mono-custom tracking-wider hidden sm:flex items-center gap-2 shadow-sm font-semibold">
                <span className="w-2 h-2 bg-[#ea580c]"></span>
                <span>Garut Highlands · West Java, Indonesia</span>
              </div>
            </div>
          </div>

          {/* 3 Physical Packhouse Highlights */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 border border-[#eaeaea] bg-white shadow-xs hover:border-[#f97316] transition-all">
              <div className="w-10 h-10 bg-[#fff7ed] border border-[#ffedd5] text-[#ea580c] flex items-center justify-center mb-4">
                <Icon name="scale" size={20} />
              </div>
              <h3 className="font-display text-2xl text-[#171717] mb-2">OPEN & HONEST INTAKE</h3>
              <p className="text-xs text-[#666666] leading-relaxed font-body">
                Local growers arrive every morning with fresh harvest sacks. Digital scales with large bright screens let farmers verify their weight directly with total peace of mind.
              </p>
            </div>

            <div className="p-6 border border-[#eaeaea] bg-white shadow-xs hover:border-[#f97316] transition-all">
              <div className="w-10 h-10 bg-[#fff7ed] border border-[#ffedd5] text-[#ea580c] flex items-center justify-center mb-4">
                <Icon name="package" size={20} />
              </div>
              <h3 className="font-display text-2xl text-[#171717] mb-2">COOL HIGHLAND STORAGE</h3>
              <p className="text-xs text-[#666666] leading-relaxed font-body">
                Naturally cooled highland air and clean, ventilated storage bays preserve crispness, moisture, and natural flavor without artificial chemicals or synthetic treatments.
              </p>
            </div>

            <div className="p-6 border border-[#eaeaea] bg-white shadow-xs hover:border-[#f97316] transition-all">
              <div className="w-10 h-10 bg-[#fff7ed] border border-[#ffedd5] text-[#ea580c] flex items-center justify-center mb-4">
                <Icon name="users" size={20} />
              </div>
              <h3 className="font-display text-2xl text-[#171717] mb-2">COMMUNITY & EMPOWERMENT</h3>
              <p className="text-xs text-[#666666] leading-relaxed font-body">
                Co-developed with Universitas Padjadjaran and Eptilu, our packhouse serves as an open learning hub for sustainable farming, transparent economics, and fair trade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CURRICULUM / OPERATIONAL PIPELINES ── */}
      <section className="py-24 lg:py-32 bg-[#fafafa]" id="pipeline">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-8 mb-16 items-end">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#ea580c] tracking-[0.25em] uppercase mb-4">
                <span className="w-8 h-[2px] bg-[#ea580c]"></span>
                <span>02 — Operational Pipeline</span>
              </div>
              <h2 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
                Three stations.<br />
                <span className="text-stroke">One commitment:</span><br />
                <span className="text-[#ea580c]">100% honest quality.</span>
              </h2>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-end">
              <p className="text-[#666666] text-lg leading-relaxed mb-6 font-body">
                From the moment morning harvests arrive to the sealed retail pouch on your dining table. Explore how our three dedicated care stations ensure every potato is weighed honestly, sorted by quality, and packed with pride.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'all'
                      ? 'bg-[#ea580c] border-[#f97316] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  All Stations
                </button>
                <button
                  onClick={() => setActiveCategory('weighing')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'weighing'
                      ? 'bg-[#ea580c] border-[#f97316] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  Weighing
                </button>
                <button
                  onClick={() => setActiveCategory('sorting')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'sorting'
                      ? 'bg-[#ea580c] border-[#f97316] text-white font-semibold'
                      : 'border-[#eaeaea] bg-white text-[#666666] hover:border-[#d1d5db]'
                  }`}
                >
                  Sorting
                </button>
                <button
                  onClick={() => setActiveCategory('packaging')}
                  className={`px-4 py-2 font-heading text-xs uppercase tracking-[0.15em] border transition-all ${
                    activeCategory === 'packaging'
                      ? 'bg-[#ea580c] border-[#f97316] text-white font-semibold'
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
              <article className="notch-corner border border-[#eaeaea] bg-white shadow-xs group transition-all duration-300 hover:shadow-md hover:border-[#f97316]">
                <div className="relative h-64 overflow-hidden bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
                    alt="Intake Weighing Station"
                    className="w-full h-full object-cover filter contrast-[1.2] opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 font-mono-custom text-[11px] text-[#f59e0b] tracking-[0.2em]">
                    01 / INTAKE WEIGHING
                  </div>
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-[#ea580c] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                    RECEIPT + LABEL
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="font-display text-4xl mb-3 text-[#171717]">HARVEST INTAKE</h3>
                  <p className="text-[#666666] text-sm leading-relaxed mb-6 font-body">
                    Greeting local farmers at dawn, recording fresh harvest sacks on clear digital scales, and printing an immediate receipt for the grower with zero guesswork.
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6 pb-6 border-b border-[#eaeaea]">
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Welcome
                      </div>
                      <div className="font-heading text-base text-[#171717]">DIRECT GROWER INTAKE</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Weighing
                      </div>
                      <div className="font-heading text-base text-[#171717]">CERTIFIED DIGITAL SCALE</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Trust
                      </div>
                      <div className="font-heading text-base text-[#171717]">HONEST TARE SUBTRACTION</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Confirmation
                      </div>
                      <div className="font-heading text-base text-[#171717]">PRINTED SLIP + SACK TAG</div>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/weighing"
                    className="flex items-center justify-between font-heading text-sm tracking-[0.15em] uppercase text-[#171717] hover:text-[#ea580c] transition-colors"
                  >
                    <span>Launch Station</span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </article>
            )}

            {/* Card 2: Sorting Station */}
            {(activeCategory === 'all' || activeCategory === 'sorting') && (
              <article className="notch-corner border border-[#eaeaea] bg-white shadow-xs group transition-all duration-300 hover:shadow-md hover:border-[#f97316]">
                <div className="relative h-64 overflow-hidden bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80"
                    alt="Sorting Station"
                    className="w-full h-full object-cover filter contrast-[1.2] opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 font-mono-custom text-[11px] text-[#f59e0b] tracking-[0.2em]">
                    02 / CLASSIFICATION
                  </div>
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-[#ea580c] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                    SORTING FLOW
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="font-display text-4xl mb-3 text-[#171717]">SORTING & GRADING</h3>
                  <p className="text-[#666666] text-sm leading-relaxed mb-6 font-body">
                    Carefully selecting potatoes by hand and eye into Grade A, B, and C so premium tubers reach supermarkets and every harvest finds its best home without unnecessary waste.
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6 pb-6 border-b border-[#eaeaea]">
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Selection
                      </div>
                      <div className="font-heading text-base text-[#171717]">HAND & EYE QUALITY SORT</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Categories
                      </div>
                      <div className="font-heading text-base text-[#171717]">GRADE A / B / C</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Identification
                      </div>
                      <div className="font-heading text-base text-[#171717]">PALLET TRACKING TAG</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Destination
                      </div>
                      <div className="font-heading text-base text-[#171717]">READY FOR PACKAGING</div>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/sorting"
                    className="flex items-center justify-between font-heading text-sm tracking-[0.15em] uppercase text-[#171717] hover:text-[#ea580c] transition-colors"
                  >
                    <span>Launch Station</span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </article>
            )}

            {/* Card 3: Packaging Station */}
            {(activeCategory === 'all' || activeCategory === 'packaging') && (
              <article className="notch-corner border border-[#eaeaea] bg-white shadow-xs group transition-all duration-300 hover:shadow-md hover:border-[#f97316]">
                <div className="relative h-64 overflow-hidden bg-black">
                  <img
                    src="https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80"
                    alt="Packaging Station"
                    className="w-full h-full object-cover filter contrast-[1.2] opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 font-mono-custom text-[11px] text-[#f59e0b] tracking-[0.2em]">
                    03 / RETAIL POUCH
                  </div>
                  <div className="absolute top-4 right-4 px-2.5 py-1 bg-[#171717] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
                    3-CHANNEL CLUSTER
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="font-display text-4xl mb-3 text-[#171717]">RETAIL PACKAGING</h3>
                  <p className="text-[#666666] text-sm leading-relaxed mb-6 font-body">
                    Weighing fresh potatoes into clean 1 kg stand-up pouches, sealed with a unique QR code that connects home cooks directly to the grower who nurtured the crop.
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6 pb-6 border-b border-[#eaeaea]">
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Family Unit
                      </div>
                      <div className="font-heading text-base text-[#171717]">1 KG RETAIL POUCH</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Freshness
                      </div>
                      <div className="font-heading text-base text-[#171717]">BREATHE-EASY PACK</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Transparency
                      </div>
                      <div className="font-heading text-base text-[#171717]">SCANNABLE FARMER QR</div>
                    </div>
                    <div>
                      <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                        Packhouse Line
                      </div>
                      <div className="font-heading text-base text-[#171717]">DEDICATED GRADE LINES</div>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/packaging"
                    className="flex items-center justify-between font-heading text-sm tracking-[0.15em] uppercase text-[#171717] hover:text-[#ea580c] transition-colors"
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
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#ea580c] tracking-[0.25em] uppercase mb-4">
                <span className="w-8 h-[2px] bg-[#ea580c]"></span>
                <span>03 — Stations</span>
              </div>
              <h2 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
                Simple, caring tools.<br />
                Built for <span className="text-[#ea580c]">people</span>,<br />
                designed for <span className="text-stroke">trust.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-end">
              <p className="text-[#666666] text-base leading-relaxed font-body">
                No complex manuals or confusing jargon. Each packhouse tool is designed for everyday ease, instant clarity, and fair trade for farmers and families. Hover or tap any card below to explore.
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
                      alt="Digital Scales"
                      className="w-full h-full object-cover filter contrast-[1.25] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#f59e0b] tracking-[0.2em]">
                      / 01
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      RAPID CAPTURE
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">FAIR DIGITAL SCALES</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        Honest Weight for Every Farmer
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        FAIR WEIGHING
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#ea580c] tracking-wider font-semibold">
                        EXPLORE →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#f97316] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-3">
                      / Everyday Trust
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">FAIR NUMBERS YOU TRUST</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Large bright display seen by farmer & operator</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>One-touch tare deduction for sack weight only</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Gentle, non-slip platform for fresh potatoes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Instant confirmation so growers leave confident</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Complete Honesty</div>
                    <div className="font-display text-xl text-[#ea580c]">ZERO GUESSWORK</div>
                    <p className="text-[11px] text-[#666666] mt-1">Clear numbers you can see before any deal is settled.</p>
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
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#f59e0b] tracking-[0.2em]">
                      / 02
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      QR + RECEIPT
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">PRINTED PROOF</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        Immediate Receipts in Hand
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        OFFICIAL SLIPS
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#ea580c] tracking-wider font-semibold">
                        EXPLORE →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#f97316] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-3">
                      / Everyday Confidence
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">A RECEIPT TO TAKE HOME</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Instant printed receipt handed to farmer before leaving</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Weather-resistant tag attached to each mesh waring sack</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Clear numbering for simple cooperative accounting</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Operates reliably without depending on internet speed</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Permanent Record</div>
                    <div className="font-display text-xl text-[#ea580c]">PEACE OF MIND</div>
                    <p className="text-[11px] text-[#666666] mt-1">Tangible printed proof for every single kilogram delivered.</p>
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
                      alt="Packaging Lines"
                      className="w-full h-full object-cover filter contrast-[1.25] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#f59e0b] tracking-[0.2em]">
                      / 03
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      PARALLEL LINES
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">KITCHEN POUCHES</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        Convenient 1 kg Family Sizing
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        GRADE-SPECIFIC
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#ea580c] tracking-wider font-semibold">
                        EXPLORE →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#f97316] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-3">
                      / Table-Ready Quality
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">SEALED FOR FRESHNESS</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Grade A Line: Hand-selected premium potatoes for fresh markets</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Grade B Line: Wholesome, affordable table potatoes for daily cooking</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Grade C Line: Consistent quality for food makers and local chefs</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Breathe-easy pouches that preserve farm-fresh firmness</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Family Sizing</div>
                    <div className="font-display text-xl text-[#ea580c]">1 KG POUCH</div>
                    <p className="text-[11px] text-[#666666] mt-1">Perfect portion for family cooking and easy storage.</p>
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
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#f59e0b] tracking-[0.2em]">
                      / 04
                    </div>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white font-mono-custom text-[10px] tracking-wider uppercase">
                      PUBLIC PORTAL
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-none text-[#171717]">PHONE SCAN</h3>
                      <p className="text-[#666666] text-xs mt-2 font-heading tracking-wider uppercase">
                        Meet Your Grower with One Tap
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#eaeaea]">
                      <span className="font-mono-custom text-[10px] text-[#666666] tracking-wider">
                        NO APP NEEDED
                      </span>
                      <span className="font-mono-custom text-[10px] text-[#ea580c] tracking-wider font-semibold">
                        EXPLORE →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-face flip-back border border-[#f97316] bg-white p-6 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-3">
                      / Farm-to-Fork Story
                    </div>
                    <h3 className="font-display text-2xl mb-4 text-[#171717]">MEET YOUR GROWER</h3>
                    <ul className="space-y-2.5 text-xs text-[#525252] font-body">
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Point your normal phone camera to view in seconds</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>See the grower name, highland village, and harvest date</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Know your food was grown responsibly and fairly traded</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon name="check-circle" size={14} className="text-[#ea580c] shrink-0" />
                        <span>Celebrate the local farming families who feed us</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-[#eaeaea]">
                    <div className="font-mono-custom text-[10px] text-[#666666] uppercase mb-1">Zero Downloads</div>
                    <div className="font-display text-xl text-[#ea580c]">ANY SMARTPHONE</div>
                    <p className="text-[11px] text-[#666666] mt-1">Tap the link to immediately view the genuine harvest story.</p>
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
              <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#ea580c] tracking-[0.25em] uppercase mb-4">
                <span className="w-8 h-[2px] bg-[#ea580c]"></span>
                <span>04 — Voices from the Soil</span>
              </div>
              <h2 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9]">
                Real harvests.<br />
                <span className="text-[#ea580c]">Real families.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-end">
              <p className="text-[#666666] text-base leading-relaxed mb-4 font-body">
                Behind every potato is a family of growers who rise before dawn. Meet the farmers and packhouse team of Garut whose livelihoods are protected by honest weighing and genuine community pride.
              </p>
              <div className="flex items-center gap-3 font-mono-custom text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                <Icon name="users" size={13} className="text-[#ea580c]" />
                <span>Swipeable · Real Stories · Verified Highlands</span>
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
                  className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] shrink-0 border border-[#eaeaea] bg-white shadow-xs hover:border-[#f97316] transition-colors"
                >
                  <div className="relative h-56 overflow-hidden bg-black">
                    <img
                      src={story.img}
                      alt={story.farmer}
                      className="w-full h-full object-cover filter contrast-[1.2] brightness-90"
                    />
                    <div className="absolute top-4 left-4 font-mono-custom text-[10px] text-[#f59e0b] tracking-[0.2em]">
                      {story.caseId}
                    </div>
                    <div className="absolute bottom-4 right-4 px-2.5 py-1 bg-[#ea580c] text-white font-mono-custom text-[10px] tracking-wider uppercase font-semibold">
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
                        <div className="font-display text-2xl text-[#ea580c]">{story.metric1.val}</div>
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
                    i === storyIndex ? 'w-8 bg-[#ea580c]' : 'w-2 bg-[#d1d5db]'
                  }`}
                  aria-label={`Go to case ${i + 1}`}
                />
              ))}
            </div>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevStory}
                className="w-10 h-10 border border-[#eaeaea] bg-white hover:border-[#f97316] hover:text-[#ea580c] flex items-center justify-center transition-colors shadow-xs"
                aria-label="Previous case"
              >
                <Icon name="arrow-left" size={14} />
              </button>
              <button
                onClick={handleNextStory}
                className="w-10 h-10 border border-[#eaeaea] bg-white hover:border-[#f97316] hover:text-[#ea580c] flex items-center justify-center transition-colors shadow-xs"
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
            <div className="inline-flex items-center gap-3 font-mono-custom text-xs text-[#ea580c] tracking-[0.25em] uppercase mb-4">
              <span className="w-8 h-[2px] bg-[#ea580c]"></span>
              <span>05 — Connect with Our Community</span>
            </div>
            <h2 className="font-display text-6xl md:text-7xl lg:text-[7rem] leading-[0.9]">
              JOIN OUR<br />
              <span className="text-stroke">GROWING</span> <span className="text-[#ea580c]">COMMUNITY.</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Form Frame */}
            <div className="lg:col-span-7">
              <div className="booking-frame p-8 lg:p-12 shadow-sm">
                <div className="font-mono-custom text-[11px] text-[#ea580c] tracking-[0.2em] uppercase mb-2">
                  // Connect with SmartGeulis
                </div>
                <h3 className="font-display text-4xl mb-2 text-[#171717]">PLAN A VISIT OR PARTNERSHIP</h3>
                <p className="text-[#666666] text-sm mb-8 font-body">
                  Whether you are a local farming cooperative, a fresh produce retailer, or a visitor wishing to tour our Garut highland packhouse, our doors are always open.
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
                        className="w-full bg-transparent border-b border-[#d1d5db] py-2.5 text-base font-heading focus:outline-none focus:border-[#f97316] transition-colors"
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
                        className="w-full bg-transparent border-b border-[#d1d5db] py-2.5 text-base font-heading focus:outline-none focus:border-[#f97316] transition-colors"
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
                      className="w-full bg-transparent border-b border-[#d1d5db] py-2.5 text-base font-heading focus:outline-none focus:border-[#f97316] transition-colors"
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
                              ? 'bg-[#ea580c] border-[#f97316] text-white font-semibold'
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
                              ? 'bg-[#ea580c] border-[#f97316] text-white'
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
                    className="pulse-btn w-full bg-[#000000] text-white py-4 font-display text-2xl tracking-wider hover:bg-[#333333] transition-colors flex items-center justify-center gap-3 rounded-none"
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
                <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-2">
                  / Hub Locations
                </div>
                <h4 className="font-display text-2xl mb-2 text-[#171717]">CENTRAL PACKHOUSE PILOT</h4>
                <p className="text-[#666666] text-sm leading-relaxed mb-4 font-body">
                  Pangalengan Agricultural Complex<br />
                  Bandung Regency, West Java 40378
                </p>
                <div className="flex items-center gap-2 font-mono-custom text-[11px] text-[#ea580c]">
                  <Icon name="location" size={13} />
                  <span>ELEVATION: 1,420M ASL · FIBER CONNECTED</span>
                </div>
              </div>

              <div className="border border-[#eaeaea] bg-white p-7 shadow-xs">
                <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-2">
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
                <div className="font-mono-custom text-[10px] text-[#ea580c] tracking-[0.2em] uppercase mb-2">
                  / Direct Engineer Contact
                </div>
                <h4 className="font-display text-2xl mb-3 text-[#171717]">TECHNICAL SUPPORT</h4>
                <div className="space-y-2.5 text-sm font-body">
                  <a
                    href="tel:+62215550100"
                    className="flex items-center gap-3 hover:text-[#ea580c] transition-colors text-[#525252]"
                  >
                    <Icon name="phone" size={14} className="text-[#ea580c]" />
                    <span className="font-mono-custom">+62 (21) 555-0100 (Packhouse Ops)</span>
                  </a>
                  <a
                    href="mailto:support@smartgeulisunpad.com"
                    className="flex items-center gap-3 hover:text-[#ea580c] transition-colors text-[#525252]"
                  >
                    <Icon name="send" size={14} className="text-[#ea580c]" />
                    <span className="font-mono-custom">engineering@smartgeulisunpad.com</span>
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
          {/* ── STRATEGIC PARTNERS & COLLABORATORS ── */}
          <div className="border-b border-[#eaeaea] pb-12 mb-12">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-8">
              <div>
                <div className="font-mono-custom text-[11px] text-[#ea580c] tracking-[0.25em] uppercase font-semibold mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#ea580c]"></span>
                  STRATEGIC PARTNERS & COLLABORATION
                </div>
                <h4 className="font-display text-3xl md:text-4xl tracking-wider text-[#171717]">
                  SUPPORTED BY ACADEMIC & INDUSTRY LEADERS
                </h4>
              </div>
              <p className="text-xs text-[#666666] font-body max-w-lg leading-relaxed">
                SmartGeulis Traceability System is co-developed and validated through active collaboration between Universitas Padjadjaran (UNPAD), Eptilu Garut Agro-Tourism & Fresh Produce, and research consortia.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Universitas Padjadjaran (UNPAD) */}
              <div className="p-6 border border-[#eaeaea] bg-[#fafafa] hover:border-[#ea580c] hover:bg-white transition-all flex items-center gap-5 group rounded-none">
                <div className="w-20 h-20 bg-white border border-[#eaeaea] p-2 flex items-center justify-center shrink-0">
                  <img
                    src="/logo-unpad.png"
                    alt="Universitas Padjadjaran (UNPAD)"
                    className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-mono-custom text-[10px] text-[#ea580c] uppercase tracking-wider block font-semibold">
                    Academic & Research
                  </span>
                  <div className="font-heading text-sm uppercase tracking-wider text-[#171717] font-semibold mt-0.5">
                    Universitas Padjadjaran
                  </div>
                  <div className="text-xs text-[#666666] mt-1 leading-snug">
                    Lead research institution powering agricultural IoT innovation.
                  </div>
                </div>
              </div>

              {/* Eptilu Garut */}
              <div className="p-6 border border-[#eaeaea] bg-[#fafafa] hover:border-[#ea580c] hover:bg-white transition-all flex items-center gap-5 group rounded-none">
                <div className="w-20 h-20 bg-white border border-[#eaeaea] p-2 flex items-center justify-center shrink-0">
                  <img
                    src="/Logo Eptilu_High res.jpeg"
                    alt="Eptilu Fresh Produce"
                    className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform rounded-sm"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-mono-custom text-[10px] text-[#ea580c] uppercase tracking-wider block font-semibold">
                    Agro-Industry Partner
                  </span>
                  <div className="font-heading text-sm uppercase tracking-wider text-[#171717] font-semibold mt-0.5">
                    Eptilu Garut
                  </div>
                  <div className="text-xs text-[#666666] mt-1 leading-snug">
                    Agro-tourism & commercial packhouse partner in Garut highlands.
                  </div>
                </div>
              </div>

              {/* Partner Consortium */}
              <div className="sm:col-span-2 lg:col-span-1 p-6 border border-[#eaeaea] bg-[#fafafa] hover:border-[#ea580c] hover:bg-white transition-all flex items-center gap-5 group rounded-none">
                <div className="w-20 h-20 bg-white border border-[#eaeaea] p-2 flex items-center justify-center shrink-0">
                  <img
                    src="/Kumpulan Logo.png"
                    alt="Ecosystem Consortium Partners"
                    className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-mono-custom text-[10px] text-[#ea580c] uppercase tracking-wider block font-semibold">
                    Consortium Ecosystem
                  </span>
                  <div className="font-heading text-sm uppercase tracking-wider text-[#171717] font-semibold mt-0.5">
                    Consortium Partners
                  </div>
                  <div className="text-xs text-[#666666] mt-1 leading-snug">
                    Supported by collaborative national agriculture & tech partners.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-12 gap-10 mb-12">
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <Logo className="h-8 w-auto" markOnly />
                <div>
                  <div className="font-display text-2xl leading-none tracking-wider text-[#171717]">
                    SmartGeulis
                  </div>
                  <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                    TRACEABILITY SYSTEM
                  </div>
                </div>
              </div>
              <p className="text-[#666666] text-sm leading-relaxed max-w-md mb-6 font-body">
                Modular IoT platform uniting smart platform scales, optical grading classification, and GS1 Digital Link
                pouch barcodes into a unified single source of truth for the potato supply chain.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#f5f5f5] text-[#525252] border border-[#eaeaea] px-2.5 py-1 font-mono-custom">
                  Type: smartgeulis
                </span>
                <span className="text-xs text-[#666666] font-mono-custom">
                  v1.0.0 (Production)
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <h5 className="font-mono-custom text-[11px] text-[#ea580c] tracking-[0.2em] uppercase mb-4 font-semibold">
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
                  <Link to="/dashboard/warehouse" className="hover:text-[#171717] transition-colors">
                    Warehouse Ledger
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <h5 className="font-mono-custom text-[11px] text-[#ea580c] tracking-[0.2em] uppercase mb-4 font-semibold">
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
              <h5 className="font-mono-custom text-[11px] text-[#ea580c] tracking-[0.2em] uppercase mb-4 font-semibold">
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
                className="flex border border-[#eaeaea] bg-white focus-within:border-[#f97316] transition-colors"
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
            <div>© {new Date().getFullYear()} SmartGeulis · TRACEABILITY SYSTEM</div>
            <div className="flex gap-6">
              <Link to="/traceability" className="hover:text-[#ea580c] transition-colors">
                Public Trace
              </Link>
              <Link to="/login" className="hover:text-[#ea580c] transition-colors">
                Sign In
              </Link>
              <a href="#hero" className="hover:text-[#ea580c] transition-colors">
                Back to Top ↑
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── STICKY CTA BAR ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 bg-white/95 backdrop-blur-md border-t border-[#f97316]/40 shadow-lg ${
          stickyVisible ? 'translate-y-0' : 'translate-y-[110%]'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 font-mono-custom text-[11px] text-[#ea580c] tracking-wider font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'ONLINE'
                    ? 'bg-[#16a34a] animate-ping'
                    : backendStatus === 'CHECKING'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              ></span>
              <span>BACKEND STATUS · {backendStatus}</span>
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
            className="pulse-btn bg-[#ea580c] text-white px-6 py-2.5 font-heading text-xs uppercase tracking-[0.18em] hover:bg-[#16a34a] transition-colors flex items-center gap-2 rounded-none shrink-0 font-semibold"
          >
            <span>Deploy System</span>
            <Icon name="arrow-right" size={14} />
          </a>
        </div>
      </div>

      {/* ── SLIDE-IN TOAST NOTIFICATION ── */}
      <div
        className={`fixed top-20 right-6 z-[160] transition-transform duration-500 bg-white border border-[#f97316] border-l-4 border-l-[#f97316] p-4 shadow-xl max-w-sm ${
          toastVisible ? 'translate-x-0' : 'translate-x-[120%]'
        }`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 bg-[#ea580c] text-white flex items-center justify-center shrink-0 rounded-none">
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
