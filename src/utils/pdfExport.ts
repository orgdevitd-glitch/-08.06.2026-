import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Project, ProjectAnalysisResult, Stats } from '../types';
import { formatDateSafe } from './dateUtils';

// Helper to translate severity to Russian
function translateSeverity(sev: string): string {
  const s = String(sev).toLowerCase().trim();
  if (s === 'low' || s === 'низкая') return 'Низкая';
  if (s === 'medium' || s === 'средняя') return 'Средняя';
  if (s === 'high' || s === 'высокая') return 'Высокая';
  if (s === 'critical' || s === 'критическая') return 'Критическая';
  return s || 'Не указана';
}

// Map English statuses to Russian
const RUSSIAN_STATUS_MAP: Record<string, string> = {
  active: 'В работе',
  completed: 'Завершено',
  cancelled: 'Отменен',
  overdue: 'Просрочен',
  at_risk: 'Зона риска',
  unknown: 'Неизвестно',
  not_started: 'Не начат',
  risk: 'Зона риска',
  ok: 'Норма'
};

/**
 * EXPORT SINGLE PROJECT TO PDF
 * Generates an elegant, highly structured, clean publication-quality A4 report
 */
export async function exportProjectToPDF(
  project: Project,
  analysis: ProjectAnalysisResult | null
): Promise<void> {
  const assessmentDate = formatDateSafe(new Date().toISOString());
  const hasAnalysis = !!analysis;
  const totalPages = hasAnalysis ? 3 : 1;

  // Create clean containing offscreen DOM element
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-99999px';
  container.style.top = '-99999px';
  container.style.width = '850px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = '#f3f4f6';

  // Define contents of Page 1
  let page1HTML = `
    <div class="pdf-page" style="width: 850px; height: 1200px; padding: 45px 50px; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; margin-bottom: 20px;">
      <div>
        <!-- Header Accent -->
        <div style="height: 6px; background-color: #F8BC03; margin-bottom: 25px; border-radius: 4px;"></div>

        <!-- Title Block -->
        <div style="margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af; font-family: -apple-system, sans-serif;">
              Инвестиционный паспорт проекта • ${assessmentDate}
            </span>
            <span style="padding: 4px 10px; background: #111827; color: #F8BC03; border-radius: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, sans-serif;">
              ${RUSSIAN_STATUS_MAP[project.status] || project.status}
            </span>
          </div>
          <h1 style="font-size: 22px; font-weight: 800; color: #010101; line-height: 1.25; margin: 0 0 8px 0; letter-spacing: -0.02em; font-family: -apple-system, sans-serif;">
            ${project.projectName}
          </h1>
          ${project.stage ? `<span style="font-size: 11px; font-weight: 700; color: #4b5563; background: #f3f4f6; padding: 3px 8px; border-radius: 4px; font-family: -apple-system, sans-serif;">Стадия: ${project.stage}</span>` : ''}
        </div>

        <!-- Overview info grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #f3f4f6; font-family: -apple-system, sans-serif;">
          <div>
            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; margin: 0 0 8px 0; letter-spacing: 0.05em;">Участники реализации</h3>
            <p style="font-size: 12px; margin: 0 0 5px 0; color: #374151;"><strong>Постановщик:</strong> ${project.owner || 'Не указан'}</p>
            <p style="font-size: 12px; margin: 0; color: #374151;"><strong>Исполнитель:</strong> ${project.executor || 'Не указан'}</p>
            ${project.coExecutors && project.coExecutors.length > 0 ? `<p style="font-size: 11px; margin: 4px 0 0 0; color: #4b5563;"><strong>Соисполнители:</strong> ${project.coExecutors.join(', ')}</p>` : ''}
          </div>
          <div>
            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; margin: 0 0 8px 0; letter-spacing: 0.05em;">Сроки и полнота паспорта</h3>
            <p style="font-size: 12px; margin: 0 0 5px 0; color: #374151;"><strong>Дата старта:</strong> ${project.startDate ? formatDateSafe(project.startDate) : 'Не указана'}</p>
            <p style="font-size: 12px; margin: 0 0 5px 0; color: #374151;"><strong>Итоговый дедлайн:</strong> ${project.deadlineAt ? formatDateSafe(project.deadlineAt) : 'Не указан'}</p>
            <p style="font-size: 12px; margin: 0; color: #374151;"><strong>Оценка полноты паспорта:</strong> ${project._metrics?.significantCompletenessPercent !== null && project._metrics?.significantCompletenessPercent !== undefined ? `${Math.round(project._metrics.significantCompletenessPercent)}%` : 'Не определено'}</p>
          </div>
        </div>

        <!-- Goals and desc -->
        <div style="margin-bottom: 20px; font-family: -apple-system, sans-serif;">
          <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #010101; border-left: 3px solid #F8BC03; padding-left: 8px; margin: 0 0 8px 0; letter-spacing: 0.05em;">
            Цели и Описание проекта
          </h2>
          <p style="font-size: 12px; color: #4b5563; margin: 0 0 10px 0; line-height: 1.5;">
            ${project.projectDescription || 'Сведения в паспорте отсутствуют.'}
          </p>
          ${project.goals && project.goals.length > 0 ? `
            <div style="background: #ffffff; border: 1px solid #f3f4f6; padding: 10px 15px; border-radius: 10px;">
              <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #9ca3af; margin: 0 0 5px 0;">Ключевые ориентиры</p>
              <ul style="margin: 0; padding-left: 15px; font-size: 11px; color: #374151;">
                ${project.goals.slice(0, 3).map(g => `<li style="margin-bottom: 3px;">${g}</li>`).join('')}
                ${project.goals.length > 3 ? `<li style="color: #9ca3af; font-style: italic;">И еще ${project.goals.length - 3}...</li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Resources Info -->
        <div style="margin-bottom: 20px; font-family: -apple-system, sans-serif;">
          <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #010101; border-left: 3px solid #F8BC03; padding-left: 8px; margin: 0 0 8px 0; letter-spacing: 0.05em;">
            Обеспеченность ресурсами
          </h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #fafafa; border: 1px solid #f3f4f6; padding: 12px; border-radius: 10px;">
            <div>
              <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #9ca3af; display: block; margin-bottom: 2px;">Объем требуемых ресурсов</span>
              <span style="font-size: 12px; font-weight: 700; color: #1f2937;">${project.resourceValue || 'Данные о ресурсах не переданы'}</span>
            </div>
            <div>
              <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #9ca3af; display: block; margin-bottom: 2px;">Уровень обеспеченности ресурсами</span>
              <span style="font-size: 12px; font-weight: 700; color: #1f2937;">${project.resourceLevel || 'Оценка уровня ресурсов не зафиксирована'}</span>
            </div>
          </div>
        </div>

        <!-- Tasks and Milestones Table -->
        <div style="margin-bottom: 20px; font-family: -apple-system, sans-serif;">
          <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #010101; border-left: 3px solid #F8BC03; padding-left: 8px; margin: 0 0 10px 0; letter-spacing: 0.05em;">
            Этапы, задачи и вехи реализации
          </h2>
          ${project.tasks && project.tasks.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
              <thead>
                <tr style="background: #f4f4f5; border-bottom: 2px solid #e4e4e7;">
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827;">Название задачи / этапа</th>
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 80px;">Квартал</th>
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 110px;">Статус выполнения</th>
                </tr>
              </thead>
              <tbody>
                ${project.tasks.slice(0, 6).map(t => `
                  <tr style="border-bottom: 1px solid #f4f4f5;">
                    <td style="padding: 8px 10px; color: #374151; font-weight: 600;">
                      ${t.isMilestone ? `<span style="font-size: 8px; font-weight: 900; background: #FBDF4B; padding: 1px 3px; border-radius: 3px; margin-right: 5px;">ВЕХА</span>` : ''}
                      ${t.title}
                    </td>
                    <td style="padding: 8px 10px; color: #6b7280; font-weight: 700;">${t.quarter || '—'}</td>
                    <td style="padding: 8px 10px; color: #374151;">${t.status || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${project.tasks.length > 6 ? `<p style="font-size: 9px; color: #9ca3af; margin: 4px 0 0 0; font-style: italic;">Показаны первые 6 задач из ${project.tasks.length}.</p>` : ''}
          ` : '<p style="font-size: 11px; color: #9ca3af; font-style: italic; border: 1px dashed #d1d5db; padding: 10px; border-radius: 10px; text-align: center; margin: 0;">Задачи и контрольные точки не заданы в карточке проекта.</p>'}
        </div>

        <!-- Indicators KPI Table -->
        <div style="margin-bottom: 20px; font-family: -apple-system, sans-serif;">
          <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #010101; border-left: 3px solid #F8BC03; padding-left: 8px; margin: 0 0 10px 0; letter-spacing: 0.05em;">
            Показатели эффективности проекта (KPI)
          </h2>
          ${project.indicators && project.indicators.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
              <thead>
                <tr style="background: #f4f4f5; border-bottom: 2px solid #e4e4e7;">
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827;">Показатель эффективности</th>
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 90px; text-align: right;">План</th>
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 90px; text-align: right;">Факт</th>
                  <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 70px; text-align: center;">Ед. изм.</th>
                </tr>
              </thead>
              <tbody>
                ${project.indicators.slice(0, 4).map(ind => `
                  <tr style="border-bottom: 1px solid #f4f4f5;">
                    <td style="padding: 8px 10px; color: #374151; font-weight: 600;">${ind.name}</td>
                    <td style="padding: 8px 10px; color: #374151; text-align: right;">${ind.planValue !== undefined && ind.planValue !== null ? ind.planValue : '—'}</td>
                    <td style="padding: 8px 10px; color: #1e3a8a; font-weight: 700; text-align: right;">${ind.factValue !== undefined && ind.factValue !== null ? ind.factValue : '—'}</td>
                    <td style="padding: 8px 10px; color: #6b7280; text-align: center;">${ind.unit || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${project.indicators.length > 4 ? `<p style="font-size: 9px; color: #9ca3af; margin: 4px 0 0 0; font-style: italic;">Показаны первые 4 показателей из ${project.indicators.length}.</p>` : ''}
          ` : '<p style="font-size: 11px; color: #9ca3af; font-style: italic; border: 1px dashed #d1d5db; padding: 10px; border-radius: 10px; text-align: center; margin: 0;">Показатели KPI не заданы или отсутствуют в переданных данных.</p>'}
        </div>
      </div>

      <!-- Footer Banners -->
      <div>
        ${hasAnalysis ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-family: -apple-system, sans-serif;">
            <span style="font-size: 14px;">💡</span>
            <span style="font-size: 11px; color: #1e40af; font-weight: 600; line-height: 1.4;">
              Интеллектуальный анализ выполнен. Развернутые выводы приведены на следующих страницах.
            </span>
          </div>
        ` : `
          <div style="background: #fafafa; border: 1.5px dashed #d1d5db; border-radius: 10px; padding: 12px 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-family: -apple-system, sans-serif;">
            <span style="font-size: 14px;">ℹ️</span>
            <span style="font-size: 11px; color: #4b5563; font-weight: 500; line-height: 1.4;">
              Интеллектуальный ИИ-анализ проекта еще не проводился. Запустите анализ в панели ассистента для формирования развернутых выводов и приоритетов.
            </span>
          </div>
        `}

        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; font-family: monospace; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          <span>Страница 1 из ${totalPages}</span>
          <span>КОНФИДЕНЦИАЛЬНО • ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ</span>
        </div>
      </div>
    </div>
  `;

  let page2HTML = '';
  let page3HTML = '';

  if (hasAnalysis && analysis) {
    page2HTML = `
      <div class="pdf-page" style="width: 850px; height: 1200px; padding: 45px 50px; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; margin-bottom: 20px;">
        <div>
          <!-- Header Accent -->
          <div style="height: 6px; background-color: #3b82f6; margin-bottom: 25px; border-radius: 4px;"></div>
          
          <div style="margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; font-family: -apple-system, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af;">
                Аналитический разбор проекта • ${assessmentDate}
              </span>
              <span style="font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase; font-family: monospace;">
                Дата выполнения: ${formatDateSafe(analysis.createdAt)}
              </span>
            </div>
            <h1 style="font-size: 20px; font-weight: 800; color: #010101; line-height: 1.25; margin: 0; letter-spacing: -0.02em;">
              Управленческий анализ проекта
            </h1>
          </div>

          <!-- Short Analysis Summary Grid -->
          <div style="margin-bottom: 25px; font-family: -apple-system, sans-serif;">
            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; margin: 0 0 10px 0; letter-spacing: 0.05em;">Сводные результаты мониторинга</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11px;">
              <div style="padding: 10px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="color: #4b5563; display: block; margin-bottom: 2px;">Полнота заполнения карточки:</strong>
                <span style="color: #111827; font-weight: 600;">${analysis.shortAnalysis.dataCompleteness || '—'}</span>
              </div>
              <div style="padding: 10px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="color: #4b5563; display: block; margin-bottom: 2px;">Своевременность заседаний ПК:</strong>
                <span style="color: #111827; font-weight: 600;">${analysis.shortAnalysis.pcTimeliness || '—'}</span>
              </div>
              <div style="padding: 10px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="color: #4b5563; display: block; margin-bottom: 2px;">Рекомендуемая дата следующего ПК:</strong>
                <span style="color: #111827; font-weight: 600;">${analysis.shortAnalysis.nextPcDate ? formatDateSafe(analysis.shortAnalysis.nextPcDate) : 'Не назначена'}</span>
              </div>
              <div style="padding: 10px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="color: #4b5563; display: block; margin-bottom: 2px;">Прогресс выполнения задач:</strong>
                <span style="color: #111827; font-weight: 600;">${analysis.shortAnalysis.weightedTaskProgress || '—'}</span>
              </div>
              <div style="padding: 10px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="color: #4b5563; display: block; margin-bottom: 2px;">Отклонение от графика:</strong>
                <span style="color: #111827; font-weight: 600;">${analysis.shortAnalysis.deviation || '—'}</span>
              </div>
              <div style="padding: 10px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="color: #4b5563; display: block; margin-bottom: 2px;">Статус показателей эффективности:</strong>
                <span style="color: #111827; font-weight: 600;">${analysis.shortAnalysis.indicators || '—'}</span>
              </div>
            </div>
          </div>

          <!-- Key Problems Table -->
          <div style="margin-bottom: 25px; font-family: -apple-system, sans-serif;">
            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; margin: 0 0 10px 0; letter-spacing: 0.05em;">Выявленные дефекты и проблемы</h3>
            ${analysis.keyProblems && analysis.keyProblems.length > 0 ? `
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #f4f4f5; border-bottom: 2px solid #e4e4e7;">
                    <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 40%;">Проблема</th>
                    <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 40%;">Управленческая оценка</th>
                    <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 20%; text-align: center;">Критичность</th>
                  </tr>
                </thead>
                <tbody>
                  ${analysis.keyProblems.map(p => {
                    let badgeStyle = 'background-color: #f3f4f6; color: #374151;';
                    const ruSev = translateSeverity(p.severity);
                    if (ruSev === 'Средняя') badgeStyle = 'background-color: #fef3c7; color: #92400e;';
                    if (ruSev === 'Высокая') badgeStyle = 'background-color: #fee2e2; color: #991b1b;';
                    if (ruSev === 'Критическая') badgeStyle = 'background-color: #fee2e2; color: #b91c1c; font-weight: 700;';
                    
                    return `
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 10px; color: #111827; font-weight: 600; line-height: 1.4;">${p.problem}</td>
                        <td style="padding: 8px 10px; color: #4b5563; line-height: 1.4;">${p.managementAssessment}</td>
                        <td style="padding: 8px 10px; text-align: center;">
                          <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 700; uppercase; ${badgeStyle}">
                            ${ruSev}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : `<p style="font-size: 11px; color: #047857; font-weight: bold; background: #ecfdf5; padding: 10px; border-radius: 8px; margin: 0;">Проблем и дефектов в карточке проекта не обнаружено.</p>`}
          </div>

          <!-- Management Conclusion -->
          <div style="margin-bottom: 25px; background: #fafafa; border-radius: 10px; padding: 12px 15px; border-left: 4px solid #3b82f6; font-family: -apple-system, sans-serif;">
            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #4b5563; margin: 0 0 6px 0; letter-spacing: 0.05em;">Системный управленческий вывод</h3>
            <p style="font-size: 11.5px; font-style: italic; color: #111827; margin: 0; line-height: 1.5;">“ ${analysis.managementConclusion} ”</p>
          </div>

          <!-- Priority Actions Table -->
          <div style="margin-bottom: 20px; font-family: -apple-system, sans-serif;">
            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; margin: 0 0 10px 0; letter-spacing: 0.05em;">Рекомендованные приоритетные задачи</h3>
            ${analysis.priorityActions && analysis.priorityActions.length > 0 ? `
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #f4f4f5; border-bottom: 2px solid #e4e4e7;">
                    <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 15%; text-align: center;">Приоритет</th>
                    <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 55%;">Рекомендованное действие</th>
                    <th style="padding: 8px 10px; font-weight: 800; color: #111827; width: 30%;">Ответственный</th>
                  </tr>
                </thead>
                <tbody>
                  ${analysis.priorityActions.map(a => `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                      <td style="padding: 8px 10px; text-align: center; color: #111827; font-weight: bold;">${a.priority}</td>
                      <td style="padding: 8px 10px; color: #374151; line-height: 1.4;">${a.action}</td>
                      <td style="padding: 8px 10px; color: #4b5563; font-weight: 600;">${a.owner || 'Не назначен'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `<p style="font-size: 11px; color: #9ca3af; margin: 0;">Рекомендации отсутствуют.</p>`}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; font-family: monospace; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          <span>Страница 2 из 3</span>
          <span>КОНФИДЕНЦИАЛЬНО • ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ</span>
        </div>
      </div>
    `;

    page3HTML = `
      <div class="pdf-page" style="width: 850px; height: 1200px; padding: 45px 50px; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; margin-bottom: 20px;">
        <div>
          <!-- Header Accent -->
          <div style="height: 6px; background-color: #8b5cf6; margin-bottom: 25px; border-radius: 4px;"></div>
          
          <div style="margin-bottom: 25px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; font-family: -apple-system, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af;">
                Аналитический разбор проекта • ${assessmentDate}
              </span>
              <span style="font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase; font-family: monospace;">
                Методологический аудит
              </span>
            </div>
            <h1 style="font-size: 20px; font-weight: 800; color: #010101; line-height: 1.25; margin: 0; letter-spacing: -0.02em;">
              Развернутый анализ по методике
            </h1>
          </div>

          <!-- Detailed Audit Columns -->
          <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px; font-size: 11.5px; font-family: -apple-system, sans-serif;">
            <div style="background: #fafafa; border: 1px solid #e5e7eb; padding: 12px 15px; border-radius: 10px;">
              <strong style="color: #111827; display: block; margin-bottom: 4px; font-size: 12px;">1. Анализ полноты и качества данных</strong>
              <p style="margin: 0; color: #4b5563; line-height: 1.5;">${analysis.detailedAnalysis.dataCompleteness || '—'}</p>
            </div>
            
            <div style="background: #fafafa; border: 1px solid #e5e7eb; padding: 12px 15px; border-radius: 10px;">
              <strong style="color: #111827; display: block; margin-bottom: 4px; font-size: 12px;">2. Анализ своевременности заседаний и мониторинга ПК</strong>
              <p style="margin: 0; color: #4b5563; line-height: 1.5;">${analysis.detailedAnalysis.pcTimeliness || '—'}</p>
            </div>
            
            <div style="background: #fafafa; border: 1px solid #e5e7eb; padding: 12px 15px; border-radius: 10px;">
              <strong style="color: #111827; display: block; margin-bottom: 4px; font-size: 12px;">3. Контроль задач, вех и план-факта (опережение / отставание)</strong>
              <p style="margin: 0; color: #4b5563; line-height: 1.5;">${analysis.detailedAnalysis.lagOrAdvance || '—'}</p>
            </div>
            
            <div style="background: #fafafa; border: 1px solid #e5e7eb; padding: 12px 15px; border-radius: 10px;">
              <strong style="color: #111827; display: block; margin-bottom: 4px; font-size: 12px;">4. Мониторинг динамики показателей эффективности</strong>
              <p style="margin: 0; color: #4b5563; line-height: 1.5;">${analysis.detailedAnalysis.indicators || '—'}</p>
            </div>
          </div>

          <!-- Proposals Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-family: -apple-system, sans-serif;">
            <div style="background: #fafafa; padding: 12px 15px; border-radius: 10px; border: 1px solid #e5e7eb;">
              <strong style="font-size: 11px; color: #111827; text-transform: uppercase; display: block; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Предложение по проекту</strong>
              <p style="font-size: 11px; color: #4b5563; margin: 0; line-height: 1.5;">${analysis.detailedAnalysis.projectProposal || 'Предложений нет.'}</p>
            </div>
            <div style="background: #f5f3ff; padding: 12px 15px; border-radius: 10px; border: 1px solid #ddd6fe;">
              <strong style="font-size: 11px; color: #4c1d95; text-transform: uppercase; display: block; margin-bottom: 6px; border-bottom: 1px solid #ddd6fe; padding-bottom: 4px;">Предложение по применению ИИ</strong>
              <p style="font-size: 11px; color: #5b21b6; margin: 0; line-height: 1.5; font-weight: 500;">${analysis.detailedAnalysis.aiProposal || 'Предложений нет.'}</p>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; font-family: monospace; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          <span>Страница 3 из 3</span>
          <span>КОНФИДЕНЦИАЛЬНО • ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ</span>
        </div>
      </div>
    `;

    // Convert YYYY-MM-DD to DD.MM.YYYY in analysis text
    page2HTML = page2HTML.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3.$2.$1');
    page3HTML = page3HTML.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3.$2.$1');
  }

  // Inject composite pages
  container.innerHTML = `
    ${page1HTML}
    ${page2HTML}
    ${page3HTML}
  `;

  document.body.appendChild(container);

  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageElements = container.querySelectorAll('.pdf-page');

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement;

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        doc.addPage();
      }

      // Add portrait image to full A4 page: dimensions 210mm x 297mm
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    doc.save(`project-report-${project.projectId}-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (err: any) {
    console.error('Project PDF generation failed:', err);
    throw err;
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportPortfolioToPDF(projects: Project[], stats: Stats | null): Promise<void> {
  const assessmentDate = formatDateSafe(new Date().toISOString());

  // 1. Calculate actual stats reliably based on filtered projects
  const total = projects.length;
  const active = projects.filter(p => p.status === 'active').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const atRisk = projects.filter(p => p._metrics?.overallStatus === 'Зона риска').length;
  const lagging = projects.filter(p => p._metrics?.overallStatus === 'Под наблюдением').length;
  const overdue = projects.filter(p => p._metrics?.pcStatus === 'Просрочен').length;
  const missingData = projects.filter(p => !p._metrics || p._metrics.pcStatus === 'Недостаточно данных').length;

  const avgCompleteness = total > 0 
    ? (projects.reduce((acc, p) => acc + (p._metrics?.significantCompletenessPercent || 0), 0) / total) 
    : 0;
  const avgProgress = total > 0 
    ? (projects.reduce((acc, p) => acc + (p._metrics?.weightedTaskProgressPercent || 0), 0) / total) 
    : 0;
  const noIndicators = projects.filter(p => !p.indicators || p.indicators.length === 0).length;

  // Let's count overall statuses for display
  let statusNorm = 0, statusMoni = 0, statusRisk = 0, statusNoData = 0;
  projects.forEach(p => {
    const status = p._metrics?.overallStatus || '';
    if (status === 'Норма') statusNorm++;
    else if (status === 'Под наблюдением') statusMoni++;
    else if (status === 'Зона риска') statusRisk++;
    else statusNoData++;
  });

  const pctNorm = total > 0 ? Math.round((statusNorm / total) * 100) : 0;
  const pctMoni = total > 0 ? Math.round((statusMoni / total) * 100) : 0;
  const pctRisk = total > 0 ? Math.round((statusRisk / total) * 100) : 0;
  const pctNoData = total > 0 ? Math.max(0, 100 - pctNorm - pctMoni - pctRisk) : 0;

  // Build SVG cumulative circles for status chart
  const segments = [
    { value: statusNorm, color: '#10b981', label: 'Норма' },
    { value: statusMoni, color: '#f59e0b', label: 'Под наблюдением' },
    { value: statusRisk, color: '#ef4444', label: 'Зона риска' },
    { value: statusNoData, color: '#9ca3af', label: 'Недостаточно данных' },
  ].filter(s => s.value > 0);

  const totalVal = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let accumulatedPercent = 0;
  const svgCircles = segments.map((seg) => {
    const pct = seg.value / totalVal;
    const strokeLength = pct * 282.74; // Circumference for r=45 (2 * Math.PI * 45 = 282.74)
    const strokeOffset = 282.74 - strokeLength;
    const rotation = (accumulatedPercent * 360) - 90;
    accumulatedPercent += pct;
    return `<circle cx="70" cy="70" r="45" fill="transparent" stroke="${seg.color}" stroke-width="15" stroke-dasharray="282.74" stroke-dashoffset="${strokeOffset}" transform="rotate(${rotation} 70 70)" />`;
  }).join('');

  // Count PC monitoring states
  let pcTimely = 0, pcOverdue = 0, pcNoData = 0;
  projects.forEach(p => {
    const pc = p._metrics?.pcStatus || '';
    if (pc === 'Своевременно') pcTimely++;
    else if (pc === 'Просрочен') pcOverdue++;
    else pcNoData++;
  });

  const pctPcTimely = total > 0 ? Math.round((pcTimely / total) * 100) : 0;
  const pctPcOverdue = total > 0 ? Math.round((pcOverdue / total) * 100) : 0;
  const pctPcNoData = total > 0 ? Math.max(0, 100 - pctPcTimely - pctPcOverdue) : 0;

  // Build SVG cumulative circles for PC monitoring chart
  const pcSegments = [
    { value: pcTimely, color: '#10b981', label: 'Своевременно' },
    { value: pcOverdue, color: '#ef4444', label: 'Просрочен' },
    { value: pcNoData, color: '#9ca3af', label: 'Недостаточно данных' },
  ].filter(s => s.value > 0);

  const totalPcVal = pcSegments.reduce((sum, s) => sum + s.value, 0) || 1;
  let accumulatedPcPercent = 0;
  const svgPcCircles = pcSegments.map((seg) => {
    const pct = seg.value / totalPcVal;
    const strokeLength = pct * 282.74;
    const strokeOffset = 282.74 - strokeLength;
    const rotation = (accumulatedPcPercent * 360) - 90;
    accumulatedPcPercent += pct;
    return `<circle cx="70" cy="70" r="45" fill="transparent" stroke="${seg.color}" stroke-width="15" stroke-dasharray="282.74" stroke-dashoffset="${strokeOffset}" transform="rotate(${rotation} 70 70)" />`;
  }).join('');

  // Generate dynamic contextual warnings for "Ключевые зоны внимания" based on actual data
  const keyAreas: string[] = [];
  if (atRisk > 0) {
    keyAreas.push(`Высокая доля проектов в зоне риска: повышенную управленческую уязвимость имеют <strong>${atRisk}</strong> объектов.`);
  }
  if (overdue > 0) {
    keyAreas.push(`Есть проекты с просроченным мониторингом проектного комитета: заседание нарушено у <strong>${overdue}</strong> участников.`);
  }
  if (missingData > 0) {
    keyAreas.push(`По части проектов отсутствуют данные по мониторингу ПК: требуется запросить актуальный аудит по <strong>${missingData}</strong> паспортам.`);
  }
  if (noIndicators > 0) {
    keyAreas.push(`Ряд паспортов проектов не имеет утвержденных показателей эффективности (KPI): <strong>${noIndicators}</strong> объектов требуют конкретизации метрик.`);
  }
  if (avgProgress < 50 && total > 0) {
    keyAreas.push(`Средний прогресс выполнения требует дополнительного управленческого контроля: текущий средний уровень равен всего <strong>${Math.round(avgProgress)}%</strong>.`);
  } else if (lagging > 0) {
    keyAreas.push(`Отклонение графиков: <strong>${lagging}</strong> проектов испытывают плановые отставания от утвержденных контрольных точек.`);
  }

  // Fallbacks if things are too perfect
  if (keyAreas.length < 3) {
    if (completed > 0) {
      keyAreas.push(`Успешное закрытие: полностью сданы и подтверждены <strong>${completed}</strong> проектов текущего периода.`);
    }
    if (active > 0) {
      keyAreas.push(`Стабильная работа: <strong>${active}</strong> проектов находятся в активной фазе в полном соответствии с регламентами.`);
    }
    if (avgCompleteness > 70) {
      keyAreas.push(`Высокое качество планирования: средняя заполненность ревизий составляет <strong>${Math.round(avgCompleteness)}%</strong>.`);
    }
  }

  const finalKeyAreas = keyAreas.slice(0, 4);

  // Clean container representing printable pages
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-99999px';
  container.style.top = '-99999px';
  container.style.width = '1120px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = '#f3f4f6';

  container.innerHTML = `
    <!-- PAGE 1: EXECUTIVE SLATE OVERVIEW -->
    <div class="pdf-page" style="width: 1120px; height: 792px; background: #ffffff; padding: 45px 50px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #010101; padding-bottom: 15px; margin-bottom: 25px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 900; color: #010101; margin: 0; letter-spacing: -0.01em; text-transform: uppercase; font-family: -apple-system, sgoe-ui, sans-serif;">Обзор портфеля проектов</h1>
            <p style="font-size: 11.5px; font-weight: 500; color: #4b5563; margin: 3px 0 0 0; letter-spacing: 0.01em; font-family: -apple-system, sans-serif;">Управленческий отчет по текущему состоянию проектного портфеля</p>
            <p style="font-size: 10px; color: #8b5cf6; margin: 4px 0 0 0; font-weight: 700; font-family: -apple-system, sans-serif;">Отчет сформирован по текущей выборке проектов</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin: 0; letter-spacing: 0.1em; font-family: -apple-system, sans-serif;">Дата формирования</p>
            <p style="font-size: 13px; font-weight: 900; color: #010101; margin: 2px 0 0 0; font-family: -apple-system, sans-serif;">${assessmentDate}</p>
          </div>
        </div>

        <!-- 10 Core показатели in elegant metrics cards grid (5x2 layout) -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 12px;">
          <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 8px; text-align: center;">
            <span style="font-size: 26px; font-weight: 950; color: #010101; display: block; line-height: 1;">${total}</span>
            <span style="font-size: 8.5px; font-weight: 800; color: #6b7280; text-transform: uppercase; display: block; margin-top: 6px; letter-spacing: 0.03em;">Всего проектов</span>
          </div>
          <div style="background: #eef2ff; border: 1px solid #e0e7ff; border-radius: 10px; padding: 12px 8px; text-align: center;">
            <span style="font-size: 26px; font-weight: 950; color: #3b82f6; display: block; line-height: 1;">${active}</span>
            <span style="font-size: 8.5px; font-weight: 800; color: #3b82f6; text-transform: uppercase; display: block; margin-top: 6px; letter-spacing: 0.03em;">В работе</span>
          </div>
          <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 10px; padding: 12px 8px; text-align: center;">
            <span style="font-size: 26px; font-weight: 950; color: #10b981; display: block; line-height: 1;">${completed}</span>
            <span style="font-size: 8.5px; font-weight: 800; color: #10b981; text-transform: uppercase; display: block; margin-top: 6px; letter-spacing: 0.03em;">Завершено</span>
          </div>
          <div style="background: #fff5f5; border: 1px solid #fee2e2; border-radius: 10px; padding: 12px 8px; text-align: center;">
            <span style="font-size: 26px; font-weight: 950; color: #ef4444; display: block; line-height: 1;">${atRisk}</span>
            <span style="font-size: 8.5px; font-weight: 800; color: #ef4444; text-transform: uppercase; display: block; margin-top: 6px; letter-spacing: 0.03em;">В зоне риска</span>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 8px; text-align: center;">
            <span style="font-size: 26px; font-weight: 950; color: #f59e0b; display: block; line-height: 1;">${lagging}</span>
            <span style="font-size: 8.5px; font-weight: 800; color: #d97706; text-transform: uppercase; display: block; margin-top: 6px; letter-spacing: 0.03em;">С отставанием</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 25px;">
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 4px; text-align: center;">
            <span style="font-size: 15px; font-weight: 900; color: #ef4444;">${overdue}</span>
            <span style="font-size: 8.5px; display: block; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-top: 4px;">Просрочен мониторинг ПК</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 4px; text-align: center;">
            <span style="font-size: 15px; font-weight: 900; color: #6b7280;">${missingData}</span>
            <span style="font-size: 8.5px; display: block; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-top: 4px;">Нет данных по ПК</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 4px; text-align: center;">
            <span style="font-size: 15px; font-weight: 900; color: #2563eb;">${Math.round(avgCompleteness)}%</span>
            <span style="font-size: 8.5px; display: block; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-top: 4px;">Средняя заполненность</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 4px; text-align: center;">
            <span style="font-size: 15px; font-weight: 900; color: #10b981;">${Math.round(avgProgress)}%</span>
            <span style="font-size: 8.5px; display: block; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-top: 4px;">Средний прогресс</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 4px; text-align: center;">
            <span style="font-size: 15px; font-weight: 900; color: #9ca3af;">${noIndicators}</span>
            <span style="font-size: 8.5px; display: block; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-top: 4px;">Без показателей эффективности</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.28fr 1fr; gap: 20px;">
          <!-- Executive summary block -->
          <div style="background: #fafafa; border-radius: 12px; padding: 20px; box-sizing: border-box; border: 1px solid #e5e7eb; border-left: 5px solid #010101;">
            <h3 style="font-size: 12.5px; font-weight: 900; color: #010101; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, sans-serif;">Краткое резюме состояния портфеля</h3>
            <p style="font-size: 11px; line-height: 1.5; color: #374151; margin: 0 0 8px 0; font-family: -apple-system, sans-serif;">
              Настоящий управленческий отчет содержит сводную аналитику хода реализации по выбранному набору проектов (на основе примененных фильтров). Из общего числа проектов в количестве <strong>${total}</strong>, в работе находятся <strong>${active}</strong> проектов, тогда как полностью завершено <strong>${completed}</strong>.
            </p>
            <p style="font-size: 11px; line-height: 1.5; color: #374151; margin: 0 0 8px 0; font-family: -apple-system, sans-serif;">
              Средняя заполненность инвестиционных паспортов на данный момент составляет <strong>${Math.round(avgCompleteness)}%</strong>, в то время как средний взвешенный прогресс по всем задачам составляет <strong>${Math.round(avgProgress)}%</strong>. Эти цифры указывают на стабильную проработку проектной документации и нормальный темп работ.
            </p>
            <p style="font-size: 11px; line-height: 1.5; color: #4b5563; margin: 0; font-family: -apple-system, sans-serif;">
              Для снижения организационных рисков руководству рекомендуется обратить особое внимание на дисциплину коллегиального контроля и своевременность координации этапов на проектных комитетах.
            </p>
          </div>

          <!-- Key Areas of Attention block -->
          <div style="background: #ffffff; border-radius: 12px; padding: 20px; box-sizing: border-box; border: 1px solid #e5e7eb; border-left: 5px solid #ef4444;">
            <h3 style="font-size: 12.5px; font-weight: 900; color: #111827; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, sans-serif;">Ключевые зоны внимания</h3>
            <ul style="margin: 0; padding-left: 15px; font-size: 11px; line-height: 1.5; color: #374151; font-family: -apple-system, sans-serif;">
              ${finalKeyAreas.map(item => `<li style="margin-bottom: 7px;">${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      <!-- Page Footer -->
      <div style="display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; font-family: monospace; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 15px;">
        <span>Страница 1 из 2</span>
        <span>КОНФИДЕНЦИАЛЬНО • ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ</span>
      </div>
    </div>

    <!-- PAGE 2: CHARTS BLOCK 1 & BLOCK 2 -->
    <div class="pdf-page" style="width: 1120px; height: 792px; background: #ffffff; padding: 45px 50px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #010101; padding-bottom: 15px; margin-bottom: 30px;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; color: #010101; margin: 0; letter-spacing: -0.01em; text-transform: uppercase; font-family: -apple-system, sans-serif;">Управленческий статус и мониторинг проектного комитета</h1>
            <p style="font-size: 11px; font-weight: 500; color: #4b5563; margin: 2px 0 0 0; letter-spacing: 0.01em; font-family: -apple-system, sans-serif;">Матрица визуального распределения проектов по статусам здоровья и соблюдению регламентов ПК</p>
          </div>
          <span style="font-weight: bold; font-size: 12px; color: #374151; font-family: -apple-system, sans-serif;">${assessmentDate}</span>
        </div>

        <!-- Charts Container Side-by-Side -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 25px;">
          
          <!-- Box 1: Status Distribution -->
          <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column;">
            <h3 style="font-size: 12.5px; font-weight: 900; color: #010101; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 15px 0; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 8px; font-family: -apple-system, sans-serif;">
              Распределение проектов по управленческому статусу
            </h3>
            ${total > 0 ? `
            <div style="display: flex; align-items: center; gap: 20px;">
              <div style="position: relative; width: 130px; height: 130px; flex-shrink: 0; background-color: #ffffff;">
                <svg width="130" height="130" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="45" stroke="#f3f4f6" stroke-width="15" fill="transparent"/>
                  ${svgCircles}
                </svg>
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translateY(-3px);">
                  <span style="font-size: 20px; font-weight: 950; color: #010101; line-height: 1; font-family: -apple-system, sans-serif;">${total}</span>
                  <span style="font-size: 7.5px; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin-top: 3px; font-family: -apple-system, sans-serif;">Проектов</span>
                </div>
              </div>
              <div style="flex: 1; font-size: 11px; font-family: -apple-system, sans-serif;">
                <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #10b981; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">Норма:</span> 
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${statusNorm} проектов (${pctNorm}%)</span>
                </div>
                <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #f59e0b; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">Под наблюдением:</span>
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${statusMoni} проектов (${pctMoni}%)</span>
                </div>
                <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #ef4444; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">Зона риска:</span>
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${statusRisk} проектов (${pctRisk}%)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #9ca3af; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">Недостаточно данных:</span>
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${statusNoData} проектов (${pctNoData}%)</span>
                </div>
              </div>
            </div>
            ` : `
            <div style="height: 130px; display: flex; align-items: center; justify-content: center; border: 1.5px dashed #d1d5db; border-radius: 12px; background: #fff; font-size: 12px; font-weight: 700; color: #6b7280; font-family: -apple-system, sans-serif;">
              Недостаточно данных для построения диаграммы
            </div>
            `}
          </div>

          <!-- Box 2: Committees Monitoring -->
          <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column;">
            <h3 style="font-size: 12.5px; font-weight: 900; color: #010101; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 15px 0; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 8px; font-family: -apple-system, sans-serif;">
              Состояние мониторинга ПК
            </h3>
            ${total > 0 ? `
            <div style="display: flex; align-items: center; gap: 20px;">
              <div style="position: relative; width: 130px; height: 130px; flex-shrink: 0; background-color: #ffffff;">
                <svg width="130" height="130" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="45" stroke="#f3f4f6" stroke-width="15" fill="transparent"/>
                  ${svgPcCircles}
                </svg>
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translateY(-3px);">
                  <span style="font-size: 20px; font-weight: 950; color: #010101; line-height: 1; font-family: -apple-system, sans-serif;">${total}</span>
                  <span style="font-size: 7.5px; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin-top: 3px; font-family: -apple-system, sans-serif;">Проверок</span>
                </div>
              </div>
              <div style="flex: 1; font-size: 11px; font-family: -apple-system, sans-serif;">
                <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #10b981; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">Своевременно:</span>
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${pcTimely} проектов (${pctPcTimely}%)</span>
                </div>
                <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #ef4444; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">Просрочен:</span>
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${pcOverdue} проектов (${pctPcOverdue}%)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 9px; height: 9px; background: #9ca3af; border-radius: 50%;"></span>
                  <span style="color: #4b5563; font-weight: bold;">ПК нет данных:</span>
                  <span style="font-weight: bold; color: #111827; margin-left: auto;">${pcNoData} проектов (${pctPcNoData}%)</span>
                </div>
              </div>
            </div>
            ` : `
            <div style="height: 130px; display: flex; align-items: center; justify-content: center; border: 1.5px dashed #d1d5db; border-radius: 12px; background: #fff; font-size: 12px; font-weight: 700; color: #6b7280; font-family: -apple-system, sans-serif;">
              Недостаточно данных для построения диаграммы
            </div>
            `}
          </div>
        </div>

        <div style="background: #fafafa; border: 1px dashed #e5e7eb; padding: 18px 22px; border-radius: 10px; box-sizing: border-box;">
          <h4 style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4b5563; margin: 0 0 10px 0; letter-spacing: 0.05em; font-family: -apple-system, sans-serif;">Как читать диаграммы</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; color: #4b5563; line-height: 1.5; font-family: -apple-system, sans-serif;">
            <div>
              <strong style="color: #111827; display: block; margin-bottom: 2px;">Управленческий статус:</strong>
              Рассчитывается динамически на основе актуальности и заполненности инвестиционного паспорта проекта, текущего среднего процента прогресса задач и отсутствия критических инфраструктурных замечаний.
            </div>
            <div>
              <strong style="color: #111827; display: block; margin-bottom: 2px;">Мониторинг Комитета ПК:</strong>
              Показывает периодичность заседаний Проектного комитета. Отметки «Своевременно» гарантируют, что проект прошел коллегиальный обзор согласно внутреннему корпоративному расписанию частоты контроля.
            </div>
          </div>
        </div>
      </div>

      <!-- Page Footer -->
      <div style="display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; font-family: monospace; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 15px;">
        <span>Страница 2 из 2</span>
        <span>КОНФИДЕНЦИАЛЬНО • ДЛЯ ВНУТРЕННЕГО ИСПОЛЬЗОВАНИЯ</span>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageElements = container.querySelectorAll('.pdf-page');

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement;

      const canvas = await html2canvas(pageEl, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        doc.addPage();
      }

      // Add image to full A4 page: dimension 297mm x 210mm
      doc.addImage(imgData, 'JPEG', 0, 0, 297, 210);
    }

    const currentDateString = new Date().toISOString().split('T')[0];
    doc.save(`portfolio-overview-report-${currentDateString}.pdf`);
  } catch (err: any) {
    console.error('Programmatic portfolio rendering failed:', err);
    throw new Error(`Ошибка генерации PDF отчета портфеля: ${err?.message || String(err)}`);
  } finally {
    document.body.removeChild(container);
  }
}