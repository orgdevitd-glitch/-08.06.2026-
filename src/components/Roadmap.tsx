import React, { useState, useEffect } from 'react';
import { Map as LucideMap, Target, Calendar, Clock, User, ChevronRight } from 'lucide-react';
import { Project } from '../types';
import { normalizeDateValue, formatDateSafe, parseDateSafe } from '../utils/dateUtils';

interface RoadmapProps {
  projects: Project[];
}

export const Roadmap: React.FC<RoadmapProps> = ({ projects }) => {
  const currentYear = new Date().getFullYear();
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  
  const timelineProjects = projects
    .filter(p => (p.createdAt || p.deadlineAt))
    .sort((a,b) => {
      const aDate = parseDateSafe(a.createdAt);
      const bDate = parseDateSafe(b.createdAt);
      const aTime = aDate ? aDate.getTime() : 0;
      const bTime = bDate ? bDate.getTime() : 0;
      return aTime - bTime;
    });

  const statusMap: Record<string, { label: string, color: string }> = {
    active: { label: 'В работе', color: 'bg-[#010101]' },
    waiting: { label: 'Ожидание', color: 'bg-amber-400' },
    completed: { label: 'Завершено', color: 'bg-emerald-500' },
    cancelled: { label: 'Отменен', color: 'bg-gray-400' },
    overdue: { label: 'Просрочен', color: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' },
    at_risk: { label: 'Риск', color: 'bg-orange-500' },
    unknown: { label: '?', color: 'bg-gray-200' }
  };

  return (
    <div className="space-y-8 pb-12">
      {isMobile ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <h3 className="text-sm font-black text-[#011] uppercase tracking-widest flex items-center gap-3">
              <LucideMap className="text-[#F8BC03]" size={20} /> Временная шкала проектов
            </h3>
          </div>

          <div className="relative border-l-2 border-gray-100 ml-4 pl-6 space-y-6">
            {timelineProjects.map((p) => {
              const pStart = parseDateSafe(p.createdAt);
              const pEnd = parseDateSafe(p.deadlineAt);
              const statusInfo = statusMap[p.status] || statusMap.unknown;
              const startText = pStart ? formatDateSafe(p.createdAt) : 'Не указан';
              const endText = pEnd ? formatDateSafe(p.deadlineAt) : 'Не указан';

              return (
                <div key={p.projectId} className="relative group">
                  {/* Dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-transform group-hover:scale-125 ${statusInfo.color}`} />
                  
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block font-mono">
                        {pStart ? pStart.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }) : 'Срок не указан'}
                      </span>
                      <span className={`${statusInfo.color} text-white px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 leading-snug">{p.projectName}</h4>

                    <div className="flex flex-col gap-1 text-[11px] text-gray-500 pt-2 border-t border-gray-50">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">Исполнитель: <span className="font-semibold text-gray-800">{p.executor || 'Не назначен'}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-gray-400 shrink-0" />
                        <span>Дедлайн: <span className="font-semibold text-gray-800">{endText}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {timelineProjects.length === 0 && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center py-8">Нет проектов для отображения на шкале</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <h3 className="text-base font-black text-[#011] uppercase tracking-widest flex items-center gap-3">
              <LucideMap className="text-[#F8BC03]" size={24} /> Дорожная карта {currentYear}: Портфель проектов
            </h3>
            <div className="flex flex-wrap gap-4">
              {Object.values(statusMap).slice(0, 5).map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${l.color} shadow-sm`} />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div className="min-w-[1400px]">
              <div className="grid grid-cols-[280px_repeat(12,1fr)] gap-2 mb-8 border-b border-gray-100 pb-4">
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest pl-2">Проекты</div>
                {months.map(m => (
                  <div key={m} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{m}</div>
                ))}
              </div>

              <div className="space-y-6">
                {timelineProjects.map(p => {
                  let pStart = parseDateSafe(p.createdAt);
                  let pEnd = parseDateSafe(p.deadlineAt);

                  if (pStart && Number.isNaN(pStart.getTime())) pStart = null;
                  if (pEnd && Number.isNaN(pEnd.getTime())) pEnd = null;

                  let startM = 0;
                  let endM = 11;
                  
                  if (pStart) {
                    if (pStart.getFullYear() < currentYear) startM = 0;
                    else if (pStart.getFullYear() > currentYear) startM = 11;
                    else startM = pStart.getMonth();
                  } else if (pEnd) {
                    startM = pEnd.getMonth();
                  }

                  if (pEnd) {
                    if (pEnd.getFullYear() < currentYear) endM = 0;
                    else if (pEnd.getFullYear() > currentYear) endM = 11;
                    else endM = pEnd.getMonth();
                  }

                  if (endM < startM) endM = startM;
                  const span = endM - startM + 1;

                  const statusInfo = statusMap[p.status] || statusMap.unknown;

                  return (
                    <div key={p.projectId} className="grid grid-cols-[280px_repeat(12,1fr)] gap-2 items-center group">
                      <div className="pr-6 pl-2 border-r border-gray-50 h-full flex flex-col justify-center min-w-0">
                        <p className="text-xs font-black text-[#011] truncate tracking-tight group-hover:text-[#F8BC03] transition-colors">{p.projectName}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter truncate flex items-center gap-1.5 leading-none">
                          <span>{p.executor || '—'}</span>
                          {p.deadlineAt && <span>• До {formatDateSafe(p.deadlineAt)}</span>}
                        </p>
                      </div>
                      <div 
                        className="col-span-12 relative h-10 rounded-xl bg-gray-50/30 flex items-center p-1 group-hover:bg-gray-50 transition-all border border-transparent group-hover:border-gray-100/50"
                        style={{ gridColumnStart: startM + 2, gridColumnEnd: `span ${span}` }}
                      >
                        <div 
                          className={`h-full rounded-lg transition-all duration-700 flex items-center justify-center overflow-hidden ${statusInfo.color}`}
                          style={{ width: `100%` }}
                        >
                           <span className={`text-[9px] font-black uppercase tracking-widest drop-shadow-sm px-2 truncate ${statusInfo.color.includes('amber') ? 'text-black' : 'text-white'}`}>
                             {statusInfo.label}
                           </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer Info */}
      <div className="bg-[#010101] rounded-2xl p-5 sm:p-10 border border-[#010101] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
          <LucideMap size={120} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-lg sm:text-xl font-black text-[#F8BC03] uppercase tracking-[0.2em] mb-4">
            Контроль дедлайнов
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 font-medium leading-relaxed">
            Визуализация портфеля в разрезе времени. Система автоматически рассчитывает пересечения и пиковые нагрузки на команду.
          </p>
        </div>
      </div>
    </div>
  );
};
