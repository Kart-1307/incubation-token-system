# Backend and Supabase Implementation Plan
**Sri Sairam Engineering College – Incubation Token System**  
*Technology Stack: Next.js 15 (App Router) + Supabase (PostgreSQL) + Prisma ORM + Server Actions*  
*Authentication: Single Staff Login Only*

---

## 1. Architecture Overview

This project leverages a **unified full-stack architecture** inside Next.js 15. The backend business logic runs securely on the server using **Next.js Server Actions** (`'use server'`) and **API Route Handlers** (`src/app/api/...`), communicating with **Supabase PostgreSQL** via **Prisma ORM**.

There is **only one role**: **Staff**. Any authenticated staff member has access to the full operational workflow: managing the daily food list, scanning student IDs to issue tokens, inspecting the student registry, downloading reports, and generating official food request letters.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS 15 CLIENT LAYER                               │
│  - Dashboard Page        - Scan & Issue Token Page   - Daily Food List      │
│  - Students Registry     - Incubation Projects       - Reports & Letters    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    Direct Server Action Invocation / API Calls
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    NEXT.JS 15 SERVER-SIDE ENGINE                            │
│  ┌──────────────────────────────┐       ┌────────────────────────────────┐  │
│  │    Server Actions ('use server')     │ Route Handlers (src/app/api/..)│  │
│  │  - loginStaff()              │       │  - /api/tokens/scan            │  │
│  │  - issueFoodToken()          │       │  - /api/reports/export         │  │
│  │  - saveDailyFoodList()       │       │  - /api/auth/session           │  │
│  │  - finalizeFoodList()        │       │                                │  │
│  └──────────────┬───────────────┘       └────────────────┬───────────────┘  │
│                 │                                        │                  │
│                 └──────────────────┬─────────────────────┘                  │
│                                    │                                        │
│                 ┌──────────────────▼──────────────────┐                     │
│                 │  Prisma ORM Client (src/lib/db.ts)  │                     │
│                 │  - Query Builder & Type Validation  │                     │
│                 │  - ACID Transactions ($transaction) │                     │
│                 └──────────────────┬──────────────────┘                     │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                 Encrypted TLS Connection (Port 6543 / 5432)
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                        SUPABASE POSTGRESQL CLOUD                            │
│  - Staff Users (Staff Login)    - Student Registry                          │
│  - Daily Food Eligibility Lists - Food Tokens (Unique [date, studentId])    │
│  - Connection Pooler (PgBouncer)- Automated Backups & Web Table Editor      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Supabase Setup Guide

### Step 2.1: Project Initialization
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **"New Project"**.
3. Fill in:
   - **Name**: `sairam-incubation-tokens`
   - **Database Password**: *Generate and securely store a 16+ character password.*
   - **Region**: `ap-south-1` (Mumbai, India) or `ap-southeast-1` (Singapore) for lowest latency.
   - **Pricing Plan**: Free Tier.

### Step 2.2: Retrieve Connection Strings
In Supabase:
1. Navigate to **Project Settings** (gear icon) → **Database**.
2. Scroll to the **Connection string** section.
3. Select the **URI** tab:
   - **Transaction Connection String (Session / Transaction Pooler)**:
     Port `6543` — used by the application during normal operations (`DATABASE_URL`).
   - **Direct Connection String**:
     Port `5432` — used exclusively by Prisma during migrations (`DIRECT_URL`).

### Step 2.3: Environment Configuration (`.env`)
Create `.env` in the project root:
```env
# Supabase Transaction Pooler URL (for runtime queries)
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Direct Connection URL (for schema migrations)
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Next.js Application Environment
SESSION_SECRET="super-secret-key-32-chars-long"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 3. Database Schema (Prisma ORM)

File path: `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ---------------------------------------------------------------------------
// 1. Staff Authentication (Single Staff Login Only)
// ---------------------------------------------------------------------------
model StaffUser {
  id           String    @id @default(uuid())
  username     String    @unique
  email        String    @unique
  passwordHash String
  name         String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  createdFoodLists DailyFoodList[] @relation("CreatedFoodLists")
  issuedTokens     FoodToken[]     @relation("IssuedTokens")

  @@map("staff_users")
}

// ---------------------------------------------------------------------------
// 2. Student Registry
// ---------------------------------------------------------------------------
model Student {
  id          String   @id // College Roll/Registration ID, e.g., "23CS101"
  name        String
  department  String   // "CSE", "ECE", "ME", etc.
  year        Int      // 1, 2, 3, 4
  email       String   @unique
  phone       String?
  status      String   @default("Active") // "Active" | "Inactive"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectMemberships ProjectMember[]
  foodEligibilities  DailyFoodEligibility[]
  foodTokens         FoodToken[]

  @@index([department])
  @@index([status])
  @@map("students")
}

// ---------------------------------------------------------------------------
// 3. Incubation Projects
// ---------------------------------------------------------------------------
model Project {
  code        String   @id // Short identifier, e.g., "AGRI-01"
  name        String   // Project Name, e.g., "AgriCheck"
  description String?
  status      String   @default("Active") // "Active" | "Completed"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members           ProjectMember[]
  foodEligibilities DailyFoodEligibility[]
  foodTokens        FoodToken[]

  @@map("projects")
}

model ProjectMember {
  id          String   @id @default(uuid())
  studentId   String
  projectCode String
  role        String   @default("Member") // "Lead Developer", "Developer", "Member"

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectCode], references: [code], onDelete: Cascade)

  @@unique([studentId, projectCode])
  @@map("project_members")
}

// ---------------------------------------------------------------------------
// 4. Daily Food List & Eligibility Management
// ---------------------------------------------------------------------------
model DailyFoodList {
  date        String    @id // Format "YYYY-MM-DD" e.g., "2026-09-25"
  status      String    @default("Draft") // "Draft" | "Finalized"
  finalizedBy String?
  finalizedAt DateTime?
  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  creator     StaffUser              @relation("CreatedFoodLists", fields: [createdById], references: [id])
  entries     DailyFoodEligibility[]

  @@map("daily_food_lists")
}

model DailyFoodEligibility {
  id          String   @id @default(uuid())
  date        String
  studentId   String
  projectCode String
  addedBy     String   @default("Staff")
  status      String   @default("Eligible")
  createdAt   DateTime @default(now())

  foodList DailyFoodList @relation(fields: [date], references: [date], onDelete: Cascade)
  student  Student       @relation(fields: [studentId], references: [id], onDelete: Cascade)
  project  Project       @relation(fields: [projectCode], references: [code])

  // Critical rule: A student can only be listed once for a specific date
  @@unique([date, studentId])
  @@index([date])
  @@map("daily_food_eligibilities")
}

// ---------------------------------------------------------------------------
// 5. Food Tokens (Generated at Mess Terminal)
// ---------------------------------------------------------------------------
model FoodToken {
  id          String   @id @default(uuid())
  tokenNumber String   @unique // e.g., "INC-260925-001"
  date        String   // "YYYY-MM-DD"
  studentId   String
  projectCode String
  status      String   @default("Generated") // Simple status
  issuedAt    DateTime @default(now())
  issuedById  String

  student  Student   @relation(fields: [studentId], references: [id])
  project  Project   @relation(fields: [projectCode], references: [code])
  issuedBy StaffUser @relation("IssuedTokens", fields: [issuedById], references: [id])

  // Strict constraint: Only 1 token per student per day
  @@unique([date, studentId])
  @@index([date])
  @@map("food_tokens")
}
```

---

## 4. Next.js Server-Side Functions Design

### 4.1 Server Actions vs Route Handlers

| Feature | Pattern | File Location | Why |
| :--- | :--- | :--- | :--- |
| **Staff Login / Logout** | Server Action | `src/actions/authActions.ts` | Authenticates staff, sets secure HttpOnly cookie |
| **Token Generation** | Server Action | `src/actions/tokenActions.ts` | Immediate UI execution with ACID concurrency check |
| **Daily Food List Save/Finalize** | Server Action | `src/actions/foodListActions.ts` | Form submission, automatic Next.js cache revalidation |
| **Student / Project CRUD** | Server Action | `src/actions/studentActions.ts` | Mutation with direct validation |
| **Barcode / Scanner API** | Route Handler | `src/app/api/tokens/scan/route.ts` | External handheld scanners or automated hardware |
| **PDF Letter Data Query** | Route Handler | `src/app/api/letters/food-request/route.ts` | Dynamic export and verification |

---

### 4.2 Server Action Example: `issueFoodToken`

```typescript
// src/actions/tokenActions.ts
'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface IssueTokenResult {
  success: boolean;
  message: string;
  token?: {
    tokenNumber: string;
    studentId: string;
    studentName: string;
    project: string;
    date: string;
    time: string;
  };
}

export async function issueFoodToken(studentIdInput: string, staffUserId: string): Promise<IssueTokenResult> {
  const studentId = studentIdInput.trim().toUpperCase();
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify Student exists
      const student = await tx.student.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        return { success: false, message: `Student ID "${studentId}" not found in registry.` };
      }

      // 2. Verify Eligibility in Today's Food List
      const eligibility = await tx.dailyFoodEligibility.findUnique({
        where: {
          date_studentId: {
            date: todayStr,
            studentId: student.id,
          },
        },
        include: { project: true },
      });

      if (!eligibility) {
        return {
          success: false,
          message: `Student "${student.name}" (${student.id}) is NOT approved for today's food list (${todayStr}).`,
        };
      }

      // 3. Check for Duplicate Token Today
      const existingToken = await tx.foodToken.findUnique({
        where: {
          date_studentId: {
            date: todayStr,
            studentId: student.id,
          },
        },
      });

      if (existingToken) {
        return {
          success: false,
          message: `Token already issued today for ${student.name} (${existingToken.tokenNumber}) at ${existingToken.issuedAt.toLocaleTimeString('en-IN')}.`,
        };
      }

      // 4. Generate Consecutive Daily Token Sequence
      const countToday = await tx.foodToken.count({
        where: { date: todayStr },
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const dateTag = todayStr.replace(/-/g, '').slice(2); // e.g. 260925
      const tokenNumber = `INC-${dateTag}-${seq}`;

      // 5. Create Token Record
      const token = await tx.foodToken.create({
        data: {
          tokenNumber,
          date: todayStr,
          studentId: student.id,
          projectCode: eligibility.projectCode,
          status: 'Generated',
          issuedById: staffUserId,
        },
      });

      // 6. Refresh cached Dashboard and Food Token views
      revalidatePath('/dashboard');
      revalidatePath('/food-tokens');
      revalidatePath('/scan-token');

      return {
        success: true,
        message: `Token ${token.tokenNumber} generated successfully for ${student.name}.`,
        token: {
          tokenNumber: token.tokenNumber,
          studentId: student.id,
          studentName: student.name,
          project: eligibility.project.name,
          date: todayStr,
          time: token.issuedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
      };
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return { success: false, message: 'Server error occurred while issuing token.' };
  }
}
```

---

## 5. Migration and Data Seeding Strategy

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial institutional data...');

  // 1. Create Default Staff User
  const passwordHash = await bcrypt.hash('Sairam@123', 10);
  await prisma.staffUser.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      email: 'incubation@sairam.edu.in',
      name: 'Incubation Centre Staff',
      passwordHash,
    },
  });

  // 2. Seed Projects
  const projects = [
    { code: 'AGRI-01', name: 'AgriCheck', description: 'AI-powered crop disease detection system.' },
    { code: 'SMRT-02', name: 'Smart Campus', description: 'IoT-based campus resource management.' },
    { code: 'HLTH-03', name: 'HealthTrack', description: 'Student health monitoring system.' },
    { code: 'ECO-04', name: 'EcoMonitor', description: 'Environmental sensor network.' },
  ];

  for (const p of projects) {
    await prisma.project.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // 3. Seed Students
  const students = [
    { id: '23CS101', name: 'Siddharth V', department: 'CSE', year: 3, email: 'siddharth@college.edu' },
    { id: '23CS102', name: 'Fayas K', department: 'CSE', year: 3, email: 'fayas@college.edu' },
    { id: '23CS103', name: 'Nirmal E', department: 'CSE', year: 3, email: 'nirmal@college.edu' },
    { id: '23CS104', name: 'Arun Kumar', department: 'CSE', year: 3, email: 'arun@college.edu' },
    { id: '23CS105', name: 'Priya S', department: 'CSE', year: 3, email: 'priya@college.edu' },
    { id: '23ME101', name: 'Rahul M', department: 'ME', year: 2, email: 'rahul@college.edu' },
    { id: '23EC101', name: 'Kavya R', department: 'ECE', year: 2, email: 'kavya@college.edu' },
  ];

  for (const s of students) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }

  console.log('Seeding completed successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
```

---

## 6. Implementation Phases Checklist

- [ ] **Phase 1: Database Provisioning**
  - Create project on Supabase.
  - Configure `DATABASE_URL` and `DIRECT_URL` in `.env`.
  - Install dependencies: `npm install @prisma/client bcryptjs` and `npm install -D prisma @types/bcryptjs`.
  - Run initial migration: `npx prisma migrate dev --name init`.

- [ ] **Phase 2: Data Seeding**
  - Run `npx prisma db seed`.
  - Verify tables populated via Supabase Table Editor.

- [ ] **Phase 3: Database Client Singleton**
  - Create `src/lib/db.ts` to manage Prisma client pooling across Next.js hot-reloads.

- [ ] **Phase 4: Server Actions Implementation**
  - `src/actions/authActions.ts` (Staff login/logout).
  - `src/actions/tokenActions.ts` (Scan & Issue token with duplicate prevention).
  - `src/actions/foodListActions.ts` (Add/Remove students, Finalize list).
  - `src/actions/studentActions.ts` (Registry CRUD).

- [ ] **Phase 5: UI Integration**
  - Connect Login page to staff authentication.
  - Connect `DailyFoodList` page to live database.
  - Connect `ScanToken` page to live `issueFoodToken` server action.
  - Connect `Dashboard` and `FoodTokens` pages to database queries.
  - Connect `FoodRequestLetterModal` to dynamically fetch finalized students for letter printing and PDF download.
