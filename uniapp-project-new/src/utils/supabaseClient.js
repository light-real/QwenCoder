/**
 * Supabase 客户端初始化
 *
 * 使用前请在 Supabase 控制台创建项目，并替换以下两个值：
 *   SUPABASE_URL  → Project Settings → API → Project URL
 *   SUPABASE_KEY  → Project Settings → API → anon public key
 *
 * 建表 SQL（在 Supabase SQL Editor 中执行）：
 *
 *   -- 用户数据表
 *   create table user_data (
 *     id          uuid primary key default gen_random_uuid(),
 *     user_id     uuid references auth.users(id) on delete cascade not null unique,
 *     cash        numeric default 10000,
 *     stocks      jsonb  default '[]'::jsonb,
 *     history     jsonb  default '[]'::jsonb,
 *     total_assets numeric default 10000,
 *     profit      numeric default 0,
 *     updated_at  timestamptz default now()
 *   );
 *
 *   -- 自选币种表
 *   create table favorite_symbols (
 *     id       uuid primary key default gen_random_uuid(),
 *     user_id  uuid references auth.users(id) on delete cascade not null unique,
 *     symbols  jsonb default '["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"]'::jsonb,
 *     updated_at timestamptz default now()
 *   );
 *
 *   -- 开启 Row Level Security
 *   alter table user_data enable row level security;
 *   alter table favorite_symbols enable row level security;
 *
 *   -- 只允许用户读写自己的数据
 *   create policy "Users can manage own data" on user_data
 *     for all using (auth.uid() = user_id);
 *   create policy "Users can manage own favorites" on favorite_symbols
 *     for all using (auth.uid() = user_id);
 */

// ⚠️ 替换为你自己的 Supabase 项目信息
const SUPABASE_URL = 'https://mbezexavbnsnnrxmfpqb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZXpleGF2Ym5zbm5yeG1mcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODYyNjQsImV4cCI6MjA5MjE2MjI2NH0.2MHRC1BbU7Lzz0if8agAQNLpNOYd8zYzSPkqtFrjIoY';

import { createClient } from '@supabase/supabase-js';

// Capacitor WebView 和浏览器环境都支持原生 fetch，直接使用
// uni.request 会把 JSON body 转成 form 格式，导致 Supabase 认证失败
// Supabase session 存储适配器
// 注意：Supabase 内部把 session 当 JSON 字符串读写，必须保证 get/set 都是字符串
const uniStorage = {
  getItem: (key) => {
    try {
      const val = uni.getStorageSync(key);
      if (val === null || val === undefined || val === '') return null;
      // 如果是对象（uni 自动反序列化了），转回字符串供 Supabase 解析
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    } catch {
      return null;
    }
  },
  setItem: (key, val) => {
    try {
      // 始终存字符串，防止 uni 自动序列化破坏格式
      uni.setStorageSync(key, typeof val === 'string' ? val : JSON.stringify(val));
    } catch {}
  },
  removeItem: (key) => {
    try { uni.removeStorageSync(key); } catch {}
  },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: uniStorage,
  },
});

export default supabase;
export { SUPABASE_URL, SUPABASE_KEY };
