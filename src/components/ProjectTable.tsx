import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, FilterX, AlertTriangle, Clock, ArrowUpDown, ChevronUp, ChevronDown, User, ExternalLink, Activity, Info, BarChart, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { Project } from '../types';
import { formatDateSafe, normalizeDateValue, parseDateSafe } from '../utils/dateUtils';
import { 
  calculateTasksProgressForProject, 
  calculateKpisProgressForProject, 
  sanitizeAndParseFloat 
} from '../utils/projectCalculations';

interface ProjectTableProps {
  projects: Project[];
  filters: any;
  setFilters: (f: any) => void;
  resetFilters: () => void;
  onSelectProject: (id: string) => void;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

// Beautiful custom Multi-select dropdown with click-outside behavior and checkboxes
const MultiSelectDropdown: React.FC<{
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
}> = ({ label, options, selectedValues, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(v => v !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  return (
    <div className="flex flex-col gap-1 relative font-sans" ref={containerRef}>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px] flex items-center justify-between text-left cursor-pointer"
      >
        <span className="truncate max-w-[150px]">
          {selectedValues.length === 0 
            ? placeholder 
            : `${selectedValues.join(', ')}`}
        </span>
        <ChevronDown size={14} className="text-gray-400 ml-1 shrink-0" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-12 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto p-2 space-y-1">
          {options.map((opt) => {
            const isChecked = selectedValues.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-xs font-semibold select-none">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleOption(opt)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                />
                <span className="text-gray-700 truncate">{opt}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <div className="text-xs text-gray-400 p-2 text-center">Нет вариантов</div>
          )}
        </div>
      )}
    </div>
  );
};

export const ProjectTable: React.FC<ProjectTableProps> = ({ projects, filters, setFilters, resetFilters, onSelectProject }) => {
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'generalStatus', direction: 'desc' });
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    const ignoreKeys = ['search'];
    Object.keys(filters).forEach(k => {
      if (!ignoreKeys.includes(k) && filters[k] && filters[k] !== 'all' && (!Array.isArray(filters[k]) || filters[k].length > 0)) {
        count++;
      }
    });
    return count;
  }, [filters]);

  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getGeneralStatusLevel = (p: Project) => {
    switch(p._metrics?.overallStatus) {
       case "Норма": return 1;
       case "Под наблюдением": return 2;
       case "Зона риска": return 3;
       case "Недостаточно данных": return 2; 
    }
    if (p.status === 'completed') return 0;
    return 1;
  };

  const getMetricDeviation = (p: Project) => {
    return p._metrics?.deviationPercent || 0;
  };

  const getIndicatorsStatus = (p: Project) => {
    const status = p._metrics?.indicatorsStatus || "Нет показателей";
    let color = "gray";
    if (status === "В норме") color = "green";
    else if (status === "Нет факта" || status === "Отставание") color = "yellow";
    
    if (status === "Отставание") color = "red";

    return { text: status, color, hasIndicators: status !== "Нет показателей" };
  };

  // Safe parsed arrays for executors and departments to support multi-select filtering
  const selectedExecutors = useMemo(() => {
    if (!filters.executor || filters.executor === 'all') return [];
    return Array.isArray(filters.executor) ? filters.executor : [filters.executor];
  }, [filters.executor]);

  const selectedDepts = useMemo(() => {
    if (!filters.department || filters.department === 'all') return [];
    return Array.isArray(filters.department) ? filters.department : [filters.department];
  }, [filters.department]);

  const filteredProjects = useMemo(() => {
     return projects.filter(p => {
       // Search
       if (filters.search) {
         const term = filters.search.toLowerCase();
         if (!p.projectName.toLowerCase().includes(term) && !(p.executor || '').toLowerCase().includes(term)) return false;
       }
       // Dropdowns
       if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
       if (filters.stage && filters.stage !== 'all' && p.stage !== filters.stage) return false;
       
       // 4. Руководитель / Исполнитель (Multi-select OR rule)
       if (selectedExecutors.length > 0) {
         const matchesExecutor = p.executor && selectedExecutors.includes(p.executor);
         if (!matchesExecutor) return false;
       }

       if (filters.owner && filters.owner !== 'all' && p.owner !== filters.owner) return false;
       
       // 6. Подразделение / Департамент (Multi-select AND intersection rule with OR matching within department list)
       if (selectedDepts.length > 0) {
         const projectDepts = p.department
           ? p.department.split(";").map(d => d.trim().toLowerCase()).filter(Boolean)
           : [];
         
         const hasMatchingDept = selectedDepts.some(selDept => 
           projectDepts.includes(selDept.toLowerCase().trim())
         );
         
         if (!hasMatchingDept) return false;
       }

       if (filters.pcStatus && filters.pcStatus !== 'all' && p._metrics?.pcStatus !== filters.pcStatus) return false;
       
       const genStatus = getGeneralStatusLevel(p);
       if (filters.generalStatus && filters.generalStatus !== 'all') {
          if (filters.generalStatus === '3' && genStatus !== 3) return false;
          if (filters.generalStatus === '2' && genStatus !== 2) return false;
          if (filters.generalStatus === '1' && genStatus !== 1) return false;
          if (filters.generalStatus === '0' && genStatus !== 0) return false;
       }

       if (filters.hasIndicators && filters.hasIndicators !== 'all') {
          const has = getIndicatorsStatus(p).hasIndicators;
          if (filters.hasIndicators === 'yes' && !has) return false;
          if (filters.hasIndicators === 'no' && has) return false;
       }

       if (filters.atRiskAny && filters.atRiskAny !== 'all') {
          const isAtRisk = (p.status === 'at_risk' || p._metrics?.pcStatus === 'overdue' || getMetricDeviation(p) < 0 || genStatus === 3);
          if (filters.atRiskAny === 'yes' && !isAtRisk) return false;
       }

       if (filters.quarter && filters.quarter !== 'all') {
          const hasQ = p._metrics?.planFactByQuarter.some(q => q.quarter === filters.quarter && (q.planWeight > 0 || q.factWeight > 0));
          if (!hasQ) return false;
       }

       return true;
     });
  }, [projects, filters, selectedExecutors, selectedDepts]);

  const sortedProjects = useMemo(() => {
    let sorted = [...filteredProjects];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

        switch (sortConfig.key) {
          case 'projectName': aVal = a.projectName; bVal = b.projectName; break;
          case 'deadlineAt': aVal = a.deadlineAt || 'Z'; bVal = b.deadlineAt || 'Z'; break;
          case 'pcStatus': aVal = a._metrics?.pcStatus || ''; bVal = b._metrics?.pcStatus || ''; break;
          case 'pcNextDate': aVal = a._metrics?.nextPcDate || 'Z'; bVal = b._metrics?.nextPcDate || 'Z'; break;
          case 'completeness': aVal = a._metrics?.significantCompletenessPercent || 0; bVal = b._metrics?.significantCompletenessPercent || 0; break;
          case 'progress': aVal = calculateTasksProgressForProject(a); bVal = calculateTasksProgressForProject(b); break;
          case 'deviation': aVal = getMetricDeviation(a); bVal = getMetricDeviation(b); break;
          case 'generalStatus': aVal = getGeneralStatusLevel(a); bVal = getGeneralStatusLevel(b); break;
          default:
            aVal = (a as any)[sortConfig.key];
            bVal = (b as any)[sortConfig.key];
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredProjects, sortConfig]);

  const uniqueStages = useMemo(() => Array.from(new Set(projects.map(p => p.stage).filter(Boolean))), [projects]);
  const uniqueExecutors = useMemo(() => Array.from(new Set(projects.map(p => p.executor).filter(Boolean))), [projects]);
  const uniqueOwners = useMemo(() => Array.from(new Set(projects.map(p => p.owner).filter(Boolean))), [projects]);

  // Dynamically extract unique departments, splitting values with ";" 
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    projects.forEach(p => {
      if (p.department) {
        p.department.split(";").forEach(d => {
          const dClean = d.trim();
          if (dClean && dClean.toLowerCase() !== "nan") depts.add(dClean);
        });
      }
    });
    return Array.from(depts);
  }, [projects]);

  const statusMap: Record<string, string> = {
    active: 'В работе',
    completed: 'Завершено',
    cancelled: 'Отменен',
    overdue: 'Просрочено',
    at_risk: 'Зона риска',
    unknown: 'Неизвестно'
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-[#010101]" /> : <ChevronDown size={12} className="text-[#010101]" />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Поиск по названию или исполнителю..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setFilters({...filters, search: e.target.value});
              }}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-base md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:block">Отображено: {sortedProjects.length}</p>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden flex-1 text-xs flex items-center justify-center gap-2 text-gray-700 bg-white border border-gray-200 py-3 rounded-xl cursor-pointer shadow-sm font-bold min-h-[44px]"
            >
              <SlidersHorizontal size={14} /> 
              <span>Фильтры</span>
              {activeFiltersCount > 0 && (
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black">{activeFiltersCount}</span>
              )}
            </button>
            <button onClick={() => {
              resetFilters();
              setFilters({
                search: '', status: 'all', stage: 'all', executor: 'all', department: 'all',
                owner: 'all', pcStatus: 'all', generalStatus: 'all', 
                quarter: 'all', hasIndicators: 'all', atRiskAny: 'all' 
              });
            }} className="flex-1 md:flex-initial text-xs flex items-center justify-center gap-2 text-gray-500 hover:text-red-500 transition-colors font-bold whitespace-nowrap bg-white border border-gray-200 px-4 py-3 md:py-2.5 rounded-xl cursor-pointer shadow-sm min-h-[44px] md:min-h-0">
              <FilterX size={16} /> Сбросить {isMobile ? '' : 'фильтры'}
            </button>
          </div>
        </div>

        {(showFilters || !isMobile) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Статус</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.status || 'all'} onChange={e => setFilters({...filters, status: e.target.value})}>
                 <option value="all">Все статусы</option>
                 <option value="active">В работе</option>
                 <option value="completed">Завершен</option>
                 <option value="cancelled">Отменен</option>
                 <option value="at_risk">Зона риска</option>
               </select>
             </div>

             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Стадия</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.stage || 'all'} onChange={e => setFilters({...filters, stage: e.target.value})}>
                 <option value="all">Все стадии</option>
                 {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>

             {/* Multi-Select Dropdown for Исполнитель (Руководитель) */}
             <MultiSelectDropdown 
               label="Руководитель" 
               options={uniqueExecutors} 
               selectedValues={selectedExecutors} 
               onChange={(vals) => setFilters({ ...filters, executor: vals })}
               placeholder="Все руководители"
             />

             {/* Multi-Select Dropdown for Подразделение (Department) */}
             <MultiSelectDropdown 
               label="Подразделение" 
               options={uniqueDepartments} 
               selectedValues={selectedDepts} 
               onChange={(vals) => setFilters({ ...filters, department: vals })}
               placeholder="Все подразделения"
             />

             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Заказчик</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.owner || 'all'} onChange={e => setFilters({...filters, owner: e.target.value})}>
                 <option value="all">Все заказчики</option>
                 {uniqueOwners.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>

             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Мониторинг ПК</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.pcStatus || 'all'} onChange={e => setFilters({...filters, pcStatus: e.target.value})}>
                 <option value="all">Любой статус ПК</option>
                 <option value="Своевременно">Своевременно</option>
                 <option value="Просрочен">Просрочен</option>
                 <option value="Недостаточно данных">Нет данных</option>
               </select>
             </div>

             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Квартал</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.quarter || 'all'} onChange={e => setFilters({...filters, quarter: e.target.value})}>
                 <option value="all">Все кварталы</option>
                 <option value="Q1">Есть Q1</option>
                 <option value="Q2">Есть Q2</option>
                 <option value="Q3">Есть Q3</option>
                 <option value="Q4">Есть Q4</option>
               </select>
             </div>

             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Управленческий статус</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.generalStatus || 'all'} onChange={e => setFilters({...filters, generalStatus: e.target.value})}>
                 <option value="all">Любой статус</option>
                 <option value="3">Критично / Риск</option>
                 <option value="2">Отстает / Внимание</option>
                 <option value="1">В норме</option>
                 <option value="0">Завершен</option>
               </select>
             </div>

             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Показатели</span>
               <select className="px-3 py-3 text-sm md:text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 min-h-[44px]" value={filters.hasIndicators || 'all'} onChange={e => setFilters({...filters, hasIndicators: e.target.value})}>
                 <option value="all">Показатели</option>
                 <option value="yes">Указаны</option>
                 <option value="no">Не указаны</option>
               </select>
             </div>
             
             <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
               <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest pl-1">Сквозной риск</span>
               <select className="px-3 py-3 text-sm md:text-xs font-black bg-red-50 text-red-700 border border-red-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500 min-h-[44px]" value={filters.atRiskAny || 'all'} onChange={e => setFilters({...filters, atRiskAny: e.target.value})}>
                 <option value="all">Все проекты</option>
                 <option value="yes">В зоне риска (сквозной)</option>
               </select>
             </div>
          </div>
        )}
      </div>

      {isMobile ? (
        <div className="p-4 space-y-4 bg-gray-50/30">
          {sortedProjects.map((p) => {
            const genLevel = getGeneralStatusLevel(p);
            const indStatus = getIndicatorsStatus(p);
            const completeness = Math.round(p._metrics?.significantCompletenessPercent || 0);
            
            // Use unified calculations module for rendering progress
            const milestoneProgressVal = calculateTasksProgressForProject(p);
            const kpiProgressVal = calculateKpisProgressForProject(p);
            const deviation = getMetricDeviation(p);

            return (
              <div key={p.projectId} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4 active:scale-[0.99] transition-transform">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-gray-900 text-base leading-snug break-words pr-2">{p.projectName}</p>
                    <div className={`px-2 py-1 rounded-lg border shrink-0 ${
                      genLevel === 3 ? 'bg-red-50 border-red-100/50 text-red-600' : 
                      genLevel === 2 ? 'bg-orange-50 border-orange-100/50 text-orange-600' : 
                      genLevel === 0 ? 'bg-gray-50 border-gray-100 text-gray-500' : 
                      'bg-emerald-50 border-emerald-100/50 text-emerald-600'
                    } text-[10px] font-black uppercase tracking-widest flex items-center gap-1`}>
                      {genLevel === 3 ? <AlertTriangle size={10} /> : genLevel === 2 ? <Info size={10} /> : <CheckCircle2 size={10} />}
                      {genLevel === 3 ? 'Риск' : genLevel === 2 ? 'Внимание' : genLevel === 0 ? 'Закрыт' : 'Норма'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.status === 'at_risk' ? 'bg-red-50 text-red-700 border-red-100' : p.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                      {statusMap[p.status] || p.status}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[150px]">{p.stage || 'Без стадии'}</span>
                    {p.projectUrl && (
                      <a href={p.projectUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-0.5 whitespace-nowrap bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg min-h-[30px]">
                        <ExternalLink size={10} /> Ссылка
                      </a>
                    )}
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest font-mono">Ответственные</p>
                    <div className="flex items-center gap-1 mt-1 text-gray-800 font-semibold truncate">
                      <User size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate">{p.executor || 'Не назначен'}</span>
                    </div>
                    {p.owner && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate pl-4">
                        <span className="font-bold text-gray-400">Заказчик:</span> {p.owner}
                      </p>
                    )}
                    {p.department && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate pl-4">
                        <span className="font-bold text-gray-400">Подразделение:</span> {p.department}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest font-mono">Дедлайн</p>
                    <p className={`font-bold mt-1 ${p.deadlineAt && (new Date() > (parseDateSafe(p.deadlineAt) || new Date('2099-01-01'))) && p.status !== 'completed' ? 'text-red-500' : 'text-gray-900'}`}>
                      {p.deadlineAt ? formatDateSafe(p.deadlineAt) : 'Нет дедлайна'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest font-mono">Статус ПК</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${p._metrics?.pcStatus === 'Своевременно' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : p._metrics?.pcStatus === 'Просрочен' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
                        {p._metrics?.pcStatus === 'Своевременно' ? <Activity size={8} /> : p._metrics?.pcStatus === 'Просрочен' ? <AlertTriangle size={8} /> : <Info size={8} />}
                        {p._metrics?.pcStatus || 'Нет данных'}
                      </span>
                    </div>
                    {p._metrics?.nextPcDate && (
                      <p className="text-[9px] text-gray-400 mt-1 font-medium">След ПК: {formatDateSafe(p._metrics.nextPcDate)}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest font-mono">Заполнение данных</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`font-black ${completeness >= 80 ? 'text-emerald-500' : completeness >= 50 ? 'text-orange-500' : 'text-red-500'}`}>{completeness}%</span>
                      <span className={`text-[10px] font-bold truncate ${indStatus.color === 'green' ? 'text-emerald-500' : indStatus.color === 'yellow' ? 'text-orange-500' : indStatus.color === 'red' ? 'text-red-500' : 'text-gray-400'}`} title={indStatus.text}>
                        ({indStatus.text})
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Прогресс по вехам</span>
                      <span className="font-black text-gray-900">{Math.round(milestoneProgressVal)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                        <div className="h-full bg-blue-500" style={{width: `${Math.min(100, Math.max(0, milestoneProgressVal))}%`}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Выполнение показателей</span>
                      <span className="font-black text-gray-900">{kpiProgressVal !== null ? `${Math.round(kpiProgressVal)}%` : '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {kpiProgressVal !== null ? (
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                          <div className="h-full bg-emerald-500" style={{width: `${Math.min(100, Math.max(0, kpiProgressVal))}%`}}></div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium italic">Показатели не настроены</span>
                      )}
                      <span className={`text-[11px] font-black shrink-0 ${deviation < -10 ? 'text-red-500' : deviation < 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {deviation < 0 ? `Откл: ${deviation.toFixed(1)}%` : 'В графике'}
                      </span>
                    </div>
                  </div>
                </div>

                {p.lastAnalysis && (
                  <p className="text-[9px] text-emerald-600 bg-emerald-50/50 border border-emerald-100 py-1.5 px-2.5 rounded-xl font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={10} /> ИИ Экспресс-анализ выполнен
                  </p>
                )}

                <button 
                  onClick={() => onSelectProject(p.projectId)}
                  className="w-full bg-[#010101] text-white py-3.5 text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors rounded-xl cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
                >
                  Открыть карточку проекта
                </button>
              </div>
            );
          })}

          {sortedProjects.length === 0 && (
            <div className="py-16 text-center bg-white rounded-3xl border border-gray-100 p-6 flex flex-col items-center justify-center gap-4 text-gray-400">
              <FilterX size={44} className="opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest text-[#011]">Проекты не найдены</p>
              <button onClick={() => {
                resetFilters();
                setFilters({
                  search: '', status: 'all', stage: 'all', executor: 'all', department: 'all',
                  owner: 'all', pcStatus: 'all', generalStatus: 'all', 
                  quarter: 'all', hasIndicators: 'all', atRiskAny: 'all' 
                });
              }} className="mt-2 text-xs font-black text-blue-500 hover:text-blue-600 uppercase tracking-widest min-h-[44px] px-6 py-2 border border-blue-100 rounded-xl bg-blue-50/30">Сбросить все фильтры</button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 font-mono">
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('projectName')}>
                  <div className="flex items-center gap-2 font-black">Проект <SortIcon column="projectName" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('executor')}>
                  <div className="flex items-center gap-2 font-black">Участники <SortIcon column="executor" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('deadlineAt')}>
                  <div className="flex items-center gap-2 font-black">Сроки <SortIcon column="deadlineAt" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('pcStatus')}>
                  <div className="flex items-center gap-2 font-black">Статус ПК <SortIcon column="pcStatus" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('completeness')}>
                  <div className="flex items-center gap-2 font-black">Данные <SortIcon column="completeness" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('progress')}>
                  <div className="flex items-center gap-2 font-black">Выполнение <SortIcon column="progress" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-[#010101] transition-colors" onClick={() => handleSort('generalStatus')}>
                  <div className="flex items-center gap-2 font-black">Общий статус <SortIcon column="generalStatus" /></div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center font-black">Анализ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedProjects.map((p) => {
                const genLevel = getGeneralStatusLevel(p);
                const indStatus = getIndicatorsStatus(p);
                const completeness = Math.round(p._metrics?.significantCompletenessPercent || 0);
                
                // Use unified calculations module for rendering progress values safely
                const milestoneProgressVal = calculateTasksProgressForProject(p);
                const kpiProgressVal = calculateKpisProgressForProject(p);
                const deviation = getMetricDeviation(p);

                return (
                  <tr key={p.projectId} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-4 align-top max-w-[280px]">
                      <div className="flex flex-col gap-2">
                         <p className="font-bold text-[#011] text-sm whitespace-normal leading-snug">{p.projectName}</p>
                         <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.status === 'at_risk' ? 'bg-red-50 text-red-700 border-red-100' : p.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                              {statusMap[p.status] || p.status}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-500 truncate max-w-[120px]" title={p.stage}>{p.stage || 'Стадия не указана'}</span>
                            {p.projectUrl && (
                              <a href={p.projectUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors bg-gray-100 px-2 py-0.5 rounded">
                                <ExternalLink size={10} /> URL
                              </a>
                            )}
                         </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1.5 font-sans">
                        <div className="flex items-center gap-1.5 text-xs">
                          <User size={12} className="text-gray-400 shrink-0" />
                          <span className="font-semibold text-gray-900 truncate max-w-[150px]" title={p.executor}>{p.executor || 'Не назначен'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span className="font-bold px-1 bg-gray-100 rounded">П:</span> 
                          <span className="truncate max-w-[130px] font-semibold text-gray-600" title={p.owner}>{p.owner || '—'}</span>
                        </div>
                        {p.department && (
                          <div className="text-[10px] text-gray-400 italic max-w-[150px] truncate" title={p.department}>
                             {p.department}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-bold ${p.deadlineAt && (new Date() > (parseDateSafe(p.deadlineAt) || new Date('2099-01-01'))) && p.status !== 'completed' ? 'text-red-500' : 'text-gray-900'}`}>
                          {p.deadlineAt ? formatDateSafe(p.deadlineAt) : 'Нет дедлайна'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded w-max ${p._metrics?.pcStatus === 'Своевременно' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : p._metrics?.pcStatus === 'Просрочен' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
                          {p._metrics?.pcStatus === 'Своевременно' ? <Activity size={10} /> : p._metrics?.pcStatus === 'Просрочен' ? <AlertTriangle size={10} /> : <Info size={10} />}
                          {p._metrics?.pcStatus || 'Нет данных'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold whitespace-nowrap">След: {p._metrics?.nextPcDate ? formatDateSafe(p._metrics.nextPcDate) : '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex gap-4">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm font-black ${completeness >= 80 ? 'text-emerald-500' : completeness >= 50 ? 'text-orange-500' : 'text-red-500'}`}>{completeness}%</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest whitespace-nowrap">Данные</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${indStatus.color === 'green' ? 'text-emerald-500' : indStatus.color === 'yellow' ? 'text-orange-500' : indStatus.color === 'red' ? 'text-red-500' : 'text-gray-400'}`}>
                            <BarChart size={14} />
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest whitespace-nowrap max-w-[80px] truncate mt-0.5" title={indStatus.text}>{indStatus.text}</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* Columns representing completion rate for tasks/milestones & indicators using imported projectCalculations safely */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1 w-28 font-sans">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                          <span>Вехи:</span>
                          <span className="font-bold text-gray-900">{Math.round(milestoneProgressVal)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 animate-pulse-subtle" style={{ width: `${Math.min(100, Math.max(0, milestoneProgressVal))}%` }}></div>
                        </div>
                        
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mt-1">
                          <span>Количеств:</span>
                          <span className="font-bold text-gray-900">
                            {kpiProgressVal !== null ? `${Math.round(kpiProgressVal)}%` : '—'}
                          </span>
                        </div>
                        {kpiProgressVal !== null ? (
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, kpiProgressVal))}%` }}></div>
                          </div>
                        ) : (
                          <span className="text-[9px] text-gray-400 italic">не заданы</span>
                        )}

                        <span className={`text-[10px] font-bold mt-1 inline-block ${deviation < -10 ? 'text-red-500' : deviation < 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                          {deviation < 0 ? `Откл: ${deviation.toFixed(1)}%` : 'В графике'}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className={`px-2 py-1.5 rounded-lg border inline-flex flex-col justify-center min-w-[100px] ${
                          genLevel === 3 ? 'bg-red-50 border-red-100/50' : 
                          genLevel === 2 ? 'bg-orange-50 border-orange-100/50' : 
                          genLevel === 0 ? 'bg-gray-50 border-gray-100' : 
                          'bg-emerald-50 border-emerald-100/50'
                      }`}>
                          <div className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${
                              genLevel === 3 ? 'text-red-600' : 
                              genLevel === 2 ? 'text-orange-600' : 
                              genLevel === 0 ? 'text-gray-500' : 
                              'text-emerald-600'
                          }`}>
                             {genLevel === 3 ? <AlertTriangle size={12} className="shrink-0" /> : genLevel === 2 ? <Info size={12} className="shrink-0" /> : genLevel === 0 ? <CheckCircle2 size={12} className="shrink-0" /> : <CheckCircle2 size={12} className="shrink-0" />}
                             {genLevel === 3 ? 'Риск' : genLevel === 2 ? 'Внимание' : genLevel === 0 ? 'Закрыт' : 'Норма'}
                          </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top w-24 border-l border-gray-50 font-sans">
                      <button 
                        onClick={() => onSelectProject(p.projectId)}
                        className="w-full bg-[#010101] text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors rounded-lg cursor-pointer flex items-center justify-center gap-1"
                      >
                        Карточка
                      </button>
                      {p.lastAnalysis && (
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-1">
                          <CheckCircle2 size={8} /> Проанализирован
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedProjects.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
                      <FilterX size={48} className="opacity-20" />
                      <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Проекты не найдены</p>
                      <button onClick={() => {
                        resetFilters();
                        setFilters({
                          search: '', status: 'all', stage: 'all', executor: 'all', department: 'all',
                          owner: 'all', pcStatus: 'all', generalStatus: 'all', 
                          quarter: 'all', hasIndicators: 'all', atRiskAny: 'all' 
                        });
                      }} className="mt-2 text-xs font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest">Сбросить все фильтры</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
