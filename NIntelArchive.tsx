import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Calendar, Search, ArrowRight, Newspaper, ChevronLeft
} from 'lucide-react';
import { formatDisplayDate } from './n-intel-whatsapp';
import { auth, onAuthStateChanged, checkIfAdmin } from './firebase';

interface EditionSummary {
  date: string;
  storyCount: number;
}

export default function NIntelArchive() {
  const [editions, setEditions] = useState<EditionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchYearMonth, setSearchYearMonth] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setIsAdmin(checkIfAdmin(currentUser));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch('/api/n-intel/editions')
      .then(res => res.json())
      .then(data => {
        if (data.editions && Array.isArray(data.editions)) {
          setEditions(data.editions);
        }
      })
      .catch(err => console.error('Failed to load editions:', err))
      .finally(() => setLoading(false));
  }, []);

  // Compute available year-months for filtering
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    editions.forEach(ed => {
      if (ed.date && ed.date.length >= 7) {
        months.add(ed.date.slice(0, 7)); // 'YYYY-MM'
      }
    });
    return Array.from(months).sort().reverse();
  }, [editions]);

  const filteredEditions = useMemo(() => {
    return editions.filter(ed => {
      const matchMonth = searchYearMonth === 'All' || ed.date.startsWith(searchYearMonth);
      const matchQuery = !searchQuery || ed.date.includes(searchQuery) || formatDisplayDate(ed.date).toLowerCase().includes(searchQuery.toLowerCase());
      return matchMonth && matchQuery;
    });
  }, [editions, searchYearMonth, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section — Exactly matching Notes, Gallery, About */}
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
            HISTORICAL ARCHIVES
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2"
          >
            ARCHIVES
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight mb-8"
          >
            Browse every published daily edition of Team Nishchay's curated intelligence briefings.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/n-intel"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-black tracking-widest uppercase hover:bg-white/20 transition-all"
            >
              <ChevronLeft size={16} />
              <span>Back to Today's N-INTEL</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-24 px-4 max-w-7xl mx-auto relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>

        {/* Search & Month Filter Bar */}
        <div className="max-w-4xl mx-auto mb-16 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1B4332] transition-colors" size={24} />
            <input
              type="text"
              placeholder="Search date or month..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] focus:border-[#1B4332] focus:ring-0 transition-all outline-none text-gray-700 font-bold text-base shadow-[0_20px_50px_rgba(0,0,0,0.03)] placeholder:text-gray-300"
            />
          </div>

          {availableMonths.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
              <button
                onClick={() => setSearchYearMonth('All')}
                className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  searchYearMonth === 'All'
                    ? 'bg-[#1B4332] text-white shadow-md'
                    : 'bg-white border border-gray-100 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Months
              </button>
              {availableMonths.map(ym => {
                const [y, m] = ym.split('-');
                const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                return (
                  <button
                    key={ym}
                    onClick={() => setSearchYearMonth(ym)}
                    className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                      searchYearMonth === ym
                        ? 'bg-[#1B4332] text-white shadow-md'
                        : 'bg-white border border-gray-100 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Editions Grid */}
        {loading ? (
          <div className="py-24 text-center text-gray-400 font-bold text-sm animate-pulse bg-white rounded-[2rem] border border-gray-100">
            Loading archives...
          </div>
        ) : filteredEditions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm max-w-xl mx-auto">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-black text-[#1A1A1A] mb-2 tracking-tight">No editions found</h3>
            <p className="text-gray-500 text-sm font-medium mb-6">No archives match your filter.</p>
            <button
              onClick={() => { setSearchYearMonth('All'); setSearchQuery(''); }}
              className="px-6 py-3 bg-[#1B4332] text-white text-xs font-black tracking-widest uppercase rounded-xl hover:bg-[#143024] transition-all"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEditions.map((ed, idx) => {
              const displayDate = formatDisplayDate(ed.date);
              const isToday = ed.date === new Date().toISOString().slice(0, 10);

              return (
                <motion.div
                  key={ed.date}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white p-8 md:p-10 rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="section-label mb-0">
                        {ed.date}
                      </span>
                      {isToday && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase rounded-full">
                          Today
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight group-hover:text-[#1B4332] transition-colors mb-3">
                      {displayDate}
                    </h2>

                    <p className="text-gray-500 text-xs md:text-sm leading-relaxed mb-6 font-medium">
                      Complete daily intelligence briefing with verified updates.
                    </p>

                    <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold text-gray-700">
                      <Newspaper size={16} className="text-[#1B4332]" />
                      <span className="text-[#1A1A1A] font-black">{ed.storyCount}</span>
                      <span>updates published</span>
                    </div>
                  </div>

                  <Link
                    to={`/n-intel?date=${ed.date}`}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#1B4332] hover:bg-[#143024] text-white rounded-2xl font-bold transition-all shadow-md shadow-[#1B4332]/20 group-hover:scale-105"
                  >
                    <span>Read Edition</span>
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
