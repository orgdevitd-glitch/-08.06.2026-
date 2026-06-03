import React from 'react';
import { Sparkles, AlertCircle, CheckCircle2, ListChecks, MessageSquare, ArrowRight } from 'lucide-react';
import { ProjectAnalysisResult } from '../types';
import { formatDateSafe } from '../utils/dateUtils';
import { sanitizeAndParseFloat } from '../utils/projectCalculations';

interface AnalysisPanelProps {
  analysis: ProjectAnalysisResult;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Краткий анализ */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-[#011] mb-6 flex items-center gap-2">
          <Sparkles size={16} className="text-[#F8BC03]" /> Краткий экспресс-анализ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            { label: 'Полнота данных', value: analysis.shortAnalysis.dataCompleteness },
            { label: 'Своевременность ПК', value: analysis.shortAnalysis.pcTimeliness },
            { label: 'Прогресс по весам', value: analysis.shortAnalysis.weightedTaskProgress },
            { label: 'План периода', value: analysis.shortAnalysis.periodPlan },
            { label: 'Факт периода', value: analysis.shortAnalysis.periodFact },
            { label: 'Отклонение', value: analysis.shortAnalysis.deviation },
            { label: 'Дата следующего ПК', value: formatDateSafe(analysis.shortAnalysis.nextPcDate) },
            { label: 'Дата оценки', value: formatDateSafe(analysis.shortAnalysis.assessmentDate) },
          ].map((item, i) => (
            <div key={i} className="space-y-1 bg-gray-50/40 p-3 rounded-xl sm:bg-transparent sm:p-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase">{item.label}</p>
              <p className="text-xs sm:text-sm font-black text-[#011] break-words">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Ключевые проблемы (ИИ) */}
        <div className="bg-red-50/20 p-5 sm:p-6 rounded-2xl border border-red-100/50">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-red-600 mb-6 flex items-center gap-2">
            <AlertCircle size={16} /> Ключевые проблемы (ИИ)
          </h3>
          <div className="space-y-4">
            {analysis.keyProblems.map((prob, i) => {
              const sev = (prob.severity || '').toString().toLowerCase();
              const isCritical = sev === 'critical' || sev === 'критическая';
              const isHigh = sev === 'high' || sev === 'высокая';
              const isMedium = sev === 'medium' || sev === 'средняя';
              
              const sevLabel = isCritical ? 'Критическая' : isHigh ? 'Высокая' : isMedium ? 'Средняя' : 'Низкая';
              const sevColor = isCritical ? 'text-red-600 bg-red-50 border-red-100' : isHigh ? 'text-orange-600 bg-orange-50 border-orange-100' : isMedium ? 'text-yellow-600 bg-yellow-50 border-yellow-100' : 'text-blue-600 bg-blue-50 border-blue-100';

              return (
                <div key={i} className="bg-white p-4 rounded-xl border border-red-50/50 shadow-sm flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 w-full">
                    <div className="flex gap-2 items-center">
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${isCritical ? 'bg-red-600 animate-pulse' : isHigh ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                      <p className="text-xs sm:text-sm font-bold text-[#011] break-words">{prob.problem}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider self-start sm:self-auto shrink-0 ${sevColor}`}>
                      {sevLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-4.5 break-words">{prob.managementAssessment}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Приоритетные действия */}
        <div className="bg-emerald-50/20 p-5 sm:p-6 rounded-2xl border border-emerald-100/50">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-600 mb-6 flex items-center gap-2">
            <ListChecks size={16} /> Приоритетные действия
          </h3>
          <div className="space-y-4">
            {analysis.priorityActions.map((action, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-emerald-50/50 shadow-sm flex gap-3 sm:gap-4">
                <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                  {action.priority}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-[#011] mb-1 break-words">{action.action}</p>
                  {action.owner && <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 flex items-center gap-1 truncate">
                    Ответственный: {action.owner}
                  </p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Управленческий вывод */}
      <div className="bg-[#010101] p-5 sm:p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10">
          <MessageSquare size={160} />
        </div>
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-[#F8BC03] mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} /> Управленческий вывод
        </h3>
        <p className="text-sm sm:text-base font-medium leading-relaxed italic border-l-4 border-[#F8BC03] pl-4 sm:pl-6 py-1.5 sm:py-2 break-words">
          {analysis.managementConclusion}
        </p>
      </div>

      {/* Развернутый анализ */}
      <div className="bg-gray-50 p-5 sm:p-6 rounded-2xl border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <ArrowRight size={16} /> Детальная методология анализа
          </h3>
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
            AI Модель: {analysis.model}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 sm:gap-y-8">
          {Object.entries(analysis.detailedAnalysis).map(([key, val], i) => {
            const labelMap: Record<string, string> = {
              dataCompleteness: 'Полнота и заполненность данных',
              pcTimeliness: 'Своевременность мониторинга ПК',
              tasksAndMilestones: 'Выполнение задач и вех',
              planFact: 'План-фактный анализ по кварталам',
              indicators: 'Достижение показателей эффективности',
              lagOrAdvance: 'Отставание или опережение графика',
              projectProposal: 'Предложения по проекту',
              aiProposal: 'Рекомендации и предложения ИИ'
            };
            return (
              <div key={i} className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                  {labelMap[key] || key}
                </p>
                <div className="text-sm text-gray-600 font-medium leading-relaxed">
                  {typeof val === 'string' ? val : JSON.stringify(val)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
