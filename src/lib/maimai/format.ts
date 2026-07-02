export function formatRating(value: number | undefined): string {
  return Number.isFinite(value) ? String(value) : "--";
}

export function formatAchievement(value: number | undefined): string {
  return Number.isFinite(value) ? `${Number(value).toFixed(4)}%` : "--";
}

export function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "--";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${month}/${day}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatSource(value: string | undefined): string {
  if (value === "diving_fish") {
    return "Diving-Fish";
  }

  return value || "local";
}
