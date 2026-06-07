/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShieldAlert, AlertCircle } from 'lucide-react';
import { StudentProgress, Lesson } from '../types';

interface StudentProgressRepProps {
  progress: StudentProgress;
  lessons: Lesson[];
  activeSubject: string;
}

export default function StudentProgressRep({ progress, lessons, activeSubject }: StudentProgressRepProps) {
  
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
  const weaknesses: { name: string; score: string; originalTopicId: string }[] = [];

  // Match attempts against topic declarations
  for (const lesson of lessons) {
    for (const topic of lesson.topics) {
      const attempt = progress?.quizAttempts?.[topic.id];
      if (attempt) {
        const pct = Math.round((attempt.score / attempt.perfectScore) * 100);
        if (pct >= 80) {
          strengths.push({ name: topic.name, score: `${pct}%` });
        } else if (pct < 70) {
          weaknesses.push({ name: topic.name, score: `${pct}%`, originalTopicId: topic.id });
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center space-y-4">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
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
                      className="h-full bg-blue-500 rounded-l-full transition-all duration-500"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  
                  {hasSummative && (
                    <div className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md w-fit">
                      Summative Score: {progress.summativeScores[lesson.id].score} / 20
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Areas of Improvement */}
      <div className="max-w-2xl">
        {/* Underperforming Weaknesses Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-amber-805 bg-amber-50 border border-amber-150 px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <AlertCircle className="h-4 w-4 text-amber-700 font-bold" /> Topics to Review
          </h3>
          
          {weaknesses.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {weaknesses.map((weak, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    {weak.name}
                  </span>
                  <span className="font-bold font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{weak.score}</span>
                </div>
              ))}
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
