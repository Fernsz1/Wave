/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown, ChevronUp, BookOpen, Clock, PlayCircle,
  CheckCircle2, AlertCircle, HelpCircle, ArrowLeft, ArrowRight,
  GraduationCap, Award, Sparkles, Smile, RefreshCw, Calculator, BookOpenCheck
} from 'lucide-react';

function renderSimpleMarkdown(md: string): ReactElement {
  const lines = md.split('\n');
  const elements: ReactElement[] = [];
  let bulletBuffer: string[] = [];
  let k = 0;

  const flush = () => {
    if (!bulletBuffer.length) return;
    elements.push(
      <ul key={k++} className="list-disc pl-5 space-y-1">
        {bulletBuffer.map((b, i) => <li key={i} className="text-sm text-slate-600">{b}</li>)}
      </ul>
    );
    bulletBuffer = [];
  };

  const inline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return <>{parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} className="font-bold text-slate-800">{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>
    )}</>;
  };

  for (const line of lines) {
    if (/^## /.test(line)) {
      flush();
      elements.push(<h2 key={k++} className="text-base font-bold text-slate-900 mt-5 mb-1.5">{line.replace(/^## /, '')}</h2>);
    } else if (/^### /.test(line)) {
      flush();
      elements.push(<h3 key={k++} className="text-sm font-semibold text-slate-800 mt-3 mb-1">{line.replace(/^### /, '')}</h3>);
    } else if (/^- /.test(line)) {
      bulletBuffer.push(line.replace(/^- /, ''));
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      elements.push(<p key={k++} className="text-sm text-slate-600 leading-relaxed">{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{elements}</div>;
}
import { StudentUser, StudentProgress, Lesson, Topic, QuizQuestion, StudentQuizAttempt, TeacherRemediationMaterial } from '../types';

interface StudentLessonsProps {
  student: StudentUser;
  progress: StudentProgress;
  lessons: Lesson[];
  remediationMaterials: TeacherRemediationMaterial[];
  onSaveQuizScore: (topicId: string, lessonId: string, score: number, answers: number[]) => void;
  onSaveSummativeScore: (lessonId: string, score: number) => void;
  onStartRemedial: (material: TeacherRemediationMaterial) => void;
  activeSubject: string;
  setActiveSubject: (sbj: string) => void;
  hasSelectedSubject: boolean;
  setHasSelectedSubject: (selected: boolean) => void;
  navTopicId?: string;
  navViewState?: 'syllabus' | 'reading' | 'quiz' | 'summative';
  clearNavContext?: () => void;
}

export default function StudentLessons({
  student,
  progress,
  lessons,
  remediationMaterials,
  onSaveQuizScore,
  onSaveSummativeScore,
  onStartRemedial,
  activeSubject,
  setActiveSubject,
  hasSelectedSubject,
  setHasSelectedSubject,
  navTopicId,
  navViewState = 'syllabus',
  clearNavContext
}: StudentLessonsProps) {
  const [viewState, setViewState] = useState<'syllabus' | 'reading' | 'quiz' | 'summative' | 'remedial-reading' | 'remedial-quiz'>('syllabus');
  const [activeRemedialMaterial, setActiveRemedialMaterial] = useState<TeacherRemediationMaterial | null>(null);
  const [remedialQuizAnswers, setRemedialQuizAnswers] = useState<number[]>([]);
  const [remedialQuizIdx, setRemedialQuizIdx] = useState(0);
  const [remedialQuizResults, setRemedialQuizResults] = useState<{ correct: number; total: number } | null>(null);
  
  // Selected Contexts
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Active Accordion State
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (lessons && lessons.length > 0) {
      setExpandedLessonId(lessons[0].id);
    }
  }, [lessons]);

  // Handle outside direct navigation
  useEffect(() => {
    if (navTopicId && lessons.length > 0) {
      const foundLesson = lessons.find(l => l.topics.some(t => t.id === navTopicId));
      const foundTopic = foundLesson?.topics.find(t => t.id === navTopicId);
      if (foundTopic && foundLesson) {
        setSelectedTopic(foundTopic);
        setSelectedLessonId(foundLesson.id);
        setViewState(navViewState);
        if (navViewState === 'quiz') {
          setCurrentQuestionIdx(0);
          setUserSelectedAnswers([]);
          setQuizResults(null);
        }
        if (clearNavContext) {
          clearNavContext();
        }
      }
    }
  }, [navTopicId, navViewState, lessons, clearNavContext]);

  // Interactive Quiz Running State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [userSelectedAnswers, setUserSelectedAnswers] = useState<number[]>([]);
  const [quizResults, setQuizResults] = useState<{
    correctCount: number;
    wrongCount: number;
    total: number;
    submitted: boolean;
  } | null>(null);

  // Read-only quiz review mode (entered via "View" button after 3 attempts)
  const [quizReadOnly, setQuizReadOnly] = useState(false);

  // Interactive Summative State
  const [summativeQuestions, setSummativeQuestions] = useState<QuizQuestion[]>([]);
  const [summativeAnswers, setSummativeAnswers] = useState<number[]>([]);
  const [summativeSubmitted, setSummativeSubmitted] = useState<boolean>(false);
  const [summativeScore, setSummativeScore] = useState<number>(0);

  // Remedial packs for this student: section-targeted packs (canonical) reach
  // everyone in the section; legacy packs fall back to per-student targeting.
  const studentSection = student.section || student.gradeLevel;
  const myRemediations = remediationMaterials.filter(
    mat => mat.isPublished && (
      mat.targetSection === studentSection ||
      mat.targetSection?.toLowerCase() === 'all sections' ||
      mat.targetSection === '' ||
      (!mat.targetSection && mat.assignedStudentLrn === student.lrn)
    )
  );

  // Find current and next topic for navigation in the active lesson
  const currentLesson = lessons.find(l => l.id === selectedLessonId) || (selectedTopic ? lessons.find(l => l.topics.some(t => t.id === selectedTopic.id)) : undefined);
  const currentTopicIdx = (currentLesson && selectedTopic) ? currentLesson.topics.findIndex(t => t.id === selectedTopic.id) : -1;
  const nextTopic = (currentLesson && currentTopicIdx !== -1 && currentTopicIdx < currentLesson.topics.length - 1)
    ? currentLesson.topics[currentTopicIdx + 1]
    : null;

  // Open remedial reading view from "Execute Workbook"
  const handleOpenRemedial = (mat: TeacherRemediationMaterial) => {
    setActiveRemedialMaterial(mat);
    setRemedialQuizAnswers([]);
    setRemedialQuizIdx(0);
    setRemedialQuizResults(null);
    setViewState('remedial-reading');
  };

  // Toggle Accordion
  const toggleLesson = (id: string) => {
    setExpandedLessonId(expandedLessonId === id ? null : id);
  };

  // Launch Reading Panel
  const handleOpenReading = (topic: Topic, lessonId: string) => {
    setSelectedTopic(topic);
    setSelectedLessonId(lessonId);
    setViewState('reading');
  };

  // Launch Quiz Engine
  const handleOpenQuiz = (topic: Topic, lessonId: string) => {
    setSelectedTopic(topic);
    setSelectedLessonId(lessonId);
    setCurrentQuestionIdx(0);
    setUserSelectedAnswers([]);
    setQuizResults(null);
    setQuizReadOnly(false);
    setViewState('quiz');
  };

  // Select Option during Quiz
  const handleSelectQuizOption = (optionIdx: number) => {
    const updated = [...userSelectedAnswers];
    updated[currentQuestionIdx] = optionIdx;
    setUserSelectedAnswers(updated);
  };

  // Submit Quiz Action
  const handleSubmitQuiz = () => {
    if (!selectedTopic) return;
    
    let correct = 0;
    selectedTopic.quiz.forEach((q, idx) => {
      if (userSelectedAnswers[idx] === q.correctAnswerIndex) {
        correct++;
      }
    });

    setQuizResults({
      correctCount: correct,
      wrongCount: selectedTopic.quiz.length - correct,
      total: selectedTopic.quiz.length,
      submitted: true
    });

    // Save to global React state
    onSaveQuizScore(selectedTopic.id, selectedLessonId, correct, userSelectedAnswers);
  };

  // View last quiz results (read-only, when topic quiz is locked at 3 attempts)
  const handleViewQuizResults = (topic: Topic, lessonId: string) => {
    const attempt = progress?.quizAttempts?.[topic.id];
    if (!attempt) return;
    setSelectedTopic(topic);
    setSelectedLessonId(lessonId);
    setUserSelectedAnswers(attempt.answers);
    setQuizResults({
      correctCount: attempt.score,
      wrongCount: attempt.perfectScore - attempt.score,
      total: attempt.perfectScore,
      submitted: true,
    });
    setQuizReadOnly(true);
    setViewState('quiz');
  };

  // View last summative result (read-only, when summative is locked at 3 attempts)
  const handleViewSummativeResults = (lesson: Lesson) => {
    const result = progress?.summativeScores?.[lesson.id];
    if (!result) return;
    setSelectedLesson(lesson);
    setSummativeQuestions([]);
    setSummativeScore(result.score);
    setSummativeSubmitted(true);
    setViewState('summative');
  };

  // Launch Summative Assessment on full lesson completion
  const handleOpenSummative = (lesson: Lesson) => {
    const pool = lesson.summative ?? [];
    const questions = pool.slice(0, 20);
    setSelectedLesson(lesson);
    setSummativeQuestions(questions);
    setSummativeAnswers([]);
    setSummativeSubmitted(false);
    setSummativeScore(0);
    setViewState('summative');
  };

  const handleSelectSummativeOption = (qIdx: number, optIdx: number) => {
    const updated = [...summativeAnswers];
    updated[qIdx] = optIdx;
    setSummativeAnswers(updated);
  };

  const handleSubmitSummative = () => {
    if (!selectedLesson) return;
    let correct = 0;
    summativeQuestions.forEach((q, idx) => {
      if (summativeAnswers[idx] === q.correctAnswerIndex) correct++;
    });
    const calcScore = correct; // score is already out of 20
    setSummativeScore(calcScore);
    setSummativeSubmitted(true);
    onSaveSummativeScore(selectedLesson.id, calcScore);
  };

  return (
    <div id="lessons-view-container" className="space-y-6">
      
      {/* ────────────────────────────────────────────────────────── */}
      {/* SYLLABUS DIRECTORY MAP (ACCORDION ROOT) */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewState === 'syllabus' && !hasSelectedSubject && (
        <div className="space-y-8 py-4">
          <div className="text-center max-w-2xl mx-auto space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <span className="bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Class Choice Portal
            </span>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-slate-900 tracking-tight">
              Select Your Active Course Subject
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Explore custom lesson sequences, test your recall strength in chapter quizzes, and track academic milestone achievements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Mathematics */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveSubject('mathematics');
                setHasSelectedSubject(true);
              }}
              className="bg-white border-2 border-slate-100 hover:border-indigo-400 p-6 rounded-3xl text-left shadow-sm hover:shadow-md transition duration-200 group flex flex-col justify-between h-72 relative overflow-hidden w-full cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Calculator className="h-32 w-32 text-indigo-500" />
              </div>
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-slate-900 group-hover:text-indigo-650">Mathematics</h3>
                  <p className="text-xs text-indigo-650 font-bold mt-0.5">Arithmetic & Geometry</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Analyze parts of fractions, decimal values, perimeter boundaries, and 3D solid coordinates.
                </p>
              </div>
              <div className="text-xs font-bold text-indigo-650 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform mt-4">
                Enter Course <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </motion.button>

            {/* Science */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveSubject('science');
                setHasSelectedSubject(true);
              }}
              className="bg-white border-2 border-slate-100 hover:border-emerald-400 p-6 rounded-3xl text-left shadow-sm hover:shadow-md transition duration-200 group flex flex-col justify-between h-72 relative overflow-hidden w-full cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="h-32 w-32 text-emerald-500" />
              </div>
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-650 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-slate-900 group-hover:text-emerald-650">Science</h3>
                  <p className="text-xs text-emerald-650 font-bold mt-0.5">Anatomy & Principles</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Explore respiratory cycles, muscle pairing physics, states of matter, and gas kinetics.
                </p>
              </div>
              <div className="text-xs font-bold text-emerald-655 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform mt-4">
                Enter Course <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </motion.button>

            {/* English */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveSubject('english');
                setHasSelectedSubject(true);
              }}
              className="bg-white border-2 border-slate-100 hover:border-pink-400 p-6 rounded-3xl text-left shadow-sm hover:shadow-md transition duration-200 group flex flex-col justify-between h-72 relative overflow-hidden w-full cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BookOpenCheck className="h-32 w-32 text-pink-500" />
              </div>
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-655 group-hover:bg-pink-600 group-hover:text-white transition-all duration-300">
                  <BookOpenCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-slate-900 group-hover:text-pink-650">English</h3>
                  <p className="text-xs text-pink-650 font-bold mt-0.5">Grammar & Reading</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Identify nouns, tenses, adjectives, antonym properties, and contextual story hints.
                </p>
              </div>
              <div className="text-xs font-bold text-pink-655 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform mt-4">
                Enter Course <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {viewState === 'syllabus' && hasSelectedSubject && (
        <div className="space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
            <div>
              <h1 className="font-display font-bold text-2xl text-slate-900 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-blue-600" /> Syllabus Course Map
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Explore classes, view academic reading structures, and clear assessments to bolster your grades.
              </p>
            </div>
          </div>

          {/* Teacher Remediation Material Shelf (if any published for active LRN) */}
          {myRemediations.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-[#FEF3C7] to-[#FFFBEB] rounded-2xl p-5 border border-amber-200"
            >
              <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 uppercase tracking-wide">
                <Sparkles className="h-4.5 w-4.5 text-amber-600" /> Teacher-Assigned Study Pack
              </h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {myRemediations.map((mat) => (
                  <div key={mat.id} className="bg-white rounded-xl p-4 border border-amber-100 hover:shadow-sm transition-shadow flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-amber-900 mb-1">{mat.title}</h3>
                      <p className="text-[11px] text-amber-700 font-medium mb-2.5">Date: {mat.publishDate}</p>
                      <div className="bg-amber-50 p-2.5 rounded-lg text-[11px] text-amber-800 italic border-l-2 border-amber-500 line-clamp-3">
                        &quot;{mat.teacherNotes}&quot;
                      </div>
                    </div>
                    <button
                      type="button"
                      id={`run-remedial-${mat.id}`}
                      onClick={() => handleOpenRemedial(mat)}
                      className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <GraduationCap className="h-3.5 w-3.5" /> Execute Workbook
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Lessons Accordion List */}
          <div className="space-y-6">
            {lessons.map((lesson, lessonIdx) => {
              // Calculate topic progress for this lesson
              const lessonTopicIds = lesson.topics.map(t => t.id);
              const completedInLesson = lessonTopicIds.filter(id => progress?.completedTopicIds?.includes(id)).length;
              const isLessonCompleted = completedInLesson === lessonTopicIds.length;
              const hasSummative = progress?.summativeScores?.[lesson.id] !== undefined;

              return (
                <div 
                  key={lesson.id} 
                  id={`lesson-${lesson.id}-container`}
                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Premium Expandable Header Module Row */}
                  <div 
                    onClick={() => toggleLesson(lesson.id)}
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-all select-none bg-gradient-to-r from-white via-white to-slate-50/20"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 bg-blue-50/50 border border-blue-100 px-2.5 py-1 rounded-lg">
                          Lesson {lessonIdx + 1}
                        </span>
                        
                        <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg border ${
                          isLessonCompleted 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {completedInLesson} / {lesson.topics.length} Topics Completed
                        </span>
                        
                        {hasSummative && (
                          <span className="text-[10px] bg-indigo-55 text-indigo-700 border border-indigo-150 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider">
                            Summative: {progress.summativeScores[lesson.id].score}/20
                          </span>
                        )}
                      </div>
                      
                      <h2 className="font-display font-medium text-lg text-slate-800 leading-tight">
                        {lesson.title}
                      </h2>
                      <p className="text-xs text-slate-500 line-clamp-2 max-w-2xl">{lesson.description}</p>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center pr-1">
                      <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                        {expandedLessonId === lesson.id ? 'Collapse' : 'Expand'}
                      </span>
                      <div className="p-2 border border-slate-200 bg-white rounded-xl text-slate-500 shadow-sm">
                        {expandedLessonId === lesson.id ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Content with vertical timeline & premium topic cards */}
                  <AnimatePresence>
                    {expandedLessonId === lesson.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-slate-100 bg-slate-50/40"
                      >
                        <div className="p-6 md:p-8 space-y-6">
                          
                          {/* Connected Vertical Timeline container */}
                          <div className="space-y-6">
                            {lesson.topics.map((topic, topicIdx) => {
                              const isCompleted = progress?.completedTopicIds?.includes(topic.id);
                              const lastAttempt = progress?.quizAttempts?.[topic.id];
                              const topicNum = topicIdx + 1;

                              // Calculate status chips
                              let statusText = "Not Started";
                              let statusStyles = "bg-slate-50 text-slate-400 border-slate-150 font-semibold";
                              let statusDot = <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />;

                              if (isCompleted) {
                                const isPerfect = lastAttempt && lastAttempt.score === lastAttempt.perfectScore;
                                if (isPerfect) {
                                  statusText = "Mastered";
                                  statusStyles = "bg-amber-50 text-amber-700 border-amber-200 font-semibold";
                                  statusDot = <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />;
                                } else {
                                  statusText = "Completed";
                                  statusStyles = "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold";
                                  statusDot = <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />;
                                }
                              } else if (lastAttempt) {
                                statusText = "In Progress";
                                statusStyles = "bg-blue-50 text-blue-700 border-blue-200 font-semibold";
                                statusDot = <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />;
                              }

                              // Assessment Component Box Redesign
                              let assessmentBox = null;
                              if (lastAttempt) {
                                const pct = lastAttempt.perfectScore > 0 ? Math.round((lastAttempt.score / lastAttempt.perfectScore) * 100) : 0;
                                const isPassed = pct >= 70;
                                assessmentBox = (
                                  <div className={`p-3 rounded-2xl border flex flex-col justify-center min-w-[130px] text-left ${
                                    isPassed 
                                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' 
                                      : 'bg-blue-50/60 border-blue-200 text-blue-800'
                                  }`}>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pb-0.5">Quiz Score</span>
                                    <div className="flex items-baseline gap-1 mt-0.5">
                                      <span className="text-sm font-black">{lastAttempt.score} / {lastAttempt.perfectScore}</span>
                                      <span className="text-[10px] font-semibold opacity-80">({pct}%)</span>
                                    </div>
                                    <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${isPassed ? 'text-emerald-600' : 'text-blue-600'}`}>
                                      {isPassed ? 'Passed' : 'Completed'}
                                    </span>
                                  </div>
                                );
                              } else {
                                assessmentBox = (
                                  <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 flex flex-col justify-center min-w-[130px] text-left">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pb-0.5">Quiz Score</span>
                                    <span className="text-xs font-semibold mt-0.5">Not Taken</span>
                                    <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Quiz pending</span>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  key={topic.id}
                                  className="relative pl-8 sm:pl-12"
                                >
                                  {/* Segment connector to next item link */}
                                  {topicIdx < lesson.topics.length - 1 && (
                                    <div className="absolute left-[13px] sm:left-[21px] top-7 bottom-[-24px] w-0.5 bg-slate-200" />
                                  )}

                                  {/* Timeline node badge circle */}
                                  <div className={`absolute left-0 sm:left-2.5 top-1.5 w-7.5 h-7.5 rounded-full flex items-center justify-center border-2 bg-white z-10 shadow-sm transition-all ${
                                    isCompleted 
                                      ? 'border-emerald-500 text-emerald-600' 
                                      : lastAttempt 
                                      ? 'border-blue-500 text-blue-500 animate-pulse' 
                                      : 'border-slate-200 text-slate-350'
                                  }`}>
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                      <div className={`h-2 h-2 w-2 rounded-full ${lastAttempt ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                    )}
                                  </div>

                                  {/* Premium topic card layout */}
                                  <div 
                                    id={`topic-card-${topic.id}`}
                                    className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
                                  >
                                    <div className="space-y-2 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
                                          Topic {topicNum}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <div className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 leading-none ${statusStyles}`}>
                                          <span>{statusDot}</span>
                                          <span>{statusText}</span>
                                        </div>
                                      </div>

                                      <h3 id={`topic-name-${topic.id}`} className="text-base font-bold text-slate-800">
                                        {topic.name}
                                      </h3>

                                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                                        {topic.description}
                                      </p>

                                      <div className="flex items-center gap-3 pt-1 text-slate-400">
                                        <span className="flex items-center gap-1 text-xs font-semibold">
                                          ⏱ {topic.readingTime} read
                                        </span>
                                      </div>
                                    </div>

                                    {/* Score display column & controls */}
                                    <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full md:w-auto">
                                      <div className="shrink-0 w-full sm:w-auto">
                                        {assessmentBox}
                                      </div>

                                      {/* Primary Study & Quiz Actions */}
                                      {(() => {
                                        const topicAttempts = progress?.quizAttempts?.[topic.id]?.attempts ?? 0;
                                        const quizLocked = topicAttempts >= 3;
                                        return (
                                          <div className="flex flex-col gap-2 w-full sm:w-36 mr-1">
                                            {/* Study — always available */}
                                            <button
                                              type="button"
                                              id={`read-topic-${topic.id}`}
                                              onClick={() => handleOpenReading(topic, lesson.id)}
                                              className="w-full px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                            >
                                              <BookOpen className="h-3.5 w-3.5" /> Study
                                            </button>

                                            {/* Quiz action — swaps to View at 3 attempts */}
                                            {quizLocked ? (
                                              <button
                                                type="button"
                                                id={`view-quiz-results-${topic.id}`}
                                                onClick={() => handleViewQuizResults(topic, lesson.id)}
                                                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20"
                                              >
                                                <BookOpenCheck className="h-3.5 w-3.5" />
                                                View Result
                                              </button>
                                            ) : (
                                              <div className="flex flex-col gap-1">
                                                <button
                                                  type="button"
                                                  id={`quiz-topic-${topic.id}`}
                                                  onClick={() => handleOpenQuiz(topic, lesson.id)}
                                                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20"
                                                >
                                                  <PlayCircle className="h-3.5 w-3.5" />
                                                  Attempt Quiz
                                                </button>
                                                <p className="text-center text-[10px] text-slate-400 font-medium">
                                                  {topicAttempts}/3 attempts used
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Summative Assessment Row — always visible, locked until all topics done */}
                          <div className="pt-5 border-t border-dashed border-slate-200 sm:pl-12">
                            {isLessonCompleted ? (
                              (() => {
                                const summativeAttempts = progress?.summativeScores?.[lesson.id]?.attempts ?? 0;
                                const summativeLocked = summativeAttempts >= 3;
                                const remedialSummative = myRemediations.find(
                                  m => m.createdSummative && m.createdSummative.length > 0 &&
                                    (!m.targetSubject || m.targetSubject === activeSubject)
                                );
                                return (
                                  <div className="bg-gradient-to-r from-indigo-500/5 via-indigo-500/10 to-transparent p-5 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-5">
                                    <div className="flex items-start gap-3">
                                      <div className={`p-2 rounded-xl shadow-sm shrink-0 ${summativeLocked && !remedialSummative ? 'bg-slate-200 text-slate-400' : 'bg-indigo-100 text-indigo-600'}`}>
                                        <Award className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-bold text-indigo-650 uppercase tracking-widest block mb-0.5">
                                          {summativeLocked ? (remedialSummative ? 'Remedial Assessment Available' : 'Max Attempts Reached') : 'Lesson Complete'}
                                        </span>
                                        <h4 className="text-xs font-bold text-slate-800">
                                          {summativeLocked ? (remedialSummative ? 'Teacher-Generated Summative Ready' : 'Summative Assessment Locked') : 'Summative Assessment Unlocked'}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                          {summativeLocked
                                            ? (remedialSummative
                                                ? 'Your teacher published a remedial summative. Take it after reviewing the remedial lesson.'
                                                : 'You have used all 3 attempts. View your last score below.')
                                            : `Attempt ${summativeAttempts + 1} of 3. Ready to lock in your summative score?`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                                      {summativeLocked ? (
                                        <>
                                          <button
                                            type="button"
                                            id={`view-summative-${lesson.id}`}
                                            onClick={() => handleViewSummativeResults(lesson)}
                                            className="w-full px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm bg-slate-700 text-white hover:bg-slate-800"
                                          >
                                            View
                                          </button>
                                          {remedialSummative && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const questions = remedialSummative.createdSummative!.slice(0, 20);
                                                setSelectedLesson(lesson);
                                                setSummativeQuestions(questions);
                                                setSummativeAnswers([]);
                                                setSummativeSubmitted(false);
                                                setSummativeScore(0);
                                                setViewState('summative');
                                              }}
                                              className="w-full px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm bg-indigo-600 text-white hover:bg-indigo-700"
                                            >
                                              Remedial Summative
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          id={`start-summative-${lesson.id}`}
                                          onClick={() => handleOpenSummative(lesson)}
                                          className={`w-full px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                                            hasSummative
                                              ? 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
                                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/10'
                                          }`}
                                        >
                                          {hasSummative ? 'Re-take Assessment' : 'Attempt Summative (20pts)'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="p-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center gap-4">
                                <div className="p-2 bg-slate-200 rounded-xl text-slate-400 shrink-0">
                                  <Award className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-xs font-bold text-slate-500">Summative Assessment Locked</h4>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Complete all {lesson.topics.length} topic quizzes to unlock — {completedInLesson}/{lesson.topics.length} done.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* COURSERA-STYLE TOPIC CONTENT READING PORTAL */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewState === 'reading' && selectedTopic && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-md"
        >
          {/* Header Bar */}
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              id="back-reading-to-syllabus"
              onClick={() => setViewState('syllabus')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Syllabus map
            </button>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Clock className="h-4.5 w-4.5" /> Read Time: {selectedTopic.readingTime}
            </div>
          </div>

          {/* Reading Layout Body */}
          <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-6">
            <span className="text-[10px] bg-blue-50 border border-blue-150 text-blue-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              Wave Curated Curriculum
            </span>
            
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 mt-2">
              {selectedTopic.name}
            </h1>
            
            <p className="text-slate-600 text-sm leading-relaxed antialiased mt-3">
              {selectedTopic.content.introduction}
            </p>

            {/* Structured Content Sections */}
            <div className="space-y-6 pt-2">
              {selectedTopic.content.sections.map((sect, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="font-display font-semibold text-base text-slate-800">{sect.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{sect.body}</p>
                  
                  {sect.codeExample && (
                    <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner mt-2">
                      <pre>{sect.codeExample}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dictionary Term Definition Callout Box */}
            {selectedTopic.content.definition && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mt-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Academics Lexicon</span>
                <dfn className="not-italic block">
                  <strong className="text-slate-800 text-sm font-semibold">{selectedTopic.content.definition.term}:</strong>
                  <span className="text-slate-600 text-xs ml-1.5 block sm:inline">{selectedTopic.content.definition.meaning}</span>
                </dfn>
              </div>
            )}

            {/* Teacher Important Notes */}
            {selectedTopic.content.importantNote && (
              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-4 rounded-r-xl text-xs leading-relaxed mt-6">
                <strong>Important Terminus Note:</strong> {selectedTopic.content.importantNote}
              </div>
            )}

            {/* Clear Divider */}
            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 flex gap-2.5 max-w-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">Module Key Takeaway</h4>
                  <p className="text-[11px] text-emerald-700 mt-1">{selectedTopic.content.keyTakeaway}</p>
                </div>
              </div>

              <div className="flex gap-3 shrink-0">
                <button
                  type="button"
                  id="quit-reading-study"
                  onClick={() => setViewState('syllabus')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Done Reading
                </button>
                {(() => {
                  const readingAttempts = progress?.quizAttempts?.[selectedTopic.id]?.attempts ?? 0;
                  const readingLocked = readingAttempts >= 3;
                  return readingLocked ? (
                    <button
                      type="button"
                      onClick={() => handleViewQuizResults(selectedTopic, selectedLessonId)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-indigo-500/20"
                    >
                      <BookOpenCheck className="h-4 w-4" />
                      View
                    </button>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        id="jump-to-topic-quiz"
                        onClick={() => handleOpenQuiz(selectedTopic, selectedLessonId)}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-blue-500/20"
                      >
                        Attempt
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <span className="text-[10px] text-slate-400 font-medium pr-0.5">
                        {readingAttempts}/3 attempts used
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MULTIPLE CHOICE AI QUIZ PROCESSOR SCREEN */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewState === 'quiz' && selectedTopic && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-md"
        >
          {/* Header status */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{selectedTopic.name} — Quiz</h2>
              <span className={`text-[11px] font-bold mt-1 ${quizReadOnly ? 'text-indigo-600' : 'text-blue-600'}`}>
                {quizReadOnly ? 'Read-Only Review' : 'AI Evaluated Trial'}
              </span>
            </div>
            <button
              type="button"
              id="exit-quiz-early"
              onClick={() => setViewState('syllabus')}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              {quizReadOnly ? 'Back' : 'Abort'}
            </button>
          </div>

          <div className="p-6 sm:p-10 max-w-2xl mx-auto">
            {/* Progress Bar indicator */}
            {!quizResults?.submitted ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Question {currentQuestionIdx + 1} of {selectedTopic.quiz.length}</span>
                  <span>Accuracy Benchmark</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIdx + 1) / selectedTopic.quiz.length) * 100}%` }}
                  />
                </div>

                {/* Question */}
                <div className="pt-6">
                  <h3 className="font-display font-medium text-base sm:text-lg text-slate-900Leading-relaxed">
                    {selectedTopic.quiz[currentQuestionIdx].question}
                  </h3>
                </div>

                {/* Dynamic Options List */}
                <div className="space-y-3 pt-6">
                  {selectedTopic.quiz[currentQuestionIdx].options.map((opt, optIdx) => {
                    const isSelected = userSelectedAnswers[currentQuestionIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        id={`option-${currentQuestionIdx}-${optIdx}`}
                        onClick={() => handleSelectQuizOption(optIdx)}
                        className={`w-full p-4 rounded-xl text-left text-xs font-medium border transition-all flex items-center justify-between ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-100 shadow-sm' 
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-350'
                        }`}
                      >
                        <span>{opt}</span>
                        <span className={`h-4.5 w-4.5 rounded-full border shrink-0 flex items-center justify-center text-[10px] ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-600 text-white font-bold' 
                            : 'border-slate-300'
                        }`}>
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Footer Controls */}
                <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIdx === 0}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg disabled:opacity-40 select-none"
                  >
                    Previous
                  </button>
                  
                  {currentQuestionIdx < selectedTopic.quiz.length - 1 ? (
                    <button
                      type="button"
                      id="next-question-btn"
                      onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                      disabled={userSelectedAnswers[currentQuestionIdx] === undefined}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow disabled:opacity-40"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="submit-quiz-answers"
                      onClick={handleSubmitQuiz}
                      disabled={userSelectedAnswers[currentQuestionIdx] === undefined}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-500/10 disabled:opacity-40"
                    >
                      Submit Evaluation
                    </button>
                  )}
                </div>
              </div>
            ) : quizReadOnly ? (
              // ── READ-ONLY REVIEW: all questions with color-coded answers ──
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Score banner */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Last Attempt Score</p>
                    <p className="text-2xl font-black text-indigo-900 mt-0.5">
                      {quizResults.correctCount}
                      <span className="text-base font-normal text-indigo-400"> / {quizResults.total}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Percentage</p>
                    <p className="text-2xl font-black text-indigo-700 mt-0.5">
                      {Math.round((quizResults.correctCount / quizResults.total) * 100)}%
                    </p>
                  </div>
                </div>

                {/* All questions read-only */}
                <div className="space-y-5">
                  {selectedTopic.quiz.map((q, qIdx) => {
                    const studentAnswer = userSelectedAnswers[qIdx];
                    const isCorrect = studentAnswer === q.correctAnswerIndex;
                    return (
                      <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        {/* Question header */}
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                            <span className="text-slate-400 font-bold mr-1">Q{qIdx + 1}.</span>
                            {q.question}
                          </p>
                        </div>

                        {/* Options — static, color-coded */}
                        <div className="grid grid-cols-1 gap-2 pl-7">
                          {q.options.map((opt, optIdx) => {
                            const isStudentPick = optIdx === studentAnswer;
                            const isCorrectAnswer = optIdx === q.correctAnswerIndex;
                            let cls = 'bg-white border-slate-200 text-slate-500';
                            let badge = null;
                            if (isCorrectAnswer && isStudentPick) {
                              cls = 'bg-emerald-50 border-emerald-400 text-emerald-800';
                              badge = <span className="ml-auto shrink-0 text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Your answer · Correct</span>;
                            } else if (isStudentPick && !isCorrectAnswer) {
                              cls = 'bg-red-50 border-red-400 text-red-800';
                              badge = <span className="ml-auto shrink-0 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Your answer · Wrong</span>;
                            } else if (isCorrectAnswer) {
                              cls = 'bg-emerald-50 border-emerald-300 text-emerald-700';
                              badge = <span className="ml-auto shrink-0 text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Correct answer</span>;
                            }
                            return (
                              <div key={optIdx} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs ${cls}`}>
                                <span className="font-medium">{opt}</span>
                                {badge}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        {q.explanation && (
                          <p className="pl-7 text-[11px] text-slate-400 italic leading-relaxed border-t border-slate-100 pt-2">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setViewState('syllabus')}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Lesson
                </button>
              </motion.div>
            ) : (
              // ── NORMAL RESULTS SUMMARY (after submitting a live attempt) ──
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="text-center space-y-3">
                  <div className="inline-flex h-16 w-16 bg-blue-50 border border-blue-200 rounded-2xl items-center justify-center text-blue-600 shadow-sm">
                    <Award className="h-9 w-9" />
                  </div>
                  <h1 className="font-display font-medium text-xl text-slate-900">Quiz Completed!</h1>
                  <p className="text-xs text-slate-400">Score saved to your progress record.</p>
                  <div className="pt-3 max-w-xs mx-auto">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-around">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Score</span>
                        <span id="quiz-final-score" className="text-2xl font-black text-slate-800">
                          {quizResults.correctCount} <span className="text-slate-400 text-base font-normal">/ {quizResults.total}</span>
                        </span>
                      </div>
                      <div className="h-8 border-r border-slate-200" />
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Percentage</span>
                        <span className="text-2xl font-black text-blue-600">
                          {Math.round((quizResults.correctCount / quizResults.total) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4 max-w-sm mx-auto">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Evaluation metrics</h3>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-white border border-slate-100 rounded-2xl p-3.5 text-center shadow-sm">
                      <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Correct</span>
                      <span id="quiz-correct-count" className="text-xl font-black text-emerald-700 mt-1 block">{quizResults.correctCount}</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-3.5 text-center shadow-sm">
                      <span className="block text-[10px] font-bold text-red-600 uppercase tracking-wider">Incorrect</span>
                      <span id="quiz-wrong-count" className="text-xl font-black text-red-700 mt-1 block">{quizResults.wrongCount}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs shadow-sm">
                    <span className="font-semibold text-slate-500">Status</span>
                    <span id="quiz-completion-status" className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold uppercase text-[9px] tracking-wider">Completed</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    id="return-to-lesson-btn"
                    onClick={() => setViewState('syllabus')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" /> Return to Lesson
                  </button>
                  {nextTopic && (
                    <button
                      type="button"
                      id="continue-to-next-topic-btn"
                      onClick={() => handleOpenReading(nextTopic, selectedLessonId || (currentLesson ? currentLesson.id : ''))}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-blue-500/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      Continue to Next Topic <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* REMEDIAL LESSON READING VIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewState === 'remedial-reading' && activeRemedialMaterial && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white border border-amber-100 rounded-3xl overflow-hidden shadow-md"
        >
          <div className="p-5 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewState('syllabus')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Syllabus map
            </button>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Teacher-Assigned Remedial</span>
          </div>

          <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-6">
            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              Personalized Remedial Lesson
            </span>

            <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 mt-2">
              {activeRemedialMaterial.title}
            </h1>

            {activeRemedialMaterial.teacherNotes && (
              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-4 rounded-r-xl text-xs leading-relaxed">
                <strong className="block mb-1">Teacher Notes:</strong>
                {activeRemedialMaterial.teacherNotes}
              </div>
            )}

            <div className="pt-2">
              {renderSimpleMarkdown(activeRemedialMaterial.content)}
            </div>

            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setViewState('syllabus')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Done Reading
              </button>
              {activeRemedialMaterial.createdQuiz.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRemedialQuizAnswers([]);
                    setRemedialQuizIdx(0);
                    setRemedialQuizResults(null);
                    setViewState('remedial-quiz');
                  }}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  Take the Quiz <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* REMEDIAL QUIZ VIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewState === 'remedial-quiz' && activeRemedialMaterial && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-amber-100 rounded-3xl overflow-hidden shadow-md"
        >
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider">{activeRemedialMaterial.title} — Quiz</h2>
              <span className="text-[11px] font-bold text-amber-600">Remedial Assessment</span>
            </div>
            <button
              type="button"
              onClick={() => setViewState('remedial-reading')}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Back
            </button>
          </div>

          <div className="p-6 sm:p-10 max-w-2xl mx-auto">
            {!remedialQuizResults ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Question {remedialQuizIdx + 1} of {activeRemedialMaterial.createdQuiz.length}</span>
                  <span>Remedial Quiz</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${((remedialQuizIdx + 1) / activeRemedialMaterial.createdQuiz.length) * 100}%` }}
                  />
                </div>

                <div className="pt-6">
                  <h3 className="font-display font-medium text-base sm:text-lg text-slate-900 leading-relaxed">
                    {activeRemedialMaterial.createdQuiz[remedialQuizIdx].question}
                  </h3>
                </div>

                <div className="space-y-3 pt-6">
                  {activeRemedialMaterial.createdQuiz[remedialQuizIdx].options.map((opt, optIdx) => {
                    const isSelected = remedialQuizAnswers[remedialQuizIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          const updated = [...remedialQuizAnswers];
                          updated[remedialQuizIdx] = optIdx;
                          setRemedialQuizAnswers(updated);
                        }}
                        className={`w-full p-4 rounded-xl text-left text-xs font-medium border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-100 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>{opt}</span>
                        <span className={`h-4 w-4 rounded-full border shrink-0 flex items-center justify-center text-[10px] ${
                          isSelected ? 'border-amber-600 bg-amber-600 text-white font-bold' : 'border-slate-300'
                        }`}>
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setRemedialQuizIdx(prev => Math.max(0, prev - 1))}
                    disabled={remedialQuizIdx === 0}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {remedialQuizIdx < activeRemedialMaterial.createdQuiz.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setRemedialQuizIdx(prev => prev + 1)}
                      disabled={remedialQuizAnswers[remedialQuizIdx] === undefined}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow disabled:opacity-40"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const quiz = activeRemedialMaterial.createdQuiz;
                        let correct = 0;
                        quiz.forEach((q, i) => { if (remedialQuizAnswers[i] === q.correctAnswerIndex) correct++; });
                        setRemedialQuizResults({ correct, total: quiz.length });
                        onSaveQuizScore(
                          activeRemedialMaterial.originalTopicId || activeRemedialMaterial.id,
                          activeRemedialMaterial.id,
                          correct,
                          remedialQuizAnswers,
                        );
                      }}
                      disabled={remedialQuizAnswers[remedialQuizIdx] === undefined}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md disabled:opacity-40"
                    >
                      Submit Quiz
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-center"
              >
                <div className="inline-flex h-16 w-16 bg-amber-50 border border-amber-200 rounded-2xl items-center justify-center text-amber-600 shadow-sm">
                  <Award className="h-9 w-9" />
                </div>
                <h1 className="font-display font-medium text-xl text-slate-900">Remedial Quiz Completed!</h1>

                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl max-w-xs mx-auto flex items-center justify-around">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Score</span>
                    <span className="text-2xl font-black text-slate-800">
                      {remedialQuizResults.correct} <span className="text-slate-400 text-base font-normal">/ {remedialQuizResults.total}</span>
                    </span>
                  </div>
                  <div className="h-8 border-r border-slate-200" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Percentage</span>
                    <span className="text-2xl font-black text-amber-600">
                      {Math.round((remedialQuizResults.correct / remedialQuizResults.total) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Per-question review */}
                <div className="space-y-4 text-left">
                  {activeRemedialMaterial.createdQuiz.map((q, qIdx) => {
                    const studentAnswer = remedialQuizAnswers[qIdx];
                    const isCorrect = studentAnswer === q.correctAnswerIndex;
                    return (
                      <div key={qIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                            <span className="text-slate-400 font-bold mr-1">Q{qIdx + 1}.</span>{q.question}
                          </p>
                        </div>
                        {q.explanation && (
                          <p className="pl-7 text-[11px] text-slate-400 italic leading-relaxed border-t border-slate-100 pt-2">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setViewState('syllabus')}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Syllabus
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* SUMMATIVE LESSON ASSESSMENT SCREEN */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewState === 'summative' && selectedLesson && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-md"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{selectedLesson.title}</h2>
              <span className="text-[11px] text-indigo-700 font-bold mt-1">
                {summativeSubmitted && summativeQuestions.length === 0
                  ? 'Summative Results (View Only)'
                  : 'Summative Milestone Assessment (20pts)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setViewState('syllabus')}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              {summativeSubmitted && summativeQuestions.length === 0 ? 'Back' : 'Abort Final'}
            </button>
          </div>

          <div className="p-6 sm:p-10 max-w-2xl mx-auto space-y-6">
            {!summativeSubmitted ? (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl flex items-start gap-3">
                  <Award className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-indigo-950">Milestone Instructions</h3>
                    <p className="text-[11px] text-indigo-700 mt-1 leading-relaxed">
                      This assessment is aggregated from all topic core questions in {selectedLesson.title} database. Scoring represents 20% of the course final weight profile.
                    </p>
                  </div>
                </div>

                {/* Iterate 20 summative questions */}
                {summativeQuestions.map((q, qIdx) => (
                  <div key={q.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h4 className="text-xs text-slate-500 uppercase font-bold">Question {qIdx + 1}</h4>
                    <p className="font-display font-medium text-sm text-slate-800 leading-normal">{q.question}</p>
                    
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = summativeAnswers[qIdx] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectSummativeOption(qIdx, optIdx)}
                            className={`p-3 rounded-xl text-left text-xs transition border flex items-center justify-between ${
                              isSelected 
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold' 
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            <span>{opt}</span>
                            <span className={`h-4.5 w-4.5 rounded-full border shrink-0 flex items-center justify-center text-[9px] ${
                              isSelected ? 'border-indigo-600 bg-indigo-600 text-white font-bold' : 'border-slate-300'
                            }`}>
                              {isSelected && '✓'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleSubmitSummative}
                  id="submit-summative-btn"
                  disabled={summativeQuestions.some((_, idx) => summativeAnswers[idx] === undefined)}
                  className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-shadow shadow-md shadow-indigo-500/10 disabled:opacity-40"
                >
                  Post Final Answers
                </button>
              </div>
            ) : (
              /* Summative score outcome view */
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl inline-flex items-center justify-center border border-indigo-200 shadow-sm">
                  <Award className="h-9 w-9" />
                </div>
                
                <h1 className="font-display font-medium text-xl text-slate-900">Milestone Assessment Completed!</h1>
                <p className="text-xs text-slate-400">Summative grades compiled into DepEd student record book.</p>

                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl max-w-sm mx-auto flex items-center justify-around">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Scaled Grade</span>
                    <span id="summative-final-score" className="text-3xl font-black text-indigo-950">
                      {summativeScore} <span className="text-slate-400 text-base font-normal">/ 20</span>
                    </span>
                  </div>
                  <div className="h-10 border-r border-slate-200" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Status</span>
                    <span className={`text-sm font-bold block mt-1 uppercase px-2.5 py-0.5 rounded ${
                      summativeScore >= 12 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {summativeScore >= 12 ? 'Passed' : 'Remedial Re-take'}
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-150 p-4.5 rounded-2xl text-left">
                  <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Instructor Feedbacks</h4>
                  <p className="text-[11px] text-indigo-700 leading-relaxed mt-2">
                    {summativeScore >= 15 ? (
                      "Superb execution! Demonstrates strong mastery of arrays sizing mechanics, linked traversers, and stack buffers. Ready for next course unit sequencing."
                    ) : (
                      "A decent milestone score. Some answers show slight confusion regarding pointer references and shifts. Take remedial modules linked on your course screen."
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setViewState('syllabus')}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition"
                >
                  Return to Syllabus
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

    </div>
  );
}
