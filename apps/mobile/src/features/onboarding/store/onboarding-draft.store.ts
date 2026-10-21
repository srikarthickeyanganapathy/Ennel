import {
  type CompleteOnboardingRequest,
  DietType,
  MealType,
  MEAL_TYPE_ORDER,
  type StudentProfile,
} from '@ennel/shared';
import { create } from 'zustand';

export interface MealDraft {
  isEnabled: boolean;
  slotId: string | null;
  dietType: DietType;
}

export interface ProfileDraft {
  fullName: string;
  department: string;
  academicYear: string;
  email: string;
  hostelBlockId: string | null;
  roomNumber: string;
  phone: string;
  parentPhone: string;
}

interface OnboardingDraftState {
  /** The student whose data is in the draft; another student on this device starts fresh. */
  prefilledFor: string | null;
  profile: ProfileDraft;
  defaultBookingEnabled: boolean;
  meals: Record<MealType, MealDraft>;
  /** Prefills college data once; going Back never loses edits (Spec §3 Screen 8). */
  prefill: (profile: StudentProfile) => void;
  updateProfile: (changes: Partial<ProfileDraft>) => void;
  setDefaultBookingEnabled: (value: boolean) => void;
  updateMeal: (mealType: MealType, changes: Partial<MealDraft>) => void;
  reset: () => void;
}

const EMPTY_PROFILE: ProfileDraft = {
  fullName: '',
  department: '',
  academicYear: '',
  email: '',
  hostelBlockId: null,
  roomNumber: '',
  phone: '',
  parentPhone: '',
};

// Every meal starts OFF so nothing is booked until the student chooses it.
const INITIAL_MEALS: Record<MealType, MealDraft> = {
  [MealType.BREAKFAST]: { isEnabled: false, slotId: null, dietType: DietType.VEG },
  [MealType.LUNCH]: { isEnabled: false, slotId: null, dietType: DietType.VEG },
  [MealType.DINNER]: { isEnabled: false, slotId: null, dietType: DietType.VEG },
};

const INITIAL_STATE: Pick<
  OnboardingDraftState,
  'prefilledFor' | 'profile' | 'defaultBookingEnabled' | 'meals'
> = {
  prefilledFor: null,
  profile: EMPTY_PROFILE,
  defaultBookingEnabled: true,
  meals: INITIAL_MEALS,
};

export const useOnboardingDraft = create<OnboardingDraftState>((set, get) => ({
  ...INITIAL_STATE,
  prefill: (profile) => {
    if (get().prefilledFor === profile.id) return;
    set({
      ...INITIAL_STATE,
      prefilledFor: profile.id,
      profile: {
        fullName: profile.fullName,
        department: profile.department,
        academicYear: String(profile.academicYear),
        email: profile.email ?? '',
        hostelBlockId: profile.hostelBlockId,
        roomNumber: profile.roomNumber ?? '',
        phone: profile.phone ?? '',
        parentPhone: profile.parentPhone ?? '',
      },
    });
  },
  updateProfile: (changes) => set((state) => ({ profile: { ...state.profile, ...changes } })),
  setDefaultBookingEnabled: (value) => set({ defaultBookingEnabled: value }),
  updateMeal: (mealType, changes) =>
    set((state) => ({
      meals: { ...state.meals, [mealType]: { ...state.meals[mealType], ...changes } },
    })),
  reset: () => set(INITIAL_STATE),
}));

/** Builds the Screen 8 request. Only editable profile fields are sent. */
export function buildOnboardingRequest(
  draft: Pick<OnboardingDraftState, 'profile' | 'defaultBookingEnabled' | 'meals'>,
  editableFields: readonly string[],
): CompleteOnboardingRequest {
  const editable = new Set(editableFields);
  const { profile } = draft;
  return {
    profile: {
      ...(editable.has('fullName') ? { fullName: profile.fullName } : {}),
      ...(editable.has('department') ? { department: profile.department } : {}),
      ...(editable.has('academicYear') ? { academicYear: Number(profile.academicYear) } : {}),
      hostelBlockId: profile.hostelBlockId ?? '',
      roomNumber: profile.roomNumber,
      phone: profile.phone,
      parentPhone: profile.parentPhone,
      email: profile.email.trim() === '' ? null : profile.email,
    },
    defaultBookingEnabled: draft.defaultBookingEnabled,
    mealPreferences: MEAL_TYPE_ORDER.map((mealType) => ({ mealType, ...draft.meals[mealType] })),
  };
}
