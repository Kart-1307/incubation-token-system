# 🎓 Campus Incubator - Student Project & Food Token Management System

A modern, full-featured web application designed to streamline student project tracking and automate daily food token distribution for college incubators, research labs, and project centers. Built with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS v4**.

---

## 🌟 Key Features

### 📊 Dashboard & Overview (`/dashboard`)
- Real-time statistics on active students, ongoing projects, today's meal eligibility count, printed tokens, and redeemed meals.
- Quick navigation shortcuts and real-time activity feed.

### 👥 Student Directory (`/students`)
- Comprehensive student directory with Student IDs (e.g., `23CS101`), department, academic year, contact information, and active status.
- Department filtering (CSE, ECE, ME) and live search by name or ID.
- Student creation/editing and project affiliation management.

### 📁 Project Catalog (`/projects`)
- Track project codes (e.g., `AGRI-01`, `SMRT-02`), descriptions, statuses (*Active*, *Inactive*, *Completed*), and creation dates.
- Assign lead developers and team members with custom roles.
- Overview of enrolled students per project.

### 📋 Daily Food Eligibility List (`/daily-food-list`)
- Manage date-specific meal eligibility (Today, Tomorrow, or custom dates).
- **Draft & Finalization Workflow**: Prepare lists in *Draft* mode; lock entries once *Finalized* by administrative staff.
- Bulk addition of eligible students by project group or individual search.
- Audit tracking of entry additions and finalization timestamps.

### 🔍 Token Scanner & Receipt Generator (`/scan-token`)
- Student ID lookup with simulated barcode/QR scanner integration.
- Instant validation against the finalized daily eligibility list.
- **Meal Token Generation & Thermal Receipt Printing**: One-click token issuance with thermal ticket preview, student details, project code, and unique token serial numbers (e.g., `INC-250925-001`).

### 🎟️ Food Token Tracker (`/food-tokens`)
- Complete lifecycle tracking for all issued food tokens (*Generated*, *Printed*, *Used*, *Cancelled*, *Expired*).
- Multi-field search and status filtering.
- Quick redemption actions to mark tokens as *Used* upon cafeteria serving.

### 📄 Food Request Letter Generator (Official PDF)
- Generate official institutional food requisition letters for catering/mess administration.
- Built-in PDF generation powered by `jspdf` & `jspdf-autotable` with institution headers, approval signatures, and participant breakdown.
- Interactive in-app modal preview with direct PDF download and print options.

### 📈 Reports & Analytics (`/reports`)
- Visual breakdown of food distribution trends by project and department.
- Print-ready summary tables for catering verification and administrative audit.

---

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/postcss` |
| **PDF Generation** | `jspdf` & `jspdf-autotable` |
| **Language** | [TypeScript 5.7](https://www.typescriptlang.org/) |

---

## 📁 Project Structure

```
├── public/                # Static public assets (logos, images)
│   └── sairam-engineering-college-logo.png
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx         # Root layout with Inter font & metadata
│   │   ├── page.tsx           # Redirects to /dashboard
│   │   ├── globals.css        # Global CSS & Tailwind v4 theme tokens
│   │   ├── login/
│   │   │   └── page.tsx       # Login interface
│   │   └── (dashboard)/       # Authenticated dashboard route group
│   │       ├── layout.tsx     # Sidebar & top header shell
│   │       ├── dashboard/     # /dashboard - Metrics & token feed
│   │       ├── students/      # /students - Student directory & master data
│   │       ├── projects/      # /projects - Project catalog & team management
│   │       ├── daily-food-list/ # /daily-food-list - Eligibility list builder
│   │       ├── scan-token/    # /scan-token - Barcode/QR scanner & thermal printer
│   │       ├── food-tokens/   # /food-tokens - Token ledger & redemption
│   │       └── reports/       # /reports - Analytics & catering reports
│   ├── components/        # Reusable UI components
│   │   ├── FoodRequestLetterModal.tsx  # Letter generation modal
│   │   ├── QRCodeSVG.tsx               # SVG QR code rendering
│   │   ├── SairamLogo.tsx              # Institutional branding
│   │   └── Badge.tsx                   # Status indicators
│   ├── data/              # Mock dataset & TypeScript interfaces
│   │   └── mockData.ts
│   └── utils/             # Document generation & utility functions
│       └── generateFoodLetterPdf.ts  # Official food letter PDF builder
├── next.config.ts         # Next.js configuration
├── postcss.config.mjs     # PostCSS configuration for Tailwind CSS v4
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript setup
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (Node 22 recommended)
- **Package Manager**: `npm` or `pnpm`

### Installation

1. Clone or download the repository.
2. Install dependencies:

```bash
npm install
# or
pnpm install
```

### Development Server

Run the development server:

```bash
npm run dev
# or
pnpm dev
```

Open your browser at `http://localhost:3000` (or `http://localhost:8443` inside Figma Make).

### Type Check & Build

Verify TypeScript types:

```bash
npm run lint
```

Create an optimized production build:

```bash
npm run build
```

Preview the build locally:

```bash
npm run preview
```

---

## 🔄 Application Workflow

1. **Student & Project Management**: Register students under `/students` and assign them to incubators/projects under `/projects`.
2. **Daily List Finalization**: Go to `/daily-food-list`, add eligible members for the date, and click **Finalize List**.
3. **Official Requisition Letter**: From the Dashboard, generate and export the official **Food Request Letter** (PDF) for catering authorization.
4. **Issuing Food Tokens**: Cafeteria desk staff uses `/scan-token` to search student IDs, verify eligibility, and print thermal token receipts with QR codes.
5. **Cafeteria Redemption**: Food service staff marks tokens as **Used** under `/food-tokens`.
6. **Auditing**: Admins inspect daily metrics and summary reports under `/reports`.

