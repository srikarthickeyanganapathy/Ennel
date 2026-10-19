/**
 * The only source of "now" for services and jobs (Rule 6). Domain functions receive `now`
 * as a parameter instead of depending on this.
 */
export abstract class Clock {
  abstract now(): Date;
}
