import React, { useState, useEffect } from 'react';
import { Layers, Clock, CheckCircle2, CalendarOff, Target, ListChecks, Award, X, Info } from 'lucide-react';
import { Stats, Project } from '../types';
import {
  calculateTasksProgressForProject,
  calculateKpisProgressForProject,
  calculateYearMilestonesProgressForProject,
  calculateYearKpisProgressForProject,
  calculateSelectedQuarterMilestonesProgressForProject,
  calculateSelectedQuarterKpiProgressForProject
} from '../utils/projectCalculations';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface OverviewProps {
  stats: Stats;
  projects: Project[];
}

export const Overview: React.FC<OverviewProps> = ({ stats, projects }) => {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [activeZoomChart, setActiveZoomChart] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(2);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveZoomChart(null);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isMobile = windowWidth < 768;

  // 1) Status calculations strictly representing the stage field: "Планируется", "В работе", "На паузе", "Завершен"
  let plannedCount = 0;
  let inWorkCount = 0;
  let onPauseCount = 0;
  let completedCount = 0;

  projects.forEach((p) => {
    const rawStage = (p.stage || "").trim();
    if (rawStage === "Планируется") plannedCount++;
    else if (rawStage === "В работе") inWorkCount++;
    else if (rawStage === "На паузе") onPauseCount++;
    else if (rawStage === "Завершен") completedCount++;
    else {
      // Fallback mappings
      if (p.status === "completed") completedCount++;
      else if (p.status === "active") inWorkCount++;
      else if (rawStage.toLowerCase().includes("пауз")) onPauseCount++;
      else if (rawStage.toLowerCase().includes("работ")) inWorkCount++;
      else if (rawStage.toLowerCase().includes("план")) plannedCount++;
      else if (rawStage.toLowerCase().includes("заверш")) completedCount++;
      else plannedCount++;
    }
  });

  const missingMonitoringCount = projects.filter(
    p => !p.lastPcDate || p.lastPcDate.trim() === "" || p.lastPcDate.trim().toLowerCase() === "nan"
  ).length;

  const taskProgresses = projects.map(calculateTasksProgressForProject);
  const avgTaskProgress = taskProgresses.length > 0 
    ? taskProgresses.reduce((sum, p) => sum + p, 0) / taskProgresses.length 
    : 0;

  const kpiProgressVals = projects.map(calculateKpisProgressForProject).filter((v): v is number => v !== null);
  const avgKpiProgress = kpiProgressVals.length > 0 
    ? kpiProgressVals.reduce((sum, p) => sum + p, 0) / kpiProgressVals.length
    : 0;

  const selectedMilestonesVals = projects
    .map(p => calculateSelectedQuarterMilestonesProgressForProject(p, selectedQuarter))
    .filter((v): v is number => v !== null);
  const avgSelectedMilestonesProgress = selectedMilestonesVals.length > 0
    ? selectedMilestonesVals.reduce((sum, v) => sum + v, 0) / selectedMilestonesVals.length
    : 0;

  const selectedKpiVals = projects
    .map(p => calculateSelectedQuarterKpiProgressForProject(p, selectedQuarter))
    .filter((v): v is number => v !== null);
  const avgSelectedKpiProgress = selectedKpiVals.length > 0
    ? selectedKpiVals.reduce((sum, v) => sum + v, 0) / selectedKpiVals.length
    : 0;

  const yearMilestonesVals = projects.map(calculateYearMilestonesProgressForProject).filter((v): v is number => v !== null);
  const avgYearMilestonesProgress = yearMilestonesVals.length > 0
    ? yearMilestonesVals.reduce((sum, v) => sum + v, 0) / yearMilestonesVals.length
    : 0;

  const yearKpiVals = projects.map(calculateYearKpisProgressForProject).filter((v): v is number => v !== null);
  const avgYearKpiProgress = yearKpiVals.length > 0 
    ? yearKpiVals.reduce((sum, v) => sum + v, 0) / yearKpiVals.length
    : 0;

  // Pie Chart 1: Structure by Statuses
  const statusChartData = [
    { name: 'Планируется', value: plannedCount, color: '#3b82f6' },
    { name: 'В работе', value: inWorkCount, color: '#fbbf24' },
    { name: 'На паузе', value: onPauseCount, color: '#9ca3af' },
    { name: 'Завершен', value: completedCount, color: '#10b981' }
  ].filter(d => d.value > 0);

  // Pie Chart 2: Project Priorities
  let p0count = 0;
  let p1count = 0;
  let p2count = 0;

  projects.forEach((p) => {
    const rawPriority = p.priority;
    if (rawPriority === 0 || rawPriority === "0") p0count++;
    else if (rawPriority === 1 || rawPriority === "1") p1count++;
    else p2count++; // default/safe-fallback to 2
  });

  const priorityChartData = [
    { name: 'Нулевой приоритет (0)', value: p0count, color: '#111827' },
    { name: 'Первый приоритет (1)', value: p1count, color: '#fbbf24' },
    { name: 'Второй приоритет (2)', value: p2count, color: '#cbd5e1' }
  ].filter(d => d.value > 0);

  // --- DEPARTMENT ANALYTICS ACCUMULATION ---
  const deptDataMap: Record<string, {
    department: string;
    shortName: string;
    p0: number;
    p1: number;
    p2: number;
    stagePlanned: number;
    stageInWork: number;
    stageOnPause: number;
    stageCompleted: number;
    timely: number;
    overdue: number;
    tasksProgressSum: number;
    tasksProgressCount: number;
    kpiProgressSum: number;
    kpiProgressCount: number;
  }> = {};

  projects.forEach((p) => {
    const deptString = (p.department || "").trim();
    const depts = deptString === "" ? ["Не указано"] : deptString.split(";").map(s => s.trim()).filter(Boolean);
    
    depts.forEach((deptKey) => {
      if (!deptDataMap[deptKey]) {
        // Create short department name for fallback tick display
        let short = deptKey;
        if (short.includes(":")) {
          short = short.split(":")[1].trim();
        }
        if (short.length > 20) {
          short = short.substring(0, 18) + "...";
        }

        deptDataMap[deptKey] = {
          department: deptKey,
          shortName: short,
          p0: 0,
          p1: 0,
          p2: 0,
          stagePlanned: 0,
          stageInWork: 0,
          stageOnPause: 0,
          stageCompleted: 0,
          timely: 0,
          overdue: 0,
          tasksProgressSum: 0,
          tasksProgressCount: 0,
          kpiProgressSum: 0,
          kpiProgressCount: 0
        };
      }

      const item = deptDataMap[deptKey];

      // 1) Priorities count
      const rawPriority = p.priority;
      if (rawPriority === 0 || rawPriority === "0") {
        item.p0++;
      } else if (rawPriority === 1 || rawPriority === "1") {
        item.p1++;
      } else {
        item.p2++;
      }

      // 2) Stage counts
      const rawStage = (p.stage || "").trim();
      if (rawStage === "Планируется") {
        item.stagePlanned++;
      } else if (rawStage === "В работе") {
        item.stageInWork++;
      } else if (rawStage === "На паузе") {
        item.stageOnPause++;
      } else if (rawStage === "Завершен") {
        item.stageCompleted++;
      } else {
        // Fallback
        if (p.status === "completed") item.stageCompleted++;
        else if (p.status === "active") item.stageInWork++;
        else if (rawStage.toLowerCase().includes("пауз")) item.stageOnPause++;
        else if (rawStage.toLowerCase().includes("работ")) item.stageInWork++;
        else if (rawStage.toLowerCase().includes("план")) item.stagePlanned++;
        else if (rawStage.toLowerCase().includes("заверш")) item.stageCompleted++;
        else item.stagePlanned++;
      }

      // 3) Timeliness counts
      const pcStatus = p._metrics?.pcStatus;
      if (pcStatus === "Своевременно") {
        item.timely++;
      } else if (pcStatus === "Просрочен") {
        item.overdue++;
      }

      // 4) Tasks Progress Accumulation
      item.tasksProgressSum += calculateTasksProgressForProject(p);
      item.tasksProgressCount++;

      // 5) KPI Progress Accumulation
      const kpiProg = calculateKpisProgressForProject(p);
      if (kpiProg !== null) {
        item.kpiProgressSum += kpiProg;
        item.kpiProgressCount++;
      }
    });
  });

  const chartDataList = Object.values(deptDataMap).map(item => ({
    ...item,
    avgTasksProgress: item.tasksProgressCount > 0 ? Number((item.tasksProgressSum / item.tasksProgressCount).toFixed(1)) : 0,
    avgKpiProgress: item.kpiProgressCount > 0 ? Number((item.kpiProgressSum / item.kpiProgressCount).toFixed(1)) : 0
  }));

  // Common Tooltips
  const CustomPrioTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const deptName = payload[0].payload.department;
      return (
        <div id="prio-chart-tooltip" className="bg-white p-3.5 rounded-2xl shadow-xl border border-gray-100 text-xs font-semibold space-y-1.5 min-w-[210px] z-50">
          <p className="font-extrabold text-slate-800 mb-1 border-b border-gray-50 pb-1">{deptName}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-gray-500 font-medium">{p.name}:</span>
              </div>
              <span className="font-extrabold text-slate-950">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomStageTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const deptName = payload[0].payload.department;
      return (
        <div id="stage-chart-tooltip" className="bg-white p-3.5 rounded-2xl shadow-xl border border-gray-100 text-xs font-semibold space-y-1.5 min-w-[210px] z-50">
          <p className="font-extrabold text-slate-800 mb-1 border-b border-gray-50 pb-1">{deptName}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-gray-500 font-medium">{p.name}:</span>
              </div>
              <span className="font-extrabold text-slate-950">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomMonitorTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const deptName = payload[0].payload.department;
      return (
        <div id="monitor-chart-tooltip" className="bg-white p-3.5 rounded-2xl shadow-xl border border-gray-100 text-xs font-semibold space-y-1.5 min-w-[210px] z-50">
          <p className="font-extrabold text-slate-800 mb-1 border-b border-gray-50 pb-1">{deptName}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-gray-500 font-medium">{p.name}:</span>
              </div>
              <span className="font-extrabold text-slate-950">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomProgressTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const deptName = payload[0].payload.department;
      return (
        <div id="progress-chart-tooltip" className="bg-white p-3.5 rounded-2xl shadow-xl border border-gray-100 text-xs font-semibold space-y-1.5 min-w-[210px] z-50">
          <p className="font-extrabold text-slate-800 mb-1 border-b border-gray-50 pb-1">{deptName}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-gray-500 font-medium">{p.name}:</span>
              </div>
              <span className="font-extrabold text-slate-950">{p.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="portfolio-overview-container" className="space-y-6 print:space-y-4 fade-in">
      
      {/* 1) Horizontal line of 5 independent large cards */}
      <div id="overview-metrics-grid-5" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Card 1: Всего проектов */}
        <div id="card-total-projects" className="bg-white p-6 rounded-3xl shadow-xs border border-gray-100 flex flex-col justify-between transition-all hover:shadow-sm h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none">Всего проектов</span>
            <div className="p-2.5 rounded-xl bg-gray-50 text-gray-700">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-950 leading-none">{projects.length}</h2>
          </div>
        </div>

        {/* Card 2: Планируется */}
        <div id="card-planned-stage" className="bg-[#eff6ff] p-6 rounded-3xl shadow-xs border border-blue-100 flex flex-col justify-between transition-all hover:shadow-sm h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest leading-none">Планируется</span>
            <div className="p-2.5 rounded-xl bg-blue-100/60 text-blue-600">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-950 leading-none">{plannedCount}</h2>
          </div>
        </div>

        {/* Card 3: В работе */}
        <div id="card-active-stage" className="bg-[#fef9c3] p-6 rounded-3xl shadow-xs border border-yellow-200 flex flex-col justify-between transition-all hover:shadow-sm h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-yellow-700 uppercase tracking-widest leading-none">В работе</span>
            <div className="p-2.5 rounded-xl bg-yellow-100 text-yellow-700">
              <Target size={18} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-950 leading-none">{inWorkCount}</h2>
          </div>
        </div>

        {/* Card 4: На паузе */}
        <div id="card-paused-stage" className="bg-[#f3f4f6] p-6 rounded-3xl shadow-xs border border-gray-200 flex flex-col justify-between transition-all hover:shadow-sm h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none">На паузе</span>
            <div className="p-2.5 rounded-xl bg-gray-200/60 text-gray-600">
              <CalendarOff size={18} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-950 leading-none">{onPauseCount}</h2>
          </div>
        </div>

        {/* Card 5: Завершен */}
        <div id="card-completed-stage" className="bg-[#f0fdf4] p-6 rounded-3xl shadow-xs border border-emerald-100 flex flex-col justify-between transition-all hover:shadow-sm h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest leading-none">Завершен</span>
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-950 leading-none">{completedCount}</h2>
          </div>
        </div>

      </div>

      {/* 2) Secondary row containing "Прогресс портфеля" properties */}
      <div id="overview-metrics-grid-secondary" className="grid grid-cols-1 gap-6 pt-1 font-sans">
        
        {/* Card Right: Прогресс портфеля с исправленным текстом и масштабным дизайном */}
        <div id="card-progress-rates" className="bg-white p-8 rounded-3xl shadow-xs border border-gray-100 grid grid-cols-1 lg:grid-cols-12 gap-8 transition-all hover:shadow-sm">
          
          {/* Left Column (Management block) */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <Target size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Реноме компании</span>
                  <h3 className="text-xl font-black text-slate-900 leading-none">Прогресс портфеля</h3>
                </div>
              </div>
              <p className="text-sm text-gray-500 font-medium mt-1 leading-relaxed">
                Сводные показатели завершенности по всем проектам компании на текущий отчетный период.
              </p>
            </div>
            
            {/* Quarter Switcher */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Выберите отчетный период:</span>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit shrink-0">
                {[1, 2, 3, 4].map((q) => (
                  <button
                    key={q}
                    id={`btn-select-q${q}`}
                    onClick={() => setSelectedQuarter(q)}
                    className={`px-4.5 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      selectedQuarter === q
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    Q{q}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Right Column (Metrics Block) */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            
            {/* Group 1: Квартальный отчет (Операционный трек) */}
            <div id="progress-group-quarter" className="bg-slate-50/40 p-5 rounded-3xl border border-slate-200/50 flex flex-col gap-4 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
                <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Операционный трек</span>
                <span className="px-2.5 py-0.5 text-[9px] bg-indigo-50 text-indigo-700 rounded-md font-black uppercase tracking-wide">Квартал Q{selectedQuarter}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Metric 1: Выполнение по вехам за выбранный квартал */}
                <div id="card-metric-q-milestones" className="group bg-white p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[170px] w-full cursor-default shadow-xs hover:shadow-md">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 origin-center transition-transform duration-300 group-hover:scale-105">
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-indigo-600 transition-all duration-500 ease-out group-hover:stroke-indigo-500"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 53}
                        strokeDashoffset={(2 * Math.PI * 53) - (avgSelectedMilestonesProgress / 100) * (2 * Math.PI * 53)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div id="metric-q-milestones-value" className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-black tracking-tighter text-slate-800">
                      {avgSelectedMilestonesProgress.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center mt-4">
                    <span className="font-semibold text-xs uppercase tracking-wider text-slate-500 leading-tight">Вехи (Q{selectedQuarter})</span>
                  </div>
                </div>

                {/* Metric 2: Выполнение по показателям за выбранный квартал */}
                <div id="card-metric-q-kpi" className="group bg-white p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[170px] w-full cursor-default shadow-xs hover:shadow-md">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 origin-center transition-transform duration-300 group-hover:scale-105">
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-cyan-600 transition-all duration-500 ease-out group-hover:stroke-cyan-500"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 53}
                        strokeDashoffset={(2 * Math.PI * 53) - (avgSelectedKpiProgress / 100) * (2 * Math.PI * 53)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div id="metric-q-kpi-value" className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-black tracking-tighter text-slate-800">
                      {avgSelectedKpiProgress.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center mt-4">
                    <span className="font-semibold text-xs uppercase tracking-wider text-slate-500 leading-tight">Показатели (Q{selectedQuarter})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: Годовой статус (Стратегический трек) */}
            <div id="progress-group-year" className="bg-emerald-50/10 p-5 rounded-3xl border border-emerald-100/30 flex flex-col gap-4 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-emerald-100/20 pb-2">
                <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Стратегический трек</span>
                <span className="px-2.5 py-0.5 text-[9px] bg-emerald-50 text-emerald-750 rounded-md font-black uppercase tracking-wide">Год 2026</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Metric 3: Выполнение по вехам (Год) */}
                <div id="card-metric-year-milestones" className="group bg-white p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[170px] w-full cursor-default shadow-xs hover:shadow-md">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 origin-center transition-transform duration-300 group-hover:scale-105">
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-violet-600 transition-all duration-500 ease-out group-hover:stroke-violet-500"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 53}
                        strokeDashoffset={(2 * Math.PI * 53) - (avgYearMilestonesProgress / 100) * (2 * Math.PI * 53)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div id="metric-year-milestones-value" className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-black tracking-tighter text-slate-800">
                      {avgYearMilestonesProgress.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center mt-4">
                    <span className="font-semibold text-xs uppercase tracking-wider text-slate-500 leading-tight">Вехи (Год)</span>
                  </div>
                </div>

                {/* Metric 4: Выполнение по показателям (Год) */}
                <div id="card-metric-year-kpi" className="group bg-white p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[170px] w-full cursor-default shadow-xs hover:shadow-md">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 origin-center transition-transform duration-300 group-hover:scale-105">
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="53"
                        className="stroke-emerald-600 transition-all duration-500 ease-out group-hover:stroke-emerald-500"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 53}
                        strokeDashoffset={(2 * Math.PI * 53) - (avgYearKpiProgress / 100) * (2 * Math.PI * 53)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div id="metric-year-kpi-value" className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-black tracking-tighter text-slate-800">
                      {avgYearKpiProgress.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-col items-center mt-4">
                    <span className="font-semibold text-xs uppercase tracking-wider text-slate-500 leading-tight">Показатели (Год)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 3) Graphics Layout (Pie charts block) */}
      <div id="overview-charts-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 font-sans">
        
        {/* Chart 1: Structure by Statuses */}
        <div id="pie-portfolio-structure" 
             className="bg-white p-6 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#011] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              Структура портфеля по статусам
              <div className="relative group inline-block normal-case tracking-normal">
                <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                  Отображает процентное соотношение и количество всех проектов портфеля, распределенных по четырем текущим жизненным стадиям.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            </span>
            <Layers size={14} className="text-gray-400" />
          </h3>
          <div className="flex-1 min-h-0 w-full relative mt-4">
            <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                  <Pie
                     data={statusChartData}
                     cx="50%"
                     cy="50%"
                     innerRadius={isMobile ? 50 : 70}
                     outerRadius={isMobile ? 75 : 100}
                     paddingAngle={5}
                     dataKey="value"
                  >
                     {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                  </Pie>
                  <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} 
                     itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend 
                     verticalAlign="bottom" 
                     height={44} 
                     iconType="circle"
                     iconSize={10}
                     wrapperStyle={{ paddingTop: '20px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}
                     formatter={(value) => <span style={{ color: '#374151', fontSize: '11.5px', fontWeight: 'bold', margin: '0 8px' }}>{value}</span>}
                  />
               </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+18px)] text-center pointer-events-none">
               <p className="text-2xl font-black text-slate-800">{projects.length}</p>
               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Проектов</p>
            </div>
          </div>
        </div>

        {/* Chart 2: Project Priorities */}
        <div id="pie-project-priorities" 
             className="bg-white p-6 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#011] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              Приоритеты проектов
              <div className="relative group inline-block normal-case tracking-normal">
                <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                  Группировка проектов по уровню важности: Нулевой (наивысший стратегический приоритет), Первый (высокий операционный) и Второй (линейные улучшения).
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            </span>
            <Clock size={14} className="text-gray-400" />
          </h3>
          <div className="flex-1 min-h-0 w-full relative mt-4">
            <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                  <Pie
                     data={priorityChartData}
                     cx="50%"
                     cy="50%"
                     innerRadius={isMobile ? 50 : 70}
                     outerRadius={isMobile ? 75 : 100}
                     paddingAngle={5}
                     dataKey="value"
                     nameKey="name"
                  >
                     {priorityChartData.map((entry, index) => (
                        <Cell key={`cell-priority-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                     ))}
                  </Pie>
                  <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} 
                     itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend 
                     verticalAlign="bottom" 
                     height={44} 
                     iconType="circle"
                     iconSize={10}
                     wrapperStyle={{ paddingTop: '20px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}
                     formatter={(value) => <span style={{ color: '#374151', fontSize: '11.5px', fontWeight: 'bold', margin: '0 8px' }}>{value}</span>}
                  />
               </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+18px)] text-center pointer-events-none">
               <p className="text-2xl font-black text-slate-800">{projects.length}</p>
               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Всего</p>
            </div>
          </div>
        </div>

      </div>

      {/* 4) Departmental Analytics Section (3 vertical BarCharts based on requirements) */}
      <div id="departmental-analytics-section" className="space-y-6 pt-4 border-t border-gray-100 font-sans">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1.5 uppercase">Аналитика по подразделениям</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Группировка и сравнение показателей в разрезе отделов</p>
        </div>

        <div id="dept-barcharts-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* BarChart 1: Приоритеты проектов по подразделениям */}
          <div id="dept-priority-chart-card" 
               onClick={() => setActiveZoomChart('deptPriority')}
               className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[520px] cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Приоритеты по отделам
                <div className="relative group inline-block normal-case tracking-normal">
                  <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                    Распределение количества проектов с нулевым, первым и вторым приоритетами внутри каждого структурного подразделения компании.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <Clock size={14} className="text-slate-400" />
            </h4>
            <div className="flex-1 min-h-0 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="shortName" 
                    tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600 }} 
                    axisLine={{ stroke: '#e5e7eb' }} 
                    tickLine={false} 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <RechartsTooltip content={<CustomPrioTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Legend 
                    verticalAlign="top"
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: '20px' }}
                    formatter={(value) => <span className="text-[10px] text-slate-600 font-bold">{value}</span>}
                  />
                  <Bar dataKey="p0" name="Нулевой приоритет (0)" fill="#111827" stackId="priority-stack" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="p1" name="Первый приоритет (1)" fill="#fbbf24" stackId="priority-stack" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="p2" name="Второй приоритет (2)" fill="#cbd5e1" stackId="priority-stack" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BarChart 2: Стадии проектов по подразделениям */}
          <div id="dept-stage-chart-card" 
               onClick={() => setActiveZoomChart('deptStage')}
               className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[520px] cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Стадии проектов по отделам
                <div className="relative group inline-block normal-case tracking-normal">
                  <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                    Наглядный срез текущего состояния проектной деятельности отделов: позволяет оценить, сколько проектов каждого подразделения находится в активной работе, на паузе или планируется к старту.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <Layers size={14} className="text-slate-400" />
            </h4>
            <div className="flex-1 min-h-0 w-full mt-4">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                   <XAxis 
                     dataKey="shortName" 
                     tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600 }} 
                     axisLine={{ stroke: '#e5e7eb' }} 
                     tickLine={false} 
                     angle={-45}
                     textAnchor="end"
                     height={100}
                     interval={0}
                   />
                   <YAxis 
                     allowDecimals={false} 
                     tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600 }} 
                     axisLine={false} 
                     tickLine={false} 
                   />
                   <RechartsTooltip content={<CustomStageTooltip />} cursor={{ fill: '#f9fafb' }} />
                   <Legend 
                      verticalAlign="top"
                      iconType="circle" 
                      iconSize={8}
                      wrapperStyle={{ paddingBottom: '20px' }}
                      formatter={(value) => <span className="text-[10px] text-slate-600 font-bold">{value}</span>}
                   />
                   <Bar dataKey="stagePlanned" name="Планируется" fill="#3b82f6" stackId="stage-stack" />
                   <Bar dataKey="stageInWork" name="В работе" fill="#fbbf24" stackId="stage-stack" />
                   <Bar dataKey="stageOnPause" name="На паузе" fill="#9ca3af" stackId="stage-stack" />
                   <Bar dataKey="stageCompleted" name="Завершен" fill="#10b981" stackId="stage-stack" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* BarChart 3: Своевременность мониторинга по подразделениям */}
          <div id="dept-timeliness-chart-card" 
               onClick={() => setActiveZoomChart('deptTimeliness')}
               className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[520px] cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Своевременность мониторинга
                <div className="relative group inline-block normal-case tracking-normal">
                  <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                    Контроль регулярности проведения проектных комитетов (ПК). Проект переходит в статус 'Просрочен', если дата текущего дня превысила дедлайн, рассчитанный по формуле: Дата последнего мониторинга + Регулярность в неделях.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <CheckCircle2 size={14} className="text-slate-400" />
            </h4>
            <div className="flex-1 min-h-0 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="shortName" 
                    tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600 }} 
                    axisLine={{ stroke: '#e5e7eb' }} 
                    tickLine={false} 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <RechartsTooltip content={<CustomMonitorTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Legend 
                    verticalAlign="top"
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: '20px' }}
                    formatter={(value) => <span className="text-[10px] text-slate-600 font-bold">{value}</span>}
                  />
                  <Bar dataKey="timely" name="Своевременно" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="overdue" name="Просрочен" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* 5) Progress Analytics Section (2 Horizontal BarCharts side-by-side using Tailwind grid grid-cols-1 lg:grid-cols-2 gap-6) */}
      <div id="progress-analytics-section" className="space-y-6 pt-6 border-t border-gray-100 font-sans">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1.5 uppercase">Выполнение по подразделениям</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Средний прогресс по вехам и ключевым числовым показателям</p>
        </div>

        <div id="progress-barcharts-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* BarChart 4: Выполнение по вехам (среднее по подразделению) */}
          <div id="dept-tasks-progress-card" 
               onClick={() => setActiveZoomChart('deptTasksProgress')}
               className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[480px] cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Выполнение по вехам
                <div className="relative group inline-block normal-case tracking-normal">
                  <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                    Качественный прогресс подразделений. Считается как среднее значение выполнения поквартальных ключевых вех с учетом их удельного веса в паспорте проекта.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <ListChecks size={14} className="text-indigo-500" />
            </h4>
            <div className="flex-1 min-h-0 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartDataList} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis 
                    type="number"
                    domain={[0, 100]} 
                    tickFormatter={(val) => `${val}%`}
                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }} 
                    axisLine={{ stroke: '#e5e7eb' }} 
                    tickLine={false} 
                  />
                  <YAxis 
                    type="category"
                    dataKey="shortName" 
                    tick={{ fill: '#374151', fontSize: 9, fontWeight: 700 }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={100}
                  />
                  <RechartsTooltip content={<CustomProgressTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="avgTasksProgress" name="Выполнение вех" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BarChart 5: Выполнение по показателям (среднее по подразделению) */}
          <div id="dept-kpi-progress-card" 
               onClick={() => setActiveZoomChart('deptKpiProgress')}
               className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col h-[480px] cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Выполнение по показателям
                <div className="relative group inline-block normal-case tracking-normal">
                  <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-xs font-normal rounded-xl shadow-xl z-50 border border-slate-800 pointer-events-none">
                    Количественный прогресс подразделений. Отражает средний процент выполнения числовых KPI (отношение Факта к Плану). Значение выполнения одного показателя ограничено лимитом в 100%, чтобы перевыполнение плана не искажало общую аналитику отдела.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <Award size={14} className="text-cyan-500" />
            </h4>
            <div className="flex-1 min-h-0 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartDataList} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis 
                    type="number"
                    domain={[0, 100]} 
                    tickFormatter={(val) => `${val}%`}
                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }} 
                    axisLine={{ stroke: '#e5e7eb' }} 
                    tickLine={false} 
                  />
                  <YAxis 
                    type="category"
                    dataKey="shortName" 
                    tick={{ fill: '#374151', fontSize: 9, fontWeight: 700 }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={100}
                  />
                  <RechartsTooltip content={<CustomProgressTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="avgKpiProgress" name="Выполнение показателей" fill="#0891b2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* 6) Fullscreen Chart Zoom Modal Overlay */}
      {activeZoomChart && activeZoomChart !== 'status' && activeZoomChart !== 'priority' && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveZoomChart(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-[1000px] max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative flex flex-col font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setActiveZoomChart(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors border border-gray-100"
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>

            {/* Content Switch */}
            {activeZoomChart === 'deptPriority' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#4f46e5] bg-indigo-50 px-2.5 py-1 rounded-full">Увеличенный масштаб</span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-2 mb-1">
                    <Clock size={20} className="text-[#4f46e5]" />
                    Приоритеты проектов по отделам
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Распределение количества проектов с нулевым, первым и вторым приоритетами внутри каждого структурного подразделения компании.
                  </p>
                </div>
                <div className="flex-1 w-full overflow-x-auto mt-2">
                  <div className="w-[900px] h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        <XAxis 
                          dataKey="department" 
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                          angle={-45}
                          textAnchor="end"
                          height={120}
                          interval={0}
                        />
                        <YAxis 
                          allowDecimals={false} 
                          tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                        />
                        <RechartsTooltip content={<CustomPrioTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Legend 
                          verticalAlign="top"
                          iconType="circle" 
                          iconSize={10}
                          wrapperStyle={{ paddingBottom: '20px' }}
                          formatter={(value) => <span className="text-xs text-slate-800 font-extrabold">{value}</span>}
                        />
                        <Bar dataKey="p0" name="Нулевой приоритет (0)" fill="#111827" stackId="priority-stack" />
                        <Bar dataKey="p1" name="Первый приоритет (1)" fill="#fbbf24" stackId="priority-stack" />
                        <Bar dataKey="p2" name="Второй приоритет (2)" fill="#cbd5e1" stackId="priority-stack" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeZoomChart === 'deptStage' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#4f46e5] bg-indigo-50 px-2.5 py-1 rounded-full">Увеличенный масштаб</span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-2 mb-1">
                    <Layers size={20} className="text-[#4f46e5]" />
                    Стадии проектов по подразделениям
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Наглядный срез текущего состояния проектной деятельности отделов: распределение по фазам (Планируется, В работе, На паузе, Завершен).
                  </p>
                </div>
                <div className="flex-1 w-full overflow-x-auto mt-2">
                  <div className="w-[900px] h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        <XAxis 
                          dataKey="department" 
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                          angle={-45}
                          textAnchor="end"
                          height={120}
                          interval={0}
                        />
                        <YAxis 
                          allowDecimals={false} 
                          tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                        />
                        <RechartsTooltip content={<CustomStageTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Legend 
                          verticalAlign="top"
                          iconType="circle" 
                          iconSize={10}
                          wrapperStyle={{ paddingBottom: '20px' }}
                          formatter={(value) => <span className="text-xs text-slate-800 font-extrabold">{value}</span>}
                        />
                        <Bar dataKey="stagePlanned" name="Планируется" fill="#3b82f6" stackId="stage-stack" />
                        <Bar dataKey="stageInWork" name="В работе" fill="#fbbf24" stackId="stage-stack" />
                        <Bar dataKey="stageOnPause" name="На паузе" fill="#9ca3af" stackId="stage-stack" />
                        <Bar dataKey="stageCompleted" name="Завершен" fill="#10b981" stackId="stage-stack" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeZoomChart === 'deptTimeliness' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#4f46e5] bg-indigo-50 px-2.5 py-1 rounded-full">Увеличенный масштаб</span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-2 mb-1">
                    <CheckCircle2 size={20} className="text-[#10b981]" />
                    Своевременность мониторинга по подразделениям
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Контроль регулярности проведения проектных комитетов (ПК). Статус 'Просрочен' активируется при задержке плановых вех мониторинга.
                  </p>
                </div>
                <div className="flex-1 w-full overflow-x-auto mt-2">
                  <div className="w-[900px] h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        <XAxis 
                          dataKey="department" 
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                          angle={-45}
                          textAnchor="end"
                          height={120}
                          interval={0}
                        />
                        <YAxis 
                          allowDecimals={false} 
                          tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                        />
                        <RechartsTooltip content={<CustomMonitorTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Legend 
                          verticalAlign="top"
                          iconType="circle" 
                          iconSize={10}
                          wrapperStyle={{ paddingBottom: '20px' }}
                          formatter={(value) => <span className="text-xs text-slate-800 font-extrabold">{value}</span>}
                        />
                        <Bar dataKey="timely" name="Своевременно" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="overdue" name="Просрочен" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeZoomChart === 'deptTasksProgress' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#4f46e5] bg-indigo-50 px-2.5 py-1 rounded-full">Увеличенный масштаб</span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-2 mb-1">
                    <ListChecks size={20} className="text-[#4f46e5]" />
                    Выполнение по вехам (Средней прогресс)
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Качественный прогресс подразделений. Считается как среднее значение выполнения поквартальных ключевых вех (задач с нулевым приоритетом).
                  </p>
                </div>
                <div className="flex-1 w-full overflow-x-auto mt-2">
                  <div className="w-[900px] h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        <XAxis 
                          type="number"
                          domain={[0, 100]} 
                          tickFormatter={(val) => `${val}%`}
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                        />
                        <YAxis 
                          type="category"
                          dataKey="department" 
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                          width={250}
                        />
                        <RechartsTooltip content={<CustomProgressTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="avgTasksProgress" name="Выполнение вех" fill="#4f46e5" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeZoomChart === 'deptKpiProgress' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#4f46e5] bg-indigo-50 px-2.5 py-1 rounded-full">Увеличенный масштаб</span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-2 mb-1">
                    <Award size={20} className="text-[#0891b2]" />
                    Выполнение по показателям (Средний прогресс)
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Количественный прогресс подразделений. Отражает средний процент выполнения числовых KPI (отношение Факта к Плану с лимитом 100%).
                  </p>
                </div>
                <div className="flex-1 w-full overflow-x-auto mt-2">
                  <div className="w-[900px] h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={chartDataList} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        <XAxis 
                          type="number"
                          domain={[0, 100]} 
                          tickFormatter={(val) => `${val}%`}
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                        />
                        <YAxis 
                          type="category"
                          dataKey="department" 
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }} 
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} 
                          tickLine={true} 
                          width={250}
                        />
                        <RechartsTooltip content={<CustomProgressTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="avgKpiProgress" name="Выполнение показателей" fill="#0891b2" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-semibold">
              <span>* Отображаются полные наименования подразделений</span>
              <span>Клавиша Esc или клик вне области закрывают окно</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
