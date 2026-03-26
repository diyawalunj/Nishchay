import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { Shield, Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_LINKS } from './constants';
import { auth, signInWithGoogle, logout, onAuthStateChanged, type User, isFirebaseConfigured, checkIfAdmin } from './firebase';
import { LayoutDashboard } from 'lucide-react';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(checkIfAdmin(currentUser));
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (!isFirebaseConfigured) {
      setAuthError("Firebase setup is incomplete. Please wait for the developer to finish configuration.");
      return;
    }
    try {
      setAuthError(null);
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    }
  };

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const diff = latest - lastScrollY;

    if (Math.abs(diff) > 5) {
      setScrollDirection(diff > 0 ? 'down' : 'up');
      setLastScrollY(latest);
    }

    setIsScrolled(latest > 50);
  });

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const isHome = location.pathname === '/';
  const shouldBeSolid = isScrolled || !isHome;

  // 🔥 ECELL behavior control
  const isExpanded =
    !isScrolled ||
    isHovered ||
    scrollDirection === 'up' ||
    isMobileMenuOpen;

  return (
    <motion.header
      animate={{
        y: isExpanded ? 0 : -100,
        opacity: isExpanded ? 1 : 0.95
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="sticky top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out"
    >
      <div className={`w-full px-4 md:px-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isScrolled ? 'pt-4' : 'pt-0'}`}>
        
        <div
          className={`mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            shouldBeSolid
              ? 'bg-white/80 backdrop-blur-md border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-[2rem] max-w-6xl'
              : 'bg-transparent border-b border-white/5 max-w-full'
          } ${isScrolled ? 'py-3 md:py-4 px-6 md:px-10' : 'py-6 md:py-8 px-6 md:px-10'}`}
        >
          <motion.div layout className="flex items-center justify-between">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  shouldBeSolid
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-white/10 backdrop-blur-md text-white border border-white/20'
                }`}
              >
                <Shield size={22} />
              </motion.div>

              <div>
                <h1 className={`text-lg md:text-xl font-black tracking-tighter ${shouldBeSolid ? 'text-[#1B4332]' : 'text-white'}`}>
                  NISHCHAY
                </h1>
                <p className={`text-[8px] md:text-[9px] uppercase tracking-[0.3em] font-bold ${shouldBeSolid ? 'text-gray-500' : 'text-white/70'}`}>
                  Defence Preparation
                </p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-2">
              {NAV_LINKS.map((link) => {
                const isDoubtLink = link.name === 'DOUBTS';
                const linkName = (isDoubtLink && isAdmin) ? 'DOUBT PANEL' : link.name;
                const linkHref = (isDoubtLink && isAdmin) ? '/admin' : link.href;

                return (
                  <motion.div key={link.name} whileHover={{ y: -2 }}>
                    <Link
                      to={linkHref}
                      className={`px-4 py-2 text-xs font-bold tracking-widest rounded-md transition-all ${
                        shouldBeSolid
                          ? 'text-gray-700 hover:text-[#1B4332]'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      {linkName}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {user ? (
                <button
                  onClick={logout}
                  className="text-sm font-bold text-red-500"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="px-5 py-2 rounded-full bg-[#1B4332] text-white text-xs font-bold"
                >
                  SIGN IN
                </button>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden text-white"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="lg:hidden bg-white shadow-xl"
          >
            <div className="p-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.name} to={link.href} className="block py-2">
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
