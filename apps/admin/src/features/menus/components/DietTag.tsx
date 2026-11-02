import { DietType } from '@ennel/shared';
import nonVegMark from '@/assets/icons/diet-non-veg.svg';
import vegMark from '@/assets/icons/diet-veg.svg';

/** The Figma "Diet tag": always the mark and the word, never colour alone (Admin §E). */
export function DietTag({ diet }: { diet: DietType }) {
  const isVeg = diet === DietType.VEG;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
      <img alt="" src={isVeg ? vegMark : nonVegMark} width={9} height={12} />
      {isVeg ? 'Veg' : 'Non-veg'}
    </span>
  );
}
