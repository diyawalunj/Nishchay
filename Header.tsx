import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_LINKS } from './constants';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const isHome = location.pathname === '/';
  const shouldBeSolid = isScrolled || !isHome;

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none flex flex-col items-center"
    >
      <motion.div 
        layout
        initial={false}
        animate={{
          marginTop: shouldBeSolid ? '1rem' : '0.5rem',
          paddingTop: shouldBeSolid ? '0.5rem' : '1.25rem',
          paddingBottom: shouldBeSolid ? '0.5rem' : '1.25rem',
          backgroundColor: shouldBeSolid 
            ? 'rgba(255, 255, 255, 0.95)' 
            : 'rgba(255, 255, 255, 0)',
          backdropFilter: shouldBeSolid ? 'blur(16px)' : 'blur(0px)',
          boxShadow: shouldBeSolid 
            ? '0 20px 40px -12px rgba(0, 0, 0, 0.15)' 
            : '0 0 0 rgba(0, 0, 0, 0)',
          borderWidth: shouldBeSolid ? '1px' : '0px',
          borderColor: shouldBeSolid ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0)',
          width: 'calc(100% - 2rem)',
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 30,
          backgroundColor: { duration: 0.3 },
          backdropFilter: { duration: 0.3 }
        }}
        style={{ borderRadius: '9999px' }}
        className="pointer-events-auto overflow-hidden lg:max-w-6xl"
      >
        <motion.div 
          layout
          animate={{
            paddingLeft: shouldBeSolid ? '2rem' : '1rem',
            paddingRight: shouldBeSolid ? '2rem' : '1rem',
          }}
          className="max-w-7xl mx-auto flex items-center justify-between"
        >
          <Link to="/" className="flex items-center gap-3 cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                shouldBeSolid ? 'bg-[#1B4332] text-white shadow-md' : 'bg-white/10 backdrop-blur-md text-white border border-white/20'
              }`}
            >
              <Shield size={22} />
            </motion.div>
            <div>
              <h1 className={`text-xl font-black tracking-tighter transition-colors duration-300 ${shouldBeSolid ? 'text-[#1B4332]' : 'text-white'}`}>NISHCHAY</h1>
              <p className={`text-[9px] uppercase tracking-[0.3em] font-bold transition-colors duration-300 ${shouldBeSolid ? 'text-gray-500' : 'text-white/70'}`}>Defence Preparation</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-2">
            {NAV_LINKS.map((link) => (
              <motion.div key={link.name} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to={link.href}
                  className={`px-4 py-2 text-xs font-bold tracking-widest rounded-md transition-all duration-300 relative group ${
                    shouldBeSolid
                      ? (location.pathname === link.href ? 'text-[#1B4332]' : 'text-gray-700 hover:text-[#1B4332]') 
                      : (location.pathname === link.href ? 'text-white' : 'text-white/80 hover:text-white')
                  }`}
                >
                  {link.name}
                  {location.pathname === link.href && (
                    <motion.div 
                      layoutId="activeNav"
                      className={`absolute bottom-0 left-4 right-4 h-0.5 ${shouldBeSolid ? 'bg-[#1B4332]' : 'bg-white'}`}
                    />
                  )}
                </Link>
              </motion.div>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/contact" className="hidden sm:block">
              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
                whileTap={{ scale: 0.95 }}
                className={`px-7 py-2.5 rounded-full text-sm font-black tracking-widest transition-all duration-300 whitespace-nowrap ${
                  shouldBeSolid
                    ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F]' 
                    : 'bg-[#4CAF50] text-white hover:bg-[#45a049] shadow-[0_0_20px_rgba(76,175,80,0.3)]'
                }`}
              >
                JOIN NOW
              </motion.button>
            </Link>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${
                shouldBeSolid ? 'text-[#1B4332] hover:bg-gray-100' : 'text-white hover:bg-white/10'
              }`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="lg:hidden pointer-events-auto overflow-hidden transition-all duration-500 mt-2 w-[calc(100%-2rem)] bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20"
          >
            <div className="px-4 py-6 space-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`block px-4 py-3 text-sm font-bold tracking-widest rounded-xl transition-colors ${
                    location.pathname === link.href 
                      ? 'bg-[#1B4332] text-white' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/contact" className="block">
                <button className="w-full mt-4 bg-[#1B4332] text-white py-4 rounded-xl font-bold tracking-widest whitespace-nowrap">
                  JOIN NOW
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
