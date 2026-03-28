import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Swords,
  GraduationCap,
  Plane,
  Settings,
  Clock,
  BarChart3,
  FileText,
  ChevronLeft,
  Upload,
  FolderOpen
} from 'lucide-react';
import { auth, onAuthStateChanged, checkIfAdmin } from './firebase';

const examCategories = [
  {
    title: 'NDA',
    subtitle: 'National Defence Academy',
    description: 'For 12th pass candidates – Army, Navy & Air Force',
    icon: <Swords size={24} />,
    iconBg: 'bg-[#2D6A4F]',
    status: 'OPEN FOLDERS'
  },
  {
    title: 'CDS',
    subtitle: 'Combined Defence Services',
    description: 'For graduates – IMA, OTA, Naval & Air Force Academy',
    icon: <GraduationCap size={24} />,
    iconBg: 'bg-[#E9C46A]',
    status: 'OPEN FOLDERS'
  },
  {
    title: 'AFCAT',
    subtitle: 'Air Force Common Admission Test',
    description: 'Direct entry to Indian Air Force as commissioned officer',
    icon: <Plane size={24} />,
    iconBg: 'bg-[#4895EF]',
    status: 'COMING SOON'
  },
  {
    title: 'Technical Entries',
    subtitle: 'TES & SSC Technical',
    description: '10+2 B.Tech and SSC technical entries into Armed Forces',
    icon: <Settings size={24} />,
    iconBg: 'bg-[#151C25]',
    status: 'COMING SOON'
  }
];

const testFeatures = [
  {
    title: 'Timed Tests',
    description: 'Real exam conditions with strict time limits to build speed and accuracy.',
    icon: <Clock size={24} />
  },
  {
    title: 'Result Analysis',
    description: 'Detailed performance breakdowns with topic-wise scoring and improvement areas.',
    icon: <BarChart3 size={24} />
  },
  {
    title: 'Previous Year Papers',
    description: 'Solve past papers to understand exam patterns and frequently asked topics.',
    icon: <FileText size={24} />
  }
];

const generateYearFolders = (examName: string) => {
  const folders = [];
  for (let year = 2025; year >= 2017; year--) {
    folders.push({ id: `${examName.toLowerCase()}-2-${year}`, title: `${examName} II, ${year}` });
    folders.push({ id: `${examName.toLowerCase()}-1-${year}`, title: `${examName} I, ${year}` });
  }
  return folders;
};

const Tests: React.FC = () => {
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setIsAdmin(checkIfAdmin(currentUser));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedExam || selectedFolder) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedExam, selectedFolder]);

  // Detail view for specific year's folder
  if (selectedFolder) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <button
            onClick={() => setSelectedFolder(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] mb-8 transition-colors group"
          >
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <ChevronLeft size={20} />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase">Back to {selectedExam?.title} Folders</span>
          </button>

          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-gray-100 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-gray-100 pb-12">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 ${selectedExam?.iconBg || 'bg-[#1B4332]'} rounded-3xl flex items-center justify-center text-white shadow-xl`}>
                  <FolderOpen size={40} />
                </div>
                <div>
                  <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-2 tracking-tighter">{selectedFolder.title}</h2>
                  <p className="text-gray-500 font-medium text-lg">Previous year papers for {selectedFolder.title}</p>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => alert('Folder ready for uploads. API integration to be added.')} className="flex items-center justify-center gap-3 px-8 py-4 bg-[#1B4332] text-white rounded-2xl font-bold hover:bg-[#143024] transition-all shadow-lg shadow-[#1B4332]/20 hover:scale-105 hover:-translate-y-1">
                  <Upload size={20} />
                  Upload PDF
                </button>
              )}
            </div>

            <div className="text-center py-24 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm text-gray-300">
                <FileText size={48} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tighter">No PDFs uploaded yet</h3>
              <p className="text-gray-500 max-w-md mx-auto font-medium leading-relaxed">
                This folder is empty. {isAdmin ? 'Click the upload button above to add PDF question papers.' : 'Check back later for question papers.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View for Exam structure (e.g. NDA folders)
  if (selectedExam) {
    const yearFolders = generateYearFolders(selectedExam.title);
    
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <button
            onClick={() => {
              setSelectedExam(null);
              setSelectedFolder(null);
            }}
            className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] mb-8 transition-colors group"
          >
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <ChevronLeft size={20} />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase">Back to Exams</span>
          </button>

          <div className="mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4 tracking-tighter">{selectedExam.title} Previous Year Papers</h2>
            <p className="text-gray-500 font-medium text-lg">Select a year to view or upload question papers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {yearFolders.map((folder, index) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => setSelectedFolder(folder)}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:border-[#1B4332]/20 hover:shadow-xl transition-all duration-300 cursor-pointer group flex items-center gap-4"
              >
                <div className={`w-12 h-12 ${selectedExam.iconBg} rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                  <FolderOpen size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1A1A1A]">{folder.title}</h3>
                  <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mt-1 transition-colors group-hover:text-[#1B4332]">Open Folder</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <section className="relative py-48 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#1B4332]/60 to-transparent"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-7xl mx-auto px-4 text-center"
        >
          <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8">
            PREPARE FOR
          </span>
          <h1 className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2">
            EXAMS
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Complete guidance and practice for NDA, CDS, AFCAT & Technical entries.
          </p>
        </motion.div>
      </section>

      {/* Exam Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 py-32 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {examCategories.map((exam, index) => (
            <motion.div
              key={exam.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -12 }}
              onClick={() => {
                if (exam.status === 'OPEN FOLDERS') {
                  setSelectedExam(exam);
                }
              }}
              className={`h-full bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_40px_100px_rgba(0,0,0,0.03)] border border-gray-100 text-center flex flex-col items-center group transition-all duration-500 relative overflow-hidden ${
                exam.status === 'OPEN FOLDERS' ? 'cursor-pointer hover:border-[#1B4332]/20' : 'hover:border-gray-200'
              }`}
            >
              <div className="absolute -right-8 -top-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500">
                {exam.icon}
              </div>
              <div className={`${exam.iconBg} w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-8 shadow-xl premium-zoom group-hover:scale-110 group-hover:rotate-6`}>
                {exam.icon}
              </div>
              <h3 className="text-4xl font-black text-[#1A1A1A] mb-2 tracking-tighter">
                {exam.title}
              </h3>
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-6">
                {exam.subtitle}
              </p>
              <p className="text-gray-500 font-medium leading-relaxed mb-10 flex-grow text-sm">
                {exam.description}
              </p>
              <div className="mt-auto">
                <span className={`inline-block px-6 py-2.5 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase border transition-all duration-300 ${
                  exam.status === 'OPEN FOLDERS' 
                    ? 'bg-[#1B4332]/5 text-[#1B4332] border-[#1B4332]/10 group-hover:bg-[#1B4332] group-hover:text-white group-hover:shadow-lg group-hover:border-[#1B4332]' 
                    : 'bg-[#1B4332]/5 text-gray-400 border-[#1B4332]/5'
                }`}>
                  {exam.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Test Features Section */}
      <section className="max-w-7xl mx-auto px-4 pb-48">
        <div className="text-center mb-24">
          <span className="inline-block px-4 py-1.5 bg-gray-100 rounded-full text-gray-400 text-[10px] font-black tracking-[0.3em] uppercase mb-6">
            WHY NISHCHAY
          </span>
          <h2 className="text-5xl md:text-7xl font-black text-[#1A1A1A] tracking-tighter">
            Test Features
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {testFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.4 }}
              whileHover={{ y: -8 }}
              className="h-full bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 text-center flex flex-col items-center group hover:border-[#1B4332]/10 transition-all duration-500"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#1B4332]/5 text-[#1B4332] flex items-center justify-center mb-10 group-hover:bg-[#1B4332] group-hover:text-white transition-all duration-500 shadow-inner">
                {feature.icon}
              </div>
              <h3 className="text-3xl font-black text-[#1A1A1A] mb-6 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-lg">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Tests;
