/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserCheck, ShieldCheck, Phone, Calendar, LogOut, GraduationCap } from 'lucide-react';
import { StudentUser } from '../types';

interface StudentProfileProps {
  student: StudentUser;
  onLogout: () => void;
  activeSubject: string;
}

export default function StudentProfile({ student, onLogout, activeSubject }: StudentProfileProps) {
  return (
    <div id="student-profile-view" className="space-y-6 max-w-xl mx-auto">
      
      {/* Profile Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] text-center flex flex-col items-center space-y-4">
        {/* Avatar badge */}
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#00A2E2] to-[#00B48A] flex items-center justify-center text-white text-3xl font-black font-display shadow-lg ring-4 ring-sky-50">
          {student.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="space-y-1">
          <h2 className="font-display font-bold text-xl text-slate-950">{student.name}</h2>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Student Candidate</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-mono text-xs text-slate-600 font-semibold shadow-inner">
          LRN: {student.lrn}
        </div>
      </div>

      {/* Profile details roster list */}
      <div className="bg-white rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.05)] divide-y divide-slate-100 overflow-hidden">
        {/* Row */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-slate-400" /> Grade Level
          </span>
          <span className="font-bold text-slate-800">{student.gradeLevel}</span>
        </div>

        {/* Row */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-slate-400" /> Focus Course
          </span>
          <span className="font-bold text-indigo-650 capitalize">{activeSubject}</span>
        </div>

        {/* Row */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" /> Platform Security
          </span>
          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wide">
            Verified LRN
          </span>
        </div>

        {/* Row */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-400" /> Notification Contact
          </span>
          <span className="font-mono text-slate-600">+63 912 345 6789</span>
        </div>

        {/* Row */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" /> Enrollment Date
          </span>
          <span className="font-medium text-slate-800">June 1, 2026</span>
        </div>
      </div>

      {/* Logout Action Button */}
      <button
        type="button"
        id="app-logout-btn"
        onClick={onLogout}
        className="w-full py-3.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> Sign Out from Wave
      </button>

    </div>
  );
}
