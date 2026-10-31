import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { auth, onAuthStateChanged, checkIfAdmin } from './firebase';
import type { SubjectNote } from './notes-db';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Calculator, Book, Globe, Newspaper, Target,
  ChevronLeft, Upload, FileText, Atom, FlaskConical,
  Dna, Landmark, Coins, Map, BookOpen, FileCheck, Shield,
  Award, Calendar, CheckCircle2, ChevronRight, ArrowRight,
  Download, ExternalLink, Sparkles, Folder, Check, Clock,
  X, Trash2, RefreshCw, FileUp, Link as LinkIcon, AlertCircle
} from 'lucide-react';

interface Subject {
  id: string;
  title: string;
  count: string;
  icon: any;
  color: string;
  badge?: string;
  description?: string;
}

interface ExamPaper {
  id: string;
  title: string;
  exam: 'NDA' | 'CDS';
  session: 'I' | 'II';
  year: number;
}

interface PyqFileItem {
  url: string;
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
}

interface PyqSubjectSlot {
  paper?: PyqFileItem;
  key?: PyqFileItem;
}

interface PyqSessionData {
  sessionId: string;
  exam: 'NDA' | 'CDS';
  session: 'I' | 'II';
  year: number;
  title: string;
  subjects: {
    maths?: PyqSubjectSlot;
    gat?: PyqSubjectSlot;
    english?: PyqSubjectSlot;
    gs?: PyqSubjectSlot;
  };
  updatedAt: string;
}

interface UploadModalState {
  isOpen: boolean;
  mode: 'pyq' | 'subject';
  // PYQ fields
  paper?: ExamPaper;
  subjectKey?: 'maths' | 'gat' | 'english' | 'gs';
  fileType?: 'paper' | 'key';
  typeLabel?: string;
  // Subject Note fields
  subjectId?: string;
  subjectTitle: string;
}

const SUBJECTS: Subject[] = [
  {
    id: 'pyq-papers',
    title: 'PYQ Papers',
    count: '24 Papers • NDA & CDS',
    icon: FileCheck,
    color: 'bg-[#1B4332]',
    badge: 'PYQ Archive',
    description: 'Previous Year Question Papers & Answer Keys (2021 – 2026)',
  },
  {
    id: 'maths',
    title: 'Mathematics',
    count: '50+ PDFs',
    icon: Calculator,
    color: 'bg-[#2D5A27]',
  },
  {
    id: 'english',
    title: 'English',
    count: '40+ PDFs',
    icon: Book,
    color: 'bg-[#1B3A5B]',
  },
  {
    id: 'physics',
    title: 'Physics',
    count: '0 PDFs',
    icon: Atom,
    color: 'bg-[#5B2A86]',
  },
  {
    id: 'chemistry',
    title: 'Chemistry',
    count: '0 PDFs',
    icon: FlaskConical,
    color: 'bg-[#D64933]',
  },
  {
    id: 'biology',
    title: 'Biology',
    count: '0 PDFs',
    icon: Dna,
    color: 'bg-[#15822F]',
  },
  {
    id: 'economics',
    title: 'Economics',
    count: '0 PDFs',
    icon: Coins,
    color: 'bg-[#B57C00]',
  },
  {
    id: 'history',
    title: 'History',
    count: '0 PDFs',
    icon: BookOpen,
    color: 'bg-[#8A5A44]',
  },
  {
    id: 'polity',
    title: 'Polity',
    count: '0 PDFs',
    icon: Landmark,
    color: 'bg-[#005B96]',
  },
  {
    id: 'geography',
    title: 'Geography',
    count: '0 PDFs',
    icon: Map,
    color: 'bg-[#2E8B57]',
  },
  {
    id: 'current-affairs',
    title: 'Current Affairs',
    count: 'Monthly Updates',
    icon: Newspaper,
    color: 'bg-[#4B5563]',
  },
  {
    id: 'strategy',
    title: 'Strategy Guides',
    count: '10+ Guides',
    icon: Target,
    color: 'bg-[#1B3A5B]',
  },
];

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021] as const;

const NDA_PAPERS: ExamPaper[] = YEARS.flatMap((year) => [
  {
    id: `nda-2-${year}`,
    title: `NDA II, ${year}`,
    exam: 'NDA',
    session: 'II',
    year,
  },
  {
    id: `nda-1-${year}`,
    title: `NDA I, ${year}`,
    exam: 'NDA',
    session: 'I',
    year,
  },
]);

const CDS_PAPERS: ExamPaper[] = YEARS.flatMap((year) => [
  {
    id: `cds-2-${year}`,
    title: `CDS II, ${year}`,
    exam: 'CDS',
    session: 'II',
    year,
  },
  {
    id: `cds-1-${year}`,
    title: `CDS I, ${year}`,
    exam: 'CDS',
    session: 'I',
    year,
  },
]);

export default function Notes() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedExam, setSelectedExam] = useState<'NDA' | 'CDS' | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const [paperSearch, setPaperSearch] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | 'All'>('All');
  const [isAdmin, setIsAdmin] = useState(false);

  // Stored PYQ Data (Synced with Server API + LocalStorage)
  const [pyqSessions, setPyqSessions] = useState<Record<string, PyqSessionData>>(() => {
    try {
      const saved = localStorage.getItem('nishchay_pyq_papers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Subject Notes State
  const [allSubjectNotes, setAllSubjectNotes] = useState<SubjectNote[]>(() => {
    try {
      const saved = localStorage.getItem('nishchay_subject_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Upload Modal State
  const [uploadModal, setUploadModal] = useState<UploadModalState | null>(null);
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customLink, setCustomLink] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setIsAdmin(checkIfAdmin(currentUser));
    });
    return () => unsubscribe();
  }, []);

  // Fetch latest uploaded papers from server
  useEffect(() => {
    fetch('/api/pyq')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.sessions) {
          setPyqSessions(data.sessions);
          try {
            localStorage.setItem('nishchay_pyq_papers', JSON.stringify(data.sessions));
          } catch (e) {
            console.warn('LocalStorage save failed:', e);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not reach /api/pyq, using local cache:', err);
      });
  }, []);

  // Fetch latest uploaded subject notes from server
  useEffect(() => {
    fetch('/api/notes')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.notes) {
          setAllSubjectNotes(data.notes);
          try {
            localStorage.setItem('nishchay_subject_notes', JSON.stringify(data.notes));
          } catch (e) {
            console.warn('LocalStorage save failed for notes:', e);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not reach /api/notes, using local cache:', err);
      });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedSubject, selectedExam, selectedPaper]);

  const openUploadModal = (
    paper: ExamPaper,
    subjectKey: 'maths' | 'gat' | 'english' | 'gs',
    subjectTitle: string,
    fileType: 'paper' | 'key'
  ) => {
    if (!isAdmin) return;
    setUploadModal({
      isOpen: true,
      mode: 'pyq',
      paper,
      subjectKey,
      subjectTitle,
      fileType,
      typeLabel: fileType === 'paper' ? 'Question Paper' : 'Answer Key',
    });
    setNoteTitle('');
    setNoteCategory('');
    setSelectedFile(null);
    setCustomLink('');
    setLinkTitle('');
    setUploadError('');
    setUploadSuccess('');
    setUploadTab('file');
  };

  const openSubjectUploadModal = (subjectId: string, subjectTitle: string) => {
    if (!isAdmin) return;
    setUploadModal({
      isOpen: true,
      mode: 'subject',
      subjectId,
      subjectTitle,
      typeLabel: `${subjectTitle} Note`,
    });
    setNoteTitle('');
    setNoteCategory('');
    setSelectedFile(null);
    setCustomLink('');
    setLinkTitle('');
    setUploadError('');
    setUploadSuccess('');
    setUploadTab('file');
  };

  const closeUploadModal = () => {
    setUploadModal(null);
    setNoteTitle('');
    setNoteCategory('');
    setSelectedFile(null);
    setCustomLink('');
    setLinkTitle('');
    setUploadError('');
    setUploadSuccess('');
  };

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setUploadError('');
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
    });
  };

  // Helper to obtain authenticated headers
  const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  // Execute Upload
  const handleExecuteUpload = async () => {
    if (!uploadModal) return;
    if (!isAdmin) {
      setUploadError('Only verified administrators are authorized to upload files.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const headers = await getAuthHeaders();

      // 1. Subject Note Upload Mode
      if (uploadModal.mode === 'subject') {
        if (!noteTitle.trim()) {
          throw new Error('Please enter a title for the note.');
        }

        if (uploadTab === 'file') {
          if (!selectedFile) {
            throw new Error('Please select a PDF file to upload.');
          }

          const base64Data = await fileToBase64(selectedFile);
          const res = await fetch('/api/notes/upload', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              subjectId: uploadModal.subjectId,
              subjectTitle: uploadModal.subjectTitle,
              title: noteTitle.trim(),
              category: noteCategory.trim() || undefined,
              fileBase64: base64Data,
              originalName: selectedFile.name,
              fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
            }),
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Upload failed');
          }

          const updatedNotes = [data.note, ...allSubjectNotes.filter((n) => n.id !== data.note.id)];
          setAllSubjectNotes(updatedNotes);
          localStorage.setItem('nishchay_subject_notes', JSON.stringify(updatedNotes));

          setUploadSuccess(`"${noteTitle}" uploaded successfully!`);
          setTimeout(() => closeUploadModal(), 1200);
        } else {
          // Link submission
          if (!customLink.trim()) {
            throw new Error('Please enter a valid PDF or Google Drive link.');
          }

          const res = await fetch('/api/notes/link', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              subjectId: uploadModal.subjectId,
              subjectTitle: uploadModal.subjectTitle,
              title: noteTitle.trim(),
              category: noteCategory.trim() || undefined,
              url: customLink.trim(),
              fileSize: 'Online Document',
            }),
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to save link');
          }

          const updatedNotes = [data.note, ...allSubjectNotes.filter((n) => n.id !== data.note.id)];
          setAllSubjectNotes(updatedNotes);
          localStorage.setItem('nishchay_subject_notes', JSON.stringify(updatedNotes));

          setUploadSuccess(`"${noteTitle}" link saved!`);
          setTimeout(() => closeUploadModal(), 1200);
        }
        return;
      }

      // 2. PYQ Paper / Key Upload Mode
      if (!uploadModal.paper) return;

      if (uploadTab === 'file') {
        if (!selectedFile) {
          throw new Error('Please select a PDF file to upload.');
        }

        const base64Data = await fileToBase64(selectedFile);
        const res = await fetch('/api/pyq/upload', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId: uploadModal.paper.id,
            exam: uploadModal.paper.exam,
            session: uploadModal.paper.session,
            year: uploadModal.paper.year,
            title: uploadModal.paper.title,
            subjectKey: uploadModal.subjectKey,
            fileType: uploadModal.fileType,
            fileBase64: base64Data,
            originalName: selectedFile.name,
            fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Upload failed');
        }

        const updatedSessions = {
          ...pyqSessions,
          [uploadModal.paper.id]: data.session,
        };
        setPyqSessions(updatedSessions);
        localStorage.setItem('nishchay_pyq_papers', JSON.stringify(updatedSessions));

        setUploadSuccess(`${uploadModal.typeLabel} uploaded successfully!`);
        setTimeout(() => closeUploadModal(), 1200);
      } else {
        // Link submission
        if (!customLink.trim()) {
          throw new Error('Please enter a valid PDF or Drive link.');
        }

        const res = await fetch('/api/pyq/link', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId: uploadModal.paper.id,
            exam: uploadModal.paper.exam,
            session: uploadModal.paper.session,
            year: uploadModal.paper.year,
            title: uploadModal.paper.title,
            subjectKey: uploadModal.subjectKey,
            fileType: uploadModal.fileType,
            url: customLink.trim(),
            fileName: linkTitle.trim() || `${uploadModal.paper.title} ${uploadModal.subjectTitle} ${uploadModal.typeLabel}`,
            fileSize: 'Online Document',
          }),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to save link');
        }

        const updatedSessions = {
          ...pyqSessions,
          [uploadModal.paper.id]: data.session,
        };
        setPyqSessions(updatedSessions);
        localStorage.setItem('nishchay_pyq_papers', JSON.stringify(updatedSessions));

        setUploadSuccess(`${uploadModal.typeLabel} link saved!`);
        setTimeout(() => closeUploadModal(), 1200);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload operation failed.');
    } finally {
      setUploading(false);
    }
  };

  // Delete Subject Note (Admin Only)
  const handleDeleteSubjectNote = async (noteId: string, title: string) => {
    if (!isAdmin) return;

    if (!confirm(`Are you sure you want to delete note "${title}"?`)) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/notes/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: noteId }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = allSubjectNotes.filter((n) => n.id !== noteId);
        setAllSubjectNotes(updated);
        localStorage.setItem('nishchay_subject_notes', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Delete note failed:', err);
    }
  };

  // Delete file
  const handleDeleteFile = async (
    sessionId: string,
    subjectKey: 'maths' | 'gat' | 'english' | 'gs',
    fileType: 'paper' | 'key',
    label: string
  ) => {
    if (!isAdmin) return;

    if (!confirm(`Are you sure you want to remove this ${fileType === 'paper' ? 'Question Paper' : 'Answer Key'} for ${label}?`)) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/pyq/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, subjectKey, fileType }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        const updated = {
          ...pyqSessions,
          [sessionId]: data.session,
        };
        setPyqSessions(updated);
        localStorage.setItem('nishchay_pyq_papers', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Helper to count uploaded files for a session
  const getSessionUploadCount = (paper: ExamPaper) => {
    const session = pyqSessions[paper.id];
    if (!session || !session.subjects) return { count: 0, total: paper.exam === 'NDA' ? 4 : 6 };
    let count = 0;
    const subjects = session.subjects;
    if (paper.exam === 'NDA') {
      if (subjects.maths?.paper) count++;
      if (subjects.maths?.key) count++;
      if (subjects.gat?.paper) count++;
      if (subjects.gat?.key) count++;
      return { count, total: 4 };
    } else {
      if (subjects.english?.paper) count++;
      if (subjects.english?.key) count++;
      if (subjects.gs?.paper) count++;
      if (subjects.gs?.key) count++;
      if (subjects.maths?.paper) count++;
      if (subjects.maths?.key) count++;
      return { count, total: 6 };
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LEVEL 3: Specific Exam Paper View (Upload & Manage Papers & Keys)
  // ─────────────────────────────────────────────────────────────
  if (selectedPaper) {
    const isNda = selectedPaper.exam === 'NDA';
    const sessionRecord = pyqSessions[selectedPaper.id];

    // Subjects configuration
    const ndaSubjects = [
      {
        key: 'maths' as const,
        title: 'Maths',
        fullName: 'Mathematics',
        code: 'PAPER 01 • CODE 01',
        desc: '120 MCQs • 300 Marks • Duration: 2.5 Hours',
        icon: Calculator,
        color: 'text-[#2D5A27]',
      },
      {
        key: 'gat' as const,
        title: 'GAT',
        fullName: 'General Ability Test',
        code: 'PAPER 02 • CODE 02',
        desc: '150 MCQs • 600 Marks • Duration: 2.5 Hours',
        icon: BookOpen,
        color: 'text-[#1B3A5B]',
      },
    ];

    const cdsSubjects = [
      {
        key: 'english' as const,
        title: 'English',
        fullName: 'English Language',
        code: 'PAPER 01 • CODE 01',
        desc: '120 MCQs • 100 Marks • Duration: 2 Hours',
        icon: Book,
        color: 'text-[#1B3A5B]',
      },
      {
        key: 'gs' as const,
        title: 'GS',
        fullName: 'General Studies',
        code: 'PAPER 02 • CODE 02',
        desc: '120 MCQs • 100 Marks • Duration: 2 Hours',
        icon: Globe,
        color: 'text-[#2D5A27]',
      },
      {
        key: 'maths' as const,
        title: 'Maths',
        fullName: 'Elementary Mathematics',
        code: 'PAPER 03 • (IMA / INA / AFA)',
        desc: '100 MCQs • 100 Marks • Duration: 2 Hours',
        icon: Calculator,
        color: 'text-[#B57C00]',
      },
    ];

    const currentSubjects = isNda ? ndaSubjects : cdsSubjects;

    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-4">
          {/* Breadcrumbs & Back Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <button
              onClick={() => setSelectedPaper(null)}
              className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                <ChevronLeft size={20} />
              </div>
              <span className="font-bold text-xs tracking-widest uppercase">Back to {selectedPaper.exam} Papers</span>
            </button>

            {/* Clickable Breadcrumbs */}
            <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <button
                onClick={() => {
                  setSelectedSubject(null);
                  setSelectedExam(null);
                  setSelectedPaper(null);
                }}
                className="hover:text-[#1B4332] transition-colors cursor-pointer"
              >
                Notes
              </button>
              <span>/</span>
              <button
                onClick={() => {
                  setSelectedExam(null);
                  setSelectedPaper(null);
                }}
                className="hover:text-[#1B4332] transition-colors cursor-pointer"
              >
                PYQ Papers
              </button>
              <span>/</span>
              <button
                onClick={() => setSelectedPaper(null)}
                className="hover:text-[#1B4332] transition-colors cursor-pointer"
              >
                {selectedPaper.exam}
              </button>
              <span>/</span>
              <span className="text-[#1B4332] font-black">{selectedPaper.title}</span>
            </nav>
          </div>

          {/* Paper Header Banner */}
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-gray-100 mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-gray-100">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 ${isNda ? 'bg-[#1B4332]' : 'bg-[#1B3A5B]'} rounded-3xl flex items-center justify-center text-white shadow-xl`}>
                  {isNda ? <Shield size={40} /> : <Award size={40} />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="px-3 py-1 bg-[#1B4332]/10 text-[#1B4332] text-[10px] font-black tracking-widest uppercase rounded-full">
                      {selectedPaper.exam} {selectedPaper.session}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-[10px] font-black tracking-widest uppercase rounded-full">
                      Year {selectedPaper.year}
                    </span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black tracking-widest uppercase rounded-full flex items-center gap-1">
                      <FileUp size={12} /> {isAdmin ? 'Admin Archive Console' : 'Official Defence Archive'}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tighter">
                    {selectedPaper.title}
                  </h1>
                  <p className="text-gray-500 font-medium text-base md:text-lg mt-1">
                    {isAdmin
                      ? 'Upload, replace, and manage Question Papers and Official Answer Keys for each subject'
                      : 'Download and practice official Question Papers and Answer Keys for each subject'}
                  </p>
                </div>
              </div>
            </div>

            {/* Subject Papers & Answer Keys Grid */}
            <div className="mt-8">
              <h3 className="text-xs font-black tracking-[0.3em] uppercase text-gray-400 mb-6">
                {isNda ? 'NDA Subjects (GAT & Maths)' : 'CDS Subjects (English, GS & Maths)'}
              </h3>

              <div className={`grid grid-cols-1 ${isNda ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-8`}>
                {currentSubjects.map((sub) => {
                  const subData = sessionRecord?.subjects?.[sub.key];
                  const paperFile = subData?.paper;
                  const keyFile = subData?.key;

                  return (
                    <div
                      key={sub.key}
                      className="bg-gray-50/80 rounded-3xl p-6 md:p-8 border border-gray-100 hover:border-gray-200 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Subject Header */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">{sub.code}</span>
                            <h4 className="text-2xl font-black text-gray-900 tracking-tight mt-1">{sub.title}</h4>
                            <p className="text-xs text-gray-500 font-medium">{sub.fullName}</p>
                          </div>
                          <div className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center ${sub.color} shadow-sm border border-gray-100 shrink-0`}>
                            <sub.icon size={22} />
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 font-medium mb-6 leading-relaxed">
                          {sub.desc}
                        </p>

                        {/* 1. Question Paper Slot */}
                        <div className="p-4 rounded-2xl bg-white border border-gray-200/80 mb-4 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                              <FileText size={14} className="text-[#1B4332]" /> Question Paper
                            </span>
                            {paperFile ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <Check size={10} /> Uploaded
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-amber-50 text-amber-700">
                                Not Uploaded
                              </span>
                            )}
                          </div>

                          {paperFile ? (
                            <div>
                              <p className="text-xs font-bold text-gray-800 truncate mb-1" title={paperFile.fileName}>
                                {paperFile.fileName}
                              </p>
                              <p className="text-[10px] text-gray-400 mb-3">{paperFile.fileSize || 'PDF File'}</p>
                              <div className="flex items-center gap-2">
                                <a
                                  href={paperFile.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1B4332] text-white rounded-xl text-xs font-bold hover:bg-[#143024] transition-all shadow-xs"
                                >
                                  <Download size={13} /> View / Download
                                </a>
                                {isAdmin && (
                                  <>
                                    <button
                                      onClick={() => openUploadModal(selectedPaper, sub.key, sub.title, 'paper')}
                                      title="Replace File"
                                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all cursor-pointer"
                                    >
                                      <RefreshCw size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFile(selectedPaper.id, sub.key, 'paper', `${selectedPaper.title} ${sub.title}`)}
                                      title="Delete File"
                                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : isAdmin ? (
                            <button
                              onClick={() => openUploadModal(selectedPaper, sub.key, sub.title, 'paper')}
                              className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1B4332] text-white rounded-xl text-xs font-black tracking-wider uppercase hover:bg-[#143024] transition-all cursor-pointer shadow-xs hover:shadow"
                            >
                              <Upload size={14} /> Upload Question Paper
                            </button>
                          ) : (
                            <div className="w-full mt-1 py-2.5 px-3 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs font-semibold text-gray-400">
                              Paper releasing soon
                            </div>
                          )}
                        </div>

                        {/* 2. Answer Key Slot */}
                        <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                              <CheckCircle2 size={14} className="text-[#1B3A5B]" /> Answer Key
                            </span>
                            {keyFile ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <Check size={10} /> Uploaded
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-amber-50 text-amber-700">
                                Not Uploaded
                              </span>
                            )}
                          </div>

                          {keyFile ? (
                            <div>
                              <p className="text-xs font-bold text-gray-800 truncate mb-1" title={keyFile.fileName}>
                                {keyFile.fileName}
                              </p>
                              <p className="text-[10px] text-gray-400 mb-3">{keyFile.fileSize || 'PDF Key'}</p>
                              <div className="flex items-center gap-2">
                                <a
                                  href={keyFile.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1B3A5B] text-white rounded-xl text-xs font-bold hover:bg-[#13283E] transition-all shadow-xs"
                                >
                                  <Download size={13} /> View / Download Key
                                </a>
                                {isAdmin && (
                                  <>
                                    <button
                                      onClick={() => openUploadModal(selectedPaper, sub.key, sub.title, 'key')}
                                      title="Replace Key"
                                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all cursor-pointer"
                                    >
                                      <RefreshCw size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFile(selectedPaper.id, sub.key, 'key', `${selectedPaper.title} ${sub.title}`)}
                                      title="Delete Key"
                                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : isAdmin ? (
                            <button
                              onClick={() => openUploadModal(selectedPaper, sub.key, sub.title, 'key')}
                              className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-xl text-xs font-black tracking-wider uppercase hover:bg-gray-100 transition-all cursor-pointer shadow-xs"
                            >
                              <Upload size={14} className="text-[#1B3A5B]" /> Upload Answer Key
                            </button>
                          ) : (
                            <div className="w-full mt-1 py-2.5 px-3 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs font-semibold text-gray-400">
                              Answer key releasing soon
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nishchay Note */}
            <div className="mt-10 p-6 md:p-8 rounded-2xl bg-[#1B4332]/5 border border-[#1B4332]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B4332] text-white flex items-center justify-center shrink-0">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">
                    {isAdmin ? 'Direct Admin Repository' : 'Official Nishchay Repository'}
                  </h4>
                  <p className="text-gray-600 text-xs md:text-sm mt-0.5">
                    {isAdmin
                      ? 'As an authorized administrator, you can upload, replace, and manage question papers and answer keys directly.'
                      : 'All question papers and answer keys are verified by NDA/CDS-qualified mentors. Download and practice at your pace.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 2: Exam Folder View ("NDA" or "CDS") with 12 Paper Cards
  // ─────────────────────────────────────────────────────────────
  if (selectedExam) {
    const isNda = selectedExam === 'NDA';
    const paperList = isNda ? NDA_PAPERS : CDS_PAPERS;

    // Filter papers by year or search query
    const filteredPapers = paperList.filter((paper) => {
      const matchesYear = selectedYearFilter === 'All' || paper.year === selectedYearFilter;
      const matchesQuery =
        paper.title.toLowerCase().includes(paperSearch.toLowerCase()) ||
        paper.year.toString().includes(paperSearch) ||
        paper.session.toLowerCase().includes(paperSearch.toLowerCase());
      return matchesYear && matchesQuery;
    });

    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4">
          {/* Breadcrumbs & Back Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <button
              onClick={() => setSelectedExam(null)}
              className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                <ChevronLeft size={20} />
              </div>
              <span className="font-bold text-xs tracking-widest uppercase">Back to PYQ Papers</span>
            </button>

            {/* Breadcrumb Trail */}
            <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <button
                onClick={() => {
                  setSelectedSubject(null);
                  setSelectedExam(null);
                }}
                className="hover:text-[#1B4332] transition-colors cursor-pointer"
              >
                Notes
              </button>
              <span>/</span>
              <button
                onClick={() => setSelectedExam(null)}
                className="hover:text-[#1B4332] transition-colors cursor-pointer"
              >
                PYQ Papers
              </button>
              <span>/</span>
              <span className="text-[#1B4332] font-black">{selectedExam}</span>
            </nav>
          </div>

          {/* Exam Header Banner */}
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-gray-100 mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-gray-100">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 ${isNda ? 'bg-[#1B4332]' : 'bg-[#1B3A5B]'} rounded-3xl flex items-center justify-center text-white shadow-xl`}>
                  {isNda ? <Shield size={40} /> : <Award size={40} />}
                </div>
                <div>
                  <span className="px-3.5 py-1.5 bg-[#1B4332]/10 text-[#1B4332] text-[10px] font-black tracking-widest uppercase rounded-full inline-block mb-2">
                    EXAM SESSIONS • 2021 – 2026
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tighter">
                    {selectedExam} Previous Year Papers
                  </h1>
                  <p className="text-gray-500 font-medium text-base md:text-lg mt-1">
                    {isNda
                      ? 'National Defence Academy (GAT & Maths Papers with Answer Keys)'
                      : 'Combined Defence Services (English, GS & Maths Papers with Answer Keys)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar Row */}
            <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Year Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-1 shrink-0">Year:</span>
                {(['All', ...YEARS] as const).map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYearFilter(yr)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedYearFilter === yr
                        ? 'bg-[#1B4332] text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

              {/* Quick Search inside this exam */}
              <div className="relative min-w-[260px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={`Search ${selectedExam} papers (e.g. 2025, II)...`}
                  value={paperSearch}
                  onChange={(e) => setPaperSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#1B4332] focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Paper Cards Grid (format: NDA II, 2026 -> NDA I, 2021) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map((paper, idx) => {
              const uploadStatus = getSessionUploadCount(paper);
              const sessionRecord = pyqSessions[paper.id];

              return (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ y: -6 }}
                  onClick={() => setSelectedPaper(paper)}
                  className="bg-white rounded-[2rem] p-6 md:p-8 shadow-[0_15px_35px_rgba(0,0,0,0.03)] border border-gray-100 hover:border-[#1B4332]/40 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
                >
                  <div className="relative z-10">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-full ${
                          paper.session === 'II'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        }`}
                      >
                        SESSION {paper.session}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          uploadStatus.count === uploadStatus.total
                            ? 'bg-emerald-100 text-emerald-800'
                            : uploadStatus.count > 0
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {uploadStatus.count}/{uploadStatus.total} Files
                      </span>
                    </div>

                    {/* Main Title - Exact user requested format */}
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-3 group-hover:text-[#1B4332] transition-colors">
                      {paper.title}
                    </h3>

                    {/* Subject Breakdown summary with upload check indicators */}
                    <div className="space-y-2 mb-6 text-xs font-semibold text-gray-600">
                      {isNda ? (
                        <>
                          <div className="flex items-center justify-between py-1 border-b border-gray-50">
                            <span className="font-bold text-gray-800">Maths</span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className={sessionRecord?.subjects?.maths?.paper ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Paper: {sessionRecord?.subjects?.maths?.paper ? '✓' : '—'}
                              </span>
                              <span>•</span>
                              <span className={sessionRecord?.subjects?.maths?.key ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Key: {sessionRecord?.subjects?.maths?.key ? '✓' : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-gray-50">
                            <span className="font-bold text-gray-800">GAT</span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className={sessionRecord?.subjects?.gat?.paper ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Paper: {sessionRecord?.subjects?.gat?.paper ? '✓' : '—'}
                              </span>
                              <span>•</span>
                              <span className={sessionRecord?.subjects?.gat?.key ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Key: {sessionRecord?.subjects?.gat?.key ? '✓' : '—'}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between py-1 border-b border-gray-50">
                            <span className="font-bold text-gray-800">English</span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className={sessionRecord?.subjects?.english?.paper ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Paper: {sessionRecord?.subjects?.english?.paper ? '✓' : '—'}
                              </span>
                              <span>•</span>
                              <span className={sessionRecord?.subjects?.english?.key ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Key: {sessionRecord?.subjects?.english?.key ? '✓' : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-gray-50">
                            <span className="font-bold text-gray-800">GS</span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className={sessionRecord?.subjects?.gs?.paper ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Paper: {sessionRecord?.subjects?.gs?.paper ? '✓' : '—'}
                              </span>
                              <span>•</span>
                              <span className={sessionRecord?.subjects?.gs?.key ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Key: {sessionRecord?.subjects?.gs?.key ? '✓' : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-gray-50">
                            <span className="font-bold text-gray-800">Maths</span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className={sessionRecord?.subjects?.maths?.paper ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Paper: {sessionRecord?.subjects?.maths?.paper ? '✓' : '—'}
                              </span>
                              <span>•</span>
                              <span className={sessionRecord?.subjects?.maths?.key ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                                Key: {sessionRecord?.subjects?.maths?.key ? '✓' : '—'}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="relative z-10 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-[#1B4332] transition-colors">
                    <span className="tracking-wide uppercase text-[11px] font-black">
                      {uploadStatus.count > 0 ? (isAdmin ? 'Manage & Download' : 'View & Download') : (isAdmin ? 'Upload Papers' : 'View Session')}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#1B4332] group-hover:text-white flex items-center justify-center transition-all">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredPapers.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100">
              <p className="text-gray-500 font-medium">No question papers found matching your filter.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 1: "PYQ Papers" Folder View (Contains 2 Cards: NDA & CDS)
  // ─────────────────────────────────────────────────────────────
  if (selectedSubject && selectedSubject.id === 'pyq-papers') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-4">
          {/* Breadcrumbs & Back Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <button
              onClick={() => setSelectedSubject(null)}
              className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                <ChevronLeft size={20} />
              </div>
              <span className="font-bold text-xs tracking-widest uppercase">Back to All Subjects</span>
            </button>

            <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <button
                onClick={() => setSelectedSubject(null)}
                className="hover:text-[#1B4332] transition-colors cursor-pointer"
              >
                Notes
              </button>
              <span>/</span>
              <span className="text-[#1B4332] font-black">PYQ Papers</span>
            </nav>
          </div>

          {/* Folder Hero Banner */}
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-gray-100 mb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-gray-100">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-[#1B4332] rounded-3xl flex items-center justify-center text-white shadow-xl">
                  <FileCheck size={40} />
                </div>
                <div>
                  <span className="px-3.5 py-1.5 bg-[#1B4332]/10 text-[#1B4332] text-[10px] font-black tracking-widest uppercase rounded-full inline-block mb-2">
                    NISHCHAY DEFENCE ARCHIVE
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tighter">
                    PYQ Papers
                  </h1>
                  <p className="text-gray-500 font-medium text-base md:text-lg mt-1">
                    Previous Year Question Papers & Answer Keys (2021 – 2026)
                  </p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 mt-6 text-base font-medium max-w-3xl leading-relaxed">
              Select an examination below to open session folders from 2021 to 2026. You can upload and download Question Papers and Answer Keys for Maths and GAT (NDA) or English, GS, and Maths (CDS).
            </p>
          </div>

          {/* The 2 Sub-Cards: 1st "NDA", 2nd "CDS" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            {/* 1st Card: NDA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -12 }}
              onClick={() => setSelectedExam('NDA')}
              className="bg-[#1B4332] p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] text-white transition-all duration-500 flex flex-col justify-between group cursor-pointer shadow-2xl relative overflow-hidden min-h-[380px]"
            >
              <div className="absolute -right-8 -bottom-8 opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-500">
                <Shield size={220} />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center premium-zoom group-hover:scale-110 group-hover:rotate-6 border border-white/20 shadow-xl">
                    <Shield size={40} />
                  </div>
                  <span className="px-4 py-1.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                    12 Sessions
                  </span>
                </div>

                <h3 className="text-4xl md:text-5xl font-black mb-2 tracking-tighter">NDA</h3>
                <p className="text-white/80 font-bold text-sm tracking-wide mb-3">
                  National Defence Academy & Naval Academy
                </p>
                <p className="text-white/60 text-xs font-medium leading-relaxed max-w-md mb-8">
                  Session papers from 2021 to 2026. Manage and download Mathematics (Paper 1) and General Ability Test (GAT) papers with answer keys.
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10">
                <span className="text-white/70 text-xs font-black tracking-[0.2em] uppercase">Maths & GAT Papers</span>
                <button className="px-8 py-3.5 bg-white text-gray-900 rounded-2xl text-xs font-black tracking-widest uppercase group-hover:bg-[#E8F5E9] transition-all duration-300 shadow-lg flex items-center gap-2">
                  Open NDA <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>

            {/* 2nd Card: CDS */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -12 }}
              onClick={() => setSelectedExam('CDS')}
              className="bg-[#1B3A5B] p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] text-white transition-all duration-500 flex flex-col justify-between group cursor-pointer shadow-2xl relative overflow-hidden min-h-[380px]"
            >
              <div className="absolute -right-8 -bottom-8 opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-500">
                <Award size={220} />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center premium-zoom group-hover:scale-110 group-hover:rotate-6 border border-white/20 shadow-xl">
                    <Award size={40} />
                  </div>
                  <span className="px-4 py-1.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                    12 Sessions
                  </span>
                </div>

                <h3 className="text-4xl md:text-5xl font-black mb-2 tracking-tighter">CDS</h3>
                <p className="text-white/80 font-bold text-sm tracking-wide mb-3">
                  Combined Defence Services Examination
                </p>
                <p className="text-white/60 text-xs font-medium leading-relaxed max-w-md mb-8">
                  Session papers from 2021 to 2026. Manage and download English, GS (General Studies), and Elementary Mathematics papers with answer keys.
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10">
                <span className="text-white/70 text-xs font-black tracking-[0.2em] uppercase">English, GS & Maths</span>
                <button className="px-8 py-3.5 bg-white text-gray-900 rounded-2xl text-xs font-black tracking-widest uppercase group-hover:bg-[#E3F2FD] transition-all duration-300 shadow-lg flex items-center gap-2">
                  Open CDS <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Standard Subject Detail View (e.g. Mathematics, English, etc.)
  // ─────────────────────────────────────────────────────────────
  if (selectedSubject) {
    const subjectNotesList = allSubjectNotes.filter(
      (n) => n.subjectId.toLowerCase() === selectedSubject.id.toLowerCase()
    );

    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <button
            onClick={() => setSelectedSubject(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] mb-8 transition-colors group cursor-pointer"
          >
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <ChevronLeft size={20} />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase">Back to Subjects</span>
          </button>

          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-gray-100 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-gray-100 pb-12">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 ${selectedSubject.color} rounded-3xl flex items-center justify-center text-white shadow-xl`}>
                  <selectedSubject.icon size={40} />
                </div>
                <div>
                  <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-2 tracking-tighter">{selectedSubject.title}</h2>
                  <p className="text-gray-500 font-medium text-lg">
                    {subjectNotesList.length > 0
                      ? `${subjectNotesList.length} ${subjectNotesList.length === 1 ? 'study note' : 'study notes'} available for revision`
                      : `Download and practice notes for ${selectedSubject.title}`}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => openSubjectUploadModal(selectedSubject.id, selectedSubject.title)}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-[#1B4332] text-white rounded-2xl font-bold hover:bg-[#143024] transition-all shadow-lg shadow-[#1B4332]/20 hover:scale-105 hover:-translate-y-1 cursor-pointer"
                >
                  <Upload size={20} />
                  Upload Note
                </button>
              )}
            </div>

            {/* Notes Grid or Empty State */}
            {subjectNotesList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjectNotesList.map((note, idx) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileHover={{ y: -5 }}
                    className="p-6 rounded-[2rem] bg-white border border-gray-100 hover:border-[#1B4332]/30 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-100/60">
                          {note.category || selectedSubject.title}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">
                          {note.fileSize || 'PDF'}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-gray-900 group-hover:text-[#1B4332] transition-colors leading-snug line-clamp-2 mb-2">
                        {note.title}
                      </h4>
                      <p className="text-xs text-gray-400 font-semibold truncate mb-6" title={note.fileName}>
                        {note.fileName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                      <a
                        href={note.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#1B4332] text-white rounded-xl text-xs font-bold hover:bg-[#143024] transition-all shadow-xs"
                      >
                        <Download size={14} /> View / Download
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteSubjectNote(note.id, note.title)}
                          title="Delete Note"
                          className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm text-gray-300">
                  <FileText size={48} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tighter">No notes uploaded yet</h3>
                <p className="text-gray-500 max-w-md mx-auto font-medium leading-relaxed mb-6">
                  {isAdmin
                    ? 'This folder is empty. Click the button below to upload PDF notes or study materials for this subject.'
                    : 'Study materials and notes for this subject are currently being prepared by our mentors and will be available soon.'}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => openSubjectUploadModal(selectedSubject.id, selectedSubject.title)}
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#1B4332] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#143024] transition-all shadow-md cursor-pointer hover:scale-105"
                  >
                    <Upload size={14} /> Upload First Note
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 0: Main Notes Page (PYQ Papers is 1st, then Mathematics, etc.)
  // ─────────────────────────────────────────────────────────────
  const filteredSubjects = SUBJECTS.filter((subject) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesTitle = subject.title.toLowerCase().includes(q);
    const matchesCount = subject.count.toLowerCase().includes(q);
    const matchesPyq =
      subject.id === 'pyq-papers' &&
      ('nda'.includes(q) || 'cds'.includes(q) || 'pyq'.includes(q) || 'paper'.includes(q) || 'previous'.includes(q));
    return matchesTitle || matchesCount || matchesPyq;
  });

  return (
    <div className="min-h-screen bg-white">
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
            STUDY MATERIAL & EXAM ARCHIVE
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2"
          >
            NOTES
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight"
          >
            Curated notes & PYQ repository by NDA/CDS-qualified mentors. Free to download.
          </motion.p>
        </div>
      </section>

      {/* Search and Grid Section */}
      <section className="py-32 px-4 max-w-7xl mx-auto relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-24">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1B4332] transition-colors" size={24} />
            <input
              type="text"
              placeholder="Search subjects, PYQ papers, NDA, CDS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-6 py-6 bg-white border border-gray-100 rounded-[2rem] focus:border-[#1B4332] focus:ring-0 transition-all outline-none text-gray-700 font-bold text-lg shadow-[0_20px_50px_rgba(0,0,0,0.03)] placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Subjects Grid (1st card is "PYQ Papers", followed by Mathematics, English, etc.) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredSubjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -12 }}
              onClick={() => setSelectedSubject(subject)}
              className={`${subject.color} p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] text-white transition-all duration-500 flex flex-col items-center text-center group cursor-pointer shadow-2xl relative overflow-hidden`}
            >
              {/* Special Badge for PYQ Papers */}
              {subject.badge && (
                <div className="absolute top-6 right-6">
                  <span className="px-3.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black tracking-widest uppercase border border-white/30 text-white">
                    {subject.badge}
                  </span>
                </div>
              )}

              <div className="absolute -right-8 -bottom-8 opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-500">
                <subject.icon size={160} />
              </div>
              <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 premium-zoom group-hover:scale-110 group-hover:rotate-6 border border-white/20 shadow-xl">
                <subject.icon size={40} />
              </div>
              <h3 className="text-3xl font-black mb-3 tracking-tighter">{subject.title}</h3>
              <p className="text-white/50 text-xs font-black mb-10 tracking-[0.3em] uppercase">
                {subject.id === 'pyq-papers'
                  ? subject.count
                  : (() => {
                      const c = allSubjectNotes.filter((n) => n.subjectId.toLowerCase() === subject.id.toLowerCase()).length;
                      return c > 0 ? `${c} ${c === 1 ? 'PDF Note' : 'PDF Notes'}` : subject.count;
                    })()}
              </p>
              <button className="px-10 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-[10px] font-black tracking-[0.3em] uppercase hover:bg-white hover:text-gray-900 transition-all duration-500 shadow-lg cursor-pointer">
                Open Folder
              </button>
            </motion.div>
          ))}
        </div>

        {filteredSubjects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 font-medium">No subjects found matching your search.</p>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          UPLOAD MODAL DIALOG (For Question Papers & Answer Keys - Admin Only)
         ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {uploadModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-gray-100 relative overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100 mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1B4332]">
                    {uploadModal.mode === 'subject'
                      ? `${uploadModal.subjectTitle} Archive`
                      : `${uploadModal.paper?.title} • ${uploadModal.subjectTitle}`}
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
                    Upload {uploadModal.typeLabel}
                  </h3>
                </div>
                <button
                  onClick={closeUploadModal}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Subject Note Title & Category Inputs */}
              {uploadModal.mode === 'subject' && (
                <div className="space-y-3 mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                      Note Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Calculus Formulas, Grammar Shortcuts, Optics Summary..."
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#1B4332] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                      Topic / Chapter / Category (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Differentiation, Ancient History, Vocabulary..."
                      value={noteCategory}
                      onChange={(e) => setNoteCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#1B4332] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Upload Type Tabs */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl mb-6">
                <button
                  onClick={() => setUploadTab('file')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    uploadTab === 'file' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <FileUp size={14} /> Upload PDF File
                </button>
                <button
                  onClick={() => setUploadTab('link')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    uploadTab === 'link' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <LinkIcon size={14} /> Paste PDF / Drive Link
                </button>
              </div>

              {/* Tab 1: File Upload */}
              {uploadTab === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 hover:border-[#1B4332] rounded-2xl p-8 text-center cursor-pointer transition-all bg-gray-50/60 hover:bg-emerald-50/20 group"
                  >
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:text-[#1B4332] shadow-xs group-hover:scale-105 transition-all">
                      <FileUp size={28} />
                    </div>
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-bold text-gray-900 truncate max-w-xs mx-auto">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          Click to browse PDF from device
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {uploadModal.mode === 'subject'
                            ? `Select the PDF note file for ${uploadModal.subjectTitle}`
                            : `Select the downloaded ${uploadModal.subjectTitle} ${uploadModal.typeLabel}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Tab 2: URL / Drive Link */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                      PDF Link or Google Drive Link
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/... or direct PDF link"
                      value={customLink}
                      onChange={(e) => setCustomLink(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#1B4332] focus:bg-white transition-all"
                    />
                  </div>
                  {uploadModal.mode === 'pyq' && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                        Display Title (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder={`e.g. ${uploadModal.paper?.title} ${uploadModal.subjectTitle} ${uploadModal.typeLabel}`}
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#1B4332] focus:bg-white transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Status messages */}
              {uploadError && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} /> {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <Check size={15} /> {uploadSuccess}
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  disabled={uploading}
                  className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteUpload}
                  disabled={uploading}
                  className="px-6 py-2.5 bg-[#1B4332] text-white rounded-xl text-xs font-black tracking-wider uppercase hover:bg-[#143024] transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={14} /> Save {uploadModal.typeLabel}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
