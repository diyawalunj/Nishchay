import { BookOpen, HelpCircle, GraduationCap, Bell, Users, Dumbbell } from 'lucide-react';

export const NAV_LINKS = [
  { name: 'HOME', href: '/' },
  { name: 'ABOUT', href: '/about' },
  { name: 'NOTES', href: '/notes' },
  { name: 'DOUBTS', href: '/doubts' },
  { name: 'TESTS', href: '/tests' },
  { name: 'SSB', href: '/ssb' },
  { name: 'GALLERY', href: '/gallery' },
  { name: 'CONTACT', href: '/contact' },
];

export const SERVICES = [
  {
    title: 'Curated Notes',
    description: 'Handwritten & typed notes by NDA/CDS-qualified mentors for Maths, English, GK & Current Affairs.',
    icon: BookOpen,
    color: 'bg-green-50 text-green-600',
  },
  {
    title: 'Doubt Solving',
    description: 'Get your doubts resolved instantly via WhatsApp, live chat, or community Q&A.',
    icon: HelpCircle,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'SSB Preparation',
    description: 'Complete SSB coaching — Screening, Psychology, GTO, Interview & OLQ development.',
    icon: GraduationCap,
    color: 'bg-yellow-50 text-yellow-600',
  },
  {
    title: 'Exam Updates',
    description: 'Stay updated on NDA, CDS, AFCAT, OTA, TES & all defence entry notifications.',
    icon: Bell,
    color: 'bg-sky-50 text-sky-600',
  },
  {
    title: 'Community',
    description: 'Connect with fellow aspirants, share strategies, and grow together as future officers.',
    icon: Users,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Fitness & Discipline',
    description: 'Physical fitness guidance, study planners, and daily motivation to keep you on track.',
    icon: Dumbbell,
    color: 'bg-slate-50 text-slate-600',
  },
];

export const FOOTER_LINKS = {
  quickLinks: [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Notes', href: '/notes' },
    { name: 'SSB', href: '/ssb' },
    { name: 'Contact', href: '/contact' },
  ],
  exams: [
    { name: 'NDA', href: '/nda' },
    { name: 'CDS', href: '/cds' },
    { name: 'AFCAT', href: '/afcat' },
    { name: 'Technical', href: '/technical' },
  ],
  resources: [
    { name: 'Gallery', href: '/gallery' },
    { name: 'Doubts', href: '/doubts' },
    { name: 'NCC', href: '/ncc' },
    { name: 'Mock Tests', href: '/tests' },
  ],
};
