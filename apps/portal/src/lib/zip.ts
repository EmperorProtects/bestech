/**
 * Минимальный ZIP-писатель (метод store, без сжатия) на node:zlib.crc32.
 * Нужен ровно для одного сценария — «скачать комплект чертежей одним архивом»,
 * поэтому внешняя библиотека избыточна. Имена файлов пишутся в UTF-8 с флагом
 * language encoding (bit 11), иначе кириллица в архиве ломается.
 */

import { crc32 } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Buffer;
  date?: Date;
}

/** Дата и время в формате MS-DOS, как их ждёт спецификация ZIP. */
function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export function createZip(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const { time, date } = dosDateTime(entry.date ?? new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // подпись локального заголовка
    local.writeUInt16LE(20, 4); // версия для распаковки — 2.0
    local.writeUInt16LE(0x0800, 6); // bit 11: имя в UTF-8
    local.writeUInt16LE(0, 8); // метод сжатия — store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field

    chunks.push(local, name, entry.data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); // подпись записи центрального каталога
    header.writeUInt16LE(20, 4); // версия создателя
    header.writeUInt16LE(20, 6); // версия для распаковки
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(date, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30); // extra
    header.writeUInt16LE(0, 32); // comment
    header.writeUInt16LE(0, 34); // номер диска
    header.writeUInt16LE(0, 36); // внутренние атрибуты
    header.writeUInt32LE(0, 38); // внешние атрибуты
    header.writeUInt32LE(offset, 42);

    central.push(header, name);
    offset += local.length + name.length + entry.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}
