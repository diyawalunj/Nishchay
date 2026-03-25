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

// Minimal loading spinner shown while a route chunk is downloading
function PageLoader() {
  return null;
}

// ScrollToTop component to reset scroll position on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
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
          <Routes>
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
        </Suspense>
      </main>

      <Footer />

      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 w-12 h-12 bg-[#1B4332] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#2D6A4F] transition-colors z-50"
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

