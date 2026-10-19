import { type HostelOption, type MealConfig, type StudentProfile } from '@ennel/shared';

export const BLOCK_ID = '8f1c3b9e-8f8a-4b9e-9d5b-1c2d3e4f5a6b';

export const PROFILE: StudentProfile = {
  id: '1f1c3b9e-8f8a-4b9e-9d5b-1c2d3e4f5a6b',
  referenceNumber: '24900417',
  fullName: 'Ashwin Kumar',
  department: 'Computer Science',
  academicYear: 2,
  hostelBlockId: BLOCK_ID,
  hostelName: 'Hostel A',
  blockName: 'Block A',
  roomNumber: '323',
  phone: null,
  parentPhone: null,
  email: null,
  photoUrl: null,
  isOnboardingComplete: false,
  defaultBookingEnabled: false,
  editableFields: ['hostelBlockId', 'roomNumber', 'phone', 'parentPhone', 'email'],
  version: 1,
};

export const HOSTELS: HostelOption[] = [
  {
    id: '2f1c3b9e-8f8a-4b9e-9d5b-1c2d3e4f5a6b',
    name: 'Hostel A',
    blocks: [{ id: BLOCK_ID, name: 'Block A' }],
  },
];

const slot = (id: string, label: string, sortOrder: number) => ({
  id,
  label,
  startMinute: 0,
  endMinute: 30,
  sortOrder,
});

export const MEALS: MealConfig[] = [
  {
    id: 'meal-breakfast',
    mealType: 'BREAKFAST',
    displayName: 'Breakfast',
    serviceStartMinute: 420,
    serviceEndMinute: 510,
    slots: [slot('b1', '7:00 AM - 8:30 AM', 1)],
  },
  {
    id: 'meal-lunch',
    mealType: 'LUNCH',
    displayName: 'Lunch',
    serviceStartMinute: 660,
    serviceEndMinute: 810,
    slots: [slot('l1', '11:00 AM - 11:30 AM', 1), slot('l3', '12:00 PM - 12:30 PM', 3)],
  },
  {
    id: 'meal-dinner',
    mealType: 'DINNER',
    displayName: 'Dinner',
    serviceStartMinute: 1125,
    serviceEndMinute: 1230,
    slots: [slot('d1', '6:45 PM - 7:00 PM', 1), slot('d4', '7:30 PM - 7:45 PM', 4)],
  },
];
