/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Search, Eye, X,
  Award, TrendingUp, AlertCircle, FileBarChart, CheckCircle2, UserCircle
} from 'lucide-react';
import { StudentUser, StudentProgress } from '../types';
import { MOCK_LESSONS, MOCK_LESSONS_BY_SUBJECT } from '../data';

interface TeacherStudentsProps {
  progressRecords: Record<string, StudentProgress>;
  activeSubject: string;
  setActiveSubject: (sbj: string) => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  students: StudentUser[];
  onEnrollStudent: (student: StudentUser) => void;
}

export default function TeacherStudents({
  progressRecords,
  activeSubject,
  setActiveSubject: _setActiveSubject,
  activeSection,
  setActiveSection: _setActiveSection,
  students,
  onEnrollStudent: _onEnrollStudent,
}: TeacherStudentsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);

  // Resolve lessons and topic IDs belonging to this subject
  const currentLessons = MOCK_LESSONS_BY_SUBJECT[activeSubject] || MOCK_LESSONS;
  const activeTopicIds = new Set(currentLessons.flatMap(l => l.topics.map(t => t.id)));
  const activeLessonIds = new Set(currentLessons.map(l => l.id));

  // Consistent section filtering — match against section field, fall back to gradeLevel
  const sectionStudents = activeSection === 'All Sections'
    ? students
    : students.filter(student => (student.section || student.gradeLevel) === activeSection);

  // Compile detailed table rows for enrollees
  const studentsCompiled = sectionStudents.map(student => {
    const prog = progressRecords[student.lrn];
    
    let completedTopics = 0;
    let quizAvg = 0;
    let summativeScore = 0;
    let overallGrade = 0;
    const hasRealProgress = !!prog;

    // Calculate progress per lesson — only from real data
    const activeLessonsProgress = currentLessons.map(lesson => {
      const totalCount = lesson.topics.length;
      const completedCount = prog
        ? lesson.topics.filter(t => prog.completedTopicIds.includes(t.id)).length
        : 0;
      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title.split(':')[0],
        completedCount,
        totalCount
      };
    });

    if (prog) {
      completedTopics = prog.completedTopicIds.filter(id => activeTopicIds.has(id)).length;

      let scoreSum = 0;
      let perfectSum = 0;
      Object.values(prog.quizAttempts).forEach(att => {
        if (activeTopicIds.has(att.topicId)) {
          scoreSum += att.score;
          perfectSum += att.perfectScore;
        }
      });
      if (perfectSum > 0) {
        quizAvg = Math.round((scoreSum / perfectSum) * 100);
      }

      const sumList = Object.entries(prog.summativeScores)
        .filter(([lessonId]) => activeLessonIds.has(lessonId))
        .map(([_, v]) => v);

      if (sumList.length > 0) {
        summativeScore = sumList[0].score;
        const sumPct = Math.round((summativeScore / 20) * 100);
        overallGrade = Math.round(quizAvg * 0.4 + sumPct * 0.6);
      } else if (perfectSum > 0) {
        overallGrade = quizAvg;
      }
    }

    // Determine Status
    let status: 'Passing' | 'Needs Remediation' | 'Needs Assessment' = 'Needs Assessment';
    if (overallGrade >= 70) {
      status = 'Passing';
    } else if (overallGrade > 0) {
      status = 'Needs Remediation';
    }

    // Where the student actually is, by TOPIC completion — mirrors how the
    // student app computes their "current lesson", so both views agree on
    // progress even before a summative is taken.
    const startedLessons = activeLessonsProgress.filter(l => l.completedCount > 0);
    const currentLesson = startedLessons.length > 0
      ? startedLessons[startedLessons.length - 1]
      : activeLessonsProgress[0];
    const currentLessonTopicsDone = !!currentLesson && currentLesson.completedCount === currentLesson.totalCount;
    const currentSummativeTaken = prog
      ? Object.keys(prog.summativeScores).includes(currentLesson?.lessonId ?? '')
      : false;

    return {
      student,
      completedTopics,
      activeLessonsProgress,
      currentLesson,
      currentLessonTopicsDone,
      currentSummativeTaken,
      quizAvg,
      summativeScore,
      overallGrade,
      status,
      hasRealProgress
    };
  });

  // Filter list by searchQuery
  const filteredStudents = studentsCompiled.filter(row => 
    row.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.student.lrn.includes(searchQuery)
  );

  return (
    <div id="class-records-view" className="space-y-6">

      {/* Header section with professional branding */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-space font-medium text-2xl tracking-tight text-slate-900">Academic Records</h1>
          <p className="text-sm font-sans text-slate-500 mt-1 max-w-2xl">
            Browse Learner Reference Numbers, monitor completed topic tallies, and inspect scholastic standing for your active classroom section.
          </p>
        </div>
      </div>



      {/* Premium Multi-Search Bar */}
      <div className="bg-white p-4.5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            type="text"
            id="student-roster-search"
            placeholder="Search student profiles by full name or LRN tracking number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-205/60 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white text-xs transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Academic Records Table Format */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden" id="student-records-table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100/80 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 pl-6">Student Name / LRN</th>
                <th className="p-4 text-center">Quiz Average</th>
                <th className="p-4 text-center">Summative Milestone</th>
                <th className="p-4 text-center">Overall Standing</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/75">
              {filteredStudents.map((row) => {
                const statusColors = {
                  Passing: 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.04)]',
                  'Needs Remediation': 'bg-amber-50 text-amber-700 border border-amber-100 shadow-[0_2px_8px_rgba(245,158,11,0.04)] animate-pulse',
                  'Needs Assessment': 'bg-slate-100 text-slate-500 border border-slate-200'
                };

                return (
                  <tr 
                    key={row.student.lrn} 
                    id={`student-row-${row.student.lrn}`}
                    className="hover:bg-slate-50/40 transition-colors"
                  >
                    {/* Name / LRN */}
                    <td className="p-4 pl-6">
                      <div>
                        <div id={`student-name-row-${row.student.lrn}`} className="font-semibold text-slate-950 text-sm">
                          {row.student.name}
                        </div>
                        <div className="text-[10px] font-mono tracking-wider text-slate-405 mt-0.5">
                          LRN: {row.student.lrn}
                        </div>
                        {row.currentLesson && (
                          <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold">
                            <span className="text-indigo-600">On {row.currentLesson.lessonTitle}</span>
                            {row.hasRealProgress && row.currentLessonTopicsDone && !row.currentSummativeTaken && (
                              <span className="text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide text-[8px] font-extrabold">
                                summative pending
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Quiz Average */}
                    <td className="p-4 text-center font-mono font-bold text-slate-700">
                      {row.quizAvg}%
                    </td>

                    {/* Summative Score */}
                    <td className="p-4 text-center font-mono text-slate-600">
                      {row.summativeScore} / 20
                    </td>

                    {/* Overall Score */}
                    <td className="p-4 text-center font-mono font-black text-blue-600 text-sm">
                      {row.overallGrade}%
                    </td>

                    {/* Status badge */}
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider leading-none shadow-sm ${statusColors[row.status]}`}>
                        {row.status}
                      </span>
                    </td>

                    {/* Actions button group */}
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          id={`inspect-student-${row.student.lrn}`}
                          onClick={() => setSelectedStudent(row.student)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-205/65 text-slate-650 rounded-lg border border-slate-200 transition-all font-semibold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Record
                        </button>
                        
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredStudents.length === 0 && (
          <div className="bg-slate-50/50 rounded-b-2xl p-12 text-center text-slate-400 font-sans italic border-t border-slate-100 shadow-sm">
            No active students matched the filters for {activeSubject} under {activeSection}. Please audit filters.
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DETAILED STUDENT MODAL (DEEP PROFILE WINDOW) */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.12)] max-w-2xl w-full"
          >
            {/* Modal Header */}
            <div className="px-6 py-5.5 bg-gradient-to-br from-blue-700 to-indigo-700 text-white flex items-start justify-between relative shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-100 bg-blue-500/20 px-2.5 py-1 rounded-full">
                  Student Record File
                </span>
                <h3 className="font-display font-medium text-xl mt-1.5">{selectedStudent.name}</h3>
                <p className="text-xs text-blue-150">Learner tracking profile • Grade: {selectedStudent.gradeLevel}</p>
              </div>
              <button
                type="button"
                id="close-student-detail-modal"
                onClick={() => setSelectedStudent(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body with grouped modular card layout */}
            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto bg-slate-50/50">
              
              {/* Card 1: Student Profile */}
              <div className="bg-white p-5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5 text-slate-400" /> Student Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Standard Name</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{selectedStudent.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Learner Reference (LRN)</span>
                    <span className="font-mono text-slate-700 text-sm mt-0.5 block">{selectedStudent.lrn}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Grade Level Allocation</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{selectedStudent.gradeLevel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Academic Course</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block capitalize">{activeSubject} class</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Academic Standing & Progress Overview */}
              {(() => {
                const compileItem = studentsCompiled.find(row => row.student.lrn === selectedStudent.lrn);
                if (!compileItem) return null;
                const totalTopicsCount = currentLessons.reduce((sum, l) => sum + l.topics.length, 0);
                const complPct = totalTopicsCount > 0 ? Math.round((compileItem.completedTopics / totalTopicsCount) * 100) : 0;

                return (
                  <div className="bg-white p-5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FileBarChart className="h-3.5 w-3.5 text-slate-400" /> Academic Performance Status
                    </h4>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50/50 p-3 rounded-xl text-center border border-slate-100">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Overall Achievement</span>
                        <span className="text-lg font-bold font-mono text-blue-600 block mt-1">{compileItem.overallGrade}%</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl text-center border border-slate-100 col-span-2">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Academic Standing</span>
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase mt-2 tracking-wide ${
                          compileItem.status === 'Passing' ? 'bg-emerald-55 bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {compileItem.status}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Course Completion Rate</span>
                        <span className="font-bold">{complPct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                          style={{ width: `${complPct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Completed {compileItem.completedTopics} of {totalTopicsCount} syllabus learning topics.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Card 3: Topic Scores & Assessment Results */}
              <div className="bg-white p-5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-slate-400" /> Topic Assessment Results
                </h4>
                
                {progressRecords[selectedStudent.lrn] ? (
                  <div className="space-y-4">
                    {currentLessons.map((lesson) => {
                      const record = progressRecords[selectedStudent.lrn];
                      const lessonAttempts = Object.values(record.quizAttempts)
                        .filter(att => lesson.topics.some(t => t.id === att.topicId));

                      if (lessonAttempts.length === 0) return null;

                      const topicsDone = lesson.topics.filter(t => record.completedTopicIds.includes(t.id)).length;
                      const topicsTotal = lesson.topics.length;
                      const summativeTaken = Object.keys(record.summativeScores).includes(lesson.id);
                      const topicsComplete = topicsDone === topicsTotal;

                      return (
                        <div key={lesson.id} className="p-3.5 bg-slate-50/50 rounded-xl space-y-2.5 border border-slate-100">
                          <div className="flex items-center justify-between gap-2 border-b border-indigo-100/60 pb-1.5">
                            <span className="font-sans font-bold text-xs text-indigo-900">
                              {lesson.title}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">{topicsDone}/{topicsTotal} topics</span>
                              {summativeTaken ? (
                                <span className="text-[8px] font-extrabold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                                  Summative done
                                </span>
                              ) : topicsComplete ? (
                                <span className="text-[8px] font-extrabold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                                  Summative pending
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {lessonAttempts.map((att) => {
                              let topicObj = lesson.topics.find(t => t.id === att.topicId);
                              return (
                                <div key={att.topicId} className="flex items-center justify-between text-xs py-1 gap-2 border-b border-slate-100/40 last:border-0 pb-1">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-700">{topicObj?.name || att.topicId}</span>
                                    <span className="text-[10px] text-slate-400">Completed: {att.completedAt}</span>
                                  </div>
                                  <span className="font-mono font-bold px-2.5 py-1 rounded-lg text-[11px] shrink-0 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02)] border border-slate-100/80 text-blue-700">
                                    {att.score} / {att.perfectScore} Correct
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl text-center text-slate-400 text-xs italic border border-slate-100 shadow-[inset_0_2px_6px_rgba(0,0,0,0.01)]">
                    No active study attempts registered in local cache. Displaying historical averages.
                  </div>
                )}
              </div>

              {/* Card 4: Summative Assessment */}
              <div className="bg-white p-5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-slate-400" /> Summative Performance Milestone
                </h4>
                {progressRecords[selectedStudent.lrn] && Object.keys(progressRecords[selectedStudent.lrn].summativeScores).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(progressRecords[selectedStudent.lrn].summativeScores).map(([lessonId, scoreObj]) => (
                      <div key={lessonId} className="bg-indigo-50/20 p-4 rounded-xl border border-indigo-100/40">
                        <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                          <span className="font-bold text-slate-800 text-xs">Lesson {lessonId} Final Evaluation</span>
                          <span className="font-mono font-bold text-indigo-700 text-xs bg-indigo-100 px-2.5 py-1 rounded-lg shadow-inner">
                            {scoreObj.score} / {scoreObj.perfectScore} Correct
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-650 italic mt-2 font-medium leading-relaxed">&ldquo;{scoreObj.feedback}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl text-center text-slate-400 text-xs italic border border-slate-100">
                    No summative exams cleared in this semester timeframe.
                  </div>
                )}
              </div>

              {/* Card 5: Teacher Remarks & Instructions */}
              {(() => {
                const compileItem = studentsCompiled.find(row => row.student.lrn === selectedStudent.lrn);
                if (!compileItem) return null;

                const feedbackOptions = compileItem.status === 'Passing' 
                  ? {
                      remark: "Candidate showcases exceptional conceptual grasp on topic quizzes. Perfect alignment for enrichment challenges.",
                      action: "Recommended Action: Approve transition to the next curriculum unit."
                    }
                  : {
                      remark: "Concept gaps have emerged in syllabus modules. Student's analytical performance suggests a remedial worksheet intervention.",
                      action: "Recommended Action: Deploy standard DepEd remedial modules and practice test sheets."
                    };

                return (
                  <div className="bg-white p-5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-slate-400" /> Teacher Remarks
                    </h4>
                    <div className="space-y-2.5">
                      <p className="text-xs text-slate-600 italic bg-slate-50/50 p-3 rounded-xl leading-relaxed border border-slate-100/60">
                        &quot;{feedbackOptions.remark}&quot;
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>{feedbackOptions.action}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Actions Footer */}
            <div className="p-4.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5 shadow-[inner_0_2px_4px_rgba(0,0,0,0.01)]">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-sm border border-slate-200 transition-all cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
