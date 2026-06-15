/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert, AlertCircle, BookOpen, RefreshCw } from 'lucide-react';
import { StudentProgress, Lesson } from '../types';

interface StudentProgressRepProps {
  progress: StudentProgress;
  lessons: Lesson[];
  activeSubject: string;
  onNavigateToTopic?: (topicId: string, viewState: 'reading' | 'quiz') => void;
}

export default function StudentProgressRep({ progress, lessons, activeSubject, onNavigateToTopic }: StudentProgressRepProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string>('all');
  
  // Set of topic IDs belonging to this subject for filtering progress & attempt records
  const activeTopicIds = new Set(lessons.flatMap(l => l.topics.map(t => t.id)));

  // Calculate general statistics
  const totalTopicsCount = lessons.reduce((sum, l) => sum + l.topics.length, 0);
  const completedTopicsCount = progress?.completedTopicIds?.filter(id => activeTopicIds.has(id)).length || 0;
  const topicsCompletionPercentage = totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0;

  const totalPossibleQuizzes = lessons.reduce((sum, l) => sum + l.topics.length, 0);
  const completedQuizzesCount = Object.keys(progress?.quizAttempts || {}).filter(id => activeTopicIds.has(id)).length;

  const attemptsList = Object.values(progress?.quizAttempts || {}).filter(att => activeTopicIds.has(att.topicId));
  let totalScore = 0;
  let totalPerfect = 0;
  attemptsList.forEach(att => {
    totalScore += att.score;
    totalPerfect += att.perfectScore;
  });
  const averageQuizGrade = totalPerfect > 0 ? Math.round((totalScore / totalPerfect) * 100) : 0;

  // Compile strengths and areas for improvement
  const strengths: { name: string; score: string }[] = [];
  const weaknesses: { name: string; score: string; originalTopicId: string; lessonId: string; lessonTitle: string }[] = [];

  // Match attempts against topic declarations
  for (const lesson of lessons) {
    for (const topic of lesson.topics) {
      const attempt = progress?.quizAttempts?.[topic.id];
      if (attempt) {
        const pct = Math.round((attempt.score / attempt.perfectScore) * 100);
        if (pct >= 80) {
          strengths.push({ name: topic.name, score: `${pct}%` });
        } else if (pct < 70) {
          weaknesses.push({ 
            name: topic.name, 
            score: `${pct}%`, 
            originalTopicId: topic.id,
            lessonId: lesson.id,
            lessonTitle: lesson.title
          });
        }
      }
    }
  }

  // Fallbacks if list is empty
  if (strengths.length === 0 && completedTopicsCount > 0) {
    strengths.push({ name: "Core Scientific Observation", score: "80%" });
  }
  if (weaknesses.length === 0 && completedTopicsCount > 0) {
    // If they score high on everything
    strengths.push({ name: "Perfect System Identification", score: "100%" });
  }

  // Filter weaknesses based on selected lesson
  const filteredWeaknesses = selectedLessonId === 'all'
    ? weaknesses
    : weaknesses.filter(w => w.lessonId === selectedLessonId);

  return (
    <div id="progress-report-container" className="space-y-6">

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-lexend font-extrabold text-2xl text-slate-900 flex items-center gap-2">
            <span className="text-indigo-600">📊</span> Progress Metrics
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-lexend">
            Take a look at your achievements! Track your lesson completion, view study insights, and discover areas to review.
          </p>
        </div>
      </div>

      {/* Interactive Visualizations Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radial Progress Ring Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.06)] hover:scale-[1.005] transition-all duration-300 flex flex-col items-center justify-center space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center self-start">Course Completion</h3>
          
          <div className="relative h-44 w-44 flex items-center justify-center">
            {/* SVG Arc Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="88"
                cy="88"
                r="70"
                className="stroke-slate-100 fill-none stroke-[10]"
              />
              <circle
                cx="88"
                cy="88"
                r="70"
                className="stroke-blue-600 fill-none stroke-[10] transition-all duration-1000 ease-out"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * topicsCompletionPercentage) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center space-y-0.5">
              <span className="block text-3xl font-black text-slate-800">{topicsCompletionPercentage}%</span>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Completed Topics</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium text-center">
            Completed <strong className="text-slate-800">{completedTopicsCount}</strong> out of <strong className="text-slate-800">{totalTopicsCount}</strong> key topics so far!
          </div>
        </div>

        {/* Bar Score Frequency Chart */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.06)] hover:scale-[1.005] transition-all duration-300 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lesson Progress Breakdown</h3>
          
          <div className="space-y-4 pt-2">
            {lessons.map((lesson) => {
              // Calculate lesson performance score average
              const lessonTopicIds = lesson.topics.map(t => t.id);
              const completedInLesson = lessonTopicIds.filter(id => progress?.completedTopicIds?.includes(id)).length;
              const hasSummative = progress?.summativeScores?.[lesson.id] !== undefined;
              const ratio = lessonTopicIds.length > 0 ? (completedInLesson / lessonTopicIds.length) * 100 : 0;
              
              return (
                <div key={lesson.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span className="truncate max-w-[200px]" title={lesson.title}>{lesson.title}</span>
                    <span className="font-mono">{completedInLesson} / {lesson.topics.length} topics</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    {/* Completion bar */}
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  
                  {hasSummative && (
                    <div className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100/80 px-2.5 py-1 rounded-lg shadow-sm w-fit mt-1.5 flex items-center gap-1">
                      <span>🎯</span> Summative Score: {progress.summativeScores[lesson.id].score} / 20
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Areas of Improvement */}
      <div className="w-full">
        {/* Underperforming Weaknesses Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-amber-805 bg-amber-50 border border-amber-150 px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 w-fit">
              <AlertCircle className="h-4 w-4 text-amber-700 font-bold" /> Topics to Review
            </h3>

            {/* Dropbox / Dropdown Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="lesson-review-filter" className="text-xs font-semibold text-slate-500 tracking-tight">
                Select Lesson:
              </label>
              <select
                id="lesson-review-filter"
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner cursor-pointer"
              >
                <option value="all">All Lessons</option>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {filteredWeaknesses.length > 0 ? (
            <div className="space-y-3">
              {filteredWeaknesses.map((weak, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-100/50 shadow-sm"
                >
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                      {weak.name}
                    </span>
                    <span className="block text-[11px] text-slate-400 font-medium">
                      {weak.lessonTitle}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="font-bold font-mono text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 shadow-sm">
                      Score: {weak.score}
                    </span>
                    
                    {onNavigateToTopic && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigateToTopic(weak.originalTopicId, 'reading')}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Read Study Guide"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Study</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateToTopic(weak.originalTopicId, 'quiz')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-500/10 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Retake Quiz"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Retake Quiz</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedLessonId !== 'all' ? (
            <div className="text-xs text-emerald-700 font-medium py-3">
              Great news! You have no topics to review for this lesson. Keep it up!
            </div>
          ) : completedQuizzesCount > 0 ? (
            <div className="text-xs text-emerald-700 font-medium py-3">
              Wonderful job! All your quiz scores are above 70%. Keep up the fantastic work!
            </div>
          ) : (
            <p className="text-xs text-slate-450 italic">Complete quizzes in your topics to see personalized study recommendations here.</p>
          )}
        </div>
      </div>

    </div>
  );
}
