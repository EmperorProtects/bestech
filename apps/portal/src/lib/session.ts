/**
 * Сессии: непрозрачный токен в httpOnly-cookie, в БД лежит только его SHA-256.
 * Проверка сессии идёт в серверных компонентах и server actions — middleware
 * работает в Edge-рантайме и до БД не дотягивается, поэтому там только наличие
 * cookie (быстрый редирект неавторизованных).
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { all, one, run } from '@/db/client';

export const SESSION_COOKIE = 'bestech.sid';
const SESSION_TTL_DAYS = 14;

export type UserRole = 'customer' | 'engineer' | 'supervisor';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: UserRole;
  position: string;
  orgId: string;
  orgName: string;
  orgBin: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: UserRole;
  position: string;
  org_id: string;
  org_name: string;
  org_bin: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Создаёт сессию и возвращает токен для cookie. Заодно подчищает протухшие. */
export function createSession(userId: string, userAgent: string): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  run('DELETE FROM sessions WHERE expires_at < ?', now.toISOString());
  run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)',
    hashToken(token), userId, now.toISOString(), expiresAt.toISOString(), userAgent.slice(0, 200));
  run('UPDATE users SET last_login_at = ? WHERE id = ?', now.toISOString(), userId);

  return { token, expiresAt };
}

export function destroySession(token: string): void {
  run('DELETE FROM sessions WHERE token_hash = ?', hashToken(token));
}

/**
 * Текущий пользователь или null. Обёрнут в `cache`, поэтому в пределах одного
 * запроса БД опрашивается один раз, сколько бы компонентов ни спросило.
 */
export const getCurrentUser = cache((): SessionUser | null => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = one<UserRow>(
    `SELECT u.id, u.email, u.name, u.initials, u.role, u.position,
            o.id AS org_id, o.name AS org_name, o.bin AS org_bin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN organizations o ON o.id = u.org_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    hashToken(token),
    new Date().toISOString(),
  );
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    initials: row.initials,
    role: row.role,
    position: row.position,
    orgId: row.org_id,
    orgName: row.org_name,
    orgBin: row.org_bin,
  };
});

/** Пользователь или редирект на вход. Вызывать в начале каждой защищённой страницы. */
export function requireUser(): SessionUser {
  const user = getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export interface DemoAccount {
  email: string;
  name: string;
  position: string;
}

/** Учётки для экрана входа: прототип показывает, под кем можно зайти. */
export function listDemoAccounts(): DemoAccount[] {
  return all<DemoAccount>('SELECT email, name, position FROM users ORDER BY role');
}
