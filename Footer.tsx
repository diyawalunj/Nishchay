import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FOOTER_LINKS } from './constants';

export default function Footer() {
  return (
    <footer className="relative bg-[#050A0F] text-white pt-24 pb-12 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1B4332]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-6 group cursor-default">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-all duration-500 group-hover:rotate-12">
                <Shield size={28} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-white">NISHCHAY</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium">
              By Aspirants, For Aspirants. <br />
              Your trusted partner in the journey to becoming a Defence Officer.
            </p>
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
