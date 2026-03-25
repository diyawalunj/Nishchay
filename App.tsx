import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import Home from './Home';

// Lazy-loaded route components — each page is code-split into its own chunk
// Home is imported normally above to prevent layout flickering on initial load
const About = lazy(() => import('./About'));
const Notes = lazy(() => import('./Notes'));
const Doubts = lazy(() => import('./Doubts'));
const Tests = lazy(() => import('./Tests'));
const SSB = lazy(() => import('./SSB'));
const Gallery = lazy(() => import('./Gallery'));
const Contact = lazy(() => import('./Contact'));
const Admin = lazy(() => import('./Admin'));

// Branded loading skeleton shown while a route chunk is downloading
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-16 h-16 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronUp size={28} className="text-[#1B4332]/30 rotate-0" />
        </motion.div>
      </motion.div>
      <div className="w-48 h-1 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full bg-[#1B4332]/20 rounded-full"
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

// ScrollToTop component to reset scroll position on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

// Animated route wrapper for smooth page transitions
function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/doubts" element={<Doubts />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/ssb" element={<SSB />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<Admin />} />
          {/* Fallback for other routes */}
          <Route path="*" element={<Home />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppContent() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className={`flex-grow ${!isHome ? 'pt-20' : ''}`}>
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>
      </main>

      <Footer />

      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 w-14 h-14 bg-[#1B4332] text-white rounded-2xl flex items-center justify-center shadow-[0_8px_32px_rgba(27,67,50,0.3)] hover:bg-[#2D6A4F] transition-colors z-50 backdrop-blur-sm"
          >
            <ChevronUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppContent />
    </Router>
  );
}

