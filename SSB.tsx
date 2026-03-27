import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  Megaphone,
  Brain,
  Users,
  UserCheck,
  CheckCircle,
  Check,
  ExternalLink,
  X
} from 'lucide-react';

const ssbProcess = [
  {
    day: '01',
    title: 'Screening & PPDT',
    description: 'OIR Test & Picture Perception Discussion Test',
    icon: <Megaphone size={20} />,
  },
  {
    day: '02',
    title: 'Psychology Tests',
    description: 'TAT, WAT, SRT, Self Description',
    icon: <Brain size={20} />,
  },
  {
    day: '03',
    title: 'GTO Tasks',
    description: 'GD, GPE, PGT, HGT, Command Task, FGT',
    icon: <Users size={20} />,
  },
  {
    day: '04',
    title: 'Personal Interview',
    description: 'One-on-one with the Interviewing Officer',
    icon: <UserCheck size={20} />,
  },
  {
    day: '05',
    title: 'Conference',
    description: 'Final round before the SSB board',
    icon: <CheckCircle size={20} />,
  },
];

const ssbTips = [
  "Be genuine; SSB tests your personality, not acting skills.",
  "Read newspapers daily — stay updated on defence and national affairs.",
  "Practice group discussions with friends regularly.",
  "Work on physical fitness — it reflects in your body language.",
  "Develop hobbies and extracurricular skills — SSB values all-rounders.",
  "Study past SSB experiences from recommended candidates."
];

const SSB: React.FC = () => {
  const [showOLQEngine, setShowOLQEngine] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showOLQEngine) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showOLQEngine]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* OLQ Engine Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {showOLQEngine && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-2 md:p-8 lg:p-12"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotateX: 15 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                exit={{ scale: 0.8, opacity: 0, rotateX: -15 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="w-full h-full max-w-7xl bg-[#0A0F14] rounded-2xl md:rounded-[3rem] overflow-hidden flex flex-col shadow-[0_0_150px_rgba(27,67,50,0.5)] border border-white/10 relative"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 md:px-10 py-6 md:py-8 bg-gradient-to-r from-[#151C25] via-[#0D131A] to-[#0A0F14] border-b border-white/5 relative overflow-hidden shrink-0">
                  {/* Decorative Elements */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#1B4332]/20 blur-[80px] rounded-full"></div>
                  <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#1B4332]/10 blur-[80px] rounded-full"></div>

                  <div className="relative z-10 flex items-center gap-4 md:gap-6">
                    <motion.div
                      animate={{
                        boxShadow: ["0 0 20px rgba(27,67,50,0.3)", "0 0 40px rgba(27,67,50,0.6)", "0 0 20px rgba(27,67,50,0.3)"]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-[#1B4332] flex items-center justify-center shadow-lg"
                    >
                      <Brain size={24} className="text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-lg md:text-3xl font-display uppercase tracking-[0.2em] md:tracking-[0.3em] text-white leading-none mb-1 md:mb-2">
                        OLQ <span className="text-[#1B4332] text-glow-green">Engine</span>
                      </h3>
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <p className="text-[8px] md:text-[10px] text-white/40 font-black tracking-[0.2em] md:tracking-[0.4em] uppercase">SYSTEM ONLINE • SECURE ACCESS</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowOLQEngine(false)}
                    className="relative z-10 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-white/10 rounded-xl md:rounded-2xl transition-all duration-300 group"
                  >
                    <X size={24} className="text-white/30 group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-grow relative bg-white">
                  <div className="absolute inset-0 flex items-center justify-center bg-[#050A0F]">
                    <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/20 to-transparent"></div>
                    </div>
                    <div className="flex flex-col items-center gap-6 relative z-10">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-[#1B4332]/20 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin absolute top-0 left-0 shadow-[0_0_20px_rgba(27,67,50,0.4)]"></div>
                      </div>
                      <div className="space-y-2 text-center">
                        <p className="text-[#1B4332] font-black text-xs tracking-[0.4em] uppercase animate-pulse">Establishing Secure Connection</p>
                        <p className="text-white/20 font-bold text-[8px] tracking-[0.3em] uppercase">Handshaking avec olq-engine.vercel.app...</p>
                      </div>
                    </div>
                  </div>
                  <iframe
                    src="https://olq-engine.vercel.app/"
                    className="absolute inset-0 w-full h-full border-none z-10"
                    title="OLQ Engine"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {/* Hero Section */}
      <section className="relative py-48 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#1B4332]/60 to-transparent"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-7xl mx-auto px-4 text-center"
        >
          <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8">
            YOUR JOURNEY TO SELECTION
          </span>
          <h1 className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2">
            SSB
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Comprehensive 5-day SSB interview preparation with mock tests, OLQ development, and mentoring.
          </p>
        </motion.div>
      </section>

      {/* The 5-Day Process Section */}
      <section className="max-w-4xl mx-auto px-4 py-32 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>

        <div className="text-center mb-24">
          <span className="inline-block px-4 py-1.5 bg-gray-100 rounded-full text-gray-400 text-[10px] font-black tracking-[0.3em] uppercase mb-6">
            THE TIMELINE
          </span>
          <h2 className="text-5xl md:text-7xl font-black text-[#1A1A1A] tracking-tighter">
            5-Day Process
          </h2>
        </div>

        <div className="space-y-6">
          {ssbProcess.map((step, index) => (
            <motion.div
              key={step.day}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 12 }}
              className="bg-white rounded-[2rem] p-6 md:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col md:flex-row items-center gap-6 md:gap-10 group hover:border-[#1B4332]/20 transition-all duration-500"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-[#1B4332] text-white flex items-center justify-center font-black text-2xl md:text-3xl shrink-0 shadow-xl premium-zoom group-hover:scale-110">
                {step.day}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-[#1B4332] opacity-30 group-hover:opacity-100 transition-opacity duration-500">{step.icon}</span>
                  <h3 className="text-3xl font-black tracking-tight text-[#1A1A1A]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-lg text-gray-500 font-medium">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* OLQ Engine CTA */}
      <section className="max-w-4xl mx-auto px-4 mb-32 text-center">
        <motion.button
          onClick={() => setShowOLQEngine(true)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-4 md:gap-6 px-8 md:px-12 py-5 md:py-6 bg-[#1B4332] text-white rounded-2xl md:rounded-[2rem] font-black text-lg md:text-2xl uppercase tracking-[0.2em] shadow-2xl shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all duration-500 group"
        >
          Try our OLQEngine
          <ExternalLink size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
        </motion.button>
      </section>

      {/* SSB Tips & Guidance Section */}
      <section className="max-w-5xl mx-auto px-4 pb-48">
        <div className="text-center mb-24">
          <span className="inline-block px-4 py-1.5 bg-gray-100 rounded-full text-gray-400 text-[10px] font-black tracking-[0.3em] uppercase mb-6">
            EXPERT ADVICE
          </span>
          <h2 className="text-5xl md:text-7xl font-black text-[#1A1A1A] tracking-tighter">
            Tips & Guidance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ssbTips.map((tip, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 + 0.5 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-gray-100 flex items-start gap-4 md:gap-6 group hover:border-[#1B4332]/10 transition-all duration-500"
            >
              <div className="w-10 h-10 rounded-full bg-[#1B4332]/5 text-[#1B4332] flex items-center justify-center shrink-0 mt-1 shadow-inner">
                <Check size={20} />
              </div>
              <p className="text-gray-500 font-medium leading-relaxed text-lg">
                {tip}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SSB;
