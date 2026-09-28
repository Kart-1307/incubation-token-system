# Figma Design Prompt — Incubation Food Management System

Design a complete, modern, professional **web-based admin dashboard and food token management system** for a college incubation facility.

The application is used by **incubation staff** to manage students, projects, daily food eligibility, student ID scanning, food-token generation, and basic reports.

The design should look like a **real college internal management system**, not a generic SaaS landing page.

---

## 1. Product Name

**Incubation Food Management System**

Subtitle:

**Student Eligibility & Food Token Management**

Use a clean academic/enterprise visual style.

---

# 2. Main Problem

Students working/staying in the college incubation facility after college hours are eligible for food provided by the college mess.

The incubation staff prepares a list of students who are eligible for food for a particular day.

On the day of food collection:

1. Student comes to the incubation center.
2. Student scans their college ID.
3. System identifies the student.
4. System checks whether the student is eligible for food that day.
5. If eligible, the system generates a unique food token.
6. The token is printed using a thermal printer.
7. Student takes the printed token to the college mess.
8. Mess staff provides food based on the token.

The system must prevent students from receiving duplicate food tokens.

---

# 3. Important Business Rule

Do NOT design a student self-request and approval workflow.

The student does NOT request food through the application.

Instead:

**Incubation staff directly manages the daily eligible student list.**

The staff generally prepares the list for the next day.

---

# 4. Core Data Principle

Students are registered only once in the system.

There must be a central **Student Master**.

For example:

| Student ID | Name        | Department | Year |
| ---------- | ----------- | ---------- | ---- |
| 23CS101    | Siddharth V | CSE        | 3    |
| 23CS102    | Fayas K     | CSE        | 3    |
| 23CS103    | Nirmal E    | CSE        | 3    |

When adding a student to a project:

* Staff searches using Student ID.
* Existing student information is fetched.
* Student information is displayed.
* Staff adds the student to the project.
* Staff should NOT re-enter the student's name, department, year, etc.

Use the same concept for the food eligibility list.

---

# 5. User Roles

Design the UI around these roles.

### Role 1 — Incubation Admin / Staff

Can:

* Manage students
* Manage projects
* Add students to projects
* Manage daily food eligibility
* View generated tokens
* View reports
* View dashboard
* Manage users if required

### Role 2 — Incubation Scanner Staff

Can:

* Scan student ID
* View student details
* Check today's eligibility
* Generate food token
* Print token
* View scan/token result

Should NOT have permission to modify master student/project data.

### Role 3 — Mess Staff

For the MVP, keep the interface minimal.

The mess staff mainly receives the printed token from the student and provides food.

A future version may include token/QR verification.

---

# 6. Overall Design Style

Create a modern, clean and professional dashboard.

Visual direction:

* College enterprise application
* Minimal
* Professional
* Easy to operate quickly
* High readability
* Desktop-first
* Responsive
* Accessible
* Clear status indicators

Avoid:

* Excessive gradients
* Gaming-style UI
* Overly decorative illustrations
* Excessive animations
* Crowded dashboards
* Too many colors

Use a restrained professional color palette.

Suggested:

* Primary: Deep blue / indigo
* Success: Green
* Warning: Amber
* Error: Red
* Neutral: Slate / gray
* Background: Very light gray
* Cards: White

Use consistent semantic colors.

---

# 7. Typography

Use a modern UI font such as:

**Inter**

Typography hierarchy:

* Page title: 24–28px
* Section title: 18–20px
* Card title: 16px
* Body: 14–16px
* Table: 13–14px
* Helper text: 12–13px

Keep typography highly readable.

---

# 8. Main Application Layout

Create a desktop dashboard layout.

### Left Sidebar

Include:

* Logo / Incubation icon
* Dashboard
* Students
* Projects
* Daily Food List
* Scan & Generate Token
* Food Tokens
* Reports
* Settings

At bottom:

* Logged-in user
* Role
* Logout

Example:

```text
┌──────────────────────┐
│  INCUBATION          │
│  Food Management     │
├──────────────────────┤
│                      │
│  ▣ Dashboard         │
│  ◉ Students          │
│  ◈ Projects          │
│  ▤ Daily Food List   │
│  ◉ Scan & Token      │
│  ▣ Food Tokens       │
│  ◫ Reports           │
│                      │
│  ⚙ Settings          │
│                      │
├──────────────────────┤
│  Admin User          │
│  Incubation Staff    │
│  Logout              │
└──────────────────────┘
```

### Top Header

Include:

* Current page title
* Search if applicable
* Notifications icon
* User profile
* Current date

---

# 9. Login Screen

Create a professional login page.

Content:

**Incubation Food Management System**

Subtitle:

**Sign in to manage student eligibility and food tokens**

Fields:

* Username / Email
* Password

Actions:

* Sign In

Additional:

* Forgot password
* College/incubation branding area

Keep the login screen simple.

---

# 10. Dashboard

Create a useful operational dashboard.

Header:

**Dashboard**

Subtitle:

**Overview of incubation students and today's food activity**

### KPI Cards

Create cards for:

1. Total Students
2. Active Projects
3. Today's Eligible Students
4. Tokens Generated Today
5. Tokens Used Today
6. Pending / Unused Tokens

Example:

```text
┌──────────────┐
│ Total        │
│ Students     │
│ 124          │
└──────────────┘

┌──────────────┐
│ Active       │
│ Projects     │
│ 12           │
└──────────────┘

┌──────────────┐
│ Today's Food │
│ Eligible     │
│ 68           │
└──────────────┘

┌──────────────┐
│ Tokens Today │
│ 54           │
└──────────────┘
```

### Dashboard Sections

Create:

**Today's Food Summary**

* Eligible
* Tokens generated
* Tokens printed
* Tokens used
* Remaining

**Recent Token Activity**

Table:

| Token          | Student     | Student ID | Time     | Status  |
| -------------- | ----------- | ---------- | -------- | ------- |
| INC-250925-001 | Siddharth V | 23CS101    | 12:15 PM | Printed |
| INC-250925-002 | Fayas K     | 23CS102    | 12:18 PM | Printed |

**Active Projects**

Show:

* Project name
* Number of students
* Status

---

# 11. Students Page

Create a complete student management screen.

Header:

**Students**

Actions:

* * Add Student
* Import Students (optional)
* Search

Search should prominently support:

**Search by Student ID**

Filters:

* Department
* Year
* Status

### Student Table

Columns:

* Student ID
* Name
* Department
* Year
* Email
* Projects
* Status
* Actions

Example:

```text
23CS101 | Siddharth V | CSE | 3 | siddharth@... | 2 Projects | Active
```

Actions:

* View
* Edit
* Deactivate

---

# 12. Add Student Screen / Modal

Create a clean form.

Fields:

* Student ID *
* Full Name *
* Department *
* Year *
* Email
* Phone
* Status

Buttons:

**Cancel**

**Save Student**

Show validation states.

Example:

```text
Student ID
[ 23CS101                    ]

Full Name
[ Siddharth V                ]

Department
[ CSE ▼                      ]

Year
[ 3 ▼                        ]

Email
[ siddharth@example.com      ]

              Cancel  Save Student
```

---

# 13. Student Details Page

Show:

### Student Profile

* Student ID
* Name
* Department
* Year
* Email
* Phone
* Status

### Project Membership

Show projects the student belongs to.

Example:

```text
Project              Role          Status
──────────────────────────────────────────
Smart Campus         Developer     Active
AgriCheck             Member        Active
```

### Food Token History

Show recent food records:

* Date
* Token
* Meal
* Status

---

# 14. Projects Page

Create project management.

Header:

**Projects**

Button:

**+ Create Project**

Project cards/table should show:

* Project Code
* Project Name
* Number of Students
* Status
* Created Date
* Actions

Example:

```text
AGRI-01
AgriCheck

8 Students
Active

[View Project]
```

---

# 15. Create Project

Fields:

* Project Code
* Project Name
* Description
* Status

After project creation, provide:

**Add Students**

---

# 16. Project Details

Create a project detail page.

Header:

```text
AgriCheck
Project Code: AGRI-01
Status: Active
```

Sections:

### Project Information

* Project name
* Code
* Description
* Status

### Project Members

Table:

| Student ID | Name | Department | Year | Role | Status |
| ---------- | ---- | ---------- | ---- | ---- | ------ |

Button:

**+ Add Student**

---

# 17. Add Student to Project

This is important.

Do NOT create fields for:

* Student name
* Department
* Year

Instead create:

### Search Student

```text
Student ID
[ Search by Student ID... ]

        [Search]
```

After searching:

```text
Student Found

┌───────────────────────────────────────┐
│ 23CS101                               │
│ Siddharth V                           │
│ CSE • Year 3                          │
│                                       │
│ Status: Active                        │
└───────────────────────────────────────┘

Project Role
[ Member ▼ ]

             [Add to Project]
```

If student doesn't exist:

```text
Student not found.

Please add the student to the Student Master first.
```

If already added:

```text
This student is already a member of this project.
```

---

# 18. Daily Food List

This is one of the most important screens.

Page title:

**Daily Food Eligibility**

Purpose:

Allow authorized incubation staff to prepare the list of students eligible for food on a particular date.

### Date Selector

```text
Food Date
[ 25 Sep 2026 ▼ ]
```

Default behavior:

Open tomorrow's date because the list is generally prepared the previous night.

### Controls

Include:

* Search Student ID
* Search Student Name
* Filter by Project
* Add Student
* Remove Student
* Save List
* Finalize List

---

# 19. Daily Food List Table

Columns:

* #
* Student ID
* Student Name
* Department
* Project
* Meal / Food Type if applicable
* Eligibility Status
* Added By
* Actions

Example:

```text
1 | 23CS101 | Siddharth V | CSE | AgriCheck | Eligible | Active
2 | 23CS102 | Fayas K     | CSE | Smart Campus | Eligible | Active
```

Use checkboxes for bulk selection where appropriate.

---

# 20. Add Student to Daily Food List

Follow the same master-data principle.

Staff searches:

**Student ID**

Example:

```text
[ 23CS101                  ] [Search]

Student Found

Siddharth V
23CS101
CSE • Year 3

Project:
[ AgriCheck ▼ ]

Food Eligibility:
[ ✓ Eligible ]

                [Add to List]
```

Do not ask staff to manually enter student details again.

---

# 21. Project-Based Selection

Provide an optional efficient workflow.

Example:

```text
Add Students

Select Project
[ AgriCheck ▼ ]

Students

☑ 23CS101  Siddharth V
☑ 23CS102  Fayas K
☐ 23CS103  Nirmal E

[Select All]     [Add Selected]
```

This should be clearly presented as a bulk-selection workflow.

Do not automatically make every project member eligible.

The staff must explicitly select students.

---

# 22. Daily List States

Design these states:

### Draft

```text
Status: Draft
```

Staff can edit.

### Finalized

```text
Status: Finalized
```

Show:

* Finalized time
* Finalized by
* Edit restrictions

If editing after finalization is allowed, require appropriate permission.

---

# 23. Scan & Generate Token Screen

This is the main operational screen for the next day.

Design it for **fast repeated use**.

Page title:

**Scan Student ID**

Large central scanner area.

Example:

```text
┌────────────────────────────────────────┐
│                                        │
│            SCAN COLLEGE ID             │
│                                        │
│        ┌──────────────────┐            │
│        │                  │            │
│        │      SCAN        │            │
│        │      AREA        │            │
│        │                  │            │
│        └──────────────────┘            │
│                                        │
│      Waiting for student ID...         │
│                                        │
└────────────────────────────────────────┘
```

Provide a manual fallback:

**Enter Student ID manually**

This is useful if the scanner fails.

---

# 24. Successful Scan State

After successful scanning:

Show prominent success state.

```text
✓ Student Verified

Siddharth V
23CS101
CSE • Year 3

Project: AgriCheck

Today's Eligibility
✓ ELIGIBLE

Food Date
25 Sep 2026

[Generate Food Token]
```

---

# 25. Token Generation State

After clicking generate:

Show loading state:

```text
Generating food token...
```

Then:

```text
✓ TOKEN GENERATED

INC-250925-001

Student
Siddharth V

Student ID
23CS101

Date
25 Sep 2026

Time
12:15 PM

Status
PRINTED

[Print Again]
[Done]
```

The token number must be visually prominent.

---

# 26. Thermal Token Preview

Create a realistic small thermal receipt preview.

Example:

```text
--------------------------------
       INCUBATION CENTER
          FOOD TOKEN
--------------------------------

TOKEN: INC-250925-001

Student:
Siddharth V

Student ID:
23CS101

Project:
AgriCheck

Date:
25-09-2026

Meal:
Lunch

STATUS: VALID

--------------------------------
     Please present this
     token at the mess
--------------------------------
```

Use a narrow thermal-printer receipt proportion.

Create both:

* Digital preview
* Print success state

---

# 27. Student Not Eligible State

Design a clear error/rejection state.

```text
✕

Student Not Eligible

Siddharth V
23CS101

This student is not included in
today's food eligibility list.

No food token has been generated.

[Scan Another Student]
```

Do not use confusing language.

---

# 28. Unknown Student State

```text
Student Not Found

The scanned student ID does not
exist in the Student Master.

[Try Again]
[Add Student]
```

---

# 29. Duplicate Token State

If the student already received a token:

```text
⚠ Token Already Generated

Siddharth V
23CS101

A food token has already been
generated for this student today.

Token:
INC-250925-001

Generated:
12:15 PM

[View Token]
[Print Again]
[Done]
```

Do not create another token.

---

# 30. Printer Failure State

Design a printer error state.

```text
⚠ Printing Failed

The food token was generated,
but the thermal printer did not respond.

Token:
INC-250925-001

[Retry Print]
[Print Again Later]
[View Token]
```

The UI should clearly distinguish:

**Token generated successfully**

from

**Printing failed**

Do not imply that token generation failed if only the printer failed.

---

# 31. Food Tokens Page

Create a token management page.

Header:

**Food Tokens**

Filters:

* Date
* Student ID
* Project
* Status
* Meal

Table:

| Token | Student | Student ID | Date | Time | Status |
| ----- | ------- | ---------- | ---- | ---- | ------ |

Statuses:

* Generated
* Printed
* Used
* Cancelled
* Expired

Use semantic status badges.

---

# 32. Token Details

Clicking a token should open details.

Show:

* Token number
* Student
* Student ID
* Project
* Food date
* Meal
* Generated time
* Printed time
* Used time if available
* Generated by
* Status

Actions:

* Print Again
* Cancel Token if permitted

---

# 33. Reports Page

Create a simple reporting dashboard.

Filters:

* Date range
* Project
* Department
* Meal
* Student

Reports:

### Daily Food Summary

* Eligible students
* Tokens generated
* Tokens printed
* Tokens used
* Unused tokens

### Project-wise Summary

```text
Project             Eligible    Tokens
AgriCheck            12          10
Smart Campus          8           7
HealthTrack           6           6
```

### Student-wise History

Allow searching by Student ID.

---

# 34. Notifications / Alerts

Use lightweight notifications.

Examples:

Success:

**Food eligibility list saved successfully.**

Warning:

**23 students are currently selected.**

Error:

**Student 23CS101 is already in today's list.**

Printer:

**Token generated but printing failed.**

Avoid excessive notifications.

---

# 35. Empty States

Design useful empty states.

Examples:

### No students

```text
No students found.

Add your first student to the Student Master.

[+ Add Student]
```

### No project members

```text
No students have been added to this project.

[+ Add Student]
```

### No food list

```text
No food eligibility list created for this date.

[Create Food List]
```

### No tokens

```text
No food tokens generated for this date.
```

---

# 36. Confirmation Dialogs

Design confirmation dialogs for important actions.

Example:

### Remove Student

```text
Remove Student?

Are you sure you want to remove
23CS101 from this project?

[Cancel] [Remove]
```

### Finalize Food List

```text
Finalize Food List?

Once finalized, changes may require
additional permission.

25 students are currently eligible.

[Cancel] [Finalize List]
```

---

# 37. Search UX

Search should be fast and prominent.

Student ID should be the primary identifier.

Examples:

```text
Search Student ID
[ 23CS101                         ]
```

Search results should show:

* Student ID
* Name
* Department
* Year
* Project
* Status

---

# 38. Responsive Design

Primary target:

**Desktop / Laptop**

Also create responsive versions for:

* Tablet
* Smaller laptop

The scan/token page should remain usable on smaller screens.

---

# 39. Component Library

Create reusable Figma components.

Include:

### Buttons

* Primary
* Secondary
* Danger
* Ghost
* Disabled
* Loading

### Inputs

* Text
* Search
* Select
* Date picker
* Password
* Error state
* Disabled state

### Tables

* Header
* Row
* Selected row
* Empty state
* Pagination

### Badges

* Active
* Inactive
* Eligible
* Not Eligible
* Draft
* Finalized
* Generated
* Printed
* Used
* Cancelled
* Expired

### Cards

* KPI card
* Project card
* Student card
* Token card

### Modals

* Confirmation
* Add student
* Add project
* Add project member
* Add food eligibility

### Feedback

* Success
* Warning
* Error
* Info
* Loading

---

# 40. Figma Pages / Organization

Organize the Figma file into these pages:

### Page 1 — Cover

Product name and design overview.

### Page 2 — Design System

* Colors
* Typography
* Spacing
* Buttons
* Inputs
* Tables
* Badges
* Cards
* Icons

### Page 3 — Authentication

* Login
* Login errors
* Loading

### Page 4 — Dashboard

* Main dashboard
* Empty dashboard

### Page 5 — Students

* Student list
* Add student
* Student details
* Edit student
* Empty state

### Page 6 — Projects

* Project list
* Create project
* Project details
* Add student to project

### Page 7 — Daily Food List

* Empty state
* Draft list
* Add student
* Project-based selection
* Finalized list

### Page 8 — Scan & Token

* Scanner idle
* Student found
* Eligible
* Not eligible
* Token generated
* Printing
* Printer failure
* Duplicate token

### Page 9 — Food Tokens

* Token list
* Token details
* Filters

### Page 10 — Reports

* Dashboard
* Daily report
* Project report
* Student history

### Page 11 — Responsive

Tablet and smaller-screen versions.

---

# 41. Important UX Principle

The system should always make the current state obvious.

For example:

**Student Found → Eligible → Token Generated → Printed**

Use a clear visual flow.

For rejection:

**Student Found → Not Eligible → No Token**

For duplicate:

**Student Found → Already Received Token → No New Token**

For printer issue:

**Student Found → Eligible → Token Generated → Printing Failed**

---

# 42. Navigation Flow

Design the prototype with clickable navigation.

Main flow:

```text
Login
  ↓
Dashboard
  ↓
Daily Food List
  ↓
Select Date
  ↓
Add Eligible Students
  ↓
Finalize List
  ↓
Scan & Generate Token
  ↓
Scan Student ID
  ↓
Student Verification
  ↓
Eligibility Check
  ↓
Generate Token
  ↓
Print Token
  ↓
Success
```

Alternative flows:

```text
Scan
 ↓
Student Not Found
 ↓
Retry
```

```text
Scan
 ↓
Not Eligible
 ↓
No Token
```

```text
Scan
 ↓
Already Generated
 ↓
Show Existing Token
```

```text
Generate
 ↓
Printer Failure
 ↓
Retry Print
```

---

# 43. Prototype Interactions

Make the following interactions clickable in the prototype:

* Login → Dashboard
* Sidebar navigation
* Add Student
* Search Student
* Student Details
* Create Project
* Add Student to Project
* Daily Food List
* Add Student to Food List
* Finalize Food List
* Scan Student
* Show eligible student
* Generate token
* Show token preview
* Print success
* Duplicate token
* Not eligible
* Printer failure
* Food Tokens
* Token details
* Reports

Use realistic transitions, but keep animations subtle.

---

# 44. Accessibility

Follow good accessibility principles:

* High contrast
* Clear labels
* Don't rely only on color
* Use icons + text for status
* Keyboard-friendly controls
* Visible focus states
* Minimum comfortable touch/click targets
* Readable table text

---

# 45. Realistic Sample Data

Use realistic sample data throughout the design.

Students:

* 23CS101 — Siddharth V — CSE — Year 3
* 23CS102 — Fayas K — CSE — Year 3
* 23CS103 — Nirmal E — CSE — Year 3
* 23CS104 — Arun Kumar — CSE — Year 3
* 23CS105 — Priya S — CSE — Year 3

Projects:

* AgriCheck
* Smart Campus
* HealthTrack
* EcoMonitor

Example token:

**INC-250925-001**

Use consistent dates and data throughout the prototype.

---

# 46. Important Things NOT to Design

Do not create:

* Student food request workflow
* Student approval workflow
* Student mobile app
* Complicated billing interface
* AI features
* Advanced analytics
* QR scanning at the mess for MVP
* Complex payment gateway
* Automatic project-to-food eligibility assignment

These may be future enhancements, but they are not part of the core MVP.

---

# 47. Future Feature Indicators

If showing future features, place them in a separate section labelled:

**Future Enhancement**

Examples:

* QR token verification at mess
* Automated mess billing
* Monthly food expenditure
* Notifications
* Excel bulk import
* RFID/NFC integration
* Advanced analytics

Do not make future features look like current MVP functionality.

---

# 48. Overall UX Goal

The application should make the daily operation extremely simple:

### Admin Staff

**Manage Students → Manage Projects → Prepare Tomorrow's Food List**

### Scanner Staff

**Scan ID → Verify Eligibility → Generate Token → Print**

### Student

**Scan ID → Receive Printed Token → Go to Mess**

### Mess

**See Token → Provide Food**

The design should prioritize **speed, clarity, error prevention, and accurate student eligibility tracking**.

Create a polished, production-quality Figma design with reusable components, consistent spacing, realistic data, complete states, and a clickable prototype.
