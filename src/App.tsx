/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  RefreshCw, 
  Loader2, 
  AlertTriangle,
  LayoutDashboard,
  ListTodo,
  Map as LucideMap,
  Download,
  ArrowLeft,
  FileText,
  CheckCircle,
  Info,
  X
} from 'lucide-react';
import { Project, Stats } from './types';
import { Overview } from './components/Overview';
import { ProjectTable } from './components/ProjectTable';
import { Roadmap } from './components/Roadmap';
import { ProjectCard } from './components/ProjectCard';
import { Login } from './components/Login';
import { LogOut } from 'lucide-react';
import { exportPortfolioToPDF } from './utils/pdfExport';
import { ChatAssistantWidget } from './components/ChatAssistantWidget';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isManualSync, setIsManualSync] = useState(false);
  const [exportingPortfolioPdf, setExportingPortfolioPdf] = useState(false);
  const [portfolioPdfError, setPortfolioPdfError] = useState<string | null>(null);
  const [syncNotification, setSyncNotification] = useState<{
    message: string;
    type: "success" | "warning" | "info";
  } | null>(null);
  const [dataSource, setDataSource] = useState<any>(null);

  const [filters, setFilters] = useState<any>({
    search: '',
    status: 'all',
    stage: 'all',
    executor: 'all',
    owner: 'all',
    pcStatus: 'all',
    generalStatus: 'all',
    quarter: 'all',
    hasIndicators: 'all',
    atRiskAny: 'all'
  });

  // 1. Check Authenticated on Mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await response.json();
        setIsAuthenticated(!!data.authenticated);
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuthStatus();
  }, []);

  // 2. Fetch Projects only when Authenticated
  useEffect(() => {
    if (isAuthenticated !== true) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects?_ts=${Date.now()}`, { 
          credentials: 'include',
          cache: 'no-store'
        });
        if (response.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        if (!response.ok) throw new Error('Не удалось загрузить данные из системы');
        const data = await response.json();
        if (data.success) {
          setProjects(data.projects);
          setStats(data.stats);
          setDataSource(data.dataSource || null);

          // If a selected project no longer exists in current items, return to view and notify
          if (selectedProjectId && !data.projects.some((p: any) => p.projectId === selectedProjectId)) {
            setSelectedProjectId(null);
            setSyncNotification({
              message: "Текущий выбранный проект больше не найден в системе и был закрыт.",
              type: "warning"
            });
          } else if (data.warning) {
            if (isManualSync) {
              setSyncNotification({
                message: "Не удалось синхронизировать данные. Попробуйте позже.",
                type: "warning"
              });
            } else {
              setSyncNotification(null);
            }
          } else if (data.sync) {
            setSyncNotification(null);
          } else {
            setSyncNotification(null);
          }
        } else {
          throw new Error(data.error || 'Ошибка загрузки');
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        setIsManualSync(false);
      }
    };
    fetchData();
  }, [refreshTrigger, isAuthenticated]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      // ignore
    }
    setIsAuthenticated(false);
    setProjects([]);
    setStats(null);
    setSelectedProjectId(null);
  };

  const handleRefresh = () => {
    setIsManualSync(true);
    setLastRefreshed(new Date());
    setRefreshTrigger(prev => prev + 1);
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Название", "Исполнитель", "Статус", "Дедлайн"];
    const rows = filteredProjects.map(p => [
      p.projectId, 
      p.projectName, 
      p.executor || "—", 
      p.status, 
      p.deadlineAt || "—"
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    XLSX.writeFile(wb, `projects_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filters.search && !p.projectName.toLowerCase().includes(filters.search.toLowerCase()) && !(p.executor || "").toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.status !== 'all' && p.status !== filters.status) return false;
      if (filters.stage !== 'all' && p.stage !== filters.stage) return false;
      return true;
    });
  }, [projects, filters]);

  const handleExportPortfolioPDF = async () => {
    setExportingPortfolioPdf(true);
    setPortfolioPdfError(null);
    try {
      await exportPortfolioToPDF(filteredProjects, stats);
    } catch (err: any) {
      setPortfolioPdfError(`Не удалось сформировать PDF портфеля: ${err.message || String(err)}`);
    } finally {
      setExportingPortfolioPdf(false);
    }
  };

  const selectedProject = useMemo(() => {
    return projects.find(p => p.projectId === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  if (isCheckingAuth || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-6">
        <div className="relative">
          <Loader2 className="animate-spin text-[#010101]" size={64} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#FBDF4B] rounded-lg border border-black/10 flex items-center justify-center overflow-hidden">
            <div className="w-6 h-6 border-[1.5px] border-black rounded-full flex items-center justify-center">
              <span className="text-black font-black text-[8px] tracking-tight">AI</span>
            </div>
          </div>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 animate-pulse">Проверка авторизации...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-6">
        <div className="relative">
          <Loader2 className="animate-spin text-[#010101]" size={64} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#FBDF4B] rounded-lg border border-black/10 flex items-center justify-center overflow-hidden">
            <div className="w-6 h-6 border-[1.5px] border-black rounded-full flex items-center justify-center">
              <span className="text-black font-black text-[8px] tracking-tight">AI</span>
            </div>
          </div>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 animate-pulse font-mono">Анализ проектов AI 2.0</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-6 p-12 text-center">
        <div className="p-8 bg-red-50 rounded-full">
          <AlertTriangle className="text-red-500" size={64} />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 mb-2">Обнаружен сбой системы</h2>
          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">{error}</p>
          <button 
            onClick={handleRefresh}
            className="w-full bg-[#010101] text-white px-8 py-4 text-xs font-black uppercase tracking-[0.3em] hover:bg-gray-800 transition-all rounded-xl shadow-xl hover:shadow-2xl active:scale-95 text-center"
          >
            Восстановить соединение
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-[#011] selection:bg-[#F8BC03]/30 overflow-x-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 sticky top-0 z-50 transition-all">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {selectedProjectId ? (
            <button 
              onClick={() => setSelectedProjectId(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FBDF4B] rounded-2xl flex items-center justify-center shadow-lg rotate-3 hover:rotate-0 transition-transform overflow-hidden border border-black/5">
              <div className="w-7 h-7 md:w-9 md:h-9 border-2 border-black rounded-full flex items-center justify-center">
                <span className="text-black font-black text-xs md:text-sm tracking-tighter">AI</span>
              </div>
            </div>
          )}
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter text-[#011] uppercase leading-none mb-1">
              Проектный Аналитик 2.0
            </h1>
            <p className="text-gray-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] leading-none mt-0.5">
              Синхронизация: {lastRefreshed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} • {lastRefreshed.toLocaleDateString('ru-RU')}
            </p>
          </div>
        </div>

        {!selectedProjectId && (
          <nav className="w-full md:w-auto flex-1 flex items-center justify-start md:justify-center gap-1.5 md:gap-2 overflow-x-auto whitespace-nowrap py-1 relative scrollbar-none print:hidden">
            {[
              { id: 'overview', label: 'Обзор портфеля', icon: LayoutDashboard },
              { id: 'analytics', label: 'Портфель проектов', icon: ListTodo },
              { id: 'roadmap', label: 'Дорожная карта', icon: LucideMap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer shrink-0 ${
                  activeTab === tab.id 
                  ? 'bg-[#010101] text-[#F8BC03] shadow-lg md:scale-105' 
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100 bg-gray-50/50'
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5 md:gap-3 w-full md:w-auto print:hidden">
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-1.5 bg-white border border-gray-100 text-[#011] px-3.5 py-2.5 md:px-5 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm rounded-xl cursor-pointer"
          >
            <RefreshCw size={12} /> Синхронизация
          </button>
          {!selectedProjectId && (
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-[#010101] text-white px-3.5 py-2.5 md:px-5 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl rounded-xl cursor-pointer"
            >
              <Download size={12} />  Экспорт
            </button>
          )}
          {!selectedProjectId && activeTab === 'overview' && (
            <button 
              onClick={handleExportPortfolioPDF}
              disabled={exportingPortfolioPdf}
              className="flex items-center gap-1.5 bg-[#FBDF4B] text-[#010101] px-3.5 py-2.5 md:px-5 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-[#F8BC03] transition-all shadow-xl rounded-xl cursor-pointer disabled:opacity-50"
              title="Экспорт PDF отчета по обзору портфеля"
            >
              {exportingPortfolioPdf ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={12} />
              )}
              <span>{exportingPortfolioPdf ? 'Формирование...' : 'Отчет PDF'}</span>
            </button>
          )}
          {portfolioPdfError && (
            <div className="text-red-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse w-full text-center">{portfolioPdfError}</div>
          )}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-white border border-red-100 text-red-600 px-3.5 py-2.5 md:px-5 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:border-red-200 transition-all shadow-sm rounded-xl cursor-pointer"
            title="Выйти из системы"
          >
            <LogOut size={12} /> Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 bg-gray-50/30 w-full max-w-full overflow-x-hidden">
        {syncNotification && (
          <div className={`p-4 rounded-xl flex items-start gap-4 border shadow-sm transition-all duration-300 ${
            syncNotification.type === 'success' ? 'bg-emerald-50/70 border-emerald-100 text-emerald-900' 
            : syncNotification.type === 'warning' ? 'bg-amber-50/80 border-amber-200 text-amber-900'
            : 'bg-blue-50/70 border-blue-100 text-blue-900'
          }`}>
            <div className="shrink-0 mt-0.5">
              {syncNotification.type === 'success' && <CheckCircle className="text-emerald-600" size={18} />}
              {syncNotification.type === 'warning' && <AlertTriangle className="text-amber-600" size={18} />}
              {syncNotification.type === 'info' && <Info className="text-blue-600" size={18} />}
            </div>
            <div className="flex-1 text-[10px] md:text-xs font-black uppercase tracking-wider leading-relaxed flex items-center">
              <span className="flex-1">{syncNotification.message}</span>
            </div>
            <button 
              onClick={() => setSyncNotification(null)}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer text-gray-400 hover:text-gray-900 shrink-0"
              title="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {selectedProjectId && selectedProject ? (
          <ProjectCard project={selectedProject} onRefresh={handleRefresh} />
        ) : (
          <>
            {activeTab === 'overview' && stats && <Overview stats={stats} projects={projects} />}
            {activeTab === 'analytics' && (
              <ProjectTable 
                projects={projects} 
                filters={filters} 
                setFilters={setFilters} 
                resetFilters={() => setFilters({ 
                  search: '', status: 'all', stage: 'all', executor: 'all', 
                  owner: 'all', pcStatus: 'all', generalStatus: 'all', 
                  quarter: 'all', hasIndicators: 'all', atRiskAny: 'all' 
                })}
                onSelectProject={setSelectedProjectId}
              />
            )}
            {activeTab === 'roadmap' && <Roadmap projects={projects} />}
          </>
        )}
      </main>

      <ChatAssistantWidget />
    </div>
  );
}
