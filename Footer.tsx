import { Shield, MessageCircle, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FOOTER_LINKS } from './constants';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-[#050A0F] text-white pt-24 pb-12 overflow-hidden grain-overlay">
      {/* Animated gradient top divider */}
      <div className="absolute top-0 left-0 w-full h-px">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-[#1B4332]/40 to-transparent animate-shimmer"></div>
      </div>
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1B4332]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-6 group cursor-default">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-all duration-500 group-hover:rotate-12">
                <Shield size={28} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-white">NISHCHAY</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-8 font-medium">
              By Aspirants, For Aspirants. <br />
              Your trusted partner in the journey to becoming a Defence Officer.
            </p>

            {/* Social Media Icons */}
            <div className="flex items-center gap-3">
              <a href="https://chat.whatsapp.com/BjClfB1EydhBWBevGOmvbG" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300">
                <MessageCircle size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-8 flex items-center gap-2">
              <span className="w-4 h-px bg-white/20"></span>
              Quick Links
            </h4>
            <ul className="space-y-4">
              {FOOTER_LINKS.quickLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-gray-400 hover:text-white transition-all duration-300 text-sm font-medium hover:translate-x-1 inline-block">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-8 flex items-center gap-2">
              <span className="w-4 h-px bg-white/20"></span>
              Resources
            </h4>
            <ul className="space-y-4">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-gray-400 hover:text-white transition-all duration-300 text-sm font-medium hover:translate-x-1 inline-block">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Back to Top for Mobile */}
          <div className="flex flex-col justify-between">
            <div>
              <h4 className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-8 flex items-center gap-2">
                <span className="w-4 h-px bg-white/20"></span>
                Navigate
              </h4>
              <button 
                onClick={scrollToTop}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold transition-all duration-300 group"
              >
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 group-hover:border-white/20 group-hover:bg-white/10 transition-all duration-300">
                  <ChevronUp size={16} />
                </div>
                Back to Top
              </button>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 text-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-white font-black tracking-[0.4em] uppercase text-[10px] md:text-xs animate-text-glow">
                Designed & Engineered By Diya Walunj
              </p>
              <p className="text-white/40 font-bold tracking-[0.3em] uppercase text-[8px] md:text-[10px]">
                Founded By Abhijeet, Vedant, Rishikesh & Aditya
              </p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
              <p>© 2026 Nishchay. All rights reserved.</p>
              <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-white/10"></div>
              <p className="text-white/40">Jai Hind! 🇮🇳</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
