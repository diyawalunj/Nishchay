import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Quote, ArrowRight, Download, MessageCircle } from 'lucide-react';
import { SERVICES } from './constants';

export default function Home() {
  const [activeQuote, setActiveQuote] = useState(0);

  const quotes = [
    {
      text: "In the matter of courage, the opportunity is everything.",
      author: "Swami Vivekananda"
    },
    {
      text: "A true soldier fights not because he hates what is in front of him, but because he loves what is behind him.",
      author: "G.K. Chesterton"
    },
    {
      text: "The soldier is the Army. No army is better than its soldiers.",
      author: "George S. Patton"
    },
    {
      text: "Either I will find a way, or I will make one.",
      author: "Philip Sidney"
    },
    {
      text: "Fortune favors the brave.",
      author: "Virgil"
    },
    {
      text: "Either I will come back after hoisting the Tricolour, or I will come back wrapped in it.",
      author: "Captain Vikram Batra"
    },
    {
      text: "The safety, honour and welfare of your country come first, always and every time.",
      author: "Indian Military Academy (Chetwode Motto)"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveQuote((prev) => (prev + 1) % quotes.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="flex-grow">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero-bg-BtRLye3t.jpg" 
            alt="Military Background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 via-transparent to-black/90"></div>
          {/* Camouflage Pattern Overlay */}
          <div className="absolute inset-0 opacity-30 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#1B4332]/60 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center mt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-xs font-bold tracking-widest uppercase mb-8"
          >
            <span>🎖️</span> BY ASPIRANTS FOR ASPIRANTS
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-8xl md:text-[12rem] font-display text-white mb-6 tracking-tighter text-glow-white leading-none"
          >
            NISHCHAY
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-12"
          >
            <p className="text-2xl md:text-3xl font-serif italic text-white mb-3 tracking-tight">
              "लक्ष्यं मा परिवर्तय, मार्गं परिवर्तय।"
            </p>
            <p className="text-xs md:text-sm text-white/60 font-black uppercase tracking-[0.4em]">
              Don't Change the Aim, Change the Path
            </p>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-xl md:text-2xl font-black text-white mb-8 tracking-widest uppercase"
          >
            Preparing Future Officers
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-16 leading-relaxed font-medium"
          >
            Genuine mentorship, curated notes, SSB preparation & defence career guidance — all from aspirants who've been in your shoes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link to="/contact" className="w-full sm:w-auto">
              <button className="btn-white w-full flex items-center justify-center gap-2">
                JOIN NOW <ArrowRight size={18} />
              </button>
            </Link>
            <Link to="/notes" className="w-full sm:w-auto">
              <button className="btn-secondary w-full flex items-center justify-center gap-2">
                <Download size={18} /> NOTES
              </button>
            </Link>
            <Link to="/doubts" className="w-full sm:w-auto">
              <button className="btn-secondary w-full flex items-center justify-center gap-2">
                <MessageCircle size={18} /> DOUBTS
              </button>
            </Link>
          </motion.div>
        </div>

        {/* Stats Section at bottom of Hero */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 mt-24 md:mt-40 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: 'STUDENTS GUIDED', value: '500+' },
              { label: 'NDA/CDS MENTORS', value: '4' },
              { label: 'FREE NOTES', value: '200+' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 + idx * 0.1 }}
                className="glass-card-dark p-10 text-center group hover:bg-white/10 transition-all duration-500"
              >
                <p className="text-5xl font-black text-white mb-3 tracking-tighter group-hover:scale-110 transition-transform duration-500">{stat.value}</p>
                <p className="text-[10px] font-black tracking-[0.3em] text-white/40 uppercase">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero Quote Section */}
      <section className="py-32 md:py-48 bg-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-12">
            <Quote className="text-[#1B4332]/10 animate-float" size={64} />
          </div>
          
          <div className="relative h-64 md:h-48">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeQuote}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.6, ease: "circOut" }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <p className="quote-text mb-8">"{quotes[activeQuote].text}"</p>
                <p className="text-[10px] font-black tracking-[0.4em] text-[#1B4332] uppercase">— {quotes[activeQuote].author}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-3 mt-12">
            {quotes.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuote(idx)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  activeQuote === idx ? 'bg-[#1B4332] w-8' : 'bg-gray-100 w-4 hover:bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section className="py-32 bg-[#F8F9FA] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#1B4332]/5 rounded-full blur-[100px] -mr-48 -mt-48"></div>
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <span className="section-label">Our Purpose</span>
          <h2 className="text-5xl md:text-7xl font-black mb-20 text-[#1A1A1A] tracking-tighter">Our Mission</h2>
          
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto bg-white p-16 md:p-28 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.03)] border border-gray-100 relative group"
          >
            <div className="absolute top-10 left-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <Quote size={80} />
            </div>
            <p className="quote-text text-2xl md:text-4xl mb-12 leading-tight">
              "I was often asked, whether I was a Leader or a Follower. I always knew the answer. I was a good Follower, if the Leader was great. Otherwise, I took the lead. No second thoughts about that."
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-px bg-gray-200"></div>
              <p className="text-[10px] font-black tracking-[0.4em] text-gray-400 uppercase">Field Marshal Sam Manekshaw</p>
              <div className="w-12 h-px bg-gray-200"></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Services Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <span className="section-label">What We Offer</span>
          <h2 className="text-5xl md:text-7xl font-black mb-6 text-[#1A1A1A] tracking-tighter">Our Services</h2>
          <p className="text-gray-400 font-medium max-w-2xl mx-auto mb-24 text-lg">
            Everything you need to crack defence exams, all in one platform.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {SERVICES.map((service, idx) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-10 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all duration-500 text-left group relative overflow-hidden"
              >
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                  <service.icon size={160} />
                </div>
                <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform duration-500 shadow-lg shadow-current/10`}>
                  <service.icon size={28} />
                </div>
                <h3 className="text-2xl font-black mb-4 text-[#1A1A1A] tracking-tight">{service.title}</h3>
                <p className="text-gray-500 leading-relaxed font-medium">
                  {service.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
