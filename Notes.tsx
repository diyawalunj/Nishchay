import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Calculator, Book, Globe, Newspaper, ClipboardList, Target } from 'lucide-react';

const SUBJECTS = [
  {
    id: 'maths',
    title: 'Mathematics',
    count: '50+ PDFs',
    icon: Calculator,
    color: 'bg-[#2D5A27]',
    hoverColor: 'hover:bg-[#366B2F]',
  },
  {
    id: 'english',
    title: 'English',
    count: '40+ PDFs',
    icon: Book,
    color: 'bg-[#1B3A5B]',
    hoverColor: 'hover:bg-[#234B75]',
  },
  {
    id: 'gk',
    title: 'General Knowledge',
    count: '60+ PDFs',
    icon: Globe,
    color: 'bg-[#3292C7]',
    hoverColor: 'hover:bg-[#3BA8E3]',
  },
  {
    id: 'current-affairs',
    title: 'Current Affairs',
    count: 'Monthly Updates',
    icon: Newspaper,
    color: 'bg-[#4B5563]',
    hoverColor: 'hover:bg-[#606B7A]',
  },
  {
    id: 'strategy',
    title: 'Strategy Guides',
    count: '10+ Guides',
    icon: Target,
    color: 'bg-[#1B3A5B]',
    hoverColor: 'hover:bg-[#234B75]',
  },
];

export default function Notes() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSubjects = SUBJECTS.filter(subject =>
    subject.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-48 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#1B4332]/60 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8"
          >
            STUDY MATERIAL
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2"
          >
            NOTES
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight"
          >
            Curated notes by NDA/CDS-qualified mentors. Free to download.
          </motion.p>
        </div>
      </section>

      {/* Search and Grid Section */}
      <section className="py-32 px-4 max-w-7xl mx-auto relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-24">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1B4332] transition-colors" size={24} />
            <input
              type="text"
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-6 py-6 bg-white border border-gray-100 rounded-[2rem] focus:border-[#1B4332] focus:ring-0 transition-all outline-none text-gray-700 font-bold text-lg shadow-[0_20px_50px_rgba(0,0,0,0.03)] placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredSubjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -12 }}
              className={`${subject.color} p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] text-white transition-all duration-500 flex flex-col items-center text-center group cursor-pointer shadow-2xl relative overflow-hidden`}
            >
              <div className="absolute -right-8 -bottom-8 opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-500">
                <subject.icon size={160} />
              </div>
              <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 border border-white/20 shadow-xl">
                <subject.icon size={40} />
              </div>
              <h3 className="text-3xl font-black mb-3 tracking-tighter">{subject.title}</h3>
              <p className="text-white/50 text-xs font-black mb-10 tracking-[0.3em] uppercase">{subject.count}</p>
              <button className="px-10 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-[10px] font-black tracking-[0.3em] uppercase hover:bg-white hover:text-gray-900 transition-all duration-500 shadow-lg">
                Coming Soon
              </button>
            </motion.div>
          ))}
        </div>

        {filteredSubjects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 font-medium">No subjects found matching your search.</p>
          </div>
        )}
      </section>
    </div>
  );
}
