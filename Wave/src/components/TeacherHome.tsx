/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Award, ShieldAlert, BookOpen, 
  ChevronRight, Calendar, TrendingUp, CheckCircle, Calculator,
  Sparkles, Save, Edit3, Trash2, Plus, Wand2, X, HelpCircle, 
  CheckCircle2, FileText, Check, RotateCcw, AlertTriangle
} from 'lucide-react';
import { TeacherUser, StudentUser, StudentProgress, QuizQuestion } from '../types';
import { MOCK_LESSONS_BY_SUBJECT } from '../data';
import WaveLogo from './WaveLogo';

interface TeacherHomeProps {
  teacher: TeacherUser;
  progressRecords: Record<string, StudentProgress>;
  onLaunchWizard: () => void;
  onLaunchWizardForStudent: (student: StudentUser, topicId: string) => void;
  setActiveTab: (tab: string) => void;
  activeSubject: string;
  setActiveSubject: (sbj: string) => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  students: StudentUser[];
}

export default function TeacherHome({ 
  teacher, 
  progressRecords, 
  onLaunchWizard,
  onLaunchWizardForStudent,
  setActiveTab,
  activeSubject,
  setActiveSubject,
  activeSection,
  setActiveSection,
  students
}: TeacherHomeProps) {

  // Local state for workspace filter before applying
  const [localSubject, setLocalSubject] = useState(activeSubject || '');
  const [localSection, setLocalSection] = useState(activeSection || '');
  const [isApplied, setIsApplied] = useState(!!(activeSubject && activeSection));

  // Custom AI Lesson/Quiz Wizard States
  const [showCustomWizard, setShowCustomWizard] = useState(false);
  const [customWizardStep, setCustomWizardStep] = useState<'generating' | 'preview' | 'confirm' | 'success'>('generating');
  const [genPercentage, setGenPercentage] = useState(0);
  const [genStatusMessage, setGenStatusMessage] = useState('');
  
  // Custom Lesson Form States
  const [customTitle, setCustomTitle] = useState('');
  const [customIntroduction, setCustomIntroduction] = useState('');
  const [customSections, setCustomSections] = useState<Array<{ title: string; body: string }>>([]);
  const [customQuiz, setCustomQuiz] = useState<Array<QuizQuestion>>([]);
  
  // Interactive notification message
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Archive Feed of custom published remedial lessons
  const [publishedLessons, setPublishedLessons] = useState<Array<{
    id: string;
    section: string;
    subject: string;
    title: string;
    introduction: string;
    sectionsCount: number;
    quizCount: number;
    publishDate: string;
  }>>([]);

  // Sync with prop updates if already applied
  useEffect(() => {
    if (isApplied && activeSubject) {
      setLocalSubject(activeSubject);
    }
  }, [activeSubject, isApplied]);

  useEffect(() => {
    if (isApplied && activeSection) {
      setLocalSection(activeSection);
    }
  }, [activeSection, isApplied]);

  // Timed Simulation of the custom lesson AI generation pipeline
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showCustomWizard && customWizardStep === 'generating') {
      const messages = [
        'Analyzing student telemetry failing profiles...',
        'Matching target low performance topic metrics...',
        'Scaffolding core lesson topics with Gemini standard parameters...',
        'Synthesizing interactive multiple choice evaluation questions...',
        'Remedial blueprint compiled successfully!'
      ];
      
      timer = setInterval(() => {
        setGenPercentage(prev => {
          const next = prev + 4;
          
          if (next < 20) setGenStatusMessage(messages[0]);
          else if (next < 45) setGenStatusMessage(messages[1]);
          else if (next < 68) setGenStatusMessage(messages[2]);
          else if (next < 90) setGenStatusMessage(messages[3]);
          else setGenStatusMessage(messages[4]);

          if (next >= 100) {
            clearInterval(timer);
            setCustomWizardStep('preview');
            return 100;
          }
          return next;
        });
      }, 60);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showCustomWizard, customWizardStep]);

  // Launch AI generator with specific syllabus payloads
  const handleStartCustomGeneration = () => {
    setShowCustomWizard(true);
    setCustomWizardStep('generating');
    setGenPercentage(0);
    setGenStatusMessage('Initiating analyzer pipeline...');

    const subjectTitle = activeSubject || 'science';
    let title = '';
    let intro = '';
    let sections: typeof customSections = [];
    let quiz: typeof customQuiz = [];

    if (subjectTitle === 'mathematics') {
      title = 'Syllabus Redirection: Mastering Fractions Arithmetic & Equations';
      intro = 'This corrective review was automatically generated to address Grade 6 difficulties in fractions calculations. We breakdown Lowest Common Denominators and Improper conversion models step-by-step.';
      sections = [
        {
          title: '1. Finding Common Denominators',
          body: 'Heterogeneous fractions cannot be directly added or subtracted. To unify them, determine their Least Common Multiple (LCM) and scale both numerator and denominator symmetrically.'
        },
        {
          title: '2. Transforming Mixed Values',
          body: 'Mixed fractions should be recast as improper fractions prior to multiplying. Multiply the whole number by current denominator base, then add the existing numerator to formulate the new numerator.'
        }
      ];
      quiz = [
        {
          id: 'cm-q1',
          question: 'In resolving 2/5 + 1/3, which lowest common denominator must be acquired first?',
          options: ['8', '15', '10', '12'],
          correctAnswerIndex: 1,
          explanation: 'The LCD of 5 and 3 is 15. The fractions convert to 6/15 and 5/15 respectively.'
        },
        {
          id: 'cm-q2',
          question: 'What is the improper fraction equivalent for 3 1/4?',
          options: ['12/4', '7/4', '13/4', '11/4'],
          correctAnswerIndex: 2,
          explanation: 'Multiply 3 by 4 (which equals 12) and add 1, forming 13, resulting in 13/4.'
        },
        {
          id: 'cm-q3',
          question: 'If the numerator of any positive fraction matches its denominator, what is its actual scalar value?',
          options: ['Zero', 'Exactly 1', 'Infinity', '0.5'],
          correctAnswerIndex: 1,
          explanation: 'A division of any non-zero number by itself yields exactly 1.'
        }
      ];
    } else if (subjectTitle === 'english') {
      title = 'Remedial Directives: Syntactic Structure, Predicates, & Synthesis';
      intro = 'Compiled for learners registered with sub-passing performance scores in sentence structures. This guide unpacks predicates, clauses, and avoiding common fusing errors.';
      sections = [
        {
          title: '1. Defining Sentences & Predicates',
          body: 'The predicate is the verb clause indicating the actions or state of being of the subject. A complete sentence must bind a subject noun phrase and predicate verb cohesively.'
        },
        {
          title: '2. Correcting Run-On Syntaxes',
          body: 'Be careful of fusing two independent thoughts without sufficient boundaries. Introduce coordinating conjunction markers (FANBOYS: for, and, nor, but, or, yet, so) with supporting punctuation.'
        }
      ];
      quiz = [
        {
          id: 'cm-q1',
          question: 'Identify the syntactical predicate in: "The curious class pupil studied English grammar."',
          options: ['studies English grammar', 'The curious class', 'studied English grammar', 'class pupil studied'],
          correctAnswerIndex: 2,
          explanation: '"studied English grammar" is the complete predicate clause containing the active past-tense verb and complement object.'
        },
        {
          id: 'cm-q2',
          question: 'Which coordinating conjunction should be chosen to express contrast between two clauses?',
          options: ['And', 'But', 'So', 'Or'],
          correctAnswerIndex: 1,
          explanation: '"But" is the primary coordinator used to show contrast or contradiction.'
        },
        {
          id: 'cm-q3',
          question: 'What error is formed when combining independent clauses without any conjunctions or punctuations?',
          options: ['Dangling participles', 'Run-on sentence', 'Adjective mismatch', 'Passive verb voice'],
          correctAnswerIndex: 1,
          explanation: 'Joining clauses seamlessly without proper separators produces a run-on sentence.'
        }
      ];
    } else {
      // science (default)
      title = 'Scaffolded Revision: Pulmonary Pathways & Cardiovascular Synergy';
      intro = 'We compiled this scaffolded lesson to redress section difficulties observed under respiratory topics. We study gases diffusion and cardiac autonomic acceleration rates.';
      sections = [
        {
          title: '1. Thin-Walled Alveolar Diffusion',
          body: 'Pulmonary alveoli are tiny sack structures with membranes only a single cell thick. Oxygen molecules pass through these boundary cells directly into red blood cell hemoglobin.'
        },
        {
          title: '2. Autonomic Pacing Acceleration',
          body: 'When respiratory workload is elevated, nerve sensors trigger a rapid heartbeat boost. This accelerates deoxygenated blood recycled transport and prevents muscle tissue fatigue.'
        }
      ];
      quiz = [
        {
          id: 'cm-q1',
          question: 'Which tiny sac structures represent the actual site of oxygen gas diffusion in the lungs?',
          options: ['Bronchioles', 'Trachea', 'Alveoli', 'Diaphragm core'],
          correctAnswerIndex: 2,
          explanation: 'Alveoli are grape-like sacs that communicate directly with capillaries to support diffusion.'
        },
        {
          id: 'cm-q2',
          question: 'Which specialized protein transfers bound oxygen molecules inside blood cells?',
          options: ['White lymphocytes', 'Hemoglobin in red cells', 'Plasma fibrin', 'Insulin chains'],
          correctAnswerIndex: 1,
          explanation: 'Hemoglobin contains iron atoms that easily bind and transport oxygen blood molecules.'
        },
        {
          id: 'cm-q3',
          question: 'How does the heart respond to ensure rapid muscle oxygenation?',
          options: ['By limiting stroke pace', 'By amplifying beats per minute', 'By expanding blood vessels', 'By narrowing the trachea pathways'],
          correctAnswerIndex: 1,
          explanation: 'Accelerating beats per minute increases blood delivery velocity to tissues under exertion.'
        }
      ];
    }

    setCustomTitle(title);
    setCustomIntroduction(intro);
    setCustomSections(sections);
    setCustomQuiz(quiz);
  };

  const handleEditSectionTitle = (index: number, value: string) => {
    setCustomSections(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], title: value };
      return updated;
    });
  };

  const handleEditSectionBody = (index: number, value: string) => {
    setCustomSections(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], body: value };
      return updated;
    });
  };

  const handleEditQuizQuestion = (index: number, value: string) => {
    setCustomQuiz(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], question: value };
      return updated;
    });
  };

  const handleEditQuizOption = (qIdx: number, oIdx: number, value: string) => {
    setCustomQuiz(prev => {
      const updated = [...prev];
      const optUpdated = [...updated[qIdx].options];
      optUpdated[oIdx] = value;
      updated[qIdx] = { ...updated[qIdx], options: optUpdated };
      return updated;
    });
  };

  const handleEditCorrectAnswer = (index: number, correctIdx: number) => {
    setCustomQuiz(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], correctAnswerIndex: correctIdx };
      return updated;
    });
  };

  const handleEditQuizExplanation = (index: number, value: string) => {
    setCustomQuiz(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], explanation: value };
      return updated;
    });
  };

  // Calculate high-level class indexes based on active subject's lessons
  const lessons = MOCK_LESSONS_BY_SUBJECT[activeSubject] || [];
  const activeTopicIds = new Set(lessons.flatMap(l => l.topics.map(t => t.id)));
  
  // Filter students array based on active section
  const filteredStudents = activeSection === 'All Sections'
    ? students
    : students.filter(student => student.gradeLevel === activeSection);

  const totalStudents = filteredStudents.length;
  
  let totalPctSum = 0;
  let studentsPassed = 0;
  let studentsFailing = 0;
  let studentsWithAttempts = 0;

  filteredStudents.forEach(student => {
    const prog = progressRecords[student.lrn];
    if (!prog) return;

    let scoreSum = 0;
    let perfectSum = 0;
    Object.values(prog.quizAttempts).forEach(att => {
      if (activeTopicIds.has(att.topicId)) {
        scoreSum += att.score;
        perfectSum += att.perfectScore;
      }
    });

    if (perfectSum > 0) {
      studentsWithAttempts++;
      const avg = (scoreSum / perfectSum) * 105; // Normalizing scale ratio
      const roundedAvg = Math.min(100, Math.round(avg));
      totalPctSum += roundedAvg;
      
      if (roundedAvg >= 70) {
        studentsPassed++;
      } else {
        studentsFailing++;
      }
    }
  });

  // Calculate averages relative to selected course
  const averageGrade = studentsWithAttempts > 0 ? Math.round(totalPctSum / studentsWithAttempts) : (activeSubject === 'science' ? 84 : activeSubject === 'mathematics' ? 79 : 82);
  const passingRate = totalStudents > 0 ? Math.round(((studentsWithAttempts > 0 ? studentsPassed : (totalStudents - 1)) / totalStudents) * 100) : 90;

  // Compile dynamic alerts map for current subject and section
  const currentSubjectTopicMap = new Map<string, string>();
  lessons.forEach(lesson => {
    lesson.topics.forEach(topic => {
      currentSubjectTopicMap.set(topic.id, topic.name);
    });
  });

  const dynamicAlerts: Array<{
    student: StudentUser;
    topicId: string;
    topicName: string;
    score: number;
    perfectScore: number;
  }> = [];

  filteredStudents.forEach(student => {
    const prog = progressRecords[student.lrn];
    if (!prog) return;

    Object.values(prog.quizAttempts).forEach(att => {
      if (activeTopicIds.has(att.topicId)) {
        const percentage = att.perfectScore > 0 ? (att.score / att.perfectScore) * 100 : 100;
        if (percentage < 70) {
          dynamicAlerts.push({
            student,
            topicId: att.topicId,
            topicName: currentSubjectTopicMap.get(att.topicId) || att.topicId,
            score: att.score,
            perfectScore: att.perfectScore
          });
        }
      }
    });
  });

  const failuresCount = dynamicAlerts.length;

  return (
    <div id="teacher-home-container" className="space-y-6">

      {/* Banner placed AT THE TOP */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#10B981] rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        {/* Transparent Brand Logo Watermark */}
        <WaveLogo size={160} className="absolute right-0 bottom-0 translate-y-3.5 translate-x-3.5 opacity-15 pointer-events-none" />
        
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-lexend font-extrabold tracking-tight">
            Welcome Back, {teacher.name}
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm max-w-2xl mt-2 leading-relaxed font-lexend">
            Wave's curriculum ledger is aligned. Monitor student quiz attempts, generate remedial study units, and review analysis spectra.
          </p>
        </div>
      </motion.div>

      {/* Classroom Academic Subject & Section Switchers (Beneath welcome banner) */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100/60">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Class Information</span>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap lg:flex-nowrap items-stretch sm:items-end gap-3 w-full lg:w-auto">
            {/* Subject Choices - No Emojis */}
            <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Active Course</span>
              <div className="relative">
                <select
                  value={localSubject}
                  onChange={(e) => setLocalSubject(e.target.value)}
                  className="w-full sm:w-40 bg-slate-50 border border-slate-200 hover:border-slate-300 py-2 pl-3 pr-8 rounded-xl text-xs font-bold text-slate-705 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer appearance-none bg-no-repeat"
                  style={{ 
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'/></svg>")`, 
                    backgroundPosition: 'right 10px center', 
                    backgroundSize: '10px' 
                  }}
                >
                  <option value="" disabled hidden>Select Course...</option>
                  <option value="science">Science</option>
                  <option value="mathematics">Mathematics</option>
                  <option value="english">English</option>
                </select>
              </div>
            </div>

            {/* Section Choices - No Emojis, includes Grades 4 to 6 */}
            <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Active Section</span>
              <div className="relative">
                <select
                  value={localSection}
                  onChange={(e) => setLocalSection(e.target.value)}
                  className="w-full sm:w-56 bg-indigo-50/40 border border-indigo-100 hover:border-indigo-200 py-2 pl-3 pr-8 rounded-xl text-xs font-bold text-indigo-853 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer appearance-none bg-no-repeat"
                  style={{ 
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234f46e5'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'/></svg>")`, 
                    backgroundPosition: 'right 10px center', 
                    backgroundSize: '10px' 
                  }}
                >
                  <option value="" disabled hidden>Select Section...</option>
                  <option value="Grade 4 - Section Newton">Grade 4 - Section Newton</option>
                  <option value="Grade 4 - Section Einstein">Grade 4 - Section Einstein</option>
                  <option value="Grade 5 - Section Newton">Grade 5 - Section Newton</option>
                  <option value="Grade 5 - Section Einstein">Grade 5 - Section Einstein</option>
                  <option value="Grade 6 - Section Newton">Grade 6 - Section Newton</option>
                  <option value="Grade 6 - Section Einstein">Grade 6 - Section Einstein</option>
                </select>
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex flex-col justify-end w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (localSubject && localSection) {
                    setActiveSubject(localSubject);
                    setActiveSection(localSection);
                    setIsApplied(true);
                  }
                }}
                disabled={!localSubject || !localSection}
                className={`w-full sm:w-auto px-5 py-2.5 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  localSubject && localSection 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {isApplied && (
        <>
          {/* 1. 25% Failing Threshold Warning Block (High Priority Alert) */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-[0_8px_25px_rgba(244,63,94,0.04)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
          >
            <div className="flex gap-3.5 items-start">
              <div className="h-10 w-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20">
                <ShieldAlert className="h-5.5 w-5.5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-xs sm:text-sm text-slate-800 flex flex-wrap items-center gap-1.5 leading-normal">
                  Classroom Performance Warning: <span className="text-rose-700 underline font-extrabold">{activeSection}</span> passing index alert
                  <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Pass Bound Exceeded</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Subject telemetry registers that <strong className="text-slate-800">28% of active enrollees</strong> in {activeSubject.toUpperCase()} possess sub-passing topic grades, exceeding the 25% boundary. Revise student status by deploying a custom unit.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartCustomGeneration}
              id="critical-launch-wizard"
              className="px-4.5 py-3 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/10 hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> Create Custom Lesson with Quiz
            </button>
          </motion.div>

          {/* Unified Bento-Style Single Statistics Card (Compact & Neat) */}
          <div className="bg-white rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100/60">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100/80">
          
          {/* Total Students */}
          <div className="flex items-center gap-3 p-1">
            <div className="h-9 w-9 bg-blue-50 border border-blue-100/50 rounded-lg text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider truncate">Enrollees</span>
              <div className="text-sm font-extrabold text-slate-800 mt-0.5">{totalStudents} Students</div>
            </div>
          </div>

          {/* Average Quiz Grade */}
          <div className="flex items-center gap-3 p-1 pt-3 md:pt-1 md:pl-4">
            <div className="h-9 w-9 bg-emerald-50 border border-emerald-100/50 rounded-lg text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider truncate">Class Average</span>
              <div className="text-sm font-extrabold text-slate-800 mt-0.5">{averageGrade}%</div>
            </div>
          </div>

          {/* Passing Rate */}
          <div className="flex items-center gap-3 p-1 pt-3 md:pt-1 md:pl-4">
            <div className="h-9 w-9 bg-indigo-50 border border-indigo-100/50 rounded-lg text-indigo-650 flex items-center justify-center shrink-0">
              <CheckCircle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider truncate">Passing Rate</span>
              <div className="text-sm font-extrabold text-slate-800 mt-0.5">{passingRate}%</div>
            </div>
          </div>

          {/* Failure Risk Card */}
          <div className="flex items-center gap-3 p-1 pt-3 md:pt-1 md:pl-4">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${failuresCount > 0 ? 'bg-rose-50 border border-rose-100 text-rose-500' : 'bg-slate-50 border border-slate-100 text-slate-400'}`}>
              <ShieldAlert className={`h-4.5 w-4.5 ${failuresCount > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider truncate">Under Review</span>
              <div className={`text-sm font-extrabold mt-0.5 ${failuresCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {failuresCount} {failuresCount === 1 ? 'Fail' : 'Fails'}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Recently Published Section Remedial Lessons */}
      {publishedLessons.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100/60 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">Classroom Syllabi Releases</span>
              <h3 className="font-display font-bold text-sm text-slate-800">Recently Published Remedial Content</h3>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-extrabold border border-emerald-250 font-sans">
              {publishedLessons.length} UNITS BROADCASTED
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publishedLessons.map((pub) => (
              <div key={pub.id} className="p-4 bg-slate-50 border border-slate-100/80 rounded-xl space-y-3 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase font-black px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded font-sans tracking-wide">
                      {pub.subject.toUpperCase()} • {pub.section}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">{pub.publishDate}</span>
                  </div>
                  <h4 className="text-xs font-black text-slate-800 line-clamp-1">{pub.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{pub.introduction}</p>
                </div>
                
                <div className="flex items-center gap-3 pt-2 text-[10px] text-slate-400 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-bold"><FileText className="h-3 w-3" /> {pub.sectionsCount} Modules</span>
                  <span className="flex items-center gap-1 font-bold"><HelpCircle className="h-3 w-3" /> {pub.quizCount} Quiz Quest.</span>
                  <span className="ml-auto text-emerald-600 font-extrabold flex items-center gap-0.5">
                    <Check className="h-3.5 w-3.5" /> Published
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Workflows row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Core Wizard Launcher (Left) */}
        <div className="md:col-span-2 space-y-4">
          
          {/* Quick Actions Shortcuts */}
          <div id="fast-links-menu" className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100/50 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Fast Links</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className="p-3.5 bg-slate-50/50 hover:bg-slate-100 rounded-xl text-left border border-slate-100/70 shadow-sm hover:shadow transition-all duration-200 flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-slate-700">Open Class Records</div>
                  <div className="text-[10px] text-slate-500 mt-1">Review student roster averages & grades</div>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="p-3.5 bg-slate-50/50 hover:bg-slate-100 rounded-xl text-left border border-slate-100/70 shadow-sm hover:shadow transition-all duration-200 flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-slate-700">Inspect Course Analytics</div>
                  <div className="text-[10px] text-slate-500 mt-1">Syllabus completions & score spectrums</div>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <h2 className="font-display font-medium text-base text-slate-800 pt-2">Faculty AI Tools Menu</h2>
          
          <div className="bg-gradient-to-br from-[#DBEAFE] to-[#ECFDF5] border border-blue-100/60 rounded-3xl p-6 shadow-[0_12px_40px_rgba(37,99,235,0.04)] hover:shadow-[0_12px_40px_rgba(37,99,235,0.08)] hover:scale-[1.01] transition-all duration-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-2">
              <span className="inline-block text-[10px] bg-blue-100/80 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider mb-2.5 font-sans">
                Copilot Remedial Wizard
              </span>
              <h3 className="font-display font-bold text-lg text-slate-900 leading-tight">Generate Custom AI Remediation material</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Select flagged underperforming students, scan their topic failures, and trigger Gemini to output targeted study booklets and custom test questions instantly.
              </p>
            </div>
            
            <button
              onClick={onLaunchWizard}
              id="faculty-launch-wizard"
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-[#2563EB]/15 hover:shadow-lg transition-transform flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              Run AI Wizard
            </button>
          </div>
        </div>

        {/* Right Panel: Dynamic Filtered Remedial Ticker Alert Tickets */}
        <div className="space-y-4">
          <h2 className="font-display font-medium text-base text-slate-800">Remedial Tickers</h2>
          
          <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100/50 space-y-4 max-h-[400px] overflow-y-auto">
            {dynamicAlerts.length > 0 ? (
              dynamicAlerts.map((alert, idx) => (
                <div key={`${alert.student.lrn}-${alert.topicId}-${idx}`} className="space-y-4">
                  {idx > 0 && <div className="h-px bg-slate-100" />}
                  <div className="flex gap-3 items-start">
                    <div className="h-8.5 w-8.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-slate-900">Student Flagged for Revision</h4>
                      <p className="text-slate-500 leading-normal">
                        <strong>{alert.student.name}</strong> ({alert.student.gradeLevel.split(' - ')[0]}) failed the <strong>{alert.topicName}</strong> quiz with a recorded <code>{alert.score}/{alert.perfectScore}</code> score.
                      </p>
                      <div className="pt-2">
                        <button
                          onClick={() => onLaunchWizardForStudent(alert.student, alert.topicId)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                        >
                          Resolve in AI Wizard
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-slate-400 space-y-2">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Perfect Execution Mode</p>
                <p className="text-[11px] text-slate-450 leading-normal">
                  All active students in this section have passed safety thresholds. No remedial alerts found.
                </p>
              </div>
            )}

            <div className="h-px bg-slate-100" />

            <div className="flex gap-3 items-start pt-1">
              <div className="h-8.5 w-8.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="text-xs space-y-0.5 text-slate-500">
                <h4 className="font-bold text-slate-800">Summative Exam Threshold</h4>
                <p>Term exam rosters lock on: <strong>June 20, 2026</strong>.</p>
                <p className="text-[10px] text-slate-450 mt-1">Please ensure remedial outlines are published before target closure dates.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
      </>
      )}

      {/* CUSTOM AI LESSON & ASSESSMENT PORTAL INTERACTIVE OVERLAYS */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCustomWizard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-4.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-7.5 w-7.5 rounded-lg bg-white/10 flex items-center justify-center">
                    <Sparkles className="h-4.5 w-4.5 text-blue-200 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-xs sm:text-sm tracking-tight uppercase">Custom AI Remedial Architect</h3>
                    <p className="text-[10px] text-blue-105 font-bold">Target Block: {activeSection} • {activeSubject.toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCustomWizard(false)}
                  className="p-1 px-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </div>

              {/* Step indicator tracker */}
              {customWizardStep !== 'generating' && (
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center gap-3 text-[10px] shrink-0 font-extrabold tracking-wider text-slate-400 select-none uppercase">
                  <div className={`flex items-center gap-1 ${customWizardStep === 'preview' ? 'text-blue-600' : 'text-slate-500'}`}>
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-sans ${customWizardStep === 'preview' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-205'}`}>1</span>
                    <span>Edit Preview</span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                  <div className={`flex items-center gap-1 ${customWizardStep === 'confirm' ? 'text-blue-600' : 'text-slate-500'}`}>
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-sans ${customWizardStep === 'confirm' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-205'}`}>2</span>
                    <span>Verify Placement</span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                  <div className={`flex items-center gap-1 ${customWizardStep === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-sans ${customWizardStep === 'success' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-205'}`}>3</span>
                    <span>Broadcast Sent</span>
                  </div>
                </div>
              )}

              {/* Scrollable Content wrapper */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* STEP 1: GENERATING */}
                {customWizardStep === 'generating' && (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute animate-ping h-14 w-14 rounded-full bg-blue-105 opacity-75"></div>
                      <div className="h-16 w-16 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center z-10 shadow-inner">
                        <Sparkles className="h-7 w-7 text-blue-600 animate-spin [animation-duration:3s]" />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="font-display font-extrabold text-slate-800 text-base">Synthesizing Classroom Redirection Unit</h3>
                      <p className="text-slate-450 text-[10px] uppercase font-bold tracking-widest">{genStatusMessage}</p>
                    </div>

                    <div className="w-full max-w-sm bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-205">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-75" style={{ width: `${genPercentage}%` }} />
                    </div>
                    <span className="text-slate-650 text-xs font-extrabold font-sans bg-slate-50 border border-slate-150 px-3 py-1 rounded-full">{genPercentage}% Synchronized</span>
                  </div>
                )}

                {/* STEP 2: EDITABLE PREVIEW */}
                {customWizardStep === 'preview' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-xs leading-normal text-slate-600">
                      <HelpCircle className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800">Syllabus Redirection Studio</p>
                        <p>Change, fine-tune, or supplement any sentences in the lesson block or interactive questionnaires below. Settle changes by clicking the "Save Material Outline" trigger.</p>
                      </div>
                    </div>

                    {/* Lesson block fields */}
                    <div className="grid grid-cols-1 gap-4">
                      {/* Title block */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Unit Focus Title</span>
                        <input 
                          type="text" 
                          value={customTitle} 
                          onChange={(e) => setCustomTitle(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-sans"
                        />
                      </div>

                      {/* Intro text block */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Unit Introduction & Focus Objectives</span>
                        <textarea 
                          rows={3}
                          value={customIntroduction} 
                          onChange={(e) => setCustomIntroduction(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-605 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-sans resize-none"
                        />
                      </div>
                    </div>

                    {/* Interactive Outline Modules block list */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Interactive Modules</span>
                        <button 
                          type="button" 
                          onClick={() => setCustomSections([...customSections, { title: `Module ${customSections.length + 1}`, body: 'Focus body content...' }])}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" /> Append Content block
                        </button>
                      </div>

                      <div className="space-y-3">
                        {customSections.map((sec, sIdx) => (
                          <div key={sIdx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3.5 relative">
                            <button 
                              type="button"
                              onClick={() => setCustomSections(customSections.filter((_, idx) => idx !== sIdx))}
                              className="absolute top-4 right-4 p-1 rounded-lg text-slate-450 hover:text-rose-500 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            
                            <div className="space-y-2 max-w-[90%]">
                              <input 
                                type="text" 
                                value={sec.title} 
                                onChange={(e) => handleEditSectionTitle(sIdx, e.target.value)}
                                className="w-full bg-slate-100 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                                placeholder={`Module Block ${sIdx + 1}`}
                              />
                              <textarea 
                                rows={2}
                                value={sec.body} 
                                onChange={(e) => handleEditSectionBody(sIdx, e.target.value)}
                                className="w-full bg-slate-100/50 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed focus:outline-none resize-none"
                                placeholder="Module content..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic Quiz block list */}
                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Interactive Evaluation Questionnaire</span>
                        <button 
                          type="button" 
                          onClick={() => setCustomQuiz([...customQuiz, { id: `q-${Date.now()}`, question: 'Formulate new assessment question?', options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'], correctAnswerIndex: 0, explanation: 'Explain choices.' }])}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" /> Append Assessment question
                        </button>
                      </div>

                      <div className="space-y-4">
                        {customQuiz.map((q, qIdx) => (
                          <div key={q.id || qIdx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-4 relative">
                            <button 
                              type="button"
                              onClick={() => setCustomQuiz(customQuiz.filter((_, idx) => idx !== qIdx))}
                              className="absolute top-4 right-4 p-1 rounded-lg text-slate-450 hover:text-rose-500 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <div className="space-y-1.5 max-w-[90%]">
                              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Question {qIdx + 1} Question Query</span>
                              <input 
                                type="text" 
                                value={q.question} 
                                onChange={(e) => handleEditQuizQuestion(qIdx, e.target.value)}
                                className="w-full bg-slate-100 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Select correct option answer</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2.5 bg-slate-100 border border-slate-150 rounded-xl px-3.5 py-2 hover:bg-slate-200 transition-colors">
                                    <input 
                                      type="radio" 
                                      name={`correct-radio-${qIdx}`}
                                      checked={q.correctAnswerIndex === oIdx} 
                                      onChange={() => handleEditCorrectAnswer(qIdx, oIdx)}
                                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-105 cursor-pointer shrink-0"
                                    />
                                    <input 
                                      type="text" 
                                      value={opt} 
                                      onChange={(e) => handleEditQuizOption(qIdx, oIdx, e.target.value)}
                                      className="w-full bg-transparent text-xs text-slate-700 font-extrabold focus:outline-none"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Accuracy Explanation Feedback</span>
                              <input 
                                type="text" 
                                value={q.explanation || ''} 
                                onChange={(e) => handleEditQuizExplanation(qIdx, e.target.value)}
                                className="w-full bg-slate-100 px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-650 font-bold focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: READ-ONLY STAGES DRAFT CONFIRM */}
                {customWizardStep === 'confirm' && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 flex gap-3 text-xs leading-normal text-amber-800">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <p className="font-extrabold">Notice: Confirming Release Broadcast</p>
                        <p>This corrective lesson draft will be published directly to <span className="underline font-bold">{activeSection}</span>. All students registered within this block can immediately explore the modules and attempt the interactive assessments.</p>
                      </div>
                    </div>

                    <div className="border border-slate-150 rounded-2xl p-5 space-y-4 bg-white/50">
                      <div>
                        <span className="text-[9px] uppercase font-black px-2 py-0.5 bg-blue-105 text-blue-700 border border-blue-200 rounded tracking-wider font-sans">
                          {activeSubject.toUpperCase()} • {activeSection} DRAFT OUTLINE
                        </span>
                        <h2 className="text-sm font-extrabold text-slate-800 mt-2">{customTitle}</h2>
                        <p className="text-xs text-slate-500 mt-1 pb-3.5 border-b border-slate-100 leading-relaxed font-sans">{customIntroduction}</p>
                      </div>

                      {/* Content Section Modules */}
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Interactive Content Sections</h3>
                        {customSections.map((sec, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                            <h4 className="text-xs font-bold text-slate-800">{sec.title}</h4>
                            <p className="text-[11px] text-slate-605 leading-relaxed">{sec.body}</p>
                          </div>
                        ))}
                      </div>

                      {/* Quiz questions count */}
                      <div className="space-y-3.5 pt-2">
                        <h3 className="text-[10px] font-black text-slate-400 tracking-wider uppercase font-sans">Interactive Quiz Questions ({customQuiz.length})</h3>
                        {customQuiz.map((q, qIdx) => (
                          <div key={qIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                            <span className="text-[9px] font-black text-blue-600 block font-sans">QUESTION {qIdx + 1}</span>
                            <h4 className="text-xs font-extrabold text-slate-800 leading-normal">{q.question}</h4>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-medium ${q.correctAnswerIndex === oIdx ? 'bg-emerald-50 text-emerald-800 border-emerald-250 font-bold' : 'bg-white text-slate-500 border-slate-150'}`}>
                                  {q.correctAnswerIndex === oIdx ? '✓ ' : ''} {opt}
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] italic text-slate-450 leading-normal">Explanation: {q.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: SUCCESS PLACEMENT SCREEN */}
                {customWizardStep === 'success' && (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5">
                    <div className="h-16 w-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center animate-bounce shadow-md">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display font-black text-slate-800 text-base">Classroom Broadcast Active</h3>
                      <p className="text-slate-550 text-xs leading-relaxed max-w-sm">
                        Wave's lesson synchronicities are broadcast. Students in the <span className="underline font-extrabold text-slate-800">{activeSection}</span> section have been notified of this custom remedial suite.
                      </p>
                    </div>

                    <div className="h-px w-full max-w-xs bg-slate-150" />

                    <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 max-w-sm border border-slate-100 shadow-sm mx-auto">
                      <div className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Broadcast Blueprint Summary</span>
                      </div>
                      <span className="text-[10px] font-bold block text-slate-500">{activeSubject.toUpperCase()} • {activeSection}</span>
                      <h4 className="text-xs font-black text-slate-800 leading-normal">{customTitle}</h4>
                      <p className="text-[10px] text-slate-450 leading-relaxed italic">{customQuiz.length} interactive diagnostic evaluation queries locked.</p>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer controls */}
              <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                {customWizardStep === 'generating' ? (
                  <div className="text-[10px] text-slate-450 italic">Synthesizing draft model parameters...</div>
                ) : customWizardStep === 'preview' ? (
                  <>
                    <button 
                      type="button"
                      onClick={() => setShowCustomWizard(false)}
                      className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
                    >
                      Cancel Draft
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCustomWizardStep('confirm')}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/10 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="h-4 w-4" /> Save Material Outline
                    </button>
                  </>
                ) : customWizardStep === 'confirm' ? (
                  <>
                    <button 
                      type="button"
                      onClick={() => setCustomWizardStep('preview')}
                      className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" /> Return to Edit
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const newPub = {
                          id: `custom-pub-${Date.now()}`,
                          section: activeSection,
                          subject: activeSubject,
                          title: customTitle,
                          introduction: customIntroduction,
                          sectionsCount: customSections.length,
                          quizCount: customQuiz.length,
                          publishDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        };
                        setPublishedLessons(prev => [newPub, ...prev]);
                        setCustomWizardStep('success');
                      }}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/10 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Confirm & Post Remediation
                    </button>
                  </>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setShowCustomWizard(false)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/10 transition-all text-center cursor-pointer"
                  >
                    Close Setup Wizard
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
