import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Send, MessageSquare, User, Tag, ChevronRight, Search } from 'lucide-react';

interface Doubt {
  id: string;
  question: string;
  answer: string;
  category: string;
  author: string;
  date?: string;
}

const CATEGORIES = [
  'All',
  'Mathematics',
  'English',
  'GK',
  'Current Affairs',
  'SSB',
  'NCC',
  'Fitness',
  'Strategy'
];

const INITIAL_DOUBTS: Doubt[] = [
  {
    id: '1',
    question: 'How to prepare for NDA Maths in 3 months?',
    answer: 'Focus on NCERT basics first, then solve past 10 years\' papers. Prioritize Algebra, Trigonometry, and Calculus.',
    category: 'Mathematics',
    author: 'Rahul S.',
  },
  {
    id: '2',
    question: 'What books are best for CDS English?',
    answer: 'Wren & Martin for Grammar, Word Power Made Easy for vocabulary, and read The Hindu daily for comprehension.',
    category: 'English',
    author: 'Anjali P.',
  },
  {
    id: '3',
    question: 'How important is GK for NDA exam?',
    answer: 'GK carries 400 marks in NDA GAT paper. Focus on History, Geography, Physics, Chemistry, and Current Affairs.',
    category: 'GK',
    author: 'Vikram M.',
  },
  {
    id: '4',
    question: 'What are the 15 OLQs tested in SSB?',
    answer: 'Officer Like Qualities include Effective Intelligence, Reasoning, Organizing Ability, Power of Expression, and more.',
    category: 'SSB',
    author: 'Sandeep K.',
  }
];

export default function Doubts() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [doubts, setDoubts] = useState<Doubt[]>(INITIAL_DOUBTS);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    category: 'Mathematics',
    question: ''
  });
  const [errors, setErrors] = useState<{ name?: string; phone?: string; question?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredDoubts = selectedCategory === 'All' 
    ? doubts 
    : doubts.filter(d => d.category === selectedCategory);

  const validate = () => {
    const newErrors: { name?: string; phone?: string; question?: string } = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Contact number is required';
    } else if (!/^\d{10}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Enter a valid 10-digit number';
    }

    if (!formData.question.trim()) {
      newErrors.question = 'Question is required';
    } else if (formData.question.trim().length < 10) {
      newErrors.question = 'Question must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/qna', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit question');
      }

      setFormData({ name: '', phone: '', category: 'Mathematics', question: '' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error submitting question:', error);
      alert(`Failed to submit question: ${error.message}. Please try again later.`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            ASK ANYTHING
          </span>
          <h1 className="text-7xl md:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none">
            DOUBTS
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Get your questions answered by NDA/CDS-qualified mentors.
          </p>
        </motion.div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-24 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Ask Form */}
          <div className="lg:col-span-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[2.5rem] p-10 shadow-[0_40px_100px_rgba(0,0,0,0.03)] border border-gray-100 sticky top-32"
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332] shadow-inner">
                  <HelpCircle size={28} />
                </div>
                <h2 className="text-3xl font-black tracking-tighter text-[#1A1A1A]">Ask Now</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-green-50 text-green-700 p-5 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase border border-green-100 mb-6"
                    >
                      Question submitted successfully!
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Your Name</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({...formData, name: e.target.value});
                      if (errors.name) setErrors({...errors, name: undefined});
                    }}
                    placeholder="e.g. Rahul Singh"
                    className={`w-full px-6 py-4 rounded-2xl bg-gray-50 border ${errors.name ? 'border-red-500 ring-4 ring-red-500/5' : 'border-gray-100 focus:border-[#1B4332] focus:ring-4 focus:ring-[#1B4332]/5'} outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300`}
                  />
                  {errors.name && <p className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Contact Number</label>
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({...formData, phone: e.target.value});
                      if (errors.phone) setErrors({...errors, phone: undefined});
                    }}
                    placeholder="10-digit mobile"
                    className={`w-full px-6 py-4 rounded-2xl bg-gray-50 border ${errors.phone ? 'border-red-500 ring-4 ring-red-500/5' : 'border-gray-100 focus:border-[#1B4332] focus:ring-4 focus:ring-[#1B4332]/5'} outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300`}
                  />
                  {errors.phone && <p className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Category</label>
                  <div className="relative">
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700 appearance-none cursor-pointer"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronRight size={20} className="rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Your Question</label>
                  <textarea 
                    value={formData.question}
                    onChange={(e) => {
                      setFormData({...formData, question: e.target.value});
                      if (errors.question) setErrors({...errors, question: undefined});
                    }}
                    placeholder="Describe your doubt in detail..."
                    rows={4}
                    className={`w-full px-6 py-4 rounded-2xl bg-gray-50 border ${errors.question ? 'border-red-500 ring-4 ring-red-500/5' : 'border-gray-100 focus:border-[#1B4332] focus:ring-4 focus:ring-[#1B4332]/5'} outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 resize-none`}
                  />
                  {errors.question && <p className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{errors.question}</p>}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isSubmitting}
                  type="submit"
                  className={`w-full py-5 ${isSubmitting ? 'bg-gray-100 text-gray-400' : 'bg-[#1B4332] text-white hover:bg-[#2D6A4F]'} rounded-2xl font-black tracking-[0.3em] uppercase text-xs flex items-center justify-center gap-3 transition-all duration-300 shadow-xl shadow-[#1B4332]/10`}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  {isSubmitting ? 'SUBMITTING...' : 'SUBMIT DOUBT'}
                </motion.button>
              </form>
            </motion.div>
          </div>

          {/* Right Column: Doubts List */}
          <div className="lg:col-span-8">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-3 mb-12">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-300 ${
                    selectedCategory === cat
                      ? 'bg-[#1B4332] text-white shadow-xl shadow-[#1B4332]/20 scale-105'
                      : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Doubts Feed */}
            <div className="space-y-8">
              <AnimatePresence mode="popLayout">
                {filteredDoubts.map((doubt, index) => (
                  <motion.div
                    key={doubt.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 group hover:border-[#1B4332]/20 transition-all duration-500 relative overflow-hidden"
                  >
                    <div className="absolute -right-10 -top-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500">
                      <HelpCircle size={200} />
                    </div>
                    <div className="flex gap-6 relative z-10">
                      <div className="mt-1.5 text-[#1B4332]/20 group-hover:text-[#1B4332] transition-colors duration-500">
                        <HelpCircle size={32} />
                      </div>
                      <div className="flex-grow">
                        <h3 className="text-2xl font-black tracking-tight text-[#1A1A1A] mb-6 group-hover:text-[#1B4332] transition-colors duration-500 leading-tight">
                          {doubt.question}
                        </h3>
                        <div className="flex items-start gap-5 mb-10 bg-gray-50/50 p-8 rounded-3xl border border-gray-50 group-hover:bg-white transition-colors duration-500">
                          <div className="mt-1 p-1.5 bg-[#1B4332]/10 text-[#1B4332] rounded-lg">
                            <MessageSquare size={18} />
                          </div>
                          <p className="text-gray-500 font-medium leading-relaxed text-lg">
                            {doubt.answer}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-between gap-6 pt-8 border-t border-gray-50">
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 text-gray-300">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <User size={14} className="text-gray-400" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{doubt.author}</span>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-100" />
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{doubt.date}</span>
                          </div>
                          
                          <div className="flex items-center gap-2.5 px-5 py-2 bg-[#1B4332]/5 text-[#1B4332] rounded-2xl border border-[#1B4332]/5">
                            <Tag size={12} className="opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{doubt.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredDoubts.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200"
                >
                  <Search size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-bold uppercase tracking-widest">No doubts found in this category</p>
                </motion.div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
