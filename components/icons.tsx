import { Path, Circle, Rect, Ellipse, Svg } from 'react-native-svg'
import type { SvgProps } from 'react-native-svg'

/**
 * Icon set ported 1:1 from the original web app (same path data).
 * `color` is explicit — React Native has no CSS currentColor.
 */
export type IconProps = SvgProps & { size?: number; color?: string }

function base({ size = 20, color = '#131a15', ...rest }: IconProps): SvgProps {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...rest,
  }
}

/* ---------------- Navigation / UI ---------------- */

export const HomeIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5 9.5V21h14V9.5" />
    <Path d="M9.5 21v-6h5v6" />
  </Svg>
)

export const CpuIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Rect x="6" y="6" width="12" height="12" rx="2" />
    <Rect x="10" y="10" width="4" height="4" rx="0.5" />
    <Path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
  </Svg>
)

export const RecycleIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M7.5 13 5 8.7a1.6 1.6 0 0 1 1.4-2.4h3.2L8 4.5" />
    <Path d="M12 4.5h5.6A1.6 1.6 0 0 1 19 6.9l-1.6 2.8" />
    <Path d="m16 12 2.6 4.4a1.6 1.6 0 0 1-1.4 2.4h-3.4" />
    <Path d="m13.5 16.4-2.1 3.4a1.6 1.6 0 0 1-2.7.1L7.2 16.6" />
  </Svg>
)

export const BarChartIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M5 20V14" />
    <Path d="M12 20V8" />
    <Path d="M19 20V4" />
  </Svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="12" r="3.2" />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 10.12 4.6V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.28Z" />
  </Svg>
)

export const WifiIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M2.5 9a15 15 0 0 1 19 0" />
    <Path d="M5.5 12.5a10.5 10.5 0 0 1 13 0" />
    <Path d="M8.7 16a6 6 0 0 1 6.6 0" />
    <Circle cx="12" cy="19.5" r="1.1" fill={p.color} />
  </Svg>
)

export const SunIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="12" r="4" />
    <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const MoonIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
  </Svg>
)

export const BellIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M18 8a6 6 0 1 0-12 0c0 7-2.5 8-2.5 8h17S18 15 18 8" />
    <Path d="M10 20a2.2 2.2 0 0 0 4 0" />
  </Svg>
)

export const XIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m9 6 6 6-6 6" />
  </Svg>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m15 6-6 6 6 6" />
  </Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="m20.5 20.5-4.6-4.6" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m4.5 12.5 5 5 10-11" />
  </Svg>
)

export const CheckCircleIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="m8.2 12.4 2.6 2.6 5-5.4" />
  </Svg>
)

export const InfoIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 11v5" />
    <Circle cx="12" cy="7.8" r="0.9" strokeWidth={1.2} fill={p.color} />
  </Svg>
)

export const WarningIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <Path d="M12 9v4.5" />
    <Circle cx="12" cy="17.3" r="0.9" strokeWidth={1.2} fill={p.color} />
  </Svg>
)

export const AlertOctagonIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9L7.9 2Z" />
    <Path d="M12 8v4.5" />
    <Circle cx="12" cy="16.3" r="0.9" strokeWidth={1.2} fill={p.color} />
  </Svg>
)

export const DownloadIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 3v12" />
    <Path d="m7 10.5 5 5 5-5" />
    <Path d="M4.5 20.5h15" />
  </Svg>
)

export const PauseIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M9 5v14M15 5v14" strokeWidth={2.4} />
  </Svg>
)

export const PlayIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M7 4.8v14.4L19 12 7 4.8Z" fill={p.color} stroke="none" />
  </Svg>
)

export const StopIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Rect x="6" y="6" width="12" height="12" rx="1.5" fill={p.color} stroke="none" />
  </Svg>
)

export const ClockIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3.2 2" />
  </Svg>
)

export const CalendarIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Rect x="3.5" y="5" width="17" height="16" rx="2" />
    <Path d="M8 3v4M16 3v4M3.5 10.5h17" />
  </Svg>
)

export const UserIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
)

export const MailIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Rect x="3" y="5" width="18" height="14" rx="2" />
    <Path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
)

export const MapPinIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M20 10.5c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 1 1 16 0Z" />
    <Circle cx="12" cy="10.5" r="2.8" />
  </Svg>
)

export const RefreshIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
    <Path d="M20.5 3v5h-5" />
  </Svg>
)

export const ShieldIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.4 7.5 10 4.3-1.6 7.5-5 7.5-10v-6L12 2.5Z" />
    <Path d="m9 11.7 2.2 2.2L15.4 9.5" />
  </Svg>
)

export const SpoolerIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4.5 6.5h15" />
    <Path d="M4.5 17.5h15" />
    <Path d="M6.5 6.5v11M17.5 6.5v11" />
    <Ellipse cx="12" cy="12" rx="7.5" ry="5.5" />
    <Ellipse cx="12" cy="12" rx="2.6" ry="1.9" />
  </Svg>
)

/* ---------------- Machine / domain ---------------- */

export const ThermometerIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M10 4.5a2 2 0 1 1 4 0v8.8a4.5 4.5 0 1 1-4 0V4.5Z" />
    <Circle cx="12" cy="17" r="1.6" fill={p.color} />
    <Path d="M12 15.4V9" strokeWidth={1.4} />
  </Svg>
)

export const GaugeIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4.5 17.5a8.5 8.5 0 1 1 15 0" />
    <Path d="m12 14 3.5-5" />
    <Circle cx="12" cy="14.5" r="1.4" fill={p.color} />
  </Svg>
)

export const FanIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="12" r="1.6" fill={p.color} />
    <Path d="M12 10.4c0-3 .8-6.4 3.1-6.4 1.8 0 2.6 2 1.4 3.6-.9 1.2-2.8 2-4.5 2.8Z" />
    <Path d="M13.4 13.2c2.6 1.5 5.4 3.6 4.3 5.6-.9 1.6-3 1.3-3.9-.5-.6-1.3-.5-3.4-.4-5.1Z" />
    <Path d="M10.6 13.2c-2.6 1.5-5.4 3.6-4.3 5.6.9 1.6 3 1.3 3.9-.5.6-1.3.5-3.4.4-5.1Z" />
  </Svg>
)

export const BottleIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M9.5 2.5h5v3.2l1.8 2.1a3 3 0 0 1 .7 1.9v9.3a2.5 2.5 0 0 1-2.5 2.5h-5a2.5 2.5 0 0 1-2.5-2.5V9.7a3 3 0 0 1 .7-1.9l1.8-2.1V2.5Z" />
    <Path d="M7.2 13h9.6" strokeWidth={1.4} />
  </Svg>
)

export const LeafIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4.5 19.5C4.5 10 10.5 4.5 19.5 4.5c0 9-5.5 15-15 15Z" />
    <Path d="M4.5 19.5C8 15 12 12 16.5 10" />
  </Svg>
)

export const WrenchIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M14.1 6.2a4.3 4.3 0 0 1 5.9-4l-3 3 .9 2.9 2.9.9 3-3a4.3 4.3 0 0 1-6 5.8L8 21.5a2.1 2.1 0 0 1-3-3l9.1-9.8Z" />
  </Svg>
)

export const ActivityIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" />
  </Svg>
)

export const FlaskIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M9.5 3h5" />
    <Path d="M10.5 3v5.2L5.6 17a2.2 2.2 0 0 0 2 3.3h8.8a2.2 2.2 0 0 0 2-3.3l-4.9-8.8V3" />
    <Path d="M7.8 14.5h8.4" />
  </Svg>
)

export const LogoIcon = (p: IconProps) => (
  <Svg width={p.size ?? 26} height={p.size ?? 26} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3.2 14.2 7H18a1.6 1.6 0 0 1 1.4 2.4l-1.5 2.6 2 1.2-4.4.9-1.5-4.2 2 1.1 1.3-2.2h-3.4L12 5.9 10.7 8.8H7.3l1.3 2.2 2-1.1-1.5 4.2-4.4-.9 2-1.2L5.2 9.4A1.6 1.6 0 0 1 6.6 7h3.4L12 3.2Z"
      fill={p.color ?? '#ffffff'}
      opacity={0.95}
    />
    <Path
      d="m9.4 15.6-1.7 3a1.6 1.6 0 0 0 1.4 2.4h2.4v-2.3h-1.9l1.2-2.2-1.4-.9Z"
      fill={p.color ?? '#ffffff'}
      opacity={0.55}
    />
    <Path
      d="m14.6 15.6 1.7 3a1.6 1.6 0 0 1-1.4 2.4h-2.4v-2.3h1.9l-1.2-2.2 1.4-.9Z"
      fill={p.color ?? '#ffffff'}
      opacity={0.75}
    />
  </Svg>
)
