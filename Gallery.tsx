import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Camera, Trophy, Users, Dumbbell, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const filteredItems = activeCategory === 'ALL' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === activeCategory);

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1));
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0));
    }
  };

  const selectedItem = selectedIndex !== null ? filteredItems[selectedIndex] : null;

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
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                whileHover={{ y: -12 }}
                onClick={() => setSelectedIndex(index)}
                className="bg-white rounded-[3rem] aspect-[4/5] flex flex-col items-center justify-end text-center text-white relative group overflow-hidden shadow-2xl transition-all duration-500 cursor-pointer"
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

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedIndex(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl cursor-zoom-out"
          >
            {/* Close Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-4 z-[110]"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex(null);
              }}
            >
              <X size={48} strokeWidth={1.5} />
            </motion.button>

            {/* Navigation Arrows */}
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-[110]">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.1, x: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={handlePrevious}
                className="p-6 rounded-full bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10 pointer-events-auto transition-all"
              >
                <ChevronLeft size={40} strokeWidth={1.5} />
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.1, x: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleNext}
                className="p-6 rounded-full bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10 pointer-events-auto transition-all"
              >
                <ChevronRight size={40} strokeWidth={1.5} />
              </motion.button>
            </div>

            {/* Image Container */}
            <motion.div
              key={selectedItem.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative max-w-5xl w-full bg-white/5 backdrop-blur-md rounded-[4rem] overflow-hidden shadow-2xl flex flex-col items-center p-4 border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedItem.image}
                alt="Gallery Preview"
                className="w-full h-full object-contain max-h-[75vh] rounded-[3.5rem]"
                referrerPolicy="no-referrer"
              />
              
              {/* Category Indicator */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-10 px-8 py-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full"
              >
                <p className="text-[10px] text-white font-black uppercase tracking-[0.4em]">
                  {selectedItem.category}
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
