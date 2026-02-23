# Adding Prisma ORM v6.19 to an Existing JavaScript ESM Project with MongoDB

This guide is adapted for JavaScript ES modules ("type": "module" in package.json) and MongoDB, using the latest stable Prisma version that fully supports MongoDB (v6.19).

## Prerequisites

- Node.js v18+
- Existing JavaScript project using ES Modules ("type": "module" in package.json)
- MongoDB database (local or cloud)

## Step 1: Install Prisma Dependencies

Install Prisma CLI and Client (v6.19):

```bash
npm install prisma@6.19 --save-dev
npm install @prisma/client@6.19
```

⚠️ Do not use @latest, as Prisma v7 does not yet support MongoDB.

## Step 2: Initialize Prisma

```bash
npx prisma init --datasource-provider mongodb
```

This creates:

- prisma/schema.prisma — Prisma schema file
- .env — Environment variables file (if not exists)

## Step 3: Configure Environment Variables

Update .env with your MongoDB connection string:

# For MongoDB Atlas
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"

# For local MongoDB
DATABASE_URL="mongodb://localhost:27017/your-database"

## Step 4: Define Your Database Schema

## Step 4: Define Your Database Schema

Edit prisma/schema.prisma with the complete schema based on your Mongoose models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  MANAGER
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  PENDING
  APPROVED
  REJECTED
}

model Firm {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  name              String   @unique
  code              String?
  description       String?
  legal_name        String?
  address           String?
  city              String?
  state             String?
  country           String?
  pincode           String?
  phone_number      String?
  secondary_phone   String?
  email             String?
  website           String?
  business_type     String?
  industry_type     String?
  establishment_year Int?
  employee_count    Int?
  registration_number String?
  registration_date String?
  cin_number        String?
  pan_number        String?
  gst_number        String?
  tax_id            String?
  vat_number        String?
  bank_account_number String?
  bank_name         String?
  bank_branch       String?
  ifsc_code         String?
  payment_terms     String?
  status            String?  @default("approved")
  license_numbers   String?
  insurance_details String?
  currency          String?  @default("INR")
  timezone          String?  @default("Asia/Kolkata")
  fiscal_year_start String?
  invoice_prefix    String?
  quote_prefix      String?
  po_prefix         String?
  logo_url          String?
  invoice_template  String?
  enable_e_invoice  Boolean? @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // relations
  users             User[]
  masterRolls       MasterRoll[]
  wages             Wage[]
  stocks            Stock[]
  parties           Party[]
  bills             Bill[]
  stockRegs         StockReg[]
  ledgers           Ledger[]
  billSequences     BillSequence[]
  firmSettings      FirmSettings[]

  @@map("firms")
}

model User {
  id            String     @id @default(auto()) @map("_id") @db.ObjectId
  username      String     @unique
  email         String     @unique
  fullname      String
  password      String
  role          Role       @default(USER)
  firm_id       String?    @db.ObjectId
  firm          Firm?      @relation(fields: [firm_id], references: [id])
  status        UserStatus @default(PENDING)
  last_mail_sent DateTime?
  last_login    DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // relations
  refreshTokens    RefreshToken[]
  userMasterRolls  UserMasterRoll[]
  userWages        UserWage[]
  createdMasterRolls MasterRoll[] @relation("CreatedBy")
  updatedMasterRolls MasterRoll[] @relation("UpdatedBy")
  createdWages     Wage[]       @relation("CreatedBy")
  updatedWages     Wage[]       @relation("UpdatedBy")
  cancelledBills   Bill[]       @relation("CancelledBy")
  createdBills     Bill[]
  updatedBills     Bill[]

  @@map("users")
}

model RefreshToken {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  user_id    String   @db.ObjectId
  user       User     @relation(fields: [user_id], references: [id])
  token_hash String
  expires_at DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("refresh_tokens")
}

model MasterRoll {
  id                  String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id             String   @db.ObjectId
  firm                Firm     @relation(fields: [firm_id], references: [id])
  employee_name       String
  father_husband_name String
  date_of_birth       String
  aadhar               String
  pan                 String?
  phone_no            String
  address             String
  bank                String
  account_no          String
  ifsc                String
  branch              String?
  uan                 String?
  esic_no             String?
  s_kalyan_no         String?
  category            String?  @default("UNSKILLED")
  p_day_wage          Float?
  project             String?
  site                String?
  date_of_joining     String
  date_of_exit        String?
  doe_rem             String?
  status              String?  @default("Active")
  created_by          String?  @db.ObjectId
  createdBy           User?    @relation("CreatedBy", fields: [created_by], references: [id])
  updated_by          String?  @db.ObjectId
  updatedBy           User?    @relation("UpdatedBy", fields: [updated_by], references: [id])
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // relations
  wages               Wage[]
  userMasterRolls     UserMasterRoll[]

  @@map("master_rolls")
}

model Wage {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id           String   @db.ObjectId
  firm              Firm     @relation(fields: [firm_id], references: [id])
  master_roll_id    String   @db.ObjectId
  masterRoll        MasterRoll @relation(fields: [master_roll_id], references: [id])
  p_day_wage        Float?
  wage_days         Float?   @default(26)
  project           String?
  site              String?
  gross_salary      Float?
  epf_deduction     Float?
  esic_deduction    Float?
  other_deduction   Float?
  other_benefit     Float?
  net_salary        Float?
  salary_month      String
  paid_date         String?
  cheque_no         String?
  paid_from_bank_ac String?
  created_by        String   @db.ObjectId
  createdBy         User     @relation("CreatedBy", fields: [created_by], references: [id])
  updated_by        String   @db.ObjectId
  updatedBy         User     @relation("UpdatedBy", fields: [updated_by], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // relations
  userWages         UserWage[]

  @@map("wages")
}

model UserMasterRoll {
  user_id         String      @db.ObjectId
  user            User        @relation(fields: [user_id], references: [id])
  master_roll_id  String      @db.ObjectId
  masterRoll      MasterRoll  @relation(fields: [master_roll_id], references: [id])

  @@id([user_id, master_roll_id])
  @@map("user_master_rolls")
}

model UserWage {
  user_id    String @db.ObjectId
  user       User   @relation(fields: [user_id], references: [id])
  wage_id    String @db.ObjectId
  wage       Wage   @relation(fields: [wage_id], references: [id])

  @@id([user_id, wage_id])
  @@map("user_wages")
}

model Stock {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id   String   @db.ObjectId
  firm      Firm     @relation(fields: [firm_id], references: [id])
  item      String
  pno       String?
  oem       String?
  hsn       String
  qty       Float    @default(0)
  uom       String   @default("pcs")
  rate      Float    @default(0)
  grate     Float    @default(0)
  total     Float    @default(0)
  mrp       Float?
  batches   String?  // JSON string
  user      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // relations
  stockRegs StockReg[]

  @@map("stocks")
}

model Party {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id    String   @db.ObjectId
  firm       Firm     @relation(fields: [firm_id], references: [id])
  firm       String
  gstin      String?  @default("UNREGISTERED")
  contact    String?
  state      String?
  state_code String?
  addr       String?
  pin        String?
  pan        String?
  usern      String?
  supply     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // relations
  bills      Bill[]
  ledgers    Ledger[]

  @@map("parties")
}

model Bill {
  id                   String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id              String   @db.ObjectId
  firm                 Firm     @relation(fields: [firm_id], references: [id])
  bno                  String
  bdate                String
  supply               String?
  addr                 String?
  gstin                String?
  state                String?
  pin                  String?
  state_code           String?
  gtot                 Float    @default(0)
  ntot                 Float    @default(0)
  rof                  Float?   @default(0)
  btype                String?  @default("SALES")
  usern                String?
  firm                 String?
  party_id             String?  @db.ObjectId
  party                Party?   @relation(fields: [party_id], references: [id])
  oth_chg_json         String?  // JSON string
  order_no             String?
  vehicle_no           String?
  dispatch_through     String?
  narration            String?
  reverse_charge       Boolean? @default(false)
  cgst                 Float?   @default(0)
  sgst                 Float?   @default(0)
  igst                 Float?   @default(0)
  status               String?  @default("ACTIVE")
  cancellation_reason  String?
  cancelled_at         DateTime?
  cancelled_by         String?  @db.ObjectId
  cancelledBy          User?    @relation("CancelledBy", fields: [cancelled_by], references: [id])
  consignee_name       String?
  consignee_gstin      String?
  consignee_address    String?
  consignee_state      String?
  consignee_pin        String?
  consignee_state_code String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  // relations
  stockRegs            StockReg[]
  ledgers              Ledger[]

  @@map("bills")
}

model StockReg {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id        String   @db.ObjectId
  firm           Firm     @relation(fields: [firm_id], references: [id])
  type           String
  bno            String?
  bdate          String?
  supply         String?
  item           String
  item_narration String?
  batch          String?
  hsn            String?
  qty            Float
  uom            String?
  rate           Float?   @default(0)
  grate          Float?   @default(0)
  disc           Float?   @default(0)
  total          Float?   @default(0)
  stock_id       String?  @db.ObjectId
  stock          Stock?   @relation(fields: [stock_id], references: [id])
  bill_id        String?  @db.ObjectId
  bill           Bill?    @relation(fields: [bill_id], references: [id])
  user           String?
  firm           String?
  qtyh           Float?   @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("stock_reg")
}

model Ledger {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id          String   @db.ObjectId
  firm             Firm     @relation(fields: [firm_id], references: [id])
  voucher_id       Int?
  voucher_type     String?
  voucher_no       String?
  account_head     String
  account_type     String?
  debit_amount     Float?   @default(0)
  credit_amount    Float?   @default(0)
  narration        String?
  bill_id          String?  @db.ObjectId
  bill             Bill?    @relation(fields: [bill_id], references: [id])
  party_id         String?  @db.ObjectId
  party            Party?   @relation(fields: [party_id], references: [id])
  tax_type         String?
  tax_rate         Float?
  transaction_date String?
  created_by       String?  // username string
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@map("ledger")
}

model BillSequence {
  id             String @id @default(auto()) @map("_id") @db.ObjectId
  firm_id        String @db.ObjectId
  firm           Firm   @relation(fields: [firm_id], references: [id])
  financial_year String
  last_sequence  Int?   @default(0)
  voucher_type   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([firm_id, financial_year, voucher_type])
  @@map("bill_sequences")
}

model Settings {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  setting_key  String   @unique
  setting_value String?
  description  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("settings")
}

model FirmSettings {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  firm_id      String   @db.ObjectId
  firm         Firm     @relation(fields: [firm_id], references: [id])
  setting_key  String
  setting_value String?
  description  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([firm_id, setting_key])
  @@map("firm_settings")
}
```

✅ Notes for MongoDB:

- Use @map("_id") for MongoDB _id fields
- Use @db.ObjectId for ObjectId fields
- Prisma Migrate is not supported for MongoDB; use db push instead

## Step 5: Push Schema to MongoDB

```bash
npx prisma db push
```

Syncs the Prisma schema with your MongoDB database

Prisma Migrate is not supported; do not run migrate dev for MongoDB

## Step 6: Generate Prisma Client

```bash
npx prisma generate
```

## Step 7: Use Prisma Client in Your ESM Code

Create a database utility file: utils/prisma.js

```javascript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Use it in your routes/controllers:

```javascript
import { prisma } from '../utils/prisma.js';

export async function getUsers(req, res) {
  try {
    const users = await prisma.user.findMany();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createUser(req, res) {
  try {
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        name: req.body.name,
      },
    });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
```

## Step 8: Update Package.json Scripts

```json
{
  "scripts": {
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  }
}
```
