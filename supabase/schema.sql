-- Watchara Gold: schema + storage bucket
create extension if not exists "pgcrypto";

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  doc_type text not null default 'ใบรับซื้อทองคำเก่า/ใบสำคัญจ่าย',
  date date,
  customer_name text,
  phone text,
  total_weight numeric,
  subtotal numeric,
  other_amount numeric,
  grand_total numeric,
  payment_method text,
  payment_detail text,
  buyer_name text,
  notes text,
  image_url text
);

create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  no int,
  metal_type text not null check (metal_type in ('ทอง','เงิน','นาค','แพลตตินัม','อื่นๆ')),
  item_name text,
  base_price numeric,
  plus_price numeric,
  buy_percent numeric,
  weight numeric,
  price_per_gram numeric,
  amount numeric
);

create index if not exists receipts_dup_idx on receipts (date, customer_name, grand_total);
create index if not exists receipts_date_idx on receipts (date desc);
create index if not exists receipt_items_receipt_idx on receipt_items (receipt_id);

-- Private bucket (accessed via service role + signed URLs from server only)
insert into storage.buckets (id, name, public)
values ('receipt-images', 'receipt-images', false)
on conflict (id) do nothing;

alter table receipts enable row level security;
alter table receipt_items enable row level security;
-- No policies: only the service role key (server) can read/write.
