/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { BookOpen, CheckCircle2, AlertCircle, ArrowRight, UserCheck, Atom, Calculator } from 'lucide-react';
import { motion } from 'motion/react';
import { StudentUser, StudentProgress, Lesson, TeacherRemediationMaterial } from '../types';
import { MOCK_LESSONS_BY_SUBJECT } from '../data';
import WaveLogo from './WaveLogo';

interface StudentHomeProps {
  student: StudentUser;
  progress: StudentProgress;
  lessons: Lesson[];
  remediationMaterials: TeacherRemediationMaterial[];
  onViewTopic: (topicId: string, lessonId: string) => void;
  onTakeQuiz: (topicId: string, lessonId: string) => void;
  onStartRemedial: (material: TeacherRemediationMaterial) => void;
  setActiveTab: (tab: string) => void;
  activeSubject: string;
}

export default function StudentHome({
  student,
  progress,
  lessons,
  remediationMaterials,
  onViewTopic,
  onTakeQuiz,
  onStartRemedial,
  setActiveTab,
  activeSubject
}: StudentHomeProps) {
  
  // Calculate completed lessons stats for overall banner or status
  const completedLessonsCount = lessons.filter(lesson => 
    lesson.topics.every(topic => progress?.completedTopicIds?.includes(topic.id))
  ).length;
  const totalLessons = lessons.length;
  const lessonCompletionPercentage = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 105) : 0;

  // Remedial packs for this student: section-targeted packs (canonical) reach
  // everyone in the section; legacy packs fall back to per-student targeting.
  const studentSection = student.section || student.gradeLevel;
  const myRemediations = remediationMaterials.filter(
    mat => mat.isPublished && (mat.targetSection ? mat.targetSection === studentSection : mat.assignedStudentLrn === student.lrn)
  );

  // Render Lucide Icons dynamically for subjects instead of emojis
  const renderSubjectIcon = (key: string, className = "h-5 w-5") => {
    switch (key) {
      case 'science':
        return <Atom className={className} />;
      case 'mathematics':
        return <Calculator className={className} />;
      case 'english':
      default:
        return <BookOpen className={className} />;
    }
  };

  // Subjects configuration - filtered to only the active session subject
  const subjectsList = [
    { key: 'science', name: 'Science', color: 'from-[#00A2E2] to-[#0185BA]', bg: 'bg-[#00A2E2]/10', text: 'text-[#00A2E2]' },
    { key: 'mathematics', name: 'Mathematics', color: 'from-[#00B48A] to-[#009270]', bg: 'bg-[#00B48A]/10', text: 'text-[#00B48A]' },
    { key: 'english', name: 'English', color: 'from-purple-500 to-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-600' }
  ].filter(s => s.key === activeSubject);

  // Calculate completed lessons stats for each subject
  const subjectStats = subjectsList.map(subject => {
    const subjectLessons = MOCK_LESSONS_BY_SUBJECT[subject.key] || [];
    const completedCount = subjectLessons.filter(lesson => 
      lesson.topics.every(topic => progress?.completedTopicIds?.includes(topic.id))
    ).length;
    const totalCount = subjectLessons.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return {
      ...subject,
      completedCount,
      totalCount,
      percentage
    };
  });

  // Algorithm to suggest the next topic of the current taken lesson for all subjects
  const getNextTopicForSubject = (subjectKey: string) => {
    const subjectLessons = MOCK_LESSONS_BY_SUBJECT[subjectKey] || [];
    
    // 1. Find if there is a "currently taken" lesson in this subject (partially completed)
    let currentLesson = subjectLessons.find(lesson => {
      const completedTopics = lesson.topics.filter(topic => progress?.completedTopicIds?.includes(topic.id));
      return completedTopics.length > 0 && completedTopics.length < lesson.topics.length;
    });

    // 2. Fallback: Find the first lesson that has not been completely finished
    if (!currentLesson) {
      currentLesson = subjectLessons.find(lesson => {
        return !lesson.topics.every(topic => progress?.completedTopicIds?.includes(topic.id));
      });
    }

    // 3. Fallback: Just get the first lesson
    if (!currentLesson && subjectLessons.length > 0) {
      currentLesson = subjectLessons[0];
    }

    if (currentLesson) {
      // Find the first uncompleted topic in the current lesson
      const firstUncompletedTopic = currentLesson.topics.find(topic => !progress?.completedTopicIds?.includes(topic.id));
      if (firstUncompletedTopic) {
        return {
          topicId: firstUncompletedTopic.id,
          lessonId: currentLesson.id,
          name: firstUncompletedTopic.name,
          lessonName: currentLesson.title,
          subjectKey
        };
      }
    }

    return null; // All completed or no lessons found
  };

  return (
    <div className="space-y-6">
      {/* Personalized Welcome Banner with Primary Brand Gradient */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#00A2E2] via-[#008CC4] to-[#00B48A] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        {/* Transparent Brand Logo Watermark */}
        <WaveLogo size={160} className="absolute right-0 bottom-0 translate-y-3.5 translate-x-3.5 opacity-15 pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-wider text-white border border-white/10 flex items-center gap-1.5 w-fit">
              Online Learning Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white">
              Mabuhay, {student.name}!
            </h1>
            <p className="text-blue-50 text-sm max-w-md leading-relaxed font-medium">
              Ready to learn something new today? Continue your lessons, answer quizzes, and discover exciting {activeSubject} topics.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 h-fit text-left shrink-0">
            <span className="block text-[10px] text-blue-200 uppercase font-bold tracking-widest mb-1">LEARNER RECORD</span>
            <div className="text-sm font-semibold tracking-wide">{student.lrn}</div>
            <div className="text-xs text-blue-100 font-bold capitalize mt-0.5">{activeSubject} Course</div>
            <div className="text-xs text-blue-200 mt-0.5">{student.section || student.gradeLevel}</div>
          </div>
        </div>
      </motion.div>

      {/* Flagged AI Remediation Alerts Section */}
      {myRemediations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-amber-55 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex gap-3.5">
            <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Custom Remedial Path Generated</h3>
              <p className="text-xs text-amber-700 mt-1 max-w-xl">
                Your instructor, <strong>Mrs. Elena Santos</strong>, has published a personalized remediation workbook and customized short assessment to address topic struggles.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="start-remedial-btn"
            onClick={() => onStartRemedial(myRemediations[0])}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            Start Remedial Work
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Academic Progress Metrics Grid - Show selected Subject */}
      <div className="space-y-4">
        <h2 className="font-display font-semibold text-base text-slate-800">Academic Progress</h2>
        <div className="grid grid-cols-1 max-w-xl mx-auto gap-4">
          {subjectStats.map(stat => (
            <div 
              key={stat.key}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm shrink-0`}>
                  {renderSubjectIcon(stat.key, "h-5 w-5")}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-450 truncate">{stat.name}</span>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {stat.completedCount} / {stat.totalCount} <span className="text-xs font-medium text-slate-400">lessons</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Completed</span>
                  <span className={stat.text}>{stat.percentage}%</span>
                </div>
                {/* Progress Bar container */}
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${stat.color} rounded-full transition-all duration-500`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggest the next topic of the current taken lesson */}
      <div className="space-y-4">
        <h2 className="font-display font-semibold text-base text-slate-800">Next Lesson Topic</h2>
        
        <div className="grid grid-cols-1 max-w-xl mx-auto gap-4">
          {subjectsList.map(subj => {
            const topicInfo = getNextTopicForSubject(subj.key);
            const stats = subjectStats.find(s => s.key === subj.key);
            
            return (
              <div 
                key={subj.key} 
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-[10px] bg-slate-55 border border-slate-100/80 text-slate-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 shadow-sm">
                      {renderSubjectIcon(subj.key, "h-3.5 w-3.5 " + subj.text)} {subj.name}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      {stats ? `${stats.completedCount}/${stats.totalCount} Done` : ''}
                    </span>
                  </div>
                  
                  {topicInfo ? (
                    <div className="space-y-1 mt-2">
                      <span className={`text-[9px] font-extrabold uppercase tracking-widest ${subj.text}`}>
                        Up Next
                      </span>
                      <h4 className="font-display font-bold text-sm text-slate-800 line-clamp-1">
                        {topicInfo.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
                        {topicInfo.lessonName}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 mt-2 text-emerald-600 flex items-center gap-1.5 py-1">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-xs font-bold">All Topics Mastered!</span>
                    </div>
                  )}
                </div>
                
                {topicInfo && (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewTopic(topicInfo.topicId, topicInfo.lessonId)}
                      className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm text-center"
                    >
                      Read Lesson
                    </button>
                    <button
                      type="button"
                      onClick={() => onTakeQuiz(topicInfo.topicId, topicInfo.lessonId)}
                      className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-705 text-[11px] font-bold rounded-xl border border-slate-200 transition-all text-center"
                    >
                      Quiz
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5">Quick Dashboard Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            id="tab-lessons-btn"
            onClick={() => setActiveTab('lessons')}
            className="p-3.5 bg-slate-55 hover:bg-slate-100 rounded-xl text-left transition-colors border border-slate-100 group flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-slate-700">Browse Full Syllabus</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Browse through all lessons & courses</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            type="button"
            id="tab-rankings-btn"
            onClick={() => setActiveTab('rankings')}
            className="p-3.5 bg-slate-55 hover:bg-slate-100 rounded-xl text-left transition-colors border border-slate-100 group flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-slate-700">Learning Progress</div>
              <div className="text-[10px] text-slate-500 mt-0.5">See your progress and how your class is doing.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
