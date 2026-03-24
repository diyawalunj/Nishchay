import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_LINKS } from './constants';
import { auth, signInWithGoogle, logout, onAuthStateChanged, type User, isFirebaseConfigured, checkIfAdmin } from './firebase';
import { LayoutDashboard } from 'lucide-react';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

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
        className="pointer-events-auto lg:max-w-6xl"
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
            {NAV_LINKS.map((link) => {
              const isDoubtLink = link.name === 'DOUBTS';
              const linkName = (isDoubtLink && isAdmin) ? 'DOUBT PANEL' : link.name;
              const linkHref = (isDoubtLink && isAdmin) ? '/admin' : link.href;
              
              return (
                <motion.div key={link.name} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to={linkHref}
                    className={`px-4 py-2 text-xs font-bold tracking-widest rounded-md transition-all duration-300 relative group ${
                      shouldBeSolid
                        ? (location.pathname === linkHref ? 'text-[#1B4332]' : 'text-gray-700 hover:text-[#1B4332]') 
                        : (location.pathname === linkHref ? 'text-white' : 'text-white/80 hover:text-white')
                    }`}
                  >
                    {linkName}
                    {location.pathname === linkHref && (
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
              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSignIn}
                className={`px-7 py-2.5 rounded-full text-sm font-black tracking-widest transition-all duration-300 whitespace-nowrap relative ${
                  shouldBeSolid
                    ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F]' 
                    : 'bg-[#4CAF50] text-white hover:bg-[#45a049] shadow-[0_0_20px_rgba(76,175,80,0.3)]'
                }`}
              >
                SIGN IN
                {authError && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-red-50 text-red-600 text-[10px] p-2 rounded-lg border border-red-100 shadow-lg font-bold z-[60]">
                    {authError}
                  </div>
                )}
              </motion.button>
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
              {NAV_LINKS.map((link) => {
                const isDoubtLink = link.name === 'DOUBTS';
                const linkName = (isDoubtLink && isAdmin) ? 'DOUBT PANEL' : link.name;
                const linkHref = (isDoubtLink && isAdmin) ? '/admin' : link.href;
                
                return (
                  <Link
                    key={link.name}
                    to={linkHref}
                    className={`block px-4 py-3 text-sm font-bold tracking-widest rounded-xl transition-colors ${
                      location.pathname === linkHref 
                        ? 'bg-[#1B4332] text-white' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {linkName}
                  </Link>
                );
              })}
              
              {user && isAdmin && (
                <Link
                  to="/admin"
                  className="block px-4 py-3 text-sm font-bold tracking-widest rounded-xl transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-2"
                >
                  <LayoutDashboard size={18} />
                  ADMIN PANEL
                </Link>
              )}

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
                  className="w-full mt-4 bg-[#1B4332] text-white py-4 rounded-xl font-bold tracking-widest whitespace-nowrap"
                >
                  SIGN IN
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
