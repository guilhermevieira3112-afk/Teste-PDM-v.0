import React from 'react';
import { Calendar, CheckCircle2, Clock, History, RotateCcw, User } from 'lucide-react';
import { ItemChangeLog } from '../../types/pdm';

interface ItemChangeHistoryTableProps {
  history?: ItemChangeLog[];
  emptyTitle?: string;
  emptySubtitle?: string;
  maxHeightClass?: string;
  limit?: number;
}

export const ItemChangeHistoryTable: React.FC<ItemChangeHistoryTableProps> = ({
  history = [],
  emptyTitle = 'Nenhuma alteração cadastral registrada',
  emptySubtitle = 'Este item permanece com os dados originais importados da carga TOTVS.',
  maxHeightClass = '',
  limit,
}) => {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const rows = limit ? sortedHistory.slice(0, limit) : sortedHistory;

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-700">{emptyTitle}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className={`overflow-auto ${maxHeightClass || 'max-h-[60vh]'}`}>
        <table className="w-full text-center border-collapse text-xs">
          <thead className="bg-slate-100 text-[10px] font-mono uppercase tracking-wider text-slate-600 border-b border-slate-200 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">Data de Modificação</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">Evento / Status</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">Responsáveis</th>
              <th className="py-2.5 px-3 text-center">Campos Modificados & Justificativa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {rows.map((rev) => {
              const dateObj = new Date(rev.timestamp);
              const dateStr = isNaN(dateObj.getTime())
                ? rev.timestamp
                : dateObj.toLocaleDateString('pt-BR');
              const timeStr = isNaN(dateObj.getTime())
                ? ''
                : dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              const isReturned = rev.actionType === 'REJECTED' && rev.status === 'PENDING';

              const statusBadge =
                rev.status === 'APPROVED'
                  ? {
                      label: 'Aprovado / Efetivado',
                      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      Icon: CheckCircle2,
                    }
                  : rev.status === 'REJECTED'
                  ? {
                      label: 'Devolvido / Reprovado',
                      className: 'bg-rose-50 text-rose-800 border-rose-200',
                      Icon: RotateCcw,
                    }
                  : isReturned
                  ? {
                      label: 'Devolvido (Pendente)',
                      className: 'bg-amber-50 text-amber-900 border-amber-300',
                      Icon: RotateCcw,
                    }
                  : rev.status === 'CANCELLED'
                  ? {
                      label: 'Cancelado',
                      className: 'bg-slate-100 text-slate-700 border-slate-200',
                      Icon: Clock,
                    }
                  : {
                      label: 'Pendente',
                      className: 'bg-amber-50 text-amber-800 border-amber-200',
                      Icon: Clock,
                    };

              const StatusIcon = statusBadge.Icon;

              return (
                <tr key={rev.id} className="hover:bg-slate-50/70 align-top">
                  {/* COLUNA 1: DATA DE MODIFICAÇÃO */}
                  <td className="py-2.5 px-3 whitespace-nowrap text-center font-mono text-slate-700">
                    <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-900">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{dateStr}</span>
                    </div>
                    {timeStr && (
                      <div className="text-[10px] text-slate-400">às {timeStr}</div>
                    )}
                  </td>

                  {/* COLUNA 2: EVENTO / STATUS */}
                  <td className="py-2.5 px-3 min-w-[170px] text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadge.className}`}
                    >
                      <StatusIcon className="w-3 h-3 shrink-0" />
                      <span>{statusBadge.label}</span>
                    </span>
                    <div className="font-semibold text-slate-800 mt-1 leading-snug">
                      {rev.actionLabel || 'Registro de Governança'}
                    </div>
                    {rev.approvalTier && (
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Alçada Nível {rev.approvalTier}
                      </div>
                    )}
                  </td>

                  {/* COLUNA 3: RESPONSÁVEIS */}
                  <td className="py-2.5 px-3 min-w-[190px] space-y-1 text-center">
                    <div className="flex flex-col items-center gap-0.5 text-slate-700">
                      <div className="flex items-center justify-center gap-1">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-mono uppercase text-slate-400">
                          Solicitante / Autor
                        </span>
                      </div>
                      <strong className="text-slate-900">{rev.requestedByUser}</strong>
                      {rev.requestedByTenantName && (
                        <span className="text-[10px] text-slate-500 block">
                          {rev.requestedByTenantName}
                        </span>
                      )}
                    </div>

                    {rev.approvedByUser && (
                      <div className="flex flex-col items-center gap-0.5 text-emerald-900 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="text-[10px] font-mono uppercase text-emerald-700">
                            Responsável / Aprovador
                          </span>
                        </div>
                        <strong>{rev.approvedByUser}</strong>
                        {rev.approvedAt && (
                          <span className="text-[10px] font-mono text-slate-500 block">
                            {new Date(rev.approvedAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* COLUNA 4: CAMPOS MODIFICADOS & JUSTIFICATIVA */}
                  <td className="py-2.5 px-3 min-w-[260px] space-y-1.5 text-center">
                    {rev.changes && rev.changes.length > 0 && (
                      <div className="rounded-lg border border-slate-200 overflow-auto max-h-60 bg-slate-50">
                        <table className="w-full text-center text-[10px] font-mono">
                          <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                            <tr>
                              <th className="py-1 px-2 text-center">Campo</th>
                              <th className="py-1 px-2 text-center">Anterior</th>
                              <th className="py-1 px-2 text-center">Novo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70 bg-white">
                            {rev.changes.map((ch, idx) => (
                              <tr key={idx}>
                                <td className="py-1 px-2 text-center font-semibold text-slate-700">
                                  {ch.fieldLabel}
                                </td>
                                <td className="py-1 px-2 text-center text-slate-500 line-through max-w-[140px] truncate" title={ch.oldValue || '—'}>
                                  {ch.oldValue || '—'}
                                </td>
                                <td className="py-1 px-2 text-center text-emerald-800 font-bold max-w-[160px] truncate" title={ch.newValue || '—'}>
                                  {ch.newValue || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {rev.reason && (
                      <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <span className="font-semibold text-slate-600">Observação: </span>
                        <span>{rev.reason}</span>
                      </div>
                    )}

                    {rev.rejectionReason && (
                      <div className="text-[11px] text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                        <span className="font-semibold">Motivo / Devolução: </span>
                        <span>{rev.rejectionReason}</span>
                      </div>
                    )}

                    {!rev.reason && !rev.rejectionReason && (!rev.changes || rev.changes.length === 0) && (
                      <span className="text-slate-400 italic">Sem observações adicionais</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
