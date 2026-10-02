export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string | null };

const COMMON = ["12345678", "123456789", "1234567890", "password", "contraseña", "qwertyui", "11111111", "abcd1234", "woref2026", "iloveyou"];

/** Fuerza orientativa de una contraseña: largo, variedad de caracteres y que no sea una de las más usadas. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", hint: null };
  const lower = password.toLowerCase();
  if (password.length < 8) return { score: 0, label: "Muy corta", hint: "Usá al menos 8 caracteres." };
  if (COMMON.some((word) => lower.includes(word)) || /^(.)\1+$/.test(password)) return { score: 1, label: "Muy común", hint: "Evitá contraseñas fáciles de adivinar." };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(password)).length;
  const points = kinds + (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0);
  if (points <= 2) return { score: 2, label: "Débil", hint: "Sumá mayúsculas, números o símbolos." };
  if (points === 3) return { score: 3, label: "Buena", hint: null };
  return { score: 4, label: "Fuerte", hint: null };
}
