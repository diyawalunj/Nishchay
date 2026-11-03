import { useState, useEffect, useLayoutEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { ChevronUp } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import Home from './Home';
import NotFound from './NotFound';

// Lazy-loaded route components — each page is code-split into its own chunk
// Home is imported normally above to prevent layout flickering on initial load
const About = lazy(() => import('./About'));
const Notes = lazy(() => import('./Notes'));
const Gallery = lazy(() => import('./Gallery'));
const Contact = lazy(() => import('./Contact'));
const NIntel = lazy(() => import('./NIntel'));
const NIntelStoryDetail = lazy(() => import('./NIntelStoryDetail'));
const NIntelArchive = lazy(() => import('./NIntelArchive'));
const NIntelAdmin = lazy(() => import('./NIntelAdmin'));
const Articles = lazy(() => import('./Articles'));
const ArticleDetail = lazy(() => import('./ArticleDetail'));

// Branded loading skeleton shown while a route chunk is downloading
function PageLoader() {
  return (
    <div role="status" aria-live="polite" className="min-h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-white/90 px-5 py-3 text-sm font-semibold text-[#1B4332] shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1B4332]/20 border-t-[#1B4332]" />
        Loading page…
      </div>
    </div>
  );
}

// Reset scroll on forward navigation and restore it on browser back/forward.
function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousLocation = useRef<{ key: string } | null>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
    if (previousLocation.current) {
      positions.current.set(previousLocation.current.key, window.scrollY);
    }

    const target = navigationType === 'POP'
      ? positions.current.get(location.key) ?? 0
      : 0;
    window.scrollTo({ top: target, behavior: 'auto' });
    previousLocation.current = { key: location.key };
  }, [location.key, location.pathname, navigationType]);

  return null;
}

// Animated route wrapper for smooth page transitions
function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="print:opacity-100 print:transform-none print:overflow-visible print:block print:h-auto"
    >
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/n-intel" element={<NIntel />} />
        <Route path="/n-intel/edition/:date" element={<NIntel />} />
        <Route path="/n-intel/story/:id" element={<NIntelStoryDetail />} />
        <Route path="/n-intel/archive" element={<NIntelArchive />} />
        <Route path="/n-intel/admin" element={<NIntelAdmin />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />
        {/* Fallback for other routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </motion.div>
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

  // Suppress browser default title in printed headers/footers
  useEffect(() => {
    let originalTitle = document.title;
    const handleBeforePrint = () => {
      originalTitle = document.title;
      document.title = ' ';
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col print:min-h-0 print:block">
      <div className="print:hidden">
        <Header />
      </div>
      
      <main className={`flex-grow ${!isHome ? 'pt-20' : ''} print:pt-0 print:m-0 print:flex-none`}>
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>

      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <div className="print:hidden">
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MotionConfig reducedMotion="user">
        <ScrollToTop />
        <AppContent />
      </MotionConfig>
    </Router>
  );
}

