import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Search, 
  Filter, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Check, 
  X, 
  AlertTriangle, 
  Send, 
  CheckCircle2, 
  Edit3, 
  Lock, 
  Unlock, 
  Plus, 
  RefreshCw,
  Sparkles,
  Info,
  ExternalLink,
  ShieldAlert,
  Smartphone,
  Copy,
  Link2,
  Cloud
} from 'lucide-react';
import { UserAccount, UserStatus, UserProfileRole } from '../../types/auth';
import { Tenant } from '../../types/pdm';
import { TENANTS } from '../../data/taxonomy';
import { 
  generateStandardUsername, 
  validatePasswordRequirements, 
  PROFILE_LABELS 
} from '../../utils/userUtils';
import { SharePointIntegrationStatus } from '../../types/governanceSync';
import { sendPowerAutomateApprovalEmail } from '../../utils/governanceSync';

interface UserControlViewProps {
  users: UserAccount[];
  onUpdateUsers: (updatedUsers: UserAccount[]) => void;
  currentUser: UserAccount;
  onShowToast: (message: string) => void;
  global2FARequired: boolean;
  onToggleGlobal2FA: () => void;
  initialApproveUsername?: string | null;
  onClearInitialApprove?: () => void;
  sharePointStatus?: SharePointIntegrationStatus | null;
  onManualSharePointSync?: () => Promise<void>;
}

export const UserControlView: React.FC<UserControlViewProps> = ({
  users,
  onUpdateUsers,
  currentUser,
  onShowToast,
  global2FARequired,
  onToggleGlobal2FA,
  initialApproveUsername,
  onClearInitialApprove,
  sharePointStatus,
  onManualSharePointSync,
}) => {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserProfileRole>('ALL');
  const [tenantFilter, setTenantFilter] = useState<'ALL' | string>('ALL');

  // Modals State
  const [approvalModalUser, setApprovalModalUser] = useState<UserAccount | null>(null);
  const [rejectModalUser, setRejectModalUser] = useState<UserAccount | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedApprovalLinkId, setCopiedApprovalLinkId] = useState<string | null>(null);
  const [isSharePointModalOpen, setIsSharePointModalOpen] = useState(false);
  const [isSyncingSharePoint, setIsSyncingSharePoint] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Create User Form State
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserProfileRole>('ALMOXARIFADO');
  const [formTenantId, setFormTenantId] = useState('dourado-sp');
  const [formDepartment, setFormDepartment] = useState('Almoxarifado');
  const [formEnable2FA] = useState(true);

  const isGlobalPdmMaster = currentUser.username.toLowerCase() === 'pdmindustrial.premierpet';

  // Auto-open approval modal if arrived via approval link (?approveUser=...)
  React.useEffect(() => {
    if (initialApproveUsername) {
      const target = users.find(
        (u) => u.username.toLowerCase() === initialApproveUsername.toLowerCase() && u.status === 'PENDING_APPROVAL'
      );
      if (target) {
        setStatusFilter('PENDING_APPROVAL');
        setApprovalModalUser(target);
      }
      if (onClearInitialApprove) {
        onClearInitialApprove();
      }
    }
  }, [initialApproveUsername, users, onClearInitialApprove]);

  // Auto-generate standard username when full name changes (without auto-filling corporate email)
  const handleFullNameChange = (name: string) => {
    setFormFullName(name);
    const standard = generateStandardUsername(name);
    setFormUsername(standard);
  };

  const passwordValidation = useMemo(() => {
    return validatePasswordRequirements(formPassword);
  }, [formPassword]);

  // Filtered Users List (pending approval requests prioritized at the top)
  const filteredUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (tenantFilter !== 'ALL' && u.tenantId !== tenantFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = u.name.toLowerCase().includes(query);
        const matchUser = u.username.toLowerCase().includes(query);
        const matchEmail = u.email.toLowerCase().includes(query);
        const matchDept = (u.department || '').toLowerCase().includes(query);
        return matchName || matchUser || matchEmail || matchDept;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (a.status === 'PENDING_APPROVAL' && b.status !== 'PENDING_APPROVAL') return -1;
      if (b.status === 'PENDING_APPROVAL' && a.status !== 'PENDING_APPROVAL') return 1;
      return 0;
    });
  }, [users, statusFilter, roleFilter, tenantFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'ACTIVE').length;
    const pending = users.filter((u) => u.status === 'PENDING_APPROVAL').length;
    const blocked = users.filter((u) => u.status === 'BLOCKED').length;
    return { total, active, pending, blocked };
  }, [users]);

  // Handlers for User Actions
  const handleToggleBlock = (targetUser: UserAccount) => {
    const isCurrentlyActive = targetUser.status === 'ACTIVE';
    const newStatus: UserStatus = isCurrentlyActive ? 'BLOCKED' : 'ACTIVE';

    const updated = users.map((u) => {
      if (u.id === targetUser.id) {
        return {
          ...u,
          status: newStatus,
          blockedAt: newStatus === 'BLOCKED' ? new Date().toISOString() : undefined,
        };
      }
      return u;
    });

    onUpdateUsers(updated);
    onShowToast(
      isCurrentlyActive
        ? `Acesso do usuário "${targetUser.username}" foi bloqueado.`
        : `Acesso do usuário "${targetUser.username}" foi habilitado com sucesso!`
    );
  };

  // Open Approval Modal with Simulated Email
  const handleOpenApproveModal = (user: UserAccount) => {
    setApprovalModalUser(user);
  };

  // Confirm Approval & Dispatch Corporate Email (via Power Automate if configured)
  const handleConfirmApproval = async () => {
    if (!approvalModalUser) return;
    const approvedTarget = approvalModalUser;

    const updated = users.map((u) => {
      if (u.id === approvedTarget.id) {
        return {
          ...u,
          status: 'ACTIVE' as UserStatus,
          approvedAt: new Date().toISOString(),
          approvedBy: `${currentUser.name} (${PROFILE_LABELS[currentUser.role] || 'Master Admin'})`,
        };
      }
      return u;
    });

    onUpdateUsers(updated);
    setApprovalModalUser(null);

    const emailRes = await sendPowerAutomateApprovalEmail({
      to: approvedTarget.email,
      userName: approvedTarget.name,
      username: approvedTarget.username,
      roleLabel: PROFILE_LABELS[approvedTarget.role] || 'Almoxarifado',
      tenantName: approvedTarget.tenantName,
      loginUrl: `${window.location.origin}/?login=${encodeURIComponent(approvedTarget.username)}`,
      subject: '[PremieRpet] Seu acesso à Plataforma foi Liberado com Sucesso!',
    });

    if (emailRes.sentViaPowerAutomate) {
      onShowToast(`Acesso liberado! E-mail real disparado via Power Automate para ${approvedTarget.email}.`);
    } else {
      onShowToast(`Acesso liberado para ${approvedTarget.username} e sincronizado na fila de governança.`);
    }
  };

  // Reject / Remove Request (via inline confirmation modal, never window.confirm)
  const handleConfirmRejectRequest = () => {
    if (!rejectModalUser) return;
    const updated = users.filter((u) => u.id !== rejectModalUser.id);
    onUpdateUsers(updated);
    onShowToast(`Solicitação de ${rejectModalUser.name} foi rejeitada e removida da fila.`);
    setRejectModalUser(null);
  };

  const handleCopyApprovalLink = (user: UserAccount) => {
    const link = `${window.location.origin}/?tab=user-control&approveUser=${encodeURIComponent(user.username)}`;
    navigator.clipboard.writeText(link);
    setCopiedApprovalLinkId(user.id);
    onShowToast(`Link direto de aprovação copiado para ${user.username}!`);
    setTimeout(() => setCopiedApprovalLinkId(null), 2500);
  };

  // Create User by Master Admin
  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formFullName.trim() || !formUsername.trim() || !formEmail.trim()) {
      setCreateError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!passwordValidation.isValid) {
      setCreateError('A senha informada não atende aos requisitos de complexidade exigidos.');
      return;
    }

    const duplicate = users.find(
      (u) => u.username.toLowerCase() === formUsername.trim().toLowerCase() || u.email.toLowerCase() === formEmail.trim().toLowerCase()
    );
    if (duplicate) {
      setCreateError(`Já existe um usuário com o login "${formUsername}" ou e-mail "${formEmail}".`);
      return;
    }

    const tenantObj = TENANTS.find((t) => t.id === formTenantId) || TENANTS[0];

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: formFullName.trim(),
      username: formUsername.trim().toLowerCase(),
      email: formEmail.trim().toLowerCase(),
      password: formPassword.trim(),
      role: formRole,
      profileTitle: PROFILE_LABELS[formRole] || 'Almoxarifado',
      tenantId: tenantObj.id,
      tenantName: tenantObj.name,
      department: formDepartment.trim() || 'Almoxarifado & Manutenção',
      status: 'ACTIVE',
      twoFactorEnabled: formEnable2FA,
      totpSecret: 'JBSWY3DPEHPK3PXP',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: `${currentUser.name} (Criação Direta)`,
    };

    const updated = [newUser, ...users];
    onUpdateUsers(updated);
    onShowToast(`Usuário "${newUser.username}" criado e habilitado com sucesso!`);
    setIsCreateModalOpen(false);
    setCreateError(null);

    // Reset Form
    setFormFullName('');
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
  };

  // Save Edits to User
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const tenantObj = TENANTS.find((t) => t.id === editingUser.tenantId) || TENANTS[0];

    const updated = users.map((u) => {
      if (u.id === editingUser.id) {
        return {
          ...editingUser,
          tenantName: tenantObj.name,
          profileTitle: PROFILE_LABELS[editingUser.role] || editingUser.profileTitle,
        };
      }
      return u;
    });

    onUpdateUsers(updated);
    onShowToast(`Dados do usuário "${editingUser.username}" atualizados com sucesso.`);
    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER BANNER */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Módulo Exclusivo Master Admin
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-xs text-slate-500 font-mono">Governança Central PremieRpet</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              <span>Controle de Usuários & Gestão de Acessos</span>
            </h2>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Painel centralizado para homologação de novos cadastros solicitados na tela de login, liberação ou bloqueio de acessos e atribuição dos perfis corporativos: <strong>Manutenção/Produção</strong>, <strong>Almoxarifado</strong> e <strong>Master Admin (Global)</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSharePointModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs transition-colors shadow-2xs"
            >
              <Cloud className="w-4 h-4 text-blue-700" />
              <span>SharePoint & Power Automate</span>
            </button>

            <button
              onClick={() => {
                setFormFullName('');
                setFormUsername('');
                setFormEmail('');
                setFormPassword('');
                setCreateError(null);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-2xs active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Novo Usuário Homologado</span>
            </button>
          </div>
        </div>
      </div>

      {/* EXCLUSIVO pdmindustrial.premierpet: CONTROLE GLOBAL DO MICROSOFT AUTHENTICATOR (2FA) */}
      {isGlobalPdmMaster && (
        <div className={`p-5 rounded-2xl border-2 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          global2FARequired
            ? 'bg-blue-50/70 border-blue-200'
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              global2FARequired ? 'bg-blue-100 text-blue-800' : 'bg-amber-200 text-amber-900'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  Controle Exclusivo · pdmindustrial.premierpet
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  global2FARequired
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-200 text-amber-950 border border-amber-400'
                }`}>
                  {global2FARequired
                    ? '2FA Obrigatório Ativo para Todos os Usuários'
                    : 'Modo Contingência Ativo (2FA Desabilitado Globalmente)'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Exigência de Autenticação via Microsoft Authenticator (2FA) na Plataforma
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {global2FARequired
                  ? 'Atualmente todos os usuários (exceto pdmindustrial.premierpet) precisam validar o código no Microsoft Authenticator ao efetuar login. Em caso de indisponibilidade da Microsoft, desative temporariamente abaixo.'
                  : 'ATENÇÃO: A validação em duas etapas (Microsoft Authenticator) está temporariamente dispensada para todos os usuários da plataforma para acesso de contingência.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleGlobal2FA}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 shadow-sm transition-all active:scale-95 ${
              global2FARequired
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-blue-700 hover:bg-blue-800 text-white'
            }`}
          >
            {global2FARequired ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Desabilitar 2FA Global (Contingência)</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Reativar 2FA Obrigatório Global</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. STATS KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Users */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-mono uppercase text-[10px] text-slate-500">Total de Usuários</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {stats.total}
          </div>
          <span className="text-[10px] text-slate-500">Cadastros no sistema</span>
        </div>

        {/* Fila de Aprovação (Destaque) */}
        <div 
          onClick={() => setStatusFilter(stats.pending > 0 ? 'PENDING_APPROVAL' : 'ALL')}
          className={`p-4 rounded-xl border shadow-2xs cursor-pointer transition-all ${
            stats.pending > 0 
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30 hover:bg-amber-100/70' 
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-mono uppercase text-[10px] font-bold ${
              stats.pending > 0 ? 'text-amber-900' : 'text-slate-500'
            }`}>
              Fila de Aprovação
            </span>
            <Clock className={`w-4 h-4 ${stats.pending > 0 ? 'text-amber-600 animate-spin' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${stats.pending > 0 ? 'text-amber-950' : 'text-slate-900'}`}>
            {stats.pending} {stats.pending === 1 ? 'Solicitação' : 'Solicitações'}
          </div>
          <span className="text-[10px] text-amber-800 font-medium">
            {stats.pending > 0 ? 'Aguardando liberação do Master' : 'Nenhuma pendência na fila'}
          </span>
        </div>

        {/* Ativos */}
        <div 
          onClick={() => setStatusFilter('ACTIVE')}
          className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs cursor-pointer hover:bg-slate-50 transition-all"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono uppercase text-[10px] text-emerald-800 font-bold">Acessos Ativos</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">
            {stats.active}
          </div>
          <span className="text-[10px] text-slate-500">Login e 2FA liberados</span>
        </div>

        {/* Bloqueados */}
        <div 
          onClick={() => setStatusFilter('BLOCKED')}
          className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs cursor-pointer hover:bg-slate-50 transition-all"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono uppercase text-[10px] text-rose-800 font-bold">Bloqueados</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-800">
            {stats.blocked}
          </div>
          <span className="text-[10px] text-slate-500">Acesso revogado/desativado</span>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH BAR */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Search */}
        <div className="relative md:col-span-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, login (nome.sobrenome), e-mail ou setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
          />
        </div>

        {/* Status Filter */}
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`w-full py-2.5 px-3 bg-white border rounded-xl text-xs font-semibold shadow-2xs focus:outline-none focus:ring-2 ${
              statusFilter === 'PENDING_APPROVAL'
                ? 'border-amber-300 text-amber-900 bg-amber-50/50'
                : 'border-slate-200 text-slate-800'
            }`}
          >
            <option value="ALL">Todos os Status ({stats.total})</option>
            <option value="PENDING_APPROVAL">⏳ Pendentes de Aprovação ({stats.pending})</option>
            <option value="ACTIVE">🟢 Acessos Ativos ({stats.active})</option>
            <option value="BLOCKED">🔴 Bloqueados ({stats.blocked})</option>
          </select>
        </div>

        {/* Profile Filter */}
        <div className="md:col-span-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold shadow-2xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="ALL">Todos os Perfis</option>
            <option value="MANUTENCAO_PRODUCAO">Manutenção/Produção</option>
            <option value="ALMOXARIFADO">Almoxarifado</option>
            <option value="MASTER_ADMIN">Master Admin (Global)</option>
          </select>
        </div>

        {/* Tenant Filter */}
        <div className="md:col-span-2">
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value as any)}
            className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold shadow-2xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="ALL">Todas as Unidades</option>
            <option value="dourado-sp">Dourado / SP (10)</option>
            <option value="porto-amazonas-pr">Porto Amazonas / PR (14)</option>
          </select>
        </div>
      </div>

      {/* 4. DENSE USERS ERP TABLE */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Nome & Login Padrão</th>
                <th className="py-3 px-4">E-mail Corporativo & Setor</th>
                <th className="py-3 px-4">Perfil de Acesso</th>
                <th className="py-3 px-4 text-center">Alçada de Aprovação PDM</th>
                <th className="py-3 px-4">Unidade Padrão</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Data / Homologação</th>
                <th className="py-3 px-4 text-center">Controle de Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum usuário localizado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isPending = u.status === 'PENDING_APPROVAL';
                  const isBlocked = u.status === 'BLOCKED';
                  const isActive = u.status === 'ACTIVE';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isPending ? 'bg-amber-50/30' : isBlocked ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      {/* USERNAME & LOGIN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.twoFactorEnabled && (
                            <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200" title="2FA Microsoft Authenticator Ativo">
                              2FA
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-emerald-800 mt-0.5 flex items-center gap-1">
                          <span className="text-slate-400 font-normal">Login:</span>
                          <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {u.username}
                          </span>
                        </div>
                      </td>

                      {/* EMAIL & DEPARTMENT */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-mono text-slate-700 text-xs truncate" title={u.email}>
                          {u.email}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {u.department || 'Operações Industriais'}
                        </div>
                      </td>

                      {/* ACCESS PROFILE */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                          u.role === 'MASTER_ADMIN'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : u.role === 'ALMOXARIFADO'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          {PROFILE_LABELS[u.role] || u.profileTitle || 'Almoxarifado'}
                        </span>
                      </td>

                      {/* ALÇADA DE APROVAÇÃO PDM */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <select
                          value={u.approvalTier || (u.role === 'MASTER_ADMIN' ? 'ALL' : 'NONE')}
                          onChange={(e) => {
                            const val = e.target.value;
                            let tierVal: 1 | 2 | 3 | 'ALL' | undefined;
                            if (val === '1') tierVal = 1;
                            else if (val === '2') tierVal = 2;
                            else if (val === '3') tierVal = 3;
                            else if (val === 'ALL') tierVal = 'ALL';
                            else tierVal = undefined;
                            const updated: UserAccount[] = users.map(user => user.id === u.id ? { ...user, approvalTier: tierVal } : user);
                            onUpdateUsers(updated);
                            onShowToast(`Alçada de aprovação de ${u.name} atualizada para ${val === 'NONE' ? 'Sem Alçada (Solicitante)' : val === 'ALL' ? 'Todas as Alçadas (Master)' : 'Nível ' + val}!`);
                          }}
                          className={`text-[10px] font-mono font-bold py-1 px-2 rounded-lg border focus:outline-none shadow-2xs ${
                            u.approvalTier === 3 || u.approvalTier === 'ALL' || u.role === 'MASTER_ADMIN'
                              ? 'bg-purple-50 text-purple-900 border-purple-300'
                              : u.approvalTier === 2
                              ? 'bg-blue-50 text-blue-900 border-blue-300'
                              : u.approvalTier === 1
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          <option value="NONE">Sem Alçada (Solicitante)</option>
                          <option value="1">Nível 1 (até R$ 1.000)</option>
                          <option value="2">Nível 2 (até R$ 10.000)</option>
                          <option value="3">Nível 3 (&gt; R$ 10.000)</option>
                          <option value="ALL">Todas Alçadas (Master)</option>
                        </select>
                      </td>

                      {/* TENANT */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{u.tenantName || 'Unidade Padrão'}</span>
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center font-mono">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Pendente Aprovação</span>
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Ativo / Liberado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <UserX className="w-3 h-3 text-rose-600" />
                            <span>Bloqueado</span>
                          </span>
                        )}
                      </td>

                      {/* DATES & APPROVER */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] font-mono text-slate-500">
                        {u.approvedAt ? (
                          <div>
                            <span className="text-emerald-800 font-semibold">Liberado em:</span> {new Date(u.approvedAt).toLocaleDateString('pt-BR')}
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              Por: {u.approvedBy || 'Master Admin'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-amber-800 font-semibold">Solicitado em:</span> {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
                          </div>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPending ? (
                            <>
                              {/* COPY DIRECT APPROVAL LINK */}
                              <button
                                type="button"
                                onClick={() => handleCopyApprovalLink(u)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                                title="Copiar link direto de aprovação na plataforma"
                              >
                                {copiedApprovalLinkId === u.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                                ) : (
                                  <Link2 className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* APPROVE BUTTON (TRIGGERS EMAIL CONFIRMATION MODAL) */}
                              <button
                                type="button"
                                onClick={() => handleOpenApproveModal(u)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition-all active:scale-95"
                                title="Aprovar solicitação e enviar e-mail corporativo de confirmação"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Aprovar Acesso</span>
                              </button>

                              {/* REJECT BUTTON */}
                              <button
                                type="button"
                                onClick={() => setRejectModalUser(u)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                                title="Rejeitar solicitação de cadastro"
                              >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* TOGGLE BLOCK / UNBLOCK */}
                              <button
                                onClick={() => handleToggleBlock(u)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  isActive
                                    ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                                }`}
                                title={isActive ? 'Bloquear acesso do usuário' : 'Habilitar / Desbloquear acesso'}
                              >
                                {isActive ? (
                                  <>
                                    <Lock className="w-3 h-3 text-rose-600" />
                                    <span>Bloquear</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3 h-3 text-emerald-700" />
                                    <span>Habilitar</span>
                                  </>
                                )}
                              </button>

                              {/* EDIT USER */}
                              <button
                                onClick={() => setEditingUser(u)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                                title="Editar perfil, unidade ou departamento"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>
            Exibindo <strong className="text-slate-800">{filteredUsers.length}</strong> de <strong className="text-slate-800">{users.length}</strong> usuários cadastrados
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Governança de Acessos PremieRpet
          </span>
        </div>
      </div>

      {/* 5. MODAL: CONFIRMAÇÃO DE APROVAÇÃO COM DISPARO DE E-MAIL */}
      {approvalModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Homologar Acesso & Enviar E-mail de Liberação
                  </h3>
                  <p className="text-xs text-slate-500">
                    O solicitante receberá um e-mail corporativo com as credenciais aprovadas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovalModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Email Preview Layout */}
            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 font-mono text-slate-600 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>De:</span>
                  <strong className="text-slate-900">governanca.pdm@premierpet.com.br</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Para:</span>
                  <strong className="text-emerald-800">{approvalModalUser.email}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Assunto:</span>
                  <strong className="text-slate-900">[PremieRpet] Seu acesso à Plataforma foi Liberado com Sucesso!</strong>
                </div>
              </div>

              {/* Email Body Card */}
              <div className="p-5 rounded-xl border border-emerald-200 bg-white shadow-xs space-y-3 font-sans">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                    PR
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">PremieRpet · Governança Corporativa de Materiais</h4>
                    <span className="text-[10px] text-slate-400">Sistema Oficial de Gestão de Almoxarifado Industrial & PDM</span>
                  </div>
                </div>

                <div className="space-y-2 text-slate-700 leading-relaxed">
                  <p>
                    Olá, <strong>{approvalModalUser.name}</strong>,
                  </p>
                  <p>
                    Sua solicitação de cadastro na plataforma foi analisada e <strong>APROVADA</strong> pelo Administrador Master. A partir de agora, suas credenciais estão ativas para operação.
                  </p>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] space-y-1">
                    <div><strong>Usuário (Login):</strong> <span className="text-emerald-800 font-bold">{approvalModalUser.username}</span></div>
                    <div><strong>Perfil de Acesso:</strong> {PROFILE_LABELS[approvalModalUser.role] || 'Almoxarifado'}</div>
                    <div><strong>Unidade Padrão:</strong> {approvalModalUser.tenantName}</div>
                    <div><strong>Status:</strong> <span className="text-emerald-700 font-bold">ATIVO / LIBERADO</span></div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-emerald-900 block">
                      Link de Acesso Direto à Plataforma:
                    </span>
                    <a
                      href={window.location.origin}
                      onClick={(e) => {
                        e.preventDefault();
                        handleConfirmApproval();
                      }}
                      className="text-xs font-mono font-bold text-emerald-700 hover:text-emerald-900 underline break-all flex items-center gap-1"
                    >
                      <span>{window.location.origin}/?login={encodeURIComponent(approvalModalUser.username)}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Para acessar a plataforma, utilize seu login <strong>{approvalModalUser.username}</strong> e a senha definida no cadastro, validando o acesso com o Microsoft Authenticator.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setApprovalModalUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmApproval}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar Liberação & Disparar E-mail</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. MODAL: CRIAR NOVO USUÁRIO DIRETAMENTE (MASTER ADMIN) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Cadastrar Novo Usuário Homologado
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gera automaticamente o login no padrão primeiro_nome.ultimo_sobrenome.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}
              {/* Nome Completo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo da Silva"
                  value={formFullName}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Login Gerado Automaticamente */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Login de Acesso *
                  </label>
                </div>
                <input
                  type="text"
                  required
                  placeholder="carlos.silva"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase().trim())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-emerald-950 font-mono font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* E-mail Corporativo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  E-mail Corporativo (@premierpet.com.br) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="carlos.silva@premierpet.com.br"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-mono"
                />
              </div>

              {/* Perfil de Acesso */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Perfil de Acesso *
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserProfileRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                >
                  <option value="MANUTENCAO_PRODUCAO">Manutenção/Produção</option>
                  <option value="ALMOXARIFADO">Almoxarifado</option>
                  <option value="MASTER_ADMIN">Master Admin (Global)</option>
                </select>
              </div>

              {/* Unidade Padrão */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Unidade Padrão *
                </label>
                <select
                  value={formTenantId}
                  onChange={(e) => setFormTenantId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                >
                  {TENANTS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Senha com Validação Estrita */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  Senha Provisória do Usuário *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 chars, maiúscula, minúscula, número e especial"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />

                {/* Password Checklist */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-[10px]">
                  <span className="font-sans font-bold text-slate-600 block mb-1">Requisitos de Senha PremieRpet:</span>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasMinLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {passwordValidation.hasMinLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 text-center">•</span>}
                    <span>No mínimo 6 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasUppercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {passwordValidation.hasUppercase ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 text-center">•</span>}
                    <span>Pelo menos uma letra maiúscula (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasLowercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {passwordValidation.hasLowercase ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 text-center">•</span>}
                    <span>Pelo menos uma letra minúscula (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {passwordValidation.hasNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 text-center">•</span>}
                    <span>Pelo menos um número (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasSpecialChar ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {passwordValidation.hasSpecialChar ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 text-center">•</span>}
                    <span>Pelo menos um caractere especial (!@#$...)</span>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!passwordValidation.isValid}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Salvar e Habilitar Usuário
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 7. MODAL: EDITAR USUÁRIO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Editar Cadastro · {editingUser.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Login: {editingUser.username}
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold"
                >
                  <option value="MANUTENCAO_PRODUCAO">Manutenção/Produção</option>
                  <option value="ALMOXARIFADO">Almoxarifado</option>
                  <option value="MASTER_ADMIN">Master Admin (Global)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Unidade Padrão
                </label>
                <select
                  value={editingUser.tenantId}
                  onChange={(e) => setEditingUser({ ...editingUser, tenantId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold"
                >
                  {TENANTS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Setor / Departamento
                </label>
                <input
                  type="text"
                  value={editingUser.department || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 8. MODAL: CONFIRMAR REJEIÇÃO DE SOLICITAÇÃO */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4 text-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Rejeitar Solicitação de Acesso
                </h3>
                <p className="text-xs text-slate-500">
                  {rejectModalUser.name} (<span className="font-mono">{rejectModalUser.username}</span>)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50/70 border border-rose-200 rounded-xl p-3">
              Ao confirmar, esta solicitação pendente será removida da fila de aprovação da plataforma.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectRequest}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: INTEGRAÇÃO SHAREPOINT VIA POWER AUTOMATE (OPÇÃO 2) */}
      {isSharePointModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 bg-blue-50/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Sincronização SharePoint via Power Automate
                  </h3>
                  <p className="text-xs text-slate-600">
                    Persiste apenas os dados criados no site (usuários, aprovações, níveis PDM e histórico de alterações).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSharePointModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Server Environment Configuration Overview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-slate-900">Variáveis de Ambiente no Servidor (Secrets)</strong>
                  {sharePointStatus?.lastSyncAt && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Última verificação: {new Date(sharePointStatus.lastSyncAt).toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className={`p-2.5 rounded-lg border ${sharePointStatus?.writeConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <div className="font-bold">POWER_AUTOMATE_WRITE_URL</div>
                    <div className="text-[10px] mt-0.5">
                      {sharePointStatus?.writeConfigured ? 'Configurada' : 'Não configurada'}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${sharePointStatus?.readConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <div className="font-bold">POWER_AUTOMATE_READ_URL</div>
                    <div className="text-[10px] mt-0.5">
                      {sharePointStatus?.readConfigured ? 'Configurada' : 'Não configurada'}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${sharePointStatus?.emailConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <div className="font-bold">POWER_AUTOMATE_EMAIL_URL</div>
                    <div className="text-[10px] mt-0.5">
                      {sharePointStatus?.emailConfigured ? 'Configurada (Opcional)' : 'Não configurada'}
                    </div>
                  </div>
                </div>

                {sharePointStatus?.lastSyncMessage && (
                  <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                    {sharePointStatus.lastSyncMessage}
                  </div>
                )}
              </div>

              {/* Step-by-step SharePoint + Power Automate Guide */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs">
                  Passo a passo para conectar sua Lista ou Biblioteca no SharePoint:
                </h4>
                <ol className="list-decimal pl-5 space-y-2 text-slate-700 leading-relaxed">
                  <li>
                    <strong>Crie uma Lista no SharePoint</strong> chamada <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-900">PDM_Governanca_Delta</code> com as colunas: <code className="bg-slate-100 px-1 rounded font-mono">Versao</code> (Número), <code className="bg-slate-100 px-1 rounded font-mono">AtualizadoPor</code> (Texto), <code className="bg-slate-100 px-1 rounded font-mono">AtualizadoEm</code> (Texto) e <code className="bg-slate-100 px-1 rounded font-mono">DeltaJSON</code> (Várias linhas de texto / texto sem formatação).
                  </li>
                  <li>
                    <strong>Fluxo 1 (Gravação - <code className="font-mono">POWER_AUTOMATE_WRITE_URL</code>):</strong> no Power Automate, crie um fluxo <em>Instantâneo</em> com o gatilho <strong>Quando uma solicitação HTTP é recebida</strong>, cole o esquema JSON abaixo e adicione a ação do SharePoint <strong>Atualizar item</strong> (ou <strong>Criar arquivo</strong> com o campo <code className="font-mono">deltaJson</code>).
                  </li>
                  <li>
                    <strong>Fluxo 2 (Leitura - <code className="font-mono">POWER_AUTOMATE_READ_URL</code>):</strong> crie um segundo fluxo HTTP que lê o item/arquivo do SharePoint e responde (<code className="font-mono">Response 200</code>) retornando <code className="bg-slate-100 px-1 rounded font-mono">{`{ "deltaJson": "..." }`}</code>.
                  </li>
                  <li>
                    <strong>Fluxo 3 Opcional (E-mail Outlook - <code className="font-mono">POWER_AUTOMATE_EMAIL_URL</code>):</strong> recebe <code className="font-mono">to</code>, <code className="font-mono">subject</code>, <code className="font-mono">userName</code>, <code className="font-mono">username</code> e <code className="font-mono">loginUrl</code> e envia via conector Outlook 365 ao aprovar um usuário.
                  </li>
                </ol>
              </div>

              {/* JSON Schema Copy Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px]">
                    Esquema JSON de Saída do App (para colar em "Usar payload de exemplo" no Power Automate):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const samplePayload = JSON.stringify(
                        {
                          schemaVersion: '1.0',
                          source: 'PremieRpet-PDM-Industrial',
                          eventType: 'GOVERNANCE_STATE_SYNC',
                          version: 1,
                          updatedAt: '2026-11-13T12:00:00.000Z',
                          updatedBy: 'Master Admin',
                          summary: {
                            totalUsers: 5,
                            pendingUsers: 1,
                            customPdmItems: 2,
                            modifiedBaseItems: 4,
                            totalChangeLogs: 6,
                            pdmLevelsCount: 40,
                            siteMovementsCount: 0,
                          },
                          deltaJson: '{"version":1,"users":[],"pdmLevels":[],"customPdmItems":[],"itemOverrides":{},"movements":[]}',
                        },
                        null,
                        2
                      );
                      navigator.clipboard.writeText(samplePayload);
                      setCopiedSchema(true);
                      setTimeout(() => setCopiedSchema(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px]"
                  >
                    {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSchema ? 'JSON Copiado!' : 'Copiar JSON Exemplo'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[10px] overflow-x-auto leading-relaxed">
{`{
  "schemaVersion": "1.0",
  "source": "PremieRpet-PDM-Industrial",
  "version": 1,
  "updatedAt": "2026-11-13T12:00:00.000Z",
  "updatedBy": "Master Admin",
  "deltaJson": "{...pacote completo de usuarios, niveis PDM e historico...}"
}`}
                </pre>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsSharePointModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
              >
                Fechar
              </button>

              {onManualSharePointSync && (
                <button
                  type="button"
                  disabled={isSyncingSharePoint}
                  onClick={async () => {
                    setIsSyncingSharePoint(true);
                    try {
                      await onManualSharePointSync();
                    } finally {
                      setIsSyncingSharePoint(false);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSharePoint ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSharePoint ? 'Sincronizando...' : 'Sincronizar Agora com SharePoint'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
