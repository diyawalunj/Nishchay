import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { auth, onAuthStateChanged, checkIfAdmin } from './firebase';
import type { SubjectNote } from './notes-db';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Calculator, Book, Globe, Newspaper, Target,
  ChevronLeft, Upload, FileText, Atom, FlaskConical,
  Dna, Landmark, Coins, Map, BookOpen, FileCheck, Shield,
  Award, CheckCircle2, ArrowRight,
  Download, Sparkles, Folder, Check, Clock,
  X, Trash2, RefreshCw, FileUp, Link as LinkIcon, AlertCircle
} from 'lucide-react';

interface Subject {
  id: string;
  title: string;
  count?: string;
  icon: any;
  color?: string;
  gradient: string;
  shadow: string;
  border?: string;
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
    icon: FileCheck,
    color: 'bg-[#1B4332]',
    gradient: 'from-[#1B4332] via-[#245A43] to-[#143728]',
    shadow: 'shadow-lg shadow-[#1B4332]/25 hover:shadow-2xl hover:shadow-[#1B4332]/40',
    border: 'border-emerald-400/25',
    description: 'Official UPSC Question Papers & Answer Keys (2021 – 2026)',
  },
  {
    id: 'maths',
    title: 'Mathematics',
    icon: Calculator,
    color: 'bg-[#0F766E]',
    gradient: 'from-[#0F766E] via-[#0D9488] to-[#115E59]',
    shadow: 'shadow-lg shadow-[#0F766E]/25 hover:shadow-2xl hover:shadow-[#0F766E]/40',
    border: 'border-teal-400/25',
    description: 'Calculus, Algebra, Trigonometry, Matrices & Coordinate Geometry',
  },
  {
    id: 'english',
    title: 'English',
    icon: Book,
    color: 'bg-[#1E3A8A]',
    gradient: 'from-[#1E3A8A] via-[#2546A3] to-[#172E6F]',
    shadow: 'shadow-lg shadow-[#1E3A8A]/25 hover:shadow-2xl hover:shadow-[#1E3A8A]/40',
    border: 'border-sky-400/25',
    description: 'Grammar Rules, Vocabulary Roots, Idioms, Antonyms & Comprehension',
  },
  {
    id: 'physics',
    title: 'Physics',
    icon: Atom,
    color: 'bg-[#581C87]',
    gradient: 'from-[#581C87] via-[#7E22CE] to-[#45106E]',
    shadow: 'shadow-lg shadow-[#581C87]/25 hover:shadow-2xl hover:shadow-[#581C87]/40',
    border: 'border-purple-400/25',
    description: 'Mechanics, Optics, Thermodynamics, Electromagnetism & Modern Physics',
  },
  {
    id: 'chemistry',
    title: 'Chemistry',
    icon: FlaskConical,
    color: 'bg-[#DB2777]',
    gradient: 'from-[#DB2777] via-[#EC4899] to-[#BE185D]',
    shadow: 'shadow-lg shadow-[#DB2777]/25 hover:shadow-2xl hover:shadow-[#DB2777]/40',
    border: 'border-pink-300/30',
    description: 'Periodic Classification, Chemical Bonding, Acids & Redox Reactions',
  },
  {
    id: 'biology',
    title: 'Biology',
    icon: Dna,
    color: 'bg-[#15803D]',
    gradient: 'from-[#15803D] via-[#16A34A] to-[#14532D]',
    shadow: 'shadow-lg shadow-[#15803D]/25 hover:shadow-2xl hover:shadow-[#15803D]/40',
    border: 'border-emerald-300/25',
    description: 'Human Physiology, Cell Biology, Genetics, Botany & Ecosystems',
  },
  {
    id: 'economics',
    title: 'Economics',
    icon: Coins,
    color: 'bg-[#B45309]',
    gradient: 'from-[#B45309] via-[#D97706] to-[#8D3F06]',
    shadow: 'shadow-lg shadow-[#B45309]/25 hover:shadow-2xl hover:shadow-[#B45309]/40',
    border: 'border-amber-300/25',
    description: 'Indian Economy, Union Budget, Inflation, Banking & Fiscal Policies',
  },
  {
    id: 'history',
    title: 'History',
    icon: BookOpen,
    color: 'bg-[#854D0E]',
    gradient: 'from-[#854D0E] via-[#A16207] to-[#593306]',
    shadow: 'shadow-lg shadow-[#854D0E]/25 hover:shadow-2xl hover:shadow-[#854D0E]/40',
    border: 'border-orange-300/25',
    description: 'Ancient Civilizations, Medieval India, Freedom Struggle & Modern Era',
  },
  {
    id: 'polity',
    title: 'Polity',
    icon: Landmark,
    color: 'bg-[#1D4ED8]',
    gradient: 'from-[#1D4ED8] via-[#2563EB] to-[#1E40AF]',
    shadow: 'shadow-lg shadow-[#1D4ED8]/25 hover:shadow-2xl hover:shadow-[#1D4ED8]/40',
    border: 'border-blue-300/25',
    description: 'Constitution of India, Fundamental Rights, Parliament & Judiciary',
  },
  {
    id: 'geography',
    title: 'Geography',
    icon: Map,
    color: 'bg-[#144D30]',
    gradient: 'from-[#144D30] via-[#1B6640] to-[#0E3823]',
    shadow: 'shadow-lg shadow-[#144D30]/25 hover:shadow-2xl hover:shadow-[#144D30]/40',
    border: 'border-emerald-400/25',
    description: 'Physical Geography, Climatology, Indian River Basins & Minerals',
  },
  {
    id: 'current-affairs',
    title: 'Current Affairs',
    icon: Newspaper,
    color: 'bg-[#334155]',
    gradient: 'from-[#334155] via-[#475569] to-[#1E293B]',
    shadow: 'shadow-lg shadow-[#334155]/25 hover:shadow-2xl hover:shadow-[#334155]/40',
    border: 'border-slate-300/25',
    description: 'National & Defence News, Bilateral Exercises, Summits & Awards',
  },
  {
    id: 'strategy',
    title: 'Strategy Guides',
    icon: Target,
    color: 'bg-[#3730A3]',
    gradient: 'from-[#3730A3] via-[#4338CA] to-[#252070]',
    shadow: 'shadow-lg shadow-[#3730A3]/25 hover:shadow-2xl hover:shadow-[#3730A3]/40',
    border: 'border-indigo-300/25',
    description: 'Exam Strategy, Time Management, Cutoff Analysis & SSB Blueprint',
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
    if (!isAdmin) {
      if (!auth.currentUser) {
        alert('Authentication Required: Please sign in with your administrator Google account to upload papers.');
      } else {
        alert(`Access Restricted (${auth.currentUser.email}): This account is not authorized as an administrator.`);
      }
      return;
    }
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
    setSelectedFile(null);
    setCustomLink('');
    setLinkTitle('');
    setUploadError('');
    setUploadSuccess('');
    setUploadTab('file');
  };

  const openSubjectUploadModal = (subjectId: string, subjectTitle: string) => {
    if (!isAdmin) {
      if (!auth.currentUser) {
        alert('Authentication Required: Please sign in with your administrator Google account to upload notes.');
      } else {
        alert(`Access Restricted (${auth.currentUser.email}): This account is not authorized as an administrator.`);
      }
      return;
    }
    setUploadModal({
      isOpen: true,
      mode: 'subject',
      subjectId,
      subjectTitle,
      typeLabel: `${subjectTitle} Note`,
    });
    setNoteTitle('');
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
    setSelectedFile(null);
    setCustomLink('');
    setLinkTitle('');
    setUploadError('');
    setUploadSuccess('');
  };

  const MAX_FILE_SIZE_MB = 4;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Handle file selection with 4MB limit check and popup alert
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check 4MB size ceiling
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const actualMb = (file.size / (1024 * 1024)).toFixed(1);
        alert(
          `⚠️ File Size Limit Exceeded (${actualMb} MB)\n\n` +
          `The maximum allowed file size for direct uploads is 4 MB. For larger files, please use the "Paste PDF / Drive Link" option.`
        );
        e.target.value = '';
        setSelectedFile(null);
        setUploadError(`File too large (${actualMb} MB). Maximum allowed size is 4 MB.`);
        return;
      }

      // Check PDF type
      if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('⚠️ Invalid File Type\n\nPlease select a valid PDF document (.pdf).');
        e.target.value = '';
        setSelectedFile(null);
        setUploadError('Only PDF files are supported.');
        return;
      }

      setSelectedFile(file);
      setUploadError('');
    }
  };

  // Helper to obtain authenticated headers
  const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) {
      throw new Error('Authentication session not found. Please sign in again.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Safe API response parser preventing raw HTML / 413 syntax errors
  const parseApiResponse = async (res: Response, fallbackErrMsg = 'Upload failed'): Promise<any> => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || fallbackErrMsg);
      }
      return data;
    }
    const rawText = await res.text();
    if (res.status === 413 || rawText.includes('Entity Too Large') || rawText.includes('too large')) {
      throw new Error('The selected PDF is too large for direct processing. Please select a file under 4 MB or use the "Paste PDF / Drive Link" tab.');
    }
    if (rawText.includes('FUNCTION_INVOCATION_FAILED')) {
      throw new Error('Cloud storage execution error. Please use the "Paste PDF / Drive Link" tab or ensure Google Drive environment variables are set in Vercel.');
    }
    throw new Error(rawText ? rawText.slice(0, 150) : `${fallbackErrMsg} (HTTP ${res.status})`);
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

          if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
            const actualMb = (selectedFile.size / (1024 * 1024)).toFixed(1);
            alert(`⚠️ File Size Limit Exceeded (${actualMb} MB)\n\nThe maximum allowed file size for direct uploads is 4 MB. Please use "Paste PDF / Drive Link" for larger documents.`);
            throw new Error(`File size (${actualMb} MB) exceeds 4 MB limit.`);
          }

          const token = await auth.currentUser?.getIdToken(true);
          if (!token) throw new Error('Authentication session not found.');

          const queryParams = new URLSearchParams({
            subjectId: uploadModal.subjectId,
            subjectTitle: uploadModal.subjectTitle,
            title: noteTitle.trim(),
            originalName: selectedFile.name,
            fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
          });

          // Send file directly as raw binary (0% Base64 expansion to stay safely under Vercel serverless limit)
          const res = await fetch(`/api/notes/upload?${queryParams.toString()}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/pdf',
              'Authorization': `Bearer ${token}`,
              'X-Original-Name': encodeURIComponent(selectedFile.name),
            },
            body: selectedFile,
          });

          const data = await parseApiResponse(res, 'Note upload failed');

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
              url: customLink.trim(),
              fileSize: 'Online Document',
            }),
          });

          const data = await parseApiResponse(res, 'Failed to save note link');

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

        if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
          const actualMb = (selectedFile.size / (1024 * 1024)).toFixed(1);
          alert(`⚠️ File Size Limit Exceeded (${actualMb} MB)\n\nThe maximum allowed file size for direct uploads is 4 MB. Please use "Paste PDF / Drive Link" for larger documents.`);
          throw new Error(`File size (${actualMb} MB) exceeds 4 MB limit.`);
        }

        const token = await auth.currentUser?.getIdToken(true);
        if (!token) throw new Error('Authentication session not found.');

        const queryParams = new URLSearchParams({
          sessionId: uploadModal.paper.id,
          exam: uploadModal.paper.exam,
          session: uploadModal.paper.session,
          year: String(uploadModal.paper.year),
          title: uploadModal.paper.title,
          subjectKey: uploadModal.subjectKey,
          fileType: uploadModal.fileType,
          originalName: selectedFile.name,
          fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        });

        // Send file directly as raw binary (0% Base64 expansion to stay safely under Vercel serverless limit)
        const res = await fetch(`/api/pyq/upload?${queryParams.toString()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf',
            'Authorization': `Bearer ${token}`,
            'X-Original-Name': encodeURIComponent(selectedFile.name),
          },
          body: selectedFile,
        });

        const data = await parseApiResponse(res, 'PYQ paper upload failed');

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

        const data = await parseApiResponse(res, 'Failed to save PYQ link');

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
      console.error('Upload error:', err);
      const msg = err?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || err?.name === 'TypeError') {
        setUploadError(
          'Upload payload exceeded hosting provider limit (Failed to fetch). Serverless hosting (like Vercel) terminates direct file uploads larger than 4.5 MB. Please use the "Paste PDF / Drive Link" tab for this document.'
        );
      } else {
        setUploadError(msg || 'Upload operation failed.');
      }
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
  // REUSABLE UPLOAD MODAL DIALOG (Rendered across all views)
  // ─────────────────────────────────────────────────────────────
  const renderUploadModal = () => (
    <AnimatePresence>
      {uploadModal && (
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

            {/* Subject Note Title Input */}
            {uploadModal.mode === 'subject' && (
              <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
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
                      <p className="text-xs text-gray-500 mt-1 font-medium">
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
                      <p className="text-[11px] font-semibold text-emerald-800/80 mt-2 bg-emerald-50 inline-block px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                        Max direct upload: 4 MB • For larger files use "Paste PDF / Drive Link"
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
  );

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
          <div
            className={`rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden mb-10 border text-white ${
              isNda
                ? 'bg-gradient-to-br from-[#991B1B] via-[#C52222] to-[#6E1010] border-rose-400/30 shadow-[#991B1B]/25'
                : 'bg-gradient-to-br from-[#B45309] via-[#D97706] to-[#78350F] border-amber-400/25 shadow-[#B45309]/25'
            }`}
          >
            {/* Top Sheen & Subtle Mesh Glow */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-black/20 rounded-full blur-2xl pointer-events-none" />

            {/* Giant Watermark Background Icon */}
            <div className="absolute -right-8 -bottom-12 opacity-[0.07] pointer-events-none text-white">
              {isNda ? <Shield size={280} /> : <Award size={280} />}
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/15">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/15 backdrop-blur-xl rounded-3xl flex items-center justify-center text-white border border-white/25 shadow-2xl ring-1 ring-white/20 shrink-0">
                  {isNda ? (
                    <Shield size={44} className="text-white drop-shadow-md" />
                  ) : (
                    <Award size={44} className="text-amber-200 drop-shadow-md" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="px-3.5 py-1.5 bg-white/15 backdrop-blur-md text-white border border-white/25 text-[10px] font-black tracking-widest uppercase rounded-full shadow-xs">
                      {selectedPaper.exam} {selectedPaper.session}
                    </span>
                    <span className="px-3.5 py-1.5 bg-white/10 backdrop-blur-md text-white/90 border border-white/15 text-[10px] font-black tracking-widest uppercase rounded-full">
                      Year {selectedPaper.year}
                    </span>
                    <span className="px-3.5 py-1.5 bg-white/20 backdrop-blur-md text-white border border-white/30 text-[10px] font-black tracking-widest uppercase rounded-full flex items-center gap-1.5 shadow-xs">
                      <Sparkles size={11} className={isNda ? 'text-amber-300' : 'text-sky-200'} />
                      {isAdmin ? 'Admin Archive Console' : 'Official Defence Archive'}
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-sm">
                    {selectedPaper.title}
                  </h1>
                  <p className="text-white/80 font-medium text-sm md:text-base mt-1.5">
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
          </div>
        </div>
        {renderUploadModal()}
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
          <div
            className={`rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden mb-10 border text-white ${
              isNda
                ? 'bg-gradient-to-br from-[#991B1B] via-[#C52222] to-[#6E1010] border-rose-400/30 shadow-[#991B1B]/25'
                : 'bg-gradient-to-br from-[#B45309] via-[#D97706] to-[#78350F] border-amber-400/25 shadow-[#B45309]/25'
            }`}
          >
            {/* Top Sheen & Subtle Mesh Glow */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-black/20 rounded-full blur-2xl pointer-events-none" />

            {/* Giant Watermark Background Icon */}
            <div className="absolute -right-8 -bottom-12 opacity-[0.07] pointer-events-none text-white">
              {isNda ? <Shield size={280} /> : <Award size={280} />}
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/15">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/15 backdrop-blur-xl rounded-3xl flex items-center justify-center text-white border border-white/25 shadow-2xl ring-1 ring-white/20 shrink-0">
                  {isNda ? (
                    <Shield size={44} className="text-white drop-shadow-md" />
                  ) : (
                    <Award size={44} className="text-amber-200 drop-shadow-md" />
                  )}
                </div>
                <div>
                  <span className="px-3.5 py-1.5 bg-white/15 backdrop-blur-md text-white border border-white/25 text-[10px] font-black tracking-widest uppercase rounded-full inline-flex items-center gap-1.5 mb-2 shadow-xs">
                    <Sparkles size={11} className={isNda ? 'text-amber-300' : 'text-amber-200'} />
                    EXAM SESSIONS • 2021 – 2026
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-sm">
                    {selectedExam} Previous Year Papers
                  </h1>
                  <p className="text-white/80 font-medium text-sm md:text-base mt-1.5 max-w-2xl">
                    {isNda
                      ? 'National Defence Academy (GAT & Maths Papers with Official Answer Keys)'
                      : 'Combined Defence Services (English, GS & Maths Papers with Official Answer Keys)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar Row */}
            <div className="relative z-10 mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Year Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                <span className="text-xs font-black uppercase tracking-wider text-white/60 mr-1 shrink-0">Year:</span>
                {(['All', ...YEARS] as const).map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYearFilter(yr)}
                    className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all shrink-0 cursor-pointer ${
                      selectedYearFilter === yr
                        ? 'bg-white text-gray-900 shadow-xl scale-105'
                        : 'bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

              {/* Quick Search inside this exam */}
              <div className="relative min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={16} />
                <input
                  type="text"
                  placeholder={`Search ${selectedExam} papers (e.g. 2025, II)...`}
                  value={paperSearch}
                  onChange={(e) => setPaperSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/15 border border-white/25 rounded-2xl text-xs font-bold text-white placeholder:text-white/60 outline-none backdrop-blur-md focus:bg-white focus:text-gray-900 focus:placeholder:text-gray-400 transition-all shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Paper Cards Grid (format: NDA II, 2026 -> NDA I, 2021) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredPapers.map((paper, idx) => {
              const uploadStatus = getSessionUploadCount(paper);
              const sessionRecord = pyqSessions[paper.id];
              const isSessionII = paper.session === 'II';

              return (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ y: -8 }}
                  onClick={() => setSelectedPaper(paper)}
                  className={`bg-white rounded-[2rem] p-6 md:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_22px_45px_rgba(0,0,0,0.1)] border transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden ${
                    isNda
                      ? 'border-gray-100 hover:border-rose-200/80 hover:shadow-rose-900/5'
                      : 'border-gray-100 hover:border-amber-200/80 hover:shadow-amber-900/5'
                  }`}
                >
                  {/* Top Colored Accent Bar */}
                  <div
                    className={`absolute top-0 inset-x-0 h-1.5 group-hover:h-2 transition-all duration-300 ${
                      isSessionII
                        ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600'
                        : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
                    }`}
                  />

                  {/* Year Watermark in Card Background */}
                  <div className="absolute right-4 top-8 text-7xl font-black text-gray-900/[0.04] group-hover:text-gray-900/[0.08] font-mono tracking-tighter select-none pointer-events-none transition-colors">
                    {paper.year}
                  </div>

                  <div className="relative z-10">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-full flex items-center gap-1.5 border shadow-2xs ${
                          isSessionII
                            ? 'bg-amber-500/10 text-amber-900 border-amber-500/25'
                            : 'bg-emerald-500/10 text-emerald-900 border-emerald-500/25'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSessionII
                              ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                              : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                          } animate-pulse`}
                        />
                        SESSION {paper.session}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full border shadow-2xs flex items-center gap-1.5 ${
                          uploadStatus.count === uploadStatus.total
                            ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300'
                            : uploadStatus.count > 0
                            ? 'bg-sky-100/90 text-sky-900 border-sky-300'
                            : 'bg-gray-100/80 text-gray-500 border-gray-200'
                        }`}
                      >
                        {uploadStatus.count === uploadStatus.total ? (
                          <Check size={11} className="text-emerald-700 stroke-[3]" />
                        ) : (
                          <Folder size={11} className="text-gray-400" />
                        )}
                        {uploadStatus.count}/{uploadStatus.total} Files
                      </span>
                    </div>

                    {/* Title Row with Exam Squircle Icon */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs group-hover:scale-105 transition-transform duration-300 shrink-0 ${
                          isNda
                            ? 'bg-rose-50 text-[#991B1B] border-rose-200/80'
                            : 'bg-amber-50 text-[#B45309] border-amber-200/80'
                        }`}
                      >
                        {isNda ? <Shield size={20} /> : <Award size={20} />}
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight group-hover:text-black transition-colors leading-tight">
                          {paper.title}
                        </h3>
                        <p className="text-[11px] font-bold text-gray-400 tracking-wide uppercase">
                          UPSC {paper.exam} {paper.year} • Session {paper.session}
                        </p>
                      </div>
                    </div>

                    {/* Subject Breakdown summary with structured tactical manifest */}
                    <div className="bg-gradient-to-b from-gray-50/90 via-gray-50/50 to-white rounded-2xl p-3.5 border border-gray-100 space-y-2 mb-6 group-hover:border-gray-200 transition-colors">
                      {isNda ? (
                        <>
                          {/* Mathematics */}
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/80 transition-colors border-b border-gray-100/80">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Calculator size={11} />
                              </div>
                              <span className="font-extrabold text-xs text-gray-800">Mathematics</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {sessionRecord?.subjects?.maths?.paper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> QP
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> QP
                                </span>
                              )}
                              {sessionRecord?.subjects?.maths?.key ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> Key
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> Key
                                </span>
                              )}
                            </div>
                          </div>

                          {/* GAT */}
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/80 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Globe size={11} />
                              </div>
                              <span className="font-extrabold text-xs text-gray-800">GAT (General Ability)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {sessionRecord?.subjects?.gat?.paper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> QP
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> QP
                                </span>
                              )}
                              {sessionRecord?.subjects?.gat?.key ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> Key
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> Key
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* English */}
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/80 transition-colors border-b border-gray-100/80">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                <BookOpen size={11} />
                              </div>
                              <span className="font-extrabold text-xs text-gray-800">English</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {sessionRecord?.subjects?.english?.paper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> QP
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> QP
                                </span>
                              )}
                              {sessionRecord?.subjects?.english?.key ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> Key
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> Key
                                </span>
                              )}
                            </div>
                          </div>

                          {/* General Studies */}
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/80 transition-colors border-b border-gray-100/80">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Landmark size={11} />
                              </div>
                              <span className="font-extrabold text-xs text-gray-800">General Studies (GS)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {sessionRecord?.subjects?.gs?.paper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> QP
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> QP
                                </span>
                              )}
                              {sessionRecord?.subjects?.gs?.key ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> Key
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> Key
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Mathematics */}
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/80 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Calculator size={11} />
                              </div>
                              <span className="font-extrabold text-xs text-gray-800">Mathematics</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {sessionRecord?.subjects?.maths?.paper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> QP
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> QP
                                </span>
                              )}
                              {sessionRecord?.subjects?.maths?.key ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shadow-2xs">
                                  <Check size={10} className="text-emerald-700 stroke-[3]" /> Key
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold border border-gray-200/80">
                                  <Clock size={9} className="text-gray-300" /> Key
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="relative z-10 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-black tracking-wider uppercase text-gray-500 group-hover:text-gray-900 transition-colors">
                      {uploadStatus.count > 0 ? (isAdmin ? 'Manage & Download' : 'View & Download') : (isAdmin ? 'Upload Papers' : 'Explore Session')}
                    </span>
                    <div
                      className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-1.5 transition-all duration-300 shadow-xs group-hover:shadow-md group-hover:scale-105 text-white ${
                        isNda
                          ? 'bg-gray-900 group-hover:bg-[#991B1B]'
                          : 'bg-gray-900 group-hover:bg-[#B45309]'
                      }`}
                    >
                      <span>Open</span>
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
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
          <div className="rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden mb-12 border text-white bg-gradient-to-br from-[#1B4332] via-[#245A43] to-[#123827] border-emerald-400/25 shadow-[#1B4332]/25">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -right-8 -bottom-12 opacity-[0.07] pointer-events-none text-white">
              <FileCheck size={280} />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/15">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/15 backdrop-blur-xl rounded-3xl flex items-center justify-center text-white border border-white/25 shadow-2xl ring-1 ring-white/20 shrink-0">
                  <FileCheck size={44} className="text-emerald-300 drop-shadow-md" />
                </div>
                <div>
                  <span className="px-3.5 py-1.5 bg-white/15 backdrop-blur-md text-white border border-white/25 text-[10px] font-black tracking-widest uppercase rounded-full inline-flex items-center gap-1.5 mb-2 shadow-xs">
                    <Sparkles size={11} className="text-amber-300" />
                    NISHCHAY DEFENCE ARCHIVE
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-sm">
                    PYQ Papers
                  </h1>
                  <p className="text-white/80 font-medium text-sm md:text-base mt-1.5">
                    Previous Year Question Papers & Answer Keys (2021 – 2026)
                  </p>
                </div>
              </div>
            </div>

            <p className="relative z-10 text-white/80 mt-6 text-sm md:text-base font-medium max-w-3xl leading-relaxed">
              Select an examination below to open session folders from 2021 to 2026. You can upload and download Question Papers and Answer Keys for Maths and GAT (NDA) or English, GS, and Maths (CDS).
            </p>
          </div>

          {/* The 2 Sub-Cards: 1st "NDA", 2nd "CDS" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            {/* 1st Card: NDA (Cadet Crimson / Heroic Ruby Red) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -12 }}
              onClick={() => setSelectedExam('NDA')}
              className="bg-gradient-to-br from-[#991B1B] via-[#C52222] to-[#6E1010] border border-rose-400/35 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] text-white transition-all duration-500 flex flex-col justify-between group cursor-pointer shadow-2xl shadow-[#991B1B]/30 hover:shadow-[#991B1B]/50 relative overflow-hidden min-h-[380px]"
            >
              {/* Ambient Sheen & Glow Orbs */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/15 blur-2xl pointer-events-none" />

              <div className="absolute -right-8 -bottom-8 opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-500">
                <Shield size={220} />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center premium-zoom group-hover:scale-110 group-hover:rotate-6 border border-white/30 shadow-xl ring-1 ring-white/25">
                    <Shield size={40} className="text-white drop-shadow-md" />
                  </div>
                  <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white text-[10px] font-black tracking-widest uppercase shadow-xs">
                    12 Sessions
                  </span>
                </div>

                <h3 className="text-4xl md:text-5xl font-black mb-2 tracking-tighter drop-shadow-sm">NDA</h3>
                <p className="text-white/95 font-bold text-sm tracking-wide mb-3">
                  National Defence Academy & Naval Academy
                </p>
                <p className="text-white/80 text-xs font-medium leading-relaxed max-w-md mb-8">
                  Session papers from 2021 to 2026. Manage and download Mathematics (Paper 1) and General Ability Test (GAT) papers with answer keys.
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/20">
                <span className="text-white/90 text-xs font-black tracking-[0.2em] uppercase">Maths & GAT Papers</span>
                <button className="px-8 py-3.5 bg-white text-[#991B1B] rounded-2xl text-xs font-black tracking-widest uppercase hover:bg-rose-50 transition-all duration-300 shadow-lg flex items-center gap-2 group-hover:scale-105">
                  Open NDA <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>

            {/* 2nd Card: CDS (Warm Sunset Amber / Radiant Topaz Gold) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -12 }}
              onClick={() => setSelectedExam('CDS')}
              className="bg-gradient-to-br from-[#B45309] via-[#D97706] to-[#78350F] border border-amber-400/30 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] text-white transition-all duration-500 flex flex-col justify-between group cursor-pointer shadow-2xl shadow-[#B45309]/30 hover:shadow-[#B45309]/50 relative overflow-hidden min-h-[380px]"
            >
              {/* Ambient Sheen & Glow Orbs */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

              <div className="absolute -right-8 -bottom-8 opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-500">
                <Award size={220} />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-20 h-20 bg-white/15 backdrop-blur-xl rounded-3xl flex items-center justify-center premium-zoom group-hover:scale-110 group-hover:rotate-6 border border-white/25 shadow-xl ring-1 ring-white/20">
                    <Award size={40} className="text-amber-200 drop-shadow-md" />
                  </div>
                  <span className="px-4 py-1.5 bg-white/15 backdrop-blur-md border border-white/25 rounded-full text-white text-[10px] font-black tracking-widest uppercase shadow-xs">
                    12 Sessions
                  </span>
                </div>

                <h3 className="text-4xl md:text-5xl font-black mb-2 tracking-tighter drop-shadow-sm">CDS</h3>
                <p className="text-white/90 font-bold text-sm tracking-wide mb-3">
                  Combined Defence Services Examination
                </p>
                <p className="text-white/70 text-xs font-medium leading-relaxed max-w-md mb-8">
                  Session papers from 2021 to 2026. Manage and download English, GS (General Studies), and Elementary Mathematics papers with answer keys.
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/15">
                <span className="text-white/80 text-xs font-black tracking-[0.2em] uppercase">English, GS & Maths</span>
                <button className="px-8 py-3.5 bg-white text-[#B45309] rounded-2xl text-xs font-black tracking-widest uppercase hover:bg-amber-50 transition-all duration-300 shadow-lg flex items-center gap-2 group-hover:scale-105">
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
                <div className={`w-20 h-20 bg-gradient-to-br ${selectedSubject.gradient} rounded-3xl flex items-center justify-center text-white shadow-xl ${selectedSubject.shadow} border border-white/20 relative overflow-hidden group`}>
                  <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                  <selectedSubject.icon size={38} className="text-white relative z-10 drop-shadow-md" />
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
        {renderUploadModal()}
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
    const matchesCount = subject.count?.toLowerCase().includes(q) ?? false;
    const matchesDesc = subject.description?.toLowerCase().includes(q) ?? false;
    const matchesPyq =
      subject.id === 'pyq-papers' &&
      ('nda'.includes(q) || 'cds'.includes(q) || 'pyq'.includes(q) || 'paper'.includes(q) || 'previous'.includes(q));
    return matchesTitle || matchesCount || matchesDesc || matchesPyq;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {filteredSubjects.map((subject, index) => {
            const count = allSubjectNotes.filter((n) => n.subjectId.toLowerCase() === subject.id.toLowerCase()).length;
            const subtitleText =
              subject.id === 'pyq-papers'
                ? 'NDA & CDS PYQ Archive'
                : count > 0
                ? `${count} ${count === 1 ? 'Study Note' : 'Study Notes'}`
                : 'Curated Study Vault';

            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                whileHover={{ y: -10, scale: 1.01 }}
                onClick={() => setSelectedSubject(subject)}
                className={`group relative rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-br ${subject.gradient} ${subject.shadow} p-8 md:p-12 text-white transition-all duration-500 flex flex-col items-center text-center cursor-pointer relative overflow-hidden border border-white/20 ring-1 ring-white/10`}
              >
                {/* Subtle Ambient Radial Light Orb */}
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/15 blur-2xl group-hover:bg-white/25 group-hover:scale-125 transition-all duration-700 pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-black/15 blur-2xl pointer-events-none" />

                {/* Subtle Ambient Light Sheen from top */}
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

                {/* Translucent Watermark Background Icon */}
                <div className="absolute -right-8 -bottom-8 text-white opacity-[0.08] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none">
                  <subject.icon size={180} />
                </div>

                {/* 3D Glass Frosted Icon Pod */}
                <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 border border-white/35 shadow-[0_12px_28px_rgba(0,0,0,0.15)] group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.22)] transition-all duration-500 relative z-10 ring-1 ring-white/30">
                  <subject.icon size={40} className="text-white drop-shadow-md" />
                </div>

                {/* Subject Title */}
                <h3 className="text-3xl font-black mb-3 tracking-tight text-white relative z-10 drop-shadow-sm group-hover:scale-[1.02] transition-transform duration-300">
                  {subject.title}
                </h3>

                {/* Pill Subtitle with Micro Indicator */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/15 text-white/90 text-[10px] font-black tracking-widest uppercase mb-8 shadow-xs relative z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>{subtitleText}</span>
                </div>

                {/* Open Folder Action Button */}
                <div className="mt-auto relative z-10">
                  <button className="px-8 py-3.5 bg-white/15 hover:bg-white text-white hover:text-[#1A1A1A] border border-white/30 hover:border-white backdrop-blur-md rounded-2xl text-[11px] font-black tracking-[0.2em] uppercase transition-all duration-300 shadow-md flex items-center gap-2.5 cursor-pointer group-hover:scale-105 group-hover:shadow-xl">
                    <span>Open Folder</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-300" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredSubjects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 font-medium">No subjects found matching your search.</p>
          </div>
        )}
      </section>

      {/* Shared Upload Modal Dialog */}
      {renderUploadModal()}
    </div>
  );
}
