# Documenta��o do Projeto SecureLab RFID (React)

## 1. Introdu��o

Este documento fornece uma documenta��o abrangente do projeto SecureLab RFID, uma aplica��o web constru�da com React para gerenciar o controle de acesso baseado em RFID. O sistema permite monitorar e controlar portas e dispositivos, gerenciar usu�rios e visualizar logs de acesso, al�m de fornecer insights gerados por IA.

O objetivo desta documenta��o � detalhar as ferramentas e tecnologias utilizadas, a estrutura do projeto, a intera��o com o banco de dados, o funcionamento de cada p�gina e componente chave, as configura��es e alguns pontos de melhoria identificados.

## 2. Ferramentas e Tecnologias Utilizadas

O projeto SecureLab React utiliza as seguintes ferramentas e tecnologias:

*   **Linguagem/Framework:** React, JavaScript/JSX
*   **Ferramenta de Build/Desenvolvimento:** Vite
*   **Linting:** ESLint (com `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)
*   **Gerenciamento de Depend�ncias:** npm/yarn
*   **Banco de Dados:** Firebase Realtime Database
*   **Autentica��o:** Firebase Authentication
*   **Hospedagem/Deploy:** Firebase Hosting
*   **API Externa:** Google Gemini API (integrado via `src/services/geminiService.js`)
*   **Bibliotecas de UI/Componentes:**
    *   @fortawesome/react-fontawesome (�cones)
    *   recharts, chart.js (Gr�ficos - `recharts` utilizado no `ActivityChart.jsx`)
*   **Bibliotecas de Utilit�rios:** date-fns (Manipula��o de datas)

## 3. Estrutura do Projeto

A estrutura de diret�rios e arquivos do projeto � organizada da seguinte forma:

```
.
??? .firebaserc
??? .gitignore
??? database.rules.json
??? eslint.config.js
??? firebase.json
??? index.html
??? package-lock.json
??? package.json
??? README.md
??? vite.config.js
??? public/
?   ??? vite.svg
??? src/
    ??? App.css
    ??? App.jsx
    ??? index.css
    ??? main.jsx
    ??? assets/
    ?   ??? react.svg
    ??? components/
    ?   ??? ActivityChart.jsx
    ?   ??? DevicePerformanceCard.jsx
    ?   ??? GeminiChatPopup.jsx
    ?   ??? GeminiInsights.jsx
    ?   ??? Header.jsx
    ?   ??? Layout.jsx
    ?   ??? Modal.jsx
    ?   ??? Pagination.jsx
    ?   ??? Sidebar.jsx
    ?   ??? ThemeToggleButton.jsx
    ??? config/
    ?   ??? geminiConfig.js
    ??? context/
    ?   ??? ThemeContext.jsx
    ??? firebase/
    ?   ??? firebaseConfig.js
    ??? pages/
    ?   ??? Dashboard.jsx
    ?   ??? Devices.jsx
    ?   ??? Doors.jsx
    ?   ??? Login.jsx
    ?   ??? Logs.jsx
    ?   ??? NotFound.jsx
    ?   ??? Settings.jsx
    ?   ??? Users.jsx
    ??? services/
    ?   ??? geminiService.js
    ??? styles/
    ?   ??? components.css
    ?   ??? dark-mode.css
    ?   ??? dashboard.css
    ?   ??? devices.css
    ?   ??? gemini-chat-popup.css
    ?   ??? gemini-insights.css
    ?   ??? Login.css
    ?   ??? logs.css
    ?   ??? mobile.css
    ?   ??? styles.css
    ?   ??? utils.css
    ??? utils/
        ??? formatters.js
        ??? helpers.js
        ??? notifications.js
```

*   **`/public`:** Cont�m arquivos est�ticos que s�o copiados diretamente para o diret�rio de build (`dist`).
*   **`/src`:** Cont�m o c�digo fonte da aplica��o.
    *   **`/assets`:** Ativos como imagens.
    *   **`/components`:** Componentes React reutiliz�veis.
    *   **`/config`:** Arquivos de configura��o espec�ficos da aplica��o.
    *   **`/context`:** Contextos React para gerenciamento de estado global (ex: tema).
    *   **`/firebase`:** Configura��o e inicializa��o do Firebase.
    *   **`/pages`:** Componentes React que representam as diferentes p�ginas da aplica��o.
    *   **`/services`:** L�gica para intera��o com APIs externas ou servi�os (ex: Gemini).
    *   **`/styles`:** Arquivos CSS para estiliza��o.
    *   **`/utils`:** Fun��es utilit�rias gerais.

## 4. Estrutura do Banco de Dados (Firebase Realtime Database)

A estrutura do banco de dados, inferida a partir de `database.rules.json` e do uso no c�digo, � baseada em n�s/cole��es para armazenar os dados do sistema:

*   **`users`:** Armazena informa��es dos usu�rios.
    *   Campos chave: `name`, `email`, `department`, `role`, `status`, `created_at`, `auth_uid`.
    *   �ndices: `email`, `status`, `role`, `department`.
*   **`doors`:** Armazena informa��es das portas controladas.
    *   Campos chave: `name`, `location`, `status`, `last_status_change`.
    *   �ndices: `name`, `status`.
*   **`devices`:** Armazena informa��es dos dispositivos (leitores RFID, controladores, gateways).
    *   Campos chave: `name`, `typeCode`, `location`, `ip`, `mac`, `firmware`, `status`, `lastActivity`, `needsUpdate`, `cpu_usage`, `ram_usage`, `temperature`, `latency`, `pending_action`, `action_requested_at`, `config`.
    *   �ndices: `name`, `status`, `typeCode`, `firmware`.
*   **`access_logs`:** Armazena registros de eventos de acesso e a��es em portas.
    *   Campos chave: `user_id`, `user_name`, `door_id`, `door_name`, `action`, `method`, `timestamp`, `reason`.
    *   �ndices: `timestamp`, `user_name`, `door_name`, `action`, `method`.

**Observa��o de Seguran�a:** As regras de seguran�a atuais em `database.rules.json` (`".read": true, ".write": true`) permitem acesso p�blico total ao banco de dados. **Isso � altamente inseguro para um ambiente de produ��o** e deve ser revisado e restrito para permitir acesso apenas a usu�rios autenticados com as permiss�es apropriadas.

## 5. An�lise Detalhada das P�ginas

### Dashboard (`/`)

*   **Funcionalidades:** Apresenta uma vis�o geral do sistema com cards de status (usu�rios, portas, dispositivos, acessos hoje), um gr�fico de atividade di�ria, uma lista de atividade recente, o status atual das portas com controle de trancar/destrancar, um card de performance de dispositivos e um painel de insights gerados pelo Gemini.
*   **Intera��o com Banco de Dados:**
    *   Utiliza listeners em tempo real (`onValue`) nos n�s `users`, `doors` e `devices` para manter os cards de status e a lista de status das portas atualizados.
    *   Busca os �ltimos logs de acesso (`access_logs`) usando `get` para a se��o de atividade recente.
    *   Permite atualizar o status de uma porta (`update` no n� `doors`) e registra a a��o como um log de acesso (`push` no n� `access_logs`).
*   **Componentes utilizados:** `Layout`, `ActivityChart`, `DevicePerformanceCard`, `GeminiInsights`, `@fortawesome/react-fontawesome`, fun��es de `formatters.js` e `notifications.js`.

### Devices (`/devices`)

*   **Funcionalidades:** Permite visualizar, buscar, filtrar e paginar uma lista de dispositivos. Inclui modais para adicionar novos dispositivos, editar informa��es de dispositivos existentes e configurar dispositivos. Permite solicitar a��es remotas como reiniciar, restaurar padr�es de f�brica e diagn�stico (registrando a inten��o no DB). Oferece funcionalidade de exporta��o da lista (CSV implementado, PDF placeholder).
*   **Intera��o com Banco de Dados:**
    *   Busca a lista de dispositivos do n� `devices` usando um listener `onValue`.
    *   Adiciona novos dispositivos (`push` no n� `devices`).
    *   Edita dispositivos existentes (`update` no n� `devices`).
    *   Remove dispositivos (`remove` no n� `devices`).
    *   Atualiza o campo `pending_action` no n� do dispositivo para solicitar a��es remotas.
*   **Componentes utilizados:** `Layout`, `Modal`, `Pagination`, `@fortawesome/react-fontawesome`, fun��es de `notifications.js`, `formatters.js` e `helpers.js`.

### Doors (`/doors`)

*   **Funcionalidades:** Permite visualizar, buscar, paginar e gerenciar portas. Inclui modais para adicionar novas portas, editar informa��es de portas existentes e controlar o status (trancar/destrancar) de uma porta. Permite excluir portas (com modal de confirma��o). Oferece funcionalidade de exporta��o da lista (CSV implementado, PDF placeholder).
*   **Intera��o com Banco de Dados:**
    *   Busca a lista de portas do n� `doors` usando um listener `onValue`.
    *   Adiciona novas portas (`push` no n� `doors`).
    *   Edita portas existentes (`update` no n� `doors`).
    *   Remove portas (`remove` no n� `doors`).
    *   Atualiza o campo `status` e `last_status_change` no n� da porta (`update`) e registra a a��o no n� `access_logs` (`push`).
*   **Componentes utilizados:** `Layout`, `Modal`, `Pagination`, `@fortawesome/react-fontawesome`, fun��es de `notifications.js`, `formatters.js` e `helpers.js`.

### Login (`/login`)

*   **Funcionalidades:** P�gina de autentica��o para usu�rios. Permite login com e-mail e senha e oferece a op��o de recupera��o de senha. Redireciona o usu�rio para o Dashboard se a autentica��o for bem-sucedida ou se ele j� estiver logado.
*   **Intera��o com Firebase Authentication:**
    *   `signInWithEmailAndPassword`: Para autenticar usu�rios.
    *   `sendPasswordResetEmail`: Para enviar e-mails de recupera��o de senha.
    *   `onAuthStateChanged`: Listener para verificar o estado de autentica��o do usu�rio e gerenciar o redirecionamento.
*   **Intera��o com Banco de Dados:** Nenhuma intera��o direta com o Realtime Database nesta p�gina.
*   **Componentes utilizados:** `useNavigate` (react-router-dom).

### Logs (`/logs`)

*   **Funcionalidades:** Exibe um hist�rico detalhado dos registros de acesso e a��es no sistema. Permite filtrar os logs por per�odo (pr�-definido ou personalizado), tipo de a��o, m�todo, usu�rio e porta. Inclui pagina��o para navegar pelos resultados. Oferece funcionalidade de exporta��o da lista filtrada (CSV implementado, PDF placeholder).
*   **Intera��o com Banco de Dados:**
    *   Busca registros do n� `access_logs` usando `get`. Atualmente, busca os �ltimos 1000 logs, o que pode ser um ponto de aten��o para escalabilidade.
    *   A filtragem por per�odo, a��o, m�todo, usu�rio e porta � realizada no lado do cliente ap�s a busca inicial.
*   **Componentes utilizados:** `Layout`, `Pagination`, `@fortawesome/react-fontawesome`, fun��es de `notifications.js` e `formatters.js`.

### NotFound (`/404`)

*   **Funcionalidades:** P�gina exibida quando uma rota n�o � encontrada. Mostra uma mensagem informativa e um link para retornar ao Dashboard.
*   **Intera��o com Banco de Dados:** Nenhuma.
*   **Componentes utilizados:** `Link` (react-router-dom).

### Settings (`/settings`)

*   **Funcionalidades:** P�gina destinada � configura��o do sistema, organizada em abas (Sistema, Seguran�a, Dispositivos, Integra��o, Notifica��es, Apar�ncia). Cont�m formul�rios para diversas configura��es, embora a maioria das se��es esteja marcada como `TODO` no c�digo analisado.
*   **Intera��o com Banco de Dados:** A intera��o para ler e salvar configura��es est� planejada (`TODO` no c�digo), mas n�o implementada na an�lise atual.
*   **Componentes utilizados:** `Layout`, `@fortawesome/react-fontawesome`.

### Users (`/users`)

*   **Funcionalidades:** Permite visualizar, buscar, filtrar e paginar uma lista de usu�rios. Inclui um modal para adicionar novos usu�rios e editar informa��es de usu�rios existentes. Permite excluir usu�rios (com modal de confirma��o). Oferece funcionalidade de exporta��o da lista (CSV implementado, PDF placeholder).
*   **Intera��o com Firebase Authentication:**
    *   `createUserWithEmailAndPassword`: Utilizado para criar novas contas de usu�rio no Firebase Auth ao adicionar um usu�rio.
    *   `updateProfile`: Utilizado para definir o `displayName` do usu�rio rec�m-criado no Firebase Auth.
*   **Intera��o com Banco de Dados:**
    *   Busca a lista de usu�rios do n� `users` usando um listener `onValue`.
    *   Adiciona novos usu�rios (`push` e `update` no n� `users`, linkando com o `auth_uid`).
    *   Edita usu�rios existentes (`update` no n� `users`).
    *   Remove usu�rios (`remove` no n� `users` - **Nota: A exclus�o no Firebase Auth n�o � feita aqui**).
    *   Verifica a exist�ncia de e-mail duplicado no n� `users` antes de adicionar/editar (`query`, `orderByChild`, `equalTo`, `get`).
*   **Componentes utilizados:** `Layout`, `Modal`, `Pagination`, `@fortawesome/react-fontawesome`, fun��es de `notifications.js`, `formatters.js` e `helpers.js`.

## 6. An�lise de Componentes Reutiliz�veis

*   **`Layout.jsx`:** Componente de layout principal que define a estrutura da p�gina, incluindo a barra lateral (`Sidebar`), o cabe�alho (`Header`) e a �rea de conte�do onde as p�ginas s�o renderizadas. Gerencia o estado de colapsamento da sidebar e do menu mobile.
*   **`Modal.jsx`:** Componente gen�rico para exibir conte�do em um pop-up modal. Controla a visibilidade, exibe t�tulo e rodap� opcionais, suporta diferentes tamanhos e permite fechamento por clique externo, bot�o ou tecla Escape.
*   **`Pagination.jsx`:** Componente para exibir controles de pagina��o para listas de dados. Exibe informa��es sobre os itens vis�veis, bot�es de navega��o (anterior/pr�ximo) e n�meros de p�gina.
*   **`Sidebar.jsx`:** Componente que renderiza a barra de navega��o lateral. Cont�m links para as diferentes rotas da aplica��o e implementa a funcionalidade de logout utilizando o Firebase Authentication.
*   **`Header.jsx`:** Componente que renderiza o cabe�alho superior. Exibe o nome do usu�rio logado (buscado no DB), um contador de alertas (baseado em dispositivos offline do DB), um bot�o para alternar o tema e um toggle para o menu mobile.
*   **`ActivityChart.jsx`:** Componente utilizado no Dashboard para exibir um gr�fico de barras da atividade de acesso por porta ao longo do tempo, utilizando a biblioteca `recharts`. Busca logs do DB, processa e filtra os dados localmente e permite sele��o de portas e intervalo de datas.
*   **`DevicePerformanceCard.jsx`:** Componente utilizado no Dashboard para exibir um resumo do status dos dispositivos e as m�tricas de performance do dispositivo mais sobrecarregado (CPU, RAM, Temperatura, Lat�ncia), buscando dados do n� `devices` no DB.
*   **`GeminiChatPopup.jsx`:** Componente que implementa um pop-up de chat flutuante para interagir com o assistente Gemini, utilizando fun��es do `geminiService.js`. Gerencia o estado do chat, hist�rico local e formata��o b�sica de respostas.
*   **`GeminiInsights.jsx`:** Componente utilizado no Dashboard para exibir insights gerados pelo modelo Gemini, utilizando fun��es do `geminiService.js`. Exibe um resumo e uma lista de insights, com op��es de atualiza��o manual e autom�tica.
*   **`ThemeToggleButton.jsx`:** Componente de bot�o simples utilizado no `Header` para alternar entre o tema claro e escuro da aplica��o, utilizando o `ThemeContext`.

## 7. Diagrama da Estrutura de Componentes

```mermaid
graph TD
    A[App.jsx] --> B(Layout)
    B --> C(Sidebar)
    B --> D(Header)
    B --> E(GeminiChatPopup)
    B --> F{P�ginas}

    F --> G[Dashboard]
    F --> H[Devices]
    F --> I[Doors]
    F --> J[Login]
    F --> K[Logs]
    F --> L[NotFound]
    F --> M[Settings]
    F --> N[Users]

    G --> O(ActivityChart)
    G --> P(DevicePerformanceCard)
    G --> Q(GeminiInsights)

    H --> R(Modal)
    H --> S(Pagination)

    I --> R
    I --> S

    K --> S

    N --> R
    N --> S

    D --> T(ThemeToggleButton)

    Q --> U(geminiService)
    E --> U

    U --> V(Firebase Realtime Database)
    U --> W(Gemini API)
    D --> V
    G --> V
    H --> V
    I --> V
    K --> V
    N --> V
    I --> X(Firebase Authentication)
    J --> X
    N --> X
    C --> X

    style F fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#ccf,stroke:#333,stroke-width:1px
    style H fill:#ccf,stroke:#333,stroke-width:1px
    style I fill:#ccf,stroke:#333,stroke-width:1px
    style J fill:#ccf,stroke:#333,stroke-width:1px
    style K fill:#ccf,stroke:#333,stroke-width:1px
    style L fill:#ccf,stroke:#333,stroke-width:1px
    style M fill:#ccf,stroke:#333,stroke-width:1px
    style N fill:#ccf,stroke:#333,stroke-width:1px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#ddf,stroke:#333,stroke-width:1px
    style D fill:#ddf,stroke:#333,stroke-width:1px
    style E fill:#ddf,stroke:#333,stroke-width:1px
    style O fill:#eef,stroke:#333,stroke-width:1px
    style P fill:#eef,stroke:#333,stroke-width:1px
    style Q fill:#eef,stroke:#333,stroke-width:1px
    style R fill:#eef,stroke:#333,stroke-width:1px
    style S fill:#eef,stroke:#333,stroke-width:1px
    style T fill:#eef,stroke:#333,stroke-width:1px
    style U fill:#bfb,stroke:#333,stroke-width:2px
    style V fill:#bfb,stroke:#333,stroke-width:1px
    style W fill:#bfb,stroke:#333,stroke-width:1px
    style X fill:#bfb,stroke:#333,stroke-width:1px
```

## 8. An�lise de Servi�os e Utilit�rios

*   **`src/services/geminiService.js`:** Este servi�o � respons�vel pela integra��o com a API do Google Gemini. Ele busca dados limitados do Firebase Realtime Database para fornecer contexto ao modelo, constr�i o prompt do sistema dinamicamente e gerencia a comunica��o com a API Gemini para funcionalidades de chat e gera��o de insights. Implementa um cache simples para os dados do sistema e gerencia o hist�rico da conversa de chat localmente.
*   **`src/firebase/firebaseConfig.js`:** Inicializa a aplica��o Firebase utilizando as configura��es carregadas de vari�veis de ambiente (`import.meta.env`). Exporta as inst�ncias configuradas de Firebase Authentication (`auth`) e Firebase Realtime Database (`database`) para serem utilizadas em outras partes da aplica��o.
*   **`src/utils/formatters.js`:** Cont�m fun��es utilit�rias para formatar dados para exibi��o na interface do usu�rio, como formata��o de datas e horas, mapeamento de status para classes CSS e tradu��o de strings de status e pap�is para texto leg�vel em portugu�s.
*   **`src/utils/notifications.js`:** Implementa a l�gica para exibir notifica��es pop-up no canto superior direito da tela. Cria e gerencia elementos DOM para as notifica��es, suporta diferentes tipos (info, success, error, warning) com �cones e cores correspondentes, e lida com o fechamento autom�tico ou manual.
*   **`src/utils/helpers.js`:** Cont�m fun��es utilit�rias gerais, como a fun��o `debounce`, utilizada para limitar a frequ�ncia de execu��o de fun��es em resposta a eventos r�pidos (ex: digita��o).

## 9. Configura��es

*   **`.firebaserc`:** Arquivo de configura��o do Firebase CLI que especifica o projeto padr�o do Firebase (`rfid-com-esp32`) associado a este diret�rio local.
*   **`firebase.json`:** Configura��es para o deploy e hospedagem do projeto no Firebase. Define o diret�rio p�blico (`dist`), arquivos a serem ignorados e regras de rewrite para suportar o roteamento de Single Page Application (SPA). Tamb�m aponta para o arquivo de regras de seguran�a do Realtime Database (`database.rules.json`).
*   **`vite.config.js`:** Arquivo de configura��o para a ferramenta de build Vite. Configura o plugin `@vitejs/plugin-react` para suportar o desenvolvimento com React.
*   **`eslint.config.js`:** Arquivo de configura��o para o ESLint, utilizado para an�lise est�tica de c�digo. Define regras, plugins (incluindo para React Hooks e Fast Refresh) e arquivos a serem ignorados para manter a qualidade e consist�ncia do c�digo.
*   **`src/config/geminiConfig.js`:** (Inferido pelo uso) Este arquivo provavelmente cont�m as configura��es espec�ficas para a integra��o com a API do Gemini, como a chave de API, o endpoint, limites de dados para contexto, configura��es de temperatura e seguran�a para a gera��o de texto, e configura��es espec�ficas para as funcionalidades de chat e insights (ex: habilitar/desabilitar, intervalo de atualiza��o).

## 10. Considera��es e Pontos de Melhoria

Durante a an�lise do projeto, alguns pontos foram identificados que podem ser considerados para melhorias futuras:

*   **Seguran�a do Banco de Dados:** As regras de seguran�a atuais do Firebase Realtime Database (`.read: true, .write: true`) s�o inadequadas para produ��o. � crucial implementar regras mais restritivas baseadas na autentica��o e autoriza��o dos usu�rios.
*   **Escalabilidade da Busca de Dados:** A estrat�gia de buscar todos os logs de acesso ou dados limitados para o contexto Gemini usando `get` pode se tornar ineficiente com o crescimento do volume de dados. Considerar pagina��o baseada em cursor ou consultas mais otimizadas no lado do servidor pode ser necess�rio.
*   **Gerenciamento Completo de Usu�rios:** A exclus�o de usu�rios atualmente remove o registro apenas do Realtime Database, n�o do Firebase Authentication. Para um gerenciamento completo, a exclus�o tamb�m deve ocorrer no Firebase Auth (geralmente requer l�gica de backend ou Admin SDK). A atualiza��o de e-mail no Firebase Auth tamb�m � uma opera��o que requer cuidado e pode precisar ser implementada.
*   **Refatora��o de Utilit�rios:** Fun��es utilit�rias duplicadas (`escapeHtml`, `formatResponse`) poderiam ser movidas para um arquivo compartilhado em `src/utils/` para evitar repeti��o de c�digo.
*   **Implementa��o de Placeholders:** Funcionalidades marcadas como `TODO` no c�digo (ex: exporta��o PDF, se��es de configura��o em Settings) precisam ser implementadas para completar as funcionalidades planejadas.
*   **Gerenciamento de Estado do Gemini Assistant:** A forma como o toggle do Gemini Assistant � exposto globalmente (`window.geminiAssistant`) funciona, mas usar React Context ou uma biblioteca de gerenciamento de estado (como Zustand ou Redux) pode ser uma abordagem mais robusta e "React-idiom�tica" para comunica��o entre componentes n�o diretamente relacionados.