import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Calendar,
  User,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  Users,
  ShieldAlert,
  ArrowRight,
  Activity,
  Percent,
  ArrowDownRight,
  Map as LucideMap,
  BarChart as BarChartIcon,
  FileText,
} from "lucide-react";
import { Project, ProjectAnalysisResult } from "../types";
import { AnalysisPanel } from "./AnalysisPanel";
import {
  formatDateSafe,
  normalizeDateValue,
  parseDateSafe,
} from "../utils/dateUtils";
import { exportProjectToPDF } from "../utils/pdfExport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ProjectCardProps {
  project: Project;
  onRefresh: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onRefresh,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ProjectAnalysisResult | null>(
    project.lastAnalysis || null,
  );
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const handleExportPDF = async () => {
    setExportingPdf(true);
    setPdfError(null);
    try {
      await exportProjectToPDF(project, analysis);
    } catch (err: any) {
      setPdfError(
        err.message || "Не удалось сформировать PDF. Попробуйте еще раз.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${project.projectId}/analyze`,
        { method: "POST", credentials: "include" },
      );
      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
        onRefresh();
      } else {
        throw new Error(data.error || "Ошибка при запуске ИИ-анализа");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const statusMap: Record<string, string> = {
    active: "В работе",
    completed: "Завершено",
    cancelled: "Отменен",
    overdue: "Просрочен",
    at_risk: "Зона риска",
    unknown: "Неизвестно",
  };

  const m = project._metrics;
  const progress = Math.round(m?.weightedTaskProgressPercent || 0);

  const totalPlannedWeight = m?.totalPlanWeight || 0;
  const totalFactWeight = m?.totalFactWeight || 0;
  const totalDeviation = m?.deviationPercent || 0;

  const quartersData = m?.planFactByQuarter || [
    {
      quarter: "Q1",
      planWeight: 0,
      factWeight: 0,
      deviation: 0,
      status: "not_started",
    },
    {
      quarter: "Q2",
      planWeight: 0,
      factWeight: 0,
      deviation: 0,
      status: "not_started",
    },
    {
      quarter: "Q3",
      planWeight: 0,
      factWeight: 0,
      deviation: 0,
      status: "not_started",
    },
    {
      quarter: "Q4",
      planWeight: 0,
      factWeight: 0,
      deviation: 0,
      status: "not_started",
    },
  ];

  const tasksList = [...project.tasks, ...project.milestones].sort((a, b) =>
    (a.quarter || "").localeCompare(b.quarter || ""),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      {/* 1. Основная информация и Сроки */}
      <div className="bg-[#010101] text-white p-5 sm:p-8 md:p-10 rounded-2xl md:rounded-[2rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-10 opacity-5 scale-150 -translate-y-1/4 translate-x-1/4">
          <LucideMap size={400} />
        </div>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                project.status === "completed"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : project.status === "active"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    : "border-orange-500/30 bg-orange-500/10 text-orange-400"
              }`}
            >
              {statusMap[project.status] || project.status}
            </span>
            {project.stage && (
              <span className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
                {project.stage}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tighter leading-tight max-w-full break-words">
            {project.projectName}
          </h2>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Начало
              </span>
              <span className="text-sm font-semibold text-gray-300">
                {project.startDate ? formatDateSafe(project.startDate) : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Крайний срок
              </span>
              <span
                className={`text-sm font-semibold ${project.deadlineAt && new Date() > (parseDateSafe(project.deadlineAt) || new Date("2099-01-01")) && project.status !== "completed" ? "text-red-400" : "text-gray-300"}`}
              >
                {project.deadlineAt ? formatDateSafe(project.deadlineAt) : "—"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:ml-auto">
              {project.projectUrl && (
                <a
                  href={project.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[#F8BC03] hover:text-[#dab503] transition-colors bg-[#F8BC03]/10 px-4 py-2 rounded-xl border border-[#F8BC03]/20"
                >
                  <ExternalLink size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Битрикс24
                  </span>
                </a>
              )}
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="flex items-center gap-2 bg-[#FBDF4B] text-[#010101] hover:bg-[#F8BC03] transition-all px-4 py-2 rounded-xl border border-black/5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-lg"
              >
                {exportingPdf ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileText size={14} />
                )}
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {exportingPdf ? "Формирование..." : "Экспорт PDF"}
                </span>
              </button>
              {pdfError && (
                <p className="text-red-400 text-xs font-semibold animate-pulse">
                  {pdfError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Участники и Цели */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#011] flex items-center gap-2">
                <Users size={18} className="text-[#F8BC03]" /> Участники
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Постановщик
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {project.owner || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Исполнитель
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {project.executor || "—"}
                  </p>
                </div>
                {project.coExecutors && project.coExecutors.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Соисполнители / Наблюдатели
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {project.coExecutors
                        .concat(project.observers || [])
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#011] flex items-center gap-2">
                <Target size={18} className="text-[#F8BC03]" /> Цели и ресурсы
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Описание
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed font-medium line-clamp-3">
                    {project.projectDescription || "—"}
                  </p>
                </div>
                {project.goals && project.goals.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Цели проекта
                    </p>
                    <ul className="space-y-1">
                      {project.goals.map((g, i) => (
                        <li
                          key={i}
                          className="text-xs font-medium text-gray-800 flex gap-2"
                        >
                          <div className="w-1 h-1 rounded-full bg-[#011] mt-1.5" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* План/Факт по кварталам */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#011] flex items-center gap-2">
              <BarChartIcon size={18} className="text-[#F8BC03]" /> План / Факт
              по кварталам
            </h3>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quartersData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #f3f4f6",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelStyle={{
                      fontWeight: "bold",
                      color: "#111827",
                      fontSize: "12px",
                    }}
                    cursor={{ fill: "#f9fafb" }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#374151",
                    }}
                  />
                  <Bar
                    dataKey="planWeight"
                    name="План (%)"
                    fill="#e5e7eb"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="factWeight"
                    name="Факт (%)"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {quartersData.map((q, idx) => {
                const isFuture = q.planWeight === 0 && q.factWeight === 0;
                return (
                  <div
                    key={idx}
                    className="flex flex-col p-4 bg-gray-50 rounded-2xl border border-gray-100 relative overflow-hidden"
                  >
                    <p className="text-xs font-black text-gray-900 mb-2">
                      {q.quarter}
                    </p>
                    <div className="flex justify-between items-center mb-1 text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-gray-400">План</span>
                      <span className="text-[#011]">{q.planWeight}%</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-gray-400">Факт</span>
                      <span className="text-blue-600">{q.factWeight}%</span>
                    </div>
                    {!isFuture ? (
                      <div
                        className={`mt-auto px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest text-center ${q.deviation < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                      >
                        {q.deviation < 0 ? `Откл: ${q.deviation}%` : `В норме`}
                      </div>
                    ) : (
                      <div className="mt-auto px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest text-center bg-gray-200 text-gray-500">
                        Ожидание
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <span>Общий прогресс по весам</span>
                <span className="text-[#011]">
                  {totalFactWeight}% из {totalPlannedWeight}% ППГ
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                ></div>
              </div>
            </div>
          </section>

          {/* Задачи и вехи */}
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#011] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#F8BC03]" /> Структура
                  Задач и Вех
                </div>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px]">
                  К-во: {tasksList.length}
                </span>
              </h3>
            </div>

            {isMobile ? (
              <div className="divide-y divide-gray-50 bg-gray-50/10">
                {tasksList.map((t) => {
                  const pPercent = t.progressPercent || 0;
                  const wPercent = t.weight || 0;
                  const attributedWeight =
                    t.status === "Завершена"
                      ? wPercent
                      : (wPercent * pPercent) / 100;

                  return (
                    <div
                      key={t.taskId}
                      className="p-5 space-y-4 bg-white hover:bg-gray-50/20 transition-all font-sans"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${t.isMilestone ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {t.quarter || "—"} • {t.isMilestone ? "Веха" : "Задача"}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest ${t.status === "Завершена" ? "text-emerald-600 bg-emerald-50" : t.status === "Просрочена" ? "text-red-500 bg-red-50" : "text-blue-500 bg-blue-50"} px-2.5 py-0.5 rounded-lg`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">
                        {t.title}
                      </h4>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[11px] text-gray-500 pt-3 border-t border-gray-50 font-medium">
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                            Отв.
                          </p>
                          <p className="text-gray-800 font-bold mt-0.5 truncate">
                            {t.executor || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                            Крайний Срок
                          </p>
                          <p className="text-gray-800 font-bold mt-0.5">
                            {t.deadlineAt ? formatDateSafe(t.deadlineAt) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                            Вес в ППГ
                          </p>
                          <p className="text-gray-900 font-black mt-0.5">
                            {t.weight ? `${t.weight}%` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                            Зачтено
                          </p>
                          <p className="text-blue-600 font-black mt-0.5">
                            {attributedWeight > 0
                              ? `${attributedWeight.toFixed(1)}%`
                              : "0%"}
                          </p>
                        </div>
                      </div>

                      {t.progressPercent !== null && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <span>Прогресс</span>
                            <span>{t.progressPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${t.progressPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {tasksList.length === 0 && (
                  <p className="text-center py-10 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Нет задач и вех
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto whitespace-nowrap custom-scrollbar">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Кв
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Тип
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Название
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Отв.
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Срок
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Вес
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Прогр.
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Зачтено
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tasksList.map((t) => {
                      const pPercent = t.progressPercent || 0;
                      const wPercent = t.weight || 0;
                      const attributedWeight =
                        t.status === "Завершена"
                          ? wPercent
                          : (wPercent * pPercent) / 100;
                      return (
                        <tr
                          key={t.taskId}
                          className="hover:bg-gray-50/50 transition-colors group"
                        >
                          <td className="px-4 py-3 font-bold text-gray-500 text-xs">
                            {t.quarter || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${t.isMilestone ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              {t.isMilestone ? "Веха" : "Задача"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-normal min-w-[200px] max-w-[300px] leading-tight text-xs">
                            {t.title}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-600 text-[10px] truncate max-w-[100px]">
                            {t.executor || "—"}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-600 text-xs">
                            {t.deadlineAt ? formatDateSafe(t.deadlineAt) : "—"}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {t.weight ? `${t.weight}%` : "—"}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {t.progressPercent !== null
                              ? `${t.progressPercent}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 font-bold text-blue-600">
                            {attributedWeight > 0
                              ? `${attributedWeight.toFixed(1)}%`
                              : "0%"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 w-20">
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${t.status === "Завершена" ? "text-emerald-600" : t.status === "Просрочена" ? "text-red-500" : "text-blue-500"}`}
                              >
                                {t.status}
                              </span>
                              {t.status === "Выполняется" &&
                                t.progressPercent !== null && (
                                  <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500"
                                      style={{ width: `${t.progressPercent}%` }}
                                    ></div>
                                  </div>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {tasksList.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-8 text-center text-xs text-gray-400 font-bold uppercase tracking-widest"
                        >
                          Нет задач и вех
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Показатели */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#011] mb-6 flex items-center gap-2">
              <Percent size={18} className="text-[#F8BC03]" /> Эффекты и
              Показатели KPI
            </h3>
            {project.indicators.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.indicators.map((ind, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3"
                  >
                    <p className="text-sm font-bold text-gray-900 line-clamp-2">
                      {ind.name}
                    </p>
                    <div className="flex items-center gap-4 mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          План
                        </span>
                        <span className="text-sm font-bold text-[#011]">
                          {ind.planValue ?? "—"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Факт
                        </span>
                        <span
                          className={`text-sm font-bold ${ind.factValue ? "text-blue-600" : "text-orange-500"}`}
                        >
                          {ind.factValue ?? "Нет факта"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-orange-50 border border-orange-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-orange-800">
                <AlertTriangle size={24} className="opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest text-center">
                  Показатели не заполнены, эффект проекта оценить нельзя.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Сайдбар */}
        <div className="space-y-8">
          {/* Мониторинг ПК */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#011] mb-6 flex items-center gap-2">
              <Activity size={18} className="text-[#F8BC03]" /> Мониторинг ПК
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Факт последнего ПК
                </p>
                <p className="text-lg font-black text-[#011]">
                  {project.lastPcDate
                    ? formatDateSafe(project.lastPcDate)
                    : "Нет ПК"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Регулярность ПК
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {project.monitoringFrequencyWeeks
                    ? `${project.monitoringFrequencyWeeks} нед.`
                    : "Не указана"}
                </p>
              </div>
              <div
                className={`p-4 rounded-2xl border ${m?.pcStatus === "Своевременно" ? "bg-emerald-50 border-emerald-100" : m?.pcStatus === "Просрочен" ? "bg-red-50 border-red-100 text-red-900" : "bg-orange-50 border-orange-100"}`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                  Статус текущего мониторинга
                </p>
                <p className="text-sm font-bold">
                  {m?.pcStatus || "Нельзя оценить своевременность (нет данных)"}
                </p>
              </div>
            </div>
          </section>

          {/* Риски */}
          <section className="bg-red-50 p-6 rounded-3xl border border-red-100 text-red-900">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldAlert size={18} /> Риски и комментарии
            </h3>
            {project.risks && project.risks.length > 0 ? (
              <ul className="space-y-4">
                {project.risks.map((r) => (
                  <li key={r.riskId}>
                    <p className="text-xs font-medium leading-relaxed">
                      {r.title}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">
                Риски не зафиксированы
              </p>
            )}
            {project._rawAnalysisComment && (
              <div className="mt-4 pt-4 border-t border-red-200">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">
                  Комментарий для анализа:
                </p>
                <p className="text-xs font-medium italic">
                  {project._rawAnalysisComment}
                </p>
              </div>
            )}
          </section>

          {/* AI Analysis Button inside Card before Panel */}
          <section className="bg-[#010101] p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Sparkles size={100} />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#F8BC03]">
                ИИ-Анализ Проекта
              </h3>
              {analyzing ? (
                <div className="py-6 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={24} className="animate-spin text-[#F8BC03]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 animate-pulse">
                    Идет анализ...
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-medium leading-relaxed">
                    Система проанализирует все параметры проекта и сформирует
                    управленческий вывод.
                  </p>
                  <button
                    onClick={handleAnalyze}
                    className="w-full bg-[#F8BC03] text-[#011] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#dab503] transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    Запустить нейросеть <Sparkles size={14} />
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Основной блок анализа */}
      {analysis && !analyzing && (
        <div id="ai-analysis-full" className="pt-8">
          <AnalysisPanel analysis={analysis} />
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3 text-red-600 text-sm font-bold animate-in slide-in-from-top-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
    </div>
  );
};
