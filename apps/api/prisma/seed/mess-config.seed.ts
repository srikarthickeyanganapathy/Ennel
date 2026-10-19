import { formatMinuteOfDay } from '@ennel/shared';
import { type MealType, type PrismaClient } from '../../src/generated/prisma/client';

// Spec §5.1 timetable. Capacity 500 is an illustrative placeholder (Spec §18.2), not a confirmed value.
const PLACEHOLDER_CAPACITY = 500;

interface SlotSeed {
  start: string;
  end: string;
}

interface MealSeed {
  mealType: MealType;
  displayName: string;
  slots: SlotSeed[];
}

const MEALS: MealSeed[] = [
  // One serving window modelled as a single slot (BR-MEAL-1); 7:00-8:30 AM still to be confirmed.
  { mealType: 'BREAKFAST', displayName: 'Breakfast', slots: [{ start: '07:00', end: '08:30' }] },
  {
    mealType: 'LUNCH',
    displayName: 'Lunch',
    slots: [
      { start: '11:00', end: '11:30' },
      { start: '11:30', end: '12:00' },
      { start: '12:00', end: '12:30' },
      { start: '12:30', end: '13:00' },
      { start: '13:00', end: '13:30' },
    ],
  },
  {
    mealType: 'DINNER',
    displayName: 'Dinner',
    slots: [
      { start: '18:45', end: '19:00' },
      { start: '19:00', end: '19:15' },
      { start: '19:15', end: '19:30' },
      { start: '19:30', end: '19:45' },
      { start: '19:45', end: '20:00' },
      { start: '20:00', end: '20:15' },
      { start: '20:15', end: '20:30' },
    ],
  },
];

function toMinute(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Creates meals and slots once; staff manage them afterwards (Admin §D). */
export async function seedMessConfig(prisma: PrismaClient): Promise<void> {
  for (const mealSeed of MEALS) {
    const existing = await prisma.meal.findUnique({ where: { mealType: mealSeed.mealType } });
    if (existing) continue;
    const first = mealSeed.slots[0];
    const last = mealSeed.slots.at(-1);
    if (!first || !last) throw new Error(`Meal ${mealSeed.mealType} has no slots`);
    await prisma.meal.create({
      data: {
        mealType: mealSeed.mealType,
        displayName: mealSeed.displayName,
        serviceStartMinute: toMinute(first.start),
        serviceEndMinute: toMinute(last.end),
        slots: {
          create: mealSeed.slots.map((slot, index) => ({
            label: `${formatMinuteOfDay(toMinute(slot.start))} - ${formatMinuteOfDay(toMinute(slot.end))}`,
            startMinute: toMinute(slot.start),
            endMinute: toMinute(slot.end),
            sortOrder: index + 1,
            defaultCapacity: PLACEHOLDER_CAPACITY,
          })),
        },
      },
    });
  }
  console.log('Mess config: meals and slots present');
}
