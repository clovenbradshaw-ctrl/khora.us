import * as icons from 'lucide-react';

const ICON_MAP = {
  'user': icons.User,
  'home': icons.Home,
  'dollar-sign': icons.DollarSign,
  'heart-pulse': icons.HeartPulse,
  'shield': icons.Shield,
  'users': icons.Users,
  'clipboard-list': icons.ClipboardList,
  'target': icons.Target,
  'search': icons.Search,
  'plus': icons.Plus,
  'x': icons.X,
  'chevron-down': icons.ChevronDown,
  'chevron-up': icons.ChevronUp,
  'chevron-left': icons.ChevronLeft,
  'chevron-right': icons.ChevronRight,
  'clock': icons.Clock,
  'eye': icons.Eye,
  'eye-off': icons.EyeOff,
  'git-commit': icons.GitCommit,
  'alert-circle': icons.AlertCircle,
  'alert-triangle': icons.AlertTriangle,
  'check-circle': icons.CheckCircle,
  'info': icons.Info,
  'history': icons.History,
  'play': icons.Play,
  'skip-back': icons.SkipBack,
  'skip-forward': icons.SkipForward,
  'calendar': icons.Calendar,
  'lock': icons.Lock,
  'unlock': icons.Unlock,
  'code': icons.Code,
  'file-text': icons.FileText,
  'activity': icons.Activity,
};

export default function Icon({ name, size = 16, color, className, style, ...props }) {
  const Component = ICON_MAP[name] || icons.Circle;
  return (
    <Component
      size={size}
      color={color}
      className={className}
      style={style}
      {...props}
    />
  );
}
