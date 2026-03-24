import { motion } from 'motion/react';
import { Target, Eye, Heart, Shield, Flag, Mountain, Medal, Dumbbell, Globe, Quote, Users } from 'lucide-react';

const FOUNDERS = [
  {
    name: 'Abhijeet Gaikwad',
    image: '/abhi.jpg',
    qualification: 'NDA Qualified',
    degrees: ['B.Tech in AI & Data Science', 'B.A. (Hons.) Political Science'],
    squadron: 'NCC-1 MAH AIR SQN'
  },
  {
    name: 'Aditya Sahane',
    image: '/aditya.jpg',
    qualification: 'NDA Qualified',
    degrees: ['B.Tech in Computer Science Engineering'],
    squadron: 'NCC-3 MAH AIR SQN'
  },
  {
    name: 'Rishikesh Muthal',
    image: '/rishi.jpg',
    qualification: 'NDA Qualified',
    degrees: ['B.Tech in AI & Data Science'],
    squadron: 'NCC-1 MAH AIR SQN'
  },
  {
    name: 'Vedant Jadhav',
    image: '/vedant.jpg',
    qualification: 'CDS Qualified',
    degrees: ['B.E. Information Technology'],
    squadron: 'NCC-1 MAH AIR SQN'
  }
];

const NCC_ADVANTAGES = [
  {
    title: 'Direct SSB Entry',
    description: 'NCC Special Entry provides direct SSB interview eligibility — bypassing the written exam.',
    icon: Shield
  },
  {
    title: 'Leadership & Discipline',
    description: 'Camps, parades, and real-world command experience develop officer-like qualities and discipline.',
    icon: Flag
  },
  {
    title: 'Defence Selection Preference',
    description: 'NCC certificate holders receive preference in certain defence selections and entries.',
    icon: Mountain
  },
  {
    title: 'SSB Performance Edge',
    description: 'Better performance in SSB group tasks and interviews through hands-on military exposure.',
    icon: Medal
  },
  {
    title: 'Physical & Mental Conditioning',
    description: 'Structured fitness regimes and mental conditioning that prepare you for service life.',
    icon: Dumbbell
  },
  {
    title: 'Military Culture & Values',
    description: 'Exposure to military culture, values, and traditions through national & international camps.',
    icon: Globe
  }
];

export default function About() {
  return (
    <div className="flex-grow">
      {/* Hero Section */}
      <section className="relative py-48 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#1B4332]/60 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8"
          >
            WHO WE ARE
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-7xl md:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none"
          >
            NISHCHAY
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight"
          >
            By aspirants, for aspirants. A community dedicated to genuine defence preparation and mentorship.
          </motion.p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        <div className="max-w-5xl mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white p-16 md:p-24 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.03)] border border-gray-100 relative group"
          >
            <div className="absolute -top-10 -left-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
              <Shield size={200} />
            </div>
            <span className="section-label">Our Journey</span>
            <h2 className="text-5xl md:text-7xl font-black text-[#1A1A1A] mb-12 tracking-tighter">Our Story</h2>
            <div className="mb-12">
              <p className="quote-text text-2xl md:text-3xl mb-6 leading-tight">
                "Some goals are so worthy it's glorious even to fail... Not every fire is meant to burn down walls; some fires are made to light you from within."
              </p>
            </div>
            <div className="space-y-8 text-gray-500 text-lg leading-relaxed font-medium">
              <p>
                Our dream of joining the Armed Forces was seeded during our schooling years at Kendriya Vidyalaya, Air Force Station, Devlali. Surrounded by the pride and purpose of <span className="text-[#1B4332] font-black tracking-widest uppercase text-sm">"सेवास्तु तत्पराः"</span> that environment didn't just inspire us—it ignited something deep within us.
              </p>
              <p>
                We took our first step by joining the Armed Forces Preparatory Institute (AFPI), Kolhapur. That was the day a shared dream began turning into reality. The institute not only focuses on academics but also emphasizes the overall development of cadets—grooming boys into responsible men, instilling discipline, direction, resilience, and the unwavering fire to serve.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Founders Section */}
      <section className="py-32 bg-[#F8F9FA] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-24">
            <span className="section-label">The Team</span>
            <h2 className="text-5xl md:text-7xl font-black text-[#1A1A1A] tracking-tighter">Our Founders</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {FOUNDERS.map((founder, idx) => (
              <motion.div
                key={founder.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all duration-500 text-center group"
              >
                <div className="relative w-full aspect-[4/5] mb-8 overflow-hidden rounded-[2rem] group-hover:shadow-2xl transition-all duration-500">
                  <img 
                    src={founder.image} 
                    alt={founder.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end justify-center pb-6">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
                      <Users size={24} />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-2 text-[#1A1A1A] tracking-tight">{founder.name}</h3>
                <p className="text-[#1B4332] font-black text-[10px] tracking-[0.2em] uppercase mb-6">{founder.qualification}</p>
                <div className="space-y-2 mb-8">
                  {founder.degrees.map((degree) => (
                    <p key={degree} className="text-gray-400 text-xs font-bold uppercase tracking-widest">{degree}</p>
                  ))}
                </div>
                <div className="pt-6 border-t border-gray-50">
                  <p className="text-[9px] font-black tracking-[0.4em] text-gray-300 uppercase">{founder.squadron}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                title: 'Mission',
                description: 'Provide genuine, affordable defence exam preparation to every aspirant across India.',
                icon: Target,
                color: 'bg-green-50 text-green-600'
              },
              {
                title: 'Vision',
                description: 'Build a community of future officers who lead with integrity, discipline, and courage.',
                icon: Eye,
                color: 'bg-blue-50 text-blue-600'
              },
              {
                title: 'Values',
                description: 'Honesty, discipline, dedication, patriotism, and selfless service to the nation.',
                icon: Heart,
                color: 'bg-red-50 text-red-600'
              }
            ].map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] transition-all duration-500 group"
              >
                <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-current/10`}>
                  <item.icon size={32} />
                </div>
                <h3 className="text-3xl font-black mb-6 text-[#1A1A1A] tracking-tighter">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed font-medium text-lg">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NCC Section */}
      <section className="py-32 bg-[#F8F9FA] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-24">
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="section-label"
            >
              NATIONAL CADET CORPS
            </motion.span>
            <h2 className="text-5xl md:text-8xl font-black text-[#1A1A1A] mb-8 tracking-tighter">NCC Advantages</h2>
            <p className="text-gray-400 font-medium max-w-2xl mx-auto text-xl">
              Our founders are NCC cadets. Here's why NCC is a game-changer for defence aspirants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {NCC_ADVANTAGES.map((advantage, idx) => (
              <motion.div
                key={advantage.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="w-14 h-14 bg-green-50 text-[#1B4332] rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <advantage.icon size={28} />
                </div>
                <h3 className="text-xl font-bold mb-4 text-[#1A1A1A]">{advantage.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">
                  {advantage.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
