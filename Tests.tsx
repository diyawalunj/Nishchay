import React from 'react';
import { motion } from 'motion/react';
import { 
  Swords, 
  GraduationCap, 
  Plane, 
  Settings, 
  Clock, 
  BarChart3, 
  FileText 
} from 'lucide-react';

const examCategories = [
  {
    title: 'NDA',
    subtitle: 'National Defence Academy',
    description: 'For 12th pass candidates – Army, Navy & Air Force',
    icon: <Swords size={24} />,
    iconBg: 'bg-[#2D6A4F]',
    status: 'COMING SOON'
  },
  {
    title: 'CDS',
    subtitle: 'Combined Defence Services',
    description: 'For graduates – IMA, OTA, Naval & Air Force Academy',
    icon: <GraduationCap size={24} />,
    iconBg: 'bg-[#E9C46A]',
    status: 'COMING SOON'
  },
  {
    title: 'AFCAT',
    subtitle: 'Air Force Common Admission Test',
    description: 'Direct entry to Indian Air Force as commissioned officer',
    icon: <Plane size={24} />,
    iconBg: 'bg-[#4895EF]',
    status: 'COMING SOON'
  },
  {
    title: 'Technical Entries',
    subtitle: 'TES & SSC Technical',
    description: '10+2 B.Tech, UES, SSC technical entries into Armed Forces',
    icon: <Settings size={24} />,
    iconBg: 'bg-[#151C25]',
    status: 'COMING SOON'
  }
];

const testFeatures = [
  {
    title: 'Timed Tests',
    description: 'Real exam conditions with strict time limits to build speed and accuracy.',
    icon: <Clock size={24} />
  },
  {
    title: 'Result Analysis',
    description: 'Detailed performance breakdowns with topic-wise scoring and improvement areas.',
    icon: <BarChart3 size={24} />
  },
  {
    title: 'Previous Year Papers',
    description: 'Solve past papers to understand exam patterns and frequently asked topics.',
    icon: <FileText size={24} />
  }
];

const Tests: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
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
            PREPARE FOR
          </span>
          <h1 className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2">
            EXAMS
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Complete guidance and practice for NDA, CDS, AFCAT & Technical entries.
          </p>
        </motion.div>
      </section>

      {/* Exam Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 py-32 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {examCategories.map((exam, index) => (
            <motion.div
              key={exam.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -12 }}
              className="h-full bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_40px_100px_rgba(0,0,0,0.03)] border border-gray-100 text-center flex flex-col items-center group hover:border-[#1B4332]/20 transition-all duration-500 relative overflow-hidden"
            >
              <div className="absolute -right-8 -top-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500">
                {exam.icon}
              </div>
              <div className={`${exam.iconBg} w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-8 shadow-xl premium-zoom group-hover:scale-110 group-hover:rotate-6`}>
                {exam.icon}
              </div>
              <h3 className="text-4xl font-black text-[#1A1A1A] mb-2 tracking-tighter">
                {exam.title}
              </h3>
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-6">
                {exam.subtitle}
              </p>
              <p className="text-gray-500 font-medium leading-relaxed mb-10 flex-grow text-sm">
                {exam.description}
              </p>
              <div className="mt-auto">
                <span className="inline-block px-6 py-2.5 rounded-2xl bg-[#1B4332]/5 text-[#1B4332] text-[10px] font-black tracking-[0.2em] uppercase border border-[#1B4332]/5">
                  {exam.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Test Features Section */}
      <section className="max-w-7xl mx-auto px-4 pb-48">
        <div className="text-center mb-24">
          <span className="inline-block px-4 py-1.5 bg-gray-100 rounded-full text-gray-400 text-[10px] font-black tracking-[0.3em] uppercase mb-6">
            WHY NISHCHAY
          </span>
          <h2 className="text-5xl md:text-7xl font-black text-[#1A1A1A] tracking-tighter">
            Test Features
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {testFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.4 }}
              whileHover={{ y: -8 }}
              className="h-full bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 text-center flex flex-col items-center group hover:border-[#1B4332]/10 transition-all duration-500"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#1B4332]/5 text-[#1B4332] flex items-center justify-center mb-10 group-hover:bg-[#1B4332] group-hover:text-white transition-all duration-500 shadow-inner">
                {feature.icon}
              </div>
              <h3 className="text-3xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-lg">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Tests;
