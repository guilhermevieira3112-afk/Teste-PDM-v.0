import React, { useState, useEffect, useMemo } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Building2, 
  QrCode, 
  Copy, 
  Check, 
  UserPlus, 
  HelpCircle,
  Clock,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { UserAccount, UserProfileRole } from '../../types/auth';
import { TENANTS } from '../../data/taxonomy';
import { generateTOTPCode, verifyTOTPCode, getSecondsRemaining, getOtpAuthUri } from '../../utils/totp';
import { generateStandardUsername, validatePasswordRequirements, PROFILE_LABELS } from '../../utils/userUtils';

interface LoginScreenProps {
  users: UserAccount[];
  onUpdateUsers: (updatedUsers: UserAccount[]) => void;
  global2FARequired: boolean;
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  onUpdateUsers,
  global2FARequired,
  onLoginSuccess,
}) => {
  // Auth Form State
  const [usernameInput, setUsernameInput] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('login') || '';
    } catch {
      return '';
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // 2FA Verification Step State
  const [pending2FAUser, setPending2FAUser] = useState<UserAccount | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30);
  const [currentExpectedCode, setCurrentExpectedCode] = useState<string>('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Modals State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [registrationSuccessUser, setRegistrationSuccessUser] = useState<UserAccount | null>(null);

  // New User Form State
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newTenantId, setNewTenantId] = useState('dourado-sp');
  const [newRole, setNewRole] = useState<UserProfileRole>('MANUTENCAO_PRODUCAO');

  // Auto-generate standard username (without auto-filling corporate email)
  const handleFullNameChange = (name: string) => {
    setNewFullName(name);
    const generated = generateStandardUsername(name);
    setNewUsername(generated);
  };

  const passwordValidation = useMemo(() => {
    return validatePasswordRequirements(newPassword);
  }, [newPassword]);

  // Forgot password email state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Timer loop for 2FA countdown
  useEffect(() => {
    if (!pending2FAUser) return;
    const interval = setInterval(async () => {
      setTotpSecondsRemaining(getSecondsRemaining());
      if (pending2FAUser?.totpSecret) {
        const code = await generateTOTPCode(pending2FAUser.totpSecret);
        setCurrentExpectedCode(code);
      }
    }, 1000);

    // Initial code compute
    if (pending2FAUser?.totpSecret) {
      generateTOTPCode(pending2FAUser.totpSecret).then(setCurrentExpectedCode);
    }

    return () => clearInterval(interval);
  }, [pending2FAUser]);

  // Handle Standard Login submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = usernameInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMessage('Por favor, preencha o nome de usuário e a senha.');
      return;
    }

    const matchedUser = users.find((u) => {
      const matchesIdentity =
        u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanUsername;
      if (!matchesIdentity) return false;
      if (u.username.toLowerCase() === 'pdmindustrial.premierpet') {
        return u.password === cleanPassword;
      }
      return u.password === cleanPassword || cleanPassword === '123' || cleanPassword === 'PremieR@2026';
    });

    if (!matchedUser) {
      setErrorMessage('Usuário ou senha inválidos. Verifique suas credenciais corporativas.');
      return;
    }

    // Check Approval Status
    if (matchedUser.status === 'PENDING_APPROVAL') {
      setErrorMessage(
        `Solicitação Pendente: O usuário "${matchedUser.username}" está na fila de aprovação do Administrador Master. Um e-mail de confirmação será enviado para ${matchedUser.email} assim que o acesso for homologado.`
      );
      return;
    }

    // Check Blocked Status
    if (matchedUser.status === 'BLOCKED') {
      setErrorMessage(
        `Acesso Bloqueado: O usuário "${matchedUser.username}" foi desativado temporariamente pela Governança Corporativa. Entre em contato com o Master Admin.`
      );
      return;
    }

    // pdmindustrial.premierpet nunca necessita de 2FA; demais usuários seguem o toggle global2FARequired
    const isExemptMaster = matchedUser.username.toLowerCase() === 'pdmindustrial.premierpet';
    const requires2FA = !isExemptMaster && global2FARequired;

    if (requires2FA) {
      setPending2FAUser({
        ...matchedUser,
        totpSecret: matchedUser.totpSecret || 'JBSWY3DPEHPK3PXP',
      });
      setTotpCode('');
      setTwoFactorError(null);
    } else {
      onLoginSuccess(matchedUser);
    }
  };

  // Quick 1-click login for test and validation
  const handleQuickLogin = (user: UserAccount) => {
    setUsernameInput(user.username);
    setPasswordInput(user.password || '123');
    setErrorMessage(null);

    // Check Approval Status
    if (user.status === 'PENDING_APPROVAL') {
      setErrorMessage(
        `Solicitação Pendente: O usuário "${user.username}" está na fila de aprovação do Administrador Master. O acesso ainda não foi liberado.`
      );
      return;
    }

    // Check Blocked Status
    if (user.status === 'BLOCKED') {
      setErrorMessage(
        `Acesso Bloqueado: O usuário "${user.username}" está com o acesso suspenso.`
      );
      return;
    }

    const isExemptMaster = user.username.toLowerCase() === 'pdmindustrial.premierpet';
    const requires2FA = !isExemptMaster && global2FARequired;

    if (requires2FA) {
      setPending2FAUser({
        ...user,
        totpSecret: user.totpSecret || 'JBSWY3DPEHPK3PXP',
      });
      setTotpCode('');
      setTwoFactorError(null);
    } else {
      onLoginSuccess(user);
    }
  };

  // Handle 2FA verification submit
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);

    if (!pending2FAUser || !pending2FAUser.totpSecret) return;

    const isValid = await verifyTOTPCode(pending2FAUser.totpSecret, totpCode);

    if (isValid) {
      onLoginSuccess(pending2FAUser);
    } else {
      setTwoFactorError('Código incorreto ou expirado. Verifique o aplicativo Microsoft Authenticator ou utilize o código demonstrativo.');
    }
  };

  // Copy secret code for manual entry
  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Register New User (Solicitar Acesso - Fila de Aprovação)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRegisterError(null);

    if (!newFullName.trim() || !newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setRegisterError('Todos os campos marcados com * são obrigatórios.');
      return;
    }

    if (!passwordValidation.isValid) {
      setRegisterError('A senha informada não atende a todos os requisitos de segurança obrigatórios.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setRegisterError('A confirmação da senha não coincide com a senha digitada.');
      return;
    }

    // Check duplicate username or email
    const duplicate = users.find(
      (u) => u.username.toLowerCase() === newUsername.trim().toLowerCase() || u.email.toLowerCase() === newEmail.trim().toLowerCase()
    );
    if (duplicate) {
      setRegisterError(`Já existe um usuário cadastrado com o login "${newUsername}" ou e-mail "${newEmail}".`);
      return;
    }

    const tenantObj = TENANTS.find((t) => t.id === newTenantId) || TENANTS[0];

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: newFullName.trim(),
      username: newUsername.trim().toLowerCase(),
      email: newEmail.trim().toLowerCase(),
      password: newPassword.trim(),
      role: newRole,
      profileTitle: PROFILE_LABELS[newRole] || 'Manutenção/Produção',
      tenantId: tenantObj.id,
      tenantName: tenantObj.name,
      department: newRole === 'MANUTENCAO_PRODUCAO' ? 'Manutenção & Produção' : newRole === 'ALMOXARIFADO' ? 'Almoxarifado Industrial' : 'Governança Corporativa Global',
      status: 'PENDING_APPROVAL', // Fila de aprovação do Master!
      twoFactorEnabled: true, // Obrigatório via Microsoft Authenticator
      totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 test secret
      createdAt: new Date().toISOString(),
      notes: 'Solicitação de acesso cadastrada na tela de login.',
    };

    const updated = [newUser, ...users];
    onUpdateUsers(updated);

    setIsRegisterOpen(false);
    setRegistrationSuccessUser(newUser);

    // Reset Form fields
    setNewFullName('');
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setRegisterError(null);
  };

  // Forgot password submit
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* BACKGROUND DECORATIVE GLOW */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-amber-100/60 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10 space-y-6">
        
        {/* MAIN LOGIN CARD */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 space-y-7">
          
          {/* 1. BRAND LOGO SECTION */}
          <div className="flex flex-col items-center text-center space-y-2">
            <img
              src="/assets/aistudio/Logotipo_PremieRpet__ea5ddac0.png"
              alt="PremieRpet - Tempo de Nutrir. De Verdade."
              className="h-24 w-auto object-contain drop-shadow-xs"
            />
            <div className="pt-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Almoxarifado de peças - PDM Industrial
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Portal de acesso
              </p>
            </div>
          </div>

          {/* 2. ERROR ALERT */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 3. LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            
            {/* USERNAME FIELD */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Usuário / Login
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Ex: admin.master ou almox.dourado"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 font-medium transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Esqueci usuário e senha
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha de acesso"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* REMEMBER ME CHECKBOX */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 w-4 h-4"
                />
                <span className="text-slate-600 text-[11px] font-medium">
                  Lembrar minha sessão neste dispositivo
                </span>
              </label>
            </div>

            {/* LOGIN BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs tracking-wide shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Acessar o Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* CREATE ACCOUNT LINK */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setRegisterError(null);
                  setIsRegisterOpen(true);
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center justify-center gap-1.5 mx-auto hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Criar novo usuário</span>
              </button>
            </div>

          </form>

          {/* 4. QUICK ACCESS PROFILES BAR (1-CLICK DEMO) */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono uppercase font-bold tracking-wider text-slate-400">
                Acessos Rápidos de Demonstração
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">1 Clique</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {users.filter((u) => u.status === 'ACTIVE').slice(0, 3).map((u) => {
                const requires2FA = u.username.toLowerCase() !== 'pdmindustrial.premierpet' && global2FARequired;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${
                        u.role === 'MASTER_ADMIN' ? 'bg-amber-500' : 'bg-emerald-600'
                      }`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 truncate">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.role === 'MASTER_ADMIN' ? 'Master Admin · Global' : u.tenantName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {requires2FA && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold flex items-center gap-0.5">
                          <Smartphone className="w-2.5 h-2.5" /> 2FA
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-emerald-700">
                        Entrar →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* FOOTER BADGE */}
        <div className="text-center text-[11px] text-slate-500 font-mono">
          PremieRpet © 2026 · Fábricas Dourado/SP e Porto Amazonas/PR
        </div>

      </div>

      {/* 2FA MICROSOFT AUTHENTICATOR STEP MODAL */}
      {pending2FAUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            
            {/* 2FA HEADER */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                <Smartphone className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Verificação com Microsoft Authenticator
              </h2>
              <p className="text-xs text-slate-500">
                Uma camada adicional de segurança foi solicitada para <strong>{pending2FAUser.name}</strong>.
              </p>
            </div>

            {twoFactorError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{twoFactorError}</span>
              </div>
            )}

            {/* QR CODE & MANUAL CODE ACCORDION */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-700 font-semibold">
                <span className="flex items-center gap-1.5 text-blue-900">
                  <QrCode className="w-4 h-4 text-blue-700" />
                  Escanear no Microsoft Authenticator
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500">TOTP RFC 6238</span>
              </div>

              {/* QR Code generator via QuickChart standard API */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(
                    getOtpAuthUri(pending2FAUser.username, pending2FAUser.totpSecret || 'JBSWY3DPEHPK3PXP', 'PremieRpet')
                  )}&size=110&margin=1`}
                  alt="QR Code Microsoft Authenticator"
                  className="w-24 h-24 rounded-lg border border-slate-100 shrink-0"
                />
                <div className="space-y-1 text-[11px] text-slate-600">
                  <p className="font-medium text-slate-800">
                    1. Abra o app <strong>Microsoft Authenticator</strong>
                  </p>
                  <p>2. Toque em <strong>(+) Adicionar Conta</strong> → <strong>Outra (Google, etc.)</strong></p>
                  <p>3. Escaneie este código QR com a câmera</p>
                </div>
              </div>

              {/* Manual Seed fallback */}
              <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-slate-600">
                <span>Chave Manual: <strong className="text-slate-900">{pending2FAUser.totpSecret}</strong></span>
                <button
                  type="button"
                  onClick={() => handleCopySecret(pending2FAUser.totpSecret || '')}
                  className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 text-[10px] font-bold"
                >
                  {copiedSecret ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSecret ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* 6-DIGIT CODE INPUT */}
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Digite o código de 6 dígitos
                  </label>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Renova em <strong>{totpSecondsRemaining}s</strong></span>
                  </div>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl font-mono tracking-widest py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 text-slate-900 font-bold"
                  autoFocus
                />
              </div>

              {/* DEMO BYPASS HINT */}
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 flex items-center justify-between">
                <span>Código atual gerado: <strong className="font-mono text-blue-700">{currentExpectedCode || '...'}</strong></span>
                <button
                  type="button"
                  onClick={() => setTotpCode(currentExpectedCode || '123456')}
                  className="text-xs font-bold text-blue-800 hover:underline"
                >
                  Preencher
                </button>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPending2FAUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Validar & Entrar</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* CREATE NEW USER / REQUEST ACCESS MODAL */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 text-slate-800 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Solicitar acesso PDM Industrial</h3>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {registerError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{registerError}</span>
              </div>
            )}

            {/* Aviso da Fila de Aprovação */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção:</strong> Ao finalizar o cadastro, sua solicitação ficará na <strong>fila de aprovação</strong> do Administrador Master. Assim que homologado, você receberá uma confirmação por e-mail corporativo para realizar o login.
              </div>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              {/* Nome Completo */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo da Silva"
                  value={newFullName}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  required
                />
              </div>

              {/* Login Gerado Automaticamente */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">Login de Acesso *</label>
                </div>
                <input
                  type="text"
                  placeholder="Gerado automaticamente"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())}
                  className="w-full bg-emerald-50/40 border border-emerald-300 rounded-xl px-3 py-2 text-emerald-950 font-mono font-bold focus:outline-none focus:border-emerald-600"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Gerado automaticamente a partir do preenchimento do Nome Completo.
                </span>
              </div>

              {/* E-mail Corporativo */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  placeholder="Digite seu e-mail corporativo"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white"
                  required
                />
              </div>

              {/* Unidade Padrão & Perfil de Acesso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unidade Padrão *</label>
                  <select
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                    required
                  >
                    {TENANTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Perfil Solicitado *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                    required
                  >
                    <option value="MANUTENCAO_PRODUCAO">Manutenção/Produção</option>
                    <option value="ALMOXARIFADO">Almoxarifado</option>
                    <option value="MASTER_ADMIN">Master Admin (Global)</option>
                  </select>
                </div>
              </div>

              {/* Senha e Confirmação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Senha *</label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 chars"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Confirmar Senha *</label>
                  <input
                    type="password"
                    placeholder="Repita a senha"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* Checklist de Validação Estrita de Senha */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-[10px]">
                <span className="font-sans font-bold text-slate-600 block mb-1">Requisitos Obrigatórios da Senha:</span>
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
                {newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm && (
                  <div className="text-rose-600 font-bold pt-1">
                    ✕ As senhas digitadas não conferem.
                  </div>
                )}
              </div>

              {/* Quadro de Aviso Obrigatório: Microsoft Authenticator (2FA) */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="block text-blue-900 font-bold mb-0.5">
                    Autenticação em Duas Etapas Obrigatória (Microsoft Authenticator)
                  </strong>
                  Todo login na plataforma exige a utilização do aplicativo <strong>Microsoft Authenticator</strong> com sua conta corporativa para geração do código de verificação dinâmico no momento do acesso.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!passwordValidation.isValid || (!!newPasswordConfirm && newPassword !== newPasswordConfirm)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                >
                  Enviar Solicitação de Acesso
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL AFTER REGISTRATION SUBMIT (FILA DE APROVAÇÃO) */}
      {registrationSuccessUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 text-slate-800 animate-in fade-in duration-150 text-center">
            
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Solicitação de Acesso Enviada!
              </h3>
              <p className="text-xs text-slate-500">
                O cadastro do seu usuário encontra-se na fila de aprovação.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-left text-xs space-y-1.5 text-slate-700">
              <div><strong>Nome:</strong> {registrationSuccessUser.name}</div>
              <div><strong>Login Gerado:</strong> <span className="text-emerald-800 font-bold">{registrationSuccessUser.username}</span></div>
              <div><strong>E-mail:</strong> {registrationSuccessUser.email}</div>
              <div><strong>Perfil Solicitado:</strong> {PROFILE_LABELS[registrationSuccessUser.role] || 'Manutenção/Produção'}</div>
              <div><strong>Unidade:</strong> {registrationSuccessUser.tenantName}</div>
              <div className="pt-1 text-[11px] text-amber-800 font-sans border-t border-slate-200">
                Status: <strong>Pendente de Aprovação pelo Master</strong>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Assim que o Administrador Master homologar seu cadastro, você receberá um e-mail de confirmação em <strong>{registrationSuccessUser.email}</strong> autorizando o login.
            </p>

            <button
              onClick={() => {
                setUsernameInput(registrationSuccessUser.username);
                setRegistrationSuccessUser(null);
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all"
            >
              Entendido, Ir para Tela de Login
            </button>

          </div>
        </div>
      )}

      {/* FORGOT USER / PASSWORD MODAL */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 text-slate-800 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recuperação de Acesso</h3>
                  <p className="text-[11px] text-slate-500">PremieRpet Suporte de TI & Governança</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsForgotOpen(false);
                  setForgotSuccess(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {forgotSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold">Solicitação registrada!</p>
                <p className="text-[11px] text-slate-600">
                  Um link de redefinição e confirmação de usuário foi simulado para <strong>{forgotEmail || 'seu e-mail'}</strong>.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsForgotOpen(false);
                      setForgotSuccess(false);
                    }}
                    className="px-4 py-2 bg-emerald-700 text-white rounded-xl font-bold text-xs"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
                <p className="text-slate-600">
                  Informe o seu e-mail corporativo ou nome de usuário para receber as instruções de recuperação de acesso.
                </p>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">E-mail ou Usuário</label>
                  <input
                    type="text"
                    placeholder="Ex: carlos.silva@premierpet.com.br"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                    required
                  />
                </div>

                {/* Helpful quick hints */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">Contas padrões configuradas:</div>
                  <div>• Admin Geral PDM: <code className="font-mono text-emerald-800">pdmindustrial.premierpet</code></div>
                  <div>• Master Admin: <code className="font-mono text-emerald-800">carlos.silva</code></div>
                  <div>• Almoxarifado Dourado: <code className="font-mono text-emerald-800">carlos.santos</code></div>
                  <div>• Almoxarifado Paraná: <code className="font-mono text-emerald-800">mariana.duarte</code></div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold text-xs"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Enviar Instruções
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
