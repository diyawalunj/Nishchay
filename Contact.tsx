import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, Instagram, Youtube, Send as Telegram, MessageCircle } from 'lucide-react';

interface FormData {
  fullName: string;
  email: string;
  message: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  message?: string;
}

const Contact: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to submit form');
        }

        console.log('Form submitted successfully');
        setIsSuccess(true);
        setFormData({ fullName: '', email: '', message: '' });
        
        // Reset success message after 5 seconds
        setTimeout(() => setIsSuccess(false), 5000);
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('Failed to submit form. Please try again later.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

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
            GET IN TOUCH
          </span>
          <h1 className="text-7xl md:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none">
            CONTACT
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Have questions? Reach out — we're here to help you on your defence journey.
          </p>
        </motion.div>
      </section>

      {/* Contact Content */}
      <section className="max-w-7xl mx-auto px-4 py-32 pb-48 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left Column: Info */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            {/* Contact Cards */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.03)] flex items-center gap-8 border border-gray-100 group hover:border-[#1B4332]/20 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332] group-hover:bg-[#1B4332] group-hover:text-white transition-all duration-500 shadow-inner">
                <Mail size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.3em] text-gray-300 uppercase mb-2">Email</p>
                <p className="text-2xl font-black text-[#1A1A1A] tracking-tight">nishchay.defence@gmail.com</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.03)] flex items-center gap-8 border border-gray-100 group hover:border-[#1B4332]/20 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332] group-hover:bg-[#1B4332] group-hover:text-white transition-all duration-500 shadow-inner">
                <Phone size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.3em] text-gray-300 uppercase mb-2">Phone</p>
                <p className="text-2xl font-black text-[#1A1A1A] tracking-tight">+91 8767642811</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.03)] flex items-center gap-8 border border-gray-100 group hover:border-[#1B4332]/20 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332] group-hover:bg-[#1B4332] group-hover:text-white transition-all duration-500 shadow-inner">
                <MapPin size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.3em] text-gray-300 uppercase mb-2">Location</p>
                <p className="text-2xl font-black text-[#1A1A1A] tracking-tight">Nashik, Maharashtra, India</p>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap gap-4 pt-8">
              {['INSTAGRAM', 'YOUTUBE', 'TELEGRAM', 'WHATSAPP'].map((social) => (
                <button 
                  key={social}
                  className="px-8 py-4 bg-white rounded-2xl text-[10px] font-black tracking-[0.2em] text-gray-400 border border-gray-100 shadow-sm hover:border-[#1B4332]/30 hover:text-[#1B4332] hover:scale-105 transition-all duration-300"
                >
                  {social}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Right Column: Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-12 rounded-[3rem] shadow-[0_50px_120px_rgba(0,0,0,0.04)] border border-gray-100"
          >
            {isSuccess ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12"
              >
                <div className="w-24 h-24 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                  <Send size={48} />
                </div>
                <h3 className="text-3xl font-black text-[#1A1A1A] tracking-tighter">Message Sent!</h3>
                <p className="text-gray-500 font-medium text-lg">Thank you for reaching out. We'll get back to you shortly.</p>
                <button 
                  onClick={() => setIsSuccess(false)}
                  className="text-[#1B4332] font-black text-[10px] tracking-[0.3em] uppercase hover:underline pt-4"
                >
                  Send another message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black tracking-[0.3em] text-gray-300 uppercase ml-1">Full Name</label>
                  <input 
                    type="text" 
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="e.g. Rahul Singh"
                    className={`w-full px-8 py-5 bg-gray-50 border ${errors.fullName ? 'border-red-500 focus:ring-red-500/5' : 'border-gray-100 focus:ring-[#1B4332]/5'} rounded-2xl focus:outline-none focus:ring-4 focus:border-[#1B4332] transition-all font-bold text-gray-700 placeholder:text-gray-300`}
                  />
                  {errors.fullName && <p className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{errors.fullName}</p>}
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-black tracking-[0.3em] text-gray-300 uppercase ml-1">Email</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className={`w-full px-8 py-5 bg-gray-50 border ${errors.email ? 'border-red-500 focus:ring-red-500/5' : 'border-gray-100 focus:ring-[#1B4332]/5'} rounded-2xl focus:outline-none focus:ring-4 focus:border-[#1B4332] transition-all font-bold text-gray-700 placeholder:text-gray-300`}
                  />
                  {errors.email && <p className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{errors.email}</p>}
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-black tracking-[0.3em] text-gray-300 uppercase ml-1">Message</label>
                  <textarea 
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Your question or message..."
                    className={`w-full px-8 py-5 bg-gray-50 border ${errors.message ? 'border-red-500 focus:ring-red-500/5' : 'border-gray-100 focus:ring-[#1B4332]/5'} rounded-2xl focus:outline-none focus:ring-4 focus:border-[#1B4332] transition-all font-bold text-gray-700 placeholder:text-gray-300 resize-none`}
                  />
                  {errors.message && <p className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{errors.message}</p>}
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-6 ${isSubmitting ? 'bg-gray-100 text-gray-400' : 'bg-[#1B4332] hover:bg-[#2D6A4F] text-white'} rounded-2xl font-black tracking-[0.3em] text-xs uppercase flex items-center justify-center gap-4 transition-all duration-300 shadow-2xl shadow-[#1B4332]/10`}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                  {isSubmitting ? 'SENDING...' : 'SEND MESSAGE'}
                </motion.button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
