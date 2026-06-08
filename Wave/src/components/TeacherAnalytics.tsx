/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, Award, TrendingUp, AlertCircle, BookOpen, 
  CheckCircle2, Flame, LineChart, PieChart, ShieldAlert, Sparkles, Star
} from 'lucide-react';
import { MOCK_LESSONS, MOCK_LESSONS_BY_SUBJECT } from '../data';
import { StudentUser } from '../types';

interface TeacherAnalyticsProps {
  progressRecords: Record<string, any>;
  activeSubject: string;
  setActiveSubject: (sbj: string) => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  students: StudentUser[];
}

export default function TeacherAnalytics({ 
  progressRecords,
  activeSubject,
  activeSection,
  students
}: TeacherAnalyticsProps) {
  
  const [selectedTrendLessonId, setSelectedTrendLessonId] = useState<string>('');
  
  const lessons = MOCK_LESSONS_BY_SUBJECT[activeSubject] || MOCK_LESSONS;

  const activeTrendLessonId = !selectedTrendLessonId || !lessons.some(l => l.id === selectedTrendLessonId)
    ? (lessons[0]?.id || '')
    : selectedTrendLessonId;

  // Filter students based on section
  const relevantStudents = activeSection === 'All Sections'
    ? students
    : students.filter(s => s.gradeLevel === activeSection);

  // Compile individual calculations to align with class records
  const studentStats = relevantStudents.map(student => {
    const prog = progressRecords[student.lrn];
    let completedTopicsCount = 0;
    
    const totalTopicsInSyllabus = lessons.flatMap(l => l.topics).length;
    const allTopicIds = new Set(lessons.flatMap(l => l.topics.map(t => t.id)));
    const allLessonIds = new Set(lessons.map(l => l.id));

    // Real data only — no fabricated fallbacks, so a reset reads as genuine zeros.
    completedTopicsCount = prog
      ? prog.completedTopicIds.filter(id => allTopicIds.has(id)).length
      : 0;

    let scoreSum = 0;
    let perfectSum = 0;
    if (prog) {
      Object.values(prog.quizAttempts).forEach((att: any) => {
        if (allTopicIds.has(att.topicId)) { scoreSum += att.score; perfectSum += att.perfectScore; }
      });
    }
    const quizAvg = perfectSum > 0 ? Math.round((scoreSum / perfectSum) * 100) : 0;

    // Summative = average of summatives taken (out of 20), as a percentage.
    const sumList = prog
      ? Object.entries(prog.summativeScores).filter(([lid]) => allLessonIds.has(lid)).map(([, v]: any) => v)
      : [];
    const hasSummative = sumList.length > 0;
    const summativePct = hasSummative
      ? Math.round((sumList.reduce((s: number, v: any) => s + v.score, 0) / sumList.length / 20) * 100)
      : 0;

    // Overall standing: weighted 40/60 when both exist; otherwise the real signal; 0 if none.
    let overallGrade = 0;
    if (perfectSum > 0 && hasSummative) overallGrade = Math.round(quizAvg * 0.4 + summativePct * 0.6);
    else if (perfectSum > 0) overallGrade = quizAvg;
    else if (hasSummative) overallGrade = summativePct;

    const progressPercentage = totalTopicsInSyllabus > 0 ? Math.round((completedTopicsCount / totalTopicsInSyllabus) * 100) : 0;

    return {
      student,
      overallGrade,
      quizAvg,
      completedTopicsCount,
      progressPercentage
    };
  });

  const totalStudents = studentStats.length || 1;
  
  // Calculate top-line metrics
  const cumulativeGrade = studentStats.reduce((sum, s) => sum + s.overallGrade, 0);
  const averageGradeScore = Math.round(cumulativeGrade / totalStudents);

  const passingThreshold = 70; // Filter matching standard DepEd grades
  const passingStudentsCount = studentStats.filter(s => s.overallGrade >= passingThreshold).length;
  const passingRatePercentage = Math.round((passingStudentsCount / totalStudents) * 100);

  // Filter students who require supportive intervention (< 70) matching failuresCount
  const supportThreshold = 70;
  const supportCandidates = studentStats.filter(s => s.overallGrade < supportThreshold);
  const totalStudentsRequiringSupport = supportCandidates.length;

  // Average completion rates
  const cumulativeCompletion = studentStats.reduce((sum, s) => sum + s.progressPercentage, 0);
  const averageLessonCompletionRate = Math.round(cumulativeCompletion / totalStudents);

  const averageAssessmentAccuracyValue = Math.round(
    studentStats.reduce((sum, s) => sum + s.quizAvg, 0) / totalStudents
  );

  let classStandingLabel = "Proficient Section";
  let standingColor = "text-emerald-600 bg-emerald-50 border border-emerald-100";
  if (averageGradeScore >= 85) {
    classStandingLabel = "Superior Section";
    standingColor = "text-blue-700 bg-blue-50 border border-blue-105 border-blue-100";
  } else if (averageGradeScore < 70) {
    classStandingLabel = "Support Target Section";
    standingColor = "text-amber-700 bg-amber-50 border border-amber-100 animate-pulse";
  }

  // Compile topic averages for Trend Visualization
  const topicAverages = lessons.flatMap((lesson, lIdx) => 
    lesson.topics.map((topic, tIdx) => {
      let sum = 0;
      let count = 0;

      Object.values(progressRecords).forEach((prog: any) => {
        // Ensure student exists and matches section
        const studentObj = students.find(s => s.lrn === prog.studentLrn);
        if (!studentObj) return;
        if (activeSection !== 'All Sections' && studentObj.gradeLevel !== activeSection) return;

        const attempt = prog.quizAttempts[topic.id];
        if (attempt) {
          sum += Math.round((attempt.score / attempt.perfectScore) * 100);
          count++;
        }
      });

      // Real class average for this topic, or 0 when no one has attempted it yet.
      const finalAvg = count > 0 ? Math.round(sum / count) : 0;
      return {
        topicId: topic.id,
        topicName: topic.name,
        averageScore: finalAvg
      };
    })
  );

  // Group distributions
  const excellentGradeCount = studentStats.filter(s => s.overallGrade >= 90).length;
  const satisfactoryGradeCount = studentStats.filter(s => s.overallGrade >= 80 && s.overallGrade < 90).length;
  const passingGradeCount = studentStats.filter(s => s.overallGrade >= 70 && s.overallGrade < 80).length;
  const supportGradeCount = studentStats.filter(s => s.overallGrade < 70).length;

  return (
    <div id="analytics-tab-container" className="space-y-8 font-sans">

      {/* 1. Administrative Class Report Profile Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-space font-medium text-2xl tracking-tight text-slate-900 flex items-center gap-2.5">
            <TrendingUp className="h-6 w-6 text-blue-600" /> Administrative Class Report
          </h1>
          <p className="text-sm font-sans text-slate-500 mt-1 max-w-2xl">
            Class performance overview, assessment results, and learning progress indicators. Optimized for DepEd course guidelines.
          </p>
        </div>
      </div>

      {/* 2. Key Metrics Overview */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest block pl-1">
          Key Metrics Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="key-metrics-overview">
          
          {/* Metric Card 1: Total Enrollees */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.02)] transition-shadow duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Enrollees</span>
                <Users className="h-5 w-5 text-blue-500 bg-blue-50 p-1 rounded-lg" />
              </div>
              <div>
                <span className="text-3xl font-black font-sans text-slate-950 tracking-tight">{studentStats.length} Students</span>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed animate-fade-in">
                  Registered learners processed inside the <span className="font-bold text-slate-800">{activeSection}</span> section folder files. Sync holds dynamic enrollment parameters.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Section: {activeSection}</span>
              <span className="text-blue-600 font-bold">Admissions Verified</span>
            </div>
          </div>

          {/* Metric Card 2: Class Average */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.02)] transition-shadow duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Class Average</span>
                <Award className="h-5 w-5 text-indigo-500 bg-indigo-50 p-1 rounded-lg" />
              </div>
              <div>
                <span className="text-3xl font-black font-sans text-indigo-600 tracking-tight">{averageGradeScore}% Rating</span>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Calculated cumulative averages of evaluations including multiple active evaluation quizzes and milestone exam recordings for {studentStats.length} students.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Class Rating Weight: 40/60</span>
              <span className="text-indigo-650 font-bold">Scholastic Standing</span>
            </div>
          </div>

          {/* Metric Card 3: Passing Rate */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.02)] transition-shadow duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Passing Rate</span>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 bg-emerald-50 p-1 rounded-lg" />
              </div>
              <div>
                <span className="text-3xl font-black font-sans text-emerald-700 tracking-tight">{passingRatePercentage}%</span>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Proportion showing learner targets matching passing benchmark scores of 70%+. Currently {passingStudentsCount} of {studentStats.length} pupils have passed.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Threshold Standard: 70%</span>
              <span className="text-emerald-700 font-bold">Compliant Status</span>
            </div>
          </div>

          {/* Metric Card 4: Under Review */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.02)] transition-shadow duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Under Review</span>
                <AlertCircle className={`h-5 w-5 p-1 rounded-lg ${totalStudentsRequiringSupport > 0 ? "text-amber-600 bg-amber-50 animate-pulse" : "text-slate-400 bg-slate-50"}`} />
              </div>
              <div>
                <span className={`text-3xl font-black font-sans tracking-tight ${totalStudentsRequiringSupport > 0 ? "text-amber-600" : "text-slate-950"}`}>{totalStudentsRequiringSupport} Alerts</span>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Count of candidate folders marked for supplementary remedial interventions due to total course grades residing under the standard passing mark of 70%.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Review Standard: &lt;70%</span>
              <span className="text-amber-700 font-bold">Requires Action</span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Class Performance Summary Card group */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest block pl-1">
          Class Performance Summary
        </h2>
        <div className="bg-white rounded-2xl p-6.5 border border-slate-100 shadow-[0_6px_24px_rgba(0,0,0,0.015)] grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Metric Metric block 1 */}
          <div className="space-y-1.5 md:border-r md:border-slate-100 md:pr-6 last:border-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Lesson Completion</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-800">{averageLessonCompletionRate}%</span>
              <span className="text-xs font-medium text-slate-400">Syllabus Complete</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${averageLessonCompletionRate}%` }} />
            </div>
          </div>

          {/* Metric Metric block 2 */}
          <div className="space-y-1.5 md:border-r md:border-slate-100 md:px-6 last:border-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Assessment Score</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-800">{averageAssessmentAccuracyValue}%</span>
              <span className="text-xs font-medium text-slate-500">Correct Average</span>
            </div>
            <div className="h-1.5 w-full bg-slate-105 bg-slate-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-indigo-650 bg-indigo-500 rounded-full" style={{ width: `${averageAssessmentAccuracyValue}%` }} />
            </div>
          </div>

          {/* Metric Metric block 3 */}
          <div className="space-y-1.5 md:pl-6 last:border-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Class Standing</span>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex px-3.5 py-1.5 rounded-full text-xs font-bold leading-normal uppercase tracking-wider ${standingColor}`}>
                {classStandingLabel}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal mt-2">Standing represents enrollees passing threshold benchmarks in school reports.</p>
          </div>

        </div>
      </div>

      {/* 4. Performance Visualizations Dashboard */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest block pl-1">
          Performance Visualizations
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Visualization 1: Score Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.015)] space-y-4.5">
            <div>
              <h3 className="font-medium text-sm text-slate-800 flex items-center gap-1.5">
                <PieChart className="h-4.5 w-4.5 text-blue-600" /> Score Distribution
              </h3>
              <p className="text-[11px] text-slate-400">Class density count across academic grades levels.</p>
            </div>
            
            <div className="space-y-3 pt-1">
              {/* Excellent category */}
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-medium">Excellent (90%+)</span>
                  <span className="font-mono font-bold text-slate-700">{excellentGradeCount} / {totalStudents}</span>
                </div>
                <div className="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-55 bg-emerald-500" style={{ width: `${(excellentGradeCount/totalStudents)*100}%` }} />
                </div>
              </div>
              
              {/* Satisfactory category */}
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-medium">Proficient (80-89%)</span>
                  <span className="font-mono font-bold text-slate-700">{satisfactoryGradeCount} / {totalStudents}</span>
                </div>
                <div className="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(satisfactoryGradeCount/totalStudents)*100}%` }} />
                </div>
              </div>

              {/* Passing Category */}
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-medium">Satisfactory (70-79%)</span>
                  <span className="font-mono font-bold text-slate-700">{passingGradeCount} / {totalStudents}</span>
                </div>
                <div className="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${(passingGradeCount/totalStudents)*100}%` }} />
                </div>
              </div>

              {/* Support Category */}
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-medium">Remedial Target (&lt;70%)</span>
                  <span className="font-mono font-bold text-slate-700">{supportGradeCount} / {totalStudents}</span>
                </div>
                <div className="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${(supportGradeCount/totalStudents)*100}%` }} />
                </div>
              </div>

            </div>
          </div>

          {/* Visualization 2: Assessment Trends timeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.015)] space-y-4">
            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-sm text-slate-800 flex items-center gap-1.5 font-sans justify-between">
                <span className="flex items-center gap-1.5">
                  <LineChart className="h-4.5 w-4.5 text-indigo-500 rounded p-0.5" /> Assessment Trends & Topic Diagnostics
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Consecutive average topic quiz achievements.</p>
              
              {/* Lesson picker filter */}
              <div className="pt-1">
                <select
                  id="trend-lesson-selector"
                  value={activeTrendLessonId}
                  onChange={(e) => setSelectedTrendLessonId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-bold rounded-lg focus:outline-none focus:bg-white focus:border-indigo-500 shadow-sm cursor-pointer"
                >
                  {lessons.map(lesson => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title.split(':')[0]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative pt-2 pl-3 space-y-4 border-l-2 border-slate-100 max-h-[178px] overflow-y-auto">
              {topicAverages.filter(item => {
                const l = lessons.find(les => les.id === activeTrendLessonId);
                return l?.topics.some(t => t.id === item.topicId);
              }).map((trend, index) => {
                const colorCode = trend.averageScore >= 80 ? 'bg-emerald-500' : trend.averageScore >= 70 ? 'bg-blue-500' : 'bg-amber-500';
                return (
                  <div key={trend.topicId} className="relative" id={`trend-topic-${trend.topicId}`}>
                    {/* Circle Node */}
                    <div className={`absolute -left-[17.5px] top-1 h-2.5 w-2.5 rounded-full ${colorCode} ring-4 ring-white shadow-sm`} />
                    <div className="text-xs">
                      <div className="flex justify-between items-center font-medium">
                        <span className="text-slate-750 font-bold truncate max-w-[130px]">{trend.topicName}</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] shadow-sm">
                          {trend.averageScore}% Acc
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Syllabus Step Evaluation {index + 1}</p>
                    </div>
                  </div>
                );
              })}
              {topicAverages.filter(item => {
                const l = lessons.find(les => les.id === activeTrendLessonId);
                return l?.topics.some(t => t.id === item.topicId);
              }).length === 0 && (
                <div className="text-[11px] text-slate-400 font-sans italic pt-2">No topic evaluations registered yet for this selected lesson.</div>
              )}
            </div>
          </div>

          {/* Visualization 3: Completion Rates per Lesson Module */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.015)] space-y-4.5">
            <div>
              <h3 className="font-medium text-sm text-slate-800 flex items-center gap-1.5">
                <Flame className="h-4.5 w-4.5 text-amber-500" /> Completion Rates
              </h3>
              <p className="text-[11px] text-slate-400">Class module syllabus completion alignment percentage.</p>
            </div>

            <div className="space-y-4.5 pt-1.5">
              {lessons.slice(0, 3).map((lesson, index) => {
                // Calculate dynamic completion
                let totalPossibleCompletions = relevantStudents.length * lesson.topics.length || 1;
                let actualCompletions = 0;
                relevantStudents.forEach(student => {
                  const prog = progressRecords[student.lrn];
                  if (prog) {
                    actualCompletions += lesson.topics.filter(t => prog.completedTopicIds.includes(t.id)).length;
                  }
                });

                const completionPercentage = Math.min(100, Math.round((actualCompletions / totalPossibleCompletions) * 100));

                return (
                  <div key={lesson.id} className="text-xs">
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span className="truncate max-w-[150px]">{lesson.title}</span>
                      <span className="text-blue-600 font-mono text-[11px]">
                        {completionPercentage}% Done
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${completionPercentage}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {actualCompletions} of {totalPossibleCompletions} tasks finished by active section
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* 5. Students Requiring Support */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest block pl-1">
          Students Requiring Support
        </h2>
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_12px_44px_rgba(0,0,0,0.02)]">
          {supportCandidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="py-4 px-5">Student Name</th>
                    <th className="py-4 px-4 text-center">Current Grade</th>
                    <th className="py-4 px-4 text-center">Progress Percentage</th>
                    <th className="py-4 px-5">Recommended Intervention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supportCandidates.map((cand) => {
                    // Logic tailored recommended intervention based on standing stats
                    let recommendedTask = "Schedule custom dynamic worksheet remedial generation.";
                    if (cand.quizAvg < 65) {
                      recommendedTask = "Initiate foundational flashcard assessment cycles on core vocabulary.";
                    } else if (cand.progressPercentage < 55) {
                      recommendedTask = "Unlock prerequisite syllabus modules and review draft notes.";
                    }

                    return (
                      <tr key={cand.student.lrn} className="hover:bg-slate-55/20 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-semibold text-slate-800 font-sans flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                          {cand.student.name}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-amber-700">{cand.overallGrade}%</td>
                        <td className="py-4 px-4 text-center font-mono font-medium text-slate-550">{cand.progressPercentage}% Complete</td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 text-slate-650 bg-amber-50/80 px-3 py-1 rounded-lg text-[11px] font-medium border border-amber-100/50">
                            <Star className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                            {recommendedTask}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-white space-y-3">
              <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-semibold text-slate-800">100% Section Success Alignment</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Excellent work! All enrollees in the active class section currently meet or exceed standardized passing criteria targets. No active intervention sessions are flagged.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
