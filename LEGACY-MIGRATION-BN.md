# পুরোনো MySQL sales/target → PostgreSQL

নতুন CRM PostgreSQL-এই থাকবে। এই ধাপে `bridge_analytics_prod` backup-এর company, daily/monthly sales ও daily/monthly/yearly target সংরক্ষণ করা হয়। মূল SQL কখনো PostgreSQL-এ চালানো হয় না। পরীক্ষিত field mapping দিয়ে data নেওয়া হয়।

## CRM-এ কোথায় দেখবেন

Sign in করে **Legacy sales & targets** খুলুন। প্রথমে সর্বশেষ source snapshot দেখাবে। Daily, Monthly এবং Yearly আলাদা dataset; এগুলোর amount একসঙ্গে যোগ করবেন না। Yearly dataset-এ target আছে, sales নেই। কোম্পানি, snapshot এবং period বদলে দেখা যাবে।

শুরুতে শুধু Super Admin এই অংশ দেখতে পারবেন। Super Admin **Roles & Access → Legacy sales & targets → View** দিয়ে প্রয়োজনমতো অন্য role-কে access দিতে পারবেন। আগে থেকে থাকা custom permission বদলানো হয় না।

## কোন তথ্য নেওয়া হয়

| পুরোনো table | সংরক্ষণ |
|---|---|
| company | মূল ID, নাম, biznet/legacy ID ও start date |
| sale_daily / sale_monthly | amount, due, od, cod_od ও period |
| target_daily / target_monthly / target_yearly | amount ও period |
| user / user_key | শুধু record সংখ্যা; password/hash/key import করা হয় না |
| eit_system / pnl | বর্তমান backup-এ খালি; ভবিষ্যতে data থাকলে নতুন mapping লাগবে |

প্রতিটি snapshot PostgreSQL-এর `LegacyImport` ও `LegacyRecord` table-এ আলাদা থাকে। মূল table name, source row ID ও field সংরক্ষিত থাকে। `data` JSONB-এর monetary value decimal string হিসেবে থাকে; হিসাব exact decimal দিয়ে হয়। MySQL DOUBLE dump-এ যত precision পাওয়া যায় তা রাখা হয়; হারানো original precision উদ্ধার করা সম্ভব নয়।

এগুলো customer ledger/payment transaction নয়। নতুন CRM-এর dashboard collection, booking, customer balance বা installment হিসাবের সঙ্গে এগুলো যোগ করা হয় না। `due`, `od`, `cod_od`-এর অর্থ নিশ্চিত না হওয়া পর্যন্ত source label-এই রাখা হয়। Currency ধরে নেওয়া হয়নি। Backup-এর সময়ের timezone অজানা; সেটি local dump time হিসেবেই দেখানো হয়।

## ভবিষ্যতের backup দেওয়া

প্রয়োজন: Docker-এ আপডেট করা CRM চালু এবং Python 3.10+। Project folder থেকে PowerShell-এ প্রথমে dry run:

```powershell
.\scripts\Import-LegacyAnalytics.ps1 -BackupFile 'C:\path\new-daily.sql.tar.xz'
```

`.sql` এবং `.sql.tar.xz` সমর্থিত। Python অন্য জায়গায় থাকলে `-PythonCommand 'C:\path\python.exe'` দিন।

Count যাচাই করার পরে:

```powershell
.\scripts\Import-LegacyAnalytics.ps1 -BackupFile 'C:\path\new-daily.sql.tar.xz' -Apply
```

`-Apply` আগে বর্তমান PostgreSQL database-এর backup তৈরি ও যাচাই করে। তারপর একটি transaction-এ পুরো snapshot সংরক্ষণ করে। ব্যর্থ হলে অর্ধেক snapshot থাকে না। Generated sanitized manifest এবং pre-import backup `backups/legacy/`-এ থাকে; এই folder Git থেকে বাদ দেওয়া আছে।

একই SQL আবার দিলে একই data তৈরি হয় না। পুরোনো backup পরে দিলেও সর্বশেষ snapshot বদলে পুরোনোটি হয় না। নতুন snapshot পুরোনো snapshot মুছে দেয় না। Daily/weekly backup-গুলো যোগ করে মোট sales বের করা হয় না।

অচেনা table/field, nonempty unmapped table, duplicate ID/period বা ভাঙা reference পেলে import থামবে। তখন schema দেখে mapping ও test আপডেট করতে হবে; validation পাশ কাটিয়ে import করবেন না।

## মূল CRM data পরে পাওয়া গেলে

Customer, project, plot, booking, installment ও payment-এর database পাওয়া গেলে সেগুলোর আলাদা mapping হবে। Source ID দিয়ে সম্পর্ক রাখা, duplicate customer শনাক্ত করা, opening balance ও payment history মিলিয়ে পরীক্ষা করার পরে core CRM table-এ data নেওয়া হবে। পুরোনো account-এর password সরাসরি নতুন login-এ ব্যবহার করা হবে না; account ও role mapping আলাদা করে করতে হবে।

## যাচাই ও rollback

Import metadata-তে source database/file, SQL SHA-256, source snapshot time, import time, record count এবং per-table reconciliation থাকে। Reconciliation-এর due/OD sums শুধু transfer verification; customer outstanding হিসেবে ব্যবহার করবেন না।

প্রথমে আলাদা test database-এ পরীক্ষা করুন। ব্যবহারকারী তৈরি করা নতুন data হারাতে পারে বলে পুরো database restore routine undo নয়। প্রয়োজন হলে নির্দিষ্ট ভুল legacy snapshot-এর ID শনাক্ত করে maintenance-এর মাধ্যমে শুধু সেই snapshot সরাতে হবে; মূল backup ও manifest রেখে দিন।
