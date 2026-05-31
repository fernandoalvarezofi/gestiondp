type Props = {
  variant?: "symbol" | "full" | "wordmark";
  size?: number;
  className?: string;
};

export function WorefLogo({ variant = "full", size = 32, className }: Props) {
  const symbol = (
    <svg
      width={size * 1.4}
      height={size}
      viewBox="0 0 56 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 4C11.163 4 4 11.163 4 20C4 28.837 11.163 36 20 36H26V30H20C14.477 30 10 25.523 10 20C10 14.477 14.477 10 20 10H26V4H20Z"
        fill="currentColor"
      />
      <path
        d="M36 4C44.837 4 52 11.163 52 20C52 28.837 44.837 36 36 36H30V30H36C41.523 30 46 25.523 46 20C46 14.477 41.523 10 36 10H30V4H36Z"
        fill="currentColor"
      />
      <circle cx="28" cy="20" r="5" fill="currentColor" />
    </svg>
  );

  const wordmark = (
    <span style={{ fontSize: size * 0.65, lineHeight: 1, letterSpacing: "-0.02em" }}>
      <span style={{ fontWeight: 700 }}>woref</span>
      <span style={{ fontWeight: 400, opacity: 0.5 }}>.com</span>
    </span>
  );

  if (variant === "symbol") return <span className={className}>{symbol}</span>;
  if (variant === "wordmark") return <span className={className}>{wordmark}</span>;

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {symbol}
      {wordmark}
    </div>
  );
}

export default WorefLogo;
