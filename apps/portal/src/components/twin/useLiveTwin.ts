'use client';

import { useEffect, useState } from 'react';
import type { LiveTwin } from '@/lib/twin/live';
import { LIVE_POLL_MS, type LivePeriod } from '@/lib/twin/shared';

type Listener = (data: LiveTwin) => void;

interface Channel {
  url: string;
  data: LiveTwin | null;
  listeners: Set<Listener>;
  timer: ReturnType<typeof setTimeout> | null;
  busy: boolean;
}

/** Один опрос на объект и период, сколько бы компонентов ни подписалось (шапка, баннер, панель). */
const channels = new Map<string, Channel>();

const urlFor = (code: string, period: string) => `/api/twin/${encodeURIComponent(code)}/live?period=${period}`;

/** Скрытая вкладка не опрашивает портал: за туннелем это лишний трафик и запросы. */
const hidden = () => typeof document !== 'undefined' && document.hidden;

function schedule(key: string, channel: Channel): void {
  if (channel.timer || !channel.listeners.size || hidden()) return;
  channel.timer = setTimeout(() => {
    channel.timer = null;
    void poll(key, channel);
  }, LIVE_POLL_MS);
}

async function poll(key: string, channel: Channel): Promise<void> {
  if (channel.busy) return;
  channel.busy = true;
  try {
    const res = await fetch(channel.url, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as LiveTwin;
      channel.data = data;
      channel.listeners.forEach((listener) => listener(data));
    }
  } catch {
    // Сеть моргнула — следующий опрос через LIVE_POLL_MS.
  } finally {
    channel.busy = false;
    schedule(key, channel);
  }
}

// Вернулись на вкладку — догоняем состояние сразу, не ожидая очередного такта.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const channel of channels.values()) {
        if (channel.timer) {
          clearTimeout(channel.timer);
          channel.timer = null;
        }
      }
      return;
    }
    for (const [key, channel] of channels) {
      if (channel.listeners.size) void poll(key, channel);
    }
  });
}

/** Живые данные двойника: стартуют с серверного снимка и обновляются каждые LIVE_POLL_MS. */
export function useLiveTwin(code: string, period: LivePeriod, initial: LiveTwin): LiveTwin {
  const key = `${code}|${period}`;
  const [data, setData] = useState<LiveTwin>(() => channels.get(key)?.data ?? initial);

  useEffect(() => {
    let channel = channels.get(key);
    if (!channel) {
      channel = { url: urlFor(code, period), data: null, listeners: new Set(), timer: null, busy: false };
      channels.set(key, channel);
    }
    const current = channel;
    const listener: Listener = (next) => setData(next);
    current.listeners.add(listener);
    if (current.data) setData(current.data);
    if (!current.timer && !current.busy) void poll(key, current);

    return () => {
      current.listeners.delete(listener);
      if (!current.listeners.size && current.timer) {
        clearTimeout(current.timer);
        current.timer = null;
      }
    };
  }, [key, code, period]);

  return data;
}

/** Внеочередной опрос после действия (квитирование, сценарий эмулятора). */
export function refreshLive(code: string): void {
  for (const [key, channel] of channels) {
    if (!key.startsWith(`${code}|`)) continue;
    if (channel.timer) {
      clearTimeout(channel.timer);
      channel.timer = null;
    }
    void poll(key, channel);
  }
}
