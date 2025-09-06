# 📱 Angular 20 PWA com HashLocationStrategy

Este projeto é um **PWA em Angular 20** configurado para usar **HashLocationStrategy**, evitando problemas de refresh em ambientes de hospedagem estática (como GitHub Pages e S3).

---

## ⚙️ Estrutura Principal

### `main.ts`
- Ponto de entrada da aplicação.
- Usa `bootstrapApplication` para iniciar o `AppComponent` e registrar os **providers globais**.
- Aqui configuramos também o `HashLocationStrategy`.

### `app.ts`
- Componente raiz da aplicação.
- Define o seletor `app-root` que é injetado no `index.html`.
- Importa o `RouterOutlet` para renderizar as páginas.
- Template e estilos ficam em `app.html` e `app.css`.

### `app.html`
- Template base do componente raiz.
- Contém o **layout principal** (ex.: menu de navegação e `<router-outlet>`).
- O `<router-outlet>` é onde as páginas definidas nas rotas são carregadas.

### `app.routes.ts`
- Define as **rotas da aplicação**.
- Exemplo:
  ```ts
  export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  ];
  ```

### `Home` e `Login` (standalone components)
- Páginas criadas com `ng generate component --standalone`.
- Contêm seus próprios templates (`home.html`, `login.html`) e estilos (`home.css`, `login.css`).
- São renderizadas dentro do `<router-outlet>`.

### `HashLocationStrategy`
- Configuração usada no `main.ts`:
  ```ts
  { provide: LocationStrategy, useClass: HashLocationStrategy }
  ```
- Faz com que as rotas usem `#/rota` em vez de `/rota`.
- Evita erro 404 ao dar refresh em hospedagem estática.

### PWA configs
- Criados pelo `ng add @angular/pwa`.
- **`manifest.webmanifest`** → define nome, ícone e cores do app instalado.
- **`ngsw-config.json`** → configurações do service worker para cache e modo offline.

---

## 🖥️ Comandos Base

### Criar novo projeto
```bash
ng new pwa-sheets-helloworld --routing --style=css --standalone
```

### Rodar localmente
```bash
ng serve -o
```

### Adicionar suporte PWA
```bash
ng add @angular/pwa
```

### Criar um novo componente (standalone)
```bash
ng generate component pages/home --standalone
ng generate component pages/login --standalone
```

### Build de produção
```bash
ng build
```

### Rodar com preview PWA (simular service worker)
```bash
npm install -g http-server
http-server -p 8080 -c-1 dist/pwa-sheets-helloworld/browser
```

### Atualizar Angular e CLI para última versão
```bash
ng update @angular/core @angular/cli
```

---

## 🚀 Como rodar

Instale as dependências:
```bash
npm install
```

Suba o servidor local:
```bash
ng serve -o
```

Acesse em:
- `http://localhost:4200/#/home`
- `http://localhost:4200/#/login`

---

## 🔎 Resumindo

- **main.ts** → motor de arranque (quem inicia o app e registra providers).
- **app.ts** → componente raiz (a casca do app).
- **app.html** → layout principal do app (menu + outlet).
- **app.routes.ts** → mapa de navegação (rotas).
- **Home/Login** → telas reais (carregadas no outlet).
- **HashLocationStrategy** → garante que refresh funcione em hospedagem estática.
- **PWA configs** → permitem instalar o app e usar offline.

# 🚀 Deploy do Angular PWA no GitHub Pages

Este guia explica como publicar o projeto **Vafyndell** no GitHub Pages usando o pacote `angular-cli-ghpages`.

---

## 📦 Build de Produção

Execute o build com o `--base-href` apontando para o repositório:

```bash
ng build --base-href "https://marquesCleiton.github.io/Vafyndell/"
```

A saída será gerada em:

```
dist/vafyndell/browser
```

---

## 🌍 Deploy para GitHub Pages

Use o `angular-cli-ghpages` para enviar os arquivos para a branch `gh-pages`:

```bash
npx angular-cli-ghpages --dir=dist/vafyndell/browser
```

Isso criará ou atualizará a branch `gh-pages` no repositório.

---

## ⚙️ Configuração no GitHub

1. Acesse o repositório: [Vafyndell](https://github.com/marquesCleiton/Vafyndell)
2. Vá em **Settings > Pages**
3. Em **Source**, selecione:
   - **Branch**: `gh-pages`
   - **Folder**: `/ (root)`

---

## 🔎 URL Final

Após alguns minutos, a aplicação estará disponível em:

```
https://marquesCleiton.github.io/Vafyndell/
```

---

## 🔄 Atualizando o Deploy

Sempre que fizer alterações no código:

```bash
ng build --base-href "https://marquesCleiton.github.io/Vafyndell/"
npx angular-cli-ghpages --dir=dist/vafyndell/browser
```
