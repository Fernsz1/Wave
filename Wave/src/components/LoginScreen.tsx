/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, LogIn, Sparkles, User, ShieldAlert } from 'lucide-react';
import { StudentUser, TeacherUser, UserRole } from '../types';
import { MOCK_TEACHERS } from '../data';
import WaveLogo from './WaveLogo';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole, user: StudentUser | TeacherUser, presetSubject?: string, presetSection?: string) => void;
  students: StudentUser[];
}

export default function LoginScreen({ onLoginSuccess, students }: LoginScreenProps) {
  const [role, setRole] = useState<UserRole>('student');
  
  // Student inputs
  const [lrn, setLrn] = useState('');
  const [pin, setPin] = useState('');
  
  // Teacher inputs
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  
  // Error handling
  const [error, setError] = useState('');

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role === 'student') {
      const cleanLrn = lrn.trim();
      const cleanPin = pin.trim();

      if (cleanLrn.length !== 12) {
        setError('Learner Reference Number (LRN) must be exactly 12 digits.');
        return;
      }
      if (cleanPin.length !== 6) {
        setError('PIN must be exactly 6 digits.');
        return;
      }
      
      const found = students.find(s => s.lrn === cleanLrn);
      if (found) {
        if (found.pin === cleanPin) {
          onLoginSuccess('student', found);
        } else {
          setError('Incorrect PIN. Please try again.');
        }
      } else {
        setError('Student LRN is not enrolled on this platform. Please contact your teacher to enroll your account.');
      }
    } else {
      if (!teacherId.trim() || !teacherName.trim()) {
        setError('Please enter both your Teacher ID and Name.');
        return;
      }
      
      const found = MOCK_TEACHERS.find(t => t.teacherId === teacherId.trim());
      if (found) {
        onLoginSuccess('teacher', found);
      } else {
        const newTeacher: TeacherUser = {
          teacherId: teacherId.trim(),
          name: teacherName.trim(),
          department: 'General Academics'
        };
        onLoginSuccess('teacher', newTeacher);
      }
    }
  };

  const handleShortcutLogin = (selectedRole: UserRole, identifier: string, presetSubject?: string, presetSection?: string) => {
    setError('');
    if (selectedRole === 'student') {
      const found = students.find(s => s.lrn === identifier);
      if (found) {
        onLoginSuccess('student', found);
      }
    } else {
      const found = MOCK_TEACHERS.find(t => t.teacherId === identifier);
      if (found) {
        onLoginSuccess('teacher', found, presetSubject, presetSection);
      }
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        {/* Header Ribbon with Brand Gradient */}
        <div className="bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#10B981] p-8 text-white relative overflow-hidden">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative flex flex-col items-center">
            <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-xl p-3.5">
              <WaveLogo size={62} />
            </div>
            <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Wave</h1>
            <p className="text-blue-100 text-xs font-medium tracking-wider uppercase text-center flex items-center gap-1.5 justify-center">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> AI-Powered Education Platform
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Authentication Role Selector */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 mb-6">
            <button
              type="button"
              id="student-role-btn"
              onClick={() => { setRole('student'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                role === 'student' 
                  ? 'bg-white text-blue-600 shadow-md border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap">Student Portal</span>
            </button>
            <button
              type="button"
              id="teacher-role-btn"
              onClick={() => { setRole('teacher'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                role === 'teacher' 
                  ? 'bg-white text-blue-600 shadow-md border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap">Teacher Console</span>
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-medium mb-4 flex items-start gap-2"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            {role === 'student' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5" htmlFor="student-lrn">
                    Learner Reference Number (LRN)
                  </label>
                  <input
                    type="text"
                    id="student-lrn"
                    maxLength={12}
                    placeholder="e.g. 101234567891"
                    value={lrn}
                    onChange={(e) => setLrn(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-sm transition-all shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Provide standard 12-digit DepEd LRN</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5" htmlFor="student-pin">
                    6-Digit PIN
                  </label>
                  <input
                    type="password"
                    id="student-pin"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-sm transition-all shadow-inner font-mono tracking-widest"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">6-digit numeric secure code</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5" htmlFor="teacher-id">
                    Teacher ID Number
                  </label>
                  <input
                    type="text"
                    id="teacher-id"
                    placeholder="e.g. T-2026-001"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-sm transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5" htmlFor="teacher-name">
                    Teacher Full Name
                  </label>
                  <input
                    type="text"
                    id="teacher-name"
                    placeholder="e.g. Mrs. Elena Santos"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-sm transition-all shadow-inner"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              id="login-submit-btn"
              className="w-full mt-2 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/10 hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              {role === 'student' ? 'Sign In to Portal' : 'Sign In to Platform'}
            </button>
          </form>

          {/* Quick Demo Shortcuts */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3.5 text-center">
              Quick Demo shortcuts
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                id="dev-login-juan"
                onClick={() => handleShortcutLogin('student', '101234567891')}
                className="w-full bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 p-2.5 rounded-xl text-left text-xs text-slate-600 hover:text-emerald-800 transition-all flex items-center justify-between"
              >
                <span><strong>Student Profile</strong>: Sophia Cruz (Active User / Top Academic Rank)</span>
                <span className="text-[10px] bg-emerald-100/70 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Pass</span>
              </button>

              <button
                type="button"
                id="dev-login-jasmine"
                onClick={() => handleShortcutLogin('student', '101234567900')}
                className="w-full bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 p-2.5 rounded-xl text-left text-xs text-slate-600 hover:text-amber-800 transition-all flex items-center justify-between"
              >
                <span><strong>Student Profile</strong>: Jacob Flores (Flagged for Remedial Material)</span>
                <span className="text-[10px] bg-amber-100 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Alert</span>
              </button>

              <button
                type="button"
                id="dev-login-teacher"
                onClick={() => handleShortcutLogin('teacher', 'T-2026-001')}
                className="w-full bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 p-2.5 rounded-xl text-left text-xs text-slate-600 hover:text-blue-800 transition-all flex items-center justify-between font-sans"
              >
                <span><strong>Teacher Portal</strong>: Mrs. Elena Santos (Coordinator & Assessor)</span>
                <span className="text-[10px] bg-blue-100 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Admin</span>
              </button>

              <button
                type="button"
                id="dev-login-teacher-warning"
                onClick={() => handleShortcutLogin('teacher', 'T-2026-001', 'science', 'Grade 6 - Section Newton')}
                className="w-full bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 p-2.5 rounded-xl text-left text-xs text-slate-600 hover:text-rose-800 transition-all flex items-center justify-between font-sans animate-pulse border-dashed"
              >
                <span><strong>Teacher Warning Demo</strong>: Mrs. Elena Santos (Grade 6 Newton: 28% Failing Alert)</span>
                <span className="text-[10px] bg-rose-150 border border-rose-250 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">28% Fail Alert</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
