import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import Logo from '@/assets/Images/logo.svg';

export function AppLogo() {
  return (
    <HoverCard openDelay={100} closeDelay={200}>
      <HoverCardTrigger asChild>
        <button className="flex items-center gap-2 cursor-pointer group">
          <img
            src={Logo}
            alt=""
            className="inline h-5 opacity-70 group-hover:opacity-100 transition-opacity"
          />
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 dark:bg-zinc-950 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors font-sans">
            SprintLab
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="ml-1.5 text-xs text-zinc-700 dark:text-zinc-300 dark:bg-zinc-950 font-sans">
        Sprint Kinematics Analysis by @mach_1_ne
      </HoverCardContent>
    </HoverCard>
  );
}
