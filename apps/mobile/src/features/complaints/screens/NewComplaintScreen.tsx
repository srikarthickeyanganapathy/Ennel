import { useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  addBusinessDays,
  type BusinessDate,
  type ComplaintCategory,
  type ComplaintReceipt,
  type ComplaintType,
  createComplaintRequestSchema,
  type MealType,
  toBusinessDate,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { DateField } from '@/shared/components/DateField';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { OptionList } from '@/shared/components/OptionList';
import { Screen } from '@/shared/components/Screen';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { TextField } from '@/shared/components/TextField';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { confirmAction } from '@/shared/utils/confirm-action';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import { type PickedComplaintPhoto } from '../api/complaints-api';
import { ComplaintPhotos } from '../components/ComplaintPhotos';
import { useMyReports, useSubmitComplaint } from '../hooks/use-complaints';
import { CATEGORY_LABELS, privacyNote, TYPE_LABELS } from '../utils/complaint-text';

/** How far back a report can point; older meals are rarely actionable. */
const MEAL_LOOKBACK_DAYS = 30;
const NO_MEAL = 'NONE';

const typeOptions = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const mealOptions = [
  { value: NO_MEAL, label: 'Not about a meal' },
  ...Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label })),
];

/** Spec §12 Complaints & Feedback form. */
export function NewComplaintScreen() {
  const [receipt, setReceipt] = useState<ComplaintReceipt | null>(null);
  return receipt ? <Submitted receipt={receipt} /> : <ComplaintForm onSubmitted={setReceipt} />;
}

function ComplaintForm({ onSubmitted }: { onSubmitted: (receipt: ComplaintReceipt) => void }) {
  const navigation = useNavigation();
  const reports = useMyReports();
  const submit = useSubmitComplaint();
  const runOnce = useSubmitLock();
  const today = toBusinessDate(new Date());
  const [type, setType] = useState<ComplaintType>('COMPLAINT');
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [meal, setMeal] = useState<string>(NO_MEAL);
  const [mealDate, setMealDate] = useState<BusinessDate | null>(today);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedComplaintPhoto[]>([]);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const isDirty = description.trim().length > 0 || photos.length > 0;

  // Spec §12 "Back": warn before unsaved text or photos are lost.
  usePreventRemove(isDirty && !submit.isPending, ({ data }) => {
    void confirmAction({
      title: 'Discard this report?',
      message: 'Your text and photos will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      isDestructive: true,
    }).then((isConfirmed) => {
      if (isConfirmed) navigation.dispatch(data.action);
    });
  });

  const onSubmit = () =>
    runOnce(async () => {
      const parsed = createComplaintRequestSchema.safeParse({
        type,
        category: category ?? undefined,
        ...(meal !== NO_MEAL && { mealType: meal as MealType, mealDate: mealDate ?? undefined }),
        description,
      });
      if (!parsed.success) {
        setProblems(
          Object.fromEntries(
            parsed.error.issues.map((issue) => [
              String(issue.path[0]),
              issue.path[0] === 'category' ? 'Choose a category' : issue.message,
            ]),
          ),
        );
        return;
      }
      setProblems({});
      onSubmitted(await submit.mutateAsync({ request: parsed.data, photos }));
    });

  return (
    <Screen footer={<AppButton label="Submit" isLoading={submit.isPending} onPress={onSubmit} />}>
      <Text accessibilityRole="header" className="mb-1 text-2xl font-bold text-foreground">
        New report
      </Text>
      {reports.data ? (
        <Text className="mb-4 text-sm text-muted-foreground">
          {privacyNote(reports.data.privacyMode)}
        </Text>
      ) : null}
      {submit.error ? <MessageBanner message={submit.error.message} /> : null}
      <SegmentedControl
        label="Type"
        options={typeOptions}
        selected={type}
        onSelect={(value) => setType(value as ComplaintType)}
      />
      <OptionList label="Related meal" options={mealOptions} selected={meal} onSelect={setMeal} />
      {meal !== NO_MEAL ? (
        <DateField
          label="Meal date"
          value={mealDate}
          bounds={{
            firstDate: addBusinessDays(today, -MEAL_LOOKBACK_DAYS),
            lastDate: today,
            today,
          }}
          onChange={setMealDate}
        />
      ) : null}
      <OptionList
        label="Category"
        options={categoryOptions}
        selected={category}
        onSelect={(value) => setCategory(value as ComplaintCategory)}
        error={problems.category}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        error={problems.description}
        placeholder="e.g. There was a small stone in today's lunch rice."
      />
      <ComplaintPhotos photos={photos} onChange={setPhotos} />
    </Screen>
  );
}

function Submitted({ receipt }: { receipt: ComplaintReceipt }) {
  const router = useRouter();
  return (
    <Screen footer={<AppButton label="Back to My Reports" onPress={() => router.back()} />}>
      <Text accessibilityRole="header" className="mb-4 text-2xl font-bold text-foreground">
        Report sent
      </Text>
      <MessageBanner
        tone="success"
        message={`Your reference number is ${receipt.complaint.referenceCode}. Keep it if you need to ask about this report.`}
      />
      <Text className="mt-2 text-sm text-muted-foreground">
        {privacyNote(receipt.complaint.privacyMode)}
      </Text>
    </Screen>
  );
}
