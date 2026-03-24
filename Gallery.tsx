import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Camera, Trophy, Users, Dumbbell } from 'lucide-react';

const categories = ['ALL', 'NCC CAMPS', 'TRAINING', 'EVENTS', 'ACHIEVEMENTS', 'SPORTS'];

const galleryItems = [
  {
    id: 1,
    category: 'NCC CAMPS',
    image: '/c1.jpg',
  },
  {
    id: 2,
    category: 'NCC CAMPS',
    image: '/c2.jpg',
  },
  {
    id: 3,
    category: 'TRAINING',
    image: '/t1.jpg',
  },
  {
    id: 4,
    category: 'EVENTS',
    image: '/e1.jpg',
  },
    {
    id: 5,
    category: 'EVENTS',
    image: '/e2.jpg',
  },
    {
    id: 6,
    category: 'EVENTS',
    image: '/e3.jpg',
  },
    {
    id: 7,
    category: 'EVENTS',
    image: '/e4.jpg',
  },
  {
    id: 8,
    category: 'EVENTS',
    image: '/e5.jpg',
  },
  {
    id: 9,
    category: 'TRAINING',
    image: '/t2.jpg',
  },
  {
    id: 10,
    category: 'TRAINING',
    image: '/t3.jpg',
  },
  {
    id: 11,
    category: 'ACHIEVEMENTS',
    image: '/a1.jpg',
  },
    {
    id: 12,
    category: 'ACHIEVEMENTS',
    image: '/a2.jpg',
  },
  {
    id: 13,
    category: 'SPORTS',
    image: '/s1.jpg',
  },
  {
    id: 14,
    category: 'SPORTS',
    image: '/s2.jpg',
  },
  {
    id: 15,
    category: 'NCC CAMPS',
    image: '/c3.jpg',
  },
];

const Gallery: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('ALL');

  const filteredItems = activeCategory === 'ALL' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === activeCategory);

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
            MEMORIES
          </span>
          <h1 className="text-7xl md:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none">
            GALLERY
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Moments from our journey — camps, training, events, and achievements.
          </p>
        </motion.div>
      </section>

      {/* Filter Bar */}
      <section className="max-w-7xl mx-auto px-4 py-24 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-300 ${
                activeCategory === category
                  ? 'bg-[#1B4332] text-white shadow-xl shadow-[#1B4332]/20 scale-105'
                  : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-48">
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                whileHover={{ y: -12 }}
                className="bg-white rounded-[3rem] aspect-[4/5] flex flex-col items-center justify-end text-center text-white relative group overflow-hidden shadow-2xl transition-all duration-500"
              >
                {/* Image Background */}
                <img 
                  src={item.image} 
                  alt={item.category}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                
                <div className="p-12 relative z-10 w-full">
                  <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.3em]">
                    {item.category}
                  </p>
                </div>

                {/* Hover Border Effect */}
                <div className="absolute inset-0 border-[12px] border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[3rem] pointer-events-none" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </section>
    </div>
  );
};

export default Gallery;
