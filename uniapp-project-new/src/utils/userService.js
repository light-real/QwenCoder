/**
 * UserService — 用户数据统一管理
 *
 * 兼容两种模式：
 *   - 未登录：数据存本地 localStorage（与原来一致）
 *   - 已登录：数据存 Supabase 云端，本地作为缓存
 *
 * 使用方法（替换原来的 getApp().getUserData() / updateUserData()）：
 *   import userService from '@/utils/userService.js';
 *   const data = await userService.getUserData();
 *   await userService.updateUserData(data);
 */

import supabase from './supabaseClient.js';

const INITIAL_MONEY = 10000;
const LOCAL_KEY = 'userData';

function getDefaultData() {
  return {
    cash: INITIAL_MONEY,
    stocks: [],
    history: [],
    totalAssets: INITIAL_MONEY,
    profit: 0,
  };
}

// ─── 本地存储 ─────────────────────────────────────────────────
function getLocalData() {
  return uni.getStorageSync(LOCAL_KEY) || getDefaultData();
}

function setLocalData(data) {
  uni.setStorageSync(LOCAL_KEY, data);
}

// ─── 登录状态 ─────────────────────────────────────────────────

/**
 * 获取当前用户
 * 优先从本地 session 恢复（不走网络），session 过期时才刷新
 */
async function getCurrentUser() {
  try {
    // 1. 先尝试从本地 storage 恢复 session（离线也能获取）
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      return session.user;
    }
    // 2. 本地没有 session，返回 null（未登录）
    return null;
  } catch (e) {
    return null;
  }
}

function getCurrentUserSync() {
  // 从本地缓存的 session 中快速判断（同步，供非 async 场景使用）
  try {
    // Supabase v2 的 session key 格式：sb-<projectRef>-auth-token
    const projectRef = 'mbezexavbnsnnrxmfpqb';
    const key = `sb-${projectRef}-auth-token`;
    const raw = uni.getStorageSync(key);
    if (!raw) return null;
    const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (session && session.user) return session.user;
  } catch (e) {}
  return null;
}

// ─── 云端读写 ─────────────────────────────────────────────────
async function loadFromCloud(userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('[userService] loadFromCloud error:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    cash: parseFloat(data.cash),
    stocks: data.stocks || [],
    history: data.history || [],
    totalAssets: parseFloat(data.total_assets),
    profit: parseFloat(data.profit),
  };
}

async function saveToCloud(userId, userData) {
  const payload = {
    user_id: userId,
    cash: userData.cash,
    stocks: userData.stocks || [],
    history: userData.history || [],
    total_assets: userData.totalAssets,
    profit: userData.profit,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_data')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.warn('[userService] saveToCloud error:', error.message);
    return false;
  }
  return true;
}

// ─── 自选同步 ─────────────────────────────────────────────────
async function loadFavoritesFromCloud(userId) {
  const { data, error } = await supabase
    .from('favorite_symbols')
    .select('symbols')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.symbols || [];
}

async function saveFavoritesToCloud(userId, symbols) {
  const { error } = await supabase
    .from('favorite_symbols')
    .upsert({
      user_id: userId,
      symbols,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.warn('[userService] saveFavoritesToCloud error:', error.message);
  }
}

// ─── 对外 API ─────────────────────────────────────────────────

/**
 * 初始化：App 启动时调用
 * - 未登录：确保本地有默认数据
 * - 已登录（含 token 自动恢复）：从云端加载数据并同步到本地
 */
async function initialize() {
  // 确保本地有默认数据（防止首次安装没有数据）
  if (!uni.getStorageSync(LOCAL_KEY)) {
    setLocalData(getDefaultData());
  }

  // 尝试从本地 session 恢复登录态（getSession 不走网络，只读本地存储）
  const user = await getCurrentUser();
  if (!user) {
    // 未登录或 session 已完全过期，使用本地数据即可
    return;
  }

  // 已登录（session 有效），静默拉取云端数据
  try {
    const cloudData = await loadFromCloud(user.id);
    if (cloudData) {
      setLocalData(cloudData);
    } else {
      // 云端没有数据（新用户）：把本地数据上传
      const localData = getLocalData();
      await saveToCloud(user.id, localData);
    }

    // 同步自选
    const cloudFavs = await loadFavoritesFromCloud(user.id);
    if (cloudFavs) {
      uni.setStorageSync('favoriteSymbols', cloudFavs);
    } else {
      const localFavs = uni.getStorageSync('favoriteSymbols');
      if (localFavs) await saveFavoritesToCloud(user.id, localFavs);
    }
  } catch (e) {
    // 网络失败不影响启动，继续使用本地缓存
    console.warn('[userService] initialize cloud sync failed:', e);
  }
}

/**
 * 获取用户数据（同步，从本地缓存读）
 */
function getUserData() {
  return getLocalData();
}

/**
 * 更新用户数据（写本地 + 异步同步云端）
 */
async function updateUserData(data) {
  setLocalData(data);
  const user = await getCurrentUser();
  if (user) {
    saveToCloud(user.id, data); // 异步，不阻塞 UI
  }
}

/**
 * 同步方式更新（与旧代码兼容）
 */
function updateUserDataSync(data) {
  setLocalData(data);
  getCurrentUser().then(user => {
    if (user) saveToCloud(user.id, data);
  });
}

/**
 * 更新自选（写本地 + 异步同步云端）
 */
async function updateFavorites(symbols) {
  uni.setStorageSync('favoriteSymbols', symbols);
  const user = await getCurrentUser();
  if (user) {
    saveFavoritesToCloud(user.id, symbols);
  }
}

/**
 * 注册
 */
async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  // 注册成功后，强制使用全新默认数据（10000 初始资金），覆盖本地并上传云端
  if (data.user) {
    const freshData = getDefaultData();
    setLocalData(freshData);
    await saveToCloud(data.user.id, freshData);
  }
  return data;
}

/**
 * 登录
 */
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  // 登录成功，从云端加载数据覆盖本地
  if (data.user) {
    const cloudData = await loadFromCloud(data.user.id);
    if (cloudData) setLocalData(cloudData);

    const cloudFavs = await loadFavoritesFromCloud(data.user.id);
    if (cloudFavs) uni.setStorageSync('favoriteSymbols', cloudFavs);
  }
  return data;
}

/**
 * 退出登录
 */
async function signOut() {
  await supabase.auth.signOut();
}

/**
 * 获取当前登录用户（异步）
 */
async function getUser() {
  return await getCurrentUser();
}

export default {
  initialize,
  getUserData,
  updateUserData,
  updateUserDataSync,
  updateFavorites,
  signUp,
  signIn,
  signOut,
  getUser,
  getCurrentUserSync,
};
