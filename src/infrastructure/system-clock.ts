// Adaptador de `Clock`: la hora real para las lecturas y la hora local
// (`BOTS_TIMEZONE`, Europe/Madrid) para la rutina.
//
// `BOTS_FORCE_HOUR` fija la hora LOCAL de la rutina —«son las 11, salid a
// pasear»— sin tocar la de las lecturas, que tiene que ser la real: el servidor
// rechaza las del futuro y ordena por ella.

import type { Clock } from '../application/ports.ts';
import type { LocalTime } from '../domain/routine.ts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class SystemClock implements Clock {
  private readonly format: Intl.DateTimeFormat;
  private readonly forceHour: number | null;

  constructor(timeZone: string, forceHour: number | null) {
    this.format = new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    });
    this.forceHour = forceHour;
  }

  now(): Date {
    return new Date();
  }

  local(): LocalTime {
    const parts = Object.fromEntries(this.format.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const weekday = WEEKDAYS.indexOf(parts.weekday ?? 'Mon');
    const hour = this.forceHour ?? Number(parts.hour) + Number(parts.minute) / 60;
    // Con la hora forzada, un día laborable: la rutina de diario.
    return { weekday: this.forceHour === null ? weekday : 3, hour };
  }
}
