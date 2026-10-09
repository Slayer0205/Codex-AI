import {
  createHmac,
  timingSafeEqual,
  scryptSync,
  randomBytes,
} from "node:crypto";
import jwt from "jsonwebtoken";
import { DomainError } from "./domain.js";
export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
export function checkPassword(password: string, hash: string) {
  try {
    const [salt, value] = hash.split(":");
    const expected = Buffer.from(value, "hex");
    const actual = scryptSync(password, salt, 64);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
export function verifyTelegram(
  initData: string,
  token: string,
  now = Math.floor(Date.now() / 1000),
) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");
  if (!hash || !/^[a-f0-9]{64}$/.test(hash))
    throw new DomainError("Telegram autentifikatsiyasi noto‘g‘ri", 401);
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key)) throw new DomainError("Takroriy Telegram maydoni", 401);
    seen.add(key);
  }
  const check = [...params]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const computed = createHmac("sha256", secret).update(check).digest();
  if (!timingSafeEqual(computed, Buffer.from(hash, "hex")))
    throw new DomainError("Telegram imzosi noto‘g‘ri", 401);
  const timestamp = Number(params.get("auth_date"));
  if (
    !Number.isInteger(timestamp) ||
    now - timestamp > 300 ||
    timestamp > now + 30
  )
    throw new DomainError("Telegram sessiyasi eskirgan", 401);
  let user;
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch {
    throw new DomainError("Telegram foydalanuvchisi noto‘g‘ri", 401);
  }
  if (!Number.isSafeInteger(user.id) || user.id <= 0)
    throw new DomainError("Telegram foydalanuvchisi topilmadi", 401);
  return String(user.id);
}
export const issueToken = (
  userId: string,
  organizationId: string,
  secret: string,
) =>
  jwt.sign({ organizationId }, secret, {
    subject: userId,
    expiresIn: "8h",
    algorithm: "HS256",
    issuer: "smart-savdo",
    audience: "smart-savdo-web",
  });
export function decodeToken(token: string, secret: string) {
  try {
    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "smart-savdo",
      audience: "smart-savdo-web",
    }) as jwt.JwtPayload;
  } catch {
    throw new DomainError("Sessiya tugagan. Qayta kiring.", 401);
  }
}
