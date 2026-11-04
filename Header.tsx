import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_LINKS } from './constants';
import { auth, signInWithGoogle, logout, onAuthStateChanged, type User, isFirebaseConfigured } from './firebase-auth';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    if (!isFirebaseConfigured) {
      setAuthError("Firebase setup is incomplete. Please wait for the developer to finish configuration.");
      return;
    }
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

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
      <div
        className={`pointer-events-auto w-[calc(100%-2rem)] rounded-full border transition-[margin,padding,background-color,backdrop-filter,box-shadow] duration-300 ease-out lg:max-w-6xl ${
          shouldBeSolid
            ? 'mt-4 border-white/20 bg-white/95 py-2 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl'
            : 'mt-2 border-transparent bg-transparent py-5 shadow-none backdrop-blur-0'
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between transition-[padding] duration-300 ease-out ${
            shouldBeSolid ? 'px-8' : 'px-4'
          }`}
        >
          <Link to="/" className="flex items-center gap-3 cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shadow-md border border-white/20 shrink-0"
            >
              <img src="/logo.jpg" alt="Nishchay Defence Logo" className="w-full h-full object-cover" />
            </motion.div>
            <div>
              <h1 className={`text-xl font-black tracking-tighter transition-colors duration-300 ${shouldBeSolid ? 'text-[#1B4332]' : 'text-white'}`}>NISHCHAY</h1>
              <p className={`text-[9px] uppercase tracking-[0.3em] font-bold transition-colors duration-300 ${shouldBeSolid ? 'text-gray-500' : 'text-white/70'}`}>Defence</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-2">
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/' ? location.pathname === '/' : location.pathname.startsWith(link.href);
              return (
                <motion.div key={link.name} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to={link.href}
                    className={`px-4 py-2 text-xs font-bold tracking-widest rounded-md transition-all duration-300 relative group ${
                      shouldBeSolid
                        ? (isActive ? 'text-[#1B4332]' : 'text-gray-700 hover:text-[#1B4332]') 
                        : (isActive ? 'text-white' : 'text-white/80 hover:text-white')
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <motion.div 
                        layoutId="activeNav"
                        className={`absolute bottom-0 left-4 right-4 h-0.5 ${shouldBeSolid ? 'bg-[#1B4332]' : 'bg-white'}`}
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center gap-2 p-1 pr-4 rounded-full transition-all duration-300 ${
                    shouldBeSolid ? 'bg-gray-100 text-[#1B4332]' : 'bg-white/10 text-white backdrop-blur-md border border-white/20'
                  }`}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#1B4332] flex items-center justify-center text-white">
                      <UserIcon size={16} />
                    </div>
                  )}
                  <span className="text-xs font-bold tracking-widest truncate max-w-[80px] hidden sm:block">
                    {user.displayName?.split(' ')[0]}
                  </span>
                </motion.button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2 z-[60]"
                    >
                      <button
                        onClick={() => {
                          logout();
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-bold"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="relative">
                <motion.button 
                  whileHover={{ scale: isSigningIn ? 1 : 1.05, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
                  whileTap={{ scale: isSigningIn ? 1 : 0.95 }}
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className={`px-7 py-2.5 rounded-full text-sm font-black tracking-widest transition-all duration-300 whitespace-nowrap flex items-center gap-2 cursor-pointer disabled:opacity-75 ${
                    shouldBeSolid
                      ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F]' 
                      : 'bg-[#4CAF50] text-white hover:bg-[#45a049] shadow-[0_0_20px_rgba(76,175,80,0.3)]'
                  }`}
                >
                  {isSigningIn ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      SIGNING IN...
                    </>
                  ) : (
                    'SIGN IN'
                  )}
                </motion.button>
                {authError && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-red-50 text-red-700 text-xs p-3.5 rounded-2xl border border-red-200 shadow-xl font-bold z-[100] flex items-start gap-2">
                    <span className="flex-1 leading-relaxed">{authError}</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAuthError(null);
                      }}
                      className="text-red-400 hover:text-red-700 cursor-pointer p-0.5 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

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
        </div>
      </div>

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
              {NAV_LINKS.map((link) => {
                const isActive = link.href === '/' ? location.pathname === '/' : location.pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`block px-4 py-3 text-sm font-bold tracking-widest rounded-xl transition-colors ${
                      isActive 
                        ? 'bg-[#1B4332] text-white' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}

              {user ? (
                <button 
                  onClick={() => logout()}
                  className="w-full mt-4 bg-red-500 text-white py-4 rounded-xl font-bold tracking-widest whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  LOGOUT
                </button>
              ) : (
                <button 
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="w-full mt-4 bg-[#1B4332] text-white py-4 rounded-xl font-bold tracking-widest whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {isSigningIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      SIGNING IN...
                    </>
                  ) : (
                    'SIGN IN'
                  )}
                </button>
              )}
              {authError && !user && (
                <div className="mt-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-bold">
                  {authError}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
