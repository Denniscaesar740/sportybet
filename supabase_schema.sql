-- =========================================================
-- SportyBet Clone - Complete Supabase Database Schema
-- Run this in your Supabase Project Dashboard -> SQL Editor
-- =========================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- 1. Profiles / User Accounts Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT DEFAULT 'LocalPlayer',
  phone TEXT,
  email TEXT DEFAULT 'player@local.test',
  password_hash TEXT,
  balance NUMERIC(12, 2) DEFAULT 2500.00,
  currency TEXT DEFAULT 'GHS',
  preferences JSONB DEFAULT '{"theme": "dark", "soundEnabled": true, "musicEnabled": true, "oneTapBet": false, "defaultStake": 10, "activeSelections": []}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist for existing tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferences') THEN
    ALTER TABLE public.profiles ADD COLUMN preferences JSONB DEFAULT '{"theme": "dark", "soundEnabled": true, "musicEnabled": true, "oneTapBet": false, "defaultStake": 10, "activeSelections": []}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_hash') THEN
    ALTER TABLE public.profiles ADD COLUMN password_hash TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Indexes on Profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Insert default user if not exists
INSERT INTO public.profiles (id, username, phone, email, balance, currency, preferences)
VALUES ('1001', 'LocalPlayer', '233501234567', 'player@local.test', 2500.00, 'GHS', '{"theme": "dark", "soundEnabled": true, "musicEnabled": true, "oneTapBet": false, "defaultStake": 10, "activeSelections": []}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------
-- 2. Betting Tickets Table (Sports & Instant Virtuals)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'single',
  sport_id TEXT DEFAULT 'sr:sport:1',
  total_stake NUMERIC(12, 2) DEFAULT 0,
  total_return NUMERIC(12, 2) DEFAULT 0,
  total_odds TEXT DEFAULT '1.00',
  is_settled BOOLEAN DEFAULT FALSE,
  is_win BOOLEAN DEFAULT FALSE,
  bets JSONB DEFAULT '[]'::jsonb,
  events JSONB DEFAULT '[]'::jsonb,
  markets JSONB DEFAULT '[]'::jsonb,
  outcomes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- Indexes on Tickets
CREATE INDEX IF NOT EXISTS idx_tickets_user_created ON public.tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_unsettled ON public.tickets (user_id, is_settled);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON public.tickets (ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at DESC);

-- ---------------------------------------------------------
-- 3. Virtual Match Rounds Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rounds (
  id TEXT PRIMARY KEY,
  sport_id TEXT DEFAULT 'sr:sport:1',
  round_number INT DEFAULT 0,
  events JSONB DEFAULT '[]'::jsonb,
  result_sequence TEXT,
  is_settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- Indexes on Rounds
CREATE INDEX IF NOT EXISTS idx_rounds_created ON public.rounds (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_settled ON public.rounds (is_settled);

-- ---------------------------------------------------------
-- 4. User Statements & Transactions Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statements (
  trade_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT '1001',
  biz_type INT DEFAULT 0,
  biz_type_name TEXT DEFAULT '',
  sub_biz_type_name TEXT DEFAULT '',
  trade_code TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  real_order_id TEXT DEFAULT '',
  status INT DEFAULT 20,
  currency TEXT DEFAULT 'GHS',
  amount NUMERIC(12, 2) DEFAULT 0,
  amount_sign INT DEFAULT 1,
  init_amount NUMERIC(12, 2) DEFAULT 0,
  fee_type INT DEFAULT 0,
  fee_amount NUMERIC(12, 2) DEFAULT 0,
  after_bal NUMERIC(12, 2) DEFAULT 0,
  pay_ch_id INT DEFAULT 0,
  pay_action INT DEFAULT 30,
  pay_source INT DEFAULT 4,
  counterpart TEXT DEFAULT '',
  counter_authority TEXT DEFAULT '',
  counter_full TEXT DEFAULT '',
  network TEXT DEFAULT '',
  goods_name TEXT DEFAULT '',
  create_time BIGINT,
  pay_finish_time BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes on Statements
CREATE INDEX IF NOT EXISTS idx_statements_user_created ON public.statements (user_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_statements_trade_code ON public.statements (trade_code);
CREATE INDEX IF NOT EXISTS idx_statements_status ON public.statements (status);
CREATE INDEX IF NOT EXISTS idx_statements_biz_type ON public.statements (biz_type);

-- ---------------------------------------------------------
-- 5. Automatic updated_at Trigger for Profiles
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------
-- 6. Enable Row Level Security (RLS)
-- ---------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- 7. Public Access Policies
-- (For development / anon key / server access)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read/write profiles" ON public.profiles;
CREATE POLICY "Allow public read/write profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write tickets" ON public.tickets;
CREATE POLICY "Allow public read/write tickets" ON public.tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write rounds" ON public.rounds;
CREATE POLICY "Allow public read/write rounds" ON public.rounds FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write statements" ON public.statements;
CREATE POLICY "Allow public read/write statements" ON public.statements FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------
-- 8. Enable Realtime Publications (Optional)
-- ---------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles, public.tickets, public.statements;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
