const mexicoDateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Monterrey",
});

export function formatMexicoDateTime(value: unknown) {
  const date = value instanceof Date ? value : new Date(text(value));

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return mexicoDateTimeFormatter.format(date);
}

function text(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}
