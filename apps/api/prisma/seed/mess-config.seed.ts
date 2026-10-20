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

function slotData(slots: SlotSeed[]) {
  return slots.map((slot, index) => ({
    label: `${formatMinuteOfDay(toMinute(slot.start))} - ${formatMinuteOfDay(toMinute(slot.end))}`,
    startMinute: toMinute(slot.start),
    endMinute: toMinute(slot.end),
    sortOrder: index + 1,
    defaultCapacity: PLACEHOLDER_CAPACITY,
  }));
}

/**
 * System data: the three meals with the spec's serving windows, and Breakfast's single slot
 * (BR-MEAL-1). Created once; staff manage them afterwards (Admin §D).
 */
export async function seedMeals(prisma: PrismaClient): Promise<void> {
  for (const mealSeed of MEALS) {
    if (await prisma.meal.findUnique({ where: { mealType: mealSeed.mealType } })) continue;
    const first = mealSeed.slots[0];
    const last = mealSeed.slots.at(-1);
    if (!first || !last) throw new Error(`Meal ${mealSeed.mealType} has no slots`);
    const isBreakfast = mealSeed.mealType === 'BREAKFAST';
    await prisma.meal.create({
      data: {
        mealType: mealSeed.mealType,
        displayName: mealSeed.displayName,
        serviceStartMinute: toMinute(first.start),
        serviceEndMinute: toMinute(last.end),
        slots: { create: isBreakfast ? slotData(mealSeed.slots) : [] },
      },
    });
  }
  console.log('Meals: present');
}

/** Development only: the spec's Lunch and Dinner slots, for meals that have none yet. */
export async function seedSampleSlots(prisma: PrismaClient): Promise<void> {
  for (const mealSeed of MEALS.filter((meal) => meal.mealType !== 'BREAKFAST')) {
    const meal = await prisma.meal.findUnique({
      where: { mealType: mealSeed.mealType },
      include: { _count: { select: { slots: true } } },
    });
    if (!meal || meal._count.slots > 0) continue;
    await prisma.mealSlot.createMany({
      data: slotData(mealSeed.slots).map((slot) => ({ ...slot, mealId: meal.id })),
    });
  }
  console.log('Sample slots: present');
}

/** Meals plus the sample timetable, as used by tests and the dev seed. */
export async function seedMessConfig(prisma: PrismaClient): Promise<void> {
  await seedMeals(prisma);
  await seedSampleSlots(prisma);
}
