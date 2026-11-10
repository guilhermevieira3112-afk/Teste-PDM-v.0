# Tela de Login & Autenticação Multifator (2FA) PremieRpet

Implementação da tela de autenticação de entrada do sistema PremieRpet, substituição da identidade visual pelo logotipo oficial em PNG e integração do fluxo de verificação em duas etapas (2FA) compatível com o Microsoft Authenticator.

### User Review & Critical Decisions

> [!IMPORTANT]
> Nenhuma linha de código foi modificada nesta etapa. A execução somente será iniciada após a sua aprovação explícita.

- **Logotipo Oficial**: Utilização da imagem oficial anexada (`/public/assets/aistudio/Logotipo_PremieRpet__ea5ddac0.png`), aplicando-a tanto na tela de Login quanto no topo da barra de navegação lateral fixa (Sidebar).
- **Verificação via Microsoft Authenticator**: 
  - O aplicativo **Microsoft Authenticator** utiliza o padrão aberto **TOTP (Time-based One-Time Password - RFC 6238)**, gerando códigos de 6 dígitos renovados a cada 30 segundos.
  - O sistema implementará um fluxo com **QR Code de ativação** e chave secreta que pode ser lido diretamente pelo app do celular (Microsoft Authenticator ou Google Authenticator), seguido de validação do código de 6 dígitos antes de liberar o acesso à plataforma.
  - Para agilidade de testes e demonstração, haverá também atalhos com perfis pré-configurados (Master Admin, Almoxarife Dourado/SP e Almoxarife Porto Amazonas/PR).

---

### 1. Overview & Core Concept

- **O que faz**: Protege o acesso ao sistema corporativo de almoxarifado PremieRpet através de controle de acesso por credenciais (usuário e senha) e opcionalmente uma segunda camada de segurança (2FA TOTP).
- **Experiência do Usuário**:
  1. O usuário acessa o sistema e visualiza a tela de login com o logotipo oficial da PremieRpet em fundo claro institucional.
  2. Pode efetuar o login com usuário e senha, clicar em **"Criar novo usuário"** ou em **"Esqueci usuário e senha"**.
  3. Caso a verificação em duas etapas esteja habilitada para a conta, abre-se a etapa de validação solicitando o código do **Microsoft Authenticator**.
  4. Após o login validado, o usuário é direcionado ao ambiente do sistema, onde sua identidade e permissões (Master Admin ou Almoxarife de Dourado ou Porto Amazonas) são reconhecidas e exibidas no perfil do usuário, com opção de **Logout** para encerrar a sessão.

---

### 2. User Experience & Visual Design

#### Fluxos de Interface

1. **Tela de Login Principal**:
   - Cartão centralizado em layout claro (`#f8fafc`), limpo e corporativo.
   - Logotipo oficial PremieRpet (`Logotipo_PremieRpet__ea5ddac0.png`) centralizado com tipografia institucional.
   - Campos de formulário com foco e bordas verdes PremieRpet:
     - Campo **Usuário** (Login ou E-mail corporativo).
     - Campo **Senha** (com alternância de visibilidade do texto).
   - Botão primário **Entrar no Sistema**.
   - Links auxiliares em estilo de texto limpo: **"Criar novo usuário"** e **"Esqueci usuário e senha"**.
   - Painel rápido de acesso demonstrativo (1 clique para alternar entre os usuários reais da fábrica: *Carlos Eduardo - Dourado*, *Mariana Duarte - Porto Amazonas*, *Admin Corporativo - Governança*).

2. **Etapa de Verificação 2FA (Microsoft Authenticator)**:
   - Exibição de modal / tela de segurança com ícone de autenticação em duas etapas.
   - Opção para **Escanear QR Code** de configuração no Microsoft Authenticator e campo numérico de 6 dígitos (`_ _ _  _ _ _`) com contagem de tempo de expiração de 30 segundos.
   - Botão para confirmar token ou botão de pular/modo rápido para demonstração.

3. **Modais de Suporte**:
   - **Modal de Criação de Usuário**: Nome completo, e-mail, nome de usuário, senha, seleção de unidade padrão (*Dourado/SP* ou *Porto Amazonas/PR*) e papel (*Almoxarife* ou *Master Admin*).
   - **Modal de Recuperação de Senha**: Instrução clara para recuperação de acesso via e-mail corporativo ou contato com a equipe de Governança de TI PremieRpet.

4. **Sessão Conectada**:
   - Na barra lateral esquerda (Sidebar), substituição do logo vetorial pela imagem oficial PNG.
   - Rodapé da barra com identificação do usuário logado (foto/avatar, nome e cargo) e botão de **Encerrar Sessão (Sair)** que retorna à tela de login.

---

### 3. Key Product Decisions & Trade-Offs

- **Padrão RFC 6238 TOTP para Microsoft Authenticator**:
  - *Decisão*: Implementação de algoritmo TOTP determinístico compatível com o aplicativo móvel Microsoft Authenticator.
  - *Motivo*: Permite escanear o QR Code diretamente com o celular corporativo e gerar os códigos de 6 dígitos sem depender de servidores externos ou custos de SMS, funcionando inclusive offline.
- **Persistência de Sessão no Navegador**:
  - *Decisão*: Armazenamento do estado do usuário logado em `localStorage` com opção de logout explícito.
  - *Motivo*: Permite recarregar a página sem perder o estado autenticado durante a operação no almoxarifado.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Fluxo de Autenticação                           │
│                                                                        │
│   [ Tela de Login ]                                                    │
│    - Logo Oficial PremieRpet (PNG)                                     │
│    - Campo Usuário + Senha                                             │
│    - Ações: Entrar | Criar Usuário | Esqueci Senha                     │
│    - Acessos Rápidos Demonstrativos                                    │
│                     │                                                  │
│                     ▼                                                  │
│         [ Verificação de Senha ]                                       │
│                     │                                                  │
│                     ▼                                                  │
│         [ 2FA Microsoft Authenticator ] ─── (Opcional / Ativável)      │
│          - Leitura de QR Code TOTP                                     │
│          - Código 6 dígitos                                            │
│                     │                                                  │
│                     ▼                                                  │
│   [ Sessão Conectada no Workspace ]                                    │
│    - Sidebar com Logo PNG PremieRpet                                   │
│    - Usuário ativo com perfil (Master ou Almoxarife)                   │
│    - Botão de Logout no rodapé                                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### Usuários Pré-configurados para Demonstração:

1. **Gestor Master Admin (Governança Corporativa)**
   - Usuário: `admin.master` | Senha: `123`
   - Escopo: Global (Dourado e Porto Amazonas)
2. **Almoxarife Dourado / SP**
   - Usuário: `almox.dourado` | Senha: `123`
   - Escopo: Planta Dourado / SP (`DOU-01`)
3. **Almoxarife Porto Amazonas / PR**
   - Usuário: `almox.parana` | Senha: `123`
   - Escopo: Fábrica Porto Amazonas / PR (`PAM-02`)
