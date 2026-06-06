/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserCheck, ShieldCheck, Mail, Calendar, LogOut, Award } from 'lucide-react';
import { TeacherUser } from '../types';

interface TeacherProfileProps {
  teacher: TeacherUser;
  onLogout: () => void;
  activeSubject: string;
  activeSection: string;
}

export default function TeacherProfile({ teacher, onLogout, activeSubject, activeSection }: TeacherProfileProps) {
  return (
    <div id="teacher-profile-view" className="space-y-6 max-w-xl mx-auto">
      
      {/* Profile Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] text-center flex flex-col items-center space-y-4">
        {/* Avatar badge */}
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-3xl font-black font-display shadow-lg ring-4 ring-indigo-50">
          {teacher.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="space-y-1">
          <h2 className="font-display font-bold text-xl text-slate-950">{teacher.name}</h2>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{teacher.department}</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-mono text-xs text-slate-600 font-semibold shadow-inner">
          ID: {teacher.teacherId}
        </div>
      </div>

      {/* Profile details roster list */}
      <div className="bg-white rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.05)] divide-y divide-slate-100 overflow-hidden">
        {/* Row: Active Course Section */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-slate-405" /> Current Course
          </span>
          <span className="font-bold text-indigo-650 capitalize">{activeSubject}</span>
        </div>

        {/* Row: Active Section */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Award className="h-4 w-4 text-slate-405" /> Teaching Section
          </span>
          <span className="font-bold text-slate-700">{activeSection}</span>
        </div>

        {/* Row: Status Verification badge */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-405" /> Teacher Verification
          </span>
          <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-150 uppercase tracking-wide">
            Staff Verified LRN Assessor
          </span>
        </div>

        {/* Row: Notification contact */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-405" /> Portal Contact
          </span>
          <span className="font-mono text-slate-600">elena.santos@deped.gov.ph</span>
        </div>

        {/* Row: Date updated */}
        <div className="p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-405" /> Active Session Date
          </span>
          <span className="font-medium text-slate-850">June 6, 2026</span>
        </div>
      </div>

      {/* Logout Action Button */}
      <button
        type="button"
        id="app-logout-btn"
        onClick={onLogout}
        className="w-full py-3.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
      >
        <LogOut className="h-4 w-4" /> Sign Out from Wave Portal
      </button>

    </div>
  );
}
