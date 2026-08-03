# AutoPart Frontend (autoparts-fe)

A modern web-based inventory and Point of Sale (POS) management application for auto parts stores, built with **Vue 3**, **TypeScript**, **Vite**, and **PrimeVue**.

---

## 🚀 Features

- **Dashboard**: High-level overview of sales statistics, revenue charts, stock alerts, and quick actions.
- **Master Data**:
  - **Category Management**: Organize auto parts into categories and sub-categories.
- **Product Management**: Track inventory items, SKUs, pricing, stock levels, and product details.
- **Customer Management**: Maintain customer profiles, order history, and contact details.
- **Orders & Transactions**: Process customer orders, manage transaction statuses, and track sales records.
- **Reports & Analytics**: Comprehensive financial reports, top-selling products, and revenue analysis powered by Chart.js.

---

## 🛠️ Tech Stack

- **Framework**: [Vue 3](https://vuejs.org/) (Composition API with `<script setup>`)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router 4](https://router.vuejs.org/)
- **UI Library**: [PrimeVue v5](https://primevue.org/) with `@primeuix/themes`
- **Styling & Icons**: PrimeFlex & [PrimeIcons](https://primevue.org/icons/)
- **Data Visualization**: [Chart.js](https://www.chartjs.org/)
- **Code Quality**: ESLint, Oxlint, Prettier, Vue-TSC

---

## 📋 Prerequisites

Make sure you have the following installed on your machine:

- **Node.js**: `^22.18.0` or `>=24.12.0` (as specified in `package.json`)
- **npm**: `>=10.0.0`

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd autoparts-fe
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## 📜 Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server |
| `npm run build` | Runs type checks (`vue-tsc`) and builds the app for production |
| `npm run preview` | Previews the production build locally |
| `npm run type-check` | Executes TypeScript type checking across `.vue` and `.ts` files |
| `npm run lint` | Runs Oxlint and ESLint checks with auto-fix enabled |
| `npm run format` | Formats code with Prettier |

---

## 📁 Project Structure

```
autoparts-fe/
├── src/
│   ├── assets/        # Global assets (images, styles, themes)
│   ├── components/    # Reusable Vue components
│   ├── layouts/       # Application layouts (AppLayout header & sidebar)
│   ├── router/        # Vue Router configuration & routes
│   ├── stores/        # Pinia state management stores
│   ├── types/         # TypeScript interfaces & types
│   ├── utils/         # Helper functions & validation logic
│   ├── views/         # Page views (Dashboard, Product, Order, Master Data, etc.)
│   ├── App.vue        # Root Vue component
│   └── main.ts        # Application entry point
├── public/            # Static assets served directly
├── package.json       # Dependencies and scripts
├── vite.config.ts     # Vite configuration
└── tsconfig.json      # TypeScript configuration
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

