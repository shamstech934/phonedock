'use client';

import { useState } from 'react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSending(true);
    // Simulate submission
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    setSent(true);
    setForm({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Contact Us</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">Have a question, suggestion, or want to report an error? We&apos;d love to hear from you.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in">
            {[
              { icon: Mail, label: 'Email', value: 'info@phonedock.pk' },
              { icon: Phone, label: 'Phone', value: 'Not available (email preferred)' },
              { icon: MapPin, label: 'Location', value: 'Pakistan' },
            ].map(item => (
              <div key={item.label} className="card-premium p-4 text-center">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <item.icon className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{item.label}</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {sent && (
            <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-4 mb-6 flex items-center gap-3 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Message sent successfully!</p>
                <p className="text-xs text-emerald-700">We&apos;ll get back to you within 24-48 hours.</p>
              </div>
            </div>
          )}

          <div className="card-premium p-6 animate-fade-in">
            <h2 className="font-bold text-lg text-gray-900 mb-4">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Name *</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Email *</label>
                  <input
                    type="email" required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                  placeholder="What's this about?"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Message *</label>
                <textarea
                  required rows={5}
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none"
                  placeholder="Tell us what you need help with..."
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-500/25"
              >
                {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                Send Message
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}